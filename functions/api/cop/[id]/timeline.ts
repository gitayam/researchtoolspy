/**
 * COP Timeline Entries API — CRUD for investigative timeline events
 *
 * GET    /api/cop/:id/timeline - List timeline entries for session
 * POST   /api/cop/:id/timeline - Create one or more timeline entries
 * PUT    /api/cop/:id/timeline - Update a timeline entry
 * DELETE /api/cop/:id/timeline - Delete a timeline entry
 */
import type { PagesFunction } from '@cloudflare/workers-types'
import { getUserFromRequest } from '../../_shared/auth-helpers'

interface Env {
  DB: D1Database
}

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash, X-Workspace-ID',
}

function generateId(): string {
  return `tle-${crypto.randomUUID().slice(0, 12)}`
}

// GET — list timeline entries for a session, ordered by event_date
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params, request } = context
  const sessionId = params.id as string
  const url = new URL(request.url)
  const category = url.searchParams.get('category')

  try {
    let query = `SELECT * FROM cop_timeline_entries WHERE cop_session_id = ?`
    const bindings: any[] = [sessionId]

    if (category) {
      query += ` AND category = ?`
      bindings.push(category)
    }

    const sourceTypeParam = url.searchParams.get('source_type')
    if (sourceTypeParam) {
      const types = sourceTypeParam.split(',').map(t => t.trim()).filter(Boolean)
      if (types.length > 0) {
        const placeholders = types.map(() => '?').join(', ')
        query += ` AND source_type IN (${placeholders})`
        bindings.push(...types)
      }
    }

    query += ` ORDER BY event_date ASC, created_at ASC LIMIT 1000`

    const results = await env.DB.prepare(query).bind(...bindings).all()

    return new Response(JSON.stringify({ entries: results.results }), { headers: corsHeaders })
  } catch (error) {
    console.error('[COP Timeline] List error:', error)
    return new Response(JSON.stringify({ error: 'Failed to list timeline entries' }), {
      status: 500, headers: corsHeaders,
    })
  }
}

