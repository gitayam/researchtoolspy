/**
 * COP Sessions API - Single Item Operations
 *
 * GET    /api/cop/sessions/:id - Get single COP session
 * PUT    /api/cop/sessions/:id - Update COP session
 * DELETE /api/cop/sessions/:id - Soft delete (archive) COP session
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
  'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash, X-Workspace-ID'
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

// GET - Get single COP session
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const id = params.id as string
  const workspaceId = request.headers.get('X-Workspace-ID')

  try {
    // Look up by ID; optionally filter by workspace if header is provided
    const result = workspaceId
      ? await env.DB.prepare(`
          SELECT * FROM cop_sessions WHERE id = ? AND (workspace_id = ? OR is_public = 1)
        `).bind(id, workspaceId).first()
      : await env.DB.prepare(`
          SELECT * FROM cop_sessions WHERE id = ?
        `).bind(id).first()

    if (!result) {
      return new Response(JSON.stringify({ error: 'COP session not found' }), {
        status: 404,
        headers: corsHeaders
      })
    }

    const session = parseJsonFields(result)

    return new Response(JSON.stringify({ session }), { headers: corsHeaders })
  } catch (error) {
    console.error('[COP Sessions API] Get error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to get COP session',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), { status: 500, headers: corsHeaders })
  }
}

// PUT - Update COP session
export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const id = params.id as string
  const workspaceId = request.headers.get('X-Workspace-ID') || '1'

  try {
    const body = await request.json() as any
    const now = new Date().toISOString()

    // Build dynamic update query
    const updates: string[] = ['updated_at = ?']
    const values: any[] = [now]

    // Scalar fields that can be updated directly
    const scalarFields = [
      'name', 'description', 'template_type', 'status',
      'bbox_min_lat', 'bbox_min_lon', 'bbox_max_lat', 'bbox_max_lon',
      'center_lat', 'center_lon', 'zoom_level',
      'time_window_start', 'time_window_end', 'rolling_hours',
      'event_type', 'event_description', 'mission_brief'
    ] as const

    for (const field of scalarFields) {
      if (body[field] !== undefined) {
        updates.push(`${field} = ?`)
        values.push(body[field])
      }
    }

    // JSON fields that need stringify
    for (const field of jsonFields) {
      if (body[field] !== undefined) {
        updates.push(`${field} = ?`)
        values.push(JSON.stringify(body[field]))
      }
    }

    // Boolean field
    if (body.is_public !== undefined) {
      updates.push('is_public = ?')
      values.push(body.is_public ? 1 : 0)
    }

    values.push(id, workspaceId)

    await env.DB.prepare(`
      UPDATE cop_sessions
      SET ${updates.join(', ')}
      WHERE id = ? AND workspace_id = ?
    `).bind(...values).run()

    return new Response(JSON.stringify({ message: 'COP session updated' }), { headers: corsHeaders })
  } catch (error) {
    console.error('[COP Sessions API] Update error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to update COP session',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), { status: 500, headers: corsHeaders })
  }
}

// DELETE - Soft delete (archive) COP session
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const id = params.id as string
  const workspaceId = request.headers.get('X-Workspace-ID') || '1'

  try {
    const now = new Date().toISOString()

    await env.DB.prepare(`
      UPDATE cop_sessions
      SET status = 'ARCHIVED', updated_at = ?
      WHERE id = ? AND workspace_id = ?
    `).bind(now, id, workspaceId).run()

    return new Response(JSON.stringify({ message: 'COP session archived' }), { headers: corsHeaders })
  } catch (error) {
    console.error('[COP Sessions API] Delete error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to archive COP session',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), { status: 500, headers: corsHeaders })
  }
}

// OPTIONS - CORS preflight
export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: corsHeaders })
}
