/**
 * Collection Results API
 *
 * GET /api/collection/{jobId}/results
 * Returns paginated collection results with filtering support
 */

import type { PagesFunction } from '@cloudflare/workers-types'
import type { CollectionResult, CollectionResultsResponse, CollectionCategory, ApprovalStatus } from '../../../../src/types/collection'
import { getUserFromRequest } from '../../_shared/auth-helpers'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
  JWT_SECRET?: string
}

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash, X-Workspace-ID'
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  // Auth check — collection results require authentication
  const userId = await getUserFromRequest(context.request, context.env)
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), {
      status: 401,
      headers: corsHeaders
    })
  }

  try {
    const jobId = context.params.jobId as string
    const url = new URL(context.request.url)

    const category = url.searchParams.get('category') as CollectionCategory | null
    const minRelevance = parseInt(url.searchParams.get('minRelevance') || '0')
    const approved = url.searchParams.get('approved') // 'pending', 'approved', 'rejected', 'all'
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200)
    const offset = parseInt(url.searchParams.get('offset') || '0')

    if (!jobId) {
      return new Response(JSON.stringify({ error: 'Job ID required' }), {
        status: 400,
        headers: corsHeaders
      })
    }

    // Verify job exists
    const job = await context.env.DB.prepare(`
      SELECT id FROM collection_jobs WHERE id = ?
    `).bind(jobId).first()

    if (!job) {
      return new Response(JSON.stringify({ error: 'Job not found' }), {
        status: 404,
        headers: corsHeaders
      })
    }

    // Build query dynamically
    let query = `
      SELECT id, job_id, url, title, snippet, category, source_domain,
             relevance_score, published_date, engine, approved, approved_at,
             analysis_id, created_at
      FROM collection_results
      WHERE job_id = ? AND relevance_score >= ?
    `
    const params: (string | number)[] = [jobId, minRelevance]

    if (category) {
      query += ' AND category = ?'
      params.push(category)
    }

    if (approved && approved !== 'all') {
      const approvalValue: ApprovalStatus = approved === 'approved' ? 1 : approved === 'rejected' ? -1 : 0
      query += ' AND approved = ?'
      params.push(approvalValue)
    }

    query += ' ORDER BY relevance_score DESC LIMIT ? OFFSET ?'
    params.push(limit, offset)

    const results = await context.env.DB.prepare(query).bind(...params).all()

    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(*) as total FROM collection_results
      WHERE job_id = ? AND relevance_score >= ?
    `
    const countParams: (string | number)[] = [jobId, minRelevance]

    if (category) {
      countQuery += ' AND category = ?'
      countParams.push(category)
    }
    if (approved && approved !== 'all') {
      const approvalValue: ApprovalStatus = approved === 'approved' ? 1 : approved === 'rejected' ? -1 : 0
      countQuery += ' AND approved = ?'
      countParams.push(approvalValue)
    }

    const countResult = await context.env.DB.prepare(countQuery).bind(...countParams).first()
    const total = (countResult?.total as number) || 0

    // Map results to typed objects
    const typedResults: CollectionResult[] = (results.results || []).map(row => ({
      id: row.id as string,
      job_id: row.job_id as string,
      url: row.url as string,
      title: row.title as string | undefined,
      snippet: row.snippet as string | undefined,
      category: row.category as CollectionCategory,
      source_domain: row.source_domain as string | undefined,
      relevance_score: row.relevance_score as number,
      published_date: row.published_date as string | undefined,
      engine: row.engine as string | undefined,
      approved: row.approved as ApprovalStatus,
      approved_at: row.approved_at as string | undefined,
      analysis_id: row.analysis_id as string | undefined,
      created_at: row.created_at as string
    }))

    const response: CollectionResultsResponse & { pagination: { total: number } } = {
      results: typedResults,
      pagination: {
        limit,
        offset,
        total,
        hasMore: offset + typedResults.length < total
      }
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: corsHeaders
    })

  } catch (error) {
    console.error('[Collection Results] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to get results'

    }), {
      status: 500,
      headers: corsHeaders
    })
  }
}

// OPTIONS - CORS preflight
export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: corsHeaders })
}
