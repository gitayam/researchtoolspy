/**
 * Form Management by ID
 * GET /api/research/forms/[id] - Get form details
 * DELETE /api/research/forms/[id] - Delete form and cascade submissions
 */

import { requireAuth } from '../../../_shared/auth-helpers'
import { checkWorkspaceAccess } from '../../../_shared/workspace-helpers'
import { logActivity } from '../../../_shared/activity-logger'
import { CORS_HEADERS, JSON_HEADERS, optionsResponse } from '../../../_shared/api-utils'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
}

// GET - Get form details
export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    // This is the management view of a form, not the public submission view
    // (that lives in functions/public/intake/). It used to run with no auth and
    // SELECT sf.*, handing submission_password_hash to anyone with the hash_id.
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

    const form = await context.env.DB.prepare(`
      SELECT
        sf.id, sf.hash_id, sf.creator_workspace_id AS workspace_id, sf.form_name,
        sf.form_description, sf.target_investigation_ids, sf.target_research_question_ids,
        sf.enabled_fields, sf.require_url, sf.require_content_type, sf.allow_anonymous,
        sf.auto_archive, sf.collect_submitter_info, sf.require_submission_password,
        sf.is_active, sf.created_at, sf.updated_at, sf.expires_at,
        (SELECT COUNT(*) FROM form_submissions WHERE form_id = sf.hash_id) as submission_count
      FROM submission_forms sf
      WHERE sf.hash_id = ?
    `).bind(formId).first()

    if (form && !(await checkWorkspaceAccess(form.workspace_id as string, userId, context.env, 'VIEWER'))) {
      // Same shape as "not found" so the endpoint is not an existence oracle.
      return new Response(JSON.stringify({ error: 'Form not found' }), {
        status: 404, headers: JSON_HEADERS,
      })
    }

    if (!form) {
      return new Response(JSON.stringify({
        error: 'Form not found'
      }), {
        status: 404,
        headers: JSON_HEADERS
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
      headers: JSON_HEADERS
    })
  } catch (error) {
    if (error instanceof Response) return error
    console.error('[forms/get] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to get form'

    }), {
      status: 500,
      headers: JSON_HEADERS
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
      if (error instanceof Response) return error
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: JSON_HEADERS,
      })
    }

    const formId = context.params.id as string

    // Get the form to verify it exists and get metadata
    const form = await context.env.DB.prepare(`
      SELECT id, hash_id, form_name, creator_workspace_id AS workspace_id FROM submission_forms WHERE hash_id = ?
    `).bind(formId).first()

    if (!form) {
      return new Response(JSON.stringify({
        error: 'Form not found'
      }), {
        status: 404,
        headers: JSON_HEADERS
      })
    }

    // The query above only proves the form EXISTS. Without this check any
    // authenticated caller could delete anyone's form and every submission
    // collected through it, just by supplying the hash_id.
    if (!(await checkWorkspaceAccess(form.workspace_id as string, userId, context.env, 'EDITOR'))) {
      return new Response(JSON.stringify({ error: 'Form not found' }), {
        status: 404, headers: JSON_HEADERS,
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
        headers: JSON_HEADERS
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
      headers: JSON_HEADERS
    })
  } catch (error) {
    if (error instanceof Response) return error
    console.error('[forms/delete] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to delete form'

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
