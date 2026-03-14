/**
 * COP Marker Changelog API
 *
 * GET  /api/cop/:id/marker-changelog?marker_id=xxx - List changelog for a marker
 * POST /api/cop/:id/marker-changelog               - Create changelog entry
 */
import type { PagesFunction } from '@cloudflare/workers-types'
import { getUserFromRequest } from '../../_shared/auth-helpers'

interface Env {
  DB: D1Database
}

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash, X-Workspace-ID',
}

function generateId(): string {
  return `mcl-${crypto.randomUUID().slice(0, 12)}`
}

const VALID_ACTIONS = ['created', 'moved', 'confidence_changed', 'rationale_updated', 'evidence_linked', 'deleted']

// GET - List changelog entries for a marker
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params, request } = context
  const sessionId = params.id as string
  const url = new URL(request.url)
  const markerId = url.searchParams.get('marker_id')

  try {
    if (!markerId) {
      return new Response(JSON.stringify({ error: 'marker_id query param is required' }), {
        status: 400, headers: corsHeaders,
      })
    }

    const rows = await env.DB.prepare(`
      SELECT * FROM cop_marker_changelog
      WHERE marker_id = ? AND cop_session_id = ?
      ORDER BY created_at DESC
    `).bind(markerId, sessionId).all()

    return new Response(JSON.stringify({ changelog: rows.results || [] }), { headers: corsHeaders })
  } catch (error) {
    console.error('[COP Marker Changelog] List error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to list changelog',
    }), { status: 500, headers: corsHeaders })
  }
}

// POST - Create a changelog entry
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const sessionId = params.id as string

  try {
    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: corsHeaders,
      })
    }
    const body = await request.json() as any

    if (!body.marker_id?.trim()) {
      return new Response(JSON.stringify({ error: 'marker_id is required' }), {
        status: 400, headers: corsHeaders,
      })
    }

    if (!body.action || !VALID_ACTIONS.includes(body.action)) {
      return new Response(JSON.stringify({ error: `action must be one of: ${VALID_ACTIONS.join(', ')}` }), {
        status: 400, headers: corsHeaders,
      })
    }

    const id = generateId()
    const now = new Date().toISOString()

    await env.DB.prepare(`
      INSERT INTO cop_marker_changelog (
        id, marker_id, cop_session_id, action, old_value, new_value,
        rationale, created_by, created_by_name, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, body.marker_id.trim(), sessionId, body.action,
      body.old_value ? JSON.stringify(body.old_value) : null,
      body.new_value ? JSON.stringify(body.new_value) : null,
      body.rationale || null,
      userId,
      body.created_by_name || null,
      now,
    ).run()

    return new Response(JSON.stringify({ id, message: 'Changelog entry created' }), {
      status: 201, headers: corsHeaders,
    })
  } catch (error) {
    console.error('[COP Marker Changelog] Create error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to create changelog entry',
    }), { status: 500, headers: corsHeaders })
  }
}

// OPTIONS - CORS preflight
export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: corsHeaders })
}
