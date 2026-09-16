/**
 * Content Library API
 * Fetches all analyzed content for a user/workspace
 */

import { getUserFromRequest } from './_shared/auth-helpers'
import { CORS_HEADERS, JSON_HEADERS } from './_shared/api-utils'

interface Env {
  DB: D1Database
  JWT_SECRET?: string
  SESSIONS?: KVNamespace
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  try {
    // Require authentication
    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: JSON_HEADERS,
      })
    }
    // Parse query parameters
    const url = new URL(request.url)
    const workspaceId = url.searchParams.get('workspace_id') || request.headers.get('X-Workspace-ID')

    if (!workspaceId) {
      return new Response(JSON.stringify({ error: 'workspace_id parameter required' }), {
        status: 400, headers: JSON_HEADERS,
      })
    }
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200)
    const offset = Math.max(parseInt(url.searchParams.get('offset') || '0'), 0)

    // Build query — scope to authenticated user's content
    let query = `
      SELECT
        id, url, url_normalized, title, author, publish_date, domain,
        summary, word_count, key_entities, created_at, updated_at,
        last_accessed_at
      FROM content_intelligence
      -- This table records its owner as user_id. The repo convention that entity
      -- tables use created_by (see CLAUDE.md) does not extend to the content_*
      -- tables, and the mismatch made every request fail with
      -- "no such column: created_by". The catch below used to mask that as an
      -- empty 200, so the Content Picker always showed "no content" rather than
      -- an error, and the feature never once returned a row.
      WHERE workspace_id = ? AND user_id = ?
    `
    const params: any[] = [workspaceId, userId]

    // Order by most recently accessed
    query += ` ORDER BY last_accessed_at DESC LIMIT ? OFFSET ?`
    params.push(limit, offset)

    const results = await env.DB.prepare(query).bind(...params).all()

    const safeJSON = (val: any, fallback: any = []) => {
      if (!val) return fallback
      try { return JSON.parse(val) } catch { return fallback }
    }
    const content = (results.results || []).map((row: any) => ({
      ...row,
      key_entities: safeJSON(row.key_entities, []),
      from_cache: false // Add cache indicator if needed
    }))

    return new Response(JSON.stringify({
      content,
      total: content.length,
      limit,
      offset
    }), {
      status: 200,
      headers: JSON_HEADERS,
    })

  } catch (error: any) {
    if (error instanceof Response) return error
    console.error('[Content Library] Error:', error)

    // A missing TABLE can legitimately mean "this deployment has not run the
    // migration yet". A missing COLUMN never can -- it is always a code/schema
    // mismatch, and masking it as an empty 200 is how several always-broken
    // queries in this codebase went unnoticed. Let that one surface.
    if (error.message?.includes('no such table')) {
      return new Response(JSON.stringify({
        content: [],
        total: 0,
        limit: 50,
        offset: 0
      }), {
        status: 200,
        headers: JSON_HEADERS,
      })
    }

    return new Response(JSON.stringify({
      error: 'Failed to fetch content library'
    }), {
      status: 500,
      headers: JSON_HEADERS,
    })
  }
}
