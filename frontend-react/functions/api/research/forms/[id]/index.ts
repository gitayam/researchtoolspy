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
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Parse JSON fields
    const parsed = {
      ...form,
      form_fields: form.form_fields ? JSON.parse(form.form_fields as string) : []
    }

    return new Response(JSON.stringify({
      success: true,
      form: parsed
    }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('[forms/get] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to get form',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// DELETE - Delete form and all submissions
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  try {
    // Auth not required - support guest users
    let userId: number | null = null
    try {
      userId = await requireAuth(context.request, context.env)
    } catch (error) {
      // Guest user - allowed to delete their own forms
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
        headers: { 'Content-Type': 'application/json' }
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
    await context.env.DB.prepare(`
      DELETE FROM submission_forms WHERE hash_id = ?
    `).bind(formId).run()

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

    console.log('[forms/delete] Deleted form and submissions:', formId, submissionCount?.count || 0)

    return new Response(JSON.stringify({
      success: true,
      deleted_submissions: submissionCount?.count || 0
    }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('[forms/delete] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to delete form',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
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
