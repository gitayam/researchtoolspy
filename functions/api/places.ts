/**
 * Places API
 * Manages places (facilities, cities, regions, installations) with geographic coordinates
 */

import type { PagesFunction } from '@cloudflare/workers-types'
import { getUserIdOrDefault, getUserFromRequest } from './_shared/auth-helpers'
import { checkWorkspaceAccess } from './_shared/workspace-helpers'
import { generateId, CORS_HEADERS, JSON_HEADERS, safeJsonParse } from './_shared/api-utils'

interface Env {
  DB: D1Database
  SESSIONS: KVNamespace
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  const url = new URL(request.url)
  const method = request.method

  if (method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS })
  }

  try {
    const userId = await getUserIdOrDefault(request, env)

    // GET /api/places?workspace_id=xxx
    if (method === 'GET' && url.pathname === '/api/places') {
      const workspaceId = url.searchParams.get('workspace_id')
      if (!workspaceId) {
        return new Response(
          JSON.stringify({ error: 'workspace_id parameter required' }),
          { status: 400, headers: JSON_HEADERS }
        )
      }

      if (!(await checkWorkspaceAccess(workspaceId, userId, env))) {
        return new Response(
          JSON.stringify({ error: 'Access denied to workspace' }),
          { status: 403, headers: JSON_HEADERS }
        )
      }

      let query = `SELECT * FROM places WHERE workspace_id = ?`
      const params: any[] = [workspaceId]

      const placeType = url.searchParams.get('place_type')
      if (placeType) {
        query += ` AND place_type = ?`
        params.push(placeType)
      }

      const country = url.searchParams.get('country')
      if (country) {
        query += ` AND country = ?`
        params.push(country)
      }

      const importance = url.searchParams.get('strategic_importance')
      if (importance) {
        query += ` AND strategic_importance = ?`
        params.push(importance)
      }

      const search = url.searchParams.get('search')
      if (search) {
        query += ` AND (name LIKE ? OR description LIKE ? OR address LIKE ?)`
        params.push(`%${search}%`, `%${search}%`, `%${search}%`)
      }

      query += ` ORDER BY created_at DESC`

      const limit = url.searchParams.get('limit')
      query += ` LIMIT ?`
      params.push(Math.min(parseInt(limit || '500') || 500, 500))

      const { results } = await env.DB.prepare(query).bind(...params).all()

      const places = results.map(p => ({
        ...p,
        coordinates: safeJsonParse(p.coordinates),
        is_public: Boolean(p.is_public)
      }))

      return new Response(
        JSON.stringify(places),
        { status: 200, headers: JSON_HEADERS }
      )
    }

    // POST /api/places
    if (method === 'POST' && url.pathname === '/api/places') {
      const authUserId = await getUserFromRequest(request, env)
      if (!authUserId) {
        return new Response(JSON.stringify({ error: 'Authentication required' }), {
          status: 401, headers: JSON_HEADERS,
        })
      }

      const body = await request.json() as any

      if (!body.name || !body.place_type || !body.coordinates || !body.workspace_id) {
        return new Response(
          JSON.stringify({ error: 'Missing required fields: name, place_type, coordinates, workspace_id' }),
          { status: 400, headers: JSON_HEADERS }
        )
      }

      if (!body.coordinates.lat || !body.coordinates.lng) {
        return new Response(
          JSON.stringify({ error: 'Coordinates must include lat and lng' }),
          { status: 400, headers: JSON_HEADERS }
        )
      }

      if (!(await checkWorkspaceAccess(body.workspace_id, authUserId, env, 'EDITOR'))) {
        return new Response(
          JSON.stringify({ error: 'Insufficient permissions' }),
          { status: 403, headers: JSON_HEADERS }
        )
      }

      const id = generateId()
      const now = new Date().toISOString()

      await env.DB.prepare(`
        INSERT INTO places (
          id, name, description, place_type,
          coordinates, address, country, region,
          strategic_importance, controlled_by,
          workspace_id, created_by, created_at, updated_at,
          is_public, votes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id,
        body.name,
        body.description || null,
        body.place_type,
        JSON.stringify(body.coordinates),
        body.address || null,
        body.country || null,
        body.region || null,
        body.strategic_importance || null,
        body.controlled_by || null,
        body.workspace_id,
        authUserId,
        now,
        now,
        body.is_public ? 1 : 0,
        0
      ).run()

      // Update workspace entity count
      await env.DB.prepare(`
        UPDATE workspaces
        SET entity_count = json_set(
          COALESCE(entity_count, '{}'),
          '$.places',
          COALESCE(json_extract(entity_count, '$.places'), 0) + 1
        ),
        updated_at = ?
        WHERE id = ?
      `).bind(now, body.workspace_id).run()

      const place = await env.DB.prepare(`
        SELECT * FROM places WHERE id = ?
      `).bind(id).first()

      if (!place) {
        return new Response(
          JSON.stringify({ success: true, id }),
          { status: 201, headers: JSON_HEADERS }
        )
      }

      return new Response(
        JSON.stringify({
          ...place,
          coordinates: safeJsonParse(place.coordinates),
          is_public: Boolean(place.is_public)
        }),
        { status: 201, headers: JSON_HEADERS }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: JSON_HEADERS }
    )

  } catch (error) {
    console.error('Places API error:', error)
    return new Response(
      JSON.stringify({
        error: 'Internal server error'

      }),
      { status: 500, headers: JSON_HEADERS }
    )
  }
}
