/**
 * Individual Framework Session API
 * Get and update specific framework sessions with hash-based auth support
 */

import { getUserFromRequest, getUserIdOrDefault } from '../_shared/auth-helpers'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
}

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash, X-Workspace-ID',
}

/**
 * OPTIONS - CORS preflight
 */
export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, { status: 204, headers: corsHeaders })
}

/**
 * Get user ID supporting both Bearer token and X-User-Hash header
 */
function resolveUserId(request: Request): number {
  // Check Authorization: Bearer <hash>
  const auth = request.headers.get('Authorization')
  if (auth?.startsWith('Bearer ')) {
    try { return JSON.parse(atob(auth.split('.')[1])).sub ?? 1 } catch { /* not JWT */ }
  }
  // Check X-User-Hash header (COP-style auth)
  const hash = request.headers.get('X-User-Hash')
  if (hash) return parseInt(hash, 10) || 1
  return 1
}

/**
 * GET - Retrieve specific framework session
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const userId = resolveUserId(context.request)
    const sessionId = context.params.id as string

    // Get framework session
    const result = await context.env.DB.prepare(`
      SELECT
        id, user_id, title, description, framework_type, status,
        data, created_at, updated_at, workspace_id
      FROM framework_sessions
      WHERE id = ?
    `).bind(sessionId).first()

    if (!result) {
      return new Response(JSON.stringify({
        error: 'Framework session not found'
      }), {
        status: 404,
        headers: corsHeaders,
      })
    }

    // Parse data JSON
    const session = {
      ...result,
      data: result.data ? JSON.parse(result.data as string) : {}
    }

    return new Response(JSON.stringify(session), {
      status: 200,
      headers: corsHeaders,
    })

  } catch (error) {
    console.error('[Frameworks GET by ID] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to retrieve framework session',
      details: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: corsHeaders,
    })
  }
}

/**
 * PUT - Update framework session
 */
export const onRequestPut: PagesFunction<Env> = async (context) => {
  try {
    const userId = resolveUserId(context.request)
    const sessionId = context.params.id as string

    // Check existence
    const existing = await context.env.DB.prepare(
      'SELECT user_id FROM framework_sessions WHERE id = ?'
    ).bind(sessionId).first()

    if (!existing) {
      return new Response(JSON.stringify({
        error: 'Framework session not found'
      }), {
        status: 404,
        headers: corsHeaders,
      })
    }

    const body = await context.request.json() as {
      title?: string
      description?: string
      data?: any
      status?: string
    }

    // Build update query dynamically
    const updates: string[] = []
    const params: any[] = []

    if (body.title !== undefined) {
      updates.push('title = ?')
      params.push(body.title)
    }
    if (body.description !== undefined) {
      updates.push('description = ?')
      params.push(body.description)
    }
    if (body.data !== undefined) {
      updates.push('data = ?')
      params.push(JSON.stringify(body.data))
    }
    if (body.status !== undefined) {
      updates.push('status = ?')
      params.push(body.status)
    }

    if (updates.length === 0) {
      return new Response(JSON.stringify({
        error: 'No fields to update'
      }), {
        status: 400,
        headers: corsHeaders,
      })
    }

    updates.push('updated_at = datetime("now")')
    params.push(sessionId)

    await context.env.DB.prepare(`
      UPDATE framework_sessions
      SET ${updates.join(', ')}
      WHERE id = ?
    `).bind(...params).run()

    return new Response(JSON.stringify({
      success: true,
      message: 'Framework session updated successfully'
    }), {
      status: 200,
      headers: corsHeaders,
    })

  } catch (error) {
    console.error('[Frameworks PUT] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to update framework session',
      details: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: corsHeaders,
    })
  }
}

/**
 * DELETE - Delete framework session
 */
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  try {
    const userId = resolveUserId(context.request)
    const sessionId = context.params.id as string

    // Check existence
    const existing = await context.env.DB.prepare(
      'SELECT user_id FROM framework_sessions WHERE id = ?'
    ).bind(sessionId).first()

    if (!existing) {
      return new Response(JSON.stringify({
        error: 'Framework session not found'
      }), {
        status: 404,
        headers: corsHeaders,
      })
    }

    await context.env.DB.prepare(
      'DELETE FROM framework_sessions WHERE id = ?'
    ).bind(sessionId).run()

    return new Response(JSON.stringify({
      success: true,
      message: 'Framework session deleted successfully'
    }), {
      status: 200,
      headers: corsHeaders,
    })

  } catch (error) {
    console.error('[Frameworks DELETE] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to delete framework session',
      details: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: corsHeaders,
    })
  }
}
