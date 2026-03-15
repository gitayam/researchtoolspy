/**
 * COP Playbooks API - List and Create
 *
 * GET  /api/cop/:id/playbooks - List playbooks for session
 * POST /api/cop/:id/playbooks - Create new playbook (status: draft)
 */
import type { PagesFunction } from '@cloudflare/workers-types'
import { getUserFromRequest, verifyCopSessionAccess } from '../../_shared/auth-helpers'

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
  return `pb-${crypto.randomUUID().slice(0, 12)}`
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params, request } = context
  const sessionId = params.id as string

  try {
    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: corsHeaders,
      })
    }
    const workspaceId = await verifyCopSessionAccess(env.DB, sessionId, userId, { readOnly: true })
    if (!workspaceId) {
      return new Response(JSON.stringify({ error: 'Access denied' }), {
        status: 403, headers: corsHeaders,
      })
    }

    const rows = await env.DB.prepare(`
      SELECT p.*,
        (SELECT COUNT(*) FROM cop_playbook_rules WHERE playbook_id = p.id) AS rule_count
      FROM cop_playbooks p
      WHERE p.cop_session_id = ?
      ORDER BY p.updated_at DESC
    `).bind(sessionId).all()

    return new Response(JSON.stringify({ playbooks: rows.results || [] }), { headers: corsHeaders })
  } catch (error) {
    console.error('[COP Playbooks] List error:', error)
    return new Response(JSON.stringify({ error: 'Failed to list playbooks' }), {
      status: 500, headers: corsHeaders,
    })
  }
}

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
    const accessWorkspaceId = await verifyCopSessionAccess(env.DB, sessionId, userId)
    if (!accessWorkspaceId) {
      return new Response(JSON.stringify({ error: 'Access denied' }), {
        status: 403, headers: corsHeaders,
      })
    }
    const body = await request.json() as any

    if (!body.name?.trim()) {
      return new Response(JSON.stringify({ error: 'Name is required' }), {
        status: 400, headers: corsHeaders,
      })
    }

    // Look up session workspace_id
    const session = await env.DB.prepare(
      'SELECT workspace_id FROM cop_sessions WHERE id = ?'
    ).bind(sessionId).first() as any

    const workspaceId = session?.workspace_id || request.headers.get('X-Workspace-ID') || sessionId

    const id = generateId()
    const now = new Date().toISOString()

    await env.DB.prepare(`
      INSERT INTO cop_playbooks (
        id, cop_session_id, name, description, status, source, template_id,
        created_by, workspace_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, sessionId,
      body.name.trim(),
      body.description || null,
      'draft',
      body.source || 'custom',
      body.template_id || null,
      userId, workspaceId, now, now,
    ).run()

    return new Response(JSON.stringify({ id, message: 'Playbook created' }), {
      status: 201, headers: corsHeaders,
    })
  } catch (error) {
    console.error('[COP Playbooks] Create error:', error)
    return new Response(JSON.stringify({ error: 'Failed to create playbook' }), {
      status: 500, headers: corsHeaders,
    })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: corsHeaders })
}
