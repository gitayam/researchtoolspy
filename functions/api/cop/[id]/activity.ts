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

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
}

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash, X-Workspace-ID',
}

function getUserId(request: Request): number {
  const auth = request.headers.get('Authorization')
  if (auth?.startsWith('Bearer ')) {
    try { return JSON.parse(atob(auth.split('.')[1])).sub ?? 1 } catch { return 1 }
  }
  return parseInt(request.headers.get('X-User-Hash') ?? '1', 10) || 1
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

    return new Response(JSON.stringify({ activity, total }), { headers: corsHeaders })
  } catch (error) {
    console.error('[COP Activity] GET error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to fetch activity',
      details: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500, headers: corsHeaders,
    })
  }
}

// POST - Log a new activity event
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const sessionId = params.id as string

  try {
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
        status: 400, headers: corsHeaders,
      })
    }

    const id = crypto.randomUUID()
    const userId = getUserId(request)
    const createdAt = new Date().toISOString().replace('T', ' ').replace('Z', '').slice(0, 19)

    try {
      await env.DB.prepare(
        `INSERT INTO cop_activity (id, cop_session_id, user_id, action, entity_type, entity_id, summary, actor_name, details, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        id,
        sessionId,
        userId,
        body.action,
        body.entity_type ?? null,
        body.entity_id ?? null,
        body.summary ?? null,
        body.actor_name ?? null,
        body.details ?? null,
        createdAt,
      ).run()
    } catch (dbError) {
      // Table may not exist yet — log but don't fail the request
      console.warn('[COP Activity] INSERT failed (table may not exist):', dbError)
    }

    return new Response(JSON.stringify({
      activity: {
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
      },
    }), { status: 201, headers: corsHeaders })
  } catch (error) {
    console.error('[COP Activity] POST error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to log activity',
      details: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500, headers: corsHeaders,
    })
  }
}

// OPTIONS - CORS preflight
export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: corsHeaders })
}
