/**
 * Get Claim Evidence Links API (dynamic route)
 * GET /api/claims/get-evidence-links/:claim_adjustment_id
 * Returns all evidence items linked to a specific claim
 */

import { requireAuth } from '../../_shared/auth-helpers'
import { JSON_HEADERS, optionsResponse } from '../../_shared/api-utils'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const authUserId = await requireAuth(context.request, context.env)

    const claimAdjustmentId = context.params.id as string

    if (!claimAdjustmentId) {
      return new Response(JSON.stringify({
        error: 'claim_adjustment_id is required in URL path'
      }), {
        status: 400,
        headers: JSON_HEADERS
      })
    }

    // Verify ownership of claim adjustment
    const claimAdjustment = await context.env.DB.prepare(`
      SELECT ca.id, co.user_id as content_owner
      FROM claim_adjustments ca
      JOIN content_analysis co ON ca.content_analysis_id = co.id
      WHERE ca.id = ?
    `).bind(claimAdjustmentId).first()

    if (!claimAdjustment) {
      return new Response(JSON.stringify({ error: 'Claim adjustment not found' }), {
        status: 404,
        headers: JSON_HEADERS
      })
    }

    if (String(claimAdjustment.content_owner) !== String(authUserId)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 403,
        headers: JSON_HEADERS
      })
    }

    // Get all linked evidence with full evidence details
    const links = await context.env.DB.prepare(`
      SELECT
        cel.id as link_id,
        cel.relationship,
        cel.relevance_score,
        cel.confidence,
        cel.notes,
        cel.linked_by,
        cel.created_at,
        e.id as evidence_id,
        e.title,
        e.source_type,
        e.source_url,
        e.content_snippet,
        e.credibility_score,
        e.bias_rating,
        e.tags,
        e.created_at as evidence_created_at
      FROM claim_evidence_links cel
      JOIN evidence e ON cel.evidence_id = e.id
      WHERE cel.claim_adjustment_id = ?
      ORDER BY cel.created_at DESC
    `).bind(claimAdjustmentId).all()

    // Parse JSON fields
    const linksWithParsedData = (links.results || []).map(link => ({
      ...link,
      tags: link.tags ? JSON.parse(link.tags as string) : []
    }))

    return new Response(JSON.stringify({
      success: true,
      links: linksWithParsedData,
      count: linksWithParsedData.length
    }), {
      headers: JSON_HEADERS
    })
  } catch (error) {
    if (error instanceof Response) return error
    console.error('[Get Evidence Links] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to load evidence links'
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
