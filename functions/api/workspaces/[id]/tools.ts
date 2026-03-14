/**
 * Workspace Tools API
 *
 * GET /api/workspaces/:id/tools — COP templates (playbooks, task templates, intake forms)
 * across all COP sessions linked to this team workspace
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

    // Playbooks — scoped by cop_session_id
    const { results: playbooks } = await env.DB.prepare(`
      SELECT p.id, p.name, p.description, p.is_active, p.created_at,
             cs.id as cop_session_id, cs.name as cop_session_name
      FROM cop_playbooks p
      JOIN cop_sessions cs ON p.cop_session_id = cs.id
      WHERE cs.team_workspace_id = ?
      ORDER BY p.created_at DESC
    `).bind(workspaceId).all()

    // Task templates — scoped by workspace_id (per-session entity workspace), not cop_session_id
    // Use DISTINCT to prevent row multiplication when multiple cop sessions share a workspace
    const { results: taskTemplates } = await env.DB.prepare(`
      SELECT DISTINCT t.id, t.name, t.description, t.task_type, t.created_at,
             cs.id as cop_session_id, cs.name as cop_session_name
      FROM cop_task_templates t
      JOIN cop_sessions cs ON cs.workspace_id = t.workspace_id
      WHERE cs.team_workspace_id = ?
      ORDER BY t.created_at DESC
    `).bind(workspaceId).all()

    // Intake forms — scoped by cop_session_id
    const { results: intakeForms } = await env.DB.prepare(`
      SELECT f.id, f.title as name, f.description, f.is_public, f.created_at,
             cs.id as cop_session_id, cs.name as cop_session_name
      FROM cop_intake_forms f
      JOIN cop_sessions cs ON f.cop_session_id = cs.id
      WHERE cs.team_workspace_id = ?
      ORDER BY f.created_at DESC
    `).bind(workspaceId).all()

    return new Response(JSON.stringify({
      playbooks,
      task_templates: taskTemplates,
      intake_forms: intakeForms,
    }), { headers: jsonHeaders })
  } catch (error) {
    console.error('[workspace tools] Error:', error)
    return new Response(JSON.stringify({ error: 'Failed to fetch tools' }), {
      status: 500, headers: jsonHeaders,
    })
  }
}
