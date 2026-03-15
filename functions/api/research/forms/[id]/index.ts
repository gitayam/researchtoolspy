/**
 * Form Management by ID
 * GET /api/research/forms/[id] - Get form details
 * DELETE /api/research/forms/[id] - Delete form and cascade submissions
 */

import { requireAuth } from '../../../_shared/auth-helpers'
import { logActivity } from '../../../_shared/activity-logger'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
}

// GET - Get form details
export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const formId = context.params.id as string

    const form = await context.env.DB.prepare(`
      SELECT
        sf.*,
        (SELECT COUNT(*) FROM form_submissions WHERE form_id = sf.hash_id) as submission_count
      FROM submission_forms sf
      WHERE sf.hash_id = ?
    `).bind(formId).first()

    if (!form) {
      return new Response(JSON.stringify({
        error: 'Form not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      })
    }

    // Parse JSON fields
    let parsedFields: any[] = []
    try {
      parsedFields = form.form_fields ? JSON.parse(form.form_fields as string) : []
    } catch {
      parsedFields = []
    }
    const parsed = {
      ...form,
      form_fields: parsedFields
    }

    return new Response(JSON.stringify({
      success: true,
      form: parsed
    }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })
  } catch (error) {
    console.error('[forms/get] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to get form'

    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })
  }
}

// DELETE - Delete form and all submissions
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  try {
    let userId: number | null = null
    try {
      userId = await requireAuth(context.request, context.env)
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      })
    }

    const formId = context.params.id as string

    // Get the form to verify it exists and get metadata
    const form = await context.env.DB.prepare(`
      SELECT id, hash_id, form_name, workspace_id FROM submission_forms WHERE hash_id = ?
    `).bind(formId).first()

    if (!form) {
      return new Response(JSON.stringify({
        error: 'Form not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      })
    }

    // Count submissions before deletion
    const submissionCount = await context.env.DB.prepare(`
      SELECT COUNT(*) as count FROM form_submissions WHERE form_id = ?
    `).bind(formId).first()

    // Delete all submissions first (cascade deletion)
    await context.env.DB.prepare(`
      DELETE FROM form_submissions WHERE form_id = ?
    `).bind(formId).run()

    // Delete the form itself
    const deleteResult = await context.env.DB.prepare(`
      DELETE FROM submission_forms WHERE hash_id = ?
    `).bind(formId).run()

    if (!deleteResult.meta.changes) {
      return new Response(JSON.stringify({ error: 'Form not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      })
    }

    // Log activity if user is authenticated
    if (userId && form.workspace_id) {
      await logActivity(context.env.DB, {
        workspaceId: form.workspace_id as string,
        actorUserId: userId.toString(),
        actionType: 'DELETED',
        entityType: 'SUBMISSION_FORM',
        entityId: form.id as string,
        entityTitle: form.form_name as string,
        details: {
          hash_id: formId,
          submissions_deleted: submissionCount?.count || 0
        }
      })
    }


    return new Response(JSON.stringify({
      success: true,
      deleted_submissions: submissionCount?.count || 0
    }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })
  } catch (error) {
    console.error('[forms/delete] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to delete form'

    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })
  }
}

// CORS preflight
export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  })
}
