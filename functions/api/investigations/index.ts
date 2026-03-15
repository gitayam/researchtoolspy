/**
 * Investigations API - List and Create
 * GET /api/investigations - List all investigations for user's workspace
 * POST /api/investigations - Create new investigation
 */

import { requireAuth } from '../_shared/auth-helpers'
import { logActivity } from '../_shared/activity-logger'
import { notifyWorkspaceMembers } from '../_shared/notification-logger'
import { JSON_HEADERS, optionsResponse } from '../_shared/api-utils'

// Safe JSON parse — returns fallback on malformed data
const sj = (v: any, fb: any = []) => { if (!v) return fb; try { return JSON.parse(v) } catch { return fb } }

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
    // Try to get auth, but don't require it - support guest users
    let userId: number | null = null
    try {
      userId = await requireAuth(context.request, context.env)
    } catch (error) {
      // User is not authenticated - guest user
      // Return empty list for now (guest investigations are not persisted across sessions)
      return new Response(JSON.stringify({
        investigations: [],
        total: 0
      }), {
        headers: JSON_HEADERS
      })
    }

    // Get user's workspace
    const workspace = await context.env.DB.prepare(`
      SELECT workspace_id FROM workspace_members WHERE user_id = ? LIMIT 1
    `).bind(userId).first()

    if (!workspace) {
      // User has no workspace yet - return empty list
      return new Response(JSON.stringify({
        investigations: [],
        total: 0
      }), {
        headers: JSON_HEADERS
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

    query += ` ORDER BY i.updated_at DESC LIMIT 200`

    const investigations = await context.env.DB.prepare(query)
      .bind(...bindings)
      .all()

    // Parse JSON fields
    const parsed = (investigations.results || []).map((inv: any) => ({
      ...inv,
      tags: sj(inv.tags, []),
      metadata: sj(inv.metadata, {})
    }))

    return new Response(JSON.stringify({
      investigations: parsed,
      total: parsed.length
    }), {
      headers: JSON_HEADERS
    })
  } catch (error) {
    console.error('[investigations] Error listing:', error)
    return new Response(JSON.stringify({
      error: 'Failed to list investigations'

    }), {
      status: 500,
      headers: JSON_HEADERS
    })
  }
}

// POST - Create investigation
export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    let userId: number | null = null
    try {
      userId = await requireAuth(context.request, context.env)
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: JSON_HEADERS,
      })
    }

    const body = await context.request.json() as CreateInvestigationRequest

    if (!body.title || !body.type) {
      return new Response(JSON.stringify({
        error: 'Missing required fields: title, type'
      }), {
        status: 400,
        headers: JSON_HEADERS
      })
    }

    // Get or create workspace for authenticated user
    const workspace = await context.env.DB.prepare(`
      SELECT workspace_id FROM workspace_members WHERE user_id = ? LIMIT 1
    `).bind(userId).first()

    let workspace_id: string
    const user_id = userId

    if (workspace) {
      workspace_id = workspace.workspace_id as string
    } else {
      // Create personal workspace for user
      workspace_id = crypto.randomUUID()

      const user = await context.env.DB.prepare(`
        SELECT username FROM users WHERE id = ?
      `).bind(userId).first()
      const workspaceName = user?.username ? `${user.username}'s Workspace` : `Workspace ${workspace_id.slice(0, 8)}`

      await context.env.DB.prepare(`
        INSERT INTO workspaces (id, name, description, type, owner_id, is_public, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).bind(workspace_id, workspaceName, 'Personal workspace for investigations', 'PERSONAL', userId, 0).run()

      const memberId = crypto.randomUUID()
      await context.env.DB.prepare(`
        INSERT INTO workspace_members (id, workspace_id, user_id, role, joined_at)
        VALUES (?, ?, ?, 'ADMIN', datetime('now'))
      `).bind(memberId, workspace_id, userId).run()
    }

    // Generate ID
    const id = crypto.randomUUID()

    // Validate research question if provided
    if (body.research_question_id) {
      const rq = await context.env.DB.prepare(`
        SELECT id FROM research_questions WHERE id = ? AND workspace_id = ?
      `).bind(body.research_question_id, workspace_id).first()

      if (!rq) {
        return new Response(JSON.stringify({
          error: 'Research question not found or not accessible'
        }), {
          status: 404,
          headers: JSON_HEADERS
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
      workspace_id,
      user_id,
      body.title,
      body.description || null,
      body.type,
      body.research_question_id || null,
      body.tags ? JSON.stringify(body.tags) : JSON.stringify([])
    ).run()

    // Auto-create linked COP workspace
    const copSessionId = crypto.randomUUID()
    const templateType = body.type === 'structured_research' ? 'area_study'
      : body.type === 'rapid_analysis' ? 'quick_brief'
      : 'custom'

    try {
      await context.env.DB.prepare(`
        INSERT INTO cop_sessions (
          id, name, description, template_type, workspace_id, created_by,
          investigation_id, workspace_mode, active_layers, key_questions
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'progress', '[]', '[]')
      `).bind(
        copSessionId,
        body.title,
        body.description || null,
        templateType,
        workspace_id,
        user_id ?? 1,
        id
      ).run()
    } catch (copError) {
      // Non-fatal: investigation was created, COP creation is optional
      console.error('[investigations] Failed to auto-create COP session:', copError)
    }

    // Log activity (only if user is authenticated)
    if (user_id) {
      await context.env.DB.prepare(`
        INSERT INTO investigation_activity (
          id, investigation_id, user_id, activity_type, activity_data
        ) VALUES (?, ?, ?, 'created', ?)
      `).bind(
        crypto.randomUUID(),
        id,
        user_id,
        JSON.stringify({ title: body.title, type: body.type })
      ).run()

      // Log to workspace activity feed
      await logActivity(context.env.DB, {
        workspaceId: workspace_id,
        actorUserId: user_id.toString(),
        actionType: 'CREATED',
        entityType: 'INVESTIGATION',
        entityId: id,
        entityTitle: body.title,
        details: {
          type: body.type,
          research_question_id: body.research_question_id
        }
      })

      // Get user info for notifications
      const userInfo = await context.env.DB.prepare(`
        SELECT account_hash, username FROM users WHERE id = ?
      `).bind(user_id).first()

      if (userInfo && userInfo.account_hash) {
        // Notify workspace members about new investigation
        await notifyWorkspaceMembers(
          context.env.DB,
          workspace_id,
          userInfo.account_hash as string,
          {
            notificationType: 'INVESTIGATION_CREATED',
            title: 'New Investigation Created',
            message: `${userInfo.username || 'A team member'} created "${body.title}"`,
            actionUrl: `/dashboard/investigations/${id}`,
            entityType: 'INVESTIGATION',
            entityId: id,
            actorHash: userInfo.account_hash as string,
            actorName: userInfo.username as string
          }
        )
      }
    }

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
      tags: sj(investigation.tags, []),
      metadata: sj(investigation.metadata, {})
    }

    // Include linked COP session ID in response
    parsed.cop_session_id = copSessionId


    return new Response(JSON.stringify({
      success: true,
      investigation: parsed
    }), {
      status: 201,
      headers: JSON_HEADERS
    })
  } catch (error) {
    console.error('[investigations] Error creating:', error)
    return new Response(JSON.stringify({
      error: 'Failed to create investigation'

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
