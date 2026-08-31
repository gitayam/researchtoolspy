/**
 * COP Scraper API — Trigger Apify actors and ingest results as evidence
 *
 * POST /api/cop/:id/scrape — Run a scraper (telegram, twitter) and ingest results
 * GET  /api/cop/:id/scrape?run_id=xxx — Check run status / fetch results
 */
import type { PagesFunction } from '@cloudflare/workers-types'
import { getUserFromRequest } from '../../_shared/auth-helpers'
import { JSON_HEADERS } from '../../_shared/api-utils'
import { logEvent } from '../../_shared/event-log'
import { buildUpstreamFailureLog } from './_upstream-failure-log'
import {
  buildScrapeItemIdentity,
  buildScrapeRequestFingerprint,
  buildScrapeRequestId,
  canonicalizeScrapeRequestUrl,
} from './_scrape-idempotency'

interface Env {
  DB: D1Database
  APIFY_API_KEY?: string
  SESSIONS?: KVNamespace
  JWT_SECRET?: string
}


const APIFY_BASE = 'https://api.apify.com/v2'

// Actor IDs for supported scrapers
const ACTORS: Record<string, string> = {
  twitter: 'apidojo~tweet-scraper',
  tiktok: 'clockworks~tiktok-scraper',
}

const EVIDENCE_STATEMENTS_PER_ITEM = 3
// Reserve five statements for auth, run lookup/update, and request bookkeeping so
// the entire invocation remains within a conservative 50-statement D1 budget.
const MAX_EVIDENCE_BATCH = Math.floor((50 - 5) / EVIDENCE_STATEMENTS_PER_ITEM)

async function getCopScrapeWorkspace(
  db: D1Database,
  sessionId: string,
  userId: number,
): Promise<string | null> {
  const session = await db.prepare(
    'SELECT workspace_id, created_by FROM cop_sessions WHERE id = ?'
  ).bind(sessionId).first<{ workspace_id: string; created_by: number }>()
  if (!session) return null
  if (String(session.created_by) === String(userId)) return session.workspace_id

  const collaborator = await db.prepare(`
    SELECT role
    FROM cop_collaborators
    WHERE cop_session_id = ?
      AND user_id = ?
      AND accepted_at IS NOT NULL
      AND lower(role) IN ('editor', 'admin')
  `).bind(sessionId, userId).first<{ role: string }>()
  return collaborator ? session.workspace_id : null
}

