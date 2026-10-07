import { expect, test } from '@playwright/test'
import type { D1Database } from '@cloudflare/workers-types'
import Ajv from 'ajv'
import { readFileSync } from 'node:fs'
import { onRequestPost } from '../../../functions/api/research/plan-remarks'
import { onRequest as discover } from '../../../functions/api/integrations/capabilities'
import { deriveIntegrationTokenHash } from '../../../functions/api/_shared/service-auth'
import {
  REMARKS_LIMITS,
  WARNING_CODES,
  budgetFor,
  checkAskPlacement,
  evaluateScript,
  factGuard,
  parseRemarksRequest,
  resolveVenue,
  type RemarksMap,
  type VenueInput,
} from '../../../functions/api/_shared/remarks-contract'

const readJson = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'))
const schema = readJson('../../../docs/api/schemas/remarks-plan.v1.schema.json')
const errorSchema = readJson('../../../docs/api/schemas/integration-error.v1.schema.json')
readJson('../../../docs/api/openapi/remarks-plan.v1.json')
const ajv = new Ajv({ allErrors: true })
ajv.addSchema(schema)
const validateResponse = ajv.compile({ $ref: `${schema.$id}#/definitions/response` })
const validateRequest = ajv.compile({ $ref: `${schema.$id}#/definitions/request` })
const validateError = ajv.compile(errorSchema)

const CLIENT_ID = 'community_client_01'
const SECRET = 'A'.repeat(43)
const HASH_KEY = 'integration-test-key-material-0000000000000000'
const TOKEN = `rt_svc_${CLIENT_ID}.${SECRET}`

const FORUM: VenueInput = { format: 'statement', secondsTotal: 180, secondsHard: true, pace: { preset: 'podium' }, bodyName: 'Fayetteville City Council public forum' }

const MAP: RemarksMap = {
  headline: 'DTA asks Council for comparable downtown police response-time data before October 13.',
  background: ['Downtown Alliance is a 26-year volunteer business league.'],
  relevance: ['At the June 9 Downtown Watch, police asked businesses to call 911 because calls justify presence.'],
  information: [
    { fact: 'A witness reported a 20-plus-minute wait after calling about an assault on Hay Street.', place: 'Hay Street', source: 'DTA email to the City Clerk' },
    { fact: 'Two other calls reported waits of about 36 and 40 minutes.', source: 'DTA email to the City Clerk' },
  ],
  ending: 'Comparable response-time data and a Council member at Downtown Watch on October 13 at 6 p.m.',
  follow_up: [
    { question: 'What about the panhandling ordinance?', answer: 'It is with the city attorneys. Response time is the gap it will not close.' },
    'Section 24-132 defines the Core Downtown Area.',
  ],
}

const GOOD_SCRIPT = [
  'Good evening. I serve on the executive board of the Downtown Alliance.',
  'DTA asks Council for comparable downtown police response-time data before October 13.',
  'In June, police asked downtown businesses to call 911 so that calls would justify presence.',
  'We called. One witness waited more than 20 minutes after reporting an assault on Hay Street.',
  'Two other calls waited about 36 and 40 minutes.',
  'We want to compare our record with yours.',
  'Please send the comparable downtown police response-time data before October 13, and join us at Downtown Watch.',
].join(' ')

/** Service-principal D1 fake that records every statement it is asked to run. */
async function serviceDb(scopes: string[], statements: string[] = []): Promise<D1Database> {
  const secretHash = await deriveIntegrationTokenHash(HASH_KEY, CLIENT_ID, SECRET)
  const base = {
    client_id: CLIENT_ID, community_id: 'community-test', workspace_id: 'workspace-test',
    intake_investigation_id: 'investigation-test', principal_user_id: 73,
    client_environment: 'production', audience: 'researchtools-community-api.v1',
    maximum_visibility: 'community', client_status: 'active',
    token_id: 'token_identifier_00000001', token_slot: 'current', secret_hash: secretHash,
    hash_version: 'hmac-sha256.v1', token_created_at: 1, not_before: 1, expires_at: 4_000_000_000,
    revoked_at: null, principal_row_id: 73, principal_role: 'service', principal_active: 1,
    principal_username: `service_${CLIENT_ID}`, principal_user_hash: null, principal_account_hash: null,
    principal_email: `service+${CLIENT_ID}@service.invalid`, principal_oidc_sub: null,
    principal_oidc_provider: null, principal_oidc_email: null, principal_password: 'SERVICE_AUTH_DISABLED',
    bound_workspace_id: 'workspace-test', workspace_owner_id: 73, workspace_type: 'TEAM',
    workspace_is_public: 0, bound_investigation_id: 'investigation-test',
    investigation_workspace_id: 'workspace-test', investigation_created_by: 73,
    investigation_status: 'active', principal_memberships: 0,
  }
  const results = scopes.map(token_scope => ({ ...base, token_scope }))
  return {
    prepare: (sql: string) => {
      statements.push(sql)
      return {
        bind: () => ({
          all: async () => ({ success: true, results }),
          first: async () => null,
          run: async () => ({ success: true }),
        }),
        all: async () => ({ success: true, results: sql.includes('SELECT') ? results : [] }),
        run: async () => ({ success: true }),
      }
    },
  } as unknown as D1Database
}

