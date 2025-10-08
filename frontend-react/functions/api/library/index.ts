// ============================================================================
// Public Library API - Browse and search published frameworks
// ============================================================================

interface Env {
  DB: D1Database
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash',
  'Content-Type': 'application/json',
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS })
  }

  try {
    const url = new URL(request.url)
    const userHash = request.headers.get('X-User-Hash') || 'guest'

    if (request.method === 'GET') {
      // Browse/search library frameworks
      const search = url.searchParams.get('search') || ''
      const frameworkType = url.searchParams.get('type') || ''
      const category = url.searchParams.get('category') || ''
      const sortBy = url.searchParams.get('sort') || 'popular' // popular, recent, trending, top_rated
      const limit = parseInt(url.searchParams.get('limit') || '20')
      const offset = parseInt(url.searchParams.get('offset') || '0')
      const tags = url.searchParams.get('tags') // comma-separated

      let query = `
        SELECT
          lf.*,
          COUNT(DISTINCT lv.id) as total_votes,
          COUNT(DISTINCT lr.id) as total_ratings,
          COUNT(DISTINCT lfo.id) as total_forks,
          (SELECT vote_type FROM library_votes WHERE library_framework_id = lf.id AND user_hash = ?) as user_vote,
          (SELECT rating FROM library_ratings WHERE library_framework_id = lf.id AND user_hash = ?) as user_rating,
          (SELECT COUNT(*) FROM library_subscriptions WHERE library_framework_id = lf.id AND user_hash = ?) as user_subscribed
        FROM library_frameworks lf
        LEFT JOIN library_votes lv ON lf.id = lv.library_framework_id
        LEFT JOIN library_ratings lr ON lf.id = lr.library_framework_id
        LEFT JOIN library_forks lfo ON lf.id = lfo.parent_library_framework_id
        WHERE lf.is_published = 1
      `

      const params: (string | number)[] = [userHash, userHash, userHash]

      if (search) {
        query += ` AND (lf.title LIKE ? OR lf.description LIKE ? OR lf.search_text LIKE ?)`
        const searchPattern = `%${search}%`
        params.push(searchPattern, searchPattern, searchPattern)
      }

      if (frameworkType) {
        query += ` AND lf.framework_type = ?`
        params.push(frameworkType)
      }

      if (category) {
        query += ` AND lf.category = ?`
        params.push(category)
      }

      if (tags) {
        // Filter by tags (simplified - would need JOIN for proper implementation)
        query += ` AND lf.tags LIKE ?`
        params.push(`%${tags}%`)
      }

      query += ` GROUP BY lf.id`

      // Sorting
      switch (sortBy) {
        case 'recent':
          query += ` ORDER BY lf.published_at DESC`
          break
        case 'trending':
          // Trending: combination of recent views and votes
          query += ` ORDER BY (lf.view_count / (julianday('now') - julianday(lf.published_at) + 1)) DESC, lf.vote_score DESC`
          break
        case 'top_rated':
          query += ` ORDER BY lf.rating_avg DESC, lf.rating_count DESC`
          break
        case 'most_forked':
          query += ` ORDER BY lf.fork_count DESC`
          break
        case 'popular':
        default:
          query += ` ORDER BY lf.vote_score DESC, lf.view_count DESC`
      }

      query += ` LIMIT ? OFFSET ?`
      params.push(limit, offset)

      const { results } = await env.DB.prepare(query).bind(...params).all()

      // Get total count
      let countQuery = `SELECT COUNT(*) as total FROM library_frameworks WHERE is_published = 1`
      const countParams: (string | number)[] = []

      if (search) {
        countQuery += ` AND (title LIKE ? OR description LIKE ? OR search_text LIKE ?)`
        const searchPattern = `%${search}%`
        countParams.push(searchPattern, searchPattern, searchPattern)
      }

      if (frameworkType) {
        countQuery += ` AND framework_type = ?`
        countParams.push(frameworkType)
      }

      if (category) {
        countQuery += ` AND category = ?`
        countParams.push(category)
      }

      const countResult = await env.DB.prepare(countQuery).bind(...countParams).first()

      return new Response(JSON.stringify({
        frameworks: results,
        total: countResult?.total || 0,
        limit,
        offset
      }), { headers: CORS_HEADERS })
    }

    // POST: Publish framework to library
    if (request.method === 'POST') {
      const authToken = request.headers.get('Authorization')?.replace('Bearer ', '')
      if (!authToken && userHash === 'guest') {
        return new Response(JSON.stringify({ error: 'Authentication required to publish' }), {
          status: 401,
          headers: CORS_HEADERS
        })
      }

      const body: any = await request.json()
      const {
        framework_id,
        framework_type,
        title,
        description,
        tags,
        category,
        original_workspace_id
      } = body

      if (!framework_id || !framework_type || !title) {
        return new Response(JSON.stringify({ error: 'Missing required fields' }), {
          status: 400,
          headers: CORS_HEADERS
        })
      }

      // Check if already published
      const existing = await env.DB.prepare(
        'SELECT id FROM library_frameworks WHERE framework_id = ? AND is_published = 1'
      ).bind(framework_id).first()

      if (existing) {
        return new Response(JSON.stringify({ error: 'Framework already published' }), {
          status: 409,
          headers: CORS_HEADERS
        })
      }

      const libraryId = `lib-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      const now = new Date().toISOString()

      // Create search text (title + description + tags)
      const searchText = `${title} ${description || ''} ${tags || ''}`.toLowerCase()

      await env.DB.prepare(`
        INSERT INTO library_frameworks (
          id, framework_id, framework_type, published_by, published_at,
          is_published, title, description, tags, category,
          original_workspace_id, last_updated, search_text, created_at
        ) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        libraryId,
        framework_id,
        framework_type,
        userHash,
        now,
        title,
        description || '',
        tags || '[]',
        category || '',
        original_workspace_id || '1',
        now,
        searchText,
        now
      ).run()

      // Mark framework as published
      await env.DB.prepare(`
        UPDATE framework_sessions
        SET published_to_library = 1, library_published_at = ?
        WHERE id = ?
      `).bind(now, framework_id).run()

      return new Response(JSON.stringify({
        id: libraryId,
        message: 'Framework published to library successfully'
      }), { headers: CORS_HEADERS })
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: CORS_HEADERS
    })

  } catch (error: any) {
    console.error('[Library API] Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: CORS_HEADERS
    })
  }
}
