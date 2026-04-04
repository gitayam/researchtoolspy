/**
 * Push Survey Response to COP as Evidence
 *
 * POST /api/surveys/:id/responses/:rid/push-to-cop
 *
 * Promotes a single survey response into an evidence_item in the linked COP session.
 */
import type { PagesFunction } from '@cloudflare/workers-types'
import { getUserFromRequest, verifyCopSessionAccess } from '../../../../_shared/auth-helpers'
import { JSON_HEADERS, safeJsonParse } from '../../../../_shared/api-utils'
import { emitCopEvent } from '../../../../_shared/cop-events'
import { EVIDENCE_CREATED } from '../../../../_shared/cop-event-types'
import { createTimelineEntry } from '../../../../_shared/timeline-helper'

interface Env {
  DB: D1Database
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const surveyId = params.id as string
  const responseId = params.rid as string

  try {
    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: JSON_HEADERS,
      })
    }

    // Verify survey ownership
    const survey = await env.DB.prepare(
      'SELECT id, title, cop_session_id FROM survey_drops WHERE id = ? AND created_by = ?'
    ).bind(surveyId, userId).first<{ id: string; title: string; cop_session_id: string | null }>()

    if (!survey) {
      return new Response(JSON.stringify({ error: 'Survey not found' }), {
        status: 404, headers: JSON_HEADERS,
      })
    }

    // Get the response
    const response = await env.DB.prepare(
      `SELECT id, survey_id, form_data, submitter_name, submitter_contact,
              lat, lon, submitter_country, submitter_city, status,
              cop_session_id, linked_evidence_id, created_at
       FROM survey_responses WHERE id = ? AND survey_id = ?`
    ).bind(responseId, surveyId).first<any>()

    if (!response) {
      return new Response(JSON.stringify({ error: 'Response not found' }), {
        status: 404, headers: JSON_HEADERS,
      })
    }

    // Check if already pushed
    if (response.linked_evidence_id) {
      return new Response(JSON.stringify({
        error: 'Already pushed',
        evidence_id: response.linked_evidence_id,
      }), { status: 409, headers: JSON_HEADERS })
    }

    // Determine COP session ID: body override or fall back to survey link
    let body: any = {}
    try { body = await request.json() } catch { /* empty body is fine */ }
    const copSessionId = body.cop_session_id || survey.cop_session_id

    if (!copSessionId) {
      return new Response(JSON.stringify({
        error: 'No COP session specified. Provide cop_session_id in body or link the survey first.',
      }), { status: 400, headers: JSON_HEADERS })
    }

    // Verify COP session access
    const wsId = await verifyCopSessionAccess(env.DB, copSessionId, userId)
    if (!wsId) {
      return new Response(JSON.stringify({ error: 'Access denied to COP session' }), {
        status: 403, headers: JSON_HEADERS,
      })
    }

    // Format content from form_data
    const formData = safeJsonParse(response.form_data, {})
    const contentLines = Object.entries(formData).map(
      ([key, value]) => `${key}: ${String(value)}`
    )
    const description = contentLines.join('\n') || '(empty form data)'

    const submitterName = response.submitter_name || 'Anonymous'
    const title = `Survey: ${survey.title} — ${submitterName}`

    const now = new Date().toISOString()

    // Insert into evidence_items (column set matches cop/[id]/evidence.ts)
    const result = await env.DB.prepare(`
      INSERT INTO evidence_items (
        title, description, source_url, evidence_type, confidence_level,
        credibility, reliability,
        status, workspace_id, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, 'observation', 'medium', 'unverified', 'unknown', 'completed', ?, ?, ?, ?)
    `).bind(
      title.substring(0, 500),
      description.substring(0, 5000),
      null,
      wsId,
      userId,
      now, now,
    ).run()

    const evidenceId = result.meta?.last_row_id
    if (!evidenceId) {
      throw new Error('Evidence insert returned no ID')
    }
    const evidenceIdStr = String(evidenceId)

    // Update the survey response with evidence link
    await env.DB.prepare(
      'UPDATE survey_responses SET linked_evidence_id = ?, cop_session_id = ?, updated_at = ? WHERE id = ?'
    ).bind(evidenceIdStr, copSessionId, now, responseId).run()

    // Emit COP event (fire-and-forget)
    await emitCopEvent(env.DB, {
      copSessionId,
      eventType: EVIDENCE_CREATED,
      entityType: 'evidence',
      entityId: evidenceIdStr,
      payload: {
        source: 'survey_response',
        survey_id: surveyId,
        response_id: responseId,
        submitter_name: submitterName,
      },
      createdBy: userId,
    })

    // Create timeline entry (non-fatal)
    try {
      await createTimelineEntry(env.DB, copSessionId, wsId, userId, {
        title: `Survey response received: ${submitterName}`,
        category: 'event',
        importance: 'normal',
        source_type: 'system',
        entity_type: 'evidence',
        entity_id: evidenceIdStr,
        action: 'created',
      })
    } catch (err) {
      console.error('[Surveys] Timeline entry failed (non-fatal):', err)
    }

    return new Response(JSON.stringify({
      message: 'Response pushed to COP',
      evidence_id: evidenceIdStr,
    }), { status: 201, headers: JSON_HEADERS })
  } catch (error) {
    console.error('[Surveys] POST push-to-cop error:', error)
    return new Response(JSON.stringify({ error: 'Failed to push response to COP' }), {
      status: 500, headers: JSON_HEADERS,
    })
  }
}

// OPTIONS — CORS preflight
export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, { status: 204, headers: JSON_HEADERS })
}
