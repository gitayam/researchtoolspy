/**
 * COP Events API - List events for a COP session
 *
 * GET /api/cop/:id/events - List events with optional filtering and cursor pagination
 *
 * Query params:
 *   event_type  - Filter by event type (e.g. 'task.created')
 *   entity_type - Filter by entity type (e.g. 'task')
 *   since       - Cursor-based pagination: return events after this event ID
 *   limit       - Max results (default 100, max 500)
 */

import type { PagesFunction } from '@cloudflare/workers-types'
import { getUserFromRequest, verifyCopSessionAccess } from '../../_shared/auth-helpers'
import { JSON_HEADERS } from '../../_shared/api-utils'


interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
  JWT_SECRET?: string
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params, request } = context
  const sessionId = params.id as string

  const userId = await getUserFromRequest(request, env)
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401, headers: JSON_HEADERS })
  }
  const accessWorkspaceId = await verifyCopSessionAccess(env.DB, sessionId, userId, { readOnly: true })
  if (!accessWorkspaceId) {
    return new Response(JSON.stringify({ error: 'Access denied' }), { status: 403, headers: JSON_HEADERS })
  }

  try {
    const url = new URL(request.url)
    const eventType = url.searchParams.get('event_type')
    const entityType = url.searchParams.get('entity_type')
    const since = url.searchParams.get('since') // event ID cursor
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), 500)

    let query = 'SELECT * FROM cop_events WHERE cop_session_id = ?'
    const bindings: any[] = [sessionId]

    if (eventType) {
      query += ' AND event_type = ?'
      bindings.push(eventType)
    }

    if (entityType) {
      query += ' AND entity_type = ?'
      bindings.push(entityType)
    }

    if (since) {
      query += ' AND id > ?'
      bindings.push(since)
    }

    query += ' ORDER BY id DESC LIMIT ?'
    bindings.push(limit)

    const results = await env.DB.prepare(query).bind(...bindings).all()

    // Parse payload JSON for each event
    const events = (results.results || []).map((row: any) => {
      let payload = {}
      try {
        payload = row.payload ? JSON.parse(row.payload) : {}
      } catch {
        payload = {}
      }
      return { ...row, payload }
    })

    return new Response(JSON.stringify({ events }), { headers: JSON_HEADERS })
  } catch (error) {
    console.error('[COP Events] List error:', error)
    return new Response(JSON.stringify({ error: 'Failed to list events' }), {
      status: 500, headers: JSON_HEADERS,
    })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: JSON_HEADERS })
}
