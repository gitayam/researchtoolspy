/**
 * Pure helper for building the event-log payload emitted when a COP upstream
 * integration (REDSIGHT BDA, Apify) fails.
 *
 * Lives in its own zero-dependency module (no `env`, no D1, no fetch) so it can be
 * unit-tested in pure Node. The handlers import this and pass the result straight
 * to logEvent(); see functions/api/_shared/event-log.ts.
 *
 * Mirrors the v0.22.15 precedent in functions/api/content-intelligence/_extraction-log.ts:
 * upstream failures used to be swallowed with a bare `return []`, indistinguishable
 * from "no data" and invisible in prod (Pages Functions console.* is not visible in
 * deployment tail). These now land in event_logs (GET /api/cron/event-logs).
 */

const MAX_REASON_LEN = 500

export interface UpstreamFailureLog {
  level: 'warn'
  source: string
  message: string
  context: { status?: number; reason?: string }
}

/**
 * Build the (low-volume) event-log entry for a degraded upstream integration.
 *
 * Use `warn` (not `error`): these are recoverable — the caller falls back to cached
 * D1 data or simply returns no new items. `status` is set when the upstream replied
 * with a non-OK HTTP status; `error` (coerced + capped) when the fetch threw.
 */
export function buildUpstreamFailureLog(
  source: string,
  failure: { status?: number; error?: unknown }
): UpstreamFailureLog {
  const context: { status?: number; reason?: string } = {}
  if (failure.status !== undefined) {
    context.status = failure.status
  }
  if (failure.error !== undefined) {
    context.reason = String(
      failure.error instanceof Error ? failure.error.message : failure.error ?? 'unknown'
    ).slice(0, MAX_REASON_LEN)
  }

  const detail =
    failure.status !== undefined
      ? `upstream returned status ${failure.status}`
      : context.reason
        ? `upstream fetch failed: ${context.reason}`
        : 'upstream fetch failed'

  return {
    level: 'warn',
    source,
    message: `COP upstream degraded (${source}): ${detail}`,
    context,
  }
}
