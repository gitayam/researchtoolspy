/**
 * List Submissions API
 * GET /api/research/submissions/list?formId=xxx&status=pending
 *
 * Lists submissions for the reviewer UI.
 *
 * System A (E-4b-1): submissions now live in `survey_responses` (the public
 * submit page writes here); the legacy `form_submissions` table holds only
 * abandoned test data, so submissions to NEW forms were invisible. This endpoint
 * reads `survey_responses` JOINed to `survey_drops` (to scope by the owner's
 * surveys) and maps each row to the EXACT shape `EvidenceSubmissionsPage.tsx`
 * already consumes via `adaptResponseToSubmissionRow`, so the frontend needs no
 * change. The submitter's IP hash is never selected or returned (E-1 privacy).
 */

import type { PagesFunction } from '@cloudflare/workers-types'
import { getUserFromRequest } from '../../_shared/auth-helpers'
import { JSON_HEADERS, optionsResponse } from '../../_shared/api-utils'
import { adaptResponseToSubmissionRow, type SurveyResponseRow } from '../_lib/systema-adapter'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
  JWT_SECRET?: string
}

// System A `survey_responses.status` is pending|accepted|rejected, but the
// reviewer UI's status filter offers pending|completed|rejected. Translate the
// UI value so the existing frontend filter keeps working unchanged.
function toSystemAStatus(uiStatus: string): string {
  return uiStatus === 'completed' ? 'accepted' : uiStatus
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const userId = await getUserFromRequest(context.request, context.env)
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), {
      status: 401, headers: JSON_HEADERS,
    })
  }

  try {
    const url = new URL(context.request.url)
    const formId = url.searchParams.get('formId')
    const status = url.searchParams.get('status')

    // Only ever select an allow-listed set of columns — the submitter's hashed
    // network address is deliberately excluded (E-1 privacy) and the adapter
    // never reads it.
    let query = `
      SELECT
        r.id, r.survey_id, r.form_data,
        r.submitter_name, r.submitter_contact,
        r.status, r.rejection_reason, r.linked_evidence_id, r.created_at,
        d.title AS form_name, d.share_token
      FROM survey_responses r
      JOIN survey_drops d ON r.survey_id = d.id
      WHERE d.created_by = ?
    `

    const params: unknown[] = [userId]

    if (formId) {
      query += ` AND r.survey_id = ?`
      params.push(formId)
    }

    if (status) {
      query += ` AND r.status = ?`
      params.push(toSystemAStatus(status))
    }

    query += ` ORDER BY r.created_at DESC LIMIT 500`

    const result = await context.env.DB.prepare(query).bind(...params).all()

    const submissions = (result.results || []).map((row) =>
      adaptResponseToSubmissionRow(row as unknown as SurveyResponseRow)
    )

    return new Response(JSON.stringify({
      success: true,
      submissions,
      count: submissions.length
    }), {
      headers: JSON_HEADERS
    })

  } catch (error) {
    console.error('[list-submissions] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to list submissions'

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
