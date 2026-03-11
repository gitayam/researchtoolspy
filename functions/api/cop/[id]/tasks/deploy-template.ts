/**
 * COP Template Deployment API
 *
 * POST /api/cop/:id/tasks/deploy-template - Instantiate a task template
 *
 * Reads the template's tasks_json, creates real tasks with ULID IDs,
 * maps ref IDs to real IDs, creates subtasks and dependency rows.
 */
import type { PagesFunction } from '@cloudflare/workers-types'
import { getUserIdOrDefault } from '../../../_shared/auth-helpers'
import { emitCopEvent } from '../../../_shared/cop-events'
import { TASK_CREATED } from '../../../_shared/cop-event-types'

interface Env {
  DB: D1Database
}

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash, X-Workspace-ID',
}

function generateTaskId(): string {
  return `tsk-${crypto.randomUUID().slice(0, 12)}`
}

function generateDepId(): string {
  return `dep-${crypto.randomUUID().slice(0, 12)}`
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, params, request } = context
  const sessionId = params.id as string
  const userId = await getUserIdOrDefault(request, env)

  try {
    const body = await request.json() as any

    if (!body.template_id) {
      return new Response(JSON.stringify({ error: 'template_id required' }), {
        status: 400, headers: corsHeaders,
      })
    }

    // Look up workspace
    const session = await env.DB.prepare(
      'SELECT workspace_id FROM cop_sessions WHERE id = ?'
    ).bind(sessionId).first() as any

    if (!session) {
      return new Response(JSON.stringify({ error: 'Session not found' }), {
        status: 404, headers: corsHeaders,
      })
    }

    const template = await env.DB.prepare(
      'SELECT * FROM cop_task_templates WHERE id = ?'
    ).bind(body.template_id).first() as any

    if (!template) {
      return new Response(JSON.stringify({ error: 'Template not found' }), {
        status: 404, headers: corsHeaders,
      })
    }

    let taskDefs: any[] = []
    try { taskDefs = JSON.parse(template.tasks_json) } catch { taskDefs = [] }

    if (taskDefs.length === 0) {
      return new Response(JSON.stringify({ error: 'Template has no tasks defined' }), {
        status: 400, headers: corsHeaders,
      })
    }

    // Phase 1: Create all tasks and build ref -> ID map
    const refToId: Record<string, string> = {}
    const createdIds: string[] = []

    for (let i = 0; i < taskDefs.length; i++) {
      const def = taskDefs[i]
      const taskId = generateTaskId()
      refToId[def.ref] = taskId
      createdIds.push(taskId)

      await env.DB.prepare(`
        INSERT INTO cop_tasks (id, cop_session_id, title, description, task_type, priority, position, depth, created_by, workspace_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        taskId, sessionId, def.title, def.description || null,
        def.task_type || 'general', def.priority || 'medium',
        i, 0, userId, session.workspace_id
      ).run()

      await emitCopEvent(env.DB, {
        copSessionId: sessionId,
        eventType: TASK_CREATED,
        entityType: 'task',
        entityId: taskId,
        payload: { title: def.title, source: 'template', template_id: body.template_id },
        createdBy: userId,
      })

      // Create subtasks
      if (def.subtasks && Array.isArray(def.subtasks)) {
        for (let j = 0; j < def.subtasks.length; j++) {
          const sub = def.subtasks[j]
          const subId = generateTaskId()
          refToId[sub.ref] = subId
          createdIds.push(subId)

          await env.DB.prepare(`
            INSERT INTO cop_tasks (id, cop_session_id, title, task_type, priority, parent_task_id, depth, position, created_by, workspace_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            subId, sessionId, sub.title, sub.task_type || 'general',
            sub.priority || def.priority || 'medium',
            taskId, 1, j, userId, session.workspace_id
          ).run()

          await emitCopEvent(env.DB, {
            copSessionId: sessionId,
            eventType: TASK_CREATED,
            entityType: 'task',
            entityId: subId,
            payload: { title: sub.title, source: 'template', template_id: body.template_id, parent_task_id: taskId },
            createdBy: userId,
          })
        }
      }
    }

    // Phase 2: Create dependency rows using ref -> ID mapping
    let depsCreated = 0
    for (const def of taskDefs) {
      if (def.depends_on && Array.isArray(def.depends_on)) {
        for (const depRef of def.depends_on) {
          const fromId = refToId[def.ref]
          const toId = refToId[depRef]
          if (fromId && toId) {
            const depId = generateDepId()
            await env.DB.prepare(`
              INSERT INTO cop_task_dependencies (id, task_id, depends_on_task_id, cop_session_id)
              VALUES (?, ?, ?, ?)
            `).bind(depId, fromId, toId, sessionId).run()
            depsCreated++
          }
        }
      }
    }

    return new Response(JSON.stringify({
      message: 'Template deployed',
      tasks_created: createdIds.length,
      dependencies_created: depsCreated,
      task_ids: createdIds,
      ref_map: refToId,
    }), { status: 201, headers: corsHeaders })
  } catch (error) {
    console.error('[COP Deploy Template] Error:', error)
    return new Response(JSON.stringify({ error: 'Failed to deploy template' }), {
      status: 500, headers: corsHeaders,
    })
  }
}

// OPTIONS - CORS preflight
export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: corsHeaders })
}
