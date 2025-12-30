/**
 * Framework Sessions API
 * Create and retrieve framework analyses with hash-based auth support
 */

import { getUserIdOrDefault } from '../_shared/auth-helpers'

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
    // Get user ID - defaults to 1 if not authenticated (backward compatibility)
    const userId = await getUserIdOrDefault(context.request, context.env)

    console.log('[Frameworks POST /index] Creating framework for user:', userId)

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
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      })
    }

    const workspaceId = body.workspace_id || '1'

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
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })

  } catch (error) {
    console.error('[Frameworks POST] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to save framework session',
      details: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })
  }
}

/**
 * GET - List framework sessions for current user (or public ones if not authenticated)
 * Supports hash-based auth and guest access
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    // Allow unauthenticated access - will show only public frameworks if not logged in
    const userId = await getUserIdOrDefault(context.request, context.env)

    const url = new URL(context.request.url)
    const frameworkType = url.searchParams.get('type')
    const limit = parseInt(url.searchParams.get('limit') || '50')
    const offset = parseInt(url.searchParams.get('offset') || '0')

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
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })

  } catch (error) {
    console.error('[Frameworks GET] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to retrieve framework sessions',
      details: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })
  }
}

/**
 * OPTIONS - CORS preflight
 */
export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-User-Hash"
    }
  })
}
