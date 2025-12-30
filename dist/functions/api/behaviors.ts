/**
 * Behaviors API
 * Manages behaviors (TTPs, patterns, tactics, techniques, procedures)
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

  if (workspace.owner_id === userId) {
    return true
  }

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

  if (workspace.is_public && (!requiredRole || requiredRole === 'VIEWER')) {
    return true
  }

  return false
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  const url = new URL(request.url)
  const method = request.method

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }

  if (method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // GET /api/behaviors?workspace_id=xxx
    if (method === 'GET' && url.pathname === '/api/behaviors') {
      const workspaceId = url.searchParams.get('workspace_id')
      if (!workspaceId) {
        return new Response(
          JSON.stringify({ error: 'workspace_id parameter required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (!(await checkWorkspaceAccess(workspaceId, userId, env))) {
        return new Response(
          JSON.stringify({ error: 'Access denied to workspace' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      let query = `SELECT * FROM behaviors WHERE workspace_id = ?`
      const params: any[] = [workspaceId]

      const behaviorType = url.searchParams.get('behavior_type')
      if (behaviorType) {
        query += ` AND behavior_type = ?`
        params.push(behaviorType)
      }

      const frequency = url.searchParams.get('frequency')
      if (frequency) {
        query += ` AND frequency = ?`
        params.push(frequency)
      }

      const sophistication = url.searchParams.get('sophistication')
      if (sophistication) {
        query += ` AND sophistication = ?`
        params.push(sophistication)
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

      const behaviors = results.map(b => ({
        ...b,
        indicators: b.indicators ? JSON.parse(b.indicators as string) : [],
        is_public: Boolean(b.is_public)
      }))

      return new Response(
        JSON.stringify(behaviors),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // POST /api/behaviors
    if (method === 'POST' && url.pathname === '/api/behaviors') {
      const body = await request.json() as any

      if (!body.name || !body.behavior_type || !body.workspace_id) {
        return new Response(
          JSON.stringify({ error: 'Missing required fields: name, behavior_type, workspace_id' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (!(await checkWorkspaceAccess(body.workspace_id, userId, env, 'EDITOR'))) {
        return new Response(
          JSON.stringify({ error: 'Insufficient permissions' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const id = generateId()
      const now = new Date().toISOString()

      await env.DB.prepare(`
        INSERT INTO behaviors (
          id, name, description, behavior_type,
          indicators, frequency, first_observed, last_observed,
          sophistication, effectiveness,
          behavior_analysis_id,
          workspace_id, created_by, created_at, updated_at,
          is_public, votes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id,
        body.name,
        body.description || null,
        body.behavior_type,
        body.indicators ? JSON.stringify(body.indicators) : null,
        body.frequency || null,
        body.first_observed || null,
        body.last_observed || null,
        body.sophistication || null,
        body.effectiveness || null,
        body.behavior_analysis_id || null,
        body.workspace_id,
        userId,
        now,
        now,
        body.is_public ? 1 : 0,
        0
      ).run()

      // Link actors if provided
      if (body.actor_ids && Array.isArray(body.actor_ids)) {
        for (const actorId of body.actor_ids) {
          await env.DB.prepare(`
            INSERT INTO actor_behaviors (actor_id, behavior_id, frequency, last_exhibited)
            VALUES (?, ?, ?, ?)
          `).bind(
            actorId,
            id,
            body.actor_frequencies?.[actorId] || null,
            body.actor_last_exhibited?.[actorId] || null
          ).run()
        }
      }

      // Update workspace entity count
      await env.DB.prepare(`
        UPDATE workspaces
        SET entity_count = json_set(
          COALESCE(entity_count, '{}'),
          '$.behaviors',
          COALESCE(json_extract(entity_count, '$.behaviors'), 0) + 1
        ),
        updated_at = ?
        WHERE id = ?
      `).bind(now, body.workspace_id).run()

      const behavior = await env.DB.prepare(`
        SELECT * FROM behaviors WHERE id = ?
      `).bind(id).first()

      return new Response(
        JSON.stringify({
          ...behavior,
          indicators: behavior.indicators ? JSON.parse(behavior.indicators as string) : [],
          is_public: Boolean(behavior.is_public)
        }),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Behavior ID routes
    const behaviorMatch = url.pathname.match(/^\/api\/behaviors\/([^\/]+)$/)

    // GET /api/behaviors/:id
    if (method === 'GET' && behaviorMatch) {
      const behaviorId = behaviorMatch[1]

      const behavior = await env.DB.prepare(`
        SELECT * FROM behaviors WHERE id = ?
      `).bind(behaviorId).first()

      if (!behavior) {
        return new Response(
          JSON.stringify({ error: 'Behavior not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (!(await checkWorkspaceAccess(behavior.workspace_id as string, userId, env))) {
        return new Response(
          JSON.stringify({ error: 'Access denied' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Get actors exhibiting this behavior
      const { results: actors } = await env.DB.prepare(`
        SELECT a.*, ab.frequency as actor_frequency, ab.last_exhibited
        FROM actors a
        JOIN actor_behaviors ab ON a.id = ab.actor_id
        WHERE ab.behavior_id = ?
      `).bind(behaviorId).all()

      return new Response(
        JSON.stringify({
          ...behavior,
          indicators: behavior.indicators ? JSON.parse(behavior.indicators as string) : [],
          is_public: Boolean(behavior.is_public),
          actors: actors.map(a => ({
            ...a,
            aliases: a.aliases ? JSON.parse(a.aliases as string) : [],
            deception_profile: a.deception_profile ? JSON.parse(a.deception_profile as string) : null,
            is_public: Boolean(a.is_public)
          })),
          actor_count: actors.length
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // PUT /api/behaviors/:id
    if (method === 'PUT' && behaviorMatch) {
      const behaviorId = behaviorMatch[1]
      const body = await request.json() as any

      const behavior = await env.DB.prepare(`
        SELECT workspace_id FROM behaviors WHERE id = ?
      `).bind(behaviorId).first()

      if (!behavior) {
        return new Response(
          JSON.stringify({ error: 'Behavior not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (!(await checkWorkspaceAccess(behavior.workspace_id as string, userId, env, 'EDITOR'))) {
        return new Response(
          JSON.stringify({ error: 'Insufficient permissions' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const now = new Date().toISOString()

      await env.DB.prepare(`
        UPDATE behaviors
        SET name = ?,
            description = ?,
            behavior_type = ?,
            indicators = ?,
            frequency = ?,
            first_observed = ?,
            last_observed = ?,
            sophistication = ?,
            effectiveness = ?,
            behavior_analysis_id = ?,
            is_public = ?,
            updated_at = ?
        WHERE id = ?
      `).bind(
        body.name,
        body.description || null,
        body.behavior_type,
        body.indicators ? JSON.stringify(body.indicators) : null,
        body.frequency || null,
        body.first_observed || null,
        body.last_observed || null,
        body.sophistication || null,
        body.effectiveness || null,
        body.behavior_analysis_id || null,
        body.is_public ? 1 : 0,
        now,
        behaviorId
      ).run()

      // Update actor links if provided
      if (body.actor_ids !== undefined) {
        await env.DB.prepare(`DELETE FROM actor_behaviors WHERE behavior_id = ?`).bind(behaviorId).run()
        if (Array.isArray(body.actor_ids)) {
          for (const actorId of body.actor_ids) {
            await env.DB.prepare(`
              INSERT INTO actor_behaviors (actor_id, behavior_id, frequency, last_exhibited)
              VALUES (?, ?, ?, ?)
            `).bind(
              actorId,
              behaviorId,
              body.actor_frequencies?.[actorId] || null,
              body.actor_last_exhibited?.[actorId] || null
            ).run()
          }
        }
      }

      const updated = await env.DB.prepare(`
        SELECT * FROM behaviors WHERE id = ?
      `).bind(behaviorId).first()

      return new Response(
        JSON.stringify({
          ...updated,
          indicators: updated.indicators ? JSON.parse(updated.indicators as string) : [],
          is_public: Boolean(updated.is_public)
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // DELETE /api/behaviors/:id
    if (method === 'DELETE' && behaviorMatch) {
      const behaviorId = behaviorMatch[1]

      const behavior = await env.DB.prepare(`
        SELECT workspace_id FROM behaviors WHERE id = ?
      `).bind(behaviorId).first()

      if (!behavior) {
        return new Response(
          JSON.stringify({ error: 'Behavior not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (!(await checkWorkspaceAccess(behavior.workspace_id as string, userId, env, 'EDITOR'))) {
        return new Response(
          JSON.stringify({ error: 'Insufficient permissions' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      await env.DB.prepare(`
        DELETE FROM behaviors WHERE id = ?
      `).bind(behaviorId).run()

      const now = new Date().toISOString()
      await env.DB.prepare(`
        UPDATE workspaces
        SET entity_count = json_set(
          COALESCE(entity_count, '{}'),
          '$.behaviors',
          MAX(0, COALESCE(json_extract(entity_count, '$.behaviors'), 0) - 1)
        ),
        updated_at = ?
        WHERE id = ?
      `).bind(now, behavior.workspace_id).run()

      return new Response(
        JSON.stringify({ message: 'Behavior deleted successfully' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Behaviors API error:', error)
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}
