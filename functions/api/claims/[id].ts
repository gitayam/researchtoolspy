/**
 * Individual Claim API
 * GET /api/claims/[id] - Get single claim details
 */

import { requireAuth } from '../_shared/auth-helpers'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const userId = await requireAuth(context.request, context.env)
    const { id } = context.params

    // Get claim with related data
    const claim = await context.env.DB.prepare(`
      SELECT
        ca.*,
        u.username as adjusted_by_username,
        c.title as content_title,
        c.url as content_url,
        c.domain as content_domain
      FROM claim_adjustments ca
      LEFT JOIN users u ON ca.adjusted_by = u.id
      LEFT JOIN content_analysis c ON ca.content_analysis_id = c.id
      WHERE ca.id = ?
    `).bind(id).first()

    if (!claim) {
      return new Response(JSON.stringify({ error: 'Claim not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Get linked evidence
    const evidence = await context.env.DB.prepare(`
      SELECT
        cel.*,
        e.title as evidence_title,
        e.content_preview as evidence_preview
      FROM claim_evidence_links cel
      LEFT JOIN evidence e ON cel.evidence_id = e.id
      WHERE cel.claim_adjustment_id = ?
      ORDER BY cel.created_at DESC
    `).bind(id).all()

    // Get linked entities
    const entities = await context.env.DB.prepare(`
      SELECT * FROM claim_entity_mentions
      WHERE claim_adjustment_id = ?
      ORDER BY extracted_at DESC
    `).bind(id).all()

    // Parse JSON fields
    const parsed = {
      ...claim,
      original_methods: claim.original_methods ? JSON.parse(claim.original_methods as string) : null,
      adjusted_methods: claim.adjusted_methods ? JSON.parse(claim.adjusted_methods as string) : null,
      evidence: evidence.results || [],
      entities: entities.results || []
    }

    return new Response(JSON.stringify(parsed), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('[claims] Error fetching claim:', error)
    return new Response(JSON.stringify({
      error: 'Failed to fetch claim',
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
