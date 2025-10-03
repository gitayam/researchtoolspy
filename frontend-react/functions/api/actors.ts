/**
 * Actors API
 * Manages actors (people, organizations, units, governments) with MOM-POP deception assessment
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

// Check workspace access
async function checkWorkspaceAccess(
  workspaceId: string,
  userId: number,
  env: Env,
  requiredRole?: 'ADMIN' | 'EDITOR' | 'VIEWER'
): Promise<boolean> {
  const workspace = await env.DB.prepare(`
    SELECT owner_id, is_public FROM workspaces WHERE id = ?
  `).bind(workspaceId).first()

  if (!workspace) {
    return false
  }

  // Owner has full access
  if (workspace.owner_id === userId) {
    return true
  }

  // Check member access
  const member = await env.DB.prepare(`
    SELECT role FROM workspace_members
    WHERE workspace_id = ? AND user_id = ?
  `).bind(workspaceId, userId).first()

  if (member) {
    if (!requiredRole) return true
    if (requiredRole === 'VIEWER') return true
    if (requiredRole === 'EDITOR' && (member.role === 'EDITOR' || member.role === 'ADMIN')) return true
    if (requiredRole === 'ADMIN' && member.role === 'ADMIN') return true
  }

  // Public workspaces allow read access
  if (workspace.is_public && (!requiredRole || requiredRole === 'VIEWER')) {
    return true
  }

  return false
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
    // Get authenticated user
    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // GET /api/actors?workspace_id=xxx - List actors
    if (method === 'GET' && url.pathname === '/api/actors') {
      const workspaceId = url.searchParams.get('workspace_id')
      if (!workspaceId) {
        return new Response(
          JSON.stringify({ error: 'workspace_id parameter required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Check access
      if (!(await checkWorkspaceAccess(workspaceId, userId, env))) {
        return new Response(
          JSON.stringify({ error: 'Access denied to workspace' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Build query with filters
      let query = `SELECT * FROM actors WHERE workspace_id = ?`
      const params = [workspaceId]

      const type = url.searchParams.get('type')
      if (type) {
        query += ` AND type = ?`
        params.push(type)
      }

      const search = url.searchParams.get('search')
      if (search) {
        query += ` AND (name LIKE ? OR description LIKE ?)`
        params.push(`%${search}%`, `%${search}%`)
      }

      query += ` ORDER BY created_at DESC`

      const limit = url.searchParams.get('limit')
      if (limit) {
        query += ` LIMIT ?`
        params.push(parseInt(limit))
      }

      const { results } = await env.DB.prepare(query).bind(...params).all()

      // Parse JSON fields
      const actors = results.map(a => ({
        ...a,
        aliases: a.aliases ? JSON.parse(a.aliases as string) : [],
        deception_profile: a.deception_profile ? JSON.parse(a.deception_profile as string) : null,
        is_public: Boolean(a.is_public)
      }))

      return new Response(
        JSON.stringify(actors),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // POST /api/actors - Create actor
    if (method === 'POST' && url.pathname === '/api/actors') {
      const body = await request.json() as any

      if (!body.name || !body.type || !body.workspace_id) {
        return new Response(
          JSON.stringify({ error: 'Missing required fields: name, type, workspace_id' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Check edit access
      if (!(await checkWorkspaceAccess(body.workspace_id, userId, env, 'EDITOR'))) {
        return new Response(
          JSON.stringify({ error: 'Insufficient permissions' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const id = generateId()
      const now = new Date().toISOString()

      await env.DB.prepare(`
        INSERT INTO actors (
          id, type, name, aliases, description,
          category, role, affiliation,
          deception_profile,
          causeway_analysis_id, cog_analysis_id,
          workspace_id, created_by, created_at, updated_at,
          is_public, votes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id,
        body.type,
        body.name,
        body.aliases ? JSON.stringify(body.aliases) : null,
        body.description || null,
        body.category || null,
        body.role || null,
        body.affiliation || null,
        body.deception_profile ? JSON.stringify(body.deception_profile) : null,
        body.causeway_analysis_id || null,
        body.cog_analysis_id || null,
        body.workspace_id,
        userId,
        now,
        now,
        body.is_public ? 1 : 0,
        0
      ).run()

      // Update workspace entity count
      await env.DB.prepare(`
        UPDATE workspaces
        SET entity_count = json_set(
          COALESCE(entity_count, '{}'),
          '$.actors',
          COALESCE(json_extract(entity_count, '$.actors'), 0) + 1
        ),
        updated_at = ?
        WHERE id = ?
      `).bind(now, body.workspace_id).run()

      const actor = await env.DB.prepare(`
        SELECT * FROM actors WHERE id = ?
      `).bind(id).first()

      return new Response(
        JSON.stringify({
          ...actor,
          aliases: actor.aliases ? JSON.parse(actor.aliases as string) : [],
          deception_profile: actor.deception_profile ? JSON.parse(actor.deception_profile as string) : null,
          is_public: Boolean(actor.is_public)
        }),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Actor ID routes
    const actorMatch = url.pathname.match(/^\/api\/actors\/([^\/]+)$/)

    // GET /api/actors/:id
    if (method === 'GET' && actorMatch) {
      const actorId = actorMatch[1]

      const actor = await env.DB.prepare(`
        SELECT * FROM actors WHERE id = ?
      `).bind(actorId).first()

      if (!actor) {
        return new Response(
          JSON.stringify({ error: 'Actor not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Check access
      if (!(await checkWorkspaceAccess(actor.workspace_id as string, userId, env))) {
        return new Response(
          JSON.stringify({ error: 'Access denied' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Get related entities count
      const { results: eventsCount } = await env.DB.prepare(`
        SELECT COUNT(*) as count FROM actor_events WHERE actor_id = ?
      `).bind(actorId).all()

      const { results: evidenceCount } = await env.DB.prepare(`
        SELECT COUNT(*) as count FROM evidence_actors WHERE actor_id = ?
      `).bind(actorId).all()

      const { results: behaviorsCount } = await env.DB.prepare(`
        SELECT COUNT(*) as count FROM actor_behaviors WHERE actor_id = ?
      `).bind(actorId).all()

      const { results: relationshipsCount } = await env.DB.prepare(`
        SELECT COUNT(*) as count FROM relationships
        WHERE source_entity_id = ? OR target_entity_id = ?
      `).bind(actorId, actorId).all()

      return new Response(
        JSON.stringify({
          ...actor,
          aliases: actor.aliases ? JSON.parse(actor.aliases as string) : [],
          deception_profile: actor.deception_profile ? JSON.parse(actor.deception_profile as string) : null,
          is_public: Boolean(actor.is_public),
          related_counts: {
            events: eventsCount[0]?.count || 0,
            evidence: evidenceCount[0]?.count || 0,
            behaviors: behaviorsCount[0]?.count || 0,
            relationships: relationshipsCount[0]?.count || 0
          }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // PUT /api/actors/:id - Update actor
    if (method === 'PUT' && actorMatch) {
      const actorId = actorMatch[1]
      const body = await request.json() as any

      const actor = await env.DB.prepare(`
        SELECT workspace_id FROM actors WHERE id = ?
      `).bind(actorId).first()

      if (!actor) {
        return new Response(
          JSON.stringify({ error: 'Actor not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Check edit access
      if (!(await checkWorkspaceAccess(actor.workspace_id as string, userId, env, 'EDITOR'))) {
        return new Response(
          JSON.stringify({ error: 'Insufficient permissions' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const now = new Date().toISOString()

      await env.DB.prepare(`
        UPDATE actors
        SET name = ?,
            aliases = ?,
            description = ?,
            category = ?,
            role = ?,
            affiliation = ?,
            deception_profile = ?,
            causeway_analysis_id = ?,
            cog_analysis_id = ?,
            is_public = ?,
            updated_at = ?
        WHERE id = ?
      `).bind(
        body.name,
        body.aliases ? JSON.stringify(body.aliases) : null,
        body.description || null,
        body.category || null,
        body.role || null,
        body.affiliation || null,
        body.deception_profile ? JSON.stringify(body.deception_profile) : null,
        body.causeway_analysis_id || null,
        body.cog_analysis_id || null,
        body.is_public ? 1 : 0,
        now,
        actorId
      ).run()

      const updated = await env.DB.prepare(`
        SELECT * FROM actors WHERE id = ?
      `).bind(actorId).first()

      return new Response(
        JSON.stringify({
          ...updated,
          aliases: updated.aliases ? JSON.parse(updated.aliases as string) : [],
          deception_profile: updated.deception_profile ? JSON.parse(updated.deception_profile as string) : null,
          is_public: Boolean(updated.is_public)
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // DELETE /api/actors/:id
    if (method === 'DELETE' && actorMatch) {
      const actorId = actorMatch[1]

      const actor = await env.DB.prepare(`
        SELECT workspace_id FROM actors WHERE id = ?
      `).bind(actorId).first()

      if (!actor) {
        return new Response(
          JSON.stringify({ error: 'Actor not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Check edit access
      if (!(await checkWorkspaceAccess(actor.workspace_id as string, userId, env, 'EDITOR'))) {
        return new Response(
          JSON.stringify({ error: 'Insufficient permissions' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      await env.DB.prepare(`
        DELETE FROM actors WHERE id = ?
      `).bind(actorId).run()

      // Update workspace entity count
      const now = new Date().toISOString()
      await env.DB.prepare(`
        UPDATE workspaces
        SET entity_count = json_set(
          COALESCE(entity_count, '{}'),
          '$.actors',
          MAX(0, COALESCE(json_extract(entity_count, '$.actors'), 0) - 1)
        ),
        updated_at = ?
        WHERE id = ?
      `).bind(now, actor.workspace_id).run()

      return new Response(
        JSON.stringify({ message: 'Actor deleted successfully' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Deception assessment routes
    const deceptionMatch = url.pathname.match(/^\/api\/actors\/([^\/]+)\/deception$/)

    // GET /api/actors/:id/deception
    if (method === 'GET' && deceptionMatch) {
      const actorId = deceptionMatch[1]

      const actor = await env.DB.prepare(`
        SELECT deception_profile, workspace_id FROM actors WHERE id = ?
      `).bind(actorId).first()

      if (!actor) {
        return new Response(
          JSON.stringify({ error: 'Actor not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Check access
      if (!(await checkWorkspaceAccess(actor.workspace_id as string, userId, env))) {
        return new Response(
          JSON.stringify({ error: 'Access denied' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const deceptionProfile = actor.deception_profile
        ? JSON.parse(actor.deception_profile as string)
        : null

      return new Response(
        JSON.stringify(deceptionProfile),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // PUT /api/actors/:id/deception - Update deception assessment
    if (method === 'PUT' && deceptionMatch) {
      const actorId = deceptionMatch[1]
      const body = await request.json() as any

      const actor = await env.DB.prepare(`
        SELECT workspace_id FROM actors WHERE id = ?
      `).bind(actorId).first()

      if (!actor) {
        return new Response(
          JSON.stringify({ error: 'Actor not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Check edit access
      if (!(await checkWorkspaceAccess(actor.workspace_id as string, userId, env, 'EDITOR'))) {
        return new Response(
          JSON.stringify({ error: 'Insufficient permissions' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const deceptionProfile = {
        ...body,
        last_updated: new Date().toISOString()
      }

      const now = new Date().toISOString()
      await env.DB.prepare(`
        UPDATE actors
        SET deception_profile = ?, updated_at = ?
        WHERE id = ?
      `).bind(JSON.stringify(deceptionProfile), now, actorId).run()

      return new Response(
        JSON.stringify(deceptionProfile),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Actors API error:', error)
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}
