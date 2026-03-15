/**
 * Search Evidence for Claims API
 * GET /api/claims/search-evidence?q=query&limit=10
 * Search user's evidence library to find items to link to claims
 */

import { requireAuth } from '../_shared/auth-helpers'
import { JSON_HEADERS, optionsResponse } from '../_shared/api-utils'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const authUserId = await requireAuth(context.request, context.env)

    const url = new URL(context.request.url)
    const query = url.searchParams.get('q') || ''
    const limit = parseInt(url.searchParams.get('limit') || '20')
    const claimAdjustmentId = url.searchParams.get('claim_id') // Optional: exclude already linked evidence

    let sql = `
      SELECT
        e.id,
        e.title,
        e.description,
        e.type,
        e.status,
        e.tags,
        e.created_at
      FROM evidence e
      WHERE e.created_by = ?
    `

    const bindings: any[] = [authUserId]

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
        e.description LIKE ? OR
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
      headers: JSON_HEADERS
    })
  } catch (error) {
    if (error instanceof Response) return error
    console.error('[Search Evidence] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to search evidence'
    }), {
      status: 500,
      headers: JSON_HEADERS
    })
  }
}

// CORS preflight
export const onRequestOptions: PagesFunction = async () => {
  return optionsResponse()
}
