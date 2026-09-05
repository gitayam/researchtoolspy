/**
 * Collection Start API - Initiate Agentic Research Collection Job
 *
 * POST /api/collection/start
 * Starts a new collection job that queries the research agent for source gathering
 */

import type { PagesFunction } from '@cloudflare/workers-types'
import { getUserFromRequest } from '../_shared/auth-helpers'
import { JSON_HEADERS, CORS_HEADERS } from '../_shared/api-utils'
import { checkWorkspaceAccess } from '../_shared/workspace-helpers'
import type { CollectionCategory, TimeRange, CollectionJobRequest, CollectionJobResponse, AgentCollectionRequest } from '../../../src/types/collection'

interface Env {
  DB: D1Database
  CACHE?: KVNamespace
  SESSIONS?: KVNamespace
  OSINT_AGENT_URL?: string
  SEARXNG_CONTAINER_URL?: string
}

const DEFAULT_CATEGORIES: CollectionCategory[] = ['news', 'academic', 'government', 'social', 'technical']

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  const url = new URL(request.url)

  try {
    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: JSON_HEADERS
      })
    }

    const requestedWorkspaceId = request.headers.get('X-Workspace-ID') || url.searchParams.get('workspace_id') || null
    let workspaceId: string | null = requestedWorkspaceId

    const body = await request.json() as CollectionJobRequest
    const { query, categories, timeRange, maxResults, useLocalLLM } = body

    // Validate query
    if (!query || query.trim().length < 3) {
      return new Response(JSON.stringify({
        error: 'Query must be at least 3 characters'
      }), {
        status: 400,
        headers: JSON_HEADERS
      })
    }

    // Resolve a writable workspace before inserting. An explicit workspace is
    // authoritative and fails closed; without one, choose an owned/editor
    // workspace or create a personal workspace.
    if (workspaceId) {
      const canWrite = await checkWorkspaceAccess(workspaceId, userId, env, 'EDITOR')
      if (!canWrite) {
        return new Response(JSON.stringify({ error: 'Access denied' }), {
          status: 403,
          headers: JSON_HEADERS,
        })
      }
    }
    if (!workspaceId) {
      const existing = await env.DB.prepare(`
        SELECT id AS workspace_id FROM workspaces WHERE owner_id = ?
        UNION
        SELECT workspace_id FROM workspace_members
        WHERE user_id = ? AND upper(role) IN ('ADMIN', 'EDITOR')
        ORDER BY workspace_id ASC
        LIMIT 1
      `).bind(userId, userId).first<{ workspace_id: string }>()
      if (existing) {
        workspaceId = existing.workspace_id
      } else {
        const newWorkspaceId = crypto.randomUUID()
        const user = await env.DB.prepare('SELECT username FROM users WHERE id = ?')
          .bind(userId).first<{ username: string }>()
        const workspaceName = user?.username
          ? `${user.username}'s Workspace`
          : `Workspace ${newWorkspaceId.slice(0, 8)}`
        await env.DB.prepare(`
          INSERT INTO workspaces (id, name, description, type, owner_id, is_public, created_at, updated_at)
          VALUES (?, ?, ?, 'PERSONAL', ?, 0, datetime('now'), datetime('now'))
        `).bind(newWorkspaceId, workspaceName, 'Personal workspace', userId).run()
        await env.DB.prepare(`
          INSERT INTO workspace_members (id, workspace_id, user_id, role, joined_at)
          VALUES (?, ?, ?, 'ADMIN', datetime('now'))
        `).bind(crypto.randomUUID(), newWorkspaceId, userId).run()
        workspaceId = newWorkspaceId
      }
    }

    // Generate job ID
    const jobId = crypto.randomUUID()
    // Per-job verification token. Stored on the job and forwarded to the agent so
    // it can echo it back on the callback (backward-compatible rollout: see callback.ts).
    const callbackSecret = crypto.randomUUID()
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
      useLocalLLM: useLocalLLM || false,
      callbackSecret
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
        callback_secret,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'running', ?, datetime('now'))
    `).bind(
      jobId,
      workspaceId,
      query.trim(),
      JSON.stringify(finalCategories),
      finalTimeRange,
      finalMaxResults,
      callbackSecret
    ).run()

    // Fire async request to agent (don't await - fire and forget)
    context.waitUntil(
      fetch(`${agentUrl}/collect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(agentRequest),
        signal: AbortSignal.timeout(30000),
      }).catch(async (error) => {
        // Update job status on connection failure
        console.error(`[Collection Start] Agent connection failed for job ${jobId}:`, error)
        await env.DB.prepare(`
          UPDATE collection_jobs SET status = 'error', error_message = ? WHERE id = ?
        `).bind('Agent connection failed', jobId).run()
      })
    )

    const response: CollectionJobResponse = {
      jobId,
      status: 'started',
      message: 'Collection job initiated'
    }

    return new Response(JSON.stringify(response), {
      status: 202,
      headers: JSON_HEADERS
    })

  } catch (error) {
    console.error('[Collection Start] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to start collection'

    }), {
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
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}
