/**
 * Entity Search: Places
 * GET /api/entities/places?search=...&limit=...&workspace_id=...
 *
 * Lightweight search endpoint used by PlaceLinker components.
 * Returns matching places by name (LIKE search).
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

    let query = `SELECT * FROM places WHERE created_by = ?`
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

    const places = (results || []).map((p) => ({
      ...p,
      tags: safeJsonParse(p.tags, []),
      is_public: Boolean(p.is_public),
    }))

    return new Response(
      JSON.stringify({ success: true, places }),
      { status: 200, headers: JSON_HEADERS }
    )
  } catch (error) {
    console.error('Entity places search error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: JSON_HEADERS }
    )
  }
}
