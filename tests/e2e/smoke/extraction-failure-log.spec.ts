/**
 * Extraction-failure event-log helper smoke test (pure-Node, no browser, no HTTP server).
 *
 * Proves the payload builder used on the URL-extraction failure (422) branch of
 * functions/api/content-intelligence/analyze-url.ts produces a well-formed, bounded
 * event-log entry — so prod failures are visible in event_logs.
 *
 * Imports the standalone helper module (no `unpdf`/AI-gateway transitive deps), so it
 * runs cleanly in pure Node without a running server or `page` fixture.
 */
import { test, expect } from '@playwright/test'
import { extractionFailureLog } from '../../../functions/api/content-intelligence/_extraction-log'

test.describe('Extraction-failure event-log payload @smoke', () => {
  test('@smoke builds a well-formed warn entry for a string reason', async () => {
    const entry = extractionFailureLog('https://example.com/x', 'timeout after 10s')

    expect(entry.level).toBe('warn')
    expect(entry.source).toBe('content-intelligence/analyze-url')
    expect(typeof entry.message).toBe('string')
    expect(entry.message.length).toBeGreaterThan(0)
    expect(entry.context).toEqual({
      url: 'https://example.com/x',
      reason: 'timeout after 10s',
    })
  })

  test('@smoke coerces a non-string reason and caps a very long one', async () => {
    // Error object → coerced to a string, not left as an object.
    const fromError = extractionFailureLog('https://example.com/y', new Error('boom') as unknown)
    expect(typeof fromError.context.reason).toBe('string')
    expect(fromError.context.reason).toContain('boom')

    // undefined → coerced to a non-empty string sentinel.
    const fromUndefined = extractionFailureLog('https://example.com/z', undefined as unknown)
    expect(typeof fromUndefined.context.reason).toBe('string')
    expect(fromUndefined.context.reason.length).toBeGreaterThan(0)

    // A very long reason is capped (helper slices at 500 chars).
    const long = 'x'.repeat(5000)
    const fromLong = extractionFailureLog('https://example.com/long', long as unknown)
    expect(typeof fromLong.context.reason).toBe('string')
    expect(fromLong.context.reason.length).toBeLessThanOrEqual(500)
  })
})
