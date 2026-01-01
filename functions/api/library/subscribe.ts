// ============================================================================
// Library Subscribe API - Subscribe to framework updates
// ============================================================================

import { requireAuth } from '../_shared/auth-helpers'

interface Env {
  DB: D1Database
  JWT_SECRET?: string
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
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
    
    // Get user hash for legacy columns
    const userResult = await env.DB.prepare('SELECT user_hash FROM users WHERE id = ?').bind(userId).first()
    const userHash = userResult?.user_hash as string

    if (!userHash) {
      return new Response(JSON.stringify({ error: 'User hash not found' }), {
        status: 404,
        headers: CORS_HEADERS
      })
    }

    if (request.method === 'POST') {
      const body: any = await request.json()
      const { library_framework_id, notify_on_update = true, notify_on_comment = true } = body

      if (!library_framework_id) {
        return new Response(JSON.stringify({ error: 'Missing library_framework_id' }), {
          status: 400,
          headers: CORS_HEADERS
        })
      }

      // Check if framework exists
      const framework = await env.DB.prepare(
        'SELECT id FROM library_frameworks WHERE id = ? AND is_published = 1'
      ).bind(library_framework_id).first()

      if (!framework) {
        return new Response(JSON.stringify({ error: 'Framework not found' }), {
          status: 404,
          headers: CORS_HEADERS
        })
      }

      // Check for existing subscription
      const existing = await env.DB.prepare(
        'SELECT id FROM library_subscriptions WHERE library_framework_id = ? AND user_hash = ?'
      ).bind(library_framework_id, userHash).first()

      if (existing) {
        // Update preferences
        await env.DB.prepare(`
          UPDATE library_subscriptions
          SET notify_on_update = ?, notify_on_comment = ?
          WHERE id = ?
        `).bind(notify_on_update ? 1 : 0, notify_on_comment ? 1 : 0, existing.id).run()

        return new Response(JSON.stringify({
          action: 'updated',
          message: 'Subscription preferences updated'
        }), { headers: CORS_HEADERS })
      } else {
        // New subscription
        const subscriptionId = `sub-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        await env.DB.prepare(`
          INSERT INTO library_subscriptions (
            id, library_framework_id, user_hash,
            notify_on_update, notify_on_comment, subscribed_at
          ) VALUES (?, ?, ?, ?, ?, ?)
        `).bind(
          subscriptionId,
          library_framework_id,
          userHash,
          notify_on_update ? 1 : 0,
          notify_on_comment ? 1 : 0,
          new Date().toISOString()
        ).run()

        return new Response(JSON.stringify({
          action: 'subscribed',
          message: 'Subscribed successfully'
        }), { headers: CORS_HEADERS })
      }
    }

    // DELETE: Unsubscribe
    if (request.method === 'DELETE') {
      const url = new URL(request.url)
      const libraryFrameworkId = url.searchParams.get('library_framework_id')

      if (!libraryFrameworkId) {
        return new Response(JSON.stringify({ error: 'Missing library_framework_id' }), {
          status: 400,
          headers: CORS_HEADERS
        })
      }

      await env.DB.prepare(
        'DELETE FROM library_subscriptions WHERE library_framework_id = ? AND user_hash = ?'
      ).bind(libraryFrameworkId, userHash).run()

      return new Response(JSON.stringify({
        action: 'unsubscribed',
        message: 'Unsubscribed successfully'
      }), { headers: CORS_HEADERS })
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: CORS_HEADERS
    })

  } catch (error: any) {
    if (error instanceof Response) return error
    console.error('[Library Subscribe API] Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: CORS_HEADERS
    })
  }
}
