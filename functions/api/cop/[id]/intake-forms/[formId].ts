/**
 * COP Single Intake Form API
 *
 * GET /api/cop/:id/intake-forms/:formId  - Get a single intake form
 * PUT /api/cop/:id/intake-forms/:formId  - Update an intake form
 */
import type { PagesFunction } from '@cloudflare/workers-types'
import { getUserFromRequest } from '../../../_shared/auth-helpers'
import { JSON_HEADERS } from '../../../_shared/api-utils'

interface Env {
  DB: D1Database
}


export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params } = context
  const sessionId = params.id as string
  const formId = params.formId as string

  try {
    const form = await env.DB.prepare(
      'SELECT * FROM cop_intake_forms WHERE id = ? AND cop_session_id = ?'
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
    console.error('[COP Intake Form] Get error:', error)
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
    const body = await request.json() as any

    const existing = await env.DB.prepare(
      'SELECT * FROM cop_intake_forms WHERE id = ? AND cop_session_id = ?'
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
    console.error('[COP Intake Form] Update error:', error)
    return new Response(JSON.stringify({ error: 'Failed to update intake form' }), {
      status: 500, headers: JSON_HEADERS,
    })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: JSON_HEADERS })
}
