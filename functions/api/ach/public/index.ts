/**
 * Public ACH Analysis Discovery API
 * GET /api/ach/public - List all public ACH analyses
 */
import { JSON_HEADERS, safeJsonParse } from '../../_shared/api-utils'

interface Env {
  DB: D1Database
}

// GET /api/ach/public - List public ACH analyses
export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const url = new URL(context.request.url)
    const domain = url.searchParams.get('domain')
    const search = url.searchParams.get('search')
    const sortBy = url.searchParams.get('sort') || 'popular' // popular, cloned, recent
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50') || 50, 200)
    const offset = parseInt(url.searchParams.get('offset') || '0')

    // Build query
    let query = 'SELECT * FROM ach_analyses WHERE is_public = 1'
    const params: any[] = []

    // Filter by domain
    if (domain && domain !== 'all') {
      query += ' AND domain = ?'
      params.push(domain)
    }

    // Search in title, question, description
    if (search) {
      query += ' AND (title LIKE ? OR question LIKE ? OR description LIKE ?)'
      const searchTerm = `%${search}%`
      params.push(searchTerm, searchTerm, searchTerm)
    }

    // Sorting
    switch (sortBy) {
      case 'popular':
        query += ' ORDER BY view_count DESC, created_at DESC'
        break
      case 'cloned':
        query += ' ORDER BY clone_count DESC, created_at DESC'
        break
      case 'recent':
      default:
        query += ' ORDER BY created_at DESC'
        break
    }

    // Pagination
    query += ' LIMIT ? OFFSET ?'
    params.push(limit, offset)

    // Execute query
    const result = await context.env.DB.prepare(query).bind(...params).all()

    // Parse tags for each analysis
    const analyses = (result.results || []).map((analysis: any) => ({
      ...analysis,
      tags: analysis.tags ? safeJsonParse(analysis.tags, null) : null
    }))

    // Get total count for pagination
    let countQuery = 'SELECT COUNT(*) as total FROM ach_analyses WHERE is_public = 1'
    const countParams: any[] = []

    if (domain && domain !== 'all') {
      countQuery += ' AND domain = ?'
      countParams.push(domain)
    }

    if (search) {
      countQuery += ' AND (title LIKE ? OR question LIKE ? OR description LIKE ?)'
      const searchTerm = `%${search}%`
      countParams.push(searchTerm, searchTerm, searchTerm)
    }

    const countResult = await context.env.DB.prepare(countQuery).bind(...countParams).first()

    return new Response(JSON.stringify({
      analyses,
      total: countResult?.total || 0,
      limit,
      offset
    }), {
      headers: JSON_HEADERS
    })
  } catch (error) {
    console.error('Public ACH discovery error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to fetch public analyses'

    }), {
      status: 500,
      headers: JSON_HEADERS
    })
  }
}
