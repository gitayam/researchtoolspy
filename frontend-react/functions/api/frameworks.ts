// Cloudflare Pages Function for Framework API
import { logActivity } from '../utils/activity-logger'

// Helper to get user ID from request (creates guest users automatically)
async function getUserFromRequest(request: Request, env: any): Promise<number | null> {
  // Try bearer token first (authenticated users)
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.substring(7)

  // Try session-based auth first (KV store)
  if (env.SESSIONS) {
    const sessionData = await env.SESSIONS.get(token)
    if (sessionData) {
      try {
        const session = JSON.parse(sessionData)
        if (session.user_id) {
          return Number(session.user_id)
        }
      } catch (err) {
        console.error('[Auth] Failed to parse session data:', err)
      }
    }
  }

  // Fallback to hash-based auth (16+ char tokens)
  if (token.length >= 16 && env.DB) {
    try {
      // Try to find existing user with this hash
      const existingUser = await env.DB.prepare(
        'SELECT id FROM users WHERE user_hash = ?'
      ).bind(token).first()

      if (existingUser) {
        return Number(existingUser.id)
      }

      // Create new guest user with hash
      const result = await env.DB.prepare(`
        INSERT INTO users (username, email, user_hash, full_name, hashed_password, created_at, is_active, is_verified, role)
        VALUES (?, ?, ?, ?, ?, ?, 1, 0, 'guest')
        RETURNING id
      `).bind(
        `guest_${token.substring(0, 8)}`,
        `${token.substring(0, 8)}@guest.local`,
        token,
        'Guest User',
        '',
        new Date().toISOString()
      ).first()

      if (result?.id) {
        console.log('[Auth] Created new guest user:', result.id)
        return Number(result.id)
      }
    } catch (err) {
      console.error('[Auth] Failed to create/retrieve hash-based user:', err)
    }
  }

  return null
}

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
        // Get authenticated user (supports both token and hash auth)
        const userId = await getUserFromRequest(request, env)

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

      // Get authenticated user (supports both token and hash auth)
      const userId = await getUserFromRequest(request, env)

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

      // Get authenticated user (supports both token and hash auth)
      // getUserFromRequest now handles guest user creation automatically
      let userId = await getUserFromRequest(request, env)

      // Default to user 1 if no auth provided (backward compatibility)
      if (!userId) {
        userId = 1
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
        userId,
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
