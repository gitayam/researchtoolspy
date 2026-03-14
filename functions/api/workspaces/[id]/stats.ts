/**
 * Workspace Stats API
 *
 * GET /api/workspaces/:id/stats — Aggregate counts for the stats bar
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

    // Entity counts
    const [actors, sources, events, places, behaviors] = await Promise.all([
      env.DB.prepare('SELECT COUNT(*) as c FROM actors WHERE workspace_id = ?').bind(workspaceId).first(),
      env.DB.prepare('SELECT COUNT(*) as c FROM sources WHERE workspace_id = ?').bind(workspaceId).first(),
      env.DB.prepare('SELECT COUNT(*) as c FROM events WHERE workspace_id = ?').bind(workspaceId).first(),
      env.DB.prepare('SELECT COUNT(*) as c FROM places WHERE workspace_id = ?').bind(workspaceId).first(),
      env.DB.prepare('SELECT COUNT(*) as c FROM behaviors WHERE workspace_id = ?').bind(workspaceId).first(),
    ])

    const actorCount = (actors?.c as number) || 0
    const sourceCount = (sources?.c as number) || 0
    const eventCount = (events?.c as number) || 0
    const placeCount = (places?.c as number) || 0
    const behaviorCount = (behaviors?.c as number) || 0

    // COP sessions, frameworks, members
    const [copSessions, frameworks, members] = await Promise.all([
      env.DB.prepare('SELECT COUNT(*) as c FROM cop_sessions WHERE team_workspace_id = ?').bind(workspaceId).first(),
      env.DB.prepare('SELECT COUNT(*) as c FROM framework_sessions WHERE workspace_id = ?').bind(workspaceId).first(),
      env.DB.prepare('SELECT COUNT(*) as c FROM workspace_members WHERE workspace_id = ?').bind(workspaceId).first(),
    ])

    // Tools count (playbooks + task templates + intake forms across linked COP sessions)
    const toolsResult = await env.DB.prepare(`
      SELECT
        (SELECT COUNT(*) FROM cop_playbooks WHERE cop_session_id IN (SELECT id FROM cop_sessions WHERE team_workspace_id = ?)) +
        (SELECT COUNT(DISTINCT t.id) FROM cop_task_templates t JOIN cop_sessions cs ON cs.workspace_id = t.workspace_id WHERE cs.team_workspace_id = ?) +
        (SELECT COUNT(*) FROM cop_intake_forms WHERE cop_session_id IN (SELECT id FROM cop_sessions WHERE team_workspace_id = ?))
        as total
    `).bind(workspaceId, workspaceId, workspaceId).first()

    return new Response(JSON.stringify({
      entities: actorCount + sourceCount + eventCount + placeCount + behaviorCount,
      entity_breakdown: {
        actors: actorCount,
        sources: sourceCount,
        events: eventCount,
        places: placeCount,
        behaviors: behaviorCount,
      },
      cop_sessions: (copSessions?.c as number) || 0,
      frameworks: (frameworks?.c as number) || 0,
      tools: (toolsResult?.total as number) || 0,
      members: (members?.c as number) || 0,
    }), { headers: jsonHeaders })
  } catch (error) {
    console.error('[workspace stats] Error:', error)
    return new Response(JSON.stringify({ error: 'Failed to fetch stats' }), {
      status: 500, headers: jsonHeaders,
    })
  }
}