// POST — Start a scrape run
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const sessionId = params.id as string
  let activeReservationId: string | null = null
  let upstreamAccepted = false

  try {
    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: JSON_HEADERS,
      })
    }
    const workspaceId = await getCopScrapeWorkspace(env.DB, sessionId, userId)
    if (!workspaceId) {
      return new Response(JSON.stringify({ error: 'Access denied' }), { status: 403, headers: JSON_HEADERS })
    }

    const apiKey = env.APIFY_API_KEY
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'APIFY_API_KEY not configured' }), {
        status: 503, headers: JSON_HEADERS,
      })
    }

    const body = await request.json() as any
    const scraperType = body.type as string // 'twitter' | 'tiktok'
    const actorId = ACTORS[scraperType]

    if (!actorId) {
      return new Response(JSON.stringify({
        error: `Unknown scraper type: ${scraperType}. Supported: ${Object.keys(ACTORS).join(', ')}`,
      }), { status: 400, headers: JSON_HEADERS })
    }

    const query = typeof body.query === 'string' ? body.query.trim().replace(/\s+/g, ' ') : ''
    if (body.urls !== undefined && (
      !Array.isArray(body.urls) || body.urls.some((value: unknown) => typeof value !== 'string')
    )) {
      return new Response(JSON.stringify({ error: 'urls must be an array of strings' }), {
        status: 400, headers: JSON_HEADERS,
      })
    }
    const canonicalUrls = Array.isArray(body.urls)
      ? body.urls.map((value: string) => canonicalizeScrapeRequestUrl(value))
      : []
    if (canonicalUrls.some((value: string | null) => !value)) {
      return new Response(JSON.stringify({ error: 'urls must contain valid HTTP(S) URLs' }), {
        status: 400, headers: JSON_HEADERS,
      })
    }
    const urls = [...new Set(canonicalUrls as string[])].sort()
    const requestedLimit = body.limit === undefined ? null : Number(body.limit)
    if (requestedLimit !== null && (!Number.isFinite(requestedLimit) || requestedLimit <= 0)) {
      return new Response(JSON.stringify({ error: 'limit must be a positive finite number' }), {
        status: 400, headers: JSON_HEADERS,
      })
    }

    const headerKey = request.headers.get('Idempotency-Key')?.trim() || ''
    const bodyKey = typeof body.idempotency_key === 'string' ? body.idempotency_key.trim() : ''
    if (body.idempotency_key !== undefined && typeof body.idempotency_key !== 'string') {
      return new Response(JSON.stringify({ error: 'idempotency_key must be a string' }), {
        status: 400, headers: JSON_HEADERS,
      })
    }
    if (headerKey && bodyKey && headerKey !== bodyKey) {
      return new Response(JSON.stringify({ error: 'Conflicting idempotency keys' }), {
        status: 400, headers: JSON_HEADERS,
      })
    }
    const idempotencyKey = headerKey || bodyKey
    if (idempotencyKey.length > 128) {
      return new Response(JSON.stringify({ error: 'Idempotency key is too long' }), {
        status: 400, headers: JSON_HEADERS,
      })
    }

    // Build a canonical actor input so equivalent URL ordering/whitespace retries
    // share a reservation. An explicit key opts into an intentional new run.
    let actorInput: Record<string, any> = {}

    if (scraperType === 'twitter') {
      // Tweet scraper input
      if (!query && urls.length === 0) {
        return new Response(JSON.stringify({ error: 'query or urls required for twitter scraper' }), {
          status: 400, headers: JSON_HEADERS,
        })
      }
      actorInput = {
        ...(query ? { searchTerms: [query] } : {}),
        ...(urls.length ? { startUrls: urls.map((url: string) => ({ url })) } : {}),
        maxItems: Math.min(Math.floor(requestedLimit ?? 50), 200),
        sort: typeof body.sort === 'string' && body.sort.trim() ? body.sort.trim() : 'Latest',
      }
    } else if (scraperType === 'tiktok') {
      // TikTok scraper input
      if (!query && urls.length === 0) {
        return new Response(JSON.stringify({ error: 'query or urls required for tiktok scraper' }), {
          status: 400, headers: JSON_HEADERS,
        })
      }
      actorInput = {
        ...(query ? { searchQueries: [query] } : {}),
        ...(urls.length ? { postURLs: urls } : {}),
        resultsPerPage: Math.min(Math.floor(requestedLimit ?? 20), 100),
        shouldDownloadVideos: false,
        shouldDownloadCovers: false,
      }
    }

    const requestFingerprint = await buildScrapeRequestFingerprint(scraperType, actorInput)
    const requestId = await buildScrapeRequestId(
      sessionId, workspaceId, userId, requestFingerprint, idempotencyKey,
    )
    const reservation = await env.DB.prepare(`
      INSERT OR IGNORE INTO cop_scrape_requests (
        request_id, cop_session_id, workspace_id, requested_by,
        request_fingerprint, idempotency_key, state, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'initiating', datetime('now'), datetime('now'))
    `).bind(
      requestId, sessionId, workspaceId, userId, requestFingerprint, idempotencyKey,
    ).run()

    if (Number(reservation.meta?.changes || 0) === 0) {
      const existing = await env.DB.prepare(`
        SELECT request.state, request.run_id, request.last_error, run.status
        FROM cop_scrape_requests request
        LEFT JOIN cop_scrape_runs run ON run.run_id = request.run_id
        WHERE request.request_id = ?
          AND request.cop_session_id = ?
          AND request.workspace_id = ?
          AND request.requested_by = ?
      `).bind(requestId, sessionId, workspaceId, userId).first<{
        state: 'initiating' | 'started' | 'failed'
        run_id: string | null
        last_error: string | null
        status: string | null
      }>()

      if (!existing) {
        return new Response(JSON.stringify({ error: 'Scrape reservation unavailable' }), {
          status: 409, headers: JSON_HEADERS,
        })
      }
      if (existing.state === 'started' && existing.run_id) {
        const completed = existing.status === 'SUCCEEDED'
        return new Response(JSON.stringify({
          request_id: requestId,
          run_id: existing.run_id,
          status: completed ? 'completed' : (existing.status || 'started').toLowerCase(),
          deduplicated: true,
        }), { status: completed ? 200 : 202, headers: JSON_HEADERS })
      }
      if (existing.state === 'failed') {
        return new Response(JSON.stringify({
          request_id: requestId,
          status: 'failed',
          error: existing.last_error || 'Previous start attempt failed',
          message: 'Use a new Idempotency-Key only if an intentional rerun is safe.',
          deduplicated: true,
        }), { status: 409, headers: JSON_HEADERS })
      }
      return new Response(JSON.stringify({
        request_id: requestId,
        status: 'initiating',
        message: 'A matching paid scrape request is already being initiated.',
        deduplicated: true,
      }), { status: 202, headers: JSON_HEADERS })
    }
    activeReservationId = requestId

    // Start the actor run (synchronous for small runs, async for large)
    const isSync = (actorInput.resultsPerPage || actorInput.maxItems || 50) <= 50
    const runUrl = `${APIFY_BASE}/acts/${actorId}/runs${isSync ? '?waitForFinish=120' : ''}`

    const runRes = await fetch(runUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(actorInput),
    })

    if (!runRes.ok) {
      const errText = await runRes.text()
      // Parse Apify error for better messaging and structured logging
      let apifyError = `Apify returned ${runRes.status}`
      try {
        const parsed = JSON.parse(errText)
        if (parsed.error?.message) apifyError = parsed.error.message
        if (parsed.error?.type === 'actor-is-not-rented') {
          apifyError = `Actor not rented. Rent it at: https://console.apify.com/actors — search for "${scraperType}" scraper`
        }
      } catch { /* use default */ }
      await markScrapeRequestFailed(env.DB, requestId, apifyError)
      await logEvent(env, buildUpstreamFailureLog('cop/scrape/run-start', {
        status: runRes.status,
        error: apifyError,
      })).catch(() => {})
      return new Response(JSON.stringify({
        error: 'Failed to start scraper',
        detail: runRes.status === 402 ? 'Apify account limit reached or actor not rented'
          : `Scraper service returned ${runRes.status}`,
      }), { status: 502, headers: JSON_HEADERS })
    }
    upstreamAccepted = true

    const runData = await runRes.json() as any
    const run = runData.data
    if (!run || typeof run.id !== 'string' || typeof run.status !== 'string') {
      // The provider accepted the paid request, so retain `initiating`. Retrying
      // automatically could create a duplicate chargeable run.
      return new Response(JSON.stringify({
        request_id: requestId,
        error: 'Scraper accepted the request but returned an invalid run identity',
      }), { status: 502, headers: JSON_HEADERS })
    }
    const runId = run.id
    const runStatus = run.status // READY, RUNNING, SUCCEEDED, FAILED, etc.

    // Persist run ownership from authenticated context. A later GET must resolve
    // this exact tuple before the caller-supplied run_id is sent to Apify.
    await env.DB.batch([
      env.DB.prepare(`
        INSERT INTO cop_scrape_runs (
        run_id, cop_session_id, workspace_id, requested_by, scraper_type,
        actor_id, dataset_id, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).bind(
        runId, sessionId, workspaceId, userId, scraperType, actorId,
        run.defaultDatasetId || null, runStatus,
      ),
      env.DB.prepare(`
        UPDATE cop_scrape_requests
        SET state = 'started', run_id = ?, updated_at = datetime('now')
        WHERE request_id = ? AND state = 'initiating'
      `).bind(runId, requestId),
    ])

    // If sync run completed, fetch results and ingest immediately
    if (runStatus === 'SUCCEEDED') {
      const datasetId = run.defaultDatasetId
      const items = await fetchDatasetItems(env, apiKey, datasetId, MAX_EVIDENCE_BATCH)
      const evidence = transformToEvidence(items, scraperType)
      const inserted = await batchInsertEvidence(env.DB, sessionId, workspaceId, userId, runId, scraperType, evidence)

      return new Response(JSON.stringify({
        request_id: requestId,
        run_id: runId,
        status: 'completed',
        items_found: items.length,
        evidence_created: inserted,
        message: `Scraped ${items.length} items, created ${inserted} evidence entries`,
      }), { headers: JSON_HEADERS })
    }

    // Async run — return run ID for polling
    return new Response(JSON.stringify({
      request_id: requestId,
      run_id: runId,
      status: runStatus.toLowerCase(),
      message: `Scraper started. Poll GET /api/cop/${sessionId}/scrape?run_id=${runId} for results.`,
    }), { status: 202, headers: JSON_HEADERS })

  } catch (error) {
    if (activeReservationId && !upstreamAccepted) {
      await markScrapeRequestFailed(env.DB, activeReservationId, 'Provider start request failed').catch(() => {})
    }
    await logEvent(env, buildUpstreamFailureLog('cop/scrape/run-start', { error })).catch(() => {})
    return new Response(JSON.stringify({ error: 'Scrape failed' }), {
      status: 500, headers: JSON_HEADERS,
    })
  }
}

// GET — Check run status and optionally ingest results
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const sessionId = params.id as string
  const url = new URL(request.url)
  const runId = url.searchParams.get('run_id')

  if (!runId) {
    return new Response(JSON.stringify({ error: 'run_id query param required' }), {
      status: 400, headers: JSON_HEADERS,
    })
  }

  try {
    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: JSON_HEADERS,
      })
    }
    const workspaceId = await getCopScrapeWorkspace(env.DB, sessionId, userId)
    if (!workspaceId) {
      return new Response(JSON.stringify({ error: 'Access denied' }), { status: 403, headers: JSON_HEADERS })
    }

    const apiKey = env.APIFY_API_KEY
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'APIFY_API_KEY not configured' }), {
        status: 503, headers: JSON_HEADERS,
      })
    }

    const registeredRun = await env.DB.prepare(`
      SELECT scraper_type, dataset_id
      FROM cop_scrape_runs
      WHERE run_id = ? AND cop_session_id = ? AND workspace_id = ? AND requested_by = ?
    `).bind(runId, sessionId, workspaceId, userId).first<{
      scraper_type: string
      dataset_id: string | null
    }>()

    if (!registeredRun) {
      return new Response(JSON.stringify({ error: 'Scrape run not found' }), {
        status: 404, headers: JSON_HEADERS,
      })
    }

    // Check run status (10s timeout to prevent worker hang)
    const statusController = new AbortController()
    const statusTimeout = setTimeout(() => statusController.abort(), 10000)
    const statusRes = await fetch(`${APIFY_BASE}/actor-runs/${runId}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
      signal: statusController.signal,
    })
    clearTimeout(statusTimeout)

    if (!statusRes.ok) {
      return new Response(JSON.stringify({ error: 'Failed to check run status' }), {
        status: 502, headers: JSON_HEADERS,
      })
    }

    const statusData = await statusRes.json() as any
    const run = statusData.data
    const runStatus = run.status

    await env.DB.prepare(`
      UPDATE cop_scrape_runs
      SET status = ?, dataset_id = COALESCE(?, dataset_id), updated_at = datetime('now')
      WHERE run_id = ? AND cop_session_id = ? AND requested_by = ?
    `).bind(runStatus, run.defaultDatasetId || null, runId, sessionId, userId).run()

    if (runStatus === 'SUCCEEDED') {
      const ingest = url.searchParams.get('ingest') !== 'false'
      const datasetId = run.defaultDatasetId || registeredRun.dataset_id
      if (!datasetId) {
        return new Response(JSON.stringify({ error: 'Scrape run has no result dataset' }), {
          status: 502, headers: JSON_HEADERS,
        })
      }
      const items = await fetchDatasetItems(env, apiKey, datasetId, MAX_EVIDENCE_BATCH)

      if (ingest && items.length > 0) {
        const scraperType = registeredRun.scraper_type
        const evidence = transformToEvidence(items, scraperType)
        const inserted = await batchInsertEvidence(env.DB, sessionId, workspaceId, userId, runId, scraperType, evidence)

        return new Response(JSON.stringify({
          run_id: runId,
          status: 'completed',
          items_found: items.length,
          evidence_created: inserted,
        }), { headers: JSON_HEADERS })
      }

      return new Response(JSON.stringify({
        run_id: runId,
        status: 'completed',
        items_found: items.length,
        items: items.slice(0, 10), // Preview first 10
      }), { headers: JSON_HEADERS })
    }

    return new Response(JSON.stringify({
      run_id: runId,
      status: runStatus.toLowerCase(),
      started_at: run.startedAt,
    }), { headers: JSON_HEADERS })

  } catch (error) {
    await logEvent(env, buildUpstreamFailureLog('cop/scrape/status-check', { error })).catch(() => {})
    return new Response(JSON.stringify({ error: 'Status check failed' }), {
      status: 500, headers: JSON_HEADERS,
    })
  }
}

