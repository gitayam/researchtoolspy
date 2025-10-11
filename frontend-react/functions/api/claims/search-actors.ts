/**
 * Search Actors for Claims API
 * GET /api/claims/search-actors?q=query&limit=20&claim_id=xxx
 * Search user's actors to find entities to link to claims
 */

import { requireAuth } from '../_shared/auth-helpers'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const auth = await requireAuth(context)
    if (!auth) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const url = new URL(context.request.url)
    const query = url.searchParams.get('q') || ''
    const limit = parseInt(url.searchParams.get('limit') || '20')
    const claimId = url.searchParams.get('claim_id') // Optional: exclude already linked actors

    let sql = `
      SELECT
        id,
        name,
        type,
        description,
        credibility_rating,
        bias_rating,
        created_at
      FROM actors
      WHERE user_id = ?
    `

    const bindings: any[] = [auth.user.id]

    // Exclude actors already linked to this claim
    if (claimId) {
      sql += ` AND id NOT IN (
        SELECT entity_id
        FROM claim_entity_mentions
        WHERE claim_adjustment_id = ?
      )`
      bindings.push(claimId)
    }

    // Search filter
    if (query) {
      sql += ` AND (
        name LIKE ? OR
        description LIKE ?
      )`
      const searchPattern = `%${query}%`
      bindings.push(searchPattern, searchPattern)
    }

    sql += ` ORDER BY created_at DESC LIMIT ?`
    bindings.push(limit)

    const results = await context.env.DB.prepare(sql).bind(...bindings).all()

    return new Response(JSON.stringify({
      success: true,
      actors: results.results || [],
      count: (results.results || []).length
    }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('[Search Actors] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to search actors',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// CORS preflight
export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  })
}
