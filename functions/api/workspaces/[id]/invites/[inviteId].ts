/**
 * Single Invite API
 *
 * DELETE /api/workspaces/:id/invites/:inviteId - Revoke an invite
 */

import { getUserFromRequest } from '../../../_shared/auth-helpers'
import { canManageWorkspace } from '../../../_shared/workspace-helpers'

interface Env {
  DB: D1Database
}

const jsonHeaders = { 'Content-Type': 'application/json' }

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const workspaceId = params.id as string
  const inviteId = params.inviteId as string

  try {
    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: jsonHeaders,
      })
    }

    if (!await canManageWorkspace(env.DB, workspaceId, userId)) {
      return new Response(JSON.stringify({ error: 'Access denied' }), {
        status: 403, headers: jsonHeaders,
      })
    }

    const now = new Date().toISOString()
    await env.DB.prepare(`
      UPDATE workspace_invites SET is_active = 0, revoked_at = ?, revoked_by_id = ?
      WHERE id = ? AND workspace_id = ?
    `).bind(now, userId, inviteId, workspaceId).run()

    return new Response(JSON.stringify({ message: 'Invite revoked', revoked_at: now }), { headers: jsonHeaders })
  } catch (error) {
    console.error('[workspace-invites] Revoke error:', error)
    return new Response(JSON.stringify({ error: 'Failed to revoke invite' }), {
      status: 500, headers: jsonHeaders,
    })
  }
}

