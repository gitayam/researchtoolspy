/**
 * Collection Job Status API
 *
 * GET /api/collection/{jobId}/status
 * Returns the status and details of a collection job
 */

import type { PagesFunction } from '@cloudflare/workers-types'
import type { CollectionJob, CollectionResultsSummary } from '../../../../src/types/collection'

interface Env {
  DB: D1Database
}

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash, X-Workspace-ID'
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const jobId = context.params.jobId as string

    if (!jobId) {
      return new Response(JSON.stringify({ error: 'Job ID required' }), {
        status: 400,
        headers: corsHeaders
      })
    }

    // Get job details
    const job = await context.env.DB.prepare(`
      SELECT id, workspace_id, query, categories, time_range, max_results,
             status, results_count, batch_job_id, error_message, llm_used,
             created_at, completed_at
      FROM collection_jobs WHERE id = ?
    `).bind(jobId).first()

    if (!job) {
      return new Response(JSON.stringify({ error: 'Job not found' }), {
        status: 404,
        headers: corsHeaders
      })
    }

    // Parse categories JSON and construct typed response
    const parsedJob: CollectionJob = {
      id: job.id as string,
      workspace_id: job.workspace_id as string,
      query: job.query as string,
      categories: JSON.parse(job.categories as string || '[]'),
      time_range: job.time_range as CollectionJob['time_range'],
      max_results: job.max_results as number,
      status: job.status as CollectionJob['status'],
      results_count: job.results_count as number,
      batch_job_id: job.batch_job_id as string | undefined,
      error_message: job.error_message as string | undefined,
      llm_used: job.llm_used as CollectionJob['llm_used'],
      created_at: job.created_at as string,
      completed_at: job.completed_at as string | undefined
    }

    // If complete, include results summary by category
    if (job.status === 'complete') {
      const summary = await context.env.DB.prepare(`
        SELECT category, COUNT(*) as count, AVG(relevance_score) as avg_relevance
        FROM collection_results WHERE job_id = ?
        GROUP BY category
        ORDER BY count DESC
      `).bind(jobId).all()

      const resultsSummary: CollectionResultsSummary[] = (summary.results || []).map(row => ({
        category: row.category as CollectionResultsSummary['category'],
        count: row.count as number,
        avg_relevance: row.avg_relevance as number
      }))

      return new Response(JSON.stringify({
        ...parsedJob,
        resultsSummary
      }), {
        status: 200,
        headers: corsHeaders
      })
    }

    return new Response(JSON.stringify(parsedJob), {
      status: 200,
      headers: corsHeaders
    })

  } catch (error) {
    console.error('[Collection Status] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to get status'

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
