/**
 * COP Workspace Activity Logging API
 *
 * GET  /api/cop/:id/activity - List recent activity for a COP session
 * POST /api/cop/:id/activity - Log a new activity event
 *
 * Tracks user actions within a COP workspace (entity creation, edits,
 * framework runs, RFI updates, etc.) for audit trail and collaboration
 * awareness.
 */

import type { PagesFunction } from '@cloudflare/workers-types'
import { getUserFromRequest } from '../../_shared/auth-helpers'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
}

// GET - List recent activity for a COP session
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const sessionId = params.id as string

  try {
    const url = new URL(request.url)
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') ?? '50', 10) || 50, 1), 200)
    const offset = Math.max(parseInt(url.searchParams.get('offset') ?? '0', 10) || 0, 0)

    let activity: any[] = []
    let total = 0

    try {
      const [activityResult, countResult] = await Promise.all([
        env.DB.prepare(
          `SELECT * FROM cop_activity WHERE cop_session_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`
        ).bind(sessionId, limit, offset).all(),

        env.DB.prepare(
          `SELECT COUNT(*) as cnt FROM cop_activity WHERE cop_session_id = ?`
        ).bind(sessionId).first<{ cnt: number }>(),
      ])
      activity = activityResult.results ?? []
      total = countResult?.cnt ?? 0
    } catch (dbError) {
      // Table may not exist yet — return empty results gracefully
      console.warn('[COP Activity] DB query failed (table may not exist):', dbError)
    }

    return new Response(JSON.stringify({ activity, total }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } })
  } catch (error) {
    console.error('[COP Activity] GET error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to fetch activity',
    }), {
      status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  }
}

// POST - Log a new activity event
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const sessionId = params.id as string

  try {
    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      })
    }

    const body = await request.json<{
      action: string
      entity_type?: string
      entity_id?: string
      summary?: string
      actor_name?: string
      details?: string
    }>()

    if (!body.action) {
      return new Response(JSON.stringify({ error: 'action is required' }), {
        status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      })
    }

    const id = crypto.randomUUID()
    const createdAt = new Date().toISOString().replace('T', ' ').replace('Z', '').slice(0, 19)

    const activity = {
      id,
      cop_session_id: sessionId,
      user_id: userId,
      action: body.action,
      entity_type: body.entity_type ?? null,
      entity_id: body.entity_id ?? null,
      summary: body.summary ?? null,
      actor_name: body.actor_name ?? null,
      details: body.details ?? null,
      created_at: createdAt,
    }

    try {
      await env.DB.prepare(
        `INSERT INTO cop_activity (id, cop_session_id, user_id, action, entity_type, entity_id, summary, actor_name, details, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        id, sessionId, userId, body.action,
        body.entity_type ?? null, body.entity_id ?? null, body.summary ?? null,
        body.actor_name ?? null, body.details ?? null, createdAt,
      ).run()
    } catch (dbError) {
      console.error('[COP Activity] INSERT failed:', dbError)
      return new Response(JSON.stringify({
        error: 'Failed to persist activity',
        activity,
      }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } })
    }

    return new Response(JSON.stringify({ activity }), { status: 201, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } })
  } catch (error) {
    console.error('[COP Activity] POST error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to log activity',
    }), {
      status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  }
}
