/**
 * Relationships API
 * Manages typed relationships between entities (actors, sources, evidence, events, places, behaviors)
 */

import type { PagesFunction } from '@cloudflare/workers-types'
import { getUserIdOrDefault, getUserFromRequest } from './_shared/auth-helpers'
import { checkWorkspaceAccess } from './_shared/workspace-helpers'
import { generateId, CORS_HEADERS, JSON_HEADERS } from './_shared/api-utils'

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
    // GET /api/relationships?workspace_id=xxx[&cop_session_id=yyy]
    if (method === 'GET' && url.pathname === '/api/relationships') {
      const userId = await getUserIdOrDefault(request, env)
      const workspaceId = url.searchParams.get('workspace_id')
      if (!workspaceId) {
        return new Response(
          JSON.stringify({ error: 'workspace_id parameter required' }),
          { status: 400, headers: JSON_HEADERS }
        )
      }

      // COP session bypass: if caller provides a valid cop_session_id whose
      // workspace_id matches, skip the workspace membership check (COP
      // sessions are designed to be accessible without strict ACLs).
      const copSessionId = url.searchParams.get('cop_session_id')
      let copBypass = false
      if (copSessionId) {
        const session = await env.DB.prepare(
          'SELECT workspace_id FROM cop_sessions WHERE id = ?'
        ).bind(copSessionId).first()
        if (session && session.workspace_id === workspaceId) {
          copBypass = true
        }
      }

      if (!copBypass && !(await checkWorkspaceAccess(workspaceId, userId, env))) {
        return new Response(
          JSON.stringify({ error: 'Access denied to workspace' }),
          { status: 403, headers: JSON_HEADERS }
        )
      }

      let query = `SELECT * FROM relationships WHERE workspace_id = ?`
      const params: any[] = [workspaceId]

      // Filter by entity (source or target)
      const entityId = url.searchParams.get('entity_id')
      if (entityId) {
        query += ` AND (source_entity_id = ? OR target_entity_id = ?)`
        params.push(entityId, entityId)
      }

      // Filter by source entity
      const sourceId = url.searchParams.get('source_entity_id')
      if (sourceId) {
        query += ` AND source_entity_id = ?`
        params.push(sourceId)
      }

      // Filter by target entity
      const targetId = url.searchParams.get('target_entity_id')
      if (targetId) {
        query += ` AND target_entity_id = ?`
        params.push(targetId)
      }

      // Filter by relationship type
      const relType = url.searchParams.get('relationship_type')
      if (relType) {
        query += ` AND relationship_type = ?`
        params.push(relType)
      }

      // Filter by confidence
      const confidence = url.searchParams.get('confidence')
      if (confidence) {
        query += ` AND confidence = ?`
        params.push(confidence)
      }

      query += ` ORDER BY created_at DESC`

      const limit = url.searchParams.get('limit')
      query += ` LIMIT ?`
      params.push(Math.min(limit ? (parseInt(limit) || 50) : 500, 500))

      const { results } = await env.DB.prepare(query).bind(...params).all()

      const safeJSON = (val: any, fallback: any = []) => {
        if (!val) return fallback
        try { return JSON.parse(val as string) } catch { return fallback }
      }

      const relationships = results.map(r => ({
        ...r,
        evidence_ids: safeJSON(r.evidence_ids, [])
      }))

      return new Response(
        JSON.stringify({ relationships }),
        { status: 200, headers: JSON_HEADERS }
      )
    }

    // POST /api/relationships
    if (method === 'POST' && url.pathname === '/api/relationships') {
      const userId = await getUserFromRequest(request, env)
      if (!userId) {
        return new Response(JSON.stringify({ error: 'Authentication required' }), {
          status: 401, headers: JSON_HEADERS
        })
      }

      const body = await request.json() as any

      const ALLOWED_ENTITY_TYPES = ['EVIDENCE', 'ACTOR', 'SOURCE', 'EVENT', 'PLACE', 'BEHAVIOR']

      if (!body.source_entity_id || !body.source_entity_type ||
          !body.target_entity_id || !body.target_entity_type ||
          !body.relationship_type || !body.workspace_id) {
        return new Response(
          JSON.stringify({
            error: 'Missing required fields: source_entity_id, source_entity_type, target_entity_id, target_entity_type, relationship_type, workspace_id'
          }),
          { status: 400, headers: JSON_HEADERS }
        )
      }

      if (!ALLOWED_ENTITY_TYPES.includes(body.source_entity_type) ||
          !ALLOWED_ENTITY_TYPES.includes(body.target_entity_type)) {
        return new Response(
          JSON.stringify({ error: 'Invalid entity type. Allowed: ' + ALLOWED_ENTITY_TYPES.join(', ') }),
          { status: 400, headers: JSON_HEADERS }
        )
      }

      if (!(await checkWorkspaceAccess(body.workspace_id, userId, env, 'EDITOR'))) {
        return new Response(
          JSON.stringify({ error: 'Insufficient permissions' }),
          { status: 403, headers: JSON_HEADERS }
        )
      }

      const id = generateId()
      const now = new Date().toISOString()

      await env.DB.prepare(`
        INSERT INTO relationships (
          id,
          source_entity_id, source_entity_type,
          target_entity_id, target_entity_type,
          relationship_type, description, weight,
          start_date, end_date,
          confidence, evidence_ids,
          workspace_id, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id,
        body.source_entity_id,
        body.source_entity_type,
        body.target_entity_id,
        body.target_entity_type,
        body.relationship_type,
        body.description || null,
        body.weight !== undefined ? body.weight : 1.0,
        body.start_date || null,
        body.end_date || null,
        body.confidence || null,
        body.evidence_ids ? JSON.stringify(body.evidence_ids) : null,
        body.workspace_id,
        userId,
        now,
        now
      ).run()

      const relationship = await env.DB.prepare(`
        SELECT * FROM relationships WHERE id = ?
      `).bind(id).first()

      if (!relationship) {
        return new Response(
          JSON.stringify({ success: true, id }),
          { status: 201, headers: JSON_HEADERS }
        )
      }

      return new Response(
        JSON.stringify({
          ...relationship,
          evidence_ids: (() => { try { return relationship.evidence_ids ? JSON.parse(relationship.evidence_ids as string) : [] } catch { return [] } })()
        }),
        { status: 201, headers: JSON_HEADERS }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: JSON_HEADERS }
    )

  } catch (error) {
    console.error('Relationships API error:', error)
    return new Response(
      JSON.stringify({
        error: 'Internal server error'

      }),
      { status: 500, headers: JSON_HEADERS }
    )
  }
}
