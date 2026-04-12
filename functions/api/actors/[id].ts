/**
 * Actor Detail API - Get, Update, Delete
 * GET /api/actors/[id] - Get actor with related counts
 * PUT /api/actors/[id] - Update actor fields
 * DELETE /api/actors/[id] - Delete actor and update workspace entity count
 */

import type { PagesFunction } from '@cloudflare/workers-types'
import { getUserIdOrDefault, getUserFromRequest } from '../_shared/auth-helpers'
import { checkWorkspaceAccess } from '../_shared/workspace-helpers'
import { JSON_HEADERS, safeJsonParse } from '../_shared/api-utils'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
}

// GET /api/actors/:id - Fetch actor by ID with related entity counts
export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context
    const actorId = context.params.id as string
    const userId = await getUserIdOrDefault(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: JSON_HEADERS,
      })
    }

    const actor = await env.DB.prepare(`
      SELECT * FROM actors WHERE id = ?
    `).bind(actorId).first()

    if (!actor) {
      return new Response(
        JSON.stringify({ error: 'Actor not found' }),
        { status: 404, headers: JSON_HEADERS }
      )
    }

    // Check access
    if (!(await checkWorkspaceAccess(actor.workspace_id as string, userId, env))) {
      return new Response(
        JSON.stringify({ error: 'Access denied' }),
        { status: 403, headers: JSON_HEADERS }
      )
    }

    // Get related entities count
    const { results: eventsCount } = await env.DB.prepare(`
      SELECT COUNT(*) as count FROM actor_events WHERE actor_id = ?
    `).bind(actorId).all()

    const { results: evidenceCount } = await env.DB.prepare(`
      SELECT COUNT(*) as count FROM evidence_actors WHERE actor_id = ?
    `).bind(actorId).all()

    const { results: behaviorsCount } = await env.DB.prepare(`
      SELECT COUNT(*) as count FROM actor_behaviors WHERE actor_id = ?
    `).bind(actorId).all()

    const { results: relationshipsCount } = await env.DB.prepare(`
      SELECT COUNT(*) as count FROM relationships
      WHERE source_entity_id = ? OR target_entity_id = ?
    `).bind(actorId, actorId).all()

    return new Response(
      JSON.stringify({
        ...actor,
        aliases: safeJsonParse(actor.aliases, []),
        tags: safeJsonParse(actor.tags, []),
        deception_profile: safeJsonParse(actor.deception_profile),
        is_public: Boolean(actor.is_public),
        related_counts: {
          events: eventsCount[0]?.count || 0,
          evidence: evidenceCount[0]?.count || 0,
          behaviors: behaviorsCount[0]?.count || 0,
          relationships: relationshipsCount[0]?.count || 0
        }
      }),
      { status: 200, headers: JSON_HEADERS }
    )
  } catch (error) {
    console.error('Actor GET error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: JSON_HEADERS }
    )
  }
}

// PUT /api/actors/:id - Update actor
export const onRequestPut: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context
    const actorId = context.params.id as string

    const authUserId = await getUserFromRequest(request, env)
    if (!authUserId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: JSON_HEADERS,
      })
    }

    const body = await request.json() as any

    const actor = await env.DB.prepare(`
      SELECT workspace_id FROM actors WHERE id = ?
    `).bind(actorId).first()

    if (!actor) {
      return new Response(
        JSON.stringify({ error: 'Actor not found' }),
        { status: 404, headers: JSON_HEADERS }
      )
    }

    // Check edit access
    if (!(await checkWorkspaceAccess(actor.workspace_id as string, authUserId, env, 'EDITOR'))) {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions' }),
        { status: 403, headers: JSON_HEADERS }
      )
    }

    const now = new Date().toISOString()

    await env.DB.prepare(`
      UPDATE actors
      SET name = ?,
          aliases = ?,
          description = ?,
          category = ?,
          role = ?,
          affiliation = ?,
          deception_profile = ?,
          causeway_analysis_id = ?,
          cog_analysis_id = ?,
          is_public = ?,
          updated_at = ?
      WHERE id = ?
    `).bind(
      body.name,
      body.aliases ? JSON.stringify(body.aliases) : null,
      body.description || null,
      body.category || null,
      body.role || null,
      body.affiliation || null,
      body.deception_profile ? JSON.stringify(body.deception_profile) : null,
      body.causeway_analysis_id || null,
      body.cog_analysis_id || null,
      body.is_public ? 1 : 0,
      now,
      actorId
    ).run()

    const updated = await env.DB.prepare(`
      SELECT * FROM actors WHERE id = ?
    `).bind(actorId).first()

    if (!updated) {
      return new Response(
        JSON.stringify({ success: true, id: actorId }),
        { status: 200, headers: JSON_HEADERS }
      )
    }

    return new Response(
      JSON.stringify({
        ...updated,
        aliases: safeJsonParse(updated.aliases, []),
        tags: safeJsonParse(updated.tags, []),
        deception_profile: safeJsonParse(updated.deception_profile),
        is_public: Boolean(updated.is_public)
      }),
      { status: 200, headers: JSON_HEADERS }
    )
  } catch (error) {
    console.error('Actor PUT error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: JSON_HEADERS }
    )
  }
}

// DELETE /api/actors/:id - Delete actor and update workspace entity count
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context
    const actorId = context.params.id as string

    const authUserId = await getUserFromRequest(request, env)
    if (!authUserId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: JSON_HEADERS,
      })
    }

    const actor = await env.DB.prepare(`
      SELECT workspace_id FROM actors WHERE id = ?
    `).bind(actorId).first()

    if (!actor) {
      return new Response(
        JSON.stringify({ error: 'Actor not found' }),
        { status: 404, headers: JSON_HEADERS }
      )
    }

    // Check edit access
    if (!(await checkWorkspaceAccess(actor.workspace_id as string, authUserId, env, 'EDITOR'))) {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions' }),
        { status: 403, headers: JSON_HEADERS }
      )
    }

    const deleteResult = await env.DB.prepare(`
      DELETE FROM actors WHERE id = ?
    `).bind(actorId).run()

    if (!deleteResult.meta.changes) {
      return new Response(
        JSON.stringify({ error: 'Actor not found' }),
        { status: 404, headers: JSON_HEADERS }
      )
    }

    // Update workspace entity count
    const now = new Date().toISOString()
    await env.DB.prepare(`
      UPDATE workspaces
      SET entity_count = json_set(
        COALESCE(entity_count, '{}'),
        '$.actors',
        MAX(0, COALESCE(json_extract(entity_count, '$.actors'), 0) - 1)
      ),
      updated_at = ?
      WHERE id = ?
    `).bind(now, actor.workspace_id).run()

    return new Response(
      JSON.stringify({ message: 'Actor deleted successfully' }),
      { status: 200, headers: JSON_HEADERS }
    )
  } catch (error) {
    console.error('Actor DELETE error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: JSON_HEADERS }
    )
  }
}
