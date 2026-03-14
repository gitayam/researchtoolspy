/**
 * Workspace Members API
 *
 * GET  /api/workspaces/:id/members - List workspace members
 * POST /api/workspaces/:id/members - Add a member
 */

import { getUserFromRequest } from '../../_shared/auth-helpers'

interface Env {
  DB: D1Database
  JWT_SECRET?: string
}

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash',
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
        status: 404, headers: corsHeaders,
      })
    }

    const isOwner = workspace.owner_id === userId
    const isMember = userId
      ? await env.DB.prepare(
          `SELECT 1 FROM workspace_members WHERE workspace_id = ? AND user_id = ?`
        ).bind(workspaceId, userId).first()
      : null

    if (!isOwner && !isMember) {
      return new Response(JSON.stringify({ error: 'Access denied' }), {
        status: 403, headers: corsHeaders,
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

    return new Response(JSON.stringify(results), { headers: corsHeaders })
  } catch (error) {
    console.error('[workspace-members] List error:', error)
    return new Response(JSON.stringify({ error: 'Failed to list members' }), {
      status: 500, headers: corsHeaders,
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
        status: 401, headers: corsHeaders,
      })
    }
    const body = await request.json() as any

    if (!body.user_id || !body.role) {
      return new Response(JSON.stringify({ error: 'user_id and role are required' }), {
        status: 400, headers: corsHeaders,
      })
    }

    // Check permissions — only owner or admin
    const workspace = await env.DB.prepare(
      `SELECT owner_id FROM workspaces WHERE id = ?`
    ).bind(workspaceId).first()

    if (!workspace) {
      return new Response(JSON.stringify({ error: 'Workspace not found' }), {
        status: 404, headers: corsHeaders,
      })
    }

    const isOwner = workspace.owner_id === userId
    const member = await env.DB.prepare(
      `SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?`
    ).bind(workspaceId, userId).first()

    if (!isOwner && member?.role !== 'ADMIN') {
      return new Response(JSON.stringify({ error: 'Access denied' }), {
        status: 403, headers: corsHeaders,
      })
    }

    const id = crypto.randomUUID()
    await env.DB.prepare(`
      INSERT INTO workspace_members (id, workspace_id, user_id, role, joined_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `).bind(id, workspaceId, body.user_id, body.role).run()

    return new Response(JSON.stringify({ id, message: 'Member added' }), {
      status: 201, headers: corsHeaders,
    })
  } catch (error) {
    console.error('[workspace-members] Add error:', error)
    return new Response(JSON.stringify({ error: 'Failed to add member' }), {
      status: 500, headers: corsHeaders,
    })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: corsHeaders })
}
