/**
 * COP Intake Forms API
 *
 * GET  /api/cop/:id/intake-forms  - List intake forms for a session
 * POST /api/cop/:id/intake-forms  - Create a new intake form
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
  return `ifm-${crypto.randomUUID().slice(0, 12)}`
}

function generateToken(): string {
  return crypto.randomUUID().replace(/-/g, '')
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params } = context
  const sessionId = params.id as string

  try {
    const results = await env.DB.prepare(
      'SELECT * FROM cop_intake_forms WHERE cop_session_id = ? ORDER BY created_at DESC'
    ).bind(sessionId).all()

    const forms = (results.results || []).map((row: any) => {
      let form_schema = []
      try { form_schema = row.form_schema ? JSON.parse(row.form_schema) : [] } catch { form_schema = [] }
      return { ...row, form_schema }
    })

    return new Response(JSON.stringify({ intake_forms: forms }), { headers: corsHeaders })
  } catch (error) {
    console.error('[COP Intake Forms] List error:', error)
    return new Response(JSON.stringify({ error: 'Failed to list intake forms' }), {
      status: 500, headers: corsHeaders,
    })
  }
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, params, request } = context
  const sessionId = params.id as string
  const userId = await getUserFromRequest(request, env)
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), {
      status: 401, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  }

  try {
    const body = await request.json() as any

    if (!body.title?.trim()) {
      return new Response(JSON.stringify({ error: 'Title is required' }), {
        status: 400, headers: corsHeaders,
      })
    }

    // Look up workspace_id from session
    const session = await env.DB.prepare(
      'SELECT workspace_id FROM cop_sessions WHERE id = ?'
    ).bind(sessionId).first() as any

    if (!session) {
      return new Response(JSON.stringify({ error: 'Session not found' }), {
        status: 404, headers: corsHeaders,
      })
    }

    const id = generateId()
    const shareToken = generateToken()
    const formSchema = JSON.stringify(body.form_schema || [])

    await env.DB.prepare(`
      INSERT INTO cop_intake_forms (id, cop_session_id, title, description, form_schema, share_token, status, auto_tag_category, require_location, require_contact, created_by, workspace_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, sessionId, body.title.trim(), body.description?.trim() || null,
      formSchema, shareToken, body.status || 'draft',
      body.auto_tag_category || null,
      body.require_location ? 1 : 0,
      body.require_contact ? 1 : 0,
      userId, session.workspace_id
    ).run()

    return new Response(JSON.stringify({ id, share_token: shareToken, message: 'Intake form created' }), {
      status: 201, headers: corsHeaders,
    })
  } catch (error) {
    console.error('[COP Intake Forms] Create error:', error)
    return new Response(JSON.stringify({ error: 'Failed to create intake form' }), {
      status: 500, headers: corsHeaders,
    })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: corsHeaders })
}
