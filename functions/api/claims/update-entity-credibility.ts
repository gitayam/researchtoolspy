/**
 * Update Entity Credibility Impact API
 * PATCH /api/claims/update-entity-credibility/:mention_id
 * Updates the credibility impact score for an entity mention
 */

import { requireAuth } from '../_shared/auth-helpers'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
}

interface UpdateCredibilityRequest {
  credibility_impact: number // -50 to +50
  context?: string
}

export const onRequestPatch: PagesFunction<Env> = async (context) => {
  try {
    const auth = await requireAuth(context)
    if (!auth) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Get mention_id from URL path
    const url = new URL(context.request.url)
    const pathParts = url.pathname.split('/')
    const mentionId = pathParts[pathParts.length - 1]

    if (!mentionId || mentionId === 'update-entity-credibility') {
      return new Response(JSON.stringify({
        error: 'mention_id is required in URL path'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const body = await context.request.json() as UpdateCredibilityRequest

    // Validate credibility impact range
    if (body.credibility_impact === undefined || body.credibility_impact < -50 || body.credibility_impact > 50) {
      return new Response(JSON.stringify({
        error: 'credibility_impact is required and must be between -50 and +50'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Verify ownership
    const mention = await context.env.DB.prepare(`
      SELECT cem.id, co.user_id as content_owner
      FROM claim_entity_mentions cem
      JOIN claim_adjustments ca ON cem.claim_adjustment_id = ca.id
      JOIN content_analysis co ON ca.content_analysis_id = co.id
      WHERE cem.id = ?
    `).bind(mentionId).first()

    if (!mention) {
      return new Response(JSON.stringify({ error: 'Entity mention not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (mention.content_owner !== auth.user.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized to update this entity mention' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Update the credibility impact
    await context.env.DB.prepare(`
      UPDATE claim_entity_mentions
      SET credibility_impact = ?, context = ?
      WHERE id = ?
    `).bind(
      body.credibility_impact,
      body.context !== undefined ? body.context : mention.context,
      mentionId
    ).run()

    return new Response(JSON.stringify({
      success: true,
      message: 'Entity credibility impact updated successfully'
    }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('[Update Entity Credibility] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to update entity credibility impact',
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
      'Access-Control-Allow-Methods': 'PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  })
}
