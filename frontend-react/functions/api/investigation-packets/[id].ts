/**
 * Get Investigation Packet API
 * GET /api/investigation-packets/:id
 * Retrieves packet with all linked content analyses and their claims
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

    const packetId = context.params.id as string

    // Get packet
    const packet = await context.env.DB.prepare(`
      SELECT
        id,
        title,
        description,
        investigation_type,
        priority,
        status,
        lead_investigator,
        category,
        tags,
        created_at,
        updated_at,
        completed_at
      FROM investigation_packets
      WHERE id = ? AND user_id = ?
    `).bind(packetId, auth.user.id).first()

    if (!packet) {
      return new Response(JSON.stringify({ error: 'Packet not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Get all content analyses in this packet
    const contentLinks = await context.env.DB.prepare(`
      SELECT
        pc.id as link_id,
        pc.content_analysis_id,
        pc.notes,
        pc.added_at,
        ca.url,
        ca.title,
        ca.publication_date,
        ca.processed_at
      FROM packet_claims pc
      JOIN content_analysis ca ON pc.content_analysis_id = ca.id
      WHERE pc.packet_id = ?
      ORDER BY pc.added_at DESC
    `).bind(packetId).all()

    // For each content analysis, get all claims with adjustments
    const contentWithClaims = []

    for (const link of (contentLinks.results || [])) {
      // Get all claim adjustments for this content
      const claims = await context.env.DB.prepare(`
        SELECT
          ca_adj.id as adjustment_id,
          ca_adj.claim_index,
          ca_adj.claim_text,
          ca_adj.claim_category,
          ca_adj.original_risk_score,
          ca_adj.original_overall_risk,
          ca_adj.adjusted_risk_score,
          ca_adj.user_comment,
          ca_adj.verification_status,
          ca_adj.created_at,
          ca_adj.updated_at
        FROM claim_adjustments ca_adj
        WHERE ca_adj.content_analysis_id = ?
        ORDER BY ca_adj.claim_index ASC
      `).bind(link.content_analysis_id).all()

      // For each claim, get linked evidence and entities count
      const claimsWithMetadata = await Promise.all(
        (claims.results || []).map(async (claim: any) => {
          // Count evidence links
          const evidenceCount = await context.env.DB.prepare(`
            SELECT COUNT(*) as count
            FROM claim_evidence_links
            WHERE claim_adjustment_id = ?
          `).bind(claim.adjustment_id).first()

          // Count entity mentions
          const entityCount = await context.env.DB.prepare(`
            SELECT COUNT(*) as count
            FROM claim_entity_mentions
            WHERE claim_adjustment_id = ?
          `).bind(claim.adjustment_id).first()

          return {
            ...claim,
            evidence_count: evidenceCount?.count || 0,
            entity_count: entityCount?.count || 0
          }
        })
      )

      contentWithClaims.push({
        link_id: link.link_id,
        content_analysis_id: link.content_analysis_id,
        url: link.url,
        title: link.title,
        publication_date: link.publication_date,
        added_at: link.added_at,
        notes: link.notes,
        claims: claimsWithMetadata,
        claim_count: claimsWithMetadata.length
      })
    }

    // Get activity log
    const activity = await context.env.DB.prepare(`
      SELECT
        id,
        action_type,
        action_details,
        created_at
      FROM investigation_activity_log
      WHERE packet_id = ?
      ORDER BY created_at DESC
      LIMIT 50
    `).bind(packetId).all()

    // Calculate statistics
    const totalClaims = contentWithClaims.reduce((sum, c) => sum + c.claim_count, 0)
    const totalEvidence = contentWithClaims.reduce(
      (sum, c) => sum + c.claims.reduce((s: number, cl: any) => s + cl.evidence_count, 0),
      0
    )
    const totalEntities = contentWithClaims.reduce(
      (sum, c) => sum + c.claims.reduce((s: number, cl: any) => s + cl.entity_count, 0),
      0
    )

    return new Response(JSON.stringify({
      success: true,
      packet: {
        ...packet,
        tags: packet.tags ? JSON.parse(packet.tags as string) : []
      },
      content: contentWithClaims,
      statistics: {
        total_content: contentWithClaims.length,
        total_claims: totalClaims,
        total_evidence: totalEvidence,
        total_entities: totalEntities
      },
      activity: (activity.results || []).map((act: any) => ({
        ...act,
        action_details: act.action_details ? JSON.parse(act.action_details) : null
      }))
    }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('[Get Packet] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to retrieve investigation packet',
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
