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

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash, X-Workspace-ID',
}

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
    return new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401, headers: corsHeaders })
  }
  const accessWorkspaceId = await verifyCopSessionAccess(env.DB, sessionId, userId, { readOnly: true })
  if (!accessWorkspaceId) {
    return new Response(JSON.stringify({ error: 'Access denied' }), { status: 403, headers: corsHeaders })
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

    return new Response(JSON.stringify({ events }), { headers: corsHeaders })
  } catch (error) {
    console.error('[COP Events] List error:', error)
    return new Response(JSON.stringify({ error: 'Failed to list events' }), {
      status: 500, headers: corsHeaders,
    })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: corsHeaders })
}
