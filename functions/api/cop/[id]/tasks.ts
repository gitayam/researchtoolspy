/**
 * COP Task Board API - Investigative Actions
 *
 * GET    /api/cop/:id/tasks          - List tasks (optional ?status=todo&assigned_to=name)
 * POST   /api/cop/:id/tasks          - Create task
 * PUT    /api/cop/:id/tasks          - Update task (id in body)
 * DELETE /api/cop/:id/tasks?task_id=x - Delete task
 */
import type { PagesFunction } from '@cloudflare/workers-types'
import { getUserIdOrDefault } from '../../_shared/auth-helpers'

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
      details: error instanceof Error ? error.message : 'Unknown error',
    }), { status: 500, headers: corsHeaders })
  }
}

// POST - Create a new task
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const sessionId = params.id as string

  try {
    const userId = await getUserIdOrDefault(request, env)
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

    const workspaceId = session?.workspace_id || request.headers.get('X-Workspace-ID') || '1'

    const id = generateId()
    const now = new Date().toISOString()
    const status = VALID_STATUSES.includes(body.status) ? body.status : 'todo'
    const priority = VALID_PRIORITIES.includes(body.priority) ? body.priority : 'medium'
    const taskType = VALID_TASK_TYPES.includes(body.task_type) ? body.task_type : 'general'

    await env.DB.prepare(`
      INSERT INTO cop_tasks (
        id, cop_session_id, title, description, status, priority, task_type,
        assigned_to, linked_persona_id, linked_marker_id, linked_hypothesis_id,
        due_date, completed_at, created_by, workspace_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, sessionId, body.title.trim(), body.description || null,
      status, priority, taskType,
      body.assigned_to || null,
      body.linked_persona_id || null,
      body.linked_marker_id || null,
      body.linked_hypothesis_id || null,
      body.due_date || null,
      status === 'done' ? now : null,
      userId, workspaceId, now, now,
    ).run()

    return new Response(JSON.stringify({ id, message: 'Task created' }), {
      status: 201, headers: corsHeaders,
    })
  } catch (error) {
    console.error('[COP Tasks] Create error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to create task',
      details: error instanceof Error ? error.message : 'Unknown error',
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

    const now = new Date().toISOString()
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

    return new Response(JSON.stringify({ id: body.id, message: 'Task updated' }), { headers: corsHeaders })
  } catch (error) {
    console.error('[COP Tasks] Update error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to update task',
      details: error instanceof Error ? error.message : 'Unknown error',
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

    const result = await env.DB.prepare(
      'DELETE FROM cop_tasks WHERE id = ? AND cop_session_id = ?'
    ).bind(taskId, sessionId).run()

    if (!result.meta.changes || result.meta.changes === 0) {
      return new Response(JSON.stringify({ error: 'Task not found in this session' }), {
        status: 404, headers: corsHeaders,
      })
    }

    return new Response(JSON.stringify({ message: 'Task deleted' }), { headers: corsHeaders })
  } catch (error) {
    console.error('[COP Tasks] Delete error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to delete task',
      details: error instanceof Error ? error.message : 'Unknown error',
    }), { status: 500, headers: corsHeaders })
  }
}

// OPTIONS - CORS preflight
export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: corsHeaders })
}
