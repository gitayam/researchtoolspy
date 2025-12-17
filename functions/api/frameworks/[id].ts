/**
 * Individual Framework Session API
 * Get and update specific framework sessions with hash-based auth support
 */

import { getUserFromRequest } from '../_shared/auth-helpers'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
}

/**
 * GET - Retrieve specific framework session
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const userId = await getUserFromRequest(context.request, context.env)
    const sessionId = context.params.id as string

    if (!userId) {
      return new Response(JSON.stringify({
        error: 'Authentication required'
      }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      })
    }

    // Get framework session
    const result = await context.env.DB.prepare(`
      SELECT
        id, user_id, title, description, framework_type, status,
        data, source_url, created_at, updated_at
      FROM framework_sessions
      WHERE id = ?
    `).bind(sessionId).first()

    if (!result) {
      return new Response(JSON.stringify({
        error: 'Framework session not found'
      }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      })
    }

    // Check ownership
    if (result.user_id !== userId) {
      return new Response(JSON.stringify({
        error: 'Access denied'
      }), {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      })
    }

    // Parse data JSON
    const session = {
      ...result,
      data: result.data ? JSON.parse(result.data as string) : {}
    }

    return new Response(JSON.stringify(session), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })

  } catch (error) {
    console.error('[Frameworks GET by ID] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to retrieve framework session',
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
 * PUT - Update framework session
 */
export const onRequestPut: PagesFunction<Env> = async (context) => {
  try {
    const userId = await getUserFromRequest(context.request, context.env)
    const sessionId = context.params.id as string

    if (!userId) {
      return new Response(JSON.stringify({
        error: 'Authentication required'
      }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      })
    }

    // Check ownership first
    const existing = await context.env.DB.prepare(
      'SELECT user_id FROM framework_sessions WHERE id = ?'
    ).bind(sessionId).first()

    if (!existing) {
      return new Response(JSON.stringify({
        error: 'Framework session not found'
      }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      })
    }

    if (existing.user_id !== userId) {
      return new Response(JSON.stringify({
        error: 'Access denied'
      }), {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      })
    }

    const body = await context.request.json() as {
      title?: string
      description?: string
      data?: any
      status?: string
      source_url?: string
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
    if (body.source_url !== undefined) {
      updates.push('source_url = ?')
      params.push(body.source_url)
    }

    if (updates.length === 0) {
      return new Response(JSON.stringify({
        error: 'No fields to update'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
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
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })

  } catch (error) {
    console.error('[Frameworks PUT] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to update framework session',
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
 * DELETE - Delete framework session
 */
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  try {
    const userId = await getUserFromRequest(context.request, context.env)
    const sessionId = context.params.id as string

    if (!userId) {
      return new Response(JSON.stringify({
        error: 'Authentication required'
      }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      })
    }

    // Check ownership first
    const existing = await context.env.DB.prepare(
      'SELECT user_id FROM framework_sessions WHERE id = ?'
    ).bind(sessionId).first()

    if (!existing) {
      return new Response(JSON.stringify({
        error: 'Framework session not found'
      }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      })
    }

    if (existing.user_id !== userId) {
      return new Response(JSON.stringify({
        error: 'Access denied'
      }), {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
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
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })

  } catch (error) {
    console.error('[Frameworks DELETE] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to delete framework session',
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
