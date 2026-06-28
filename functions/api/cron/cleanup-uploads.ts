/**
 * 90-day retention sweep for uploaded files (E-6d, cron-driven, secret-guarded).
 *
 * E-6a/b/c stream survey uploads into the R2 UPLOADS bucket under keys prefixed
 * `uploads/<surveyId>/...`. Per the E-6 decision these must be pruned after 90 days
 * to bound storage growth. Like cleanup-content, this is infra→infra work: it is
 * guarded by a shared secret (X-Cron-Secret === env.CRON_SECRET), NOT a session, and
 * the standalone cron Worker (workers/cron) drives it on a daily schedule because it
 * has the R2 binding.
 *
 * Usage:
 *   POST /api/cron/cleanup-uploads   -> delete every object older than 90 days
 *   GET  /api/cron/cleanup-uploads   -> dry-run: report deletable count, delete nothing
 *   (both require header  X-Cron-Secret: <CRON_SECRET>)
 */

import { JSON_HEADERS } from '../_shared/api-utils'

interface Env {
  UPLOADS?: R2Bucket
  CRON_SECRET?: string
}

const MAX_AGE_DAYS = 90        // retention window
const LIST_LIMIT = 1000        // objects per R2 list page
const MAX_PAGES = 50           // defensive cap: ≤50k objects scanned per run
const DELETE_CHUNK = 1000      // keys per R2 delete call (R2 caps batch delete at 1000)
const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * Pure, zero-dependency predicate (exported for unit tests).
 *
 * Returns true when `uploaded` is strictly older than `maxAgeDays` before `now`
 * (ms epoch). Defensive on bad input: an unparseable / missing date returns false
 * so we never delete an object we cannot reliably date.
 *
 * Boundary: uses `>` — an object whose age is *exactly* maxAgeDays is NOT yet
 * expired; it must be strictly older than the window.
 */
export function isExpiredUpload(
  uploaded: Date | string | number,
  now: number,
  maxAgeDays = MAX_AGE_DAYS,
): boolean {
  if (uploaded == null) return false
  let ts: number
  if (uploaded instanceof Date) {
    ts = uploaded.getTime()
  } else if (typeof uploaded === 'number') {
    ts = uploaded
  } else if (typeof uploaded === 'string') {
    const trimmed = uploaded.trim()
    if (trimmed === '') return false
    ts = new Date(trimmed).getTime()
  } else {
    return false
  }
  if (!Number.isFinite(ts)) return false
  if (!Number.isFinite(now)) return false
  return now - ts > maxAgeDays * MS_PER_DAY
}

// Constant-time-ish secret comparison (mirrors cleanup-content — avoids trivial
// timing leaks on the shared secret).
function secretsMatch(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

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

/**
 * Paginate the `uploads/` prefix, collecting keys of expired objects.
 * Returns the expired keys plus how many objects were scanned and whether the
 * MAX_PAGES cap was hit (so a partial sweep is observable).
 */
async function scanExpired(
  bucket: R2Bucket,
  now: number,
): Promise<{ expiredKeys: string[]; scanned: number; capped: boolean }> {
  const expiredKeys: string[] = []
  let scanned = 0
  let cursor: string | undefined
  let pages = 0
  let capped = false

  for (; pages < MAX_PAGES; pages++) {
    const listed = await bucket.list({ prefix: 'uploads/', cursor, limit: LIST_LIMIT })
    for (const obj of listed.objects) {
      scanned++
      if (isExpiredUpload(obj.uploaded, now)) expiredKeys.push(obj.key)
    }
    if (!listed.truncated) {
      cursor = undefined
      break
    }
    cursor = listed.cursor
  }
  if (cursor !== undefined) capped = true // still truncated after MAX_PAGES

  return { expiredKeys, scanned, capped }
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const denied = authorize(context)
  if (denied) return denied

  if (!context.env.UPLOADS) {
    return new Response(JSON.stringify({ error: 'UPLOADS not configured' }), {
      status: 503, headers: JSON_HEADERS,
    })
  }

  try {
    const now = Date.now()
    const { expiredKeys, scanned, capped } = await scanExpired(context.env.UPLOADS, now)

    if (capped) {
      console.warn(
        `[CleanupUploads] scan hit MAX_PAGES=${MAX_PAGES} cap (scanned=${scanned}); ` +
        `more objects may remain — next run will continue`,
      )
    }

    let deleted = 0
    for (let i = 0; i < expiredKeys.length; i += DELETE_CHUNK) {
      const chunk = expiredKeys.slice(i, i + DELETE_CHUNK)
      await context.env.UPLOADS.delete(chunk)
      deleted += chunk.length
    }

    return new Response(JSON.stringify({
      ok: true,
      scanned,
      deleted,
      capped,
    }), { status: 200, headers: JSON_HEADERS })
  } catch (error) {
    console.error('[CleanupUploads] Error:', error)
    return new Response(JSON.stringify({ error: 'Cleanup failed' }), {
      status: 500, headers: JSON_HEADERS,
    })
  }
}

// GET = secret-guarded dry-run count (no deletion), convenient for monitoring.
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const denied = authorize(context)
  if (denied) return denied

  if (!context.env.UPLOADS) {
    return new Response(JSON.stringify({ error: 'UPLOADS not configured' }), {
      status: 503, headers: JSON_HEADERS,
    })
  }

  try {
    const now = Date.now()
    const { expiredKeys, scanned, capped } = await scanExpired(context.env.UPLOADS, now)
    return new Response(JSON.stringify({
      deletable_count: expiredKeys.length,
      scanned,
      capped,
    }), { status: 200, headers: JSON_HEADERS })
  } catch (error) {
    console.error('[CleanupUploads] Error:', error)
    return new Response(JSON.stringify({ error: 'Failed to count' }), {
      status: 500, headers: JSON_HEADERS,
    })
  }
}
