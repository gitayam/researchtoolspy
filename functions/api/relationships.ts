/**
 * Relationships API
 * Manages typed relationships between entities (actors, sources, evidence, events, places, behaviors)
 */

import type { PagesFunction } from '@cloudflare/workers-types'
import { getUserIdOrDefault, getUserFromRequest } from './_shared/auth-helpers'

interface Env {
  DB: D1Database
  SESSIONS: KVNamespace
}

// Generate UUID v4
function generateId(): string {
  return crypto.randomUUID()
}

// Check workspace access
async function checkWorkspaceAccess(
  workspaceId: string,
  userId: number,
  env: Env,
  requiredRole?: 'ADMIN' | 'EDITOR' | 'VIEWER'
): Promise<boolean> {
  const workspace = await env.DB.prepare(`
    SELECT owner_id, is_public FROM workspaces WHERE id = ?
  `).bind(workspaceId).first()

  if (!workspace) {
    return false
  }

  if (workspace.owner_id === userId) {
    return true
  }

  const member = await env.DB.prepare(`
    SELECT role FROM workspace_members
    WHERE workspace_id = ? AND user_id = ?
  `).bind(workspaceId, userId).first()

  if (member) {
    if (!requiredRole) return true
    if (requiredRole === 'VIEWER') return true
    if (requiredRole === 'EDITOR' && (member.role === 'EDITOR' || member.role === 'ADMIN')) return true
    if (requiredRole === 'ADMIN' && member.role === 'ADMIN') return true
  }

  if (workspace.is_public && (!requiredRole || requiredRole === 'VIEWER')) {
    return true
  }

  return false
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  const url = new URL(request.url)
  const method = request.method

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }

  if (method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // GET /api/relationships?workspace_id=xxx[&cop_session_id=yyy]
    if (method === 'GET' && url.pathname === '/api/relationships') {
      const userId = await getUserIdOrDefault(request, env)
      const workspaceId = url.searchParams.get('workspace_id')
      if (!workspaceId) {
        return new Response(
          JSON.stringify({ error: 'workspace_id parameter required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
      params.push(limit ? (parseInt(limit) || 50) : 500)

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
        JSON.stringify(relationships),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // POST /api/relationships
    if (method === 'POST' && url.pathname === '/api/relationships') {
      const userId = await getUserFromRequest(request, env)
      if (!userId) {
        return new Response(JSON.stringify({ error: 'Authentication required' }), {
          status: 401, headers: corsHeaders
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
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (!ALLOWED_ENTITY_TYPES.includes(body.source_entity_type) ||
          !ALLOWED_ENTITY_TYPES.includes(body.target_entity_type)) {
        return new Response(
          JSON.stringify({ error: 'Invalid entity type. Allowed: ' + ALLOWED_ENTITY_TYPES.join(', ') }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (!(await checkWorkspaceAccess(body.workspace_id, userId, env, 'EDITOR'))) {
        return new Response(
          JSON.stringify({ error: 'Insufficient permissions' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
          { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({
          ...relationship,
          evidence_ids: (() => { try { return relationship.evidence_ids ? JSON.parse(relationship.evidence_ids as string) : [] } catch { return [] } })()
        }),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Relationship ID routes
    const relationshipMatch = url.pathname.match(/^\/api\/relationships\/([^\/]+)$/)

    // GET /api/relationships/:id
    if (method === 'GET' && relationshipMatch) {
      const userId = await getUserIdOrDefault(request, env)
      const relationshipId = relationshipMatch[1]

      const relationship = await env.DB.prepare(`
        SELECT * FROM relationships WHERE id = ?
      `).bind(relationshipId).first()

      if (!relationship) {
        return new Response(
          JSON.stringify({ error: 'Relationship not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (!(await checkWorkspaceAccess(relationship.workspace_id as string, userId, env))) {
        return new Response(
          JSON.stringify({ error: 'Access denied' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Get source entity details
      let sourceEntity = null
      const sourceTable = relationship.source_entity_type === 'EVIDENCE' ? 'evidence' :
                         relationship.source_entity_type === 'ACTOR' ? 'actors' :
                         relationship.source_entity_type === 'SOURCE' ? 'sources' :
                         relationship.source_entity_type === 'EVENT' ? 'events' :
                         relationship.source_entity_type === 'PLACE' ? 'places' :
                         relationship.source_entity_type === 'BEHAVIOR' ? 'behaviors' : null

      if (sourceTable) {
        sourceEntity = await env.DB.prepare(`
          SELECT * FROM ${sourceTable} WHERE id = ?
        `).bind(relationship.source_entity_id).first()
      }

      // Get target entity details
      let targetEntity = null
      const targetTable = relationship.target_entity_type === 'EVIDENCE' ? 'evidence' :
                         relationship.target_entity_type === 'ACTOR' ? 'actors' :
                         relationship.target_entity_type === 'SOURCE' ? 'sources' :
                         relationship.target_entity_type === 'EVENT' ? 'events' :
                         relationship.target_entity_type === 'PLACE' ? 'places' :
                         relationship.target_entity_type === 'BEHAVIOR' ? 'behaviors' : null

      if (targetTable) {
        targetEntity = await env.DB.prepare(`
          SELECT * FROM ${targetTable} WHERE id = ?
        `).bind(relationship.target_entity_id).first()
      }

      return new Response(
        JSON.stringify({
          ...relationship,
          evidence_ids: (() => { try { return relationship.evidence_ids ? JSON.parse(relationship.evidence_ids as string) : [] } catch { return [] } })(),
          source_entity: sourceEntity,
          target_entity: targetEntity
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // PUT /api/relationships/:id
    if (method === 'PUT' && relationshipMatch) {
      const userId = await getUserFromRequest(request, env)
      if (!userId) {
        return new Response(JSON.stringify({ error: 'Authentication required' }), {
          status: 401, headers: corsHeaders
        })
      }

      const relationshipId = relationshipMatch[1]
      const body = await request.json() as any

      const relationship = await env.DB.prepare(`
        SELECT workspace_id FROM relationships WHERE id = ?
      `).bind(relationshipId).first()

      if (!relationship) {
        return new Response(
          JSON.stringify({ error: 'Relationship not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (!(await checkWorkspaceAccess(relationship.workspace_id as string, userId, env, 'EDITOR'))) {
        return new Response(
          JSON.stringify({ error: 'Insufficient permissions' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({
          ...updated,
          evidence_ids: (() => { try { return updated.evidence_ids ? JSON.parse(updated.evidence_ids as string) : [] } catch { return [] } })()
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // DELETE /api/relationships/:id
    if (method === 'DELETE' && relationshipMatch) {
      const userId = await getUserFromRequest(request, env)
      if (!userId) {
        return new Response(JSON.stringify({ error: 'Authentication required' }), {
          status: 401, headers: corsHeaders
        })
      }

      const relationshipId = relationshipMatch[1]

      const relationship = await env.DB.prepare(`
        SELECT workspace_id FROM relationships WHERE id = ?
      `).bind(relationshipId).first()

      if (!relationship) {
        return new Response(
          JSON.stringify({ error: 'Relationship not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (!(await checkWorkspaceAccess(relationship.workspace_id as string, userId, env, 'EDITOR'))) {
        return new Response(
          JSON.stringify({ error: 'Insufficient permissions' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      await env.DB.prepare(`
        DELETE FROM relationships WHERE id = ?
      `).bind(relationshipId).run()

      return new Response(
        JSON.stringify({ message: 'Relationship deleted successfully' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Relationships API error:', error)
    return new Response(
      JSON.stringify({
        error: 'Internal server error'

      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}
