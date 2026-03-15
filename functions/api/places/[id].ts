/**
 * Place Detail API - Get, Update, Delete
 * GET /api/places/[id] - Get place by ID
 * PUT /api/places/[id] - Update place fields
 * DELETE /api/places/[id] - Delete place and update workspace entity count
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
    const placeId = context.params.id as string
    const place = await context.env.DB.prepare(
      'SELECT * FROM places WHERE id = ?'
    ).bind(placeId).first()

    if (!place) {
      return new Response(JSON.stringify({ error: 'Place not found' }), {
        status: 404, headers: JSON_HEADERS,
      })
    }

    return new Response(JSON.stringify({
      ...place,
      coordinates: safeJsonParse(place.coordinates),
      is_public: Boolean(place.is_public),
    }), { headers: JSON_HEADERS })
  } catch (error) {
    console.error('Place GET error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: JSON_HEADERS,
    })
  }
}

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const placeId = params.id as string

  try {
    const authUserId = await getUserFromRequest(request, env)
    if (!authUserId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: JSON_HEADERS,
      })
    }

    const place = await env.DB.prepare(
      'SELECT workspace_id FROM places WHERE id = ?'
    ).bind(placeId).first()

    if (!place) {
      return new Response(JSON.stringify({ error: 'Place not found' }), {
        status: 404, headers: JSON_HEADERS,
      })
    }

    if (!(await checkWorkspaceAccess(place.workspace_id as string, authUserId, env, 'EDITOR'))) {
      return new Response(JSON.stringify({ error: 'Insufficient permissions' }), {
        status: 403, headers: JSON_HEADERS,
      })
    }

    const body = await request.json() as any
    const updates: string[] = []
    const bindings: any[] = []

    if (body.name !== undefined) { updates.push('name = ?'); bindings.push(body.name) }
    if (body.description !== undefined) { updates.push('description = ?'); bindings.push(body.description) }
    if (body.place_type !== undefined) { updates.push('place_type = ?'); bindings.push(body.place_type) }
    if (body.coordinates !== undefined) { updates.push('coordinates = ?'); bindings.push(JSON.stringify(body.coordinates)) }
    if (body.address !== undefined) { updates.push('address = ?'); bindings.push(body.address) }
    if (body.country !== undefined) { updates.push('country = ?'); bindings.push(body.country) }
    if (body.region !== undefined) { updates.push('region = ?'); bindings.push(body.region) }
    if (body.strategic_importance !== undefined) { updates.push('strategic_importance = ?'); bindings.push(body.strategic_importance) }
    if (body.controlled_by !== undefined) { updates.push('controlled_by = ?'); bindings.push(body.controlled_by) }

    if (updates.length === 0) {
      return new Response(JSON.stringify({ error: 'No fields to update' }), {
        status: 400, headers: JSON_HEADERS,
      })
    }

    updates.push('updated_at = ?')
    bindings.push(new Date().toISOString())
    bindings.push(placeId)

    await env.DB.prepare(
      `UPDATE places SET ${updates.join(', ')} WHERE id = ?`
    ).bind(...bindings).run()

    const updated = await env.DB.prepare('SELECT * FROM places WHERE id = ?').bind(placeId).first()

    return new Response(JSON.stringify({
      ...updated,
      coordinates: safeJsonParse(updated?.coordinates),
      is_public: Boolean(updated?.is_public),
    }), { headers: JSON_HEADERS })
  } catch (error) {
    console.error('Place PUT error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: JSON_HEADERS,
    })
  }
}

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const placeId = params.id as string

  try {
    const authUserId = await getUserFromRequest(request, env)
    if (!authUserId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: JSON_HEADERS,
      })
    }

    const place = await env.DB.prepare(
      'SELECT workspace_id FROM places WHERE id = ?'
    ).bind(placeId).first()

    if (!place) {
      return new Response(JSON.stringify({ error: 'Place not found' }), {
        status: 404, headers: JSON_HEADERS,
      })
    }

    if (!(await checkWorkspaceAccess(place.workspace_id as string, authUserId, env, 'EDITOR'))) {
      return new Response(JSON.stringify({ error: 'Insufficient permissions' }), {
        status: 403, headers: JSON_HEADERS,
      })
    }

    await env.DB.prepare('DELETE FROM places WHERE id = ?').bind(placeId).run()

    // Decrement workspace entity count
    const now = new Date().toISOString()
    await env.DB.prepare(`
      UPDATE workspaces
      SET entity_count = json_set(
        COALESCE(entity_count, '{}'),
        '$.places',
        MAX(0, COALESCE(json_extract(entity_count, '$.places'), 0) - 1)
      ),
      updated_at = ?
      WHERE id = ?
    `).bind(now, place.workspace_id).run()

    return new Response(JSON.stringify({ message: 'Place deleted successfully' }), { headers: JSON_HEADERS })
  } catch (error) {
    console.error('Place DELETE error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: JSON_HEADERS,
    })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: JSON_HEADERS })
}
