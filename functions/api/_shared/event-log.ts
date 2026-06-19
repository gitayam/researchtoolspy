/**
 * Event-log sink — production observability for Pages Functions.
 *
 * console.* is invisible in `wrangler pages deployment tail`, so warn/error/refusal/audit
 * events (audit = security/audit events that are not errors) go to the `event_logs` D1
 * table instead (see migration 105). Read them via
 * GET /api/cron/event-logs (secret-guarded); pruned daily by the cron worker.
 *
 * Design rules:
 * - NEVER throw: logging must not break the request it's observing (swallow all errors).
 * - Low-volume only: log errors, warnings, and model refusals — never per-request.
 * - Bounded: message/context are truncated; retention prunes rows >30 days.
 */

type LogLevel = 'error' | 'warn' | 'refusal' | 'audit'

interface LogEventInput {
  level: LogLevel
  source: string
  message: string
  context?: unknown
  userId?: number | null
}

interface LogEnv {
  DB?: any // D1Database
}

export async function logEvent(env: LogEnv, e: LogEventInput): Promise<void> {
  if (!env?.DB) return
  try {
    const ctx = e.context === undefined ? null : JSON.stringify(e.context).slice(0, 4000)
    await env.DB.prepare(
      `INSERT INTO event_logs (level, source, message, context, user_id) VALUES (?, ?, ?, ?, ?)`
    ).bind(e.level, e.source, (e.message || '').slice(0, 2000), ctx, e.userId ?? null).run()
  } catch {
    // Never fail the caller on a logging error.
  }
}
