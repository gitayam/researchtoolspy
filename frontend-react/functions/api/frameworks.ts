// Cloudflare Pages Function for Framework API
import { logActivity } from '../utils/activity-logger'

export async function onRequest(context: any) {
  const { request, env } = context

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash',
    'Content-Type': 'application/json',
  }

  // Handle preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  try {
    const url = new URL(request.url)
    const frameworkId = url.searchParams.get('id')

    // Get workspace_id from query params or default to '1'
    const workspaceId = url.searchParams.get('workspace_id') || '1'

    // GET - List frameworks or get single framework
    if (request.method === 'GET') {
      if (frameworkId) {
        // Get user_id from auth (for now, default to user 1)
        // TODO: Implement proper authentication
        const userId = 1 // Placeholder - should come from auth

        // Get single framework from D1 - WORKSPACE ISOLATION
        const framework = await env.DB.prepare(
          'SELECT * FROM framework_sessions WHERE id = ? AND (workspace_id = ? OR is_public = 1)'
        ).bind(frameworkId, workspaceId).first()

        if (!framework) {
          return new Response(JSON.stringify({ error: 'Framework not found' }), {
            status: 404,
            headers: corsHeaders,
          })
        }

        // CRITICAL FIX: Verify user owns this framework OR it's public
        if (framework.user_id !== userId && !framework.is_public) {
          return new Response(JSON.stringify({ error: 'Unauthorized access to private framework' }), {
            status: 403,
            headers: corsHeaders,
          })
        }

        // Parse the data field (stored as JSON string) back into an object
        if (framework.data && typeof framework.data === 'string') {
          try {
            framework.data = JSON.parse(framework.data)
          } catch (e) {
            console.error('Failed to parse framework data for ID:', frameworkId, e)
            console.error('Corrupted data value:', framework.data)
            // Return empty object if data is corrupted
            framework.data = {}
          }
        }

        return new Response(JSON.stringify(framework), {
          status: 200,
          headers: corsHeaders,
        })
      }

      // List all frameworks with optional public filter
      const publicOnly = url.searchParams.get('public') === 'true'

      // Get user_id from auth header or cookie (for now, default to user 1 for logged-in users)
      // TODO: Implement proper authentication
      const userId = 1 // Placeholder - should come from auth

      let query = 'SELECT * FROM framework_sessions WHERE 1=1'

      if (publicOnly) {
        // Only return public frameworks (from any workspace)
        query += ' AND is_public = 1'
      } else {
        // WORKSPACE ISOLATION: Only return frameworks in this workspace OR public frameworks
        query += ` AND (workspace_id = ? OR is_public = 1)`
      }

      query += ' ORDER BY created_at DESC LIMIT 50'

      const frameworks = publicOnly
        ? await env.DB.prepare(query).all()
        : await env.DB.prepare(query).bind(workspaceId).all()

      // Parse the data field for each framework
      const parsedFrameworks = (frameworks.results || []).map((framework: any) => {
        if (framework.data && typeof framework.data === 'string') {
          try {
            framework.data = JSON.parse(framework.data)
          } catch (e) {
            console.error('Failed to parse framework data for ID:', framework.id, e)
            console.error('Corrupted data value:', framework.data)
            // Return empty object if data is corrupted
            framework.data = {}
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
        `INSERT INTO framework_sessions (user_id, title, description, framework_type, data, status, is_public, shared_publicly_at, workspace_id, original_workspace_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        body.user_id || 1,
        body.title,
        body.description || '',
        body.framework_type,
        dataJson,
        body.status || 'draft',
        body.is_public ? 1 : 0,
        body.is_public ? new Date().toISOString() : null,
        body.workspace_id || workspaceId,
        body.workspace_id || workspaceId  // original_workspace_id same as workspace_id on creation
      ).run()

      const frameworkId = result.meta.last_row_id.toString()
      const userHash = request.headers.get('X-User-Hash') || 'system'

      // Log activity
      await logActivity(env.DB, {
        workspace_id: body.workspace_id || workspaceId,
        user_hash: userHash,
        activity_type: 'create',
        entity_type: 'framework',
        entity_id: frameworkId,
        entity_title: body.title,
        action_summary: `created ${body.framework_type.toUpperCase()} framework "${body.title}"`,
        metadata: { framework_type: body.framework_type }
      })

      return new Response(JSON.stringify({
        id: frameworkId,
        message: 'Framework created successfully'
      }), {
        status: 201,
        headers: corsHeaders,
      })
    }

    // PUT - Update framework
    if (request.method === 'PUT') {
      const body = await request.json()

      // WORKSPACE ISOLATION: Only allow updating frameworks in current workspace
      const result = await env.DB.prepare(
        `UPDATE framework_sessions
         SET title = ?, description = ?, data = ?, status = ?, updated_at = datetime('now'),
             is_public = ?, shared_publicly_at = ?
         WHERE id = ? AND workspace_id = ?`
      ).bind(
        body.title,
        body.description,
        JSON.stringify(body.data),
        body.status,
        body.is_public ? 1 : 0,
        body.is_public ? new Date().toISOString() : null,
        frameworkId,
        workspaceId
      ).run()

      if (result.meta.changes === 0) {
        return new Response(JSON.stringify({ error: 'Framework not found in workspace or unauthorized' }), {
          status: 404,
          headers: corsHeaders,
        })
      }

      const userHash = request.headers.get('X-User-Hash') || 'system'

      // Log activity
      await logActivity(env.DB, {
        workspace_id: workspaceId,
        user_hash: userHash,
        activity_type: 'update',
        entity_type: 'framework',
        entity_id: frameworkId,
        entity_title: body.title,
        action_summary: `updated framework "${body.title}"`,
        metadata: { status: body.status, is_public: body.is_public }
      })

      return new Response(JSON.stringify({ message: 'Framework updated successfully' }), {
        status: 200,
        headers: corsHeaders,
      })
    }

    // DELETE - Delete framework
    if (request.method === 'DELETE') {
      // Get framework details before deleting for activity log
      const framework = await env.DB.prepare(
        'SELECT title, framework_type FROM framework_sessions WHERE id = ? AND workspace_id = ?'
      ).bind(frameworkId, workspaceId).first()

      if (!framework) {
        return new Response(JSON.stringify({ error: 'Framework not found in workspace or unauthorized' }), {
          status: 404,
          headers: corsHeaders,
        })
      }

      // WORKSPACE ISOLATION: Only allow deleting frameworks in current workspace
      const result = await env.DB.prepare(
        'DELETE FROM framework_sessions WHERE id = ? AND workspace_id = ?'
      ).bind(frameworkId, workspaceId).run()

      if (result.meta.changes === 0) {
        return new Response(JSON.stringify({ error: 'Framework not found in workspace or unauthorized' }), {
          status: 404,
          headers: corsHeaders,
        })
      }

      const userHash = request.headers.get('X-User-Hash') || 'system'

      // Log activity
      await logActivity(env.DB, {
        workspace_id: workspaceId,
        user_hash: userHash,
        activity_type: 'delete',
        entity_type: 'framework',
        entity_id: frameworkId,
        entity_title: framework.title as string,
        action_summary: `deleted framework "${framework.title}"`,
        metadata: { framework_type: framework.framework_type }
      })

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