// ── Helpers ────────────────────────────────────────────────────

async function markScrapeRequestFailed(
  db: D1Database,
  requestId: string,
  error: string,
): Promise<void> {
  await db.prepare(`
    UPDATE cop_scrape_requests
    SET state = 'failed', last_error = ?, updated_at = datetime('now')
    WHERE request_id = ? AND state = 'initiating'
  `).bind(error.slice(0, 1000), requestId).run()
}

/**
 * Fetch dataset items from Apify. Returns [] on any failure so callers degrade to
 * "no items" rather than crashing the request.
 *
 * On a degraded upstream (non-OK status or fetch throw) we also emit a low-volume
 * `warn` to event_logs — console.* is invisible in Pages Functions, so a failed Apify
 * fetch would otherwise be silent. `env` is threaded in for the D1 binding logEvent
 * needs; logEvent never throws.
 */
async function fetchDatasetItems(env: Env, apiKey: string, datasetId: string, limit: number): Promise<any[]> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)
  try {
    const res = await fetch(
      `${APIFY_BASE}/datasets/${datasetId}/items?limit=${limit}&format=json`,
      { headers: { 'Authorization': `Bearer ${apiKey}` }, signal: controller.signal }
    )
    clearTimeout(timeout)
    if (!res.ok) {
      await logEvent(env, buildUpstreamFailureLog('cop/scrape', { status: res.status })).catch(() => {})
      return []
    }
    const items = await res.json() as unknown
    return Array.isArray(items) ? items.slice(0, Math.max(0, limit)) : []
  } catch (error) {
    clearTimeout(timeout)
    await logEvent(env, buildUpstreamFailureLog('cop/scrape', { error })).catch(() => {})
    return []
  }
}

