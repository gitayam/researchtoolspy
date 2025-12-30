/**
 * Link Entity to Claim API
 * POST /api/claims/link-entity
 * Links an actor/source/event to a claim with role and credibility impact
 */

import { requireAuth } from '../_shared/auth-helpers'
import crypto from 'node:crypto'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
}

interface LinkEntityRequest {
  claim_adjustment_id: string
  entity_id: string
  entity_name: string
  entity_type: 'person' | 'organization' | 'location' | 'event' | 'other'
  role: 'claim_maker' | 'subject' | 'mentioned' | 'affected'
  context?: string
  credibility_impact?: number // -50 to +50
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const auth = await requireAuth(context)
    if (!auth) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const body = await context.request.json() as LinkEntityRequest

    // Validate required fields
    if (!body.claim_adjustment_id || !body.entity_id || !body.entity_name || !body.entity_type || !body.role) {
      return new Response(JSON.stringify({
        error: 'claim_adjustment_id, entity_id, entity_name, entity_type, and role are required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Validate entity type
    const validTypes = ['person', 'organization', 'location', 'event', 'other']
    if (!validTypes.includes(body.entity_type)) {
      return new Response(JSON.stringify({
        error: 'entity_type must be one of: person, organization, location, event, other'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Validate role
    const validRoles = ['claim_maker', 'subject', 'mentioned', 'affected']
    if (!validRoles.includes(body.role)) {
      return new Response(JSON.stringify({
        error: 'role must be one of: claim_maker, subject, mentioned, affected'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Validate credibility impact range
    if (body.credibility_impact !== undefined) {
      if (body.credibility_impact < -50 || body.credibility_impact > 50) {
        return new Response(JSON.stringify({
          error: 'credibility_impact must be between -50 and +50'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
      }
    }

    // Verify ownership of claim adjustment
    const claimAdjustment = await context.env.DB.prepare(`
      SELECT ca.id, co.user_id as content_owner
      FROM claim_adjustments ca
      JOIN content_analysis co ON ca.content_analysis_id = co.id
      WHERE ca.id = ?
    `).bind(body.claim_adjustment_id).first()

    if (!claimAdjustment) {
      return new Response(JSON.stringify({ error: 'Claim adjustment not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (claimAdjustment.content_owner !== auth.user.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized to link entities to this claim' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Check if this exact entity-role combination already exists
    const existing = await context.env.DB.prepare(`
      SELECT id
      FROM claim_entity_mentions
      WHERE claim_adjustment_id = ? AND entity_id = ? AND role = ?
    `).bind(body.claim_adjustment_id, body.entity_id, body.role).first()

    if (existing) {
      return new Response(JSON.stringify({
        error: 'This entity with this role is already linked to this claim',
        existing_id: existing.id
      }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const now = new Date().toISOString()
    const id = crypto.randomUUID()

    // Create the entity mention
    await context.env.DB.prepare(`
      INSERT INTO claim_entity_mentions (
        id, claim_adjustment_id, entity_id, entity_name, entity_type,
        role, context, credibility_impact, extracted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      body.claim_adjustment_id,
      body.entity_id,
      body.entity_name,
      body.entity_type,
      body.role,
      body.context || null,
      body.credibility_impact ?? 0,
      now
    ).run()

    return new Response(JSON.stringify({
      success: true,
      id,
      message: 'Entity linked to claim successfully'
    }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('[Link Entity] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to link entity to claim',
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
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  })
}
