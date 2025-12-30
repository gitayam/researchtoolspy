/**
 * Places API
 * Manages places (facilities, cities, regions, installations) with geographic coordinates
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

    // GET /api/places?workspace_id=xxx
    if (method === 'GET' && url.pathname === '/api/places') {
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

      let query = `SELECT * FROM places WHERE workspace_id = ?`
      const params: any[] = [workspaceId]

      const placeType = url.searchParams.get('place_type')
      if (placeType) {
        query += ` AND place_type = ?`
        params.push(placeType)
      }

      const country = url.searchParams.get('country')
      if (country) {
        query += ` AND country = ?`
        params.push(country)
      }

      const importance = url.searchParams.get('strategic_importance')
      if (importance) {
        query += ` AND strategic_importance = ?`
        params.push(importance)
      }

      const search = url.searchParams.get('search')
      if (search) {
        query += ` AND (name LIKE ? OR description LIKE ? OR address LIKE ?)`
        params.push(`%${search}%`, `%${search}%`, `%${search}%`)
      }

      query += ` ORDER BY created_at DESC`

      const limit = url.searchParams.get('limit')
      if (limit) {
        query += ` LIMIT ?`
        params.push(parseInt(limit))
      }

      const { results } = await env.DB.prepare(query).bind(...params).all()

      const places = results.map(p => ({
        ...p,
        coordinates: p.coordinates ? JSON.parse(p.coordinates as string) : null,
        is_public: Boolean(p.is_public)
      }))

      return new Response(
        JSON.stringify(places),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // POST /api/places
    if (method === 'POST' && url.pathname === '/api/places') {
      const body = await request.json() as any

      if (!body.name || !body.place_type || !body.coordinates || !body.workspace_id) {
        return new Response(
          JSON.stringify({ error: 'Missing required fields: name, place_type, coordinates, workspace_id' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (!body.coordinates.lat || !body.coordinates.lng) {
        return new Response(
          JSON.stringify({ error: 'Coordinates must include lat and lng' }),
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
        INSERT INTO places (
          id, name, description, place_type,
          coordinates, address, country, region,
          strategic_importance, controlled_by,
          workspace_id, created_by, created_at, updated_at,
          is_public, votes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id,
        body.name,
        body.description || null,
        body.place_type,
        JSON.stringify(body.coordinates),
        body.address || null,
        body.country || null,
        body.region || null,
        body.strategic_importance || null,
        body.controlled_by || null,
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
          '$.places',
          COALESCE(json_extract(entity_count, '$.places'), 0) + 1
        ),
        updated_at = ?
        WHERE id = ?
      `).bind(now, body.workspace_id).run()

      const place = await env.DB.prepare(`
        SELECT * FROM places WHERE id = ?
      `).bind(id).first()

      return new Response(
        JSON.stringify({
          ...place,
          coordinates: place.coordinates ? JSON.parse(place.coordinates as string) : null,
          is_public: Boolean(place.is_public)
        }),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Place ID routes
    const placeMatch = url.pathname.match(/^\/api\/places\/([^\/]+)$/)

    // GET /api/places/:id
    if (method === 'GET' && placeMatch) {
      const placeId = placeMatch[1]

      const place = await env.DB.prepare(`
        SELECT * FROM places WHERE id = ?
      `).bind(placeId).first()

      if (!place) {
        return new Response(
          JSON.stringify({ error: 'Place not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (!(await checkWorkspaceAccess(place.workspace_id as string, userId, env))) {
        return new Response(
          JSON.stringify({ error: 'Access denied' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Get controlling actor if present
      let controllingActor = null
      if (place.controlled_by) {
        controllingActor = await env.DB.prepare(`
          SELECT * FROM actors WHERE id = ?
        `).bind(place.controlled_by).first()

        if (controllingActor) {
          controllingActor = {
            ...controllingActor,
            aliases: controllingActor.aliases ? JSON.parse(controllingActor.aliases as string) : [],
            deception_profile: controllingActor.deception_profile ? JSON.parse(controllingActor.deception_profile as string) : null,
            is_public: Boolean(controllingActor.is_public)
          }
        }
      }

      // Get events at this location
      const { results: events } = await env.DB.prepare(`
        SELECT * FROM events WHERE location_id = ?
        ORDER BY date_start DESC
      `).bind(placeId).all()

      return new Response(
        JSON.stringify({
          ...place,
          coordinates: place.coordinates ? JSON.parse(place.coordinates as string) : null,
          is_public: Boolean(place.is_public),
          controlling_actor: controllingActor,
          events: events.map(e => ({
            ...e,
            coordinates: e.coordinates ? JSON.parse(e.coordinates as string) : null,
            is_public: Boolean(e.is_public)
          })),
          event_count: events.length
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // PUT /api/places/:id
    if (method === 'PUT' && placeMatch) {
      const placeId = placeMatch[1]
      const body = await request.json() as any

      const place = await env.DB.prepare(`
        SELECT workspace_id FROM places WHERE id = ?
      `).bind(placeId).first()

      if (!place) {
        return new Response(
          JSON.stringify({ error: 'Place not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (!(await checkWorkspaceAccess(place.workspace_id as string, userId, env, 'EDITOR'))) {
        return new Response(
          JSON.stringify({ error: 'Insufficient permissions' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const now = new Date().toISOString()

      await env.DB.prepare(`
        UPDATE places
        SET name = ?,
            description = ?,
            place_type = ?,
            coordinates = ?,
            address = ?,
            country = ?,
            region = ?,
            strategic_importance = ?,
            controlled_by = ?,
            is_public = ?,
            updated_at = ?
        WHERE id = ?
      `).bind(
        body.name,
        body.description || null,
        body.place_type,
        body.coordinates ? JSON.stringify(body.coordinates) : null,
        body.address || null,
        body.country || null,
        body.region || null,
        body.strategic_importance || null,
        body.controlled_by || null,
        body.is_public ? 1 : 0,
        now,
        placeId
      ).run()

      const updated = await env.DB.prepare(`
        SELECT * FROM places WHERE id = ?
      `).bind(placeId).first()

      return new Response(
        JSON.stringify({
          ...updated,
          coordinates: updated.coordinates ? JSON.parse(updated.coordinates as string) : null,
          is_public: Boolean(updated.is_public)
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // DELETE /api/places/:id
    if (method === 'DELETE' && placeMatch) {
      const placeId = placeMatch[1]

      const place = await env.DB.prepare(`
        SELECT workspace_id FROM places WHERE id = ?
      `).bind(placeId).first()

      if (!place) {
        return new Response(
          JSON.stringify({ error: 'Place not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (!(await checkWorkspaceAccess(place.workspace_id as string, userId, env, 'EDITOR'))) {
        return new Response(
          JSON.stringify({ error: 'Insufficient permissions' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      await env.DB.prepare(`
        DELETE FROM places WHERE id = ?
      `).bind(placeId).run()

      const now = new Date().toISOString()
      await env.DB.prepare(`
        UPDATE workspaces
        SET entity_count = json_set(
          COALESCE(entity_count, '{}'),
          '$.places',
          MAX(0, COALESCE(json_extract(entity_count, '$.places'), 0) - 1)
        ),
        updated_at = ?
        WHERE id = ?
      `).bind(now, place.workspace_id).run()

      return new Response(
        JSON.stringify({ message: 'Place deleted successfully' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Places API error:', error)
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}
