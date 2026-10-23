/**
 * Survey <-> COP Session Link/Unlink
 *
 * POST   /api/surveys/:id/link-cop  - Link survey to a COP session
 * DELETE /api/surveys/:id/link-cop  - Unlink survey from COP session
 */
import type { PagesFunction } from '@cloudflare/workers-types'
import { getUserFromRequest, requireCopEditor } from '../../_shared/auth-helpers'
import { JSON_HEADERS } from '../../_shared/api-utils'

interface Env {
  DB: D1Database
}

// POST — Link survey to COP session
export const onRequestPost: PagesFunction<Env> = async (context) => {
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
    const copSessionId = body.cop_session_id

    if (!copSessionId || typeof copSessionId !== 'string') {
      return new Response(JSON.stringify({ error: 'cop_session_id is required' }), {
        status: 400, headers: JSON_HEADERS,
      })
    }

    // A linked form files its submissions on the COP: the session's owner or an
    // editor/admin only (a viewer may not).
    const wsId = await requireCopEditor(env.DB, copSessionId, userId)
    if (!wsId) {
      return new Response(JSON.stringify({ error: 'Only the COP session owner or an editor can link a form to it' }), {
        status: 403, headers: JSON_HEADERS,
      })
    }

    // Link survey to COP session
    await env.DB.prepare(
      "UPDATE survey_drops SET cop_session_id = ?, updated_at = datetime('now') WHERE id = ?"
    ).bind(copSessionId, surveyId).run()

    // Backfill existing responses that don't have a cop_session_id
    await env.DB.prepare(
      'UPDATE survey_responses SET cop_session_id = ? WHERE survey_id = ? AND cop_session_id IS NULL'
    ).bind(copSessionId, surveyId).run()

    return new Response(JSON.stringify({ message: 'Survey linked to COP session' }), {
      headers: JSON_HEADERS,
    })
  } catch (error) {
    console.error('[Surveys] POST link-cop error:', error)
    return new Response(JSON.stringify({ error: 'Failed to link survey to COP session' }), {
      status: 500, headers: JSON_HEADERS,
    })
  }
}

// DELETE — Unlink survey from COP session
export const onRequestDelete: PagesFunction<Env> = async (context) => {
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

    // Unlink survey — do NOT null out cop_session_id on existing responses (preserve evidence links)
    await env.DB.prepare(
      "UPDATE survey_drops SET cop_session_id = NULL, updated_at = datetime('now') WHERE id = ?"
    ).bind(surveyId).run()

    return new Response(JSON.stringify({ message: 'Survey unlinked from COP' }), {
      headers: JSON_HEADERS,
    })
  } catch (error) {
    console.error('[Surveys] DELETE link-cop error:', error)
    return new Response(JSON.stringify({ error: 'Failed to unlink survey from COP session' }), {
      status: 500, headers: JSON_HEADERS,
    })
  }
}

// OPTIONS — CORS preflight
export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, { status: 204, headers: JSON_HEADERS })
}