// POST — create one or more timeline entries
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

    // Support single entry or array of entries
    const entries: any[] = Array.isArray(body.entries) ? body.entries : [body]

    if (entries.length === 0 || !entries[0].title) {
      return new Response(JSON.stringify({ error: 'At least one entry with title and event_date is required' }), {
        status: 400, headers: corsHeaders,
      })
    }

    // Look up session's workspace
    const session = await env.DB.prepare(
      `SELECT workspace_id FROM cop_sessions WHERE id = ?`
    ).bind(sessionId).first<{ workspace_id: string }>()
    const workspaceId = session?.workspace_id ?? sessionId

    const now = new Date().toISOString()
    const ids: string[] = []

    const stmts = entries.map((entry: any) => {
      const id = generateId()
      ids.push(id)
      return env.DB.prepare(`
        INSERT INTO cop_timeline_entries (id, cop_session_id, workspace_id, event_date, title, description, category, source_type, source_url, source_title, importance, entity_type, entity_id, action, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id, sessionId, workspaceId,
        entry.event_date || now.slice(0, 10),
        entry.title,
        entry.description ?? null,
        entry.category ?? 'event',
        entry.source_type ?? 'manual',
        entry.source_url ?? null,
        entry.source_title ?? null,
        entry.importance ?? 'normal',
        entry.entity_type ?? null,
        entry.entity_id ?? null,
        entry.action ?? null,
        userId, now, now,
      )
    })

    await env.DB.batch(stmts)

    return new Response(JSON.stringify({
      message: `${ids.length} timeline entries saved`,
      ids,
    }), { status: 201, headers: corsHeaders })
  } catch (error) {
    console.error('[COP Timeline] Create error:', error)
    return new Response(JSON.stringify({ error: 'Failed to save timeline entries' }), {
      status: 500, headers: corsHeaders,
    })
  }
}

// PUT — update a timeline entry
export const onRequestPut: PagesFunction<Env> = async (context) => {
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
    const entryId = body.entry_id

    if (!entryId) {
      return new Response(JSON.stringify({ error: 'entry_id is required' }), {
        status: 400, headers: corsHeaders,
      })
    }

    // Guard: system-generated entries are read-only
    const existingEntry = await env.DB.prepare(
      `SELECT source_type FROM cop_timeline_entries WHERE id = ? AND cop_session_id = ?`
    ).bind(entryId, sessionId).first<{ source_type: string }>()

    if (existingEntry?.source_type === 'system') {
      return new Response(JSON.stringify({ error: 'System-generated entries cannot be modified' }), {
        status: 403, headers: corsHeaders,
      })
    }

    const validCategories = ['event', 'meeting', 'communication', 'financial', 'legal', 'travel', 'publication', 'military', 'political']
    if (body.category !== undefined && !validCategories.includes(body.category)) {
      return new Response(JSON.stringify({ error: `category must be one of: ${validCategories.join(', ')}` }), {
        status: 400, headers: corsHeaders,
      })
    }

    const now = new Date().toISOString()
    const updates: string[] = ['updated_at = ?']
    const bindings: any[] = [now]

    if (body.title !== undefined) { updates.push('title = ?'); bindings.push(body.title) }
    if (body.description !== undefined) { updates.push('description = ?'); bindings.push(body.description) }
    if (body.event_date !== undefined) { updates.push('event_date = ?'); bindings.push(body.event_date) }
    if (body.category !== undefined) { updates.push('category = ?'); bindings.push(body.category) }
    if (body.importance !== undefined) { updates.push('importance = ?'); bindings.push(body.importance) }

    bindings.push(entryId, sessionId)

    const updateResult = await env.DB.prepare(
      `UPDATE cop_timeline_entries SET ${updates.join(', ')} WHERE id = ? AND cop_session_id = ?`
    ).bind(...bindings).run()

    if (!updateResult.meta.changes || updateResult.meta.changes === 0) {
      return new Response(JSON.stringify({ error: 'Timeline entry not found in this session' }), {
        status: 404, headers: corsHeaders,
      })
    }

    const updated = await env.DB.prepare(
      `SELECT * FROM cop_timeline_entries WHERE id = ? AND cop_session_id = ?`
    ).bind(entryId, sessionId).first()

    return new Response(JSON.stringify({ message: 'Timeline entry updated', entry: updated || { id: entryId } }), { headers: corsHeaders })
  } catch (error) {
    console.error('[COP Timeline] Update error:', error)
    return new Response(JSON.stringify({ error: 'Failed to update timeline entry' }), {
      status: 500, headers: corsHeaders,
    })
  }
}

// DELETE — remove a timeline entry
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const sessionId = params.id as string

  try {
    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: corsHeaders,
      })
    }
    const url = new URL(request.url)
    const entryId = url.searchParams.get('entry_id')

    if (!entryId) {
      return new Response(JSON.stringify({ error: 'entry_id query param is required' }), {
        status: 400, headers: corsHeaders,
      })
    }

    const existing = await env.DB.prepare(
      `SELECT source_type FROM cop_timeline_entries WHERE id = ? AND cop_session_id = ?`
    ).bind(entryId, sessionId).first<{ source_type: string }>()

    if (existing?.source_type === 'system') {
      return new Response(JSON.stringify({ error: 'System-generated entries cannot be deleted' }), {
        status: 403, headers: corsHeaders,
      })
    }

    const deleteResult = await env.DB.prepare(
      `DELETE FROM cop_timeline_entries WHERE id = ? AND cop_session_id = ?`
    ).bind(entryId, sessionId).run()

    if (!deleteResult.meta.changes || deleteResult.meta.changes === 0) {
      return new Response(JSON.stringify({ error: 'Timeline entry not found in this session' }), {
        status: 404, headers: corsHeaders,
      })
    }

    return new Response(JSON.stringify({ message: 'Timeline entry deleted' }), { headers: corsHeaders })
  } catch (error) {
    console.error('[COP Timeline] Delete error:', error)
    return new Response(JSON.stringify({ error: 'Failed to delete timeline entry' }), {
      status: 500, headers: corsHeaders,
    })
  }
}

// OPTIONS — CORS preflight
export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: corsHeaders })
}
