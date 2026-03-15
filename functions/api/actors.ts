/**
 * Actors API
 * Manages actors (people, organizations, units, governments) with MOM-POP deception assessment
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
    // Get authenticated user (allows guest access with default user)
    const userId = await getUserIdOrDefault(request, env)

    // GET /api/actors/search?workspace_id=1&name=EntityName&type=PERSON - Check if actor exists
    if (method === 'GET' && url.pathname === '/api/actors/search') {
      const workspaceId = url.searchParams.get('workspace_id')
      const name = url.searchParams.get('name')
      const type = url.searchParams.get('type')

      if (!workspaceId || !name) {
        return new Response(
          JSON.stringify({ error: 'workspace_id and name parameters required' }),
          { status: 400, headers: JSON_HEADERS }
        )
      }

      // Check access
      if (!(await checkWorkspaceAccess(workspaceId, userId, env))) {
        return new Response(
          JSON.stringify({ error: 'Access denied to workspace' }),
          { status: 403, headers: JSON_HEADERS }
        )
      }

      // Search for actor by name (case-insensitive) and optionally type
      // Only search within user's own entities (created_by = userId)
      let query = `SELECT * FROM actors WHERE workspace_id = ? AND created_by = ? AND LOWER(name) = LOWER(?)`
      const params = [workspaceId, userId, name]

      if (type) {
        query += ` AND type = ?`
        params.push(type)
      }

      query += ` LIMIT 1`

      const actor = await env.DB.prepare(query).bind(...params).first()

      if (actor) {
        return new Response(
          JSON.stringify({
            exists: true,
            actor: {
              ...actor,
              aliases: safeJsonParse(actor.aliases, []),
              tags: safeJsonParse(actor.tags, []),
              deception_profile: safeJsonParse(actor.deception_profile),
              is_public: Boolean(actor.is_public)
            }
          }),
          { status: 200, headers: JSON_HEADERS }
        )
      }

      return new Response(
        JSON.stringify({ exists: false, actor: null }),
        { status: 200, headers: JSON_HEADERS }
      )
    }

    // GET /api/actors?workspace_id=xxx - List actors
    if (method === 'GET' && url.pathname === '/api/actors') {
      const workspaceId = url.searchParams.get('workspace_id') || request.headers.get('X-Workspace-ID')
      if (!workspaceId) {
        // No workspace context — return user's actors across all workspaces
        const { results } = await env.DB.prepare(
          `SELECT * FROM actors WHERE created_by = ? ORDER BY created_at DESC LIMIT 500`
        ).bind(userId).all()
        const actors = results.map(a => ({
          ...a,
          aliases: safeJsonParse(a.aliases, []),
          tags: safeJsonParse(a.tags, []),
          deception_profile: safeJsonParse(a.deception_profile),
          is_public: Boolean(a.is_public)
        }))
        return new Response(
          JSON.stringify({ actors }),
          { status: 200, headers: JSON_HEADERS }
        )
      }

      // Check access
      if (!(await checkWorkspaceAccess(workspaceId, userId, env))) {
        return new Response(
          JSON.stringify({ error: 'Access denied to workspace' }),
          { status: 403, headers: JSON_HEADERS }
        )
      }

      // Build query with filters
      let query = `SELECT * FROM actors WHERE workspace_id = ?`
      const params = [workspaceId]

      const type = url.searchParams.get('type')
      if (type) {
        query += ` AND type = ?`
        params.push(type)
      }

      const search = url.searchParams.get('search')
      if (search) {
        query += ` AND (name LIKE ? OR description LIKE ?)`
        params.push(`%${search}%`, `%${search}%`)
      }

      query += ` ORDER BY created_at DESC`

      const limit = url.searchParams.get('limit')
      query += ` LIMIT ?`
      params.push(Math.min(parseInt(limit || '500') || 500, 500))

      const { results } = await env.DB.prepare(query).bind(...params).all()

      // Parse JSON fields
      const actors = results.map(a => ({
        ...a,
        aliases: safeJsonParse(a.aliases, []),
        tags: safeJsonParse(a.tags, []),
        deception_profile: safeJsonParse(a.deception_profile),
        is_public: Boolean(a.is_public)
      }))

      return new Response(
        JSON.stringify({ actors }),
        { status: 200, headers: JSON_HEADERS }
      )
    }

    // POST /api/actors - Create actor
    if (method === 'POST' && url.pathname === '/api/actors') {
      const authUserId = await getUserFromRequest(request, env)
      if (!authUserId) {
        return new Response(JSON.stringify({ error: 'Authentication required' }), {
          status: 401, headers: JSON_HEADERS,
        })
      }

      const body = await request.json() as any

      if (!body.name || !body.type || !body.workspace_id) {
        return new Response(
          JSON.stringify({ error: 'Missing required fields: name, type, workspace_id' }),
          { status: 400, headers: JSON_HEADERS }
        )
      }

      // Check edit access
      if (!(await checkWorkspaceAccess(body.workspace_id, authUserId, env, 'EDITOR'))) {
        return new Response(
          JSON.stringify({ error: 'Insufficient permissions' }),
          { status: 403, headers: JSON_HEADERS }
        )
      }

      const id = generateId()
      const now = new Date().toISOString()

      await env.DB.prepare(`
        INSERT INTO actors (
          id, type, name, aliases, description,
          category, role, affiliation,
          deception_profile,
          causeway_analysis_id, cog_analysis_id,
          workspace_id, created_by, created_at, updated_at,
          is_public, votes,
          tags, source_url
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id,
        body.type,
        body.name,
        body.aliases ? JSON.stringify(body.aliases) : null,
        body.description || null,
        body.category || null,
        body.role || null,
        body.affiliation || null,
        body.deception_profile ? JSON.stringify(body.deception_profile) : null,
        body.causeway_analysis_id || null,
        body.cog_analysis_id || null,
        body.workspace_id,
        authUserId,
        now,
        now,
        body.is_public ? 1 : 0,
        0,
        body.tags ? JSON.stringify(body.tags) : null,
        body.source_url || null
      ).run()

      // Update workspace entity count
      await env.DB.prepare(`
        UPDATE workspaces
        SET entity_count = json_set(
          COALESCE(entity_count, '{}'),
          '$.actors',
          COALESCE(json_extract(entity_count, '$.actors'), 0) + 1
        ),
        updated_at = ?
        WHERE id = ?
      `).bind(now, body.workspace_id).run()

      const actor = await env.DB.prepare(`
        SELECT * FROM actors WHERE id = ?
      `).bind(id).first()

      if (!actor) {
        return new Response(
          JSON.stringify({ success: true, id }),
          { status: 201, headers: JSON_HEADERS }
        )
      }

      return new Response(
        JSON.stringify({
          ...actor,
          aliases: safeJsonParse(actor.aliases, []),
          tags: safeJsonParse(actor.tags, []),
          deception_profile: safeJsonParse(actor.deception_profile),
          is_public: Boolean(actor.is_public)
        }),
        { status: 201, headers: JSON_HEADERS }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: JSON_HEADERS }
    )

  } catch (error) {
    console.error('Actors API error:', error)
    return new Response(
      JSON.stringify({
        error: 'Internal server error'
      }),
      { status: 500, headers: JSON_HEADERS }
    )
  }
}
