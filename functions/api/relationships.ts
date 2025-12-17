/**
 * Relationships API
 * Manages typed relationships between entities (actors, sources, evidence, events, places, behaviors)
 */

import type { PagesFunction } from '@cloudflare/workers-types'

interface Env {
  DB: D1Database
  SESSIONS: KVNamespace
}

// Helper to get user from session
async function getUserFromRequest(request: Request, env: Env): Promise<number | null> {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.substring(7)
  const sessionData = await env.SESSIONS.get(token)

  if (!sessionData) {
    return null
  }

  const session = JSON.parse(sessionData)
  return session.user_id
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
    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // GET /api/relationships?workspace_id=xxx
    if (method === 'GET' && url.pathname === '/api/relationships') {
      const workspaceId = url.searchParams.get('workspace_id')
      if (!workspaceId) {
        return new Response(
          JSON.stringify({ error: 'workspace_id parameter required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (!(await checkWorkspaceAccess(workspaceId, userId, env))) {
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
      if (limit) {
        query += ` LIMIT ?`
        params.push(parseInt(limit))
      }

      const { results } = await env.DB.prepare(query).bind(...params).all()

      const relationships = results.map(r => ({
        ...r,
        evidence_ids: r.evidence_ids ? JSON.parse(r.evidence_ids as string) : []
      }))

      return new Response(
        JSON.stringify(relationships),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // POST /api/relationships
    if (method === 'POST' && url.pathname === '/api/relationships') {
      const body = await request.json() as any

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

      return new Response(
        JSON.stringify({
          ...relationship,
          evidence_ids: relationship.evidence_ids ? JSON.parse(relationship.evidence_ids as string) : []
        }),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Relationship ID routes
    const relationshipMatch = url.pathname.match(/^\/api\/relationships\/([^\/]+)$/)

    // GET /api/relationships/:id
    if (method === 'GET' && relationshipMatch) {
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
          evidence_ids: relationship.evidence_ids ? JSON.parse(relationship.evidence_ids as string) : [],
          source_entity: sourceEntity,
          target_entity: targetEntity
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // PUT /api/relationships/:id
    if (method === 'PUT' && relationshipMatch) {
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

      return new Response(
        JSON.stringify({
          ...updated,
          evidence_ids: updated.evidence_ids ? JSON.parse(updated.evidence_ids as string) : []
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // DELETE /api/relationships/:id
    if (method === 'DELETE' && relationshipMatch) {
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
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}
