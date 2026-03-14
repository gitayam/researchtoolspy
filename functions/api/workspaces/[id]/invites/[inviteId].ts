/**
 * Single Invite API
 *
 * DELETE /api/workspaces/:id/invites/:inviteId - Revoke an invite
 */

import { getUserFromRequest } from '../../../_shared/auth-helpers'

interface Env {
  DB: D1Database
}

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash',
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

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const workspaceId = params.id as string
  const inviteId = params.inviteId as string

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

    const now = new Date().toISOString()
    await env.DB.prepare(`
      UPDATE workspace_invites SET is_active = 0, revoked_at = ?, revoked_by_id = ?
      WHERE id = ? AND workspace_id = ?
    `).bind(now, userId, inviteId, workspaceId).run()

    return new Response(JSON.stringify({ message: 'Invite revoked', revoked_at: now }), { headers: corsHeaders })
  } catch (error) {
    console.error('[workspace-invites] Revoke error:', error)
    return new Response(JSON.stringify({ error: 'Failed to revoke invite' }), {
      status: 500, headers: corsHeaders,
    })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: corsHeaders })
}
