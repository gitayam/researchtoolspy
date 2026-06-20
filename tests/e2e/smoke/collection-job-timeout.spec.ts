/**
 * Collection job timeout smoke test (pure-Node, no browser, no HTTP server).
 *
 * Guards two scoped reliability fixes for the Agentic Research feature:
 *
 *   - isCollectionJobStale(): the pure decision used by the status handler to
 *     decide whether a still-in-flight job has aged past COLLECTION_TIMEOUT_MINUTES
 *     and must be transitioned to a terminal error. Boundary is INCLUSIVE (>=).
 *   - AI_RATE_LIMITED_PATHS: POST /api/collection/start must be covered by the
 *     per-user AI rate limiter (it spawns an external LLM agent run).
 *
 * Times are built as fixed strings and an explicit nowMs is passed in, so the
 * helper is exercised deterministically with no reliance on the wall clock.
 */
import { test, expect } from '@playwright/test'
import {
  isCollectionJobStale,
  COLLECTION_TIMEOUT_MINUTES,
} from '../../../functions/api/collection/[jobId]/status'
import { AI_RATE_LIMITED_PATHS } from '../../../functions/api/_middleware'

/** Fixed "now" so the test never depends on the wall clock. */
const NOW_MS = Date.UTC(2026, 0, 15, 12, 0, 0) // 2026-01-15T12:00:00Z

/** Format an epoch-ms instant as a SQLite datetime('now') string (UTC, no 'Z'). */
function toSqliteUtc(ms: number): string {
  return new Date(ms).toISOString().replace('T', ' ').slice(0, 19)
}

test.describe('Collection job timeout helper @smoke', () => {
  test('@smoke a job created 20 minutes ago is stale', () => {
    const createdAt = toSqliteUtc(NOW_MS - 20 * 60 * 1000)
    expect(isCollectionJobStale(createdAt, NOW_MS)).toBe(true)
  })

  test('@smoke a job created 2 minutes ago is not stale', () => {
    const createdAt = toSqliteUtc(NOW_MS - 2 * 60 * 1000)
    expect(isCollectionJobStale(createdAt, NOW_MS)).toBe(false)
  })

  test('@smoke exactly at the timeout boundary is stale (>= is inclusive)', () => {
    const createdAt = toSqliteUtc(NOW_MS - COLLECTION_TIMEOUT_MINUTES * 60 * 1000)
    expect(isCollectionJobStale(createdAt, NOW_MS)).toBe(true)

    // One second inside the window is NOT stale.
    const justInside = toSqliteUtc(NOW_MS - (COLLECTION_TIMEOUT_MINUTES * 60 - 1) * 1000)
    expect(isCollectionJobStale(justInside, NOW_MS)).toBe(false)
  })

  test('@smoke an unparseable created_at is never auto-failed', () => {
    expect(isCollectionJobStale('not-a-date', NOW_MS)).toBe(false)
  })
})

test.describe('AI rate-limit coverage @smoke', () => {
  test('@smoke /api/collection/start is rate-limited', () => {
    expect(AI_RATE_LIMITED_PATHS).toContain('/api/collection/start')
  })

  test('@smoke the broader /api/collection/ prefix is NOT listed (would wrongly throttle the callback)', () => {
    expect(AI_RATE_LIMITED_PATHS).not.toContain('/api/collection/')
  })
})
