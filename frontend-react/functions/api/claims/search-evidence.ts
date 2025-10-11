/**
 * Search Evidence for Claims API
 * GET /api/claims/search-evidence?q=query&limit=10
 * Search user's evidence library to find items to link to claims
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
    const claimAdjustmentId = url.searchParams.get('claim_id') // Optional: exclude already linked evidence

    let sql = `
      SELECT
        e.id,
        e.title,
        e.source_type,
        e.source_url,
        e.content_snippet,
        e.credibility_score,
        e.bias_rating,
        e.tags,
        e.created_at
      FROM evidence e
      WHERE e.user_id = ?
    `

    const bindings: any[] = [auth.user.id]

    // Exclude evidence already linked to this claim
    if (claimAdjustmentId) {
      sql += ` AND e.id NOT IN (
        SELECT evidence_id
        FROM claim_evidence_links
        WHERE claim_adjustment_id = ?
      )`
      bindings.push(claimAdjustmentId)
    }

    // Search filter
    if (query) {
      sql += ` AND (
        e.title LIKE ? OR
        e.content_snippet LIKE ? OR
        e.tags LIKE ?
      )`
      const searchPattern = `%${query}%`
      bindings.push(searchPattern, searchPattern, searchPattern)
    }

    sql += ` ORDER BY e.created_at DESC LIMIT ?`
    bindings.push(limit)

    const results = await context.env.DB.prepare(sql).bind(...bindings).all()

    // Parse JSON fields
    const evidenceWithParsedData = (results.results || []).map(evidence => ({
      ...evidence,
      tags: evidence.tags ? JSON.parse(evidence.tags as string) : []
    }))

    return new Response(JSON.stringify({
      success: true,
      evidence: evidenceWithParsedData,
      count: evidenceWithParsedData.length
    }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('[Search Evidence] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to search evidence',
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
