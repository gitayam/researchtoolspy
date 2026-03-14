/**
 * Accept Invite API
 *
 * POST /api/invites/:token/accept - Accept an invite and join workspace
 */

import { getUserIdOrDefault } from '../../_shared/auth-helpers'

interface Env {
  DB: D1Database
}

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash',
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const inviteToken = params.token as string

  try {
    const userId = await getUserIdOrDefault(request, env)
    const body = await request.json() as any

    if (!body.nickname?.trim()) {
      return new Response(JSON.stringify({ error: 'Nickname is required' }), {
        status: 400, headers: corsHeaders,
      })
    }

    const invite = await env.DB.prepare(
      `SELECT * FROM workspace_invites WHERE invite_token = ?`
    ).bind(inviteToken).first()

    if (!invite) {
      return new Response(JSON.stringify({ error: 'Invite not found' }), {
        status: 404, headers: corsHeaders,
      })
    }

    // Validate
    const now = new Date()
    const isExpired = invite.expires_at && new Date(invite.expires_at as string) < now
    const isMaxUsesReached = invite.max_uses && (invite.current_uses as number) >= (invite.max_uses as number)

    if (!invite.is_active) {
      return new Response(JSON.stringify({ error: 'This invite has been revoked' }), {
        status: 400, headers: corsHeaders,
      })
    }
    if (isExpired) {
      return new Response(JSON.stringify({ error: 'This invite has expired' }), {
        status: 400, headers: corsHeaders,
      })
    }
    if (isMaxUsesReached) {
      return new Response(JSON.stringify({ error: 'This invite has reached maximum uses' }), {
        status: 400, headers: corsHeaders,
      })
    }

    // Check if already a member
    const existing = await env.DB.prepare(
      `SELECT id FROM workspace_members WHERE workspace_id = ? AND user_id = ?`
    ).bind(invite.workspace_id, userId).first()

    if (existing) {
      return new Response(JSON.stringify({ error: 'Already a member of this workspace' }), {
        status: 400, headers: corsHeaders,
      })
    }

    // Create member
    const memberId = crypto.randomUUID()
    const joinedAt = new Date().toISOString()

    await env.DB.prepare(`
      INSERT INTO workspace_members (id, workspace_id, user_id, role, nickname, joined_via_invite_id, joined_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(memberId, invite.workspace_id, userId, invite.default_role, body.nickname.trim(), invite.id, joinedAt).run()

    // Increment invite usage
    await env.DB.prepare(
      `UPDATE workspace_invites SET current_uses = current_uses + 1 WHERE id = ?`
    ).bind(invite.id).run()

    // Track usage
    await env.DB.prepare(`
      INSERT INTO workspace_invite_uses (id, invite_id, user_id, workspace_member_id, nickname_used, used_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(crypto.randomUUID(), invite.id, userId, memberId, body.nickname.trim(), joinedAt).run()

    return new Response(JSON.stringify({
      workspace_id: invite.workspace_id,
      member_id: memberId,
      role: invite.default_role,
      nickname: body.nickname.trim(),
      joined_at: joinedAt,
    }), { status: 201, headers: corsHeaders })
  } catch (error) {
    console.error('[invites] Accept error:', error)
    return new Response(JSON.stringify({ error: 'Failed to accept invite' }), {
      status: 500, headers: corsHeaders,
    })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: corsHeaders })
}
