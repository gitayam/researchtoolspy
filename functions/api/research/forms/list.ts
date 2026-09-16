/**
 * List Forms API
 * GET /api/research/forms/list?workspaceId=xxx&activeOnly=true
 *
 * Lists the caller's research-collection forms for the reviewer UI.
 *
 * System A (E-4b-1): forms now live in `survey_drops` (the modern builder +
 * public submit write here); the legacy `submission_forms` table holds only
 * abandoned test data. This endpoint reads `survey_drops` and maps each row to
 * the EXACT shape `EvidenceSubmissionsPage.tsx` already consumes via
 * `adaptSurveyToFormRow`, so the frontend needs no change.
 */

import { getUserFromRequest } from '../../_shared/auth-helpers'
import { checkWorkspaceAccess } from '../../_shared/workspace-helpers'
import { JSON_HEADERS, optionsResponse } from '../../_shared/api-utils'
import { adaptSurveyToFormRow, type SurveyDropRow } from '../_lib/systema-adapter'

/**
 * Workspace access for the forms list.
 *
 * This used to be a private helper that resolved the workspace ONLY through
 * `cop_sessions WHERE id = ?`, on the assumption that a COP session's id is the
 * canonical workspace id. That is false twice over: half of all COP sessions
 * carry a UUID workspace_id distinct from their `cop-` prefixed id, and an
 * ordinary workspace is not a COP session at all. So the helper returned false
 * for every normal workspace and this endpoint answered 403 on the Evidence
 * Submissions page for anyone not sitting in a COP-backed workspace -- which a
 * crawl of production reproduced on the live site.
 *
 * checkWorkspaceAccess already handles all of it: the default workspace, COP
 * session workspaces, ownership, member roles, and public read.
 */

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const userId = await getUserFromRequest(context.request, context.env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: JSON_HEADERS,
      })
    }

    const url = new URL(context.request.url)
    const workspaceId = url.searchParams.get('workspaceId') || null
    const activeOnly = url.searchParams.get('activeOnly') === 'true'

    // Scope to the caller's own surveys (mirrors GET /api/surveys), and also by
    // workspace when the page supplies one (mirrors the legacy workspace filter).
    let query = `
      SELECT id, title, description, form_schema, share_token, status,
             submission_count, created_at
      FROM survey_drops
      WHERE created_by = ?
    `
    const params: unknown[] = [userId]

    if (workspaceId) {
      // Ownership guard: verify the caller has access to this workspace before
      // scoping results to it. Without this check a caller could probe whether a
      // workspace exists (by observing empty-vs-populated results) even though the
      // `created_by = ?` clause already prevents them from reading actual data.
      // Return 403 — not 404 — so we don't leak whether the workspace ID exists.
      const hasAccess = await checkWorkspaceAccess(workspaceId, userId, context.env, 'VIEWER')
      if (!hasAccess) {
        return new Response(JSON.stringify({ error: 'Access denied' }), {
          status: 403, headers: JSON_HEADERS,
        })
      }

      query += ` AND workspace_id = ?`
      params.push(workspaceId)
    }

    if (activeOnly) {
      query += ` AND status = 'active'`
    }

    query += ` ORDER BY created_at DESC LIMIT 200`

    const result = await context.env.DB.prepare(query).bind(...params).all()

    const forms = (result.results || []).map((row) =>
      adaptSurveyToFormRow(row as unknown as SurveyDropRow)
    )

    return new Response(JSON.stringify({
      success: true,
      forms,
      count: forms.length
    }), {
      headers: JSON_HEADERS
    })

  } catch (error) {
    console.error('[list-forms] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to list forms'

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
