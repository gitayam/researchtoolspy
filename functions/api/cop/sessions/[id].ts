/**
 * COP Sessions API - Single Item Operations
 *
 * GET    /api/cop/sessions/:id - Get single COP session
 * PUT    /api/cop/sessions/:id - Update COP session
 * DELETE /api/cop/sessions/:id - Soft delete (archive) COP session
 */

import type { PagesFunction } from '@cloudflare/workers-types'
import { getUserIdOrDefault, getUserFromRequest } from '../../_shared/auth-helpers'

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
    }), { status: 500, headers: corsHeaders })
  }
}

// PUT - Update COP session (owner only)
export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const id = params.id as string
  try {
    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: corsHeaders,
      })
    }

    // Verify ownership before updating
    const session = await env.DB.prepare(
      'SELECT id, created_by FROM cop_sessions WHERE id = ?'
    ).bind(id).first<{ id: string; created_by: number }>()

    if (!session) {
      return new Response(JSON.stringify({ error: 'COP session not found' }), { status: 404, headers: corsHeaders })
    }

    if (session.created_by !== userId) {
      return new Response(JSON.stringify({ error: 'Only the workspace owner can update this session' }), { status: 403, headers: corsHeaders })
    }

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

    // Boolean fields
    if (body.is_public !== undefined) {
      updates.push('is_public = ?')
      values.push(body.is_public ? 1 : 0)
    }
    if (body.global_alerts_enabled !== undefined) {
      updates.push('global_alerts_enabled = ?')
      values.push(body.global_alerts_enabled ? 1 : 0)
    }

    // Nullable text fields for global alerts
    if (body.global_alerts_region !== undefined) {
      updates.push('global_alerts_region = ?')
      values.push(body.global_alerts_region || null)
    }

    // Defense-in-depth: scope update to owner
    values.push(id, userId)

    await env.DB.prepare(`
      UPDATE cop_sessions
      SET ${updates.join(', ')}
      WHERE id = ? AND created_by = ?
    `).bind(...values).run()

    // --- Auto-sync event_facts to events table (append-only) ---
    if (body.event_facts !== undefined && Array.isArray(body.event_facts) && body.event_facts.length > 0) {
      try {
        // Get the session's authoritative workspace_id from DB
        const session = await env.DB.prepare(
          `SELECT workspace_id FROM cop_sessions WHERE id = ?`
        ).bind(id).first<{ workspace_id: string }>()

        if (session?.workspace_id) {
          const facts: string[] = body.event_facts.filter((f: any) => typeof f === 'string' && f.trim().length > 0)

          if (facts.length > 0) {
            // Fetch existing event descriptions for this workspace to avoid duplicates
            const existing = await env.DB.prepare(
              `SELECT description FROM events WHERE workspace_id = ?`
            ).bind(session.workspace_id).all<{ description: string }>()

            const existingDescriptions = new Set(
              (existing.results || []).map((r) => r.description)
            )

            // Filter to only new facts
            const newFacts = facts.filter((fact) => !existingDescriptions.has(fact))

            if (newFacts.length > 0) {
              // Batch insert using D1 batch API
              const stmts = newFacts.map((fact) => {
                const eventId = crypto.randomUUID()
                const eventName = fact.length > 100 ? fact.substring(0, 100) : fact
                return env.DB.prepare(`
                  INSERT INTO events (id, name, description, event_type, date_start, workspace_id, created_by, created_at, updated_at)
                  VALUES (?, ?, ?, 'ACTIVITY', ?, ?, ?, ?, ?)
                `).bind(eventId, eventName, fact, now, session.workspace_id, userId, now, now)
              })

              await env.DB.batch(stmts)
              // event_facts synced to events table
            }
          }
        }
      } catch (syncError) {
        // Log but don't fail the main update if sync fails
        console.error('[COP Sessions API] event_facts sync error:', syncError)
      }
    }

    return new Response(JSON.stringify({ message: 'COP session updated' }), { headers: corsHeaders })
  } catch (error) {
    console.error('[COP Sessions API] Update error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to update COP session',
    }), { status: 500, headers: corsHeaders })
  }
}

// DELETE - Soft delete (archive) COP session (owner only)
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const id = params.id as string
  try {
    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: corsHeaders,
      })
    }

    // Verify ownership before archiving
    const session = await env.DB.prepare(
      'SELECT id, created_by FROM cop_sessions WHERE id = ?'
    ).bind(id).first<{ id: string; created_by: number }>()

    if (!session) {
      return new Response(JSON.stringify({ error: 'COP session not found' }), { status: 404, headers: corsHeaders })
    }

    if (session.created_by !== userId) {
      return new Response(JSON.stringify({ error: 'Only the workspace owner can delete this session' }), { status: 403, headers: corsHeaders })
    }

    const now = new Date().toISOString()

    await env.DB.prepare(`
      UPDATE cop_sessions
      SET status = 'ARCHIVED', updated_at = ?
      WHERE id = ? AND created_by = ?
    `).bind(now, id, userId).run()

    return new Response(JSON.stringify({ message: 'COP session archived' }), { headers: corsHeaders })
  } catch (error) {
    console.error('[COP Sessions API] Delete error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to archive COP session',
    }), { status: 500, headers: corsHeaders })
  }
}

// OPTIONS - CORS preflight
export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: corsHeaders })
}
