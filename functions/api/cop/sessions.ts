/**
 * COP Sessions API - List and Create
 *
 * GET  /api/cop/sessions - List COP sessions for workspace
 * POST /api/cop/sessions - Create new COP session
 */

import type { PagesFunction } from '@cloudflare/workers-types'
import { getUserIdOrDefault } from '../_shared/auth-helpers'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
}

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash, X-Workspace-ID'
}

function generateId(): string {
  return `cop-${crypto.randomUUID().slice(0, 12)}`
}

const jsonFields = ['active_layers', 'layer_config', 'linked_frameworks', 'key_questions', 'event_facts', 'content_analyses'] as const

function parseJsonFields(row: any): any {
  const parsed = { ...row }
  for (const field of jsonFields) {
    if (parsed[field]) {
      try {
        parsed[field] = JSON.parse(parsed[field])
      } catch {
        parsed[field] = field === 'layer_config' ? {} : []
      }
    } else {
      parsed[field] = field === 'layer_config' ? {} : []
    }
  }
  return parsed
}

// GET - List COP sessions
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  const url = new URL(request.url)

  try {
    const userId = await getUserIdOrDefault(request, env)
    const workspaceId = request.headers.get('X-Workspace-ID') || url.searchParams.get('workspace_id')
    const status = url.searchParams.get('status') || 'ACTIVE'

    // If a specific workspace is requested, filter by it. Otherwise show
    // all sessions the user created (supports per-session workspaces).
    let results
    if (workspaceId) {
      results = await env.DB.prepare(`
        SELECT * FROM cop_sessions
        WHERE workspace_id = ? AND status = ?
        ORDER BY updated_at DESC
      `).bind(workspaceId, status).all()
    } else {
      results = await env.DB.prepare(`
        SELECT * FROM cop_sessions
        WHERE created_by = ? AND status = ?
        ORDER BY updated_at DESC
      `).bind(userId, status).all()
    }

    const sessions = results.results.map((row: any) => parseJsonFields(row))

    return new Response(JSON.stringify({ sessions }), { headers: corsHeaders })
  } catch (error) {
    console.error('[COP Sessions API] List error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to list COP sessions',
    }), { status: 500, headers: corsHeaders })
  }
}

// POST - Create new COP session
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  const url = new URL(request.url)

  try {
    const userId = await getUserIdOrDefault(request, env)
    const explicitWorkspace = request.headers.get('X-Workspace-ID') || url.searchParams.get('workspace_id')
    const body = await request.json() as any

    if (!body.name) {
      return new Response(JSON.stringify({ error: 'Name is required' }), {
        status: 400,
        headers: corsHeaders
      })
    }

    const id = generateId()
    const now = new Date().toISOString()

    // Auto-create a dedicated workspace for this COP session unless one was explicitly provided.
    // This ensures each session has its own entity namespace (actors, events, places, etc.)
    // instead of sharing workspace "1" with all other sessions.
    let workspaceId = explicitWorkspace
    if (!workspaceId) {
      workspaceId = id // Use the COP session ID as the workspace ID
      try {
        await env.DB.prepare(`
          INSERT INTO workspaces (id, name, description, type, owner_id, is_public, created_at, updated_at)
          VALUES (?, ?, ?, 'PERSONAL', ?, 0, ?, ?)
        `).bind(
          workspaceId,
          `COP: ${body.name}`,
          body.description || `Workspace for COP session ${id}`,
          userId,
          now,
          now
        ).run()
        // Workspace auto-created for session
      } catch (wsErr) {
        // Workspace may already exist (e.g., retry) — log and continue
        console.warn('[COP Sessions API] Workspace creation skipped (may exist):', wsErr)
      }
    }

    await env.DB.prepare(`
      INSERT INTO cop_sessions (
        id, name, description, template_type, status,
        bbox_min_lat, bbox_min_lon, bbox_max_lat, bbox_max_lon,
        center_lat, center_lon, zoom_level,
        time_window_start, time_window_end, rolling_hours,
        active_layers, layer_config, linked_frameworks, key_questions,
        event_type, event_description, event_facts, content_analyses,
        workspace_id, created_by, is_public,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      body.name,
      body.description || null,
      body.template_type || 'custom',
      body.status || 'ACTIVE',
      body.bbox_min_lat ?? null,
      body.bbox_min_lon ?? null,
      body.bbox_max_lat ?? null,
      body.bbox_max_lon ?? null,
      body.center_lat ?? null,
      body.center_lon ?? null,
      body.zoom_level ?? 6,
      body.time_window_start || null,
      body.time_window_end || null,
      body.rolling_hours ?? null,
      body.active_layers ? JSON.stringify(body.active_layers) : '[]',
      body.layer_config ? JSON.stringify(body.layer_config) : '{}',
      body.linked_frameworks ? JSON.stringify(body.linked_frameworks) : '[]',
      body.key_questions ? JSON.stringify(body.key_questions) : '[]',
      body.event_type || null,
      body.event_description || null,
      body.event_facts ? JSON.stringify(body.event_facts) : '[]',
      body.content_analyses ? JSON.stringify(body.content_analyses) : '[]',
      workspaceId,
      userId,
      body.is_public ? 1 : 0,
      now,
      now
    ).run()

    return new Response(JSON.stringify({ id, workspace_id: workspaceId, message: 'COP session created' }), {
      status: 201,
      headers: corsHeaders
    })
  } catch (error) {
    console.error('[COP Sessions API] Create error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to create COP session',
    }), { status: 500, headers: corsHeaders })
  }
}

// OPTIONS - CORS preflight
export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: corsHeaders })
}
