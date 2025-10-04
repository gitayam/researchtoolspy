/**
 * Workspace Invites API
 * Secure invite link system for investigation teams
 */

import type { PagesFunction } from '@cloudflare/workers-types'

interface Env {
  DB: D1Database
  SESSIONS: KVNamespace
}

// Helper to get user from session
async function getUserFromRequest(request: Request, env: Env): Promise<number | null> {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.substring(7)
  const sessionData = await env.SESSIONS.get(token)

  if (!sessionData) {
    return null
  }

  const session = JSON.parse(sessionData)
  return session.user_id
}

// Generate UUID v4
function generateId(): string {
  return crypto.randomUUID()
}

// Generate invite token (inv_ + 12 random chars)
function generateInviteToken(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  const randomBytes = new Uint8Array(12)
  crypto.getRandomValues(randomBytes)

  const token = Array.from(randomBytes)
    .map(byte => chars[byte % chars.length])
    .join('')

  return `inv_${token}`
}

// Check if user can manage invites (owner or admin)
async function canManageInvites(env: Env, workspaceId: string, userId: number): Promise<boolean> {
  // Check if owner
  const workspace = await env.DB.prepare(`
    SELECT owner_id FROM workspaces WHERE id = ?
  `).bind(workspaceId).first()

  if (!workspace) return false
  if (workspace.owner_id === userId) return true

  // Check if admin member
  const member = await env.DB.prepare(`
    SELECT role FROM workspace_members
    WHERE workspace_id = ? AND user_id = ?
  `).bind(workspaceId, userId).first()

  return member?.role === 'ADMIN'
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  const url = new URL(request.url)
  const method = request.method

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }

  if (method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // ============================================================
    // POST /api/workspaces/:workspace_id/invites - Create invite
    // ============================================================
    const createMatch = url.pathname.match(/^\/api\/workspaces\/([^\/]+)\/invites$/)
    if (method === 'POST' && createMatch) {
      const workspaceId = createMatch[1]
      const userId = await getUserFromRequest(request, env)

      if (!userId) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Check permissions
      if (!await canManageInvites(env, workspaceId, userId)) {
        return new Response(
          JSON.stringify({ error: 'Only workspace owner or admins can create invites' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const body = await request.json() as any

      // Validate role
      if (!['ADMIN', 'EDITOR', 'VIEWER'].includes(body.default_role || 'VIEWER')) {
        return new Response(
          JSON.stringify({ error: 'Invalid role' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Calculate expiry
      let expiresAt = null
      if (body.expires_in_hours) {
        const expiryDate = new Date()
        expiryDate.setHours(expiryDate.getHours() + body.expires_in_hours)
        expiresAt = expiryDate.toISOString()
      }

      const inviteId = generateId()
      const inviteToken = generateInviteToken()
      const now = new Date().toISOString()

      await env.DB.prepare(`
        INSERT INTO workspace_invites (
          id, workspace_id, created_by_id, invite_token,
          default_role, max_uses, expires_at, label, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        inviteId,
        workspaceId,
        userId,
        inviteToken,
        body.default_role || 'VIEWER',
        body.max_uses || null,
        expiresAt,
        body.label || null,
        now
      ).run()

      const invite = await env.DB.prepare(`
        SELECT * FROM workspace_invites WHERE id = ?
      `).bind(inviteId).first()

      // Build invite URL
      const baseUrl = url.origin
      const inviteUrl = `${baseUrl}/invite/${inviteToken}`

      return new Response(
        JSON.stringify({
          ...invite,
          invite_url: inviteUrl,
          is_active: Boolean(invite.is_active)
        }),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ============================================================
    // GET /api/workspaces/:workspace_id/invites - List invites
    // ============================================================
    if (method === 'GET' && createMatch) {
      const workspaceId = createMatch[1]
      const userId = await getUserFromRequest(request, env)

      if (!userId) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Check permissions
      if (!await canManageInvites(env, workspaceId, userId)) {
        return new Response(
          JSON.stringify({ error: 'Access denied' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const { results } = await env.DB.prepare(`
        SELECT
          wi.*,
          u.username as created_by_username,
          wm.nickname as created_by_nickname
        FROM workspace_invites wi
        JOIN users u ON wi.created_by_id = u.id
        LEFT JOIN workspace_members wm ON wm.workspace_id = wi.workspace_id AND wm.user_id = wi.created_by_id
        WHERE wi.workspace_id = ?
        ORDER BY wi.created_at DESC
      `).bind(workspaceId).all()

      const baseUrl = url.origin
      const invites = results.map(inv => ({
        ...inv,
        invite_url: `${baseUrl}/invite/${inv.invite_token}`,
        is_active: Boolean(inv.is_active),
        created_by: {
          id: inv.created_by_id,
          username: inv.created_by_username,
          nickname: inv.created_by_nickname || inv.created_by_username
        }
      }))

      return new Response(
        JSON.stringify({ invites }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ============================================================
    // DELETE /api/workspaces/:workspace_id/invites/:invite_id - Revoke
    // ============================================================
    const revokeMatch = url.pathname.match(/^\/api\/workspaces\/([^\/]+)\/invites\/([^\/]+)$/)
    if (method === 'DELETE' && revokeMatch) {
      const [, workspaceId, inviteId] = revokeMatch
      const userId = await getUserFromRequest(request, env)

      if (!userId) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Check permissions
      if (!await canManageInvites(env, workspaceId, userId)) {
        return new Response(
          JSON.stringify({ error: 'Access denied' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const now = new Date().toISOString()

      await env.DB.prepare(`
        UPDATE workspace_invites
        SET is_active = 0, revoked_at = ?, revoked_by_id = ?
        WHERE id = ? AND workspace_id = ?
      `).bind(now, userId, inviteId, workspaceId).run()

      return new Response(
        JSON.stringify({
          message: 'Invite revoked successfully',
          revoked_at: now
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ============================================================
    // GET /api/invites/:invite_token - Get invite info (public)
    // ============================================================
    const infoMatch = url.pathname.match(/^\/api\/invites\/([^\/]+)$/)
    if (method === 'GET' && infoMatch) {
      const inviteToken = infoMatch[1]

      const invite = await env.DB.prepare(`
        SELECT
          wi.*,
          w.id as workspace_id,
          w.name as workspace_name,
          w.type as workspace_type,
          wm.nickname as owner_nickname,
          u.username as owner_username
        FROM workspace_invites wi
        JOIN workspaces w ON wi.workspace_id = w.id
        JOIN users u ON w.owner_id = u.id
        LEFT JOIN workspace_members wm ON wm.workspace_id = w.id AND wm.user_id = w.owner_id
        WHERE wi.invite_token = ?
      `).bind(inviteToken).first()

      if (!invite) {
        return new Response(
          JSON.stringify({ error: 'Invite not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Check if valid
      const now = new Date()
      const isExpired = invite.expires_at && new Date(invite.expires_at) < now
      const isMaxUsesReached = invite.max_uses && invite.current_uses >= invite.max_uses
      const isValid = invite.is_active && !isExpired && !isMaxUsesReached

      // Calculate uses remaining
      let usesRemaining = null
      if (invite.max_uses) {
        usesRemaining = Math.max(0, invite.max_uses - invite.current_uses)
      }

      return new Response(
        JSON.stringify({
          workspace: {
            id: invite.workspace_id,
            name: invite.workspace_name,
            type: invite.workspace_type,
            owner_nickname: invite.owner_nickname || invite.owner_username
          },
          invite: {
            default_role: invite.default_role,
            expires_at: invite.expires_at,
            label: invite.label,
            is_valid: isValid,
            uses_remaining: usesRemaining,
            is_expired: isExpired,
            is_max_uses_reached: isMaxUsesReached
          }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ============================================================
    // POST /api/invites/:invite_token/accept - Accept invite
    // ============================================================
    const acceptMatch = url.pathname.match(/^\/api\/invites\/([^\/]+)\/accept$/)
    if (method === 'POST' && acceptMatch) {
      const inviteToken = acceptMatch[1]
      const userId = await getUserFromRequest(request, env)

      if (!userId) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized - must be logged in to accept invite' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const body = await request.json() as any

      if (!body.nickname || body.nickname.trim().length === 0) {
        return new Response(
          JSON.stringify({ error: 'Nickname is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Get invite with workspace info
      const invite = await env.DB.prepare(`
        SELECT * FROM workspace_invites WHERE invite_token = ?
      `).bind(inviteToken).first()

      if (!invite) {
        return new Response(
          JSON.stringify({ error: 'Invite not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Validate invite
      const now = new Date()
      const isExpired = invite.expires_at && new Date(invite.expires_at as string) < now
      const isMaxUsesReached = invite.max_uses && invite.current_uses >= invite.max_uses

      if (!invite.is_active) {
        return new Response(
          JSON.stringify({ error: 'This invite has been revoked' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (isExpired) {
        return new Response(
          JSON.stringify({ error: 'This invite has expired' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (isMaxUsesReached) {
        return new Response(
          JSON.stringify({ error: 'This invite has reached maximum uses' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Check if already a member
      const existingMember = await env.DB.prepare(`
        SELECT id FROM workspace_members
        WHERE workspace_id = ? AND user_id = ?
      `).bind(invite.workspace_id, userId).first()

      if (existingMember) {
        return new Response(
          JSON.stringify({ error: 'You are already a member of this workspace' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Create member
      const memberId = generateId()
      const joinedAt = new Date().toISOString()

      await env.DB.prepare(`
        INSERT INTO workspace_members (
          id, workspace_id, user_id, role, nickname, joined_via_invite_id, joined_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        memberId,
        invite.workspace_id,
        userId,
        invite.default_role,
        body.nickname.trim(),
        invite.id,
        joinedAt
      ).run()

      // Increment invite usage
      await env.DB.prepare(`
        UPDATE workspace_invites
        SET current_uses = current_uses + 1
        WHERE id = ?
      `).bind(invite.id).run()

      // Track usage for analytics
      const usageId = generateId()
      await env.DB.prepare(`
        INSERT INTO workspace_invite_uses (
          id, invite_id, user_id, workspace_member_id, nickname_used, used_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        usageId,
        invite.id,
        userId,
        memberId,
        body.nickname.trim(),
        joinedAt
      ).run()

      return new Response(
        JSON.stringify({
          workspace_id: invite.workspace_id,
          member_id: memberId,
          role: invite.default_role,
          nickname: body.nickname.trim(),
          joined_at: joinedAt
        }),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Workspace Invites API error:', error)
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}
