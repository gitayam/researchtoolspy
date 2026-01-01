// ============================================================================
// Library Framework Detail API - Get individual framework details
// ============================================================================

import { getUserFromRequest, requireAuth } from '../_shared/auth-helpers'

interface Env {
  DB: D1Database
  JWT_SECRET?: string
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash',
  'Content-Type': 'application/json',
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS })
  }

  try {
    const libraryFrameworkId = params.id as string
    const userId = await getUserFromRequest(request, env)
    
    // Get user hash for legacy columns
    let userHash = 'guest'
    if (userId) {
      const userResult = await env.DB.prepare('SELECT user_hash FROM users WHERE id = ?').bind(userId).first()
      if (userResult?.user_hash) userHash = userResult.user_hash as string
    }

    if (request.method === 'GET') {
      // Get framework details with all metadata
      const framework: any = await env.DB.prepare(`
        SELECT
          lf.*,
          fs.data as framework_data,
          (SELECT vote_type FROM library_votes WHERE library_framework_id = lf.id AND user_hash = ?) as user_vote,
          (SELECT rating FROM library_ratings WHERE library_framework_id = lf.id AND user_hash = ?) as user_rating,
          (SELECT COUNT(*) FROM library_subscriptions WHERE library_framework_id = lf.id AND user_hash = ?) as user_subscribed
        FROM library_frameworks lf
        LEFT JOIN framework_sessions fs ON lf.framework_id = fs.id
        WHERE lf.id = ? AND lf.is_published = 1
      `).bind(userHash, userHash, userHash, libraryFrameworkId).first()

      if (!framework) {
        return new Response(JSON.stringify({ error: 'Framework not found' }), {
          status: 404,
          headers: CORS_HEADERS
        })
      }

      // Record view (if not owner)
      if (userHash !== framework.published_by) {
        const viewId = `view-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        await env.DB.prepare(`
          INSERT INTO library_views (id, library_framework_id, user_hash, viewed_at)
          VALUES (?, ?, ?, ?)
        `).bind(viewId, libraryFrameworkId, userHash, new Date().toISOString()).run()

        // Update view count
        await env.DB.prepare(
          'UPDATE library_frameworks SET view_count = view_count + 1 WHERE id = ?'
        ).bind(libraryFrameworkId).run()
      }

      // Parse framework data
      let parsedData: any = {}
      try {
        parsedData = JSON.parse(framework.framework_data || '{}')
      } catch (e) {
        console.error('[Library Detail] Failed to parse framework data:', e)
      }

      return new Response(JSON.stringify({
        ...framework,
        framework_data: parsedData
      }), { headers: CORS_HEADERS })
    }

    // PUT: Update framework (only owner)
    if (request.method === 'PUT') {
      const authUserId = await requireAuth(request, env)
      
      // Check ownership
      const framework: any = await env.DB.prepare(
        'SELECT published_by FROM library_frameworks WHERE id = ?'
      ).bind(libraryFrameworkId).first()

      if (!framework || framework.published_by !== userHash) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 403,
          headers: CORS_HEADERS
        })
      }

      const body: any = await request.json()
      const { title, description, tags, category } = body

      const updates: string[] = []
      const bindings: any[] = []

      if (title) {
        updates.push('title = ?')
        bindings.push(title)
      }
      if (description !== undefined) {
        updates.push('description = ?')
        bindings.push(description)
      }
      if (tags !== undefined) {
        updates.push('tags = ?')
        bindings.push(tags)
      }
      if (category !== undefined) {
        updates.push('category = ?')
        bindings.push(category)
      }

      if (updates.length === 0) {
        return new Response(JSON.stringify({ error: 'No fields to update' }), {
          status: 400,
          headers: CORS_HEADERS
        })
      }

      updates.push('last_updated = ?')
      updates.push('version = version + 1')
      bindings.push(new Date().toISOString())
      bindings.push(libraryFrameworkId)

      await env.DB.prepare(`
        UPDATE library_frameworks SET ${updates.join(', ')} WHERE id = ?
      `).bind(...bindings).run()

      return new Response(JSON.stringify({
        message: 'Framework updated successfully'
      }), { headers: CORS_HEADERS })
    }

    // DELETE: Unpublish framework (only owner)
    if (request.method === 'DELETE') {
      const authUserId = await requireAuth(request, env)

      // Check ownership
      const framework: any = await env.DB.prepare(
        'SELECT published_by, framework_id FROM library_frameworks WHERE id = ?'
      ).bind(libraryFrameworkId).first()

      if (!framework || framework.published_by !== userHash) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 403,
          headers: CORS_HEADERS
        })
      }

      // Soft delete - mark as unpublished
      const now = new Date().toISOString()
      await env.DB.prepare(
        'UPDATE library_frameworks SET is_published = 0, unpublished_at = ? WHERE id = ?'
      ).bind(now, libraryFrameworkId).run()

      // Update original framework
      await env.DB.prepare(
        'UPDATE framework_sessions SET published_to_library = 0 WHERE id = ?'
      ).bind(framework.framework_id).run()

      return new Response(JSON.stringify({
        message: 'Framework unpublished successfully'
      }), { headers: CORS_HEADERS })
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: CORS_HEADERS
    })

  } catch (error: any) {
    if (error instanceof Response) return error
    console.error('[Library Detail API] Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: CORS_HEADERS
    })
  }
}
