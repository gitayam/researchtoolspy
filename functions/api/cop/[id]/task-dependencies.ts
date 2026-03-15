/**
 * COP Task Dependencies API
 *
 * GET    /api/cop/:id/task-dependencies          - List dependencies for session
 * POST   /api/cop/:id/task-dependencies          - Create dependency (with circular detection)
 * DELETE /api/cop/:id/task-dependencies           - Remove dependency (id in body)
 */
import type { PagesFunction } from '@cloudflare/workers-types'
import { getUserFromRequest, verifyCopSessionAccess } from '../../_shared/auth-helpers'
import { emitCopEvent } from '../../_shared/cop-events'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
  JWT_SECRET?: string
}

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash, X-Workspace-ID',
}

function generateId(): string {
  return `dep-${crypto.randomUUID().slice(0, 12)}`
}

/**
 * Detect circular dependencies by walking the dependency graph.
 * Returns true if adding taskId -> dependsOnId would create a cycle.
 * BFS from dependsOnId — if we reach taskId, it's circular.
 */
async function wouldCreateCycle(
  db: D1Database,
  sessionId: string,
  taskId: string,
  dependsOnId: string
): Promise<boolean> {
  const visited = new Set<string>()
  const queue = [dependsOnId]

  while (queue.length > 0) {
    const current = queue.shift()!
    if (current === taskId) return true
    if (visited.has(current)) continue
    visited.add(current)

    const deps = await db.prepare(
      'SELECT depends_on_task_id FROM cop_task_dependencies WHERE task_id = ? AND cop_session_id = ?'
    ).bind(current, sessionId).all()

    for (const row of (deps.results || [])) {
      queue.push((row as any).depends_on_task_id)
    }
  }

  return false
}

// GET - List dependencies for a COP session
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params, request } = context
  const sessionId = params.id as string

  const userId = await getUserFromRequest(request, env)
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401, headers: corsHeaders })
  }
  const accessWorkspaceId = await verifyCopSessionAccess(env.DB, sessionId, userId, { readOnly: true })
  if (!accessWorkspaceId) {
    return new Response(JSON.stringify({ error: 'Access denied' }), { status: 403, headers: corsHeaders })
  }

  try {
    const results = await env.DB.prepare(
      'SELECT * FROM cop_task_dependencies WHERE cop_session_id = ? ORDER BY created_at ASC'
    ).bind(sessionId).all()

    return new Response(JSON.stringify({ dependencies: results.results || [] }), { headers: corsHeaders })
  } catch (error) {
    console.error('[COP Task Deps] List error:', error)
    return new Response(JSON.stringify({ error: 'Failed to list dependencies' }), {
      status: 500, headers: corsHeaders,
    })
  }
}

// POST - Create a dependency
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, params, request } = context
  const sessionId = params.id as string

  try {
    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: corsHeaders,
      })
    }
    if (!(await verifyCopSessionAccess(env.DB, sessionId, userId))) {
      return new Response(JSON.stringify({ error: 'Access denied' }), { status: 403, headers: corsHeaders })
    }
    const body = await request.json() as any

    if (!body.task_id || !body.depends_on_task_id) {
      return new Response(JSON.stringify({ error: 'task_id and depends_on_task_id required' }), {
        status: 400, headers: corsHeaders,
      })
    }

    if (body.task_id === body.depends_on_task_id) {
      return new Response(JSON.stringify({ error: 'Task cannot depend on itself' }), {
        status: 400, headers: corsHeaders,
      })
    }

    // Verify both tasks exist in this session
    const taskCheck = await env.DB.prepare(
      'SELECT id FROM cop_tasks WHERE id IN (?, ?) AND cop_session_id = ?'
    ).bind(body.task_id, body.depends_on_task_id, sessionId).all()

    if ((taskCheck.results || []).length < 2) {
      return new Response(JSON.stringify({ error: 'One or both tasks not found in this session' }), {
        status: 404, headers: corsHeaders,
      })
    }

    // Check for duplicate
    const existing = await env.DB.prepare(
      'SELECT id FROM cop_task_dependencies WHERE task_id = ? AND depends_on_task_id = ? AND cop_session_id = ?'
    ).bind(body.task_id, body.depends_on_task_id, sessionId).first()

    if (existing) {
      return new Response(JSON.stringify({ error: 'Dependency already exists' }), {
        status: 409, headers: corsHeaders,
      })
    }

    // Check for circular dependency
    const circular = await wouldCreateCycle(env.DB, sessionId, body.task_id, body.depends_on_task_id)
    if (circular) {
      return new Response(JSON.stringify({ error: 'Would create circular dependency' }), {
        status: 400, headers: corsHeaders,
      })
    }

    const id = generateId()

    await env.DB.prepare(`
      INSERT INTO cop_task_dependencies (id, task_id, depends_on_task_id, cop_session_id)
      VALUES (?, ?, ?, ?)
    `).bind(id, body.task_id, body.depends_on_task_id, sessionId).run()

    await emitCopEvent(env.DB, {
      copSessionId: sessionId,
      eventType: 'task.blocked' as any,
      entityType: 'task',
      entityId: body.task_id,
      payload: { depends_on: body.depends_on_task_id, dependency_id: id },
      createdBy: userId,
    })

    return new Response(JSON.stringify({ id, message: 'Dependency created' }), {
      status: 201, headers: corsHeaders,
    })
  } catch (error) {
    console.error('[COP Task Deps] Create error:', error)
    return new Response(JSON.stringify({ error: 'Failed to create dependency' }), {
      status: 500, headers: corsHeaders,
    })
  }
}

// DELETE - Remove a dependency
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { env, params, request } = context
  const sessionId = params.id as string

  try {
    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: corsHeaders,
      })
    }
    if (!(await verifyCopSessionAccess(env.DB, sessionId, userId))) {
      return new Response(JSON.stringify({ error: 'Access denied' }), { status: 403, headers: corsHeaders })
    }
    const body = await request.json() as any

    if (!body.id) {
      return new Response(JSON.stringify({ error: 'Dependency ID required' }), {
        status: 400, headers: corsHeaders,
      })
    }

    // Fetch before delete for event payload
    const dep = await env.DB.prepare(
      'SELECT task_id, depends_on_task_id FROM cop_task_dependencies WHERE id = ? AND cop_session_id = ?'
    ).bind(body.id, sessionId).first() as any

    const deleteResult = await env.DB.prepare(
      'DELETE FROM cop_task_dependencies WHERE id = ? AND cop_session_id = ?'
    ).bind(body.id, sessionId).run()

    if (!deleteResult.meta.changes || deleteResult.meta.changes === 0) {
      return new Response(JSON.stringify({ error: 'Dependency not found in this session' }), {
        status: 404, headers: corsHeaders,
      })
    }

    if (dep) {
      await emitCopEvent(env.DB, {
        copSessionId: sessionId,
        eventType: 'task.unblocked' as any,
        entityType: 'task',
        entityId: dep.task_id,
        payload: { removed_dependency: body.id, was_depending_on: dep.depends_on_task_id },
        createdBy: userId,
      })
    }

    return new Response(JSON.stringify({ message: 'Dependency removed' }), { headers: corsHeaders })
  } catch (error) {
    console.error('[COP Task Deps] Delete error:', error)
    return new Response(JSON.stringify({ error: 'Failed to delete dependency' }), {
      status: 500, headers: corsHeaders,
    })
  }
}

// OPTIONS - CORS preflight
export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: corsHeaders })
}
