/**
 * Create Investigation from Research Question
 * POST /api/investigations/from-research-question
 * Creates a new investigation pre-populated with research question and plan
 */

import { requireAuth } from '../_shared/auth-helpers'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
}

interface CreateFromResearchQuestionRequest {
  research_question_id: string
  title?: string // Optional override
  description?: string
  tags?: string[]
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const auth = await requireAuth(context)
    if (!auth) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const body = await context.request.json() as CreateFromResearchQuestionRequest

    if (!body.research_question_id) {
      return new Response(JSON.stringify({
        error: 'Missing required field: research_question_id'
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

    // Get research question
    const researchQuestion = await context.env.DB.prepare(`
      SELECT * FROM research_questions WHERE id = ? AND workspace_id = ?
    `).bind(body.research_question_id, workspace.workspace_id).first()

    if (!researchQuestion) {
      return new Response(JSON.stringify({
        error: 'Research question not found or not accessible'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Generate investigation title from research question if not provided
    const title = body.title || `Research: ${researchQuestion.topic}`
    const description = body.description || researchQuestion.selected_question || ''

    // Generate ID
    const id = crypto.randomUUID()

    // Create investigation
    await context.env.DB.prepare(`
      INSERT INTO investigations (
        id, workspace_id, created_by, title, description, type,
        research_question_id, tags, status, metadata
      ) VALUES (?, ?, ?, ?, ?, 'structured_research', ?, ?, 'active', ?)
    `).bind(
      id,
      workspace.workspace_id,
      auth.user.id,
      title,
      description,
      body.research_question_id,
      body.tags ? JSON.stringify(body.tags) : JSON.stringify([]),
      JSON.stringify({
        created_from_research_question: true,
        research_question_data: {
          topic: researchQuestion.topic,
          project_type: researchQuestion.project_type,
          duration: researchQuestion.duration
        }
      })
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
      JSON.stringify({
        title,
        type: 'structured_research',
        from_research_question: true,
        research_question_id: body.research_question_id
      })
    ).run()

    // Fetch the created investigation
    const investigation = await context.env.DB.prepare(`
      SELECT
        i.*,
        u.username as created_by_username,
        rq.topic as research_question_topic,
        rq.selected_question as research_question_text,
        rq.custom_edits as research_plan
      FROM investigations i
      LEFT JOIN users u ON i.created_by = u.id
      LEFT JOIN research_questions rq ON i.research_question_id = rq.id
      WHERE i.id = ?
    `).bind(id).first()

    const parsed = {
      ...investigation,
      tags: investigation.tags ? JSON.parse(investigation.tags) : [],
      metadata: investigation.metadata ? JSON.parse(investigation.metadata) : {},
      research_plan: investigation.research_plan ? JSON.parse(investigation.research_plan) : null
    }

    console.log('[investigations] Created from research question:', id)

    return new Response(JSON.stringify({
      success: true,
      investigation: parsed
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('[investigations] Error creating from research question:', error)
    return new Response(JSON.stringify({
      error: 'Failed to create investigation from research question',
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
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  })
}
