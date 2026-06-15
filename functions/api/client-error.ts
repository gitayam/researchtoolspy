/**
 * Client-side error sink — receives uncaught React errors from ErrorBoundary
 * (and any other client crash) and records them in event_logs so frontend
 * failures are visible alongside backend ones. Read via GET /api/cron/event-logs.
 *
 * Best-effort and intentionally lenient (an error reporter must not error). Volume
 * is bounded by event_logs' 30-day retention; messages/context are truncated by logEvent.
 */

import { logEvent } from './_shared/event-log'

interface Env {
  DB?: any // D1Database
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const body = (await context.request.json().catch(() => ({}))) as any
    const message = String(body?.message || 'client error').slice(0, 1000)
    if (message.trim()) {
      const source = 'client:' + String(body?.source || 'unknown').slice(0, 80)
      await logEvent(context.env, { level: 'error', source, message, context: body?.context })
    }
  } catch {
    // never fail an error report
  }
  return new Response(null, { status: 204 })
}
