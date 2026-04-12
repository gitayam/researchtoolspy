/**
 * Events API
 * Manages events (operations, incidents, meetings, activities) with temporal and spatial tracking
 */

import type { PagesFunction } from '@cloudflare/workers-types'
import { getUserIdOrDefault, getUserFromRequest } from './_shared/auth-helpers'
import { checkWorkspaceAccess } from './_shared/workspace-helpers'
import { generateId, CORS_HEADERS, JSON_HEADERS, safeJsonParse } from './_shared/api-utils'

interface Env {
  DB: D1Database
  SESSIONS: KVNamespace
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  const url = new URL(request.url)
  const method = request.method

  if (method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS })
  }

  try {
    const userId = await getUserIdOrDefault(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: JSON_HEADERS,
      })
    }

    // GET /api/events?workspace_id=xxx
    if (method === 'GET' && url.pathname === '/api/events') {
      const workspaceId = url.searchParams.get('workspace_id')
      if (!workspaceId) {
        return new Response(
          JSON.stringify({ error: 'workspace_id parameter required' }),
          { status: 400, headers: JSON_HEADERS }
        )
      }

      if (!(await checkWorkspaceAccess(workspaceId, userId, env))) {
        return new Response(
          JSON.stringify({ error: 'Access denied to workspace' }),
          { status: 403, headers: JSON_HEADERS }
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
      query += ` LIMIT ?`
      params.push(Math.min(parseInt(limit || '500') || 500, 500))

      const { results } = await env.DB.prepare(query).bind(...params).all()

      const events = results.map(e => ({
        ...e,
        coordinates: safeJsonParse(e.coordinates),
        is_public: Boolean(e.is_public)
      }))

      return new Response(
        JSON.stringify({ events }),
        { status: 200, headers: JSON_HEADERS }
      )
    }

    // POST /api/events
    if (method === 'POST' && url.pathname === '/api/events') {
      const authUserId = await getUserFromRequest(request, env)
      if (!authUserId) {
        return new Response(JSON.stringify({ error: 'Authentication required' }), {
          status: 401, headers: JSON_HEADERS,
        })
      }

      const body = await request.json() as any

      if (!body.name || !body.event_type || !body.date_start || !body.workspace_id) {
        return new Response(
          JSON.stringify({ error: 'Missing required fields: name, event_type, date_start, workspace_id' }),
          { status: 400, headers: JSON_HEADERS }
        )
      }

      const ALLOWED_EVENT_TYPES = ['OPERATION', 'INCIDENT', 'MEETING', 'ACTIVITY', 'OTHER']
      if (!ALLOWED_EVENT_TYPES.includes(body.event_type)) {
        return new Response(
          JSON.stringify({ error: `Invalid event_type. Must be one of: ${ALLOWED_EVENT_TYPES.join(', ')}` }),
          { status: 400, headers: JSON_HEADERS }
        )
      }

      if (!(await checkWorkspaceAccess(body.workspace_id, authUserId, env, 'EDITOR'))) {
        return new Response(
          JSON.stringify({ error: 'Insufficient permissions' }),
          { status: 403, headers: JSON_HEADERS }
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
        authUserId,
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

      if (!event) {
        return new Response(
          JSON.stringify({ success: true, id }),
          { status: 201, headers: JSON_HEADERS }
        )
      }

      return new Response(
        JSON.stringify({
          ...event,
          coordinates: safeJsonParse(event.coordinates),
          is_public: Boolean(event.is_public)
        }),
        { status: 201, headers: JSON_HEADERS }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: JSON_HEADERS }
    )

  } catch (error) {
    console.error('Events API error:', error)
    return new Response(
      JSON.stringify({
        error: 'Internal server error'

      }),
      { status: 500, headers: JSON_HEADERS }
    )
  }
}
