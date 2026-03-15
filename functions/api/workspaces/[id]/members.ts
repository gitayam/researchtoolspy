/**
 * Workspace Members API
 *
 * GET  /api/workspaces/:id/members - List workspace members
 * POST /api/workspaces/:id/members - Add a member
 */

import { getUserFromRequest } from '../../_shared/auth-helpers'
import { canManageWorkspace } from '../../_shared/workspace-helpers'
import { JSON_HEADERS } from '../../_shared/api-utils'

interface Env {
  DB: D1Database
  JWT_SECRET?: string
}


// GET — List members
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const workspaceId = params.id as string

  try {
    const userId = await getUserFromRequest(request, env)

    // Check access — must be owner or member
    const workspace = await env.DB.prepare(
      `SELECT owner_id FROM workspaces WHERE id = ?`
    ).bind(workspaceId).first()

    if (!workspace) {
      return new Response(JSON.stringify({ error: 'Workspace not found' }), {
        status: 404, headers: JSON_HEADERS,
      })
    }

    const isOwner = String(workspace.owner_id) === String(userId)
    const isMember = userId
      ? await env.DB.prepare(
          `SELECT 1 FROM workspace_members WHERE workspace_id = ? AND user_id = ?`
        ).bind(workspaceId, userId).first()
      : null

    if (!isOwner && !isMember) {
      return new Response(JSON.stringify({ error: 'Access denied' }), {
        status: 403, headers: JSON_HEADERS,
      })
    }

    const { results } = await env.DB.prepare(`
      SELECT wm.id, wm.workspace_id, wm.user_id, wm.role, wm.nickname, wm.joined_at, wm.joined_via_invite_id,
             u.username
      FROM workspace_members wm
      LEFT JOIN users u ON wm.user_id = u.id
      WHERE wm.workspace_id = ?
      ORDER BY wm.joined_at ASC
    `).bind(workspaceId).all()

    return new Response(JSON.stringify(results), { headers: JSON_HEADERS })
  } catch (error) {
    console.error('[workspace-members] List error:', error)
    return new Response(JSON.stringify({ error: 'Failed to list members' }), {
      status: 500, headers: JSON_HEADERS,
    })
  }
}

// POST — Add member
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const workspaceId = params.id as string

  try {
    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: JSON_HEADERS,
      })
    }
    const body = await request.json() as any

    if (!body.user_id || !body.role) {
      return new Response(JSON.stringify({ error: 'user_id and role are required' }), {
        status: 400, headers: JSON_HEADERS,
      })
    }

    if (!await canManageWorkspace(env.DB, workspaceId, userId)) {
      return new Response(JSON.stringify({ error: 'Access denied' }), {
        status: 403, headers: JSON_HEADERS,
      })
    }

    // Check if user is already a member
    const existing = await env.DB.prepare(
      'SELECT id FROM workspace_members WHERE workspace_id = ? AND user_id = ?'
    ).bind(workspaceId, body.user_id).first()

    if (existing) {
      return new Response(JSON.stringify({ error: 'User is already a member of this workspace' }), {
        status: 409, headers: JSON_HEADERS,
      })
    }

    const VALID_ROLES = ['VIEWER', 'EDITOR', 'ADMIN']
    const role = VALID_ROLES.includes(body.role) ? body.role : 'VIEWER'

    const id = crypto.randomUUID()
    await env.DB.prepare(`
      INSERT INTO workspace_members (id, workspace_id, user_id, role, joined_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `).bind(id, workspaceId, body.user_id, role).run()

    return new Response(JSON.stringify({ id, message: 'Member added' }), {
      status: 201, headers: JSON_HEADERS,
    })
  } catch (error) {
    console.error('[workspace-members] Add error:', error)
    return new Response(JSON.stringify({ error: 'Failed to add member' }), {
      status: 500, headers: JSON_HEADERS,
    })
  }
}

