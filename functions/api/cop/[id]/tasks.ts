/**
 * COP Task Board API - Investigative Actions
 *
 * GET    /api/cop/:id/tasks          - List tasks (optional ?status=todo&assigned_to=name)
 * POST   /api/cop/:id/tasks          - Create task
 * PUT    /api/cop/:id/tasks          - Update task (id in body)
 * DELETE /api/cop/:id/tasks?task_id=x - Delete task
 */
import type { PagesFunction } from '@cloudflare/workers-types'
import { getUserFromRequest } from '../../_shared/auth-helpers'
import { emitCopEvent } from '../../_shared/cop-events'
import { TASK_CREATED, TASK_COMPLETED, TASK_STARTED, TASK_BLOCKED, TASK_UNBLOCKED, TASK_DELETED } from '../../_shared/cop-event-types'

interface Env {
  DB: D1Database
}

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash, X-Workspace-ID',
}

function generateId(): string {
  return `tsk-${crypto.randomUUID().slice(0, 12)}`
}

const VALID_STATUSES = ['todo', 'in_progress', 'done', 'blocked']
const VALID_PRIORITIES = ['low', 'medium', 'high', 'critical']
const VALID_TASK_TYPES = ['pimeyes', 'geoguessr', 'forensic', 'osint', 'reverse_image', 'social_media', 'general']

// GET - List tasks for a COP session
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params, request } = context
  const sessionId = params.id as string
  const url = new URL(request.url)
  const statusFilter = url.searchParams.get('status')
  const assignedFilter = url.searchParams.get('assigned_to')

  try {
    let query = 'SELECT * FROM cop_tasks WHERE cop_session_id = ?'
    const bindings: any[] = [sessionId]

    if (statusFilter && VALID_STATUSES.includes(statusFilter)) {
      query += ' AND status = ?'
      bindings.push(statusFilter)
    }

    if (assignedFilter) {
      query += ' AND assigned_to = ?'
      bindings.push(assignedFilter)
    }

    query += ` ORDER BY
      CASE priority
        WHEN 'critical' THEN 0
        WHEN 'high' THEN 1
        WHEN 'medium' THEN 2
        WHEN 'low' THEN 3
      END,
      created_at DESC`

    const rows = await env.DB.prepare(query).bind(...bindings).all()

    return new Response(JSON.stringify({ tasks: rows.results || [] }), { headers: corsHeaders })
  } catch (error) {
    console.error('[COP Tasks] List error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to list tasks',
    }), { status: 500, headers: corsHeaders })
  }
}

