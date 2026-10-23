/**
 * Push Survey Response to COP as Evidence
 *
 * POST /api/surveys/:id/responses/:rid/push-to-cop
 *
 * Promotes a single survey response into the linked COP session: unverified
 * evidence, a marker for an explicit location field, the form's tag
 * (functions/api/_shared/cop-ingest.ts). The claim inside ingest makes a double
 * push create one evidence item; the second answers 409.
 */
import type { PagesFunction } from '@cloudflare/workers-types'
import { getUserFromRequest, verifyCopSessionAccess } from '../../../../_shared/auth-helpers'
import { JSON_HEADERS } from '../../../../_shared/api-utils'
import { mayEditCopSession } from '../../../../_shared/cop-webcams'
import { ingestSubmission } from '../../../../_shared/cop-ingest'
import type { R2Like } from '../../../../_shared/cop-uploads'

interface Env {
  DB: D1Database
  UPLOADS?: R2Like
}

const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: JSON_HEADERS })

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const surveyId = params.id as string
  const responseId = params.rid as string

  try {
    const userId = await getUserFromRequest(request, env)
    if (!userId) return reply({ error: 'Authentication required' }, 401)

    // The form's owner pushes its responses.
    const survey = await env.DB.prepare(
      'SELECT id, title, cop_session_id FROM survey_drops WHERE id = ? AND created_by = ?'
    ).bind(surveyId, userId).first<{ id: string; title: string; cop_session_id: string | null }>()
    if (!survey) return reply({ error: 'Survey not found' }, 404)

    const response = await env.DB.prepare(
      'SELECT id, cop_session_id, linked_evidence_id FROM survey_responses WHERE id = ? AND survey_id = ?'
    ).bind(responseId, surveyId).first<{ id: string; cop_session_id: string | null; linked_evidence_id: string | null }>()
    if (!response) return reply({ error: 'Response not found' }, 404)
    if (response.linked_evidence_id && !response.linked_evidence_id.startsWith('claim:')) {
      return reply({ error: 'Already pushed', evidence_id: response.linked_evidence_id }, 409)
    }

    let body: Record<string, unknown> = {}
    try {
      const parsed = await request.json()
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) body = parsed as Record<string, unknown>
    } catch { /* empty body is fine */ }
    const copSessionId = (typeof body.cop_session_id === 'string' && body.cop_session_id ? body.cop_session_id : null) || response.cop_session_id || survey.cop_session_id
    if (!copSessionId) {
      return reply({ error: 'No COP session specified. Provide cop_session_id in body or link the survey first.' }, 400)
    }
    if (response.cop_session_id && response.cop_session_id !== copSessionId) {
      return reply({ error: 'This response already belongs to another COP session' }, 409)
    }

    // Pushing writes to the COP: the owner or an editor of that session.
    const wsId = await verifyCopSessionAccess(env.DB, copSessionId, userId)
    if (!wsId || !(await mayEditCopSession(env.DB, copSessionId, userId))) {
      return reply({ error: 'Access denied to COP session' }, 403)
    }

    if (!response.cop_session_id) {
      await env.DB.prepare('UPDATE survey_responses SET cop_session_id = ? WHERE id = ? AND cop_session_id IS NULL')
        .bind(copSessionId, responseId).run()
    }

    const result = await ingestSubmission(env, { responseId, sessionId: copSessionId, actorUserId: userId, auto: false })
    if (result.ok === false) return reply({ error: result.error }, result.status)
    if (!result.created) return reply({ error: 'Already pushed', evidence_id: result.evidenceId }, 409)
    return reply({ message: 'Response pushed to COP', evidence_id: result.evidenceId, marker_id: result.markerId }, 201)
  } catch (error) {
    console.error('[Surveys] POST push-to-cop error:', error)
    return reply({ error: 'Failed to push response to COP' }, 500)
  }
}

// OPTIONS — CORS preflight
export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, { status: 204, headers: JSON_HEADERS })
}
