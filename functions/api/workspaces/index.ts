/**
 * Unified Workspace API
 *
 * GET  /api/workspaces - List user's workspaces (owned + member)
 * POST /api/workspaces - Create investigation + COP session atomically
 */

import { getUserFromRequest } from '../_shared/auth-helpers'
import { logActivity } from '../_shared/activity-logger'
import { notifyWorkspaceMembers } from '../_shared/notification-logger'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
  JWT_SECRET?: string
}

const jsonHeaders = { 'Content-Type': 'application/json' }

interface CreateWorkspaceRequest {
  // Investigation fields
  title: string
  description?: string
  investigation_type: 'structured_research' | 'general_topic' | 'rapid_analysis'
  tags?: string[]

  // COP fields
  cop_template: string
  center_lat?: number | null
  center_lon?: number | null
  zoom?: number
  rolling_hours?: number | null
  active_layers?: string[]
  key_questions?: string[]

  // Event analysis fields (optional)
  event_type?: string
  event_description?: string
  initial_urls?: string[]
}

// GET — List user's workspaces
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  try {
    const userId = await getUserFromRequest(request, env)

    if (!userId) {
      return new Response(JSON.stringify({ owned: [], member: [] }), { headers: jsonHeaders })
    }

    const { results: ownedWorkspaces } = await env.DB.prepare(`
      SELECT * FROM workspaces WHERE owner_id = ? ORDER BY created_at DESC
    `).bind(userId).all()

    const { results: memberWorkspaces } = await env.DB.prepare(`
      SELECT w.*, wm.role FROM workspaces w
      JOIN workspace_members wm ON w.id = wm.workspace_id
      WHERE wm.user_id = ? AND w.owner_id != ?
      ORDER BY w.created_at DESC
    `).bind(userId, userId).all()

    const parseWorkspace = (w: any) => ({
      ...w,
      is_public: Boolean(w.is_public),
      allow_cloning: Boolean(w.allow_cloning),
    })

    return new Response(JSON.stringify({
      owned: ownedWorkspaces.map(parseWorkspace),
      member: memberWorkspaces.map(parseWorkspace),
    }), { headers: jsonHeaders })
  } catch (error) {
    console.error('[workspaces] List error:', error)
    return new Response(JSON.stringify({ error: 'Failed to list workspaces' }), {
      status: 500, headers: jsonHeaders,
    })
  }
}

