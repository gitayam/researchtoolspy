/**
 * COP Single Intake Form API
 *
 * GET /api/cop/:id/intake-forms/:formId  - Get a single intake form
 * PUT /api/cop/:id/intake-forms/:formId  - Update an intake form
 */
import type { PagesFunction } from '@cloudflare/workers-types'
import { getUserFromRequest, verifyCopSessionAccess } from '../../../_shared/auth-helpers'
import { JSON_HEADERS } from '../../../_shared/api-utils'
import { logEvent } from '../../../_shared/event-log'

interface Env {
  DB: D1Database
}


export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params, request } = context
  const sessionId = params.id as string
  const formId = params.formId as string

  try {
    // This handler previously took no auth at all and answered SELECT * to
    // anyone who knew a session id and form id -- which includes share_token
    // (the public submission credential) and password_hash. Mirror the list
    // endpoint in ../intake-forms.ts: authenticate, verify session access, and
    // withhold the secret columns from non-owners.
    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: JSON_HEADERS,
      })
    }
    const accessWorkspaceId = await verifyCopSessionAccess(env.DB, sessionId, userId, { readOnly: true })
    if (!accessWorkspaceId) {
      return new Response(JSON.stringify({ error: 'Access denied' }), {
        status: 403, headers: JSON_HEADERS,
      })
    }

    const session = await env.DB.prepare(
      'SELECT created_by FROM cop_sessions WHERE id = ?'
    ).bind(sessionId).first<{ created_by: number }>()
    const isOwner = session && String(session.created_by) === String(userId)

    const columns = isOwner
      ? '*'
      : 'id, cop_session_id, title, description, form_schema, status, auto_tag_category, require_location, require_contact, created_by, workspace_id, created_at, updated_at'

    const form = await env.DB.prepare(
      `SELECT ${columns} FROM cop_intake_forms WHERE id = ? AND cop_session_id = ?`
    ).bind(formId, sessionId).first() as any

    if (!form) {
      return new Response(JSON.stringify({ error: 'Intake form not found' }), {
        status: 404, headers: JSON_HEADERS,
      })
    }

    let form_schema = []
    try { form_schema = form.form_schema ? JSON.parse(form.form_schema) : [] } catch { form_schema = [] }

    return new Response(JSON.stringify({ ...form, form_schema }), { headers: JSON_HEADERS })
  } catch (error) {
    await logEvent(env, {
      level: 'error',
      source: 'cop/intake-forms',
      message: String(error instanceof Error ? error.message : error).slice(0, 500),
      context: { error: String(error) },
    })
    return new Response(JSON.stringify({ error: 'Failed to get intake form' }), {
      status: 500, headers: JSON_HEADERS,
    })
  }
}

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { env, params, request } = context
  const sessionId = params.id as string
  const formId = params.formId as string

  try {
    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: JSON_HEADERS,
      })
    }
    // Authentication alone let any signed-in user rewrite another team's form
    // -- including form_schema and status -- because the only guard was the
    // (guessable-by-enumeration) id pair. Writes require real session access.
    const writeWorkspaceId = await verifyCopSessionAccess(env.DB, sessionId, userId)
    if (!writeWorkspaceId) {
      return new Response(JSON.stringify({ error: 'Access denied' }), {
        status: 403, headers: JSON_HEADERS,
      })
    }

    const body = await request.json() as any

    const existing = await env.DB.prepare(
      'SELECT id FROM cop_intake_forms WHERE id = ? AND cop_session_id = ?'
    ).bind(formId, sessionId).first()

    if (!existing) {
      return new Response(JSON.stringify({ error: 'Intake form not found' }), {
        status: 404, headers: JSON_HEADERS,
      })
    }

    const updates: string[] = []
    const bindings: any[] = []

    if (body.title !== undefined) { updates.push('title = ?'); bindings.push(body.title.trim()) }
    if (body.description !== undefined) { updates.push('description = ?'); bindings.push(body.description?.trim() || null) }
    if (body.form_schema !== undefined) { updates.push('form_schema = ?'); bindings.push(JSON.stringify(body.form_schema)) }
    if (body.status !== undefined) {
      const VALID = ['draft', 'active', 'closed']
      if (VALID.includes(body.status)) { updates.push('status = ?'); bindings.push(body.status) }
    }
    if (body.auto_tag_category !== undefined) { updates.push('auto_tag_category = ?'); bindings.push(body.auto_tag_category) }
    if (body.require_location !== undefined) { updates.push('require_location = ?'); bindings.push(body.require_location ? 1 : 0) }
    if (body.require_contact !== undefined) { updates.push('require_contact = ?'); bindings.push(body.require_contact ? 1 : 0) }

    if (updates.length === 0) {
      return new Response(JSON.stringify({ message: 'No changes' }), { headers: JSON_HEADERS })
    }

    updates.push('updated_at = ?')
    bindings.push(new Date().toISOString())
    bindings.push(formId, sessionId)

    await env.DB.prepare(
      `UPDATE cop_intake_forms SET ${updates.join(', ')} WHERE id = ? AND cop_session_id = ?`
    ).bind(...bindings).run()

    return new Response(JSON.stringify({ id: formId, message: 'Intake form updated' }), { headers: JSON_HEADERS })
  } catch (error) {
    await logEvent(env, {
      level: 'error',
      source: 'cop/intake-forms',
      message: String(error instanceof Error ? error.message : error).slice(0, 500),
      context: { error: String(error) },
    })
    return new Response(JSON.stringify({ error: 'Failed to update intake form' }), {
      status: 500, headers: JSON_HEADERS,
    })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: JSON_HEADERS })
}
