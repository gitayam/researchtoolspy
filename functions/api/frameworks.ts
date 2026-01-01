// Cloudflare Pages Function for Framework API
import { logActivity } from '../utils/activity-logger'
import { getUserFromRequest } from './_shared/auth-helpers'

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
    // Check if DB binding is available
    if (!env.DB) {
      console.error('[Frameworks] DB binding not available')
      return new Response(JSON.stringify({
        error: 'Database not configured',
        details: 'DB binding is not available. Please configure D1 database in Cloudflare Pages settings.'
      }), {
        status: 500,
        headers: corsHeaders,
      })
    }

    const url = new URL(request.url)
    const frameworkId = url.searchParams.get('id')

    // Get workspace_id from query params or default to '1'
    const workspaceId = url.searchParams.get('workspace_id') || '1'

    // Get authenticated user ID
    const userId = await getUserFromRequest(request, env)
    
    // Get user hash for logging if authenticated
    let userHash = 'guest'
    if (userId) {
      const user = await env.DB.prepare('SELECT user_hash FROM users WHERE id = ?').bind(userId).first()
      if (user?.user_hash) userHash = user.user_hash as string
    }

    // GET - List frameworks or get single framework
    if (request.method === 'GET') {
      if (frameworkId) {
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
        // Allow access if: user owns it, it's public, or user is not authenticated (guest viewing public)
        if (userId && framework.user_id !== userId && !framework.is_public) {
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

      // Default to user 1 if no auth provided (backward compatibility)
      const effectiveUserId = userId || 1

      // Validate and sanitize data field
      let dataJson
      try {
        dataJson = JSON.stringify(body.data || {})
      } catch (jsonError) {
        return new Response(JSON.stringify({
          error: 'Invalid data format'
        }), {
          status: 400,
          headers: corsHeaders,
        })
      }

      const result = await env.DB.prepare(
        `INSERT INTO framework_sessions (user_id, title, description, framework_type, data, status, is_public, shared_publicly_at, workspace_id, original_workspace_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        effectiveUserId,
        body.title,
        body.description || '',
        body.framework_type,
        dataJson,
        body.status || 'draft',
        body.is_public ? 1 : 0,
        body.is_public ? new Date().toISOString() : null,
        body.workspace_id || workspaceId,
        body.workspace_id || workspaceId
      ).run()

      const createdFrameworkId = result.meta.last_row_id.toString()

      // Log activity
      await logActivity(env.DB, {
        workspace_id: body.workspace_id || workspaceId,
        user_hash: userHash,
        activity_type: 'create',
        entity_type: 'framework',
        entity_id: createdFrameworkId,
        entity_title: body.title,
        action_summary: `created ${body.framework_type.toUpperCase()} framework "${body.title}"`,
        metadata: { framework_type: body.framework_type }
      })

      return new Response(JSON.stringify({
        id: createdFrameworkId,
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

      // Log activity
      await logActivity(env.DB, {
        workspace_id: workspaceId,
        user_hash: userHash,
        activity_type: 'update',
        entity_type: 'framework',
        entity_id: frameworkId!,
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

      // Log activity
      await logActivity(env.DB, {
        workspace_id: workspaceId,
        user_hash: userHash,
        activity_type: 'delete',
        entity_type: 'framework',
        entity_id: frameworkId!,
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
    return new Response(JSON.stringify({
      error: 'Framework operation failed',
      message: error.message || 'Unknown error occurred'
    }), {
      status: 500,
      headers: corsHeaders,
    })
  }
}