// POST - Create a new task
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const sessionId = params.id as string

  try {
    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: corsHeaders,
      })
    }
    const body = await request.json() as any

    if (!body.title?.trim()) {
      return new Response(JSON.stringify({ error: 'Title is required' }), {
        status: 400, headers: corsHeaders,
      })
    }

    // Look up session workspace_id
    const session = await env.DB.prepare(
      'SELECT workspace_id FROM cop_sessions WHERE id = ?'
    ).bind(sessionId).first() as any

    const workspaceId = session?.workspace_id || request.headers.get('X-Workspace-ID') || sessionId

    const id = generateId()
    const now = new Date().toISOString()
    const status = VALID_STATUSES.includes(body.status) ? body.status : 'todo'
    const priority = VALID_PRIORITIES.includes(body.priority) ? body.priority : 'medium'
    const taskType = VALID_TASK_TYPES.includes(body.task_type) ? body.task_type : 'general'

    // Subtask support: validate parent and depth
    const parentTaskId = body.parent_task_id || null
    let depth = 0
    const position = typeof body.position === 'number' ? body.position : 0

    if (parentTaskId) {
      const parent = await env.DB.prepare(
        'SELECT id, depth FROM cop_tasks WHERE id = ? AND cop_session_id = ?'
      ).bind(parentTaskId, sessionId).first() as any

      if (!parent) {
        return new Response(JSON.stringify({ error: 'Parent task not found in this session' }), {
          status: 404, headers: corsHeaders,
        })
      }

      depth = (parent.depth || 0) + 1
      if (depth > 2) {
        return new Response(JSON.stringify({ error: 'Maximum subtask depth is 2' }), {
          status: 400, headers: corsHeaders,
        })
      }
    }

    await env.DB.prepare(`
      INSERT INTO cop_tasks (
        id, cop_session_id, title, description, status, priority, task_type,
        assigned_to, linked_persona_id, linked_marker_id, linked_hypothesis_id,
        due_date, completed_at, parent_task_id, depth, position,
        created_by, workspace_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, sessionId, body.title.trim(), body.description || null,
      status, priority, taskType,
      body.assigned_to || null,
      body.linked_persona_id || null,
      body.linked_marker_id || null,
      body.linked_hypothesis_id || null,
      body.due_date || null,
      status === 'done' ? now : null,
      parentTaskId, depth, position,
      userId, workspaceId, now, now,
    ).run()

    await emitCopEvent(env.DB, {
      copSessionId: sessionId,
      eventType: TASK_CREATED,
      entityType: 'task',
      entityId: id,
      payload: { title: body.title, task_type: taskType, priority, assigned_to: body.assigned_to || null },
      createdBy: userId,
    })

    return new Response(JSON.stringify({ id, message: 'Task created' }), {
      status: 201, headers: corsHeaders,
    })
  } catch (error) {
    console.error('[COP Tasks] Create error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to create task',
    }), { status: 500, headers: corsHeaders })
  }
}

// PUT - Update an existing task
export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const sessionId = params.id as string

  try {
    const body = await request.json() as any

    if (!body.id) {
      return new Response(JSON.stringify({ error: 'Task id is required in body' }), {
        status: 400, headers: corsHeaders,
      })
    }

    // Verify task belongs to this session
    const existing = await env.DB.prepare(
      'SELECT * FROM cop_tasks WHERE id = ? AND cop_session_id = ?'
    ).bind(body.id, sessionId).first() as any

    if (!existing) {
      return new Response(JSON.stringify({ error: 'Task not found in this session' }), {
        status: 404, headers: corsHeaders,
      })
    }

    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: corsHeaders,
      })
    }
    const now = new Date().toISOString()

    // Block transition to in_progress if dependencies unmet
    if (body.status === 'in_progress' && existing.status !== 'in_progress') {
      const unmetDeps = await env.DB.prepare(`
        SELECT d.depends_on_task_id, t.title, t.status
        FROM cop_task_dependencies d
        JOIN cop_tasks t ON t.id = d.depends_on_task_id
        WHERE d.task_id = ? AND t.status != 'done'
      `).bind(body.id).all()

      if ((unmetDeps.results || []).length > 0) {
        const blocking = (unmetDeps.results as any[]).map(r => r.title).join(', ')
        return new Response(JSON.stringify({
          error: `Cannot start: blocked by unfinished dependencies: ${blocking}`,
        }), { status: 400, headers: corsHeaders })
      }
    }

    const updates: string[] = []
    const bindings: any[] = []

    // Build dynamic update
    if (body.title !== undefined) {
      updates.push('title = ?')
      bindings.push(body.title.trim())
    }
    if (body.description !== undefined) {
      updates.push('description = ?')
      bindings.push(body.description || null)
    }
    if (body.status !== undefined && VALID_STATUSES.includes(body.status)) {
      updates.push('status = ?')
      bindings.push(body.status)
      // Auto-set completed_at when transitioning to done
      if (body.status === 'done' && existing.status !== 'done') {
        updates.push('completed_at = ?')
        bindings.push(now)
      } else if (body.status !== 'done' && existing.status === 'done') {
        // Clear completed_at when moving out of done
        updates.push('completed_at = ?')
        bindings.push(null)
      }
    }
    if (body.priority !== undefined && VALID_PRIORITIES.includes(body.priority)) {
      updates.push('priority = ?')
      bindings.push(body.priority)
    }
    if (body.task_type !== undefined && VALID_TASK_TYPES.includes(body.task_type)) {
      updates.push('task_type = ?')
      bindings.push(body.task_type)
    }
    if (body.assigned_to !== undefined) {
      updates.push('assigned_to = ?')
      bindings.push(body.assigned_to || null)
    }
    if (body.linked_persona_id !== undefined) {
      updates.push('linked_persona_id = ?')
      bindings.push(body.linked_persona_id || null)
    }
    if (body.linked_marker_id !== undefined) {
      updates.push('linked_marker_id = ?')
      bindings.push(body.linked_marker_id || null)
    }
    if (body.linked_hypothesis_id !== undefined) {
      updates.push('linked_hypothesis_id = ?')
      bindings.push(body.linked_hypothesis_id || null)
    }
    if (body.due_date !== undefined) {
      updates.push('due_date = ?')
      bindings.push(body.due_date || null)
    }
    if (body.sla_hours !== undefined) {
      updates.push('sla_hours = ?')
      bindings.push(body.sla_hours || null)
    }
    if (body.sla_started_at !== undefined) {
      updates.push('sla_started_at = ?')
      bindings.push(body.sla_started_at || null)
    }

    if (updates.length === 0) {
      return new Response(JSON.stringify({ error: 'No valid fields to update' }), {
        status: 400, headers: corsHeaders,
      })
    }

    updates.push('updated_at = ?')
    bindings.push(now)
    bindings.push(body.id, sessionId)

    await env.DB.prepare(
      `UPDATE cop_tasks SET ${updates.join(', ')} WHERE id = ? AND cop_session_id = ?`
    ).bind(...bindings).run()

    // Emit event for status transitions
    if (body.status && body.status !== existing.status) {
      const statusEventMap: Record<string, string> = {
        'in_progress': TASK_STARTED,
        'done': TASK_COMPLETED,
        'blocked': TASK_BLOCKED,
      }
      const eventType = statusEventMap[body.status]
      if (eventType) {
        await emitCopEvent(env.DB, {
          copSessionId: sessionId,
          eventType: eventType as any,
          entityType: 'task',
          entityId: body.id,
          payload: { title: existing.title, previous_status: existing.status, new_status: body.status, assigned_to: existing.assigned_to },
          createdBy: userId,
        })
      }

      // After status change to 'done', check parent subtask rollup
      if (body.status === 'done' && existing.parent_task_id) {
        const siblings = await env.DB.prepare(
          'SELECT status FROM cop_tasks WHERE parent_task_id = ? AND id != ?'
        ).bind(existing.parent_task_id, body.id).all()

        const allDone = (siblings.results || []).every((s: any) => s.status === 'done')
        if (allDone) {
          await env.DB.prepare(
            'UPDATE cop_tasks SET status = ?, completed_at = ?, updated_at = ? WHERE id = ?'
          ).bind('done', now, now, existing.parent_task_id).run()

          await emitCopEvent(env.DB, {
            copSessionId: sessionId,
            eventType: TASK_COMPLETED,
            entityType: 'task',
            entityId: existing.parent_task_id,
            payload: { reason: 'all_subtasks_completed' },
            createdBy: userId,
          })
        }
      }

      // Check if completing this task unblocks others
      if (body.status === 'done') {
        const dependents = await env.DB.prepare(
          'SELECT DISTINCT task_id FROM cop_task_dependencies WHERE depends_on_task_id = ? AND cop_session_id = ?'
        ).bind(body.id, sessionId).all()

        for (const dep of (dependents.results || []) as any[]) {
          const remaining = await env.DB.prepare(`
            SELECT COUNT(*) as cnt FROM cop_task_dependencies d
            JOIN cop_tasks t ON t.id = d.depends_on_task_id
            WHERE d.task_id = ? AND t.status != 'done'
          `).bind(dep.task_id).first() as any

          if (remaining?.cnt === 0) {
            await emitCopEvent(env.DB, {
              copSessionId: sessionId,
              eventType: TASK_UNBLOCKED,
              entityType: 'task',
              entityId: dep.task_id,
              payload: { unblocked_by: body.id },
              createdBy: userId,
            })
          }
        }
      }
    }

    return new Response(JSON.stringify({ id: body.id, message: 'Task updated' }), { headers: corsHeaders })
  } catch (error) {
    console.error('[COP Tasks] Update error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to update task',
    }), { status: 500, headers: corsHeaders })
  }
}

// DELETE - Delete a task
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const sessionId = params.id as string
  const url = new URL(request.url)
  const taskId = url.searchParams.get('task_id')

  try {
    if (!taskId) {
      return new Response(JSON.stringify({ error: 'task_id query param is required' }), {
        status: 400, headers: corsHeaders,
      })
    }

    // Fetch task before deleting for event payload
    const existing = await env.DB.prepare(
      'SELECT title FROM cop_tasks WHERE id = ? AND cop_session_id = ?'
    ).bind(taskId, sessionId).first() as any

    // Clean up dependencies referencing this task
    await env.DB.prepare(
      'DELETE FROM cop_task_dependencies WHERE (task_id = ? OR depends_on_task_id = ?) AND cop_session_id = ?'
    ).bind(taskId, taskId, sessionId).run()

    // Delete subtasks
    await env.DB.prepare(
      'DELETE FROM cop_tasks WHERE parent_task_id = ? AND cop_session_id = ?'
    ).bind(taskId, sessionId).run()

    const result = await env.DB.prepare(
      'DELETE FROM cop_tasks WHERE id = ? AND cop_session_id = ?'
    ).bind(taskId, sessionId).run()

    if (!result.meta.changes || result.meta.changes === 0) {
      return new Response(JSON.stringify({ error: 'Task not found in this session' }), {
        status: 404, headers: corsHeaders,
      })
    }

    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: corsHeaders,
      })
    }
    await emitCopEvent(env.DB, {
      copSessionId: sessionId,
      eventType: TASK_DELETED,
      entityType: 'task',
      entityId: taskId,
      payload: { title: existing?.title },
      createdBy: userId,
    })

    return new Response(JSON.stringify({ message: 'Task deleted' }), { headers: corsHeaders })
  } catch (error) {
    console.error('[COP Tasks] Delete error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to delete task',
    }), { status: 500, headers: corsHeaders })
  }
}

// OPTIONS - CORS preflight
export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: corsHeaders })
}
