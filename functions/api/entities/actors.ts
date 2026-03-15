/**
 * Entity Search: Actors
 * GET /api/entities/actors?search=...&limit=...&workspace_id=...
 *
 * Lightweight search endpoint used by ActorLinker components.
 * Returns matching actors by name (LIKE search).
 */

import type { PagesFunction } from '@cloudflare/workers-types'
import { getUserFromRequest } from '../_shared/auth-helpers'
import { JSON_HEADERS, CORS_HEADERS, safeJsonParse } from '../_shared/api-utils'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS })
  }

  try {
    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: JSON_HEADERS }
      )
    }

    const url = new URL(request.url)
    const search = url.searchParams.get('search') || ''
    const workspaceId = url.searchParams.get('workspace_id')
    const rawLimit = parseInt(url.searchParams.get('limit') || '20', 10)
    const limit = Math.min(Math.max(rawLimit || 20, 1), 50)

    let query = `SELECT * FROM actors WHERE created_by = ?`
    const params: any[] = [String(userId)]

    if (workspaceId) {
      query += ` AND workspace_id = ?`
      params.push(workspaceId)
    }

    if (search) {
      query += ` AND name LIKE ?`
      params.push(`%${search}%`)
    }

    query += ` ORDER BY name ASC LIMIT ?`
    params.push(limit)

    const { results } = await env.DB.prepare(query).bind(...params).all()

    const actors = (results || []).map((a) => ({
      ...a,
      aliases: safeJsonParse(a.aliases, []),
      tags: safeJsonParse(a.tags, []),
      deception_profile: safeJsonParse(a.deception_profile),
      is_public: Boolean(a.is_public),
    }))

    return new Response(
      JSON.stringify({ success: true, actors }),
      { status: 200, headers: JSON_HEADERS }
    )
  } catch (error) {
    console.error('Entity actors search error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: JSON_HEADERS }
    )
  }
}
