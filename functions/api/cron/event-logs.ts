/**
 * Read recent production events (errors / warnings / model refusals) from the
 * event_logs sink. Pages Functions console output isn't visible in `tail`, so this
 * is how you actually see what's failing in prod.
 *
 * Secret-guarded (same X-Cron-Secret as the cleanup endpoint) — this is operator
 * data, not public. GET only (read-only).
 *
 *   GET /api/cron/event-logs                 -> 100 most recent events
 *   GET /api/cron/event-logs?level=refusal   -> filter by level (error|warn|refusal|audit)
 *   GET /api/cron/event-logs?limit=20&since=2026-06-13
 *   (header: X-Cron-Secret: <CRON_SECRET>)
 */

import { JSON_HEADERS } from '../_shared/api-utils'

interface Env {
  DB: D1Database
  CRON_SECRET?: string
}

function secretsMatch(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const configured = context.env.CRON_SECRET
  if (!configured) {
    return new Response(JSON.stringify({ error: 'CRON_SECRET not configured' }), { status: 503, headers: JSON_HEADERS })
  }
  const provided = context.request.headers.get('X-Cron-Secret') || ''
  if (!secretsMatch(provided, configured)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: JSON_HEADERS })
  }

  const url = new URL(context.request.url)
  const level = url.searchParams.get('level')
  const since = url.searchParams.get('since')
  const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '100', 10) || 100, 1), 500)

  const where: string[] = []
  const binds: any[] = []
  if (level && ['error', 'warn', 'refusal', 'audit'].includes(level)) { where.push('level = ?'); binds.push(level) }
  if (since) { where.push("created_at >= ?"); binds.push(since) }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

  try {
    const rows = await context.env.DB.prepare(
      `SELECT id, created_at, level, source, message, context, user_id
       FROM event_logs ${whereSql}
       ORDER BY id DESC LIMIT ?`
    ).bind(...binds, limit).all()

    // Lightweight counts-by-level over the last 24h for an at-a-glance health read
    const summary = await context.env.DB.prepare(
      `SELECT level, COUNT(*) AS n FROM event_logs
       WHERE created_at >= datetime('now','-1 day') GROUP BY level`
    ).all()

    return new Response(JSON.stringify({
      events: rows.results || [],
      count: (rows.results || []).length,
      last_24h: (summary.results || []).reduce((acc: any, r: any) => { acc[r.level] = r.n; return acc }, {}),
    }), { status: 200, headers: JSON_HEADERS })
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to read event logs' }), { status: 500, headers: JSON_HEADERS })
  }
}
