/**
 * Public Invite Info API
 *
 * GET /api/invites/:token - Get invite info (no auth required)
 */

import { JSON_HEADERS, optionsResponse } from '../_shared/api-utils'

interface Env {
  DB: D1Database
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params } = context
  const inviteToken = params.token as string

  try {
    const invite = await env.DB.prepare(`
      SELECT wi.*, w.id as workspace_id, w.name as workspace_name, w.type as workspace_type,
             wm.nickname as owner_nickname, u.username as owner_username
      FROM workspace_invites wi
      JOIN workspaces w ON wi.workspace_id = w.id
      JOIN users u ON w.owner_id = u.id
      LEFT JOIN workspace_members wm ON wm.workspace_id = w.id AND wm.user_id = w.owner_id
      WHERE wi.invite_token = ?
    `).bind(inviteToken).first()

    if (!invite) {
      return new Response(JSON.stringify({ error: 'Invite not found' }), {
        status: 404, headers: JSON_HEADERS,
      })
    }

    const now = new Date()
    const isExpired = invite.expires_at && new Date(invite.expires_at as string) < now
    const isMaxUsesReached = invite.max_uses && (invite.current_uses as number) >= (invite.max_uses as number)
    const isValid = Boolean(invite.is_active) && !isExpired && !isMaxUsesReached

    return new Response(JSON.stringify({
      workspace: {
        id: invite.workspace_id,
        name: invite.workspace_name,
        type: invite.workspace_type,
        owner_nickname: invite.owner_nickname || invite.owner_username,
      },
      invite: {
        default_role: invite.default_role,
        expires_at: invite.expires_at,
        label: invite.label,
        is_valid: isValid,
        uses_remaining: invite.max_uses ? Math.max(0, (invite.max_uses as number) - (invite.current_uses as number)) : null,
        is_expired: Boolean(isExpired),
        is_max_uses_reached: Boolean(isMaxUsesReached),
      },
    }), { headers: JSON_HEADERS })
  } catch (error) {
    console.error('[invites] Info error:', error)
    return new Response(JSON.stringify({ error: 'Failed to get invite info' }), {
      status: 500, headers: JSON_HEADERS,
    })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return optionsResponse()
}
