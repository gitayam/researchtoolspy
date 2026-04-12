/**
 * Relationships API - Single resource handlers
 * GET/PUT/DELETE /api/relationships/:id
 */

import type { PagesFunction } from '@cloudflare/workers-types'
import { getUserIdOrDefault, getUserFromRequest } from '../_shared/auth-helpers'
import { checkWorkspaceAccess } from '../_shared/workspace-helpers'
import { JSON_HEADERS } from '../_shared/api-utils'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
}

function entityTypeToTable(entityType: string): string | null {
  switch (entityType) {
    case 'EVIDENCE': return 'evidence'
    case 'ACTOR': return 'actors'
    case 'SOURCE': return 'sources'
    case 'EVENT': return 'events'
    case 'PLACE': return 'places'
    case 'BEHAVIOR': return 'behaviors'
    default: return null
  }
}

function safeParseJSON(val: unknown, fallback: unknown[] = []): unknown {
  if (!val) return fallback
  try { return JSON.parse(val as string) } catch { return fallback }
}

// GET /api/relationships/:id
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const relationshipId = params.id as string

  try {
    const userId = await getUserIdOrDefault(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: JSON_HEADERS,
      })
    }

    const relationship = await env.DB.prepare(`
      SELECT * FROM relationships WHERE id = ?
    `).bind(relationshipId).first()

    if (!relationship) {
      return new Response(
        JSON.stringify({ error: 'Relationship not found' }),
        { status: 404, headers: JSON_HEADERS }
      )
    }

    if (!(await checkWorkspaceAccess(relationship.workspace_id as string, userId, env))) {
      return new Response(
        JSON.stringify({ error: 'Access denied' }),
        { status: 403, headers: JSON_HEADERS }
      )
    }

    // Get source entity details
    let sourceEntity = null
    const sourceTable = entityTypeToTable(relationship.source_entity_type as string)
    if (sourceTable) {
      sourceEntity = await env.DB.prepare(`
        SELECT * FROM ${sourceTable} WHERE id = ?
      `).bind(relationship.source_entity_id).first()
    }

    // Get target entity details
    let targetEntity = null
    const targetTable = entityTypeToTable(relationship.target_entity_type as string)
    if (targetTable) {
      targetEntity = await env.DB.prepare(`
        SELECT * FROM ${targetTable} WHERE id = ?
      `).bind(relationship.target_entity_id).first()
    }

    return new Response(
      JSON.stringify({
        ...relationship,
        evidence_ids: safeParseJSON(relationship.evidence_ids, []),
        source_entity: sourceEntity,
        target_entity: targetEntity
      }),
      { status: 200, headers: JSON_HEADERS }
    )
  } catch (error) {
    console.error('Relationships GET error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: JSON_HEADERS }
    )
  }
}

// PUT /api/relationships/:id
export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const relationshipId = params.id as string

  try {
    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: JSON_HEADERS
      })
    }

    const body = await request.json() as any

    const relationship = await env.DB.prepare(`
      SELECT workspace_id FROM relationships WHERE id = ?
    `).bind(relationshipId).first()

    if (!relationship) {
      return new Response(
        JSON.stringify({ error: 'Relationship not found' }),
        { status: 404, headers: JSON_HEADERS }
      )
    }

    if (!(await checkWorkspaceAccess(relationship.workspace_id as string, userId, env, 'EDITOR'))) {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions' }),
        { status: 403, headers: JSON_HEADERS }
      )
    }

    const now = new Date().toISOString()

    await env.DB.prepare(`
      UPDATE relationships
      SET relationship_type = ?,
          description = ?,
          weight = ?,
          start_date = ?,
          end_date = ?,
          confidence = ?,
          evidence_ids = ?,
          updated_at = ?
      WHERE id = ?
    `).bind(
      body.relationship_type,
      body.description || null,
      body.weight !== undefined ? body.weight : 1.0,
      body.start_date || null,
      body.end_date || null,
      body.confidence || null,
      body.evidence_ids ? JSON.stringify(body.evidence_ids) : null,
      now,
      relationshipId
    ).run()

    const updated = await env.DB.prepare(`
      SELECT * FROM relationships WHERE id = ?
    `).bind(relationshipId).first()

    if (!updated) {
      return new Response(
        JSON.stringify({ success: true, id: relationshipId }),
        { status: 200, headers: JSON_HEADERS }
      )
    }

    return new Response(
      JSON.stringify({
        ...updated,
        evidence_ids: safeParseJSON(updated.evidence_ids, [])
      }),
      { status: 200, headers: JSON_HEADERS }
    )
  } catch (error) {
    console.error('Relationships PUT error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: JSON_HEADERS }
    )
  }
}

// DELETE /api/relationships/:id
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const relationshipId = params.id as string

  try {
    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: JSON_HEADERS
      })
    }

    const relationship = await env.DB.prepare(`
      SELECT workspace_id FROM relationships WHERE id = ?
    `).bind(relationshipId).first()

    if (!relationship) {
      return new Response(
        JSON.stringify({ error: 'Relationship not found' }),
        { status: 404, headers: JSON_HEADERS }
      )
    }

    if (!(await checkWorkspaceAccess(relationship.workspace_id as string, userId, env, 'EDITOR'))) {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions' }),
        { status: 403, headers: JSON_HEADERS }
      )
    }

    const deleteResult = await env.DB.prepare(`
      DELETE FROM relationships WHERE id = ?
    `).bind(relationshipId).run()

    if (!deleteResult.meta.changes) {
      return new Response(
        JSON.stringify({ error: 'Relationship not found' }),
        { status: 404, headers: JSON_HEADERS }
      )
    }

    return new Response(
      JSON.stringify({ message: 'Relationship deleted successfully' }),
      { status: 200, headers: JSON_HEADERS }
    )
  } catch (error) {
    console.error('Relationships DELETE error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: JSON_HEADERS }
    )
  }
}
