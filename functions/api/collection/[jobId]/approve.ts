/**
 * Collection Approve/Reject API
 *
 * POST /api/collection/{jobId}/approve - Approve selected results and optionally trigger analysis
 * DELETE /api/collection/{jobId}/approve - Reject selected results
 */

import type { PagesFunction } from '@cloudflare/workers-types'
import type { ApproveResultsRequest, ApproveResultsResponse, ApprovalStatus } from '../../../../src/types/collection'
import { getUserFromRequest } from '../../_shared/auth-helpers'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
}

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash, X-Workspace-ID'
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const userId = await getUserFromRequest(context.request, context.env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      })
    }

    const jobId = context.params.jobId as string
    const body = await context.request.json() as ApproveResultsRequest
    const { selectedIds, analyzeNow = true } = body

    if (!jobId) {
      return new Response(JSON.stringify({ error: 'Job ID required' }), {
        status: 400,
        headers: corsHeaders
      })
    }

    if (!selectedIds || selectedIds.length === 0) {
      return new Response(JSON.stringify({ error: 'No results selected' }), {
        status: 400,
        headers: corsHeaders
      })
    }

    // Verify job exists and user has workspace access
    const workspaceId = context.request.headers.get('X-Workspace-ID')
    const job = await context.env.DB.prepare(`
      SELECT id FROM collection_jobs WHERE id = ?${workspaceId ? ' AND workspace_id = ?' : ''}
    `).bind(...(workspaceId ? [jobId, workspaceId] : [jobId])).first()

    if (!job) {
      return new Response(JSON.stringify({ error: 'Job not found' }), {
        status: 404,
        headers: corsHeaders
      })
    }

    // Mark selected results as approved
    const placeholders = selectedIds.map(() => '?').join(',')
    await context.env.DB.prepare(`
      UPDATE collection_results
      SET approved = 1, approved_at = datetime('now')
      WHERE job_id = ? AND id IN (${placeholders})
    `).bind(jobId, ...selectedIds).run()

    if (analyzeNow) {
      // Get URLs for approved results
      const approved = await context.env.DB.prepare(`
        SELECT id, url FROM collection_results
        WHERE job_id = ? AND id IN (${placeholders})
      `).bind(jobId, ...selectedIds).all()

      const urls = (approved.results || []).map((r: any) => r.url as string)

      if (urls.length === 0) {
        return new Response(JSON.stringify({ error: 'No valid URLs found' }), {
          status: 400,
          headers: corsHeaders
        })
      }

      // Create batch items for existing batch processor
      const batchItems = urls.map((url: string, index: number) => ({
        id: `item-${index}`,
        type: 'url',
        source: url
      }))

      // Trigger batch analysis using existing endpoint
      const origin = new URL(context.request.url).origin
      const batchResponse = await fetch(`${origin}/api/tools/batch-process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          operation: 'analyze-url',
          items: batchItems,
          options: { maxWorkers: 3, retryFailed: true }
        }),
        signal: AbortSignal.timeout(60000),
      })

      if (!batchResponse.ok) {
        const errorData = await batchResponse.json()
        return new Response(JSON.stringify({
          error: 'Batch analysis failed to start',
          details: errorData
        }), {
          status: 500,
          headers: corsHeaders
        })
      }

      const batchJob = await batchResponse.json() as { jobId?: string }

      // Link batch job to collection job
      const batchJobId = batchJob.jobId || 'batch-' + Date.now()
      await context.env.DB.prepare(`
        UPDATE collection_jobs SET batch_job_id = ? WHERE id = ?
      `).bind(batchJobId, jobId).run()

      const response: ApproveResultsResponse & { batchJobId: string; urls: number } = {
        approved: selectedIds.length,
        batchJobId: batchJobId,
        status: 'analysis_started',
        urls: urls.length
      }

      return new Response(JSON.stringify(response), {
        status: 200,
        headers: corsHeaders
      })
    }

    const response: ApproveResultsResponse = {
      approved: selectedIds.length,
      status: 'saved'
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: corsHeaders
    })

  } catch (error) {
    console.error('[Collection Approve] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to approve results'

    }), {
      status: 500,
      headers: corsHeaders
    })
  }
}

// Handle rejections
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  try {
    const userId = await getUserFromRequest(context.request, context.env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      })
    }

    const jobId = context.params.jobId as string
    const body = await context.request.json() as { selectedIds: string[] }
    const { selectedIds } = body

    if (!jobId) {
      return new Response(JSON.stringify({ error: 'Job ID required' }), {
        status: 400,
        headers: corsHeaders
      })
    }

    if (!selectedIds || selectedIds.length === 0) {
      return new Response(JSON.stringify({ error: 'No results selected' }), {
        status: 400,
        headers: corsHeaders
      })
    }

    // Verify job exists and user has workspace access
    const workspaceId = context.request.headers.get('X-Workspace-ID')
    const job = await context.env.DB.prepare(`
      SELECT id FROM collection_jobs WHERE id = ?${workspaceId ? ' AND workspace_id = ?' : ''}
    `).bind(...(workspaceId ? [jobId, workspaceId] : [jobId])).first()

    if (!job) {
      return new Response(JSON.stringify({ error: 'Job not found' }), {
        status: 404,
        headers: corsHeaders
      })
    }

    const placeholders = selectedIds.map(() => '?').join(',')
    await context.env.DB.prepare(`
      UPDATE collection_results
      SET approved = -1, approved_at = datetime('now')
      WHERE job_id = ? AND id IN (${placeholders})
    `).bind(jobId, ...selectedIds).run()

    return new Response(JSON.stringify({
      rejected: selectedIds.length,
      status: 'rejected'
    }), {
      status: 200,
      headers: corsHeaders
    })

  } catch (error) {
    console.error('[Collection Reject] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to reject results'

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
