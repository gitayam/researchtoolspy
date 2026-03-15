/**
 * COP Scraper API — Trigger Apify actors and ingest results as evidence
 *
 * POST /api/cop/:id/scrape — Run a scraper (telegram, twitter) and ingest results
 * GET  /api/cop/:id/scrape?run_id=xxx — Check run status / fetch results
 */
import type { PagesFunction } from '@cloudflare/workers-types'
import { getUserFromRequest, verifyCopSessionAccess } from '../../_shared/auth-helpers'

interface Env {
  DB: D1Database
  APIFY_API_KEY?: string
  SESSIONS?: KVNamespace
  JWT_SECRET?: string
}

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash, X-Workspace-ID',
}

const APIFY_BASE = 'https://api.apify.com/v2'

// Actor IDs for supported scrapers
const ACTORS: Record<string, string> = {
  twitter: 'apidojo~tweet-scraper',
  tiktok: 'clockworks~tiktok-scraper',
}

const MAX_EVIDENCE_BATCH = 50

async function getSessionWorkspaceId(db: D1Database, sessionId: string): Promise<string | null> {
  const row = await db.prepare(
    'SELECT workspace_id FROM cop_sessions WHERE id = ?'
  ).bind(sessionId).first<{ workspace_id: string }>()
  return row?.workspace_id ?? null
}

