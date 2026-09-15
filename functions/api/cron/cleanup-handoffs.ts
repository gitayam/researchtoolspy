/**
 * Nulls the payload of expired timeline handoffs the redeem path has not already cleared.
 *
 * Rows are never deleted (see schema/managed-migrations/0017_timeline_handoffs.sql — the
 * delete guard always aborts): this is a sweep about bytes, not rows, so the table remains a
 * permanent, queryable record of what was handed off, to whom, and whether it was used.
 * Modelled on the other secret-guarded cron endpoints (cleanup-guests.ts, cleanup-uploads.ts):
 * the standalone cron Worker (workers/cron) drives it on a schedule via X-Cron-Secret.
 */
import { JSON_HEADERS } from '../_shared/api-utils'

interface Env {
  DB: D1Database
  CRON_SECRET?: string
}

function secretsMatch(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let index = 0; index < a.length; index += 1) diff |= a.charCodeAt(index) ^ b.charCodeAt(index)
  return diff === 0
}

function authorize(request: Request, env: Env): Response | null {
  if (!env.CRON_SECRET) {
    return new Response(JSON.stringify({ error: 'CRON_SECRET not configured' }), { status: 503, headers: JSON_HEADERS })
  }
  if (!secretsMatch(request.headers.get('X-Cron-Secret') || '', env.CRON_SECRET)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: JSON_HEADERS })
  }
  return null
}

const EXPIRED_UNSWEPT = `SELECT COUNT(*) AS n FROM timeline_handoffs WHERE payload IS NOT NULL AND expires_at <= unixepoch()`

async function cleanup(env: Env, dryRun: boolean): Promise<Response> {
  const before = await env.DB.prepare(EXPIRED_UNSWEPT).first<{ n: number }>()
  const expired = Number(before?.n || 0)
  if (dryRun || expired === 0) {
    return new Response(JSON.stringify({ success: true, dry_run: dryRun, expired_unswept: expired }), { status: 200, headers: JSON_HEADERS })
  }
  // Never touches redeemed_at/revoked_at/token/payload_hash — the redeem and revoke
  // batches already own those transitions. Only payload moves, and only to NULL, which
  // the update guard trigger permits from any prior state.
  const result = await env.DB.prepare(`UPDATE timeline_handoffs SET payload=NULL WHERE payload IS NOT NULL AND expires_at <= unixepoch()`).run()
  return new Response(JSON.stringify({
    success: true,
    expired_unswept: expired,
    rows_swept: Number(result.meta?.changes || 0),
  }), { status: 200, headers: JSON_HEADERS })
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const denied = authorize(request, env)
  if (denied) return denied
  try {
    return await cleanup(env, true)
  } catch (error) {
    console.error('[HandoffCleanup] Dry run failed:', error)
    return new Response(JSON.stringify({ error: 'Handoff cleanup count failed' }), { status: 500, headers: JSON_HEADERS })
  }
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const denied = authorize(request, env)
  if (denied) return denied
  try {
    const dryRun = new URL(request.url).searchParams.get('dry') === '1'
    return await cleanup(env, dryRun)
  } catch (error) {
    console.error('[HandoffCleanup] Cleanup failed:', error)
    return new Response(JSON.stringify({ error: 'Handoff cleanup failed' }), { status: 500, headers: JSON_HEADERS })
  }
}
