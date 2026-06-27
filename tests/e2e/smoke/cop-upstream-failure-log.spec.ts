/**
 * COP upstream-failure event-log helper smoke test (pure-Node, no browser, no HTTP server).
 *
 * Proves the payload builder used when a COP upstream integration degrades — REDSIGHT BDA
 * (alerts.ts) or Apify (scrape.ts) — produces a well-formed, bounded event-log entry that
 * matches the shape logEvent() expects. Previously these failures returned a bare `[]` and
 * were invisible in prod (Pages Functions console.* is not in deployment tail); now they
 * land in event_logs (GET /api/cron/event-logs).
 *
 * Imports the standalone zero-dependency helper module, so it runs cleanly in pure Node
 * without a running server or `page` fixture.
 */
import { test, expect } from '@playwright/test'
import { buildUpstreamFailureLog } from '../../../functions/api/cop/[id]/_upstream-failure-log'

test.describe('COP upstream-failure event-log payload @smoke', () => {
  test('@smoke builds a warn entry capturing the upstream status (REDSIGHT/alerts)', async () => {
    const entry = buildUpstreamFailureLog('cop/alerts', { status: 503 })

    expect(entry.level).toBe('warn')
    expect(entry.source).toBe('cop/alerts')
    expect(typeof entry.message).toBe('string')
    expect(entry.message.length).toBeGreaterThan(0)
    // The status must survive into the structured context AND the human message.
    expect(entry.context.status).toBe(503)
    expect(entry.message).toContain('503')
  })

  test('@smoke captures the error reason for a thrown fetch (Apify/scrape)', async () => {
    const entry = buildUpstreamFailureLog('cop/scrape', { error: new Error('boom') })

    expect(entry.level).toBe('warn')
    expect(entry.source).toBe('cop/scrape')
    // Error → coerced to its message string, not left as an object.
    expect(typeof entry.context.reason).toBe('string')
    expect(entry.context.reason).toContain('boom')
    // No status for a thrown fetch.
    expect(entry.context.status).toBeUndefined()
  })

  test('@smoke returns an object matching the LogEventInput shape logEvent expects', async () => {
    const entry = buildUpstreamFailureLog('cop/alerts', { status: 502 })

    // logEvent reads exactly: level, source, message, context (and optional userId).
    expect(Object.keys(entry).sort()).toEqual(['context', 'level', 'message', 'source'])
    expect(['error', 'warn', 'refusal', 'audit']).toContain(entry.level)
    expect(typeof entry.source).toBe('string')
    expect(typeof entry.message).toBe('string')
    expect(typeof entry.context).toBe('object')
  })

  test('@smoke coerces a non-Error reason and caps a very long one', async () => {
    // Non-Error throw value → coerced to a string.
    const fromString = buildUpstreamFailureLog('cop/scrape', { error: 'plain string failure' })
    expect(typeof fromString.context.reason).toBe('string')
    expect(fromString.context.reason).toContain('plain string failure')

    // A very long reason is capped (helper slices at 500 chars).
    const long = 'x'.repeat(5000)
    const fromLong = buildUpstreamFailureLog('cop/scrape', { error: long })
    expect(typeof fromLong.context.reason).toBe('string')
    expect(fromLong.context.reason!.length).toBeLessThanOrEqual(500)
  })
})
