/**
 * Collection Start API - Initiate Agentic Research Collection Job
 *
 * POST /api/collection/start
 * Starts a new collection job that queries the research agent for source gathering
 */

import type { PagesFunction } from '@cloudflare/workers-types'
import { getUserIdOrDefault } from '../_shared/auth-helpers'
import type { CollectionCategory, TimeRange, CollectionJobRequest, CollectionJobResponse, AgentCollectionRequest } from '../../../src/types/collection'

interface Env {
  DB: D1Database
  CACHE?: KVNamespace
  SESSIONS?: KVNamespace
  OSINT_AGENT_URL?: string
  SEARXNG_CONTAINER_URL?: string
}

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash, X-Workspace-ID'
}

const DEFAULT_CATEGORIES: CollectionCategory[] = ['news', 'academic', 'government', 'social', 'technical']

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  const url = new URL(request.url)

  try {
    const userId = await getUserIdOrDefault(request, env)
    const workspaceId = request.headers.get('X-Workspace-ID') || url.searchParams.get('workspace_id') || '1'

    const body = await request.json() as CollectionJobRequest
    const { query, categories, timeRange, maxResults, useLocalLLM } = body

    // Validate query
    if (!query || query.trim().length < 3) {
      return new Response(JSON.stringify({
        error: 'Query must be at least 3 characters'
      }), {
        status: 400,
        headers: corsHeaders
      })
    }

    // Generate job ID
    const jobId = crypto.randomUUID()
    const finalCategories = categories && categories.length > 0 ? categories : DEFAULT_CATEGORIES
    const finalTimeRange: TimeRange = timeRange || 'year'
    const finalMaxResults = maxResults || 100

    // Get container URLs from env
    const agentUrl = env.OSINT_AGENT_URL || 'https://researchtoolspy-containers.wemea-5ahhf.workers.dev/osint'
    // Use self-hosted SearXNG via Cloudflare Tunnel
    const searxngUrl = env.SEARXNG_CONTAINER_URL || 'https://search.irregularchat.com'
    const callbackUrl = new URL('/api/collection/callback', request.url).toString()

    // Prepare agent request
    const agentRequest: AgentCollectionRequest = {
      jobId,
      query: query.trim(),
      categories: finalCategories,
      maxResults: finalMaxResults,
      timeRange: finalTimeRange,
      searxngEndpoint: searxngUrl,  // Use public SearXNG directly
      callbackUrl,
      useLocalLLM: useLocalLLM || false
    }

    // Insert job record with 'running' status directly to avoid race condition
    // (previously: INSERT with 'pending' then UPDATE to 'running' had race condition risk)
    await env.DB.prepare(`
      INSERT INTO collection_jobs (
        id,
        workspace_id,
        query,
        categories,
        time_range,
        max_results,
        status,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'running', datetime('now'))
    `).bind(
      jobId,
      workspaceId,
      query.trim(),
      JSON.stringify(finalCategories),
      finalTimeRange,
      finalMaxResults
    ).run()

    // Fire async request to agent (don't await - fire and forget)
    context.waitUntil(
      fetch(`${agentUrl}/collect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(agentRequest)
      }).catch(async (error) => {
        // Update job status on connection failure
        console.error(`[Collection Start] Agent connection failed for job ${jobId}:`, error)
        await env.DB.prepare(`
          UPDATE collection_jobs SET status = 'error', error_message = ? WHERE id = ?
        `).bind(`Agent connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`, jobId).run()
      })
    )

    const response: CollectionJobResponse = {
      jobId,
      status: 'started',
      message: 'Collection job initiated'
    }

    return new Response(JSON.stringify(response), {
      status: 202,
      headers: corsHeaders
    })

  } catch (error) {
    console.error('[Collection Start] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to start collection'

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
