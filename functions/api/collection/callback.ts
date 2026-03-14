/**
 * Collection Callback API - Receive results from research agent
 *
 * POST /api/collection/callback
 * Receives callback from research agent when collection is complete
 */

import type { PagesFunction } from '@cloudflare/workers-types'

interface Env {
  DB: D1Database
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
    console.log(`[Callback] Processing OSINT Agent format with ${osintPayload.results?.length || 0} results`)

    const normalizedResults = osintPayload.results?.filter(r => r.url && r.url.startsWith('http')).map(r => ({
      url: r.url,
      title: r.title || 'Untitled',
      snippet: r.snippet || '',
      category: r.category || 'general',
      source_domain: extractDomain(r.url),
      relevance_score: r.relevanceScore || 0.5,
      published_date: r.publishedDate || undefined,
      engine: r.source || 'unknown'
    }))

    console.log(`[Callback] After filtering: ${normalizedResults?.length || 0} valid results`)

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
      llm_used: 'gpt-4o-mini'  // From OSINT Agent config
    }
  }
  return body as AgentCallbackOriginal
}

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const rawBody = await context.request.json() as AgentCallback
    const body = normalizeCallback(rawBody)
    const { jobId, status, results, queries, error, llm_used } = body

    if (!jobId) {
      return new Response(JSON.stringify({ error: 'Job ID required' }), {
        status: 400,
        headers: corsHeaders
      })
    }

    // Verify job exists
    const job = await context.env.DB.prepare(`
      SELECT id, status FROM collection_jobs WHERE id = ?
    `).bind(jobId).first()

    if (!job) {
      return new Response(JSON.stringify({ error: 'Job not found' }), {
        status: 404,
        headers: corsHeaders
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
        headers: corsHeaders
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
      headers: corsHeaders
    })

  } catch (error: unknown) {
    console.error('Collection callback error:', error)
    return new Response(JSON.stringify({ error: 'Callback processing failed' }), {
      status: 500,
      headers: corsHeaders
    })
  }
}

// OPTIONS - CORS preflight
export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: corsHeaders })
}
