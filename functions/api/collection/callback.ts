/**
 * Collection Callback API - Receive results from research agent
 *
 * POST /api/collection/callback
 * Receives callback from research agent when collection is complete
 */

import type { PagesFunction } from '@cloudflare/workers-types'
import { JSON_HEADERS, optionsResponse } from '../_shared/api-utils'
import { logEvent } from '../_shared/event-log'

interface Env {
  DB: D1Database
}

export type CallbackAuthResult = 'authenticated' | 'reject' | 'unsigned-allowed'
/** Backward-compatible per-job callback verification.
 *  - stored + incoming match  -> 'authenticated'
 *  - stored + incoming differ  -> 'reject'
 *  - stored present, none sent  -> 'unsigned-allowed' (rollout: agent not echoing yet; caller logs it)
 *  - no stored token (pre-migration job) -> 'unsigned-allowed' */
export function evaluateCallbackAuth(
  storedSecret: string | null | undefined,
  incomingSecret: string | null | undefined
): CallbackAuthResult {
  if (storedSecret && incomingSecret) return storedSecret === incomingSecret ? 'authenticated' : 'reject'
  return 'unsigned-allowed'
}

// Original format expected by callback
interface AgentCallbackOriginal {
  jobId: string
  status: 'complete' | 'error'
  results?: Array<{
    url: string
    title: string
    snippet: string
    category: string
    source_domain: string
    relevance_score: number
    published_date?: string
    engine: string
  }>
  queries?: Array<{
    category: string
    query: string
    rationale: string
    results_count: number
  }>
  error?: string
  llm_used?: string
}

// Format sent by OSINT Agent container
interface AgentCallbackFromOSINTAgent {
  jobId: string
  status: 'completed' | 'failed' | 'running'
  query: string
  expandedQueries: string[]
  totalResults: number
  results: Array<{
    url: string
    title: string
    snippet: string
    source: string  // maps to engine
    publishedDate?: string | null
    relevanceScore: number  // camelCase
    category: string
  }>
  startedAt: string
  completedAt?: string | null
  error?: string | null
}

type AgentCallback = AgentCallbackOriginal | AgentCallbackFromOSINTAgent

// Helper to safely extract domain from URL
function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    // If URL parsing fails, try to extract domain manually
    const match = url.match(/https?:\/\/([^\/]+)/)
    return match ? match[1].replace(/^www\./, '') : 'unknown'
  }
}

