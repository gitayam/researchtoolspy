/**
 * Investigation Detail API - Get, Update, Delete
 * GET /api/investigations/[id] - Get investigation details
 * PUT /api/investigations/[id] - Update investigation
 * DELETE /api/investigations/[id] - Delete investigation
 */

import { requireAuth } from '../_shared/auth-helpers'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
}

interface UpdateInvestigationRequest {
  title?: string
  description?: string
  status?: 'active' | 'completed' | 'archived'
  tags?: string[]
  metadata?: Record<string, any>
}

// GET - Get investigation details
export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const auth = await requireAuth(context)
    if (!auth) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const investigationId = context.params.id as string

    // Get investigation with stats
    const investigation = await context.env.DB.prepare(`
      SELECT
        i.*,
        u.username as created_by_username,
        rq.topic as research_question_topic,
        rq.selected_question as research_question_text,
        rq.custom_edits as research_plan,
        (SELECT COUNT(*) FROM investigation_evidence WHERE investigation_id = i.id) as evidence_count,
        (SELECT COUNT(*) FROM investigation_actors WHERE investigation_id = i.id) as actor_count,
        (SELECT COUNT(*) FROM investigation_sources WHERE investigation_id = i.id) as source_count,
        (SELECT COUNT(*) FROM investigation_events WHERE investigation_id = i.id) as event_count,
        (SELECT COUNT(*) FROM investigation_frameworks WHERE investigation_id = i.id) as framework_count
      FROM investigations i
      LEFT JOIN users u ON i.created_by = u.id
      LEFT JOIN research_questions rq ON i.research_question_id = rq.id
      INNER JOIN workspace_members wm ON i.workspace_id = wm.workspace_id
      WHERE i.id = ? AND wm.user_id = ?
    `).bind(investigationId, auth.user.id).first()

    if (!investigation) {
      return new Response(JSON.stringify({
        error: 'Investigation not found or not accessible'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Parse JSON fields
    const parsed = {
      ...investigation,
      tags: investigation.tags ? JSON.parse(investigation.tags) : [],
      metadata: investigation.metadata ? JSON.parse(investigation.metadata) : {},
      research_plan: investigation.research_plan ? JSON.parse(investigation.research_plan) : null
    }

    return new Response(JSON.stringify({
      investigation: parsed
    }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('[investigations] Error fetching:', error)
    return new Response(JSON.stringify({
      error: 'Failed to fetch investigation',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// PUT - Update investigation
export const onRequestPut: PagesFunction<Env> = async (context) => {
  try {
    const auth = await requireAuth(context)
    if (!auth) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const investigationId = context.params.id as string
    const body = await context.request.json() as UpdateInvestigationRequest

    // Verify access
    const investigation = await context.env.DB.prepare(`
      SELECT i.id
      FROM investigations i
      INNER JOIN workspace_members wm ON i.workspace_id = wm.workspace_id
      WHERE i.id = ? AND wm.user_id = ?
    `).bind(investigationId, auth.user.id).first()

    if (!investigation) {
      return new Response(JSON.stringify({
        error: 'Investigation not found or not accessible'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Build update query
    const updates: string[] = []
    const bindings: any[] = []

    if (body.title !== undefined) {
      updates.push('title = ?')
      bindings.push(body.title)
    }
    if (body.description !== undefined) {
      updates.push('description = ?')
      bindings.push(body.description)
    }
    if (body.status !== undefined) {
      updates.push('status = ?')
      bindings.push(body.status)
    }
    if (body.tags !== undefined) {
      updates.push('tags = ?')
      bindings.push(JSON.stringify(body.tags))
    }
    if (body.metadata !== undefined) {
      updates.push('metadata = ?')
      bindings.push(JSON.stringify(body.metadata))
    }

    if (updates.length === 0) {
      return new Response(JSON.stringify({
        error: 'No fields to update'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    updates.push('updated_at = datetime(\'now\')')

    const query = `UPDATE investigations SET ${updates.join(', ')} WHERE id = ?`
    bindings.push(investigationId)

    await context.env.DB.prepare(query).bind(...bindings).run()

    // Log activity
    await context.env.DB.prepare(`
      INSERT INTO investigation_activity (
        id, investigation_id, user_id, activity_type, activity_data
      ) VALUES (?, ?, ?, 'updated', ?)
    `).bind(
      crypto.randomUUID(),
      investigationId,
      auth.user.id,
      JSON.stringify(body)
    ).run()

    // Fetch updated investigation
    const updated = await context.env.DB.prepare(`
      SELECT
        i.*,
        u.username as created_by_username
      FROM investigations i
      LEFT JOIN users u ON i.created_by = u.id
      WHERE i.id = ?
    `).bind(investigationId).first()

    const parsed = {
      ...updated,
      tags: updated.tags ? JSON.parse(updated.tags) : [],
      metadata: updated.metadata ? JSON.parse(updated.metadata) : {}
    }

    console.log('[investigations] Updated:', investigationId)

    return new Response(JSON.stringify({
      success: true,
      investigation: parsed
    }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('[investigations] Error updating:', error)
    return new Response(JSON.stringify({
      error: 'Failed to update investigation',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// DELETE - Delete investigation
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  try {
    const auth = await requireAuth(context)
    if (!auth) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const investigationId = context.params.id as string

    // Verify access
    const investigation = await context.env.DB.prepare(`
      SELECT i.id, i.title
      FROM investigations i
      INNER JOIN workspace_members wm ON i.workspace_id = wm.workspace_id
      WHERE i.id = ? AND wm.user_id = ?
    `).bind(investigationId, auth.user.id).first()

    if (!investigation) {
      return new Response(JSON.stringify({
        error: 'Investigation not found or not accessible'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Delete investigation (cascade will handle related records)
    await context.env.DB.prepare(`
      DELETE FROM investigations WHERE id = ?
    `).bind(investigationId).run()

    console.log('[investigations] Deleted:', investigationId)

    return new Response(JSON.stringify({
      success: true,
      message: 'Investigation deleted successfully'
    }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('[investigations] Error deleting:', error)
    return new Response(JSON.stringify({
      error: 'Failed to delete investigation',
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
      'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  })
}