// POST — Create unified workspace
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  try {
    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: jsonHeaders }
      )
    }
    const body = (await request.json()) as CreateWorkspaceRequest

    // ── Validate required fields ──────────────────────────────────
    if (!body.title?.trim()) {
      return new Response(
        JSON.stringify({ error: 'Title is required' }),
        { status: 400, headers: jsonHeaders }
      )
    }

    if (!body.investigation_type || !body.cop_template) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: investigation_type, cop_template' }),
        { status: 400, headers: jsonHeaders }
      )
    }

    // ── Resolve workspace ─────────────────────────────────────────
    let workspaceId: string

    const workspace = await env.DB.prepare(
      `SELECT workspace_id FROM workspace_members WHERE user_id = ? LIMIT 1`
    ).bind(userId).first()

    if (workspace) {
      workspaceId = workspace.workspace_id as string
    } else {
      // Create personal workspace for user
      workspaceId = crypto.randomUUID()

      const user = await env.DB.prepare(
        `SELECT username FROM users WHERE id = ?`
      ).bind(userId).first()

      const workspaceName = user?.username
        ? `${user.username}'s Workspace`
        : `Workspace ${workspaceId.slice(0, 8)}`

      await env.DB.prepare(`
        INSERT INTO workspaces (id, name, description, type, owner_id, is_public, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).bind(
        workspaceId,
        workspaceName,
        'Personal workspace',
        'PERSONAL',
        userId,
        0
      ).run()

      const memberId = crypto.randomUUID()
      await env.DB.prepare(`
        INSERT INTO workspace_members (id, workspace_id, user_id, role, joined_at)
        VALUES (?, ?, ?, 'ADMIN', datetime('now'))
      `).bind(memberId, workspaceId, userId).run()
    }

    // ── 1. Create investigation ───────────────────────────────────
    const investigationId = crypto.randomUUID()

    await env.DB.prepare(`
      INSERT INTO investigations (
        id, workspace_id, created_by, title, description, type, tags, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
    `).bind(
      investigationId,
      workspaceId,
      userId,
      body.title.trim(),
      body.description?.trim() || null,
      body.investigation_type,
      body.tags ? JSON.stringify(body.tags) : '[]'
    ).run()

    // ── 2. Create COP session with full config ────────────────────
    const copSessionId = `cop-${crypto.randomUUID().slice(0, 12)}`
    const now = new Date().toISOString()

    const rollingHours = body.rolling_hours === undefined ? 24 : body.rolling_hours

    await env.DB.prepare(`
      INSERT INTO cop_sessions (
        id, name, description, template_type, status,
        center_lat, center_lon, zoom_level, rolling_hours,
        active_layers, key_questions,
        event_type, event_description,
        workspace_id, created_by, investigation_id, workspace_mode,
        is_public, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      copSessionId,
      body.title.trim(),
      body.description?.trim() || null,
      body.cop_template,
      'ACTIVE',
      body.center_lat ?? null,
      body.center_lon ?? null,
      body.zoom ?? (body.center_lat ? 10 : 5),
      rollingHours,
      body.active_layers ? JSON.stringify(body.active_layers) : '[]',
      body.key_questions ? JSON.stringify(body.key_questions) : '[]',
      body.event_type || null,
      body.event_description || null,
      workspaceId,
      userId,
      investigationId,
      'progress',
      0,
      now,
      now
    ).run()


    // ── Activity logging ─────────────────────────────────────────
    try {
      await env.DB.prepare(`
        INSERT INTO investigation_activity (
          id, investigation_id, user_id, activity_type, activity_data
        ) VALUES (?, ?, ?, 'created', ?)
      `).bind(
        crypto.randomUUID(),
        investigationId,
        userId,
        JSON.stringify({ title: body.title, type: body.investigation_type, cop_session_id: copSessionId })
      ).run()

      await logActivity(env.DB, {
        workspaceId,
        actorUserId: userId.toString(),
        actionType: 'CREATED',
        entityType: 'INVESTIGATION',
        entityId: investigationId,
        entityTitle: body.title,
        details: {
          type: body.investigation_type,
          cop_template: body.cop_template,
          cop_session_id: copSessionId,
        },
      })
    } catch (logErr) {
      console.error('[workspaces] Activity log error (non-fatal):', logErr)
    }

    // ── Workspace notifications ──────────────────────────────────
    try {
      const userInfo = await env.DB.prepare(
        `SELECT account_hash, username FROM users WHERE id = ?`
      ).bind(userId).first()

      if (userInfo?.account_hash) {
        await notifyWorkspaceMembers(env.DB, workspaceId, userInfo.account_hash as string, {
          notificationType: 'INVESTIGATION_CREATED',
          title: 'New Workspace Created',
          message: `${userInfo.username || 'A team member'} created "${body.title}"`,
          actionUrl: `/dashboard/cop/${copSessionId}`,
          entityType: 'INVESTIGATION',
          entityId: investigationId,
          actorHash: userInfo.account_hash as string,
          actorName: userInfo.username as string,
        })
      }
    } catch (notifErr) {
      console.error('[workspaces] Notification error (non-fatal):', notifErr)
    }

    // ── Response ─────────────────────────────────────────────────
    return new Response(
      JSON.stringify({
        success: true,
        investigation_id: investigationId,
        cop_session_id: copSessionId,
      }),
      { status: 201, headers: jsonHeaders }
    )
  } catch (error) {
    console.error('[workspaces] Create error:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to create workspace' }),
      { status: 500, headers: jsonHeaders }
    )
  }
}

