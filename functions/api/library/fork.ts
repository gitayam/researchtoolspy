// ============================================================================
// Library Fork API - Clone frameworks to user workspace
// ============================================================================

interface Env {
  DB: D1Database
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash',
  'Content-Type': 'application/json',
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS })
  }

  try {
    const userHash = request.headers.get('X-User-Hash') || 'guest'
    const workspaceId = request.headers.get('X-Workspace-Id') || '1'

    if (userHash === 'guest') {
      return new Response(JSON.stringify({ error: 'Authentication required to fork' }), {
        status: 401,
        headers: CORS_HEADERS
      })
    }

    if (request.method === 'POST') {
      const body: any = await request.json()
      const { library_framework_id } = body

      if (!library_framework_id) {
        return new Response(JSON.stringify({ error: 'Missing library_framework_id' }), {
          status: 400,
          headers: CORS_HEADERS
        })
      }

      // Get library framework details
      const libraryFramework: any = await env.DB.prepare(`
        SELECT lf.*, fs.data as framework_data
        FROM library_frameworks lf
        JOIN framework_sessions fs ON lf.framework_id = fs.id
        WHERE lf.id = ? AND lf.is_published = 1
      `).bind(library_framework_id).first()

      if (!libraryFramework) {
        return new Response(JSON.stringify({ error: 'Framework not found' }), {
          status: 404,
          headers: CORS_HEADERS
        })
      }

      // Create new framework in user's workspace
      const newFrameworkId = `framework-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      const now = new Date().toISOString()

      // Parse and modify framework data
      let frameworkData: any = {}
      try {
        frameworkData = JSON.parse(libraryFramework.framework_data || '{}')
        frameworkData.title = `${frameworkData.title || libraryFramework.title} (Fork)`
        frameworkData.description = `Forked from: ${libraryFramework.title}\n\n${frameworkData.description || libraryFramework.description || ''}`
      } catch (e) {
        frameworkData = {
          title: `${libraryFramework.title} (Fork)`,
          description: `Forked from: ${libraryFramework.title}\n\n${libraryFramework.description || ''}`
        }
      }

      // Insert forked framework
      await env.DB.prepare(`
        INSERT INTO framework_sessions (
          id, type, title, description, data, user_id, workspace_id,
          original_workspace_id, fork_parent_id, status,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)
      `).bind(
        newFrameworkId,
        libraryFramework.framework_type,
        frameworkData.title,
        frameworkData.description || '',
        JSON.stringify(frameworkData),
        userHash,
        workspaceId,
        workspaceId,
        libraryFramework.framework_id, // Original framework ID
        now,
        now
      ).run()

      // Record fork in library_forks
      const forkId = `fork-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      await env.DB.prepare(`
        INSERT INTO library_forks (
          id, parent_library_framework_id, forked_framework_id,
          forked_framework_type, forked_by_user_hash, forked_to_workspace_id, forked_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        forkId,
        library_framework_id,
        newFrameworkId,
        libraryFramework.framework_type,
        userHash,
        workspaceId,
        now
      ).run()

      // Update fork count (trigger will handle this, but we can also do it manually)
      await env.DB.prepare(
        'UPDATE library_frameworks SET fork_count = fork_count + 1 WHERE id = ?'
      ).bind(library_framework_id).run()

      return new Response(JSON.stringify({
        forked_framework_id: newFrameworkId,
        message: 'Framework forked successfully'
      }), { headers: CORS_HEADERS })
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: CORS_HEADERS
    })

  } catch (error: any) {
    console.error('[Library Fork API] Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: CORS_HEADERS
    })
  }
}
