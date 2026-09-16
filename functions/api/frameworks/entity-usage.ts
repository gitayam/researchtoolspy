/**
 * Framework Entity Usage API
 * Returns all frameworks where a specific entity is used.
 *
 * Every query in here previously named a column that does not exist
 * (framework_sessions.framework_name / .framework_data, ach_analyses.analysis_data),
 * so the endpoint answered 500 to every single call it had ever received. It also
 * ran unauthenticated and unscoped, which only failed to leak other workspaces'
 * analysis titles because the SQL errored before returning rows.
 */

import { getUserFromRequest } from '../_shared/auth-helpers'
import { checkWorkspaceAccess } from '../_shared/workspace-helpers'
import { CORS_HEADERS, JSON_HEADERS } from '../_shared/api-utils'

interface Env {
  DB: D1Database
}

export async function onRequestGet(context: { request: Request; env: Env }) {
  const { request, env } = context

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  try {
    const url = new URL(request.url)
    const entityId = url.searchParams.get('entity_id')
    const entityType = url.searchParams.get('entity_type')
    const workspaceId = url.searchParams.get('workspace_id')
      || request.headers.get('X-Workspace-ID')
      || null

    if (!entityId || !entityType) {
      return new Response(JSON.stringify({ error: 'entity_id and entity_type required' }), {
        status: 400,
        headers: JSON_HEADERS,
      })
    }

    const userId = await getUserFromRequest(request, env as any)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: JSON_HEADERS,
      })
    }

    if (!workspaceId) {
      return new Response(JSON.stringify({ error: 'workspace_id is required' }), {
        status: 400,
        headers: JSON_HEADERS,
      })
    }

    if (!(await checkWorkspaceAccess(workspaceId, userId, env, 'VIEWER'))) {
      return new Response(JSON.stringify({ error: 'Access denied to workspace' }), {
        status: 403,
        headers: JSON_HEADERS,
      })
    }

    const frameworks: any[] = []

    // COG analyses that name this entity anywhere in their saved JSON payload.
    if (entityType === 'ACTOR') {
      const cogActors = await env.DB.prepare(`
        SELECT DISTINCT fs.id, fs.framework_type, fs.title, fs.created_at
        FROM framework_sessions fs
        WHERE fs.framework_type = 'cog'
          AND fs.workspace_id = ?
          AND fs.status != 'deleted'
          AND (fs.data LIKE ? OR fs.data LIKE ?)
        ORDER BY fs.created_at DESC
        LIMIT 20
      `).bind(
        workspaceId,
        `%"actor_id":"${entityId}"%`,
        `%"actor_name":"${entityId}"%`,
      ).all()

      frameworks.push(...(cogActors.results || []).map((f: any) => ({
        id: f.id,
        type: 'cog',
        title: f.title || 'Untitled COG Analysis',
        role: 'Referenced Actor',
        created_at: f.created_at,
        url: `/dashboard/analysis-frameworks/cog/${f.id}`,
      })))
    }

    // ACH analyses reach an actor through their linked evidence rather than
    // directly, which is the association the old (never-executing) query was
    // reaching for when it string-matched a column that did not exist.
    if (entityType === 'ACTOR') {
      const achAnalyses = await env.DB.prepare(`
        SELECT DISTINCT a.id, a.title, a.created_at
        FROM ach_analyses a
        JOIN ach_evidence_links ael ON ael.ach_analysis_id = a.id
        JOIN evidence_actors ea ON ea.evidence_id = ael.evidence_id
        WHERE ea.actor_id = ?
          AND a.workspace_id = ?
        ORDER BY a.created_at DESC
        LIMIT 20
      `).bind(entityId, workspaceId).all()

      frameworks.push(...(achAnalyses.results || []).map((f: any) => ({
        id: f.id,
        type: 'ach',
        title: f.title || 'Untitled ACH Analysis',
        role: 'Evidence Mentions Entity',
        created_at: f.created_at,
        url: `/dashboard/analysis-frameworks/ach-dashboard/${f.id}`,
      })))
    }

    // Sort by most recent
    frameworks.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    return new Response(JSON.stringify({ frameworks }), {
      status: 200,
      headers: JSON_HEADERS,
    })

  } catch (error) {
    console.error('Entity usage lookup error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to look up entity usage'
    }), {
      status: 500,
      headers: JSON_HEADERS,
    })
  }
}
