import { requireAuth } from './_shared/auth-helpers'

interface Env {
  DB: D1Database
  JWT_SECRET?: string
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash',
  'Content-Type': 'application/json',
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS })
  }

  try {
    const userId = await requireAuth(request, env)
    
    // Get user hash for notification lookups
    const userResult = await env.DB.prepare('SELECT user_hash FROM users WHERE id = ?').bind(userId).first()
    const userHash = userResult?.user_hash as string

    if (!userHash) {
      return new Response(JSON.stringify({ error: 'User hash not found' }), {
        status: 404,
        headers: CORS_HEADERS
      })
    }

    // GET /api/notifications - List user's notifications
    if (request.method === 'GET') {
      const url = new URL(request.url)
      const limit = parseInt(url.searchParams.get('limit') || '50')
      const offset = parseInt(url.searchParams.get('offset') || '0')
      const unreadOnly = url.searchParams.get('unread_only') === 'true'

      let query = `
        SELECT *
        FROM user_notifications
        WHERE user_hash = ?
      `
      const params: any[] = [userHash]

      if (unreadOnly) {
        query += ` AND is_read = FALSE`
      }

      query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`
      params.push(limit, offset)

      const notifications = await env.DB.prepare(query).bind(...params).all()

      // Get unread count
      const unreadCount = await env.DB.prepare(`
        SELECT COUNT(*) as count
        FROM user_notifications
        WHERE user_hash = ? AND is_read = FALSE
      `).bind(userHash).first()

      return new Response(JSON.stringify({
        notifications: notifications.results || [],
        total: notifications.meta?.total_count || 0,
        unread_count: unreadCount?.count || 0
      }), { headers: CORS_HEADERS })
    }

    // POST /api/notifications - Create notification (for system use or testing)
    if (request.method === 'POST') {
      const body: any = await request.json()
      const {
        target_user_hash,
        workspace_id,
        notification_type,
        title,
        message,
        action_url,
        entity_type,
        entity_id,
        actor_name
      } = body

      if (!target_user_hash || !notification_type || !title || !message) {
        return new Response(JSON.stringify({ error: 'Missing required fields' }), {
          status: 400,
          headers: CORS_HEADERS
        })
      }

      const notificationId = `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      const now = new Date().toISOString()

      await env.DB.prepare(`
        INSERT INTO user_notifications (
          id, user_hash, workspace_id, notification_type, title, message,
          action_url, entity_type, entity_id, actor_hash, actor_name, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        notificationId,
        target_user_hash,
        workspace_id || null,
        notification_type,
        title,
        message,
        action_url || null,
        entity_type || null,
        entity_id || null,
        userHash,
        actor_name || null,
        now
      ).run()

      return new Response(JSON.stringify({
        message: 'Notification created',
        notification_id: notificationId
      }), { headers: CORS_HEADERS })
    }

    // PATCH /api/notifications - Mark as read/unread
    if (request.method === 'PATCH') {
      const body: any = await request.json()
      const { notification_ids, is_read, mark_all_read } = body

      if (mark_all_read) {
        // Mark all user's notifications as read
        await env.DB.prepare(`
          UPDATE user_notifications
          SET is_read = TRUE, read_at = ?
          WHERE user_hash = ? AND is_read = FALSE
        `).bind(new Date().toISOString(), userHash).run()

        return new Response(JSON.stringify({
          message: 'All notifications marked as read'
        }), { headers: CORS_HEADERS })
      }

      if (!notification_ids || !Array.isArray(notification_ids)) {
        return new Response(JSON.stringify({ error: 'notification_ids array required' }), {
          status: 400,
          headers: CORS_HEADERS
        })
      }

      const placeholders = notification_ids.map(() => '?').join(',')
      const now = is_read ? new Date().toISOString() : null

      await env.DB.prepare(`
        UPDATE user_notifications
        SET is_read = ?, read_at = ?
        WHERE id IN (${placeholders}) AND user_hash = ?
      `).bind(is_read === false ? 0 : 1, now, ...notification_ids, userHash).run()

      return new Response(JSON.stringify({
        message: `${notification_ids.length} notifications updated`
      }), { headers: CORS_HEADERS })
    }

    // DELETE /api/notifications - Delete notifications
    if (request.method === 'DELETE') {
      const url = new URL(request.url)
      const notificationIds = url.searchParams.get('ids')?.split(',')
      const deleteAll = url.searchParams.get('delete_all') === 'true'

      if (deleteAll) {
        // Delete all user's read notifications
        await env.DB.prepare(`
          DELETE FROM user_notifications
          WHERE user_hash = ? AND is_read = TRUE
        `).bind(userHash).run()

        return new Response(JSON.stringify({
          message: 'All read notifications deleted'
        }), { headers: CORS_HEADERS })
      }

      if (!notificationIds || notificationIds.length === 0) {
        return new Response(JSON.stringify({ error: 'notification ids required' }), {
          status: 400,
          headers: CORS_HEADERS
        })
      }

      const placeholders = notificationIds.map(() => '?').join(',')
      await env.DB.prepare(`
        DELETE FROM user_notifications
        WHERE id IN (${placeholders}) AND user_hash = ?
      `).bind(...notificationIds, userHash).run()

      return new Response(JSON.stringify({
        message: `${notificationIds.length} notifications deleted`
      }), { headers: CORS_HEADERS })
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: CORS_HEADERS
    })

  } catch (error: any) {
    if (error instanceof Response) return error
    console.error('[Notifications API] Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: CORS_HEADERS
    })
  }
}
