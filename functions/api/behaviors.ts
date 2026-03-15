/**
 * Behaviors API
 * Manages behaviors (TTPs, patterns, tactics, techniques, procedures)
 */

import type { PagesFunction } from '@cloudflare/workers-types'
import { getUserIdOrDefault, getUserFromRequest } from './_shared/auth-helpers'
import { checkWorkspaceAccess } from './_shared/workspace-helpers'
import { generateId, CORS_HEADERS, JSON_HEADERS, safeJsonParse } from './_shared/api-utils'

interface Env {
  DB: D1Database
  SESSIONS: KVNamespace
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  const url = new URL(request.url)
  const method = request.method

  if (method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS })
  }

  try {
    const userId = await getUserIdOrDefault(request, env)

    // GET /api/behaviors?workspace_id=xxx
    if (method === 'GET' && url.pathname === '/api/behaviors') {
      const workspaceId = url.searchParams.get('workspace_id')
      if (!workspaceId) {
        return new Response(
          JSON.stringify({ error: 'workspace_id parameter required' }),
          { status: 400, headers: JSON_HEADERS }
        )
      }

      if (!(await checkWorkspaceAccess(workspaceId, userId, env))) {
        return new Response(
          JSON.stringify({ error: 'Access denied to workspace' }),
          { status: 403, headers: JSON_HEADERS }
        )
      }

      let query = `SELECT * FROM behaviors WHERE workspace_id = ?`
      const params: any[] = [workspaceId]

      const behaviorType = url.searchParams.get('behavior_type')
      if (behaviorType) {
        query += ` AND behavior_type = ?`
        params.push(behaviorType)
      }

      const frequency = url.searchParams.get('frequency')
      if (frequency) {
        query += ` AND frequency = ?`
        params.push(frequency)
      }

      const sophistication = url.searchParams.get('sophistication')
      if (sophistication) {
        query += ` AND sophistication = ?`
        params.push(sophistication)
      }

      const search = url.searchParams.get('search')
      if (search) {
        query += ` AND (name LIKE ? OR description LIKE ?)`
        params.push(`%${search}%`, `%${search}%`)
      }

      query += ` ORDER BY created_at DESC`

      const limit = url.searchParams.get('limit')
      query += ` LIMIT ?`
      params.push(Math.min(parseInt(limit || '500') || 500, 500))

      const { results } = await env.DB.prepare(query).bind(...params).all()

      const behaviors = results.map(b => ({
        ...b,
        indicators: safeJsonParse(b.indicators, []),
        is_public: Boolean(b.is_public)
      }))

      return new Response(
        JSON.stringify(behaviors),
        { status: 200, headers: JSON_HEADERS }
      )
    }

    // POST /api/behaviors
    if (method === 'POST' && url.pathname === '/api/behaviors') {
      const authUserId = await getUserFromRequest(request, env)
      if (!authUserId) {
        return new Response(JSON.stringify({ error: 'Authentication required' }), {
          status: 401, headers: JSON_HEADERS,
        })
      }

      const body = await request.json() as any

      if (!body.name || !body.behavior_type || !body.workspace_id) {
        return new Response(
          JSON.stringify({ error: 'Missing required fields: name, behavior_type, workspace_id' }),
          { status: 400, headers: JSON_HEADERS }
        )
      }

      if (!(await checkWorkspaceAccess(body.workspace_id, authUserId, env, 'EDITOR'))) {
        return new Response(
          JSON.stringify({ error: 'Insufficient permissions' }),
          { status: 403, headers: JSON_HEADERS }
        )
      }

      const id = generateId()
      const now = new Date().toISOString()

      await env.DB.prepare(`
        INSERT INTO behaviors (
          id, name, description, behavior_type,
          indicators, frequency, first_observed, last_observed,
          sophistication, effectiveness,
          behavior_analysis_id,
          workspace_id, created_by, created_at, updated_at,
          is_public, votes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id,
        body.name,
        body.description || null,
        body.behavior_type,
        body.indicators ? JSON.stringify(body.indicators) : null,
        body.frequency || null,
        body.first_observed || null,
        body.last_observed || null,
        body.sophistication || null,
        body.effectiveness || null,
        body.behavior_analysis_id || null,
        body.workspace_id,
        authUserId,
        now,
        now,
        body.is_public ? 1 : 0,
        0
      ).run()

      // Link actors if provided
      if (body.actor_ids && Array.isArray(body.actor_ids)) {
        for (const actorId of body.actor_ids) {
          await env.DB.prepare(`
            INSERT INTO actor_behaviors (actor_id, behavior_id, frequency, last_exhibited)
            VALUES (?, ?, ?, ?)
          `).bind(
            actorId,
            id,
            body.actor_frequencies?.[actorId] || null,
            body.actor_last_exhibited?.[actorId] || null
          ).run()
        }
      }

      // Update workspace entity count
      await env.DB.prepare(`
        UPDATE workspaces
        SET entity_count = json_set(
          COALESCE(entity_count, '{}'),
          '$.behaviors',
          COALESCE(json_extract(entity_count, '$.behaviors'), 0) + 1
        ),
        updated_at = ?
        WHERE id = ?
      `).bind(now, body.workspace_id).run()

      const behavior = await env.DB.prepare(`
        SELECT * FROM behaviors WHERE id = ?
      `).bind(id).first()

      if (!behavior) {
        return new Response(
          JSON.stringify({ success: true, id }),
          { status: 201, headers: JSON_HEADERS }
        )
      }

      return new Response(
        JSON.stringify({
          ...behavior,
          indicators: safeJsonParse(behavior.indicators, []),
          is_public: Boolean(behavior.is_public)
        }),
        { status: 201, headers: JSON_HEADERS }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: JSON_HEADERS }
    )

  } catch (error) {
    console.error('Behaviors API error:', error)
    return new Response(
      JSON.stringify({
        error: 'Internal server error'

      }),
      { status: 500, headers: JSON_HEADERS }
    )
  }
}