// POST — Start a scrape run
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const sessionId = params.id as string

  try {
    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: corsHeaders,
      })
    }
    if (!(await verifyCopSessionAccess(env.DB, sessionId, userId))) {
      return new Response(JSON.stringify({ error: 'Access denied' }), { status: 403, headers: corsHeaders })
    }

    const apiKey = env.APIFY_API_KEY
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'APIFY_API_KEY not configured' }), {
        status: 503, headers: corsHeaders,
      })
    }

    const workspaceId = await getSessionWorkspaceId(env.DB, sessionId)
    if (!workspaceId) {
      return new Response(JSON.stringify({ error: 'COP session not found' }), {
        status: 404, headers: corsHeaders,
      })
    }

    const body = await request.json() as any
    const scraperType = body.type as string // 'twitter' | 'tiktok'
    const actorId = ACTORS[scraperType]

    if (!actorId) {
      return new Response(JSON.stringify({
        error: `Unknown scraper type: ${scraperType}. Supported: ${Object.keys(ACTORS).join(', ')}`,
      }), { status: 400, headers: corsHeaders })
    }

    // Build actor input based on type
    let actorInput: Record<string, any> = {}

    if (scraperType === 'twitter') {
      // Tweet scraper input
      if (!body.query && !body.urls) {
        return new Response(JSON.stringify({ error: 'query or urls required for twitter scraper' }), {
          status: 400, headers: corsHeaders,
        })
      }
      actorInput = {
        ...(body.query ? { searchTerms: [body.query] } : {}),
        ...(body.urls ? { startUrls: body.urls.map((u: string) => ({ url: u })) } : {}),
        maxItems: Math.min(body.limit || 50, 200),
        sort: body.sort || 'Latest',
      }
    } else if (scraperType === 'tiktok') {
      // TikTok scraper input
      if (!body.query && !body.urls) {
        return new Response(JSON.stringify({ error: 'query or urls required for tiktok scraper' }), {
          status: 400, headers: corsHeaders,
        })
      }
      actorInput = {
        ...(body.query ? { searchQueries: [body.query] } : {}),
        ...(body.urls ? { postURLs: body.urls } : {}),
        resultsPerPage: Math.min(body.limit || 20, 100),
        shouldDownloadVideos: false,
        shouldDownloadCovers: false,
      }
    }

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
      console.error('[COP Scrape] Apify run failed:', runRes.status, errText)
      // Parse Apify error for better messaging
      let apifyError = `Apify returned ${runRes.status}`
      try {
        const parsed = JSON.parse(errText)
        if (parsed.error?.message) apifyError = parsed.error.message
        if (parsed.error?.type === 'actor-is-not-rented') {
          apifyError = `Actor not rented. Rent it at: https://console.apify.com/actors — search for "${scraperType}" scraper`
        }
      } catch { /* use default */ }
      return new Response(JSON.stringify({
        error: 'Failed to start scraper',
        detail: apifyError,
      }), { status: 502, headers: corsHeaders })
    }

    const runData = await runRes.json() as any
    const run = runData.data
    const runId = run.id
    const runStatus = run.status // READY, RUNNING, SUCCEEDED, FAILED, etc.

    // If sync run completed, fetch results and ingest immediately
    if (runStatus === 'SUCCEEDED') {
      const datasetId = run.defaultDatasetId
      const items = await fetchDatasetItems(apiKey, datasetId, MAX_EVIDENCE_BATCH)
      const evidence = transformToEvidence(items, scraperType, body)
      const inserted = await batchInsertEvidence(env.DB, sessionId, workspaceId, userId, evidence)

      return new Response(JSON.stringify({
        run_id: runId,
        status: 'completed',
        items_found: items.length,
        evidence_created: inserted,
        message: `Scraped ${items.length} items, created ${inserted} evidence entries`,
      }), { headers: corsHeaders })
    }

    // Async run — return run ID for polling
    return new Response(JSON.stringify({
      run_id: runId,
      status: runStatus.toLowerCase(),
      message: `Scraper started. Poll GET /api/cop/${sessionId}/scrape?run_id=${runId} for results.`,
    }), { status: 202, headers: corsHeaders })

  } catch (error) {
    console.error('[COP Scrape] Error:', error)
    return new Response(JSON.stringify({ error: 'Scrape failed' }), {
      status: 500, headers: corsHeaders,
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
      status: 400, headers: corsHeaders,
    })
  }

  try {
    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: corsHeaders,
      })
    }
    if (!(await verifyCopSessionAccess(env.DB, sessionId, userId))) {
      return new Response(JSON.stringify({ error: 'Access denied' }), { status: 403, headers: corsHeaders })
    }

    const apiKey = env.APIFY_API_KEY
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'APIFY_API_KEY not configured' }), {
        status: 503, headers: corsHeaders,
      })
    }

    const workspaceId = await getSessionWorkspaceId(env.DB, sessionId)
    if (!workspaceId) {
      return new Response(JSON.stringify({ error: 'COP session not found' }), {
        status: 404, headers: corsHeaders,
      })
    }

    // Check run status
    const statusRes = await fetch(`${APIFY_BASE}/actor-runs/${runId}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    })

    if (!statusRes.ok) {
      return new Response(JSON.stringify({ error: 'Failed to check run status' }), {
        status: 502, headers: corsHeaders,
      })
    }

    const statusData = await statusRes.json() as any
    const run = statusData.data
    const runStatus = run.status

    if (runStatus === 'SUCCEEDED') {
      const ingest = url.searchParams.get('ingest') !== 'false'
      const datasetId = run.defaultDatasetId
      const items = await fetchDatasetItems(apiKey, datasetId, MAX_EVIDENCE_BATCH)

      if (ingest && items.length > 0) {
        // Detect scraper type from actor ID
        const scraperType = Object.entries(ACTORS).find(([, id]) => run.actId?.includes(id.split('~')[1]))?.[0] || 'unknown'
        const evidence = transformToEvidence(items, scraperType, {})
        const inserted = await batchInsertEvidence(env.DB, sessionId, workspaceId, userId, evidence)

        return new Response(JSON.stringify({
          run_id: runId,
          status: 'completed',
          items_found: items.length,
          evidence_created: inserted,
        }), { headers: corsHeaders })
      }

      return new Response(JSON.stringify({
        run_id: runId,
        status: 'completed',
        items_found: items.length,
        items: items.slice(0, 10), // Preview first 10
      }), { headers: corsHeaders })
    }

    return new Response(JSON.stringify({
      run_id: runId,
      status: runStatus.toLowerCase(),
      started_at: run.startedAt,
    }), { headers: corsHeaders })

  } catch (error) {
    console.error('[COP Scrape] Status check error:', error)
    return new Response(JSON.stringify({ error: 'Status check failed' }), {
      status: 500, headers: corsHeaders,
    })
  }
}

// ── Helpers ────────────────────────────────────────────────────

async function fetchDatasetItems(apiKey: string, datasetId: string, limit: number): Promise<any[]> {
  const res = await fetch(
    `${APIFY_BASE}/datasets/${datasetId}/items?limit=${limit}&format=json`,
    { headers: { 'Authorization': `Bearer ${apiKey}` } }
  )
  if (!res.ok) return []
  return await res.json() as any[]
}

function transformToEvidence(
  items: any[],
  scraperType: string,
  opts: Record<string, any>
): Array<{ title: string; content: string; url: string; source_type: string; credibility: string }> {
  return items.map((item) => {
    if (scraperType === 'tiktok') {
      const author = item.authorMeta?.name || item.author || 'Unknown'
      const nickname = item.authorMeta?.nickName || author
      const text = item.text || item.desc || ''
      const engagement = item.playCount ? ` [${(item.playCount/1000).toFixed(0)}k views]` : ''
      return {
        title: `[TikTok] @${author}: ${text.substring(0, 70)}${text.length > 70 ? '...' : ''}${engagement}`,
        content: `${text}\n\nAuthor: ${nickname} (@${author})${item.authorMeta?.verified ? ' ✓' : ''}\nViews: ${item.playCount || 0} | Likes: ${item.diggCount || 0} | Shares: ${item.shareCount || 0}`,
        url: item.webVideoUrl || `https://www.tiktok.com/@${author}/video/${item.id}`,
        source_type: 'signal',
        credibility: 'unverified',
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
      }
    }

    // Generic fallback
    return {
      title: item.title || item.text?.substring(0, 100) || 'Scraped item',
      content: item.text || item.content || JSON.stringify(item).substring(0, 2000),
      url: item.url || '',
      source_type: 'document',
      credibility: 'unverified',
    }
  })
}

async function batchInsertEvidence(
  db: D1Database,
  sessionId: string,
  workspaceId: string,
  userId: number,
  items: Array<{ title: string; content: string; url: string; source_type: string; credibility: string }>
): Promise<number> {
  if (items.length === 0) return 0
  const now = new Date().toISOString()

  const stmts = items.map((item) => {
    return db.prepare(`
      INSERT INTO evidence_items (title, description, source_url, evidence_type, credibility, reliability, confidence_level,
        workspace_id, created_by, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'unknown', 'medium', ?, ?, 'completed', ?, ?)
    `).bind(
      item.title.substring(0, 500),
      item.content.substring(0, 5000),
      item.url.substring(0, 2000),
      item.source_type,
      item.credibility,
      workspaceId,
      userId,
      now,
      now
    )
  })

  await db.batch(stmts)
  return items.length
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: corsHeaders })
}
