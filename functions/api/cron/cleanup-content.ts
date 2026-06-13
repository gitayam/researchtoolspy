/**
 * Global Content-Intelligence Cleanup (cron-driven, cascade-safe)
 *
 * Deletes EXPIRED, UNSAVED content_analysis rows across ALL users to bound D1 growth.
 * Unlike the user-scoped /api/content-intelligence/cleanup, this is infra→infra:
 * it is guarded by a shared secret (X-Cron-Secret === env.CRON_SECRET), NOT a session.
 *
 * CASCADE SAFETY: content_analysis is the parent of several ON DELETE CASCADE children.
 * Some of those represent real user work that must NOT be silently destroyed, so this
 * query refuses to delete a row that is still referenced by:
 *   - saved_links            (a saved/bookmarked link points at it)
 *   - content_qa             (user Q&A on the analysis)
 *   - starbursting_sources   (used as a framework source)
 *   - claim_adjustments      (user-edited claims)
 * Derived/regenerable children (content_entities, content_framework_suggestions, etc.)
 * are allowed to cascade away with the parent.
 *
 * Deletions are batched to stay within Worker CPU limits.
 *
 * Usage:
 *   POST /api/cron/cleanup-content              -> delete up to (BATCH_SIZE * MAX_BATCHES) rows
 *   POST /api/cron/cleanup-content?dry=1        -> report deletable count, delete nothing
 *   (both require header  X-Cron-Secret: <CRON_SECRET>)
 */

import { JSON_HEADERS } from '../_shared/api-utils'

interface Env {
  DB: D1Database
  CRON_SECRET?: string
}

const BATCH_SIZE = 500   // ids deleted per statement
const MAX_BATCHES = 20   // hard cap per invocation (≤10k rows/run) to bound CPU

// Constant-time-ish secret comparison (avoids trivial timing leaks on the shared secret)
function secretsMatch(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

// Predicate shared by the dry-run count, the id-selection, and the delete.
// Keep these three in sync — drift here is exactly the UPSERT-style bug that leaves stale data.
const DELETABLE_WHERE = `
  ca.expires_at IS NOT NULL
  AND ca.expires_at < datetime('now')
  AND (ca.is_saved = 0 OR ca.is_saved IS NULL)
  AND NOT EXISTS (SELECT 1 FROM saved_links sl        WHERE sl.analysis_id = ca.id)
  AND NOT EXISTS (SELECT 1 FROM content_qa q          WHERE q.content_analysis_id = ca.id)
  AND NOT EXISTS (SELECT 1 FROM starbursting_sources s WHERE s.content_analysis_id = ca.id)
  AND NOT EXISTS (SELECT 1 FROM claim_adjustments cadj WHERE cadj.content_analysis_id = ca.id)
`

function authorize(context: { request: Request; env: Env }): Response | null {
  const configured = context.env.CRON_SECRET
  if (!configured) {
    // Fail safe: never allow an unauthenticated global delete if the secret isn't set.
    return new Response(JSON.stringify({ error: 'CRON_SECRET not configured' }), {
      status: 503, headers: JSON_HEADERS,
    })
  }
  const provided = context.request.headers.get('X-Cron-Secret') || ''
  if (!secretsMatch(provided, configured)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: JSON_HEADERS,
    })
  }
  return null
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const denied = authorize(context)
  if (denied) return denied

  const dryRun = new URL(context.request.url).searchParams.get('dry') === '1'

  try {
    if (dryRun) {
      const row = await context.env.DB.prepare(
        `SELECT COUNT(*) AS n FROM content_analysis ca WHERE ${DELETABLE_WHERE}`
      ).first<{ n: number }>()
      return new Response(JSON.stringify({
        success: true, dry_run: true, deletable_count: row?.n || 0,
      }), { status: 200, headers: JSON_HEADERS })
    }

    let totalDeleted = 0
    let batches = 0
    for (; batches < MAX_BATCHES; batches++) {
      const result = await context.env.DB.prepare(`
        DELETE FROM content_analysis
        WHERE id IN (
          SELECT ca.id FROM content_analysis ca
          WHERE ${DELETABLE_WHERE}
          LIMIT ${BATCH_SIZE}
        )
      `).run()
      const changes = result.meta.changes || 0
      totalDeleted += changes
      if (changes < BATCH_SIZE) break // drained
    }

    // Report whether rows remain (so the cron operator knows if a second run is needed)
    const remainingRow = await context.env.DB.prepare(
      `SELECT COUNT(*) AS n FROM content_analysis ca WHERE ${DELETABLE_WHERE}`
    ).first<{ n: number }>()

    return new Response(JSON.stringify({
      success: true,
      deleted_count: totalDeleted,
      batches_run: batches + 1,
      remaining_deletable: remainingRow?.n || 0,
    }), { status: 200, headers: JSON_HEADERS })

  } catch (error) {
    console.error('[CronCleanup] Error:', error)
    return new Response(JSON.stringify({ error: 'Cleanup failed' }), {
      status: 500, headers: JSON_HEADERS,
    })
  }
}

// GET = secret-guarded dry-run count (no mutation), convenient for monitoring.
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const denied = authorize(context)
  if (denied) return denied
  try {
    const row = await context.env.DB.prepare(
      `SELECT COUNT(*) AS n FROM content_analysis ca WHERE ${DELETABLE_WHERE}`
    ).first<{ n: number }>()
    return new Response(JSON.stringify({ deletable_count: row?.n || 0 }), {
      status: 200, headers: JSON_HEADERS,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to count' }), {
      status: 500, headers: JSON_HEADERS,
    })
  }
}
