/**
 * Toggle Form Active Status
 * PATCH /api/research/forms/[id]/toggle - Toggle form active/inactive
 */

import { requireAuth } from '../../../_shared/auth-helpers'
import { logActivity } from '../../../_shared/activity-logger'
import { CORS_HEADERS, JSON_HEADERS, optionsResponse } from '../../../_shared/api-utils'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
}

// PATCH - Toggle form active status
export const onRequestPatch: PagesFunction<Env> = async (context) => {
  try {
    let userId: number | null = null
    try {
      userId = await requireAuth(context.request, context.env)
    } catch (error) {
      if (error instanceof Response) return error
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: JSON_HEADERS,
      })
    }

    const formId = context.params.id as string
    const body = await context.request.json() as { is_active: number }

    if (body.is_active === undefined || (body.is_active !== 0 && body.is_active !== 1)) {
      return new Response(JSON.stringify({
        error: 'Invalid is_active value. Must be 0 or 1'
      }), {
        status: 400,
        headers: JSON_HEADERS
      })
    }

    // Get the form to verify ownership and get workspace
    const form = await context.env.DB.prepare(`
      SELECT id, hash_id, form_name, workspace_id FROM submission_forms WHERE hash_id = ?
    `).bind(formId).first()

    if (!form) {
      return new Response(JSON.stringify({
        error: 'Form not found'
      }), {
        status: 404,
        headers: JSON_HEADERS
      })
    }

    // Update the form status
    await context.env.DB.prepare(`
      UPDATE submission_forms
      SET is_active = ?, updated_at = datetime('now')
      WHERE hash_id = ?
    `).bind(body.is_active, formId).run()

    // Log activity if user is authenticated
    if (userId && form.workspace_id) {
      await logActivity(context.env.DB, {
        workspaceId: form.workspace_id as string,
        actorUserId: userId.toString(),
        actionType: body.is_active === 1 ? 'ENABLED' : 'DISABLED',
        entityType: 'SUBMISSION_FORM',
        entityId: form.id as string,
        entityTitle: form.form_name as string,
        details: {
          hash_id: formId,
          is_active: body.is_active
        }
      })
    }


    return new Response(JSON.stringify({
      success: true,
      is_active: body.is_active
    }), {
      headers: JSON_HEADERS
    })
  } catch (error) {
    if (error instanceof Response) return error
    console.error('[forms/toggle] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to toggle form status'

    }), {
      status: 500,
      headers: JSON_HEADERS
    })
  }
}

// CORS preflight
export const onRequestOptions: PagesFunction = async () => {
  return optionsResponse()
}
