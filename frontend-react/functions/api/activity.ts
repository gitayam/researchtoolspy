// ============================================================================
// Activity Feed API - Workspace activity tracking
// ============================================================================

interface Env {
  DB: D1Database
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
    const userHash = request.headers.get('X-User-Hash') || 'guest'
    const workspaceId = request.headers.get('X-Workspace-ID')

    // GET /api/activity - List workspace activity
    if (request.method === 'GET') {
      const url = new URL(request.url)
      const limit = parseInt(url.searchParams.get('limit') || '50')
      const offset = parseInt(url.searchParams.get('offset') || '0')
      const activityType = url.searchParams.get('type')
      const entityType = url.searchParams.get('entity_type')
      const userId = url.searchParams.get('user_hash')

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

      if (activityType) {
        query += ` AND activity_type = ?`
        params.push(activityType)
      }

      if (entityType) {
        query += ` AND entity_type = ?`
        params.push(entityType)
      }

      if (userId) {
        query += ` AND user_hash = ?`
        params.push(userId)
      }

      query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`
      params.push(limit, offset)

      const activities = await env.DB.prepare(query).bind(...params).all()

      // Get activity summary for the last 24 hours
      const summary = await env.DB.prepare(`
        SELECT
          COUNT(*) as total_activities,
          COUNT(DISTINCT user_hash) as active_users,
          SUM(CASE WHEN activity_type = 'create' THEN 1 ELSE 0 END) as creates,
          SUM(CASE WHEN activity_type = 'update' THEN 1 ELSE 0 END) as updates,
          SUM(CASE WHEN activity_type = 'comment' THEN 1 ELSE 0 END) as comments
        FROM activity_feed
        WHERE workspace_id = ?
          AND created_at >= datetime('now', '-24 hours')
      `).bind(workspaceId).first()

      return new Response(JSON.stringify({
        activities: activities.results || [],
        total: activities.meta?.total_count || 0,
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
    console.error('[Activity API] Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: CORS_HEADERS
    })
  }
}
