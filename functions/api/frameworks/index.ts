/**
 * Framework Sessions API
 * Create and retrieve framework analyses with hash-based auth support
 */

import { getUserIdOrDefault, getUserFromRequest } from '../_shared/auth-helpers'
import { JSON_HEADERS, CORS_HEADERS, optionsResponse } from '../_shared/api-utils'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
}

/**
 * POST - Create new framework session
 * Supports hash-based auth for guest users, defaults to user 1
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const userId = await getUserFromRequest(context.request, context.env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: JSON_HEADERS,
      })
    }


    const body = await context.request.json() as {
      title: string
      description?: string
      framework_type: string
      data: any
      source_url?: string
      workspace_id?: string
    }

    // Validate required fields
    if (!body.title || !body.framework_type || !body.data) {
      return new Response(JSON.stringify({
        error: 'Missing required fields: title, framework_type, data'
      }), {
        status: 400,
        headers: JSON_HEADERS
      })
    }

    const workspaceId = body.workspace_id
      || context.request.headers.get('X-Workspace-ID')
      || null

    // Insert framework session
    const result = await context.env.DB.prepare(`
      INSERT INTO framework_sessions (
        user_id, workspace_id, title, description, framework_type,
        status, data, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'draft', ?, datetime('now'), datetime('now'))
      RETURNING id
    `).bind(
      userId,
      workspaceId,
      body.title,
      body.description || null,
      body.framework_type,
      JSON.stringify(body.data)
    ).first()

    if (!result?.id) {
      throw new Error('Failed to create framework session')
    }

    return new Response(JSON.stringify({
      success: true,
      id: result.id,
      message: 'Framework session saved successfully'
    }), {
      status: 201,
      headers: JSON_HEADERS
    })

  } catch (error) {
    console.error('[Frameworks POST] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to save framework session'

    }), {
      status: 500,
      headers: JSON_HEADERS
    })
  }
}

/**
 * GET - List framework sessions for current user (or public ones if not authenticated)
 * Supports hash-based auth and guest access
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    // userId may be null for anonymous viewers — that's fine; they get
    // public-only rows. Required to make `is_public=1` analyses (e.g.
    // signal-bot's `!bcw` round-trip) viewable without forcing recipients
    // to log in.
    const userId = await getUserIdOrDefault(context.request, context.env)

    const url = new URL(context.request.url)
    const frameworkType = url.searchParams.get('type')
    const idFilter = url.searchParams.get('id')
    const limit = parseInt(url.searchParams.get('limit') || '50', 10)
    const offset = parseInt(url.searchParams.get('offset') || '0', 10)

    // Single-row mode: when ?id=N is supplied, return the matching row
    // (including its `data` JSON) wrapped in {sessions: [row]}. Frontend's
    // loadAnalysis() expects this shape.
    if (idFilter) {
      const row = await context.env.DB.prepare(
        `SELECT id, user_id, title, description, framework_type, status,
                data, is_public, created_at, updated_at, workspace_id
         FROM framework_sessions
         WHERE id = ? AND (is_public = 1 OR user_id = ?)`,
      )
        .bind(idFilter, userId ?? -1)
        .first()
      if (!row) {
        return new Response(
          JSON.stringify({ error: 'Framework session not found' }),
          { status: 404, headers: JSON_HEADERS },
        )
      }
      return new Response(JSON.stringify(row), {
        status: 200,
        headers: JSON_HEADERS,
      })
    }

    let query = `
      SELECT
        id, title, description, framework_type, status,
        created_at, updated_at, user_id, workspace_id
      FROM framework_sessions
      WHERE 1=1
    `
    const params: any[] = []

    // If authenticated, show user's frameworks OR public ones
    // If not authenticated, show only public ones
    if (userId) {
      query += ` AND (user_id = ? OR is_public = 1)`
      params.push(userId)
    } else {
      query += ` AND is_public = 1`
    }

    if (frameworkType) {
      query += ` AND framework_type = ?`
      params.push(frameworkType)
    }

    query += ` ORDER BY updated_at DESC LIMIT ? OFFSET ?`
    params.push(limit, offset)

    const result = await context.env.DB.prepare(query).bind(...params).all()

    return new Response(JSON.stringify({
      sessions: result.results || [],
      total: result.results?.length || 0
    }), {
      status: 200,
      headers: JSON_HEADERS
    })

  } catch (error) {
    console.error('[Frameworks GET] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to retrieve framework sessions'

    }), {
      status: 500,
      headers: JSON_HEADERS
    })
  }
}

/**
 * OPTIONS - CORS preflight
 */
export const onRequestOptions: PagesFunction = async () => {
  return optionsResponse()
}
