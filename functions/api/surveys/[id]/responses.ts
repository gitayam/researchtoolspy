/**
 * Survey Responses — List + Triage
 *
 * GET /api/surveys/:id/responses  — list responses for a survey (owner only)
 * PUT /api/surveys/:id/responses  — triage single or batch responses
 */
import type { PagesFunction } from '@cloudflare/workers-types'
import { getUserFromRequest } from '../../_shared/auth-helpers'
import { JSON_HEADERS, safeJsonParse } from '../../_shared/api-utils'

interface Env {
  DB: D1Database
}

const VALID_TRIAGE_STATUSES = ['accepted', 'rejected', 'pending']

// GET — list responses for a survey
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const surveyId = params.id as string

  try {
    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: JSON_HEADERS,
      })
    }

    // Verify survey ownership
    const survey = await env.DB.prepare(
      'SELECT id FROM survey_drops WHERE id = ? AND created_by = ?'
    ).bind(surveyId, userId).first()

    if (!survey) {
      return new Response(JSON.stringify({ error: 'Survey not found' }), {
        status: 404, headers: JSON_HEADERS,
      })
    }

    const url = new URL(request.url)
    const statusFilter = url.searchParams.get('status')

    const VALID_RESPONSE_STATUSES = ['pending', 'accepted', 'rejected']
    if (statusFilter && !VALID_RESPONSE_STATUSES.includes(statusFilter)) {
      return new Response(JSON.stringify({ error: 'Invalid status filter' }), { status: 400, headers: JSON_HEADERS })
    }

    let query = `SELECT id, survey_id, form_data, submitter_name, submitter_contact,
             lat, lon, submitter_country, submitter_city, status,
             triaged_by, rejection_reason, cop_session_id, linked_evidence_id,
             created_at, updated_at
      FROM survey_responses WHERE survey_id = ?`
    const bindings: any[] = [surveyId]

    if (statusFilter) {
      query += ' AND status = ?'
      bindings.push(statusFilter)
    }

    query += ' ORDER BY created_at DESC LIMIT 500'

    const result = await env.DB.prepare(query).bind(...bindings).all()
    const responses = (result.results || []).map((row: any) => ({
      ...row,
      form_data: safeJsonParse(row.form_data, {}),
    }))

    return new Response(JSON.stringify({ responses }), { headers: JSON_HEADERS })
  } catch (error) {
    console.error('[Surveys] GET responses error:', error)
    return new Response(JSON.stringify({ error: 'Failed to list responses' }), {
      status: 500, headers: JSON_HEADERS,
    })
  }
}

// PUT — triage single or batch responses
export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const surveyId = params.id as string

  try {
    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: JSON_HEADERS,
      })
    }

    // Verify survey ownership
    const survey = await env.DB.prepare(
      'SELECT id FROM survey_drops WHERE id = ? AND created_by = ?'
    ).bind(surveyId, userId).first()

    if (!survey) {
      return new Response(JSON.stringify({ error: 'Survey not found' }), {
        status: 404, headers: JSON_HEADERS,
      })
    }

    const body = await request.json() as any

    // Validate status
    if (!body.status || !VALID_TRIAGE_STATUSES.includes(body.status)) {
      return new Response(JSON.stringify({
        error: `status is required and must be one of: ${VALID_TRIAGE_STATUSES.join(', ')}`,
      }), { status: 400, headers: JSON_HEADERS })
    }

    const rejectionReason = body.rejection_reason || null

    // Batch mode
    if (Array.isArray(body.ids) && body.ids.length > 100) {
      return new Response(JSON.stringify({ error: 'Maximum 100 responses per batch' }), { status: 400, headers: JSON_HEADERS })
    }
    if (Array.isArray(body.ids) && body.ids.length > 0) {
      const stmts = body.ids.map((responseId: string) =>
        env.DB.prepare(
          `UPDATE survey_responses
           SET status = ?, rejection_reason = ?, triaged_by = ?, updated_at = datetime('now')
           WHERE id = ? AND survey_id = ?`
        ).bind(body.status, rejectionReason, userId, responseId, surveyId)
      )

      await env.DB.batch(stmts)

      return new Response(JSON.stringify({
        message: `${body.ids.length} responses updated to ${body.status}`,
      }), { headers: JSON_HEADERS })
    }

    // Single mode
    if (!body.id) {
      return new Response(JSON.stringify({ error: 'id or ids[] is required' }), {
        status: 400, headers: JSON_HEADERS,
      })
    }

    await env.DB.prepare(
      `UPDATE survey_responses
       SET status = ?, rejection_reason = ?, triaged_by = ?, updated_at = datetime('now')
       WHERE id = ? AND survey_id = ?`
    ).bind(body.status, rejectionReason, userId, body.id, surveyId).run()

    return new Response(JSON.stringify({
      message: `Response ${body.id} updated to ${body.status}`,
    }), { headers: JSON_HEADERS })
  } catch (error) {
    console.error('[Surveys] PUT triage error:', error)
    return new Response(JSON.stringify({ error: 'Failed to triage responses' }), {
      status: 500, headers: JSON_HEADERS,
    })
  }
}

// OPTIONS — CORS preflight
export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, { status: 204, headers: JSON_HEADERS })
}