function transformToEvidence(
  items: any[],
  scraperType: string,
): Array<{ title: string; content: string; url: string; source_type: string; credibility: string; providerItemId: string | null }> {
  return items.map((item) => {
    if (scraperType === 'tiktok') {
      const author = item.authorMeta?.name || item.author || 'Unknown'
      const nickname = item.authorMeta?.nickName || author
      const text = item.text || item.desc || ''
      const engagement = item.playCount ? ` [${(item.playCount/1000).toFixed(0)}k views]` : ''
      const providerItemId = typeof item.id === 'string'
        ? item.id
        : typeof item.videoId === 'string'
          ? item.videoId
          : null
      return {
        title: `[TikTok] @${author}: ${text.substring(0, 70)}${text.length > 70 ? '...' : ''}${engagement}`,
        content: `${text}\n\nAuthor: ${nickname} (@${author})${item.authorMeta?.verified ? ' ✓' : ''}\nViews: ${item.playCount || 0} | Likes: ${item.diggCount || 0} | Shares: ${item.shareCount || 0}`,
        url: typeof item.webVideoUrl === 'string'
          ? item.webVideoUrl
          : typeof item.url === 'string'
            ? item.url
            : providerItemId
              ? `https://www.tiktok.com/@${author}/video/${providerItemId}`
              : '',
        source_type: 'signal',
        credibility: 'unverified',
        providerItemId,
      }
    }

    if (scraperType === 'twitter') {
      const author = item.author?.name || item.user?.name || item.username || 'Unknown'
      const text = item.text || item.full_text || item.tweetText || ''
      return {
        title: `[Twitter/X] @${item.author?.userName || item.username || author}: ${text.substring(0, 80)}${text.length > 80 ? '...' : ''}`,
        content: text,
        url: item.url || item.tweetUrl || '',
        source_type: 'signal',
        credibility: 'unverified',
        providerItemId: typeof item.id === 'string'
          ? item.id
          : typeof item.id_str === 'string'
            ? item.id_str
            : typeof item.tweetId === 'string'
              ? item.tweetId
              : null,
      }
    }

    // Generic fallback
    return {
      title: item.title || item.text?.substring(0, 100) || 'Scraped item',
      content: item.text || item.content || JSON.stringify(item).substring(0, 2000),
      url: item.url || '',
      source_type: 'document',
      credibility: 'unverified',
      providerItemId: typeof item.id === 'string' ? item.id : null,
    }
  })
}

