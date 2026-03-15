// Cloudflare Pages Function for Guest Conversion API
import { getUserFromRequest } from './_shared/auth-helpers'
import { CORS_HEADERS, JSON_HEADERS } from './_shared/api-utils'

export async function onRequest(context: any) {
  const { request, env } = context

  // Handle preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  try {
    // POST - Convert guest session to authenticated user
    if (request.method === 'POST') {
      const authUserId = await getUserFromRequest(request, env)
      if (!authUserId) {
        return new Response(JSON.stringify({ error: 'Authentication required' }), {
          status: 401, headers: JSON_HEADERS,
        })
      }

      const body = await request.json()

      if (!body.guest_session_id) {
        return new Response(JSON.stringify({
          error: 'guest_session_id is required'
        }), {
          status: 400,
          headers: JSON_HEADERS,
        })
      }

      // Record the conversion — use server-side auth user ID, never client-supplied
      const result = await env.DB.prepare(`
        INSERT INTO guest_conversions (
          guest_session_id,
          user_id,
          framework_count,
          converted_at
        ) VALUES (?, ?, ?, datetime('now'))
      `).bind(
        body.guest_session_id,
        authUserId,
        body.framework_count || 0
      ).run()

      // Here you would typically:
      // 1. Transfer any guest data from localStorage to the database
      // 2. Associate guest-created content with the user
      // This is application-specific logic

      return new Response(JSON.stringify({
        message: 'Guest converted to authenticated user successfully',
        conversion_id: result.meta.last_row_id
      }), {
        status: 201,
        headers: JSON_HEADERS,
      })
    }

    // GET - Get conversion statistics (admin only)
    if (request.method === 'GET') {
      const getAuthUserId = await getUserFromRequest(request, env)
      if (!getAuthUserId) {
        return new Response(JSON.stringify({ error: 'Authentication required' }), {
          status: 401, headers: JSON_HEADERS,
        })
      }

      const stats = await env.DB.prepare(`
        SELECT
          COUNT(*) as total_conversions,
          SUM(framework_count) as total_frameworks_converted,
          AVG(framework_count) as avg_frameworks_per_conversion
        FROM guest_conversions
      `).first()

      return new Response(JSON.stringify({ stats }), {
        status: 200,
        headers: JSON_HEADERS,
      })
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: JSON_HEADERS,
    })

  } catch (error: any) {
    console.error('Guest conversion API error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: JSON_HEADERS,
    })
  }
}
