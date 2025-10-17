/**
 * Share Claim API
 * POST /api/claims/share/:claim_adjustment_id - Create public share link
 * GET /api/claims/share/:token - View shared claim (public)
 */

import { getUserIdOrDefault } from '../../_shared/auth-helpers'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
}

/**
 * Create a public share link for a claim adjustment
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const userId = await getUserIdOrDefault(context.request, context.env)

    const url = new URL(context.request.url)
    const pathParts = url.pathname.split('/')
    const claimAdjustmentId = pathParts[pathParts.length - 1]

    if (!claimAdjustmentId || claimAdjustmentId === 'share') {
      return new Response(JSON.stringify({
        error: 'claim_adjustment_id is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Get the claim adjustment
    const claim = await context.env.DB.prepare(`
      SELECT ca.*, cai.url, cai.title, cai.summary
      FROM claim_adjustments ca
      LEFT JOIN content_analysis cai ON ca.content_analysis_id = cai.id
      WHERE ca.id = ?
    `).bind(claimAdjustmentId).first()

    if (!claim) {
      return new Response(JSON.stringify({ error: 'Claim not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Verify ownership
    if (claim.adjusted_by !== userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized - you can only share your own claim adjustments' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Generate share token (simple UUID)
    const shareToken = crypto.randomUUID()

    // Check if already shared
    const existingShare = await context.env.DB.prepare(`
      SELECT share_token FROM claim_shares
      WHERE claim_adjustment_id = ?
    `).bind(claimAdjustmentId).first()

    if (existingShare) {
      return new Response(JSON.stringify({
        success: true,
        share_token: existingShare.share_token,
        share_url: `${url.origin}/api/claims/share/${existingShare.share_token}`,
        message: 'Using existing share link'
      }), {
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Create share record (using existing schema)
    await context.env.DB.prepare(`
      INSERT INTO claim_shares (
        id, claim_adjustment_id, share_token, shared_by, shared_at,
        is_public, show_evidence, show_entities
      ) VALUES (?, ?, ?, ?, datetime('now'), 1, 1, 1)
    `).bind(
      crypto.randomUUID(),
      claimAdjustmentId,
      shareToken,
      userId.toString()
    ).run()

    return new Response(JSON.stringify({
      success: true,
      share_token: shareToken,
      share_url: `${url.origin}/api/claims/share/${shareToken}`,
      message: 'Share link created successfully'
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('[Share Claim] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to create share link',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

/**
 * Get shared claim by token (public access)
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const url = new URL(context.request.url)
    const pathParts = url.pathname.split('/')
    const shareToken = pathParts[pathParts.length - 1]

    if (!shareToken || shareToken === 'share') {
      return new Response(JSON.stringify({
        error: 'share_token is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Get the shared claim
    const share = await context.env.DB.prepare(`
      SELECT cs.*, ca.*, cai.url as source_url, cai.title as source_title, cai.summary as source_summary
      FROM claim_shares cs
      JOIN claim_adjustments ca ON cs.claim_adjustment_id = ca.id
      LEFT JOIN content_analysis cai ON ca.content_analysis_id = cai.id
      WHERE cs.share_token = ?
    `).bind(shareToken).first()

    if (!share) {
      return new Response(JSON.stringify({ error: 'Shared claim not found or expired' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Parse JSON fields
    const originalMethods = share.original_methods ? JSON.parse(share.original_methods as string) : null
    const adjustedMethods = share.adjusted_methods ? JSON.parse(share.adjusted_methods as string) : null

    // Get linked evidence
    const evidence = await context.env.DB.prepare(`
      SELECT e.id, e.type, e.content, e.source_url, e.date, e.credibility_score, cel.relevance_score
      FROM claim_evidence_links cel
      JOIN evidence e ON cel.evidence_id = e.id
      WHERE cel.claim_adjustment_id = ?
      ORDER BY cel.relevance_score DESC
    `).bind(share.claim_adjustment_id).all()

    // Get linked entities
    const entities = await context.env.DB.prepare(`
      SELECT a.id, a.name, a.actor_type, cem.role, cem.credibility_assessment
      FROM claim_entity_mentions cem
      JOIN actors a ON cem.actor_id = a.id
      WHERE cem.claim_adjustment_id = ?
    `).bind(share.claim_adjustment_id).all()

    const claimData = {
      id: share.claim_adjustment_id,
      claim_text: share.claim_text,
      claim_category: share.claim_category,
      original_risk_score: share.original_risk_score,
      original_overall_risk: share.original_overall_risk,
      original_methods: originalMethods,
      adjusted_risk_score: share.adjusted_risk_score,
      adjusted_methods: adjustedMethods,
      user_comment: share.user_comment,
      verification_status: share.verification_status,
      created_at: share.created_at,
      updated_at: share.updated_at,
      source: {
        url: share.source_url,
        title: share.source_title,
        summary: share.source_summary
      },
      evidence: evidence.results || [],
      entities: entities.results || [],
      share_info: {
        shared_at: share.shared_at,
        shared_by: share.shared_by,
        share_token: shareToken,
        view_count: share.view_count || 0,
        is_public: share.is_public === 1,
        show_evidence: share.show_evidence === 1,
        show_entities: share.show_entities === 1
      }
    }

    return new Response(JSON.stringify({
      success: true,
      claim: claimData
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('[Get Shared Claim] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to load shared claim',
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
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  })
}
