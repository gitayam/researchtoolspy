/**
 * MOM (Motive, Opportunity, Means) Assessment API
 *
 * GET /api/mom-assessments?actor_id=...&event_id=...&workspace_id=... — List assessments
 * POST /api/mom-assessments — Create new assessment
 */

import type { PagesFunction } from '@cloudflare/workers-types'
import { getUserFromRequest } from './_shared/auth-helpers'
import { JSON_HEADERS } from './_shared/api-utils'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  try {
    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: JSON_HEADERS,
      })
    }

    const url = new URL(request.url)
    const actorId = url.searchParams.get('actor_id')
    const eventId = url.searchParams.get('event_id')
    const workspaceId = url.searchParams.get('workspace_id')

    let query = 'SELECT * FROM mom_assessments WHERE created_by = ?'
    const params: any[] = [String(userId)]

    if (actorId) {
      query += ' AND actor_id = ?'
      params.push(actorId)
    }
    if (eventId) {
      query += ' AND event_id = ?'
      params.push(eventId)
    }
    if (workspaceId) {
      query += ' AND workspace_id = ?'
      params.push(workspaceId)
    }

    query += ' ORDER BY created_at DESC'

    const { results } = await env.DB.prepare(query).bind(...params).all()

    return new Response(JSON.stringify({ assessments: results || [] }), {
      headers: JSON_HEADERS,
    })
  } catch (error) {
    console.error('[mom-assessments] GET error:', error)
    return new Response(JSON.stringify({ error: 'Failed to fetch assessments' }), {
      status: 500, headers: JSON_HEADERS,
    })
  }
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  try {
    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: JSON_HEADERS,
      })
    }

    const body = await request.json() as any

    if (!body.actor_id || !body.scenario_description || !body.workspace_id) {
      return new Response(JSON.stringify({ error: 'actor_id, scenario_description, and workspace_id are required' }), {
        status: 400, headers: JSON_HEADERS,
      })
    }

    const id = `mom-${crypto.randomUUID().slice(0, 8)}`
    const now = new Date().toISOString()

    await env.DB.prepare(`
      INSERT INTO mom_assessments (id, actor_id, event_id, scenario_description, motive, opportunity, means, notes, assessed_by, workspace_id, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      body.actor_id,
      body.event_id || null,
      body.scenario_description,
      body.motive || 0,
      body.opportunity || 0,
      body.means || 0,
      body.notes || '',
      userId,
      body.workspace_id,
      String(userId),
      now,
      now
    ).run()

    const assessment = await env.DB.prepare(
      'SELECT * FROM mom_assessments WHERE id = ?'
    ).bind(id).first()

    return new Response(JSON.stringify(assessment), {
      status: 201, headers: JSON_HEADERS,
    })
  } catch (error) {
    console.error('[mom-assessments] POST error:', error)
    return new Response(JSON.stringify({ error: 'Failed to create assessment' }), {
      status: 500, headers: JSON_HEADERS,
    })
  }
}
