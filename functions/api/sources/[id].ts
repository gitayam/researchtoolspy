/**
 * Source by ID API — GET/PUT/DELETE /api/sources/:id
 *
 * Handles individual source operations with workspace access checks
 * and ownership verification for mutations.
 */

import type { PagesFunction } from '@cloudflare/workers-types'
import { getUserIdOrDefault, getUserFromRequest } from '../_shared/auth-helpers'
import { checkWorkspaceAccess } from '../_shared/workspace-helpers'
import { JSON_HEADERS, CORS_HEADERS, safeJsonParse } from '../_shared/api-utils'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
}

/**
 * GET /api/sources/:id
 * Returns the source with parsed JSON fields and related evidence count.
 * Requires workspace read access (guest-friendly).
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const sourceId = params.id as string

  try {
    const userId = await getUserIdOrDefault(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: JSON_HEADERS,
      })
    }

    const source = await env.DB.prepare(`
      SELECT * FROM sources WHERE id = ?
    `).bind(sourceId).first()

    if (!source) {
      return new Response(
        JSON.stringify({ error: 'Source not found' }),
        { status: 404, headers: JSON_HEADERS }
      )
    }

    if (!(await checkWorkspaceAccess(source.workspace_id as string, userId, env))) {
      return new Response(
        JSON.stringify({ error: 'Access denied' }),
        { status: 403, headers: JSON_HEADERS }
      )
    }

    // Get related evidence count
    const { results: evidenceCount } = await env.DB.prepare(`
      SELECT COUNT(*) as count FROM source_evidence WHERE source_id = ?
    `).bind(sourceId).all()

    return new Response(
      JSON.stringify({
        ...source,
        moses_assessment: safeJsonParse(source.moses_assessment),
        is_public: Boolean(source.is_public),
        related_counts: {
          evidence: evidenceCount[0]?.count || 0
        }
      }),
      { status: 200, headers: JSON_HEADERS }
    )
  } catch (error) {
    console.error('Sources GET /:id error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: JSON_HEADERS }
    )
  }
}

/**
 * PUT /api/sources/:id
 * Updates a source. Requires authentication and EDITOR workspace access.
 */
export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const sourceId = params.id as string

  try {
    const authUserId = await getUserFromRequest(request, env)
    if (!authUserId) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: JSON_HEADERS }
      )
    }

    const body = await request.json() as any

    const source = await env.DB.prepare(`
      SELECT workspace_id FROM sources WHERE id = ?
    `).bind(sourceId).first()

    if (!source) {
      return new Response(
        JSON.stringify({ error: 'Source not found' }),
        { status: 404, headers: JSON_HEADERS }
      )
    }

    if (!(await checkWorkspaceAccess(source.workspace_id as string, authUserId, env, 'EDITOR'))) {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions' }),
        { status: 403, headers: JSON_HEADERS }
      )
    }

    const now = new Date().toISOString()

    await env.DB.prepare(`
      UPDATE sources
      SET name = ?,
          description = ?,
          source_type = ?,
          moses_assessment = ?,
          controlled_by = ?,
          is_public = ?,
          updated_at = ?
      WHERE id = ?
    `).bind(
      body.name,
      body.description || null,
      body.source_type || null,
      body.moses_assessment ? JSON.stringify(body.moses_assessment) : null,
      body.controlled_by || null,
      body.is_public ? 1 : 0,
      now,
      sourceId
    ).run()

    const updated = await env.DB.prepare(`
      SELECT * FROM sources WHERE id = ?
    `).bind(sourceId).first()

    if (!updated) {
      return new Response(
        JSON.stringify({ success: true, id: sourceId }),
        { status: 200, headers: JSON_HEADERS }
      )
    }

    return new Response(
      JSON.stringify({
        ...updated,
        moses_assessment: safeJsonParse(updated.moses_assessment),
        is_public: Boolean(updated.is_public)
      }),
      { status: 200, headers: JSON_HEADERS }
    )
  } catch (error) {
    console.error('Sources PUT /:id error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: JSON_HEADERS }
    )
  }
}

/**
 * DELETE /api/sources/:id
 * Deletes a source and decrements the workspace entity count.
 * Requires authentication and EDITOR workspace access.
 */
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const sourceId = params.id as string

  try {
    const authUserId = await getUserFromRequest(request, env)
    if (!authUserId) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: JSON_HEADERS }
      )
    }

    const source = await env.DB.prepare(`
      SELECT workspace_id FROM sources WHERE id = ?
    `).bind(sourceId).first()

    if (!source) {
      return new Response(
        JSON.stringify({ error: 'Source not found' }),
        { status: 404, headers: JSON_HEADERS }
      )
    }

    if (!(await checkWorkspaceAccess(source.workspace_id as string, authUserId, env, 'EDITOR'))) {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions' }),
        { status: 403, headers: JSON_HEADERS }
      )
    }

    await env.DB.prepare(`
      DELETE FROM sources WHERE id = ?
    `).bind(sourceId).run()

    const now = new Date().toISOString()
    await env.DB.prepare(`
      UPDATE workspaces
      SET entity_count = json_set(
        COALESCE(entity_count, '{}'),
        '$.sources',
        MAX(0, COALESCE(json_extract(entity_count, '$.sources'), 0) - 1)
      ),
      updated_at = ?
      WHERE id = ?
    `).bind(now, source.workspace_id).run()

    return new Response(
      JSON.stringify({ message: 'Source deleted successfully' }),
      { status: 200, headers: JSON_HEADERS }
    )
  } catch (error) {
    console.error('Sources DELETE /:id error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: JSON_HEADERS }
    )
  }
}

/**
 * OPTIONS /api/sources/:id — CORS preflight
 */
export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, { headers: CORS_HEADERS })
}
