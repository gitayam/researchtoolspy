/**
 * Workspace COP Sessions API
 *
 * GET /api/workspaces/:id/cop-sessions — List COP sessions linked to this team workspace
 */

import { getUserFromRequest } from '../../_shared/auth-helpers'
import { getWorkspaceMemberRole } from '../../_shared/workspace-helpers'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
}

const jsonHeaders = { 'Content-Type': 'application/json' }

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const workspaceId = params.id as string
  const url = new URL(request.url)

  try {
    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: jsonHeaders,
      })
    }

    const role = await getWorkspaceMemberRole(env.DB, workspaceId, userId)
    if (!role) {
      return new Response(JSON.stringify({ error: 'Not a workspace member' }), {
        status: 403, headers: jsonHeaders,
      })
    }

    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10) || 50, 200)
    const offset = Math.max(parseInt(url.searchParams.get('offset') || '0', 10) || 0, 0)

    const countResult = await env.DB.prepare(
      'SELECT COUNT(*) as total FROM cop_sessions WHERE team_workspace_id = ?'
    ).bind(workspaceId).first()

    const { results } = await env.DB.prepare(`
      SELECT
        cs.id, cs.name, cs.template_type, cs.status,
        cs.time_window_start, cs.time_window_end,
        cs.created_at,
        (SELECT COUNT(*) FROM cop_collaborators WHERE cop_session_id = cs.id) as collaborator_count,
        (SELECT COUNT(*) FROM cop_markers WHERE cop_session_id = cs.id) as marker_count,
        (SELECT COUNT(*) FROM evidence_items WHERE workspace_id = cs.workspace_id) as evidence_count
      FROM cop_sessions cs
      WHERE cs.team_workspace_id = ?
      ORDER BY cs.updated_at DESC
      LIMIT ? OFFSET ?
    `).bind(workspaceId, limit, offset).all()

    return new Response(JSON.stringify({
      sessions: results,
      total: (countResult?.total as number) || 0,
      limit,
      offset,
    }), { headers: jsonHeaders })
  } catch (error) {
    console.error('[workspace cop-sessions] Error:', error)
    return new Response(JSON.stringify({ error: 'Failed to fetch COP sessions' }), {
      status: 500, headers: jsonHeaders,
    })
  }
}
