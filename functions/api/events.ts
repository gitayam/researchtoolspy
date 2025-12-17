/**
 * Events API
 * Manages events (operations, incidents, meetings, activities) with temporal and spatial tracking
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

    // GET /api/events?workspace_id=xxx
    if (method === 'GET' && url.pathname === '/api/events') {
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

      let query = `SELECT * FROM events WHERE workspace_id = ?`
      const params: any[] = [workspaceId]

      const eventType = url.searchParams.get('event_type')
      if (eventType) {
        query += ` AND event_type = ?`
        params.push(eventType)
      }

      const significance = url.searchParams.get('significance')
      if (significance) {
        query += ` AND significance = ?`
        params.push(significance)
      }

      const dateFrom = url.searchParams.get('date_from')
      if (dateFrom) {
        query += ` AND date_start >= ?`
        params.push(dateFrom)
      }

      const dateTo = url.searchParams.get('date_to')
      if (dateTo) {
        query += ` AND date_start <= ?`
        params.push(dateTo)
      }

      const search = url.searchParams.get('search')
      if (search) {
        query += ` AND (name LIKE ? OR description LIKE ?)`
        params.push(`%${search}%`, `%${search}%`)
      }

      query += ` ORDER BY date_start DESC`

      const limit = url.searchParams.get('limit')
      if (limit) {
        query += ` LIMIT ?`
        params.push(parseInt(limit))
      }

      const { results } = await env.DB.prepare(query).bind(...params).all()

      const events = results.map(e => ({
        ...e,
        coordinates: e.coordinates ? JSON.parse(e.coordinates as string) : null,
        is_public: Boolean(e.is_public)
      }))

      return new Response(
        JSON.stringify(events),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // POST /api/events
    if (method === 'POST' && url.pathname === '/api/events') {
      const body = await request.json() as any

      if (!body.name || !body.event_type || !body.date_start || !body.workspace_id) {
        return new Response(
          JSON.stringify({ error: 'Missing required fields: name, event_type, date_start, workspace_id' }),
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

      // Calculate duration if both dates provided
      let duration = body.duration
      if (!duration && body.date_end && body.date_start) {
        const start = new Date(body.date_start).getTime()
        const end = new Date(body.date_end).getTime()
        duration = Math.floor((end - start) / (1000 * 60)) // Duration in minutes
      }

      await env.DB.prepare(`
        INSERT INTO events (
          id, name, description, event_type,
          date_start, date_end, duration,
          location_id, coordinates,
          significance, confidence,
          timeline_id,
          workspace_id, created_by, created_at, updated_at,
          is_public, votes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id,
        body.name,
        body.description || null,
        body.event_type,
        body.date_start,
        body.date_end || null,
        duration || null,
        body.location_id || null,
        body.coordinates ? JSON.stringify(body.coordinates) : null,
        body.significance || null,
        body.confidence || null,
        body.timeline_id || null,
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
            INSERT INTO actor_events (actor_id, event_id, role)
            VALUES (?, ?, ?)
          `).bind(actorId, id, body.actor_roles?.[actorId] || null).run()
        }
      }

      // Link evidence if provided
      if (body.evidence_ids && Array.isArray(body.evidence_ids)) {
        for (const evidenceId of body.evidence_ids) {
          await env.DB.prepare(`
            INSERT INTO event_evidence (event_id, evidence_id, relevance)
            VALUES (?, ?, ?)
          `).bind(id, evidenceId, body.evidence_relevance?.[evidenceId] || null).run()
        }
      }

      // Update workspace entity count
      await env.DB.prepare(`
        UPDATE workspaces
        SET entity_count = json_set(
          COALESCE(entity_count, '{}'),
          '$.events',
          COALESCE(json_extract(entity_count, '$.events'), 0) + 1
        ),
        updated_at = ?
        WHERE id = ?
      `).bind(now, body.workspace_id).run()

      const event = await env.DB.prepare(`
        SELECT * FROM events WHERE id = ?
      `).bind(id).first()

      return new Response(
        JSON.stringify({
          ...event,
          coordinates: event.coordinates ? JSON.parse(event.coordinates as string) : null,
          is_public: Boolean(event.is_public)
        }),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Event ID routes
    const eventMatch = url.pathname.match(/^\/api\/events\/([^\/]+)$/)

    // GET /api/events/:id
    if (method === 'GET' && eventMatch) {
      const eventId = eventMatch[1]

      const event = await env.DB.prepare(`
        SELECT * FROM events WHERE id = ?
      `).bind(eventId).first()

      if (!event) {
        return new Response(
          JSON.stringify({ error: 'Event not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (!(await checkWorkspaceAccess(event.workspace_id as string, userId, env))) {
        return new Response(
          JSON.stringify({ error: 'Access denied' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Get related actors
      const { results: actors } = await env.DB.prepare(`
        SELECT a.*, ae.role FROM actors a
        JOIN actor_events ae ON a.id = ae.actor_id
        WHERE ae.event_id = ?
      `).bind(eventId).all()

      // Get related evidence
      const { results: evidence } = await env.DB.prepare(`
        SELECT e.*, ee.relevance FROM evidence e
        JOIN event_evidence ee ON e.id = ee.evidence_id
        WHERE ee.event_id = ?
      `).bind(eventId).all()

      // Get place if linked
      let place = null
      if (event.location_id) {
        place = await env.DB.prepare(`
          SELECT * FROM places WHERE id = ?
        `).bind(event.location_id).first()
      }

      return new Response(
        JSON.stringify({
          ...event,
          coordinates: event.coordinates ? JSON.parse(event.coordinates as string) : null,
          is_public: Boolean(event.is_public),
          actors: actors.map(a => ({
            ...a,
            aliases: a.aliases ? JSON.parse(a.aliases as string) : [],
            deception_profile: a.deception_profile ? JSON.parse(a.deception_profile as string) : null,
            is_public: Boolean(a.is_public)
          })),
          evidence: evidence.map(e => ({
            ...e,
            tags: e.tags ? JSON.parse(e.tags as string) : [],
            source: e.source ? JSON.parse(e.source as string) : {},
            metadata: e.metadata ? JSON.parse(e.metadata as string) : {},
            eve_assessment: e.eve_assessment ? JSON.parse(e.eve_assessment as string) : null
          })),
          place: place ? {
            ...place,
            coordinates: place.coordinates ? JSON.parse(place.coordinates as string) : null
          } : null
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // PUT /api/events/:id
    if (method === 'PUT' && eventMatch) {
      const eventId = eventMatch[1]
      const body = await request.json() as any

      const event = await env.DB.prepare(`
        SELECT workspace_id FROM events WHERE id = ?
      `).bind(eventId).first()

      if (!event) {
        return new Response(
          JSON.stringify({ error: 'Event not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (!(await checkWorkspaceAccess(event.workspace_id as string, userId, env, 'EDITOR'))) {
        return new Response(
          JSON.stringify({ error: 'Insufficient permissions' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const now = new Date().toISOString()

      // Calculate duration if both dates provided
      let duration = body.duration
      if (!duration && body.date_end && body.date_start) {
        const start = new Date(body.date_start).getTime()
        const end = new Date(body.date_end).getTime()
        duration = Math.floor((end - start) / (1000 * 60))
      }

      await env.DB.prepare(`
        UPDATE events
        SET name = ?,
            description = ?,
            event_type = ?,
            date_start = ?,
            date_end = ?,
            duration = ?,
            location_id = ?,
            coordinates = ?,
            significance = ?,
            confidence = ?,
            timeline_id = ?,
            is_public = ?,
            updated_at = ?
        WHERE id = ?
      `).bind(
        body.name,
        body.description || null,
        body.event_type,
        body.date_start,
        body.date_end || null,
        duration || null,
        body.location_id || null,
        body.coordinates ? JSON.stringify(body.coordinates) : null,
        body.significance || null,
        body.confidence || null,
        body.timeline_id || null,
        body.is_public ? 1 : 0,
        now,
        eventId
      ).run()

      // Update actor links if provided
      if (body.actor_ids !== undefined) {
        await env.DB.prepare(`DELETE FROM actor_events WHERE event_id = ?`).bind(eventId).run()
        if (Array.isArray(body.actor_ids)) {
          for (const actorId of body.actor_ids) {
            await env.DB.prepare(`
              INSERT INTO actor_events (actor_id, event_id, role)
              VALUES (?, ?, ?)
            `).bind(actorId, eventId, body.actor_roles?.[actorId] || null).run()
          }
        }
      }

      // Update evidence links if provided
      if (body.evidence_ids !== undefined) {
        await env.DB.prepare(`DELETE FROM event_evidence WHERE event_id = ?`).bind(eventId).run()
        if (Array.isArray(body.evidence_ids)) {
          for (const evidenceId of body.evidence_ids) {
            await env.DB.prepare(`
              INSERT INTO event_evidence (event_id, evidence_id, relevance)
              VALUES (?, ?, ?)
            `).bind(eventId, evidenceId, body.evidence_relevance?.[evidenceId] || null).run()
          }
        }
      }

      const updated = await env.DB.prepare(`
        SELECT * FROM events WHERE id = ?
      `).bind(eventId).first()

      return new Response(
        JSON.stringify({
          ...updated,
          coordinates: updated.coordinates ? JSON.parse(updated.coordinates as string) : null,
          is_public: Boolean(updated.is_public)
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // DELETE /api/events/:id
    if (method === 'DELETE' && eventMatch) {
      const eventId = eventMatch[1]

      const event = await env.DB.prepare(`
        SELECT workspace_id FROM events WHERE id = ?
      `).bind(eventId).first()

      if (!event) {
        return new Response(
          JSON.stringify({ error: 'Event not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (!(await checkWorkspaceAccess(event.workspace_id as string, userId, env, 'EDITOR'))) {
        return new Response(
          JSON.stringify({ error: 'Insufficient permissions' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      await env.DB.prepare(`
        DELETE FROM events WHERE id = ?
      `).bind(eventId).run()

      const now = new Date().toISOString()
      await env.DB.prepare(`
        UPDATE workspaces
        SET entity_count = json_set(
          COALESCE(entity_count, '{}'),
          '$.events',
          MAX(0, COALESCE(json_extract(entity_count, '$.events'), 0) - 1)
        ),
        updated_at = ?
        WHERE id = ?
      `).bind(now, event.workspace_id).run()

      return new Response(
        JSON.stringify({ message: 'Event deleted successfully' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Events API error:', error)
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}
