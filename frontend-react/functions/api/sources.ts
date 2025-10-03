/**
 * Sources API
 * Manages intelligence sources (HUMINT, SIGINT, IMINT, etc.) with MOSES assessment
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

    // GET /api/sources?workspace_id=xxx
    if (method === 'GET' && url.pathname === '/api/sources') {
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

      let query = `SELECT * FROM sources WHERE workspace_id = ?`
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
      if (limit) {
        query += ` LIMIT ?`
        params.push(parseInt(limit))
      }

      const { results } = await env.DB.prepare(query).bind(...params).all()

      const sources = results.map(s => ({
        ...s,
        moses_assessment: s.moses_assessment ? JSON.parse(s.moses_assessment as string) : null,
        is_public: Boolean(s.is_public)
      }))

      return new Response(
        JSON.stringify(sources),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // POST /api/sources
    if (method === 'POST' && url.pathname === '/api/sources') {
      const body = await request.json() as any

      if (!body.name || !body.type || !body.workspace_id) {
        return new Response(
          JSON.stringify({ error: 'Missing required fields: name, type, workspace_id' }),
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
        INSERT INTO sources (
          id, type, name, description, source_type,
          moses_assessment, controlled_by,
          workspace_id, created_by, created_at, updated_at,
          is_public, votes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id,
        body.type,
        body.name,
        body.description || null,
        body.source_type || null,
        body.moses_assessment ? JSON.stringify(body.moses_assessment) : null,
        body.controlled_by || null,
        body.workspace_id,
        userId,
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
          '$.sources',
          COALESCE(json_extract(entity_count, '$.sources'), 0) + 1
        ),
        updated_at = ?
        WHERE id = ?
      `).bind(now, body.workspace_id).run()

      const source = await env.DB.prepare(`
        SELECT * FROM sources WHERE id = ?
      `).bind(id).first()

      return new Response(
        JSON.stringify({
          ...source,
          moses_assessment: source.moses_assessment ? JSON.parse(source.moses_assessment as string) : null,
          is_public: Boolean(source.is_public)
        }),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Source ID routes
    const sourceMatch = url.pathname.match(/^\/api\/sources\/([^\/]+)$/)

    // GET /api/sources/:id
    if (method === 'GET' && sourceMatch) {
      const sourceId = sourceMatch[1]

      const source = await env.DB.prepare(`
        SELECT * FROM sources WHERE id = ?
      `).bind(sourceId).first()

      if (!source) {
        return new Response(
          JSON.stringify({ error: 'Source not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (!(await checkWorkspaceAccess(source.workspace_id as string, userId, env))) {
        return new Response(
          JSON.stringify({ error: 'Access denied' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Get related evidence count
      const { results: evidenceCount } = await env.DB.prepare(`
        SELECT COUNT(*) as count FROM source_evidence WHERE source_id = ?
      `).bind(sourceId).all()

      return new Response(
        JSON.stringify({
          ...source,
          moses_assessment: source.moses_assessment ? JSON.parse(source.moses_assessment as string) : null,
          is_public: Boolean(source.is_public),
          related_counts: {
            evidence: evidenceCount[0]?.count || 0
          }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // PUT /api/sources/:id
    if (method === 'PUT' && sourceMatch) {
      const sourceId = sourceMatch[1]
      const body = await request.json() as any

      const source = await env.DB.prepare(`
        SELECT workspace_id FROM sources WHERE id = ?
      `).bind(sourceId).first()

      if (!source) {
        return new Response(
          JSON.stringify({ error: 'Source not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (!(await checkWorkspaceAccess(source.workspace_id as string, userId, env, 'EDITOR'))) {
        return new Response(
          JSON.stringify({ error: 'Insufficient permissions' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

      return new Response(
        JSON.stringify({
          ...updated,
          moses_assessment: updated.moses_assessment ? JSON.parse(updated.moses_assessment as string) : null,
          is_public: Boolean(updated.is_public)
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // DELETE /api/sources/:id
    if (method === 'DELETE' && sourceMatch) {
      const sourceId = sourceMatch[1]

      const source = await env.DB.prepare(`
        SELECT workspace_id FROM sources WHERE id = ?
      `).bind(sourceId).first()

      if (!source) {
        return new Response(
          JSON.stringify({ error: 'Source not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (!(await checkWorkspaceAccess(source.workspace_id as string, userId, env, 'EDITOR'))) {
        return new Response(
          JSON.stringify({ error: 'Insufficient permissions' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Sources API error:', error)
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}
