/**
 * First-party analysis rate-limit exemption (pure-Node, no browser, no server).
 *
 * The public analysis cap is 12/hour keyed on CF-Connecting-IP, which is a sane
 * budget for a drive-by caller and a nonsensical one for the community's own
 * automation: every first-party caller behind one egress shared those 12
 * requests with each other and with any human on the same address.
 *
 * These tests pin the recognition rules, because the failure mode of getting
 * them wrong is silent and asymmetric — too strict starves the bots, too loose
 * hands anyone an unmetered path to paid model calls.
 */
import { test, expect } from '@playwright/test'
import { serviceAnalysisLimit, trustedServiceKey } from '../../../functions/api/_middleware'

const KEY_A = 'a'.repeat(48)
const KEY_B = 'b'.repeat(48)
const ENV = { TRUSTED_ANALYSIS_KEYS: `${KEY_A},${KEY_B}` }

function req(authorization?: string, serviceKey?: string): Request {
  const headers: Record<string, string> = {}
  if (authorization) headers.Authorization = authorization
  if (serviceKey) headers['X-Service-Key'] = serviceKey
  return new Request('https://researchtools.net/api/content-intelligence/analyze-url', {
    method: 'POST',
    headers,
  })
}

test.describe('first-party analysis exemption @smoke', () => {
  test('@smoke recognizes an rt_svc_ integration token, keyed by client id only', () => {
    const clientId = 'signalbot-production'
    const secret = 'x'.repeat(43)
    const key = trustedServiceKey(req(`Bearer rt_svc_${clientId}.${secret}`), {})
    expect(key).toBe(`svc:${clientId}`)
    // The secret half must never reach a KV key.
    expect(key).not.toContain(secret)
  })

  test('@smoke rejects a malformed rt_svc_ token rather than exempting it', () => {
    expect(trustedServiceKey(req('Bearer rt_svc_short.abc'), {})).toBeNull()
    expect(trustedServiceKey(req('Bearer rt_svc_noSecretHalf'), {})).toBeNull()
  })

  test('@smoke recognizes an interim trusted key', () => {
    expect(trustedServiceKey(req(`Bearer ${KEY_A}`), ENV)).toBe('key:0')
    expect(trustedServiceKey(req(`Bearer ${KEY_B}`), ENV)).toBe('key:1')
  })

  test('@smoke does NOT exempt an unknown bearer token', () => {
    expect(trustedServiceKey(req(`Bearer ${'z'.repeat(48)}`), ENV)).toBeNull()
  })

  test('@smoke prefers X-Service-Key, so identity and rate standing stay separate', () => {
    // The bot keeps sending its own (weak) identity bearer for the
    // supplied-content path while presenting a strong exemption key here.
    const request = req('Bearer signal-identity-token', KEY_A)
    expect(trustedServiceKey(request, ENV)).toBe('key:0')
  })

  test('@smoke does NOT exempt an unknown X-Service-Key', () => {
    expect(trustedServiceKey(req(undefined, 'z'.repeat(48)), ENV)).toBeNull()
  })

  test('@smoke ignores keys under 32 chars so a truncated paste cannot exempt', () => {
    const short = 'a'.repeat(24)
    expect(trustedServiceKey(req(undefined, short), { TRUSTED_ANALYSIS_KEYS: short })).toBeNull()
  })

  test('@smoke does NOT exempt a request with no Authorization header', () => {
    expect(trustedServiceKey(req(), ENV)).toBeNull()
  })

  test('@smoke does NOT exempt when no trusted keys are configured', () => {
    expect(trustedServiceKey(req(`Bearer ${KEY_A}`), {})).toBeNull()
  })

  test('@smoke ignores short entries so a blank/typo env value cannot exempt everyone', () => {
    // A stray comma or a placeholder like "changeme" must not become a key.
    expect(trustedServiceKey(req('Bearer '), { TRUSTED_ANALYSIS_KEYS: ',,short,' })).toBeNull()
    expect(trustedServiceKey(req('Bearer short'), { TRUSTED_ANALYSIS_KEYS: ',,short,' })).toBeNull()
  })

  test('@smoke does not treat a prefix of a trusted key as a match', () => {
    expect(trustedServiceKey(req(`Bearer ${KEY_A.slice(0, 47)}`), ENV)).toBeNull()
    expect(trustedServiceKey(req(`Bearer ${KEY_A}extra`), ENV)).toBeNull()
  })

  test('@smoke service budget defaults high but stays finite', () => {
    expect(serviceAnalysisLimit({})).toBe(600)
    expect(serviceAnalysisLimit({ SERVICE_ANALYSIS_HOURLY_LIMIT: '2000' })).toBe(2000)
    // Garbage and non-positive values fall back rather than disabling the cap.
    expect(serviceAnalysisLimit({ SERVICE_ANALYSIS_HOURLY_LIMIT: '0' })).toBe(600)
    expect(serviceAnalysisLimit({ SERVICE_ANALYSIS_HOURLY_LIMIT: '-1' })).toBe(600)
    expect(serviceAnalysisLimit({ SERVICE_ANALYSIS_HOURLY_LIMIT: 'unlimited' })).toBe(600)
  })
})
