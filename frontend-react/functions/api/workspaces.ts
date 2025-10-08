/**
 * Workspaces API
 * Manages personal, team, and public workspaces
 */

import type { PagesFunction } from '@cloudflare/workers-types'

interface Env {
  DB: D1Database
  SESSIONS: KVNamespace
}

// Helper to get user from session or hash
async function getUserFromRequest(request: Request, env: Env): Promise<{ userId?: number; userHash?: string }> {
  // Try bearer token first (authenticated users)
  const authHeader = request.headers.get('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7)
    const sessionData = await env.SESSIONS.get(token)
    if (sessionData) {
      const session = JSON.parse(sessionData)
      return { userId: session.user_id }
    }
  }

  // Fall back to hash-based auth (guest mode)
  const userHash = request.headers.get('X-User-Hash')
  if (userHash && userHash !== 'guest') {
    return { userHash }
  }

  return {}
}

// Generate UUID v4
function generateId(): string {
  return crypto.randomUUID()
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  const url = new URL(request.url)
  const method = request.method

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash',
  }

  if (method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Get authenticated user (supports both token and hash auth)
    const user = await getUserFromRequest(request, env)
    if (!user.userId && !user.userHash) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Please log in or create a bookmark account' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // GET /api/workspaces - List user's workspaces
    if (method === 'GET' && url.pathname === '/api/workspaces') {
      // Get or create user ID for hash-based users
      let userId = user.userId
      if (!userId && user.userHash) {
        const existingUser = await env.DB.prepare(`
          SELECT id FROM users WHERE user_hash = ?
        `).bind(user.userHash).first()

        if (existingUser) {
          userId = existingUser.id as number
        }
        // If no user exists yet, return empty workspaces (will be created on first workspace creation)
        if (!userId) {
          return new Response(
            JSON.stringify({ owned: [], member: [] }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      }

      const { results: ownedWorkspaces } = await env.DB.prepare(`
        SELECT * FROM workspaces
        WHERE owner_id = ?
        ORDER BY created_at DESC
      `).bind(userId).all()

      const { results: memberWorkspaces } = await env.DB.prepare(`
        SELECT w.*, wm.role
        FROM workspaces w
        JOIN workspace_members wm ON w.id = wm.workspace_id
        WHERE wm.user_id = ?
        ORDER BY w.created_at DESC
      `).bind(userId).all()

      // Parse JSON fields
      const parseWorkspace = (w: any) => ({
        ...w,
        entity_count: w.entity_count ? JSON.parse(w.entity_count) : {
          actors: 0, sources: 0, evidence: 0, events: 0, places: 0, behaviors: 0
        },
        is_public: Boolean(w.is_public),
        allow_cloning: Boolean(w.allow_cloning)
      })

      return new Response(
        JSON.stringify({
          owned: ownedWorkspaces.map(parseWorkspace),
          member: memberWorkspaces.map(parseWorkspace)
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // POST /api/workspaces - Create new workspace
    if (method === 'POST' && url.pathname === '/api/workspaces') {
      const body = await request.json() as any

      if (!body.name || !body.type) {
        return new Response(
          JSON.stringify({ error: 'Missing required fields: name, type' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (!['PERSONAL', 'TEAM', 'PUBLIC'].includes(body.type)) {
        return new Response(
          JSON.stringify({ error: 'Invalid workspace type' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // For hash-based users, create or get user record
      let ownerId = user.userId
      if (!ownerId && user.userHash) {
        // Check if user exists with this hash
        const existingUser = await env.DB.prepare(`
          SELECT id FROM users WHERE user_hash = ?
        `).bind(user.userHash).first()

        if (existingUser) {
          ownerId = existingUser.id as number
        } else {
          // Create new user with hash
          // For hash-based users, generate unique username and provide default values
          const userResult = await env.DB.prepare(`
            INSERT INTO users (username, email, user_hash, full_name, hashed_password, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
          `).bind(
            `guest_${user.userHash.substring(0, 8)}`,  // Unique username
            `${user.userHash.substring(0, 8)}@guest.local`,  // Placeholder email
            user.userHash,
            'Guest User',  // Default full name
            '',  // No password for hash-based users
            new Date().toISOString()
          ).run()
          ownerId = Number(userResult.meta.last_row_id)
        }
      }

      const id = generateId()
      const now = new Date().toISOString()
      const entityCount = JSON.stringify({
        actors: 0, sources: 0, evidence: 0, events: 0, places: 0, behaviors: 0
      })

      await env.DB.prepare(`
        INSERT INTO workspaces (
          id, name, description, type, owner_id,
          is_public, allow_cloning, entity_count,
          votes, stars, forks, views,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id,
        body.name,
        body.description || null,
        body.type,
        ownerId,
        body.is_public ? 1 : 0,
        body.allow_cloning !== false ? 1 : 0,
        entityCount,
        0, 0, 0, 0,
        now, now
      ).run()

      const workspace = await env.DB.prepare(`
        SELECT * FROM workspaces WHERE id = ?
      `).bind(id).first()

      return new Response(
        JSON.stringify({
          ...workspace,
          entity_count: JSON.parse(workspace.entity_count as string),
          is_public: Boolean(workspace.is_public),
          allow_cloning: Boolean(workspace.allow_cloning)
        }),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // GET /api/workspaces/:id - Get workspace details
    const workspaceMatch = url.pathname.match(/^\/api\/workspaces\/([^\/]+)$/)
    if (method === 'GET' && workspaceMatch) {
      const workspaceId = workspaceMatch[1]

      const workspace = await env.DB.prepare(`
        SELECT * FROM workspaces WHERE id = ?
      `).bind(workspaceId).first()

      if (!workspace) {
        return new Response(
          JSON.stringify({ error: 'Workspace not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Get user ID for access check
      let userId = user.userId
      if (!userId && user.userHash) {
        const existingUser = await env.DB.prepare(`
          SELECT id FROM users WHERE user_hash = ?
        `).bind(user.userHash).first()
        if (existingUser) {
          userId = existingUser.id as number
        }
      }

      // Check access
      const isOwner = workspace.owner_id === userId
      const isMember = userId ? await env.DB.prepare(`
        SELECT 1 FROM workspace_members
        WHERE workspace_id = ? AND user_id = ?
      `).bind(workspaceId, userId).first() : null

      if (!isOwner && !isMember && !workspace.is_public) {
        return new Response(
          JSON.stringify({ error: 'Access denied' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Get members if owner or admin
      let members = []
      if (isOwner || isMember) {
        const { results } = await env.DB.prepare(`
          SELECT wm.*, u.username, u.full_name, u.email
          FROM workspace_members wm
          JOIN users u ON wm.user_id = u.id
          WHERE wm.workspace_id = ?
        `).bind(workspaceId).all()

        members = results.map(m => ({
          ...m,
          permissions: m.permissions ? JSON.parse(m.permissions) : []
        }))
      }

      return new Response(
        JSON.stringify({
          ...workspace,
          entity_count: JSON.parse(workspace.entity_count as string),
          is_public: Boolean(workspace.is_public),
          allow_cloning: Boolean(workspace.allow_cloning),
          members
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // PUT /api/workspaces/:id - Update workspace
    if (method === 'PUT' && workspaceMatch) {
      const workspaceId = workspaceMatch[1]
      const body = await request.json() as any

      const workspace = await env.DB.prepare(`
        SELECT * FROM workspaces WHERE id = ?
      `).bind(workspaceId).first()

      if (!workspace) {
        return new Response(
          JSON.stringify({ error: 'Workspace not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Get user ID for permission check
      let userId = user.userId
      if (!userId && user.userHash) {
        const existingUser = await env.DB.prepare(`
          SELECT id FROM users WHERE user_hash = ?
        `).bind(user.userHash).first()
        if (existingUser) {
          userId = existingUser.id as number
        }
      }

      // Only owner or admin can update
      const isOwner = workspace.owner_id === userId
      const member = userId ? await env.DB.prepare(`
        SELECT role FROM workspace_members
        WHERE workspace_id = ? AND user_id = ?
      `).bind(workspaceId, userId).first() : null

      if (!isOwner && (!member || member.role !== 'ADMIN')) {
        return new Response(
          JSON.stringify({ error: 'Access denied' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const now = new Date().toISOString()

      await env.DB.prepare(`
        UPDATE workspaces
        SET name = ?, description = ?, is_public = ?,
            allow_cloning = ?, updated_at = ?
        WHERE id = ?
      `).bind(
        body.name || workspace.name,
        body.description !== undefined ? body.description : workspace.description,
        body.is_public !== undefined ? (body.is_public ? 1 : 0) : workspace.is_public,
        body.allow_cloning !== undefined ? (body.allow_cloning ? 1 : 0) : workspace.allow_cloning,
        now,
        workspaceId
      ).run()

      const updated = await env.DB.prepare(`
        SELECT * FROM workspaces WHERE id = ?
      `).bind(workspaceId).first()

      return new Response(
        JSON.stringify({
          ...updated,
          entity_count: JSON.parse(updated.entity_count as string),
          is_public: Boolean(updated.is_public),
          allow_cloning: Boolean(updated.allow_cloning)
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // DELETE /api/workspaces/:id - Delete workspace
    if (method === 'DELETE' && workspaceMatch) {
      const workspaceId = workspaceMatch[1]

      const workspace = await env.DB.prepare(`
        SELECT owner_id FROM workspaces WHERE id = ?
      `).bind(workspaceId).first()

      if (!workspace) {
        return new Response(
          JSON.stringify({ error: 'Workspace not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Get user ID for ownership check
      let userId = user.userId
      if (!userId && user.userHash) {
        const existingUser = await env.DB.prepare(`
          SELECT id FROM users WHERE user_hash = ?
        `).bind(user.userHash).first()
        if (existingUser) {
          userId = existingUser.id as number
        }
      }

      // Only owner can delete
      if (workspace.owner_id !== userId) {
        return new Response(
          JSON.stringify({ error: 'Only workspace owner can delete' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      await env.DB.prepare(`
        DELETE FROM workspaces WHERE id = ?
      `).bind(workspaceId).run()

      return new Response(
        JSON.stringify({ message: 'Workspace deleted successfully' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Workspace members management
    const membersMatch = url.pathname.match(/^\/api\/workspaces\/([^\/]+)\/members$/)

    // GET /api/workspaces/:id/members
    if (method === 'GET' && membersMatch) {
      const workspaceId = membersMatch[1]

      const { results } = await env.DB.prepare(`
        SELECT wm.*, u.username, u.full_name, u.email
        FROM workspace_members wm
        JOIN users u ON wm.user_id = u.id
        WHERE wm.workspace_id = ?
      `).bind(workspaceId).all()

      return new Response(
        JSON.stringify(results.map(m => ({
          ...m,
          permissions: m.permissions ? JSON.parse(m.permissions) : []
        }))),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // POST /api/workspaces/:id/members - Add member
    if (method === 'POST' && membersMatch) {
      const workspaceId = membersMatch[1]
      const body = await request.json() as any

      if (!body.user_id || !body.role) {
        return new Response(
          JSON.stringify({ error: 'Missing required fields: user_id, role' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Check if requester is owner or admin
      const workspace = await env.DB.prepare(`
        SELECT owner_id FROM workspaces WHERE id = ?
      `).bind(workspaceId).first()

      if (!workspace) {
        return new Response(
          JSON.stringify({ error: 'Workspace not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Get user ID for permission check
      let userId = user.userId
      if (!userId && user.userHash) {
        const existingUser = await env.DB.prepare(`
          SELECT id FROM users WHERE user_hash = ?
        `).bind(user.userHash).first()
        if (existingUser) {
          userId = existingUser.id as number
        }
      }

      const isOwner = workspace.owner_id === userId
      const member = userId ? await env.DB.prepare(`
        SELECT role FROM workspace_members
        WHERE workspace_id = ? AND user_id = ?
      `).bind(workspaceId, userId).first() : null

      if (!isOwner && (!member || member.role !== 'ADMIN')) {
        return new Response(
          JSON.stringify({ error: 'Access denied' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const id = generateId()
      const now = new Date().toISOString()

      await env.DB.prepare(`
        INSERT INTO workspace_members (
          id, workspace_id, user_id, role, permissions, joined_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        id,
        workspaceId,
        body.user_id,
        body.role,
        body.permissions ? JSON.stringify(body.permissions) : null,
        now
      ).run()

      return new Response(
        JSON.stringify({ message: 'Member added successfully', id }),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Workspaces API error:', error)
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}
