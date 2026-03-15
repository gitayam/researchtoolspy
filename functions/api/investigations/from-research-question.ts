/**
 * Create Investigation from Research Question
 * POST /api/investigations/from-research-question
 * Creates a new investigation pre-populated with research question and plan
 */

import { requireAuth } from '../_shared/auth-helpers'
import { JSON_HEADERS, optionsResponse } from '../_shared/api-utils'

const sj = (v: any, fb: any = []) => { if (!v) return fb; try { return JSON.parse(v) } catch { return fb } }

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
    const userId = await requireAuth(context.request, context.env)

    const body = await context.request.json() as CreateFromResearchQuestionRequest

    if (!body.research_question_id) {
      return new Response(JSON.stringify({
        error: 'Missing required field: research_question_id'
      }), {
        status: 400,
        headers: JSON_HEADERS
      })
    }

    // Get user's workspace
    const workspace = await context.env.DB.prepare(`
      SELECT workspace_id FROM workspace_members WHERE user_id = ? LIMIT 1
    `).bind(userId).first()

    if (!workspace) {
      return new Response(JSON.stringify({ error: 'No workspace found' }), {
        status: 404,
        headers: JSON_HEADERS
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
        headers: JSON_HEADERS
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
      userId,
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
      userId,
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
      tags: sj(investigation.tags, []),
      metadata: sj(investigation.metadata, {}),
      research_plan: sj(investigation.research_plan, null)
    }


    return new Response(JSON.stringify({
      success: true,
      investigation: parsed
    }), {
      status: 201,
      headers: JSON_HEADERS
    })
  } catch (error) {
    console.error('[investigations] Error creating from research question:', error)
    return new Response(JSON.stringify({
      error: 'Failed to create investigation from research question'

    }), {
      status: 500,
      headers: JSON_HEADERS
    })
  }
}

// CORS preflight
export const onRequestOptions: PagesFunction = async () => {
  return optionsResponse()
}
