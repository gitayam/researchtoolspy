/**
 * Individual Framework Session API
 * Get and update specific framework sessions with auth + ownership checks
 */

import { getUserFromRequest } from '../_shared/auth-helpers'
import { JSON_HEADERS } from '../_shared/api-utils'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
}

/**
 * GET - Retrieve specific framework session
 *
 * Anonymous users can read PUBLIC rows (is_public=1) — required for the
 * Signal-bot's `!bcw` round-trip share URLs to work without forcing every
 * recipient to log in. Authenticated users additionally see their own
 * non-public rows.
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const userId = await getUserFromRequest(context.request, context.env)
    const sessionId = context.params.id as string

    // Public-or-owned read. Unauth users (userId=null) only see public rows;
    // we pass -1 as a never-matching user_id placeholder so the SQL still
    // parameter-binds cleanly.
    const result = await context.env.DB.prepare(`
      SELECT
        id, user_id, title, description, framework_type, status,
        data, is_public, created_at, updated_at, workspace_id
      FROM framework_sessions
      WHERE id = ? AND (is_public = 1 OR user_id = ?)
    `).bind(sessionId, userId ?? -1).first()

    if (!result) {
      return new Response(JSON.stringify({
        error: 'Framework session not found'
      }), {
        status: 404,
        headers: JSON_HEADERS,
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
      headers: JSON_HEADERS,
    })

  } catch (error) {
    console.error('[Frameworks GET by ID] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to retrieve framework session'
    }), {
      status: 500,
      headers: JSON_HEADERS,
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
        status: 401, headers: JSON_HEADERS,
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
        headers: JSON_HEADERS,
      })
    }

    // Verify ownership — user_id must match or user must be a verified workspace member
    const isOwner = String(existing.user_id) === String(userId)
    let inWorkspace = false
    if (!isOwner && existing.workspace_id) {
      const member = await context.env.DB.prepare(
        'SELECT id FROM workspace_members WHERE workspace_id = ? AND user_id = ?'
      ).bind(existing.workspace_id, userId).first()
      inWorkspace = !!member
    }
    if (!isOwner && !inWorkspace) {
      return new Response(JSON.stringify({ error: 'Not authorized to update this session' }), {
        status: 403, headers: JSON_HEADERS,
      })
    }

    const body = await context.request.json() as {
      title?: string
      description?: string
      data?: any
      status?: string
    }

    // W2 — for COM-B Analysis updates, enforce that linked_behavior_id remains set.
    // Mirrors the validation in functions/api/frameworks.ts; the per-id PUT path
    // previously bypassed it. See docs/frameworks/BEHAVIOR_FRAMEWORK_IMPROVEMENT_PLAN.md (P1-4).
    const existingType = await context.env.DB.prepare(
      'SELECT framework_type FROM framework_sessions WHERE id = ?'
    ).bind(sessionId).first()
    if (existingType?.framework_type === 'comb-analysis' && body.data !== undefined) {
      const linkedId = (body.data as any)?.linked_behavior_id
      if (!linkedId || typeof linkedId !== 'string' || linkedId.trim().length === 0) {
        return new Response(JSON.stringify({
          error: 'COM-B Analysis must keep linked_behavior_id set. Cannot save without a linked Behavior Analysis.'
        }), {
          status: 400,
          headers: JSON_HEADERS,
        })
      }
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
        headers: JSON_HEADERS,
      })
    }

    updates.push('updated_at = datetime("now")')
    params.push(sessionId)
    params.push(userId)
    params.push(userId)

    // W1 — honor the workspace-membership authorization check above. Previously the
    // membership check at lines 100-113 was effectively dead because the UPDATE
    // filtered by user_id only. Now the UPDATE accepts owner OR a verified
    // workspace member of the framework's workspace.
    const result = await context.env.DB.prepare(`
      UPDATE framework_sessions
      SET ${updates.join(', ')}
      WHERE id = ?
        AND (
          user_id = ?
          OR (workspace_id IS NOT NULL AND workspace_id IN (
            SELECT workspace_id FROM workspace_members WHERE user_id = ?
          ))
        )
    `).bind(...params).run()

    if (!result.meta.changes) {
      return new Response(JSON.stringify({ error: 'Session not found or not authorized' }), {
        status: 404, headers: JSON_HEADERS,
      })
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Framework session updated successfully'
    }), {
      status: 200,
      headers: JSON_HEADERS,
    })

  } catch (error) {
    console.error('[Frameworks PUT] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to update framework session'
    }), {
      status: 500,
      headers: JSON_HEADERS,
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
        status: 401, headers: JSON_HEADERS,
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
        headers: JSON_HEADERS,
      })
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Framework session deleted successfully'
    }), {
      status: 200,
      headers: JSON_HEADERS,
    })

  } catch (error) {
    console.error('[Frameworks DELETE] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to delete framework session'
    }), {
      status: 500,
      headers: JSON_HEADERS,
    })
  }
}