function installModelMock(reply: unknown): { calls: RequestInit[]; restore: () => void } {
  const original = globalThis.fetch
  const calls: RequestInit[] = []
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    if (url.hostname !== 'api.openai.com') throw new Error(`unexpected fetch ${url}`)
    calls.push(init ?? {})
    return Response.json({ choices: [{ message: { content: JSON.stringify(reply) } }] })
  }) as typeof fetch
  return { calls, restore: () => { globalThis.fetch = original } }
}

function post(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('https://researchtools.example/api/research/plan-remarks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}`, 'X-Correlation-ID': 'dta-remarks-test-00001', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

async function env(overrides: Record<string, unknown> = {}, scopes = ['community.research.execute'], statements: string[] = []) {
  return {
    DB: await serviceDb(scopes, statements),
    ENVIRONMENT: 'production',
    INTEGRATION_TOKEN_HASH_KEY: HASH_KEY,
    COMMUNITY_INTEGRATIONS_ENABLED: 'true',
    REMARKS_SERVICE_ENABLED: 'true',
    OPENAI_API_KEY: 'test-openai-key',
    ...overrides,
  }
}

async function call(request: Request, e: Record<string, unknown>): Promise<Response> {
  return await onRequestPost({ request, env: e, params: {} } as never)
}

const request = (mode: string, extra: Record<string, unknown> = {}) => ({ schemaVersion: 'remarks-plan.v1', mode, venue: FORUM, ...extra })

test.describe('remarks-plan.v1 contract arithmetic @smoke', () => {
  test('@smoke a three-minute hard clock at podium pace is 165 seconds, 372 words, 405 maximum', () => {
    const { resolved, warnings } = resolveVenue(FORUM)
    expect(resolved).toEqual({ format: 'statement', secondsTotal: 180, secondsHard: true, scriptSeconds: 165, questionReserveSeconds: 0, wpm: 135, paceSource: 'preset:podium', targetFactor: 0.92 })
    const budget = budgetFor(resolved)
    expect(budget.targetWords).toBe(372)
    expect(budget.maxWords).toBe(405)
    expect(budget.marks).toEqual([{ atSeconds: 60, words: 135 }, { atSeconds: 120, words: 270 }, { atSeconds: 165, words: 372 }])
    expect(budget.answerCards).toBeNull()
    expect(warnings.map(w => w.code)).toEqual(['no_measured_rate'])
  })

  test('@smoke a soft clock targets the whole slot', () => {
    const { resolved } = resolveVenue({ ...FORUM, secondsHard: false })
    expect(resolved.scriptSeconds).toBe(180)
    expect(budgetFor(resolved).targetWords).toBe(405)
  })

  test('@smoke a measured read sets the rate, and fast or slow rates warn', () => {
    const measured = resolveVenue({ ...FORUM, pace: { measured: { words: 200, seconds: 75 } } })
    expect(measured.resolved).toMatchObject({ wpm: 160, paceSource: 'measured' })
    expect(measured.warnings.map(w => w.code)).toEqual(['pace_assumes_fast'])
    const slow = resolveVenue({ ...FORUM, pace: { measured: { words: 200, seconds: 120 } } })
    expect(slow.resolved.wpm).toBe(100)
    expect(slow.warnings.map(w => w.code)).toEqual(['pace_assumes_slow'])
  })

  test('@smoke each format produces the right artifact', () => {
    const withQuestions = resolveVenue({ format: 'statement_with_questions', secondsTotal: 300, secondsHard: true, pace: { preset: 'podium' } })
    expect(withQuestions.resolved.questionReserveSeconds).toBe(100)
    expect(withQuestions.resolved.scriptSeconds).toBe(184)
    const wqBudget = budgetFor(withQuestions.resolved)
    expect(wqBudget.answerCards).toEqual({ count: 3, wordsEach: 67, secondsEach: 30 })
    expect(wqBudget.allocation.map(a => a.section)).toContain('invite_questions')

    const zero = resolveVenue({ format: 'statement_with_questions', secondsTotal: 300, secondsHard: true, questionReserveSeconds: 0, pace: { preset: 'podium' } })
    expect(zero.warnings.map(w => w.code)).toContain('no_question_reserve')

    const qa = resolveVenue({ format: 'qa_only', secondsTotal: 600, secondsHard: false, pace: { preset: 'conversational' } })
    expect(qa.resolved.scriptSeconds).toBe(0)
    const qaBudget = budgetFor(qa.resolved, 4)
    expect(qaBudget).toMatchObject({ targetWords: 0, maxWords: 0, marks: [], allocation: [] })
    expect(qaBudget.answerCards).toEqual({ count: 4, wordsEach: 75, secondsEach: 30 })

    const open = resolveVenue({ format: 'open_discussion', secondsTotal: 3600, secondsHard: false, pace: { preset: 'podium' } })
    expect(open.resolved.scriptSeconds).toBe(60)
  })

  test('@smoke the October 5 overrun: nine minutes of material against a three-minute slot', () => {
    const { resolved } = resolveVenue(FORUM)
    const budget = budgetFor(resolved)
    const filler = 'We have operated for many years as volunteers and we care about this block and the people on it every day of the week. '
    // Six sections of material spoken in full, ask last, as the outline was ordered.
    const script = `${filler.repeat(50)}Our ask is transparency on downtown police response-time data before October 13.`
    const evaluation = evaluateScript(script, MAP, resolved, budget)
    const over = evaluation.warnings.find(w => w.code === 'over_budget')
    expect(over).toBeTruthy()
    expect((over!.detail as { overrunSeconds: number }).overrunSeconds).toBeGreaterThanOrEqual(300)
    expect(evaluation.warnings.map(w => w.code)).toContain('ask_lost_if_cut')
    expect(evaluation.estimatedSeconds).toBeGreaterThan(480)
  })

  test('@smoke a script that leads and ends with the ask passes placement', () => {
    const { resolved } = resolveVenue(FORUM)
    const placement = checkAskPlacement(GOOD_SCRIPT, MAP.headline, budgetFor(resolved).marks[0].words)
    expect(placement).toEqual({ inFirstTwoSentences: true, inLastSentence: true, beforeFirstMark: true })
  })

  test('@smoke the fact guard flags specifics that are not in the map, and nothing that is', () => {
    expect(factGuard(MAP, GOOD_SCRIPT)).toEqual([])
    const invented = `${GOOD_SCRIPT} Chief Robinson told us on March 3 that $40,000 and 12 officers were budgeted in 2025.`
    const hits = factGuard(MAP, invented)
    const texts = hits.map(h => `${h.kind}:${h.text}`)
    expect(texts).toEqual(expect.arrayContaining(['name:Chief Robinson', 'date:March 3', 'money:$40,000', 'year:2025']))
    expect(texts.some(t => t.startsWith('number:'))).toBe(false) // 12 is under the ordinal floor
    expect(factGuard(MAP, `${GOOD_SCRIPT} The wait was 55 minutes.`).map(h => h.text)).toEqual(['55'])
  })

  test('@smoke a statement that asks the room a question is flagged', () => {
    const { resolved } = resolveVenue(FORUM)
    const evaluation = evaluateScript(`${GOOD_SCRIPT} Why is nobody answering?`, MAP, resolved, budgetFor(resolved))
    expect(evaluation.warnings.map(w => w.code)).toContain('audience_will_not_respond')
  })

  test('@smoke the request parser is strict and refuses a bare rate', () => {
    expect(parseRemarksRequest(request('budget')).ok).toBe(true)
    for (const bad of [
      { ...request('budget'), venue: { ...FORUM, pace: { wpm: 135 } } },
      { ...request('budget'), venue: undefined },
      { ...request('budget'), extra: 1 },
      request('script'),
      request('check'),
      { ...request('budget'), venue: { ...FORUM, questionReserveSeconds: 30 } },
      { ...request('budget'), venue: { ...FORUM, secondsTotal: 10 } },
      { ...request('check', { script: 'x'.repeat(REMARKS_LIMITS.scriptChars + 1) }) },
      { ...request('script', { map: { ...MAP, background: Array(REMARKS_LIMITS.branchItems + 1).fill('x') } }) },
    ]) {
      expect(parseRemarksRequest(bad).ok, JSON.stringify(bad).slice(0, 120)).toBe(false)
      expect(validateRequest(bad), JSON.stringify(bad).slice(0, 120)).toBe(false)
    }
    expect(validateRequest(request('script', { map: MAP, voice: 'Warm and plain.' }))).toBe(true)
  })

  test('@smoke the published warning codes are exactly the implemented ones', () => {
    const published = schema.definitions.warning.properties.code.enum
    expect([...published].sort()).toEqual([...WARNING_CODES].sort())
  })
})

test.describe('remarks-plan.v1 service adapter @smoke', () => {
  test.describe.configure({ mode: 'serial' })

  test('@smoke an invalid reserved token never falls through to user auth', async () => {
    const response = await call(post(request('budget'), { Authorization: 'Bearer rt_svc_invalid' }), await env())
    expect(response.status).toBe(401)
    const body = await response.json()
    expect(validateError(body)).toBe(true)
    expect(body.error.code).toBe('invalid_service_token')
  })

  test('@smoke each gate denies independently: both flags and the exact scope', async () => {
    for (const [overrides, scopes] of [
      [{ COMMUNITY_INTEGRATIONS_ENABLED: 'false' }, undefined],
      [{ REMARKS_SERVICE_ENABLED: undefined }, undefined],
      [{ REMARKS_SERVICE_ENABLED: 'TRUE' }, undefined],
      [{}, ['community.events.write']],
    ] as const) {
      const mock = installModelMock({})
      try {
        const response = await call(post(request('script', { map: MAP })), await env(overrides, scopes ? [...scopes] : undefined))
        expect(response.status, JSON.stringify(overrides)).toBe(403)
        expect((await response.json()).error.code).toBe('scope_denied')
        expect(mock.calls).toHaveLength(0)
      } finally { mock.restore() }
    }
  })

  test('@smoke malformed, oversized, and persisting bodies are refused before the model', async () => {
    const mock = installModelMock({})
    try {
      for (const [body, status] of [
        ['{not json', 400],
        [[1, 2], 400],
        [request('budget', { venue: { ...FORUM, pace: { wpm: 135 } } }), 400],
        [request('script', { map: MAP, saveToFramework: true }), 400],
        [request('check', { script: 'word '.repeat(7000) }), 413],
      ] as const) {
        const response = await call(post(body), await env())
        expect(response.status, JSON.stringify(body).slice(0, 60)).toBe(status)
        const json = await response.json()
        expect(json.error.code).toBe('invalid_request')
        expect(JSON.stringify(json)).not.toContain('Hay Street')
      }
      expect(mock.calls).toHaveLength(0)
    } finally { mock.restore() }
  })

  test('@smoke budget and check modes call no model, write nothing, and match the schema', async () => {
    const statements: string[] = []
    const mock = installModelMock({})
    try {
      const budget = await call(post(request('budget')), await env({}, undefined, statements))
      expect(budget.status).toBe(200)
      expect(budget.headers.get('Cache-Control')).toBe('no-store')
      const budgetBody = await budget.json()
      expect(validateResponse(budgetBody), JSON.stringify(validateResponse.errors)).toBe(true)
      expect(budgetBody).toMatchObject({ id: null, mode: 'budget', correlationId: 'dta-remarks-test-00001', budget: { targetWords: 372, maxWords: 405 }, model: { used: false } })

      const check = await call(post(request('check', { map: MAP, script: GOOD_SCRIPT })), await env({}, undefined, statements))
      expect(check.status).toBe(200)
      const checkBody = await check.json()
      expect(validateResponse(checkBody), JSON.stringify(validateResponse.errors)).toBe(true)
      expect(checkBody.askPlacement).toEqual({ inFirstTwoSentences: true, inLastSentence: true, beforeFirstMark: true })
      expect(checkBody.factGuard).toEqual([])
      expect(checkBody.writtenSubmission.title).toContain('Fayetteville City Council public forum')
      expect(mock.calls).toHaveLength(0)
      const writes = statements.filter(sql => /\b(INSERT|UPDATE|DELETE)\b/i.test(sql))
      expect(writes.every(sql => /UPDATE\s+integration_client_tokens\s+SET\s+last_used_at/i.test(sql)), writes.join('\n')).toBe(true)
    } finally { mock.restore() }
  })

  test('@smoke script mode drafts once, persists nothing, and reports the specifics it invented', async () => {
    const statements: string[] = []
    const mock = installModelMock({ script: `${GOOD_SCRIPT} The chief promised 4 new officers by March 3.` })
    try {
      const response = await call(post(request('script', { map: MAP, voice: 'Warm and plain.' })), await env({}, undefined, statements))
      expect(response.status).toBe(200)
      const body = await response.json()
      expect(validateResponse(body), JSON.stringify(validateResponse.errors)).toBe(true)
      expect(body).toMatchObject({ id: null, mode: 'script', model: { used: true }, answerCards: null })
      expect(body.factGuard.map((h: { text: string }) => h.text)).toContain('March 3')
      expect(body.warnings.map((w: { code: string }) => w.code)).toContain('fact_unsupported')
      expect(mock.calls).toHaveLength(1)
      const sent = JSON.parse(String(mock.calls[0].body))
      expect(JSON.stringify(sent.messages)).toContain('Warm and plain.')
      expect(statements.some(sql => /framework_sessions/i.test(sql))).toBe(false)
    } finally { mock.restore() }
  })

  test('@smoke qa_only returns answer cards and no script', async () => {
    const mock = installModelMock({ answerCards: [{ question: 'Which code section defines downtown?', answer: 'Section 24-132.' }] })
    try {
      const response = await call(post({ ...request('script', { map: MAP }), venue: { format: 'qa_only', secondsTotal: 600, secondsHard: false, pace: { preset: 'conversational' } } }), await env())
      expect(response.status).toBe(200)
      const body = await response.json()
      expect(validateResponse(body), JSON.stringify(validateResponse.errors)).toBe(true)
      expect(body.script).toBeNull()
      expect(body.answerCards).toHaveLength(2)
      expect(body.answerCards[0].answer).toContain('city attorneys')
    } finally { mock.restore() }
  })

  test('@smoke a trim that invents a fact or loses the ask is refused and the original stands', async () => {
    const long = `${GOOD_SCRIPT} ${'We have many more details to share with Council. '.repeat(60)}`
    for (const reply of [
      { script: `${GOOD_SCRIPT} The chief promised 4 officers by March 3.` },
      { script: 'We called. Thank you for your time.' },
    ]) {
      const mock = installModelMock(reply)
      try {
        const response = await call(post(request('trim', { map: MAP, script: long })), await env())
        expect(response.status).toBe(502)
        const body = await response.json()
        expect(body.error).toMatchObject({ code: 'upstream_invalid_response', retryable: true })
      } finally { mock.restore() }
    }
  })

  test('@smoke discovery advertises remarksPlanning and its limits only with flag, scope, and model key', async () => {
    const discoverWith = async (overrides: Record<string, unknown>, scopes?: string[]) => {
      const response = await discover({
        request: new Request('https://researchtools.net/api/integrations/capabilities', { headers: { Authorization: `Bearer ${TOKEN}` } }),
        env: await env(overrides, scopes),
      } as never)
      expect(response.status).toBe(200)
      return await response.json()
    }
    const on = await discoverWith({})
    expect(on.capabilities.remarksPlanning).toBe(true)
    expect(on.contractVersions.remarksPlanning).toBe('remarks-plan.v1')
    expect(on.limits).toMatchObject({ remarksRequestBytes: 32768, remarksScriptChars: 6000, remarksBranchItems: 12, remarksVoiceChars: 2000 })
    for (const [overrides, scopes] of [
      [{ REMARKS_SERVICE_ENABLED: undefined }, undefined],
      [{ COMMUNITY_INTEGRATIONS_ENABLED: 'false' }, undefined],
      [{ OPENAI_API_KEY: undefined }, undefined],
      [{}, ['community.events.write']],
    ] as const) {
      const off = await discoverWith(overrides, scopes ? [...scopes] : undefined)
      expect('remarksPlanning' in off.capabilities, JSON.stringify(overrides)).toBe(false)
      expect(off.contractVersions.remarksPlanning).toBeUndefined()
      expect(off.limits.remarksRequestBytes).toBeUndefined()
    }
  })
})