async function batchInsertEvidence(
  db: D1Database,
  sessionId: string,
  workspaceId: string,
  userId: number,
  runId: string,
  scraperType: string,
  items: Array<{ title: string; content: string; url: string; source_type: string; credibility: string; providerItemId: string | null }>
): Promise<number> {
  if (items.length === 0) return 0
  if (items.length > MAX_EVIDENCE_BATCH) {
    throw new Error(`Evidence batch exceeds ${MAX_EVIDENCE_BATCH} items`)
  }
  const now = new Date().toISOString()

  const keyedItems = await Promise.all(items.map(async (item) => ({
    item,
    identity: await buildScrapeItemIdentity(scraperType, item),
  })))

  const stmts = keyedItems.flatMap(({ item, identity }) => {
    const importId = `${sessionId}:${workspaceId}:${identity.itemKey}`
    const metadata = JSON.stringify({
      scrape_provider: 'apify',
      scrape_run_id: runId,
      scraper_type: scraperType,
      cop_session_id: sessionId,
      provider_item_id: identity.providerItemId,
    })
    return [
      db.prepare(`
        INSERT OR IGNORE INTO cop_scrape_imports (
          id, cop_session_id, workspace_id, provider, item_key, provider_item_id,
          canonical_url, run_id, imported_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        importId, sessionId, workspaceId, scraperType, identity.itemKey,
        identity.providerItemId, identity.canonicalUrl, runId, userId, now,
      ),
      db.prepare(`
        INSERT INTO evidence_items (title, description, source_url, evidence_type, credibility, reliability, confidence_level,
          workspace_id, created_by, status, metadata, created_at, updated_at)
        SELECT ?, ?, ?, ?, ?, 'unknown', 'medium', ?, ?, 'completed', ?, ?, ?
        WHERE EXISTS (
          SELECT 1 FROM cop_scrape_imports WHERE id = ? AND evidence_item_id IS NULL
        )
      `).bind(
        item.title.substring(0, 500),
        item.content.substring(0, 5000),
        (identity.canonicalUrl || item.url).substring(0, 2000),
        item.source_type,
        item.credibility,
        workspaceId,
        userId,
        metadata,
        now,
        now,
        importId,
      ),
      db.prepare(`
        UPDATE cop_scrape_imports
        SET evidence_item_id = last_insert_rowid()
        WHERE id = ? AND evidence_item_id IS NULL
      `).bind(importId),
    ]
  })

  const results = await db.batch(stmts)
  return results.reduce(
    (count, result, index) => count + (index % 3 === 1 ? Number(result.meta?.changes || 0) : 0),
    0,
  )
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: JSON_HEADERS })
}
