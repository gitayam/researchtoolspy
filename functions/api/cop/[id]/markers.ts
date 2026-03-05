/**
 * COP Tactical Markers CRUD
 *
 * GET  /api/cop/:id/markers - List all markers for a COP session
 * POST /api/cop/:id/markers - Create a new tactical marker
 *
 * Markers are CoT-compatible tactical points that can be placed manually
 * or programmatically on the COP map. They support stale times for
 * automatic expiration and CoT type codes for ATAK interoperability.
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
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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
      details: error instanceof Error ? error.message : 'Unknown error',
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

    const id = `mkr-${crypto.randomUUID().slice(0, 12)}`
    const uid = body.uid || crypto.randomUUID()
    const now = new Date().toISOString()
    const staleMinutes = body.stale_minutes ?? 5
    const staleTime = new Date(Date.now() + staleMinutes * 60000).toISOString()

    await env.DB.prepare(`
      INSERT INTO cop_markers (
        id, cop_session_id, uid, cot_type, callsign,
        lat, lon, hae, label, description, icon, color, detail,
        event_time, stale_time, source_type, source_id,
        workspace_id, created_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    ).run()

    return new Response(JSON.stringify({ id, uid, message: 'Marker created' }), {
      status: 201, headers: corsHeaders,
    })
  } catch (error) {
    console.error('[COP Markers] Create error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to create marker',
      details: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500, headers: corsHeaders,
    })
  }
}

// OPTIONS - CORS preflight
export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: corsHeaders })
}
