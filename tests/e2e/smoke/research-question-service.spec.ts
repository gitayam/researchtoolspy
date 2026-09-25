import { expect, test } from '@playwright/test'
import type { D1Database } from '@cloudflare/workers-types'
import { onRequestPost } from '../../../functions/api/research/generate-question'
import { onRequest as discover } from '../../../functions/api/integrations/capabilities'
import { deriveIntegrationTokenHash } from '../../../functions/api/_shared/service-auth'

const CLIENT_ID = 'community_client_01'
const SECRET = 'A'.repeat(43)
const HASH_KEY = 'integration-test-key-material-0000000000000000'
const TOKEN = `rt_svc_${CLIENT_ID}.${SECRET}`

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

const MODEL_QUESTION = {
  question: 'How has narrative modeling changed since 2021?',
  smartAssessment: {}, finerAssessment: {},
  nullHypothesis: 'H0: no change', alternativeHypothesis: 'H1: change',
  keyVariables: ['adoption'], dataCollectionMethods: ['survey'], potentialChallenges: ['access'],
  overallScore: 81,
}

function installOpenAiMock(): { calls: RequestInit[]; restore: () => void } {
  const original = globalThis.fetch
  const calls: RequestInit[] = []
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    if (url.hostname !== 'api.openai.com') throw new Error(`unexpected fetch ${url}`)
    calls.push(init ?? {})
    return Response.json({
      choices: [{ message: { content: JSON.stringify({ questions: [MODEL_QUESTION] }) } }],
    })
  }) as typeof fetch
  return { calls, restore: () => { globalThis.fetch = original } }
}

function post(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('https://researchtools.example/api/research/generate-question', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}`, ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

async function env(overrides: Record<string, unknown> = {}, scopes = ['community.research.execute'], statements: string[] = []) {
  return {
    DB: await serviceDb(scopes, statements),
    ENVIRONMENT: 'production',
    INTEGRATION_TOKEN_HASH_KEY: HASH_KEY,
    COMMUNITY_INTEGRATIONS_ENABLED: 'true',
    RESEARCH_QUESTIONS_SERVICE_ENABLED: 'true',
    OPENAI_API_KEY: 'test-openai-key',
    ...overrides,
  }
}

async function call(request: Request, e: Record<string, unknown>): Promise<Response> {
  return await onRequestPost({ request, env: e, params: {} } as never)
}

test.describe('research-question service adapter @smoke', () => {
  test.describe.configure({ mode: 'serial' })

  test('@smoke an invalid reserved token never falls through to user auth', async () => {
    const response = await call(post({ topic: 'x' }, { Authorization: 'Bearer rt_svc_invalid' }), await env())
    expect(response.status).toBe(401)
    expect(await response.json()).toMatchObject({
      schemaVersion: 'integration-error.v1',
      error: { code: 'invalid_service_token', retryable: false },
    })
  })

  test('@smoke each gate denies independently: both flags and the exact scope', async () => {
    for (const [overrides, scopes] of [
      [{ COMMUNITY_INTEGRATIONS_ENABLED: 'false' }, undefined],
      [{ RESEARCH_QUESTIONS_SERVICE_ENABLED: undefined }, undefined],
      [{ RESEARCH_QUESTIONS_SERVICE_ENABLED: 'TRUE' }, undefined],
      [{}, ['community.events.write']],
    ] as const) {
      const mock = installOpenAiMock()
      try {
        const response = await call(post({ topic: 'x' }), await env(overrides, scopes ? [...scopes] : undefined))
        expect(response.status, JSON.stringify(overrides)).toBe(403)
        expect((await response.json()).error.code).toBe('scope_denied')
        expect(mock.calls).toHaveLength(0)
      } finally { mock.restore() }
    }
  })

  test('@smoke malformed, oversized, and persisting bodies are rejected before the model', async () => {
    const mock = installOpenAiMock()
    try {
      for (const [body, status] of [
        ['{not json', 400],
        [[1, 2], 400],
        [{ topic: '' }, 400],
        [{ topic: 'x'.repeat(2001) }, 400],
        [{ topic: 'x', saveToDatabase: true }, 400],
        [{ topic: 'x', constraints: 'y'.repeat(17 * 1024) }, 413],
      ] as const) {
        const response = await call(post(body), await env())
        expect(response.status, JSON.stringify(body).slice(0, 40)).toBe(status)
        expect((await response.json()).error.code).toBe('invalid_request')
      }
      expect(mock.calls).toHaveLength(0)
    } finally { mock.restore() }
  })

  test('@smoke a scoped, enabled service gets questions and nothing is written', async () => {
    const statements: string[] = []
    const mock = installOpenAiMock()
    try {
      const response = await call(
        post({ topic: 'The current state of Narrative Modeling', saveToDatabase: false }),
        await env({}, undefined, statements),
      )
      expect(response.status).toBe(200)
      expect(response.headers.get('Cache-Control')).toBe('no-store')
      const body = await response.json()
      // Exactly the fields the IrregularChat decoder requires.
      expect(body).toMatchObject({ success: true, id: null, researchQuestionId: null })
      expect(body.questions).toHaveLength(1)
      expect(body.questions[0]).toMatchObject({
        question: MODEL_QUESTION.question, overallScore: 81,
        nullHypothesis: 'H0: no change', alternativeHypothesis: 'H1: change',
        keyVariables: ['adoption'], dataCollectionMethods: ['survey'], potentialChallenges: ['access'],
      })
      expect(mock.calls).toHaveLength(1)
      // The only write allowed is service-auth's own token last_used_at stamp.
      const writes = statements.filter(sql => /\b(INSERT|UPDATE|DELETE)\b/i.test(sql))
      expect(writes.every(sql => /UPDATE\s+integration_client_tokens\s+SET\s+last_used_at/i.test(sql)), writes.join('\n')).toBe(true)
      // Principal lookup reads workspace_members; the save path is the only research_questions user.
      expect(statements.some(sql => /research_questions/i.test(sql))).toBe(false)
      expect(writes.length).toBeLessThanOrEqual(1)
    } finally { mock.restore() }
  })

  test('@smoke discovery advertises researchQuestions only with flag, scope, and model key', async () => {
    const discoverWith = async (overrides: Record<string, unknown>, scopes?: string[]) => {
      const response = await discover({
        request: new Request('https://researchtools.net/api/integrations/capabilities', {
          headers: { Authorization: `Bearer ${TOKEN}` },
        }),
        env: await env(overrides, scopes),
      } as never)
      expect(response.status).toBe(200)
      return (await response.json()).capabilities.researchQuestions
    }
    expect(await discoverWith({})).toBe(true)
    expect(await discoverWith({ RESEARCH_QUESTIONS_SERVICE_ENABLED: undefined })).toBe(false)
    expect(await discoverWith({ COMMUNITY_INTEGRATIONS_ENABLED: 'false' })).toBe(false)
    expect(await discoverWith({ OPENAI_API_KEY: undefined })).toBe(false)
    expect(await discoverWith({}, ['community.events.write'])).toBe(false)
  })
})
