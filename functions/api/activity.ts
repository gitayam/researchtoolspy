// ============================================================================
// Activity Feed API - Workspace activity tracking
// ============================================================================

import { getUserFromRequest, requireAuth } from './_shared/auth-helpers'

interface Env {
  DB: D1Database
  JWT_SECRET?: string
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash, X-Workspace-ID',
  'Content-Type': 'application/json',
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS })
  }

  try {
    const userId = await getUserFromRequest(request, env)
    
    // Get user hash for logging if authenticated
    let userHash = 'guest'
    if (userId) {
      const user = await env.DB.prepare('SELECT user_hash FROM users WHERE id = ?').bind(userId).first()
      if (user?.user_hash) userHash = user.user_hash as string
    }

    const workspaceId = request.headers.get('X-Workspace-ID')

    // GET /api/activity - List workspace activity
    if (request.method === 'GET') {
      // Require auth for viewing activity
      await requireAuth(request, env)
      
      const url = new URL(request.url)
      const limit = parseInt(url.searchParams.get('limit') || '50')
      const offset = parseInt(url.searchParams.get('offset') || '0')
      const actionType = url.searchParams.get('type')
      const entityType = url.searchParams.get('entity_type')
      const actorUserId = url.searchParams.get('user_id')

      if (!workspaceId) {
        return new Response(JSON.stringify({ error: 'X-Workspace-ID header required' }), {
          status: 400,
          headers: CORS_HEADERS
        })
      }

      let query = `
        SELECT *
        FROM activity_feed
        WHERE workspace_id = ?
      `
      const params: any[] = [workspaceId]

      if (actionType) {
        query += ` AND action_type = ?`
        params.push(actionType)
      }

      if (entityType) {
        query += ` AND entity_type = ?`
        params.push(entityType)
      }

      if (actorUserId) {
        query += ` AND actor_user_id = ?`
        params.push(actorUserId)
      }

      query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`
      params.push(limit, offset)

      const activities = await env.DB.prepare(query).bind(...params).all()

      // Get activity summary for the last 24 hours
      const summary = await env.DB.prepare(`
        SELECT
          COUNT(*) as total_activities,
          COUNT(DISTINCT actor_user_id) as active_users,
          SUM(CASE WHEN action_type = 'CREATED' THEN 1 ELSE 0 END) as creates,
          SUM(CASE WHEN action_type = 'UPDATED' THEN 1 ELSE 0 END) as updates,
          SUM(CASE WHEN action_type = 'COMMENTED' THEN 1 ELSE 0 END) as comments
        FROM activity_feed
        WHERE workspace_id = ?
          AND created_at >= datetime('now', '-24 hours')
      `).bind(workspaceId).first()

      return new Response(JSON.stringify({
        activities: activities.results || [],
        total: activities.results?.length || 0,
        summary: summary || {
          total_activities: 0,
          active_users: 0,
          creates: 0,
          updates: 0,
          comments: 0
        }
      }), { headers: CORS_HEADERS })
    }

    // POST /api/activity - Log activity (for system use)
    if (request.method === 'POST') {
      const body: any = await request.json()
      const {
        workspace_id,
        activity_type,
        entity_type,
        entity_id,
        entity_title,
        action_summary,
        user_name,
        metadata
      } = body

      if (!workspace_id || !activity_type || !entity_type || !action_summary) {
        return new Response(JSON.stringify({ error: 'Missing required fields' }), {
          status: 400,
          headers: CORS_HEADERS
        })
      }

      const activityId = `activity-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      const now = new Date().toISOString()

      await env.DB.prepare(`
        INSERT INTO activity_feed (
          id, workspace_id, user_hash, user_name, activity_type,
          entity_type, entity_id, entity_title, action_summary, metadata, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        activityId,
        workspace_id,
        userHash,
        user_name || null,
        activity_type,
        entity_type,
        entity_id || null,
        entity_title || null,
        action_summary,
        metadata ? JSON.stringify(metadata) : null,
        now
      ).run()

      // Update daily summary
      const today = now.split('T')[0]
      await env.DB.prepare(`
        INSERT INTO workspace_activity_summary (
          id, workspace_id, summary_date, total_activities
        )
        VALUES (?, ?, ?, 1)
        ON CONFLICT(workspace_id, summary_date) DO UPDATE SET
          total_activities = total_activities + 1
      `).bind(
        `summary-${workspace_id}-${today}`,
        workspace_id,
        today
      ).run()

      return new Response(JSON.stringify({
        message: 'Activity logged',
        activity_id: activityId
      }), { headers: CORS_HEADERS })
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: CORS_HEADERS
    })

  } catch (error: any) {
    if (error instanceof Response) return error
    console.error('[Activity API] Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: CORS_HEADERS
    })
  }
}
