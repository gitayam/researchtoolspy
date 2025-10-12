/**
 * Investigations API - List and Create
 * GET /api/investigations - List all investigations for user's workspace
 * POST /api/investigations - Create new investigation
 */

import { requireAuth } from '../_shared/auth-helpers'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
}

interface CreateInvestigationRequest {
  title: string
  description?: string
  type: 'structured_research' | 'general_topic' | 'rapid_analysis'
  research_question_id?: string
  tags?: string[]
}

// GET - List investigations
export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const auth = await requireAuth(context)
    if (!auth) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Get user's workspace
    const workspace = await context.env.DB.prepare(`
      SELECT workspace_id FROM workspace_members WHERE user_id = ? LIMIT 1
    `).bind(auth.user.id).first()

    if (!workspace) {
      return new Response(JSON.stringify({ error: 'No workspace found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Get query parameters
    const url = new URL(context.request.url)
    const status = url.searchParams.get('status') || 'active'
    const type = url.searchParams.get('type')

    // Build query
    let query = `
      SELECT
        i.*,
        u.username as created_by_username,
        rq.topic as research_question_topic,
        rq.selected_question as research_question_text,
        (SELECT COUNT(*) FROM investigation_evidence WHERE investigation_id = i.id) as evidence_count,
        (SELECT COUNT(*) FROM investigation_actors WHERE investigation_id = i.id) as actor_count,
        (SELECT COUNT(*) FROM investigation_sources WHERE investigation_id = i.id) as source_count,
        (SELECT COUNT(*) FROM investigation_frameworks WHERE investigation_id = i.id) as framework_count
      FROM investigations i
      LEFT JOIN users u ON i.created_by = u.id
      LEFT JOIN research_questions rq ON i.research_question_id = rq.id
      WHERE i.workspace_id = ?
    `

    const bindings = [workspace.workspace_id]

    if (status) {
      query += ` AND i.status = ?`
      bindings.push(status)
    }

    if (type) {
      query += ` AND i.type = ?`
      bindings.push(type)
    }

    query += ` ORDER BY i.updated_at DESC`

    const investigations = await context.env.DB.prepare(query)
      .bind(...bindings)
      .all()

    // Parse JSON fields
    const parsed = investigations.results.map((inv: any) => ({
      ...inv,
      tags: inv.tags ? JSON.parse(inv.tags) : [],
      metadata: inv.metadata ? JSON.parse(inv.metadata) : {}
    }))

    return new Response(JSON.stringify({
      investigations: parsed,
      total: parsed.length
    }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('[investigations] Error listing:', error)
    return new Response(JSON.stringify({
      error: 'Failed to list investigations',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// POST - Create investigation
export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const auth = await requireAuth(context)
    if (!auth) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const body = await context.request.json() as CreateInvestigationRequest

    if (!body.title || !body.type) {
      return new Response(JSON.stringify({
        error: 'Missing required fields: title, type'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Get user's workspace
    const workspace = await context.env.DB.prepare(`
      SELECT workspace_id FROM workspace_members WHERE user_id = ? LIMIT 1
    `).bind(auth.user.id).first()

    if (!workspace) {
      return new Response(JSON.stringify({ error: 'No workspace found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Generate ID
    const id = crypto.randomUUID()

    // Validate research question if provided
    if (body.research_question_id) {
      const rq = await context.env.DB.prepare(`
        SELECT id FROM research_questions WHERE id = ? AND workspace_id = ?
      `).bind(body.research_question_id, workspace.workspace_id).first()

      if (!rq) {
        return new Response(JSON.stringify({
          error: 'Research question not found or not accessible'
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        })
      }
    }

    // Create investigation
    await context.env.DB.prepare(`
      INSERT INTO investigations (
        id, workspace_id, created_by, title, description, type,
        research_question_id, tags, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')
    `).bind(
      id,
      workspace.workspace_id,
      auth.user.id,
      body.title,
      body.description || null,
      body.type,
      body.research_question_id || null,
      body.tags ? JSON.stringify(body.tags) : JSON.stringify([])
    ).run()

    // Log activity
    await context.env.DB.prepare(`
      INSERT INTO investigation_activity (
        id, investigation_id, user_id, activity_type, activity_data
      ) VALUES (?, ?, ?, 'created', ?)
    `).bind(
      crypto.randomUUID(),
      id,
      auth.user.id,
      JSON.stringify({ title: body.title, type: body.type })
    ).run()

    // Fetch the created investigation
    const investigation = await context.env.DB.prepare(`
      SELECT
        i.*,
        u.username as created_by_username,
        rq.topic as research_question_topic,
        rq.selected_question as research_question_text
      FROM investigations i
      LEFT JOIN users u ON i.created_by = u.id
      LEFT JOIN research_questions rq ON i.research_question_id = rq.id
      WHERE i.id = ?
    `).bind(id).first()

    const parsed = {
      ...investigation,
      tags: investigation.tags ? JSON.parse(investigation.tags) : [],
      metadata: investigation.metadata ? JSON.parse(investigation.metadata) : {}
    }

    console.log('[investigations] Created:', id)

    return new Response(JSON.stringify({
      success: true,
      investigation: parsed
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('[investigations] Error creating:', error)
    return new Response(JSON.stringify({
      error: 'Failed to create investigation',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// CORS preflight
export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  })
}
