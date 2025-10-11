/**
 * Get Claim Evidence Links API
 * GET /api/claims/get-evidence-links/:claim_adjustment_id
 * Returns all evidence items linked to a specific claim
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

    // Get claim_adjustment_id from URL path
    const url = new URL(context.request.url)
    const pathParts = url.pathname.split('/')
    const claimAdjustmentId = pathParts[pathParts.length - 1]

    if (!claimAdjustmentId || claimAdjustmentId === 'get-evidence-links') {
      return new Response(JSON.stringify({
        error: 'claim_adjustment_id is required in URL path'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
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
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (claimAdjustment.content_owner !== auth.user.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
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
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('[Get Evidence Links] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to load evidence links',
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
