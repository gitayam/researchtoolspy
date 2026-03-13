/**
 * COP Task Templates API
 *
 * GET    /api/cop/:id/task-templates          - List templates for workspace
 * POST   /api/cop/:id/task-templates          - Create template
 * PUT    /api/cop/:id/task-templates          - Update template (id in body)
 * DELETE /api/cop/:id/task-templates          - Delete template (id in body)
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
  return `ttpl-${crypto.randomUUID().slice(0, 12)}`
}

/**
 * Validate tasks_json structure.
 * Each task def must have a unique ref and a title.
 * depends_on refs must reference other defined refs.
 */
function validateTasksJson(tasksJson: any[]): string | null {
  if (!Array.isArray(tasksJson)) return 'tasks_json must be an array'

  const refs = new Set<string>()

  for (const task of tasksJson) {
    if (!task.ref || typeof task.ref !== 'string') return 'Each task must have a string ref'
    if (!task.title || typeof task.title !== 'string') return 'Each task must have a string title'
    if (refs.has(task.ref)) return `Duplicate ref: ${task.ref}`
    refs.add(task.ref)

    // Collect subtask refs
    if (task.subtasks && Array.isArray(task.subtasks)) {
      for (const sub of task.subtasks) {
        if (!sub.ref || typeof sub.ref !== 'string') return 'Each subtask must have a string ref'
        if (!sub.title || typeof sub.title !== 'string') return 'Each subtask must have a string title'
        if (refs.has(sub.ref)) return `Duplicate ref: ${sub.ref}`
        refs.add(sub.ref)
      }
    }
  }

  // Validate depends_on references
  for (const task of tasksJson) {
    if (task.depends_on && Array.isArray(task.depends_on)) {
      for (const depRef of task.depends_on) {
        if (!refs.has(depRef)) return `depends_on ref not found: ${depRef}`
      }
    }
  }

  return null
}

// GET - List templates for workspace
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params, request } = context
  const sessionId = params.id as string

  try {
    // Look up workspace from session
    const session = await env.DB.prepare(
      'SELECT workspace_id FROM cop_sessions WHERE id = ?'
    ).bind(sessionId).first() as any

    const workspaceId = session?.workspace_id || request.headers.get('X-Workspace-ID') || sessionId

    const results = await env.DB.prepare(
      'SELECT * FROM cop_task_templates WHERE workspace_id = ? ORDER BY updated_at DESC'
    ).bind(workspaceId).all()

    return new Response(JSON.stringify({ templates: results.results || [] }), { headers: corsHeaders })
  } catch (error) {
    console.error('[COP Task Templates] List error:', error)
    return new Response(JSON.stringify({ error: 'Failed to list templates' }), {
      status: 500, headers: corsHeaders,
    })
  }
}

