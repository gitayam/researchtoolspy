/**
 * COP Tactical Markers CRUD
 *
 * GET  /api/cop/:id/markers - List all markers for a COP session
 * POST /api/cop/:id/markers - Create a new tactical marker
 * PUT  /api/cop/:id/markers - Update marker (confidence, rationale, label, etc.)
 *
 * Markers are CoT-compatible tactical points that can be placed manually
 * or programmatically on the COP map. They support stale times for
 * automatic expiration and CoT type codes for ATAK interoperability.
 *
 * Supported source_type values: MANUAL, ENTITY, ACLED, GDELT, FRAMEWORK, EVIDENCE, HYPOTHESIS
 */

import type { PagesFunction } from '@cloudflare/workers-types'
import { getUserIdOrDefault } from '../../_shared/auth-helpers'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
}

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash, X-Workspace-ID',
}

// GET - List all markers for a COP session
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params } = context
  const sessionId = params.id as string

  try {
    const rows = await env.DB.prepare(`
      SELECT * FROM cop_markers WHERE cop_session_id = ? ORDER BY event_time DESC
    `).bind(sessionId).all()

    const markers = (rows.results || []).map((row: any) => {
      let detail = {}
      try {
        detail = JSON.parse(row.detail || '{}')
      } catch {
        detail = {}
      }
      return {
        ...row,
        detail,
      }
    })

    return new Response(JSON.stringify({ markers }), { headers: corsHeaders })
  } catch (error) {
    console.error('[COP Markers] List error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to list markers',
    }), {
      status: 500, headers: corsHeaders,
    })
  }
}

// POST - Create a new tactical marker
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const sessionId = params.id as string

  try {
    const userId = await getUserIdOrDefault(request, env)
    const workspaceId = request.headers.get('X-Workspace-ID') || '1'
    const body = await request.json() as any

    if (body.lat == null || body.lon == null) {
      return new Response(JSON.stringify({ error: 'lat and lon are required' }), {
        status: 400, headers: corsHeaders,
      })
    }

    if (typeof body.lat !== 'number' || body.lat < -90 || body.lat > 90) {
      return new Response(JSON.stringify({ error: 'lat must be between -90 and 90' }), { status: 400, headers: corsHeaders })
    }
    if (typeof body.lon !== 'number' || body.lon < -180 || body.lon > 180) {
      return new Response(JSON.stringify({ error: 'lon must be between -180 and 180' }), { status: 400, headers: corsHeaders })
    }

    const id = `mkr-${crypto.randomUUID().slice(0, 12)}`
    const uid = body.uid || crypto.randomUUID()
    const now = new Date().toISOString()
    const staleMinutes = body.stale_minutes === null ? null : Math.min(Math.max(body.stale_minutes ?? 5, 1), 1440)
    const staleTime = staleMinutes === null ? null : new Date(Date.now() + staleMinutes * 60000).toISOString()

    const confidence = ['CONFIRMED', 'PROBABLE', 'POSSIBLE', 'SUSPECTED', 'DOUBTFUL'].includes(body.confidence)
      ? body.confidence : 'POSSIBLE'

    await env.DB.prepare(`
      INSERT INTO cop_markers (
        id, cop_session_id, uid, cot_type, callsign,
        lat, lon, hae, label, description, icon, color, detail,
        event_time, stale_time, source_type, source_id,
        workspace_id, created_by, created_at, confidence, rationale
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, sessionId, uid,
      body.cot_type || 'a-u-G',
      body.callsign || null,
      body.lat, body.lon, body.hae ?? 0,
      body.label || null,
      body.description || null,
      body.icon || null,
      body.color || null,
      JSON.stringify(body.detail || {}),
      now, staleTime,
      body.source_type || 'MANUAL',
      body.source_id || null,
      workspaceId, userId, now,
      confidence,
      body.rationale || null,
    ).run()

    // Insert changelog entry for marker creation
    const changelogId = `mcl-${crypto.randomUUID().slice(0, 12)}`
    await env.DB.prepare(`
      INSERT INTO cop_marker_changelog (
        id, marker_id, cop_session_id, action, new_value,
        rationale, created_by, created_by_name, created_at
      ) VALUES (?, ?, ?, 'created', ?, ?, ?, ?, ?)
    `).bind(
      changelogId, id, sessionId,
      JSON.stringify({ lat: body.lat, lon: body.lon, label: body.label || null, confidence }),
      body.rationale || null,
      userId,
      body.created_by_name || null,
      now,
    ).run()

    return new Response(JSON.stringify({ id, uid, message: 'Marker created' }), {
      status: 201, headers: corsHeaders,
    })
  } catch (error) {
    console.error('[COP Markers] Create error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to create marker',
    }), {
      status: 500, headers: corsHeaders,
    })
  }
}

// PUT - Update a marker's confidence, rationale, label, description, etc.
export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const sessionId = params.id as string

  try {
    const userId = await getUserIdOrDefault(request, env)
    const body = await request.json() as any

    if (!body.id) {
      return new Response(JSON.stringify({ error: 'id is required' }), {
        status: 400, headers: corsHeaders,
      })
    }

    // Build SET clause dynamically from allowed fields
    const allowed: Record<string, any> = {}
    if (body.confidence && ['CONFIRMED', 'PROBABLE', 'POSSIBLE', 'SUSPECTED', 'DOUBTFUL'].includes(body.confidence)) {
      allowed.confidence = body.confidence
    }
    if (body.rationale !== undefined) allowed.rationale = body.rationale || null
    if (body.label !== undefined) allowed.label = body.label || null
    if (body.description !== undefined) allowed.description = body.description || null
    if (body.lat != null && typeof body.lat === 'number') allowed.lat = body.lat
    if (body.lon != null && typeof body.lon === 'number') allowed.lon = body.lon

    if (Object.keys(allowed).length === 0) {
      return new Response(JSON.stringify({ error: 'No valid fields to update' }), {
        status: 400, headers: corsHeaders,
      })
    }

    const setClauses = Object.keys(allowed).map(k => `${k} = ?`).join(', ')
    const values = Object.values(allowed)

    await env.DB.prepare(
      `UPDATE cop_markers SET ${setClauses} WHERE id = ? AND cop_session_id = ?`
    ).bind(...values, body.id, sessionId).run()

    // Log changelog entry
    const changelogId = `mcl-${crypto.randomUUID().slice(0, 12)}`
    const now = new Date().toISOString()
    await env.DB.prepare(`
      INSERT INTO cop_marker_changelog (
        id, marker_id, cop_session_id, action, new_value,
        rationale, created_by, created_by_name, created_at
      ) VALUES (?, ?, ?, 'updated', ?, ?, ?, ?, ?)
    `).bind(
      changelogId, body.id, sessionId,
      JSON.stringify(allowed),
      body.rationale || null,
      userId,
      body.updated_by_name || null,
      now,
    ).run()

    return new Response(JSON.stringify({ id: body.id, message: 'Marker updated' }), {
      headers: corsHeaders,
    })
  } catch (error) {
    console.error('[COP Markers] Update error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to update marker',
    }), {
      status: 500, headers: corsHeaders,
    })
  }
}

// OPTIONS - CORS preflight
export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: corsHeaders })
}
