/**
 * MOM Assessment Detail
 *
 * GET /api/mom-assessments/:id — Get single assessment
 * PUT /api/mom-assessments/:id — Update assessment
 * DELETE /api/mom-assessments/:id — Delete assessment
 */

import type { PagesFunction } from '@cloudflare/workers-types'
import { getUserFromRequest } from '../_shared/auth-helpers'
import { JSON_HEADERS } from '../_shared/api-utils'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const assessmentId = params.id as string

  try {
    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: JSON_HEADERS,
      })
    }

    const assessment = await env.DB.prepare(
      'SELECT * FROM mom_assessments WHERE id = ? AND created_by = ?'
    ).bind(assessmentId, String(userId)).first()

    if (!assessment) {
      return new Response(JSON.stringify({ error: 'Assessment not found' }), {
        status: 404, headers: JSON_HEADERS,
      })
    }

    return new Response(JSON.stringify(assessment), { headers: JSON_HEADERS })
  } catch (error) {
    console.error('[mom-assessments/id] GET error:', error)
    return new Response(JSON.stringify({ error: 'Failed to fetch assessment' }), {
      status: 500, headers: JSON_HEADERS,
    })
  }
}

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const assessmentId = params.id as string

  try {
    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: JSON_HEADERS,
      })
    }

    // Verify ownership
    const existing = await env.DB.prepare(
      'SELECT id FROM mom_assessments WHERE id = ? AND created_by = ?'
    ).bind(assessmentId, String(userId)).first()

    if (!existing) {
      return new Response(JSON.stringify({ error: 'Assessment not found' }), {
        status: 404, headers: JSON_HEADERS,
      })
    }

    const body = await request.json() as any
    const now = new Date().toISOString()

    await env.DB.prepare(`
      UPDATE mom_assessments
      SET scenario_description = COALESCE(?, scenario_description),
          motive = COALESCE(?, motive),
          opportunity = COALESCE(?, opportunity),
          means = COALESCE(?, means),
          notes = COALESCE(?, notes),
          updated_at = ?
      WHERE id = ? AND created_by = ?
    `).bind(
      body.scenario_description ?? null,
      body.motive ?? null,
      body.opportunity ?? null,
      body.means ?? null,
      body.notes ?? null,
      now,
      assessmentId,
      String(userId)
    ).run()

    const assessment = await env.DB.prepare(
      'SELECT * FROM mom_assessments WHERE id = ?'
    ).bind(assessmentId).first()

    return new Response(JSON.stringify(assessment), { headers: JSON_HEADERS })
  } catch (error) {
    console.error('[mom-assessments/id] PUT error:', error)
    return new Response(JSON.stringify({ error: 'Failed to update assessment' }), {
      status: 500, headers: JSON_HEADERS,
    })
  }
}

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const assessmentId = params.id as string

  try {
    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: JSON_HEADERS,
      })
    }

    const result = await env.DB.prepare(
      'DELETE FROM mom_assessments WHERE id = ? AND created_by = ?'
    ).bind(assessmentId, String(userId)).run()

    if (result.meta.changes === 0) {
      return new Response(JSON.stringify({ error: 'Assessment not found' }), {
        status: 404, headers: JSON_HEADERS,
      })
    }

    return new Response(JSON.stringify({ message: 'Assessment deleted' }), {
      headers: JSON_HEADERS,
    })
  } catch (error) {
    console.error('[mom-assessments/id] DELETE error:', error)
    return new Response(JSON.stringify({ error: 'Failed to delete assessment' }), {
      status: 500, headers: JSON_HEADERS,
    })
  }
}
