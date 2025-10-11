/**
 * Get Claim Entities API
 * GET /api/claims/get-claim-entities/:claim_adjustment_id
 * Returns all entities linked to a specific claim
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

    if (!claimAdjustmentId || claimAdjustmentId === 'get-claim-entities') {
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

    // Get all entity mentions for this claim
    const entities = await context.env.DB.prepare(`
      SELECT
        id,
        entity_id,
        entity_name,
        entity_type,
        role,
        context,
        credibility_impact,
        extracted_at
      FROM claim_entity_mentions
      WHERE claim_adjustment_id = ?
      ORDER BY extracted_at DESC
    `).bind(claimAdjustmentId).all()

    // Group entities by role for easier UI rendering
    const groupedByRole = {
      claim_maker: [],
      subject: [],
      mentioned: [],
      affected: []
    }

    ;(entities.results || []).forEach((entity: any) => {
      if (groupedByRole[entity.role as keyof typeof groupedByRole]) {
        groupedByRole[entity.role as keyof typeof groupedByRole].push(entity)
      }
    })

    return new Response(JSON.stringify({
      success: true,
      entities: entities.results || [],
      grouped_by_role: groupedByRole,
      count: (entities.results || []).length
    }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('[Get Claim Entities] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to load claim entities',
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
