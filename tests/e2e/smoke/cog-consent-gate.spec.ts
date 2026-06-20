/**
 * COG consent-gate smoke test (pure-Node, no browser, no HTTP server).
 *
 * The COG AI vulnerability-generation endpoint (functions/api/ai/cog-analysis.ts)
 * is a Tier-1 sensitive use: it identifies how to attack a center of gravity, so it
 * must sit behind the same recorded-consent gate as ai/generate. The cleanest
 * testable unit is the shared gate itself.
 *
 * Exercises functions/api/_shared/consent.ts directly to prove the contract the
 * frontend `fetchWithConsent` relies on:
 *
 *   - No consent row on record  → a 403 Response with code 'consent_required'.
 *   - Consent row present        → null (proceed; gate does not fire).
 *
 * This imports requireConsent and mocks D1's prepare().bind().first() shape that
 * consent.ts uses — no `page` fixture, no running server. Mocks are cast with
 * `as unknown as ConsentEnv` because the mock D1 does not structurally match the
 * real D1Database type.
 */
import { test, expect } from '@playwright/test'
import { requireConsent, SENSITIVE_AI_CONSENT, SENSITIVE_AI_CONSENT_VERSION } from '../../../functions/api/_shared/consent'

// requireConsent's env param is the (unexported) ConsentEnv: { DB: D1Database }.
type ConsentEnv = Parameters<typeof requireConsent>[0]

const USER_ID = 42

/**
 * Mock env whose DB.prepare().bind().first() resolves the given consent row
 * (or null), mirroring the exact chain consent.ts queries.
 */
function makeConsentEnv(row: { version: number } | null): ConsentEnv {
  const stmt = {
    bind: () => ({
      first: async () => row,
    }),
  }
  return { DB: { prepare: () => stmt } } as unknown as ConsentEnv
}

test.describe('COG consent gate: Tier-1 gate fires on missing consent @smoke', () => {
  test('@smoke no consent row yields a 403 consent_required Response', async () => {
    const env = makeConsentEnv(null)

    const result = await requireConsent(env, USER_ID, SENSITIVE_AI_CONSENT, SENSITIVE_AI_CONSENT_VERSION)

    expect(result).toBeInstanceOf(Response)
    const res = result as Response
    expect(res.status).toBe(403)
    const body = (await res.json()) as { code?: string; consent_type?: string }
    expect(body.code).toBe('consent_required')
    expect(body.consent_type).toBe(SENSITIVE_AI_CONSENT)
  })

  test('@smoke a recorded consent row at the required version passes (returns null)', async () => {
    const env = makeConsentEnv({ version: SENSITIVE_AI_CONSENT_VERSION })

    const result = await requireConsent(env, USER_ID, SENSITIVE_AI_CONSENT, SENSITIVE_AI_CONSENT_VERSION)

    expect(result).toBeNull()
  })

  test('@smoke default consent type matches the gate applied across sensitive AI endpoints', async () => {
    // ai/generate, relationships/infer-type, summarize-entity, and cog-analysis all
    // call requireConsent with the default SENSITIVE_AI_CONSENT type — assert the
    // default-arg path behaves identically to the explicit COG call above.
    const denied = await requireConsent(makeConsentEnv(null), USER_ID)
    expect(denied).toBeInstanceOf(Response)
    expect((denied as Response).status).toBe(403)

    const allowed = await requireConsent(
      makeConsentEnv({ version: SENSITIVE_AI_CONSENT_VERSION }),
      USER_ID,
    )
    expect(allowed).toBeNull()
  })
})
