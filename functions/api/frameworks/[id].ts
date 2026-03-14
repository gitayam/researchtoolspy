/**
 * Individual Framework Session API
 * Get and update specific framework sessions with auth + ownership checks
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
 * GET - Retrieve specific framework session
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const userId = await getUserIdOrDefault(context.request, context.env)
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
    let parsedData = {}
    if (result.data) {
      try { parsedData = JSON.parse(result.data as string) } catch { /* corrupted data */ }
    }

    const session = {
      ...result,
      data: parsedData
    }

    return new Response(JSON.stringify(session), {
      status: 200,
      headers: corsHeaders,
    })

  } catch (error) {
    console.error('[Frameworks GET by ID] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to retrieve framework session'
    }), {
      status: 500,
      headers: corsHeaders,
    })
  }
}

/**
 * PUT - Update framework session (auth + ownership required)
 */
export const onRequestPut: PagesFunction<Env> = async (context) => {
  try {
    const userId = await getUserFromRequest(context.request, context.env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: corsHeaders,
      })
    }

    const sessionId = context.params.id as string

    // Check existence and ownership
    const existing = await context.env.DB.prepare(
      'SELECT user_id, workspace_id FROM framework_sessions WHERE id = ?'
    ).bind(sessionId).first()

    if (!existing) {
      return new Response(JSON.stringify({
        error: 'Framework session not found'
      }), {
        status: 404,
        headers: corsHeaders,
      })
    }

    // Verify ownership — user_id must match or workspace must match
    const workspaceId = context.request.headers.get('X-Workspace-ID')
    const isOwner = existing.user_id === userId
    const inWorkspace = workspaceId && existing.workspace_id === workspaceId
    if (!isOwner && !inWorkspace) {
      return new Response(JSON.stringify({ error: 'Not authorized to update this session' }), {
        status: 403, headers: corsHeaders,
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
    params.push(userId)

    const result = await context.env.DB.prepare(`
      UPDATE framework_sessions
      SET ${updates.join(', ')}
      WHERE id = ? AND user_id = ?
    `).bind(...params).run()

    if (!result.meta.changes) {
      return new Response(JSON.stringify({ error: 'Session not found or not owned by you' }), {
        status: 404, headers: corsHeaders,
      })
    }

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
      error: 'Failed to update framework session'
    }), {
      status: 500,
      headers: corsHeaders,
    })
  }
}

/**
 * DELETE - Delete framework session (auth + ownership required)
 */
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  try {
    const userId = await getUserFromRequest(context.request, context.env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: corsHeaders,
      })
    }

    const sessionId = context.params.id as string

    // Delete with ownership check
    const result = await context.env.DB.prepare(
      'DELETE FROM framework_sessions WHERE id = ? AND user_id = ?'
    ).bind(sessionId, userId).run()

    if (!result.meta.changes) {
      return new Response(JSON.stringify({
        error: 'Framework session not found or not owned by you'
      }), {
        status: 404,
        headers: corsHeaders,
      })
    }

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
      error: 'Failed to delete framework session'
    }), {
      status: 500,
      headers: corsHeaders,
    })
  }
}
