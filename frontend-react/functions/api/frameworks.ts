// Cloudflare Pages Function for Framework API
export async function onRequest(context: any) {
  const { request, env } = context

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
  }

  // Handle preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  try {
    const url = new URL(request.url)
    const frameworkId = url.searchParams.get('id')

    // GET - List frameworks or get single framework
    if (request.method === 'GET') {
      if (frameworkId) {
        // Get single framework from D1
        const framework = await env.DB.prepare(
          'SELECT * FROM framework_sessions WHERE id = ?'
        ).bind(frameworkId).first()

        if (!framework) {
          return new Response(JSON.stringify({ error: 'Framework not found' }), {
            status: 404,
            headers: corsHeaders,
          })
        }

        return new Response(JSON.stringify(framework), {
          status: 200,
          headers: corsHeaders,
        })
      }

      // List all frameworks with optional public filter
      const publicOnly = url.searchParams.get('public') === 'true'

      let query = 'SELECT * FROM framework_sessions WHERE 1=1'

      if (publicOnly) {
        query += ' AND is_public = 1'
      }

      query += ' ORDER BY created_at DESC LIMIT 50'

      const frameworks = await env.DB.prepare(query).all()

      return new Response(JSON.stringify({ frameworks: frameworks.results }), {
        status: 200,
        headers: corsHeaders,
      })
    }

    // POST - Create new framework
    if (request.method === 'POST') {
      const body = await request.json()

      const result = await env.DB.prepare(
        `INSERT INTO framework_sessions (user_id, title, description, framework_type, data, status, is_public, shared_publicly_at, source_url)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        body.user_id || 1,
        body.title,
        body.description || '',
        body.framework_type,
        JSON.stringify(body.data || {}),
        body.status || 'draft',
        body.is_public ? 1 : 0,
        body.is_public ? new Date().toISOString() : null,
        body.data?.source_url || null
      ).run()

      return new Response(JSON.stringify({ 
        id: result.meta.last_row_id,
        message: 'Framework created successfully' 
      }), {
        status: 201,
        headers: corsHeaders,
      })
    }

    // PUT - Update framework
    if (request.method === 'PUT') {
      const body = await request.json()

      await env.DB.prepare(
        `UPDATE framework_sessions
         SET title = ?, description = ?, data = ?, status = ?, updated_at = datetime('now'),
             is_public = ?, shared_publicly_at = ?, source_url = ?
         WHERE id = ?`
      ).bind(
        body.title,
        body.description,
        JSON.stringify(body.data),
        body.status,
        body.is_public ? 1 : 0,
        body.is_public ? new Date().toISOString() : null,
        body.data?.source_url || null,
        frameworkId
      ).run()

      return new Response(JSON.stringify({ message: 'Framework updated successfully' }), {
        status: 200,
        headers: corsHeaders,
      })
    }

    // DELETE - Delete framework
    if (request.method === 'DELETE') {
      await env.DB.prepare(
        'DELETE FROM framework_sessions WHERE id = ?'
      ).bind(frameworkId).run()

      return new Response(JSON.stringify({ message: 'Framework deleted successfully' }), {
        status: 200,
        headers: corsHeaders,
      })
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: corsHeaders,
    })

  } catch (error: any) {
    console.error('Framework API error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to create',
      message: error.message,
      details: error.stack
    }), {
      status: 500,
      headers: corsHeaders,
    })
  }
}
