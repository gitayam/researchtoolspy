/**
 * Workspace Invites API
 *
 * GET  /api/workspaces/:id/invites           - List invite links
 * POST /api/workspaces/:id/invites           - Create invite link
 * DELETE /api/workspaces/:id/invites?revoke=ID - Revoke invite
 */

import { getUserFromRequest } from '../../../_shared/auth-helpers'

interface Env {
  DB: D1Database
}

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash',
}

function generateInviteToken(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  const randomBytes = new Uint8Array(12)
  crypto.getRandomValues(randomBytes)
  return `inv_${Array.from(randomBytes).map(b => chars[b % chars.length]).join('')}`
}

async function canManageInvites(db: D1Database, workspaceId: string, userId: number): Promise<boolean> {
  const workspace = await db.prepare(
    `SELECT owner_id FROM workspaces WHERE id = ?`
  ).bind(workspaceId).first()
  if (!workspace) return false
  if (workspace.owner_id === userId) return true

  const member = await db.prepare(
    `SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?`
  ).bind(workspaceId, userId).first()
  return member?.role === 'ADMIN'
}

// GET — List invites
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const workspaceId = params.id as string

  try {
    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: corsHeaders,
      })
    }

    if (!await canManageInvites(env.DB, workspaceId, userId)) {
      return new Response(JSON.stringify({ error: 'Access denied' }), {
        status: 403, headers: corsHeaders,
      })
    }

    const { results } = await env.DB.prepare(`
      SELECT wi.*, u.username as created_by_username,
             wm.nickname as created_by_nickname
      FROM workspace_invites wi
      LEFT JOIN users u ON wi.created_by_id = u.id
      LEFT JOIN workspace_members wm ON wm.workspace_id = wi.workspace_id AND wm.user_id = wi.created_by_id
      WHERE wi.workspace_id = ?
      ORDER BY wi.created_at DESC
    `).bind(workspaceId).all()

    const url = new URL(request.url)
    const invites = results.map((inv: any) => ({
      ...inv,
      invite_url: `${url.origin}/invite/${inv.invite_token}`,
      is_active: Boolean(inv.is_active),
      created_by: {
        id: inv.created_by_id,
        username: inv.created_by_username,
        nickname: inv.created_by_nickname || inv.created_by_username,
      },
    }))

    return new Response(JSON.stringify({ invites }), { headers: corsHeaders })
  } catch (error) {
    console.error('[workspace-invites] List error:', error)
    return new Response(JSON.stringify({ error: 'Failed to list invites' }), {
      status: 500, headers: corsHeaders,
    })
  }
}

// POST — Create invite
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

    if (!await canManageInvites(env.DB, workspaceId, userId)) {
      return new Response(JSON.stringify({ error: 'Access denied' }), {
        status: 403, headers: corsHeaders,
      })
    }

    const body = await request.json() as any
    const role = ['ADMIN', 'EDITOR', 'VIEWER'].includes(body.default_role) ? body.default_role : 'VIEWER'

    let expiresAt: string | null = null
    if (body.expires_in_hours) {
      const d = new Date()
      d.setHours(d.getHours() + body.expires_in_hours)
      expiresAt = d.toISOString()
    }

    const id = crypto.randomUUID()
    const token = generateInviteToken()
    const now = new Date().toISOString()

    await env.DB.prepare(`
      INSERT INTO workspace_invites (id, workspace_id, created_by_id, invite_token, default_role, max_uses, expires_at, label, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, workspaceId, userId, token, role, body.max_uses || null, expiresAt, body.label || null, now).run()

    const url = new URL(request.url)
    return new Response(JSON.stringify({
      id,
      invite_token: token,
      invite_url: `${url.origin}/invite/${token}`,
      default_role: role,
      expires_at: expiresAt,
      is_active: true,
    }), { status: 201, headers: corsHeaders })
  } catch (error) {
    console.error('[workspace-invites] Create error:', error)
    return new Response(JSON.stringify({ error: 'Failed to create invite' }), {
      status: 500, headers: corsHeaders,
    })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: corsHeaders })
}
