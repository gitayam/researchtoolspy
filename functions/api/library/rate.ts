// ============================================================================
// Library Rating API - Star ratings and reviews
// ============================================================================

import { requireAuth } from '../_shared/auth-helpers'

interface Env {
  DB: D1Database
  JWT_SECRET?: string
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
    const userId = await requireAuth(request, env)
    
    // Get user hash for legacy columns
    const userResult = await env.DB.prepare('SELECT user_hash FROM users WHERE id = ?').bind(userId).first()
    const userHash = userResult?.user_hash as string

    if (!userHash) {
      return new Response(JSON.stringify({ error: 'User hash not found' }), {
        status: 404,
        headers: CORS_HEADERS
      })
    }

    if (request.method === 'POST' || request.method === 'PUT') {
      const body: any = await request.json()
      const { library_framework_id, rating, review_text } = body

      if (!library_framework_id || !rating || rating < 1 || rating > 5) {
        return new Response(JSON.stringify({ error: 'Invalid rating (must be 1-5)' }), {
          status: 400,
          headers: CORS_HEADERS
        })
      }

      // Check if framework exists
      const framework = await env.DB.prepare(
        'SELECT id FROM library_frameworks WHERE id = ? AND is_published = 1'
      ).bind(library_framework_id).first()

      if (!framework) {
        return new Response(JSON.stringify({ error: 'Framework not found' }), {
          status: 404,
          headers: CORS_HEADERS
        })
      }

      // Check for existing rating
      const existingRating = await env.DB.prepare(
        'SELECT id FROM library_ratings WHERE library_framework_id = ? AND user_hash = ?'
      ).bind(library_framework_id, userHash).first()

      const now = new Date().toISOString()

      if (existingRating) {
        // Update existing rating
        await env.DB.prepare(`
          UPDATE library_ratings
          SET rating = ?, review_text = ?, updated_at = ?
          WHERE id = ?
        `).bind(rating, review_text || '', now, existingRating.id).run()

        // Trigger will update rating_avg and rating_count
        const avgResult = await env.DB.prepare(
          'SELECT rating_avg, rating_count FROM library_frameworks WHERE id = ?'
        ).bind(library_framework_id).first()

        return new Response(JSON.stringify({
          action: 'updated',
          rating,
          rating_avg: avgResult?.rating_avg || 0,
          rating_count: avgResult?.rating_count || 0
        }), { headers: CORS_HEADERS })
      } else {
        // New rating
        const ratingId = `rating-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        await env.DB.prepare(`
          INSERT INTO library_ratings (id, library_framework_id, user_hash, rating, review_text, rated_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind(ratingId, library_framework_id, userHash, rating, review_text || '', now, now).run()

        // Trigger will update rating_avg and rating_count
        const avgResult = await env.DB.prepare(
          'SELECT rating_avg, rating_count FROM library_frameworks WHERE id = ?'
        ).bind(library_framework_id).first()

        return new Response(JSON.stringify({
          action: 'added',
          rating,
          rating_avg: avgResult?.rating_avg || 0,
          rating_count: avgResult?.rating_count || 0
        }), { headers: CORS_HEADERS })
      }
    }

    // GET: Get reviews for a framework
    if (request.method === 'GET') {
      const url = new URL(request.url)
      const libraryFrameworkId = url.searchParams.get('library_framework_id')

      if (!libraryFrameworkId) {
        return new Response(JSON.stringify({ error: 'Missing library_framework_id' }), {
          status: 400,
          headers: CORS_HEADERS
        })
      }

      const { results } = await env.DB.prepare(`
        SELECT id, user_hash, rating, review_text, rated_at, updated_at
        FROM library_ratings
        WHERE library_framework_id = ? AND review_text IS NOT NULL AND review_text != ''
        ORDER BY rated_at DESC
        LIMIT 50
      `).bind(libraryFrameworkId).all()

      return new Response(JSON.stringify({ reviews: results }), { headers: CORS_HEADERS })
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: CORS_HEADERS
    })

  } catch (error: any) {
    if (error instanceof Response) return error
    console.error('[Library Rate API] Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: CORS_HEADERS
    })
  }
}
