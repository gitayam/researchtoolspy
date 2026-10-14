import { expect, test } from '@playwright/test'
import type { D1Database } from '@cloudflare/workers-types'
import { onRequest } from '../../../functions/api/research/analyze-evidence'
import { onRequest as discover } from '../../../functions/api/integrations/capabilities'
import { deriveIntegrationTokenHash } from '../../../functions/api/_shared/service-auth'
import { parseEvidenceRequest, validateEvidenceResult } from '../../../functions/api/_shared/evidence-analysis-contract'

const CLIENT_ID = 'community_client_01'
const SECRET = 'A'.repeat(43)
const HASH_KEY = 'integration-test-key-material-0000000000000000'
const TOKEN = `rt_svc_${CLIENT_ID}.${SECRET}`
const QUOTE = 'Police said the figures are broadly balanced and no clear trend is apparent.'
const BODY = { schemaVersion: 'evidence-analysis.v1', tasks: ['questions', 'claims', 'entities', 'framework_questions'],
  questions: [{ id: 'trend', question: 'Was there a trend in the call figures?' }],
  excerpts: [{ id: 'E1', section: 'Calls for service', text: `${QUOTE} Officer Jones spoke.` }],
  corrections: ['Do not turn a concern into a decision.'] }

async function serviceDb(scopes: string[]): Promise<D1Database> {
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
  return { prepare: () => {
    const statement = { bind: () => statement, all: async () => ({ success: true, results }),
      first: async () => null, run: async () => ({ success: true }) }
    return statement
  } } as unknown as D1Database
}

async function context(scopes: string[], body: unknown = BODY, enabled = true) {
  return { request: new Request('https://researchtools.net/api/research/analyze-evidence', {
    method: 'POST', headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }), env: { DB: await serviceDb(scopes), INTEGRATION_TOKEN_HASH_KEY: HASH_KEY,
    COMMUNITY_INTEGRATIONS_ENABLED: 'true', EVIDENCE_ANALYSIS_SERVICE_ENABLED: String(enabled),
    OPENAI_API_KEY: 'test-key', ENVIRONMENT: 'production' } } as unknown as Parameters<typeof onRequest>[0]
}

test('evidence-analysis.v1 bounds input and validates exact source quotes', () => {
  const request = parseEvidenceRequest(BODY)
  expect(request).not.toBeNull()
  expect(parseEvidenceRequest({ ...BODY, excerpts: [BODY.excerpts[0], BODY.excerpts[0]] })).toBeNull()
  expect(parseEvidenceRequest({ ...BODY, excerpts: [{ id: 'E1', text: 'x'.repeat(36_001) }] })).toBeNull()
  const result = validateEvidenceResult(request!, { answers: [{ id: 'trend', status: 'answered', answer: 'No clear trend.',
    quotes: [{ evidenceId: 'E1', text: QUOTE }] }], claims: [{ text: 'A trend exists', quotes: [{ evidenceId: 'E1', text: 'Not in source' }] }],
    entities: [{ name: 'Officer Jones', kind: 'person', text: '', quotes: [{ evidenceId: 'E1', text: 'Officer Jones spoke.' }] }],
    frameworkQuestions: [{ framework: 'ACH', text: 'What would distinguish a trend from ordinary variation?', quotes: [{ evidenceId: 'E1', text: QUOTE }] }] })
  expect(result?.answers[0]).toMatchObject({ status: 'answered', answer: 'No clear trend.' })
  expect(result?.claims).toEqual([])
  expect(result?.entities).toHaveLength(1)
  expect(result?.frameworkQuestions).toHaveLength(1)
  expect(validateEvidenceResult(request!, { answers: [{ id: 'trend', status: 'answered', answer: 'Trend exists.', quotes: [] }],
    claims: [], entities: [], frameworkQuestions: [] })?.answers[0].status).toBe('conflicted')
})

test('scoped service advertises and returns non-persistent, quote-checked analysis', async () => {
  const ctx = await context(['community.research.execute'])
  const discovery = await discover({ ...ctx, request: new Request('https://researchtools.net/api/integrations/capabilities', {
    headers: { Authorization: `Bearer ${TOKEN}` },
  }) } as Parameters<typeof discover>[0])
  const advertised = await discovery.json() as { capabilities: { evidenceAnalysis?: boolean }; contractVersions: { evidenceAnalysis?: string } }
  expect(advertised.capabilities.evidenceAnalysis).toBe(true)
  expect(advertised.contractVersions.evidenceAnalysis).toBe('evidence-analysis.v1')

  const original = globalThis.fetch
  let modelCalls = 0
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    modelCalls++
    expect(typeof (JSON.parse(String(init?.body)) as { model?: unknown }).model).toBe('string')
    return Response.json({ choices: [{ message: { content: JSON.stringify({
      answers: [{ id: 'trend', status: 'answered', answer: 'Police saw no clear trend.', quotes: [{ evidenceId: 'E1', text: QUOTE }] }],
      claims: [], entities: [], frameworkQuestions: [],
    }) }, finish_reason: 'stop' }] })
  }) as typeof fetch
  try {
    const response = await onRequest(ctx)
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect((await response.json() as { answers: Array<{ status: string }> }).answers[0].status).toBe('answered')
    expect(modelCalls).toBe(1)
  } finally { globalThis.fetch = original }
})

test('missing scope and feature flag refuse analysis before model use', async () => {
  const missing = await onRequest(await context(['community.events.write'], BODY))
  expect(missing.status).toBe(403)
  expect((await onRequest(await context(['community.research.execute'], BODY, false))).status).toBe(403)
})

test('gateway failure does not bypass its limits through direct OpenAI', async () => {
  const ctx = await context(['community.research.execute'])
  ;(ctx.env as { AI_GATEWAY_ACCOUNT_ID?: string }).AI_GATEWAY_ACCOUNT_ID = 'test-account'
  const original = globalThis.fetch
  const destinations: string[] = []
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    destinations.push(String(input))
    return Response.json({ error: { message: 'Gateway budget reached' } }, { status: 429 })
  }) as typeof fetch
  try {
    expect((await onRequest(ctx)).status).toBe(503)
    expect(destinations).toHaveLength(1)
    expect(destinations[0]).toContain('gateway.ai.cloudflare.com')
  } finally { globalThis.fetch = original }
})
