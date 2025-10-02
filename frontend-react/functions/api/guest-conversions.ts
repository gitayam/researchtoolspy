// Cloudflare Pages Function for Guest Conversion API
export async function onRequest(context: any) {
  const { request, env } = context

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
  }

  // Handle preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  try {
    // POST - Convert guest session to authenticated user
    if (request.method === 'POST') {
      const body = await request.json()

      if (!body.guest_session_id || !body.user_id) {
        return new Response(JSON.stringify({
          error: 'guest_session_id and user_id are required'
        }), {
          status: 400,
          headers: corsHeaders,
        })
      }

      // Record the conversion
      const result = await env.DB.prepare(`
        INSERT INTO guest_conversions (
          guest_session_id,
          user_id,
          framework_count,
          converted_at
        ) VALUES (?, ?, ?, datetime('now'))
      `).bind(
        body.guest_session_id,
        body.user_id,
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
        headers: corsHeaders,
      })
    }

    // GET - Get conversion statistics
    if (request.method === 'GET') {
      const stats = await env.DB.prepare(`
        SELECT
          COUNT(*) as total_conversions,
          SUM(framework_count) as total_frameworks_converted,
          AVG(framework_count) as avg_frameworks_per_conversion
        FROM guest_conversions
      `).first()

      return new Response(JSON.stringify({ stats }), {
        status: 200,
        headers: corsHeaders,
      })
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: corsHeaders,
    })

  } catch (error: any) {
    console.error('Guest conversion API error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: corsHeaders,
    })
  }
}
