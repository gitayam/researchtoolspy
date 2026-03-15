/**
 * Events API - Single Event Operations
 * GET/PUT/DELETE /api/events/:id
 */

import type { PagesFunction } from '@cloudflare/workers-types'
import { getUserIdOrDefault, getUserFromRequest } from '../_shared/auth-helpers'
import { checkWorkspaceAccess } from '../_shared/workspace-helpers'
import { JSON_HEADERS, safeJsonParse } from '../_shared/api-utils'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
}

// GET /api/events/:id
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const eventId = params.id as string

  try {
    const userId = await getUserIdOrDefault(request, env)

    const event = await env.DB.prepare(`
      SELECT * FROM events WHERE id = ?
    `).bind(eventId).first()

    if (!event) {
      return new Response(
        JSON.stringify({ error: 'Event not found' }),
        { status: 404, headers: JSON_HEADERS }
      )
    }

    if (!(await checkWorkspaceAccess(event.workspace_id as string, userId, env))) {
      return new Response(
        JSON.stringify({ error: 'Access denied' }),
        { status: 403, headers: JSON_HEADERS }
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
        coordinates: safeJsonParse(event.coordinates),
        is_public: Boolean(event.is_public),
        actors: actors.map(a => ({
          ...a,
          aliases: safeJsonParse(a.aliases, []),
          deception_profile: safeJsonParse(a.deception_profile),
          is_public: Boolean(a.is_public)
        })),
        evidence: evidence.map(e => ({
          ...e,
          tags: safeJsonParse(e.tags, []),
          source: safeJsonParse(e.source, {}),
          metadata: safeJsonParse(e.metadata, {}),
          eve_assessment: safeJsonParse(e.eve_assessment)
        })),
        place: place ? {
          ...place,
          coordinates: safeJsonParse(place.coordinates)
        } : null
      }),
      { status: 200, headers: JSON_HEADERS }
    )
  } catch (error) {
    console.error('Events GET error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: JSON_HEADERS }
    )
  }
}

// PUT /api/events/:id
export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const eventId = params.id as string

  try {
    const authUserId = await getUserFromRequest(request, env)
    if (!authUserId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: JSON_HEADERS,
      })
    }

    const body = await request.json() as any

    const event = await env.DB.prepare(`
      SELECT workspace_id FROM events WHERE id = ?
    `).bind(eventId).first()

    if (!event) {
      return new Response(
        JSON.stringify({ error: 'Event not found' }),
        { status: 404, headers: JSON_HEADERS }
      )
    }

    if (!(await checkWorkspaceAccess(event.workspace_id as string, authUserId, env, 'EDITOR'))) {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions' }),
        { status: 403, headers: JSON_HEADERS }
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

    if (!updated) {
      return new Response(
        JSON.stringify({ success: true, id: eventId }),
        { status: 200, headers: JSON_HEADERS }
      )
    }

    return new Response(
      JSON.stringify({
        ...updated,
        coordinates: safeJsonParse(updated.coordinates),
        is_public: Boolean(updated.is_public)
      }),
      { status: 200, headers: JSON_HEADERS }
    )
  } catch (error) {
    console.error('Events PUT error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: JSON_HEADERS }
    )
  }
}

// DELETE /api/events/:id
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const eventId = params.id as string

  try {
    const authUserId = await getUserFromRequest(request, env)
    if (!authUserId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: JSON_HEADERS,
      })
    }

    const event = await env.DB.prepare(`
      SELECT workspace_id FROM events WHERE id = ?
    `).bind(eventId).first()

    if (!event) {
      return new Response(
        JSON.stringify({ error: 'Event not found' }),
        { status: 404, headers: JSON_HEADERS }
      )
    }

    if (!(await checkWorkspaceAccess(event.workspace_id as string, authUserId, env, 'EDITOR'))) {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions' }),
        { status: 403, headers: JSON_HEADERS }
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
      { status: 200, headers: JSON_HEADERS }
    )
  } catch (error) {
    console.error('Events DELETE error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: JSON_HEADERS }
    )
  }
}
