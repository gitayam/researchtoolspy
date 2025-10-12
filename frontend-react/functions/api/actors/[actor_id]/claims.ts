/**
 * Get Claims for an Actor
 * GET /api/actors/{actor_id}/claims
 * Returns all claims where this actor was mentioned, grouped by role
 */

import { requireAuth } from '../../_shared/auth-helpers'

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

    // Get actor_id from URL path
    const actorId = context.params.actor_id as string

    if (!actorId) {
      return new Response(JSON.stringify({
        error: 'actor_id is required in URL path'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Verify actor exists and user has access (through workspace)
    const actor = await context.env.DB.prepare(`
      SELECT a.id, a.name, a.workspace_id, wm.user_id
      FROM actors a
      JOIN workspace_members wm ON a.workspace_id = wm.workspace_id
      WHERE a.id = ? AND wm.user_id = ?
    `).bind(actorId, auth.user.id).first()

    if (!actor) {
      return new Response(JSON.stringify({ error: 'Actor not found or access denied' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Get all claims where this actor is mentioned
    const claimMentions = await context.env.DB.prepare(`
      SELECT
        cem.id as mention_id,
        cem.role,
        cem.context,
        cem.credibility_impact,
        cem.extracted_at,
        ca.id as claim_id,
        ca.claim_text,
        ca.claim_category,
        ca.original_risk_score,
        ca.original_overall_risk,
        ca.verification_status,
        ca.created_at as claim_created_at,
        co.id as content_analysis_id,
        co.url as content_url,
        co.title as content_title,
        co.analyzed_at
      FROM claim_entity_mentions cem
      JOIN claim_adjustments ca ON cem.claim_adjustment_id = ca.id
      JOIN content_analysis co ON ca.content_analysis_id = co.id
      WHERE cem.entity_id = ?
      ORDER BY ca.created_at DESC, cem.role ASC
    `).bind(actorId).all()

    // Group claims by role
    const groupedByRole: Record<string, any[]> = {
      claim_maker: [],
      subject: [],
      mentioned: [],
      affected: []
    }

    let totalClaims = 0
    const uniqueClaimIds = new Set<string>()

    ;(claimMentions.results || []).forEach((mention: any) => {
      uniqueClaimIds.add(mention.claim_id)

      const claimData = {
        mention_id: mention.mention_id,
        claim_id: mention.claim_id,
        claim_text: mention.claim_text,
        claim_category: mention.claim_category,
        role: mention.role,
        context: mention.context,
        credibility_impact: mention.credibility_impact,
        risk_score: mention.original_risk_score,
        overall_risk: mention.original_overall_risk,
        verification_status: mention.verification_status,
        extracted_at: mention.extracted_at,
        claim_created_at: mention.claim_created_at,
        content_analysis_id: mention.content_analysis_id,
        content_url: mention.content_url,
        content_title: mention.content_title,
        analyzed_at: mention.analyzed_at
      }

      if (groupedByRole[mention.role as keyof typeof groupedByRole]) {
        groupedByRole[mention.role as keyof typeof groupedByRole].push(claimData)
      }
    })

    totalClaims = uniqueClaimIds.size

    // Calculate statistics
    const stats = {
      total_claims: totalClaims,
      as_claim_maker: groupedByRole.claim_maker.length,
      as_subject: groupedByRole.subject.length,
      as_mentioned: groupedByRole.mentioned.length,
      as_affected: groupedByRole.affected.length,
      high_risk_claims: (claimMentions.results || []).filter((m: any) => m.original_overall_risk === 'high').length,
      medium_risk_claims: (claimMentions.results || []).filter((m: any) => m.original_overall_risk === 'medium').length,
      low_risk_claims: (claimMentions.results || []).filter((m: any) => m.original_overall_risk === 'low').length,
      verified_claims: (claimMentions.results || []).filter((m: any) => m.verification_status === 'verified').length,
      debunked_claims: (claimMentions.results || []).filter((m: any) => m.verification_status === 'debunked').length
    }

    return new Response(JSON.stringify({
      success: true,
      actor: {
        id: actor.id,
        name: actor.name
      },
      claims: claimMentions.results || [],
      grouped_by_role: groupedByRole,
      statistics: stats
    }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('[Get Actor Claims] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to load actor claims',
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
