/**
 * Content Intelligence Search
 *
 * GET /api/content-intelligence/search?q=...&limit=...
 *   Search saved content analyses and their claims
 *   Returns: { success: true, results: [{ id, title, url, claim_count, claims }] }
 */

import type { PagesFunction } from '@cloudflare/workers-types'
import { getUserFromRequest } from '../_shared/auth-helpers'
import { JSON_HEADERS, safeJsonParse } from '../_shared/api-utils'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  try {
    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: JSON_HEADERS,
      })
    }

    const url = new URL(request.url)
    const query = url.searchParams.get('q') || ''
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '10', 10) || 10, 50)

    if (!query.trim()) {
      return new Response(JSON.stringify({ success: true, results: [] }), {
        headers: JSON_HEADERS,
      })
    }

    const searchTerm = `%${query.trim()}%`

    // Search content_intelligence by title, url, or main_content
    const { results: analyses } = await env.DB.prepare(`
      SELECT id, title, url, claims
      FROM content_intelligence
      WHERE user_id = ?
        AND (
          title LIKE ? OR url LIKE ? OR main_content LIKE ?
        )
      ORDER BY created_at DESC
      LIMIT ?
    `).bind(userId, searchTerm, searchTerm, searchTerm, limit).all()

    const results = []

    for (const analysis of analyses) {
      const claims = safeJsonParse(analysis.claims, [])

      // Also get claim_adjustments for this analysis
      const { results: adjustments } = await env.DB.prepare(`
        SELECT claim_text, claim_category, original_risk_score, original_overall_risk,
               original_methods, adjusted_risk_score, adjusted_methods,
               verification_status
        FROM claim_adjustments
        WHERE content_analysis_id = ?
        ORDER BY claim_index ASC
      `).bind(analysis.id).all()

      // Build claims array — prefer adjustments if they exist, fall back to raw claims
      const claimList = adjustments.length > 0
        ? adjustments.map(adj => ({
          claim_text: adj.claim_text as string,
          claim_category: adj.claim_category as string || undefined,
          deception_analysis: adj.original_methods ? {
            overall_risk: adj.original_overall_risk as string || 'unknown',
            risk_score: (adj.adjusted_risk_score ?? adj.original_risk_score ?? 0) as number,
            methods: safeJsonParse(adj.adjusted_methods, null)
              || safeJsonParse(adj.original_methods, null)
              || {},
            red_flags: [],
            confidence_assessment: '',
          } : undefined,
          source_url: analysis.url as string || undefined,
          content_analysis_id: analysis.id as number,
        }))
        : (Array.isArray(claims) ? claims : []).map((c: any) => ({
          claim_text: c.claim || c.claim_text || '',
          claim_category: c.category || c.claim_category || undefined,
          source_url: analysis.url as string || undefined,
          content_analysis_id: analysis.id as number,
        }))

      results.push({
        id: String(analysis.id),
        title: analysis.title as string || analysis.url as string || 'Untitled',
        url: analysis.url as string || undefined,
        claim_count: claimList.length,
        claims: claimList,
      })
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: JSON_HEADERS,
    })
  } catch (error) {
    console.error('[content-intelligence/search] Error:', error)
    return new Response(JSON.stringify({ error: 'Failed to search content' }), {
      status: 500, headers: JSON_HEADERS,
    })
  }
}

export const onRequestPost: PagesFunction = async () => {
  return new Response(JSON.stringify({ error: 'Method not allowed. Use GET.' }), {
    status: 405, headers: JSON_HEADERS,
  })
}
