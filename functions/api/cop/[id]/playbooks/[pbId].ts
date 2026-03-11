/**
 * COP Single Playbook API
 *
 * GET    /api/cop/:id/playbooks/:pbId - Get single playbook with rules
 * PUT    /api/cop/:id/playbooks/:pbId - Update playbook (name, description, status)
 * DELETE /api/cop/:id/playbooks/:pbId - Delete playbook (cascades to rules + log)
 */
import type { PagesFunction } from '@cloudflare/workers-types'
import { getUserIdOrDefault } from '../../../_shared/auth-helpers'

interface Env {
  DB: D1Database
}

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash, X-Workspace-ID',
}

const VALID_STATUSES = ['active', 'paused', 'draft']

function parseJsonField(row: any, field: string, fallback: any = {}): any {
  if (!row || !row[field]) return fallback
  try {
    return typeof row[field] === 'string' ? JSON.parse(row[field]) : row[field]
  } catch {
    return fallback
  }
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params } = context
  const sessionId = params.id as string
  const pbId = params.pbId as string

  try {
    const playbook = await env.DB.prepare(
      'SELECT * FROM cop_playbooks WHERE id = ? AND cop_session_id = ?'
    ).bind(pbId, sessionId).first()

    if (!playbook) {
      return new Response(JSON.stringify({ error: 'Playbook not found' }), {
        status: 404, headers: corsHeaders,
      })
    }

    // Fetch rules
    const rules = await env.DB.prepare(
      'SELECT * FROM cop_playbook_rules WHERE playbook_id = ? ORDER BY position ASC'
    ).bind(pbId).all()

    const parsedRules = (rules.results || []).map((r: any) => ({
      ...r,
      enabled: Boolean(r.enabled),
      trigger_filter: parseJsonField(r, 'trigger_filter', {}),
      conditions: parseJsonField(r, 'conditions', []),
      actions: parseJsonField(r, 'actions', []),
    }))

    return new Response(JSON.stringify({ playbook, rules: parsedRules }), { headers: corsHeaders })
  } catch (error) {
    console.error('[COP Playbook] Get error:', error)
    return new Response(JSON.stringify({ error: 'Failed to get playbook' }), {
      status: 500, headers: corsHeaders,
    })
  }
}

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const sessionId = params.id as string
  const pbId = params.pbId as string

  try {
    const body = await request.json() as any

    const existing = await env.DB.prepare(
      'SELECT id FROM cop_playbooks WHERE id = ? AND cop_session_id = ?'
    ).bind(pbId, sessionId).first()

    if (!existing) {
      return new Response(JSON.stringify({ error: 'Playbook not found' }), {
        status: 404, headers: corsHeaders,
      })
    }

    const now = new Date().toISOString()
    const updates: string[] = []
    const bindings: any[] = []

    if (body.name !== undefined) {
      updates.push('name = ?')
      bindings.push(body.name.trim())
    }
    if (body.description !== undefined) {
      updates.push('description = ?')
      bindings.push(body.description || null)
    }
    if (body.status !== undefined && VALID_STATUSES.includes(body.status)) {
      updates.push('status = ?')
      bindings.push(body.status)
    }

    if (updates.length === 0) {
      return new Response(JSON.stringify({ error: 'No valid fields to update' }), {
        status: 400, headers: corsHeaders,
      })
    }

    updates.push('updated_at = ?')
    bindings.push(now)
    bindings.push(pbId, sessionId)

    await env.DB.prepare(
      `UPDATE cop_playbooks SET ${updates.join(', ')} WHERE id = ? AND cop_session_id = ?`
    ).bind(...bindings).run()

    return new Response(JSON.stringify({ id: pbId, message: 'Playbook updated' }), { headers: corsHeaders })
  } catch (error) {
    console.error('[COP Playbook] Update error:', error)
    return new Response(JSON.stringify({ error: 'Failed to update playbook' }), {
      status: 500, headers: corsHeaders,
    })
  }
}

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { env, params } = context
  const sessionId = params.id as string
  const pbId = params.pbId as string

  try {
    const existing = await env.DB.prepare(
      'SELECT id FROM cop_playbooks WHERE id = ? AND cop_session_id = ?'
    ).bind(pbId, sessionId).first()

    if (!existing) {
      return new Response(JSON.stringify({ error: 'Playbook not found' }), {
        status: 404, headers: corsHeaders,
      })
    }

    // Cascade delete: log -> rules -> playbook
    await env.DB.prepare('DELETE FROM cop_playbook_log WHERE playbook_id = ?').bind(pbId).run()
    await env.DB.prepare('DELETE FROM cop_playbook_rules WHERE playbook_id = ?').bind(pbId).run()
    await env.DB.prepare('DELETE FROM cop_playbooks WHERE id = ? AND cop_session_id = ?').bind(pbId, sessionId).run()

    return new Response(JSON.stringify({ message: 'Playbook deleted' }), { headers: corsHeaders })
  } catch (error) {
    console.error('[COP Playbook] Delete error:', error)
    return new Response(JSON.stringify({ error: 'Failed to delete playbook' }), {
      status: 500, headers: corsHeaders,
    })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: corsHeaders })
}
