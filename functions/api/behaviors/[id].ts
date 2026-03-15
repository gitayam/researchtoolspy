/**
 * Behavior Detail API - Get, Update, Delete
 * GET /api/behaviors/[id] - Get behavior by ID
 * PUT /api/behaviors/[id] - Update behavior fields
 * DELETE /api/behaviors/[id] - Delete behavior and update workspace entity count
 */

import type { PagesFunction } from '@cloudflare/workers-types'
import { getUserFromRequest } from '../_shared/auth-helpers'
import { checkWorkspaceAccess } from '../_shared/workspace-helpers'
import { JSON_HEADERS, safeJsonParse } from '../_shared/api-utils'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const behaviorId = context.params.id as string
    const behavior = await context.env.DB.prepare(
      'SELECT * FROM behaviors WHERE id = ?'
    ).bind(behaviorId).first()

    if (!behavior) {
      return new Response(JSON.stringify({ error: 'Behavior not found' }), {
        status: 404, headers: JSON_HEADERS,
      })
    }

    return new Response(JSON.stringify({
      ...behavior,
      indicators: safeJsonParse(behavior.indicators, []),
      is_public: Boolean(behavior.is_public),
    }), { headers: JSON_HEADERS })
  } catch (error) {
    console.error('Behavior GET error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: JSON_HEADERS,
    })
  }
}

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const behaviorId = params.id as string

  try {
    const authUserId = await getUserFromRequest(request, env)
    if (!authUserId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: JSON_HEADERS,
      })
    }

    const behavior = await env.DB.prepare(
      'SELECT workspace_id FROM behaviors WHERE id = ?'
    ).bind(behaviorId).first()

    if (!behavior) {
      return new Response(JSON.stringify({ error: 'Behavior not found' }), {
        status: 404, headers: JSON_HEADERS,
      })
    }

    if (!(await checkWorkspaceAccess(behavior.workspace_id as string, authUserId, env, 'EDITOR'))) {
      return new Response(JSON.stringify({ error: 'Insufficient permissions' }), {
        status: 403, headers: JSON_HEADERS,
      })
    }

    const body = await request.json() as any
    const updates: string[] = []
    const bindings: any[] = []

    if (body.name !== undefined) { updates.push('name = ?'); bindings.push(body.name) }
    if (body.description !== undefined) { updates.push('description = ?'); bindings.push(body.description) }
    if (body.behavior_type !== undefined) { updates.push('behavior_type = ?'); bindings.push(body.behavior_type) }
    if (body.indicators !== undefined) { updates.push('indicators = ?'); bindings.push(JSON.stringify(body.indicators)) }
    if (body.frequency !== undefined) { updates.push('frequency = ?'); bindings.push(body.frequency) }
    if (body.first_observed !== undefined) { updates.push('first_observed = ?'); bindings.push(body.first_observed) }
    if (body.last_observed !== undefined) { updates.push('last_observed = ?'); bindings.push(body.last_observed) }
    if (body.sophistication !== undefined) { updates.push('sophistication = ?'); bindings.push(body.sophistication) }
    if (body.effectiveness !== undefined) { updates.push('effectiveness = ?'); bindings.push(body.effectiveness) }

    if (updates.length === 0) {
      return new Response(JSON.stringify({ error: 'No fields to update' }), {
        status: 400, headers: JSON_HEADERS,
      })
    }

    updates.push('updated_at = ?')
    bindings.push(new Date().toISOString())
    bindings.push(behaviorId)

    await env.DB.prepare(
      `UPDATE behaviors SET ${updates.join(', ')} WHERE id = ?`
    ).bind(...bindings).run()

    const updated = await env.DB.prepare('SELECT * FROM behaviors WHERE id = ?').bind(behaviorId).first()

    return new Response(JSON.stringify({
      ...updated,
      indicators: safeJsonParse(updated?.indicators, []),
      is_public: Boolean(updated?.is_public),
    }), { headers: JSON_HEADERS })
  } catch (error) {
    console.error('Behavior PUT error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: JSON_HEADERS,
    })
  }
}

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const behaviorId = params.id as string

  try {
    const authUserId = await getUserFromRequest(request, env)
    if (!authUserId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: JSON_HEADERS,
      })
    }

    const behavior = await env.DB.prepare(
      'SELECT workspace_id FROM behaviors WHERE id = ?'
    ).bind(behaviorId).first()

    if (!behavior) {
      return new Response(JSON.stringify({ error: 'Behavior not found' }), {
        status: 404, headers: JSON_HEADERS,
      })
    }

    if (!(await checkWorkspaceAccess(behavior.workspace_id as string, authUserId, env, 'EDITOR'))) {
      return new Response(JSON.stringify({ error: 'Insufficient permissions' }), {
        status: 403, headers: JSON_HEADERS,
      })
    }

    await env.DB.prepare('DELETE FROM behaviors WHERE id = ?').bind(behaviorId).run()

    // Clean up actor_behaviors junction records
    await env.DB.prepare('DELETE FROM actor_behaviors WHERE behavior_id = ?').bind(behaviorId).run()

    // Decrement workspace entity count
    const now = new Date().toISOString()
    await env.DB.prepare(`
      UPDATE workspaces
      SET entity_count = json_set(
        COALESCE(entity_count, '{}'),
        '$.behaviors',
        MAX(0, COALESCE(json_extract(entity_count, '$.behaviors'), 0) - 1)
      ),
      updated_at = ?
      WHERE id = ?
    `).bind(now, behavior.workspace_id).run()

    return new Response(JSON.stringify({ message: 'Behavior deleted successfully' }), { headers: JSON_HEADERS })
  } catch (error) {
    console.error('Behavior DELETE error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: JSON_HEADERS,
    })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: JSON_HEADERS })
}