// POST - Create template
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const sessionId = params.id as string

  try {
    const userId = await getUserIdOrDefault(request, env)
    const body = await request.json() as any

    if (!body.name?.trim()) {
      return new Response(JSON.stringify({ error: 'Template name is required' }), {
        status: 400, headers: corsHeaders,
      })
    }

    let tasksJson: any[] = []
    if (body.tasks_json) {
      try {
        tasksJson = typeof body.tasks_json === 'string' ? JSON.parse(body.tasks_json) : body.tasks_json
      } catch {
        return new Response(JSON.stringify({ error: 'Invalid tasks_json format' }), {
          status: 400, headers: corsHeaders,
        })
      }
    }

    const validationError = validateTasksJson(tasksJson)
    if (validationError) {
      return new Response(JSON.stringify({ error: validationError }), {
        status: 400, headers: corsHeaders,
      })
    }

    // Look up workspace
    const session = await env.DB.prepare(
      'SELECT workspace_id FROM cop_sessions WHERE id = ?'
    ).bind(sessionId).first() as any

    const workspaceId = session?.workspace_id || request.headers.get('X-Workspace-ID') || sessionId

    const id = generateId()
    const now = new Date().toISOString()

    await env.DB.prepare(`
      INSERT INTO cop_task_templates (id, name, description, template_type, tasks_json, created_by, workspace_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, body.name.trim(), body.description || null,
      body.template_type || 'universal',
      JSON.stringify(tasksJson),
      userId, workspaceId, now, now,
    ).run()

    return new Response(JSON.stringify({ id, message: 'Template created' }), {
      status: 201, headers: corsHeaders,
    })
  } catch (error) {
    console.error('[COP Task Templates] Create error:', error)
    return new Response(JSON.stringify({ error: 'Failed to create template' }), {
      status: 500, headers: corsHeaders,
    })
  }
}

// PUT - Update template
export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const sessionId = params.id as string

  try {
    const body = await request.json() as any

    if (!body.id) {
      return new Response(JSON.stringify({ error: 'Template id is required in body' }), {
        status: 400, headers: corsHeaders,
      })
    }

    const updates: string[] = []
    const bindings: any[] = []

    if (body.name !== undefined) {
      updates.push('name = ?')
      bindings.push(body.name.trim())
    }
    if (body.description !== undefined) {
      updates.push('description = ?')
      bindings.push(body.description || null)
    }
    if (body.template_type !== undefined) {
      updates.push('template_type = ?')
      bindings.push(body.template_type)
    }
    if (body.tasks_json !== undefined) {
      let tasksJson: any[] = []
      try {
        tasksJson = typeof body.tasks_json === 'string' ? JSON.parse(body.tasks_json) : body.tasks_json
      } catch {
        return new Response(JSON.stringify({ error: 'Invalid tasks_json format' }), {
          status: 400, headers: corsHeaders,
        })
      }

      const validationError = validateTasksJson(tasksJson)
      if (validationError) {
        return new Response(JSON.stringify({ error: validationError }), {
          status: 400, headers: corsHeaders,
        })
      }

      updates.push('tasks_json = ?')
      bindings.push(JSON.stringify(tasksJson))
    }

    if (updates.length === 0) {
      return new Response(JSON.stringify({ error: 'No valid fields to update' }), {
        status: 400, headers: corsHeaders,
      })
    }

    updates.push('updated_at = ?')
    bindings.push(new Date().toISOString())
    bindings.push(body.id)

    // Look up workspace from session for scoped update
    const session = await env.DB.prepare(
      'SELECT workspace_id FROM cop_sessions WHERE id = ?'
    ).bind(sessionId).first() as any
    const workspaceId = session?.workspace_id || request.headers.get('X-Workspace-ID') || sessionId
    bindings.push(workspaceId)

    await env.DB.prepare(
      `UPDATE cop_task_templates SET ${updates.join(', ')} WHERE id = ? AND workspace_id = ?`
    ).bind(...bindings).run()

    return new Response(JSON.stringify({ id: body.id, message: 'Template updated' }), { headers: corsHeaders })
  } catch (error) {
    console.error('[COP Task Templates] Update error:', error)
    return new Response(JSON.stringify({ error: 'Failed to update template' }), {
      status: 500, headers: corsHeaders,
    })
  }
}

// DELETE - Delete template
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const sessionId = params.id as string

  try {
    const body = await request.json() as any

    if (!body.id) {
      return new Response(JSON.stringify({ error: 'Template id is required' }), {
        status: 400, headers: corsHeaders,
      })
    }

    // Look up workspace from session for scoped delete
    const session = await env.DB.prepare(
      'SELECT workspace_id FROM cop_sessions WHERE id = ?'
    ).bind(sessionId).first() as any
    const workspaceId = session?.workspace_id || request.headers.get('X-Workspace-ID') || sessionId

    const result = await env.DB.prepare(
      'DELETE FROM cop_task_templates WHERE id = ? AND workspace_id = ?'
    ).bind(body.id, workspaceId).run()

    if (!result.meta.changes || result.meta.changes === 0) {
      return new Response(JSON.stringify({ error: 'Template not found' }), {
        status: 404, headers: corsHeaders,
      })
    }

    return new Response(JSON.stringify({ message: 'Template deleted' }), { headers: corsHeaders })
  } catch (error) {
    console.error('[COP Task Templates] Delete error:', error)
    return new Response(JSON.stringify({ error: 'Failed to delete template' }), {
      status: 500, headers: corsHeaders,
    })
  }
}

// OPTIONS - CORS preflight
export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: corsHeaders })
}
