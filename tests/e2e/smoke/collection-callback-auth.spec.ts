/**
 * Collection callback verification smoke test (pure-Node, no browser, no HTTP server).
 *
 * Exercises evaluateCallbackAuth() — the pure decision the collection callback uses to
 * verify a per-job token while staying backward-compatible during rollout:
 *
 *   - stored + incoming match  -> 'authenticated'
 *   - stored + incoming differ  -> 'reject'
 *   - stored present, none sent  -> 'unsigned-allowed' (rollout: agent not echoing yet)
 *   - no stored token (pre-migration job) -> 'unsigned-allowed'
 *
 * Imports the helper directly — no `page` fixture, no running server.
 */
import { test, expect } from '@playwright/test'
import {
  evaluateCallbackAuth,
  type CallbackAuthResult,
} from '../../../functions/api/collection/callback'

test.describe('Collection callback verification helper @smoke', () => {
  test('@smoke matching stored + incoming token authenticates', () => {
    const result: CallbackAuthResult = evaluateCallbackAuth('s1', 's1')
    expect(result).toBe('authenticated')
  })

  test('@smoke mismatched stored + incoming token is rejected', () => {
    expect(evaluateCallbackAuth('s1', 's2')).toBe('reject')
  })

  test('@smoke stored token but no incoming token is allowed (rollout)', () => {
    expect(evaluateCallbackAuth('s1', null)).toBe('unsigned-allowed')
    expect(evaluateCallbackAuth('s1', undefined)).toBe('unsigned-allowed')
  })

  test('@smoke no stored token and no incoming token is allowed (pre-migration job)', () => {
    expect(evaluateCallbackAuth(null, null)).toBe('unsigned-allowed')
  })

  test('@smoke no stored token ignores any incoming token (nothing to check against)', () => {
    expect(evaluateCallbackAuth(null, 'whatever')).toBe('unsigned-allowed')
  })
})
