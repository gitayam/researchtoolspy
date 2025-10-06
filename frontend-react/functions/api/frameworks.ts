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

        // Parse the data field (stored as JSON string) back into an object
        if (framework.data && typeof framework.data === 'string') {
          try {
            framework.data = JSON.parse(framework.data)
          } catch (e) {
            console.error('Failed to parse framework data:', e)
          }
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

      // Parse the data field for each framework
      const parsedFrameworks = (frameworks.results || []).map((framework: any) => {
        if (framework.data && typeof framework.data === 'string') {
          try {
            framework.data = JSON.parse(framework.data)
          } catch (e) {
            console.error('Failed to parse framework data:', e)
          }
        }
        return framework
      })

      return new Response(JSON.stringify({ frameworks: parsedFrameworks }), {
        status: 200,
        headers: corsHeaders,
      })
    }

    // POST - Create new framework
    if (request.method === 'POST') {
      const body = await request.json()

      // Validate required fields
      if (!body.title) {
        return new Response(JSON.stringify({ error: 'Title is required' }), {
          status: 400,
          headers: corsHeaders,
        })
      }

      if (!body.framework_type) {
        return new Response(JSON.stringify({ error: 'Framework type is required' }), {
          status: 400,
          headers: corsHeaders,
        })
      }

      // Validate and sanitize data field
      let dataJson
      try {
        dataJson = JSON.stringify(body.data || {})
      } catch (jsonError) {
        console.error('JSON stringify error:', jsonError)
        return new Response(JSON.stringify({
          error: 'Invalid data format',
          message: jsonError instanceof Error ? jsonError.message : 'Could not serialize data'
        }), {
          status: 400,
          headers: corsHeaders,
        })
      }

      const result = await env.DB.prepare(
        `INSERT INTO framework_sessions (user_id, title, description, framework_type, data, status, is_public, shared_publicly_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        body.user_id || 1,
        body.title,
        body.description || '',
        body.framework_type,
        dataJson,
        body.status || 'draft',
        body.is_public ? 1 : 0,
        body.is_public ? new Date().toISOString() : null
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
             is_public = ?, shared_publicly_at = ?
         WHERE id = ?`
      ).bind(
        body.title,
        body.description,
        JSON.stringify(body.data),
        body.status,
        body.is_public ? 1 : 0,
        body.is_public ? new Date().toISOString() : null,
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
    console.error('Error stack:', error.stack)
    console.error('Error details:', {
      message: error.message,
      cause: error.cause,
      name: error.name
    })

    return new Response(JSON.stringify({
      error: 'Framework operation failed',
      message: error.message || 'Unknown error occurred',
      details: error.stack,
      operation: request.method
    }), {
      status: 500,
      headers: corsHeaders,
    })
  }
}
