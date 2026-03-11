/**
 * COP Task Reassignment API
 *
 * POST /api/cop/:id/tasks/:taskId/reassign - Manual reassign or auto-assign
 *
 * Body: { assigned_to?: string, auto?: boolean }
 * If auto=true, uses the auto-assignment algorithm.
 * If assigned_to is provided, assigns directly.
 */
import type { PagesFunction } from '@cloudflare/workers-types'
import { getUserIdOrDefault } from '../../../../_shared/auth-helpers'
import { emitCopEvent } from '../../../../_shared/cop-events'
import { TASK_ASSIGNED } from '../../../../_shared/cop-event-types'
import { autoAssignTask } from '../../../../_shared/auto-assign'

interface Env {
  DB: D1Database
}

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash, X-Workspace-ID',
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, params, request } = context
  const sessionId = params.id as string
  const taskId = params.taskId as string
  const userId = await getUserIdOrDefault(request, env)

  try {
    const body = await request.json() as any

    // Verify task exists
    const task = await env.DB.prepare(
      'SELECT * FROM cop_tasks WHERE id = ? AND cop_session_id = ?'
    ).bind(taskId, sessionId).first() as any

    if (!task) {
      return new Response(JSON.stringify({ error: 'Task not found in this session' }), {
        status: 404, headers: corsHeaders,
      })
    }

    // Auto-assign mode
    if (body.auto) {
      const result = await autoAssignTask(env.DB, sessionId, taskId, task.task_type, userId)
      if (result.assigned) {
        return new Response(JSON.stringify({
          message: 'Task auto-assigned',
          assigned_to: result.assignee,
        }), { headers: corsHeaders })
      } else {
        return new Response(JSON.stringify({
          error: 'No eligible collaborator found for auto-assignment',
        }), { status: 422, headers: corsHeaders })
      }
    }

    // Manual assignment
    if (!body.assigned_to) {
      return new Response(JSON.stringify({ error: 'assigned_to or auto=true required' }), {
        status: 400, headers: corsHeaders,
      })
    }

    const now = new Date().toISOString()
    await env.DB.prepare(
      'UPDATE cop_tasks SET assigned_to = ?, updated_at = ? WHERE id = ?'
    ).bind(body.assigned_to, now, taskId).run()

    await emitCopEvent(env.DB, {
      copSessionId: sessionId,
      eventType: TASK_ASSIGNED,
      entityType: 'task',
      entityId: taskId,
      payload: {
        assigned_to: body.assigned_to,
        previous_assignee: task.assigned_to,
        strategy: 'manual',
      },
      createdBy: userId,
    })

    return new Response(JSON.stringify({
      message: 'Task reassigned',
      assigned_to: body.assigned_to,
    }), { headers: corsHeaders })
  } catch (error) {
    console.error('[COP Task Reassign] Error:', error)
    return new Response(JSON.stringify({ error: 'Failed to reassign task' }), {
      status: 500, headers: corsHeaders,
    })
  }
}

// OPTIONS - CORS preflight
export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: corsHeaders })
}