// Helper to normalize the payload
function normalizeCallback(body: AgentCallback): AgentCallbackOriginal {
  // Check if it's the OSINT Agent format (has expandedQueries)
  if ('expandedQueries' in body) {
    const osintPayload = body as AgentCallbackFromOSINTAgent

    const normalizedResults = osintPayload.results?.filter(r => r.url && r.url.startsWith('http')).map(r => ({
      url: r.url,
      title: r.title || 'Untitled',
      snippet: r.snippet || '',
      category: r.category || 'general',
      source_domain: extractDomain(r.url),
      relevance_score: r.relevanceScore ?? 0.5,
      published_date: r.publishedDate || undefined,
      engine: r.source || 'unknown'
    }))


    return {
      jobId: osintPayload.jobId,
      status: osintPayload.status === 'completed' ? 'complete' : 'error',
      results: normalizedResults,
      queries: osintPayload.expandedQueries?.map((q, i) => ({
        category: 'general',
        query: q,
        rationale: i === 0 ? 'Original query' : 'LLM-expanded query',
        results_count: 0
      })),
      error: osintPayload.error || undefined,
      llm_used: 'gpt-5.4-mini'  // From OSINT Agent config
    }
  }
  return body as AgentCallbackOriginal
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    // Read the raw body once; normalizeCallback reuses this parsed object (no double-read).
    const rawBody = await context.request.json() as AgentCallback & { callbackSecret?: string | null }
    const body = normalizeCallback(rawBody)
    const { jobId, status, results, queries, error, llm_used } = body

    if (!jobId) {
      return new Response(JSON.stringify({ error: 'Job ID required' }), {
        status: 400,
        headers: JSON_HEADERS
      })
    }

    // Verify job exists (also fetch status + per-job verification token)
    const job = await context.env.DB.prepare(`
      SELECT id, status, callback_secret FROM collection_jobs WHERE id = ?
    `).bind(jobId).first<{ id: string; status: string; callback_secret: string | null }>()

    if (!job) {
      return new Response(JSON.stringify({ error: 'Job not found' }), {
        status: 404,
        headers: JSON_HEADERS
      })
    }

    // Status guard: a terminal job (complete/error, including Ship-1 timeouts) must not be
    // overwritten by a duplicate or late callback. Only 'running'/'pending' jobs accept results.
    if (job.status !== 'running' && job.status !== 'pending') {
      return new Response(JSON.stringify({ error: 'Job is not awaiting results' }), {
        status: 409,
        headers: JSON_HEADERS
      })
    }

    // Token check (backward-compatible rollout). Incoming token comes from the
    // X-Collection-Secret header (preferred) or a callbackSecret field on the body.
    const incomingSecret = context.request.headers.get('X-Collection-Secret') || rawBody.callbackSecret || null
    const authResult = evaluateCallbackAuth(job.callback_secret, incomingSecret)

    if (authResult === 'reject') {
      return new Response(JSON.stringify({ error: 'Invalid callback token' }), {
        status: 403,
        headers: JSON_HEADERS
      })
    }

    if (authResult === 'unsigned-allowed' && job.callback_secret) {
      // Rollout phase: job has a stored token but the agent did not echo one yet.
      // Accept it (so we don't break the live agent) but record the gap.
      await logEvent(context.env, {
        level: 'warn',
        source: 'collection/callback',
        message: 'unsigned callback accepted (rollout)',
        context: { jobId }
      })
    }

    if (status === 'error') {
      // Update job as failed
      await context.env.DB.prepare(`
        UPDATE collection_jobs
        SET status = 'error', error_message = ?, completed_at = datetime('now')
        WHERE id = ?
      `).bind(error || 'Unknown error', jobId).run()

      return new Response(JSON.stringify({ received: true, status: 'error_recorded' }), {
        headers: JSON_HEADERS
      })
    }

    // Insert results
    if (results && results.length > 0) {
      const insertStmt = context.env.DB.prepare(`
        INSERT INTO collection_results (id, job_id, url, title, snippet, category, source_domain, relevance_score, published_date, engine, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `)

      // Batch insert results
      const batch = results.map(r =>
        insertStmt.bind(
          crypto.randomUUID(),
          jobId,
          r.url,
          r.title || '',
          r.snippet || '',
          r.category || 'general',
          r.source_domain || '',
          r.relevance_score || 50,
          r.published_date || null,
          r.engine || 'unknown'
        )
      )

      await context.env.DB.batch(batch)
    }

    // Insert queries
    if (queries && queries.length > 0) {
      const queryStmt = context.env.DB.prepare(`
        INSERT INTO collection_queries (id, job_id, category, query, rationale, results_count, created_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      `)

      const queryBatch = queries.map(q =>
        queryStmt.bind(
          crypto.randomUUID(),
          jobId,
          q.category,
          q.query,
          q.rationale || '',
          q.results_count || 0
        )
      )

      await context.env.DB.batch(queryBatch)
    }

    // Update job as complete
    await context.env.DB.prepare(`
      UPDATE collection_jobs
      SET status = 'complete', results_count = ?, llm_used = ?, completed_at = datetime('now')
      WHERE id = ?
    `).bind(results?.length || 0, llm_used || 'unknown', jobId).run()

    return new Response(JSON.stringify({
      received: true,
      status: 'complete',
      resultsStored: results?.length || 0,
      queriesStored: queries?.length || 0
    }), {
      headers: JSON_HEADERS
    })

  } catch (error: unknown) {
    console.error('Collection callback error:', error)
    return new Response(JSON.stringify({ error: 'Callback processing failed' }), {
      status: 500,
      headers: JSON_HEADERS
    })
  }
}

// OPTIONS - CORS preflight
// Reject GET requests (POST-only endpoint)
export const onRequestGet: PagesFunction = async () => {
  return new Response(JSON.stringify({ error: 'Method not allowed. Use POST.' }), {
    status: 405, headers: JSON_HEADERS,
  })
}

export const onRequestOptions: PagesFunction = async () => {
  return optionsResponse()
}
