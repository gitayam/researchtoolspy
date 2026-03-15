/**
 * Remove Entity Mention API (dynamic route)
 * DELETE /api/claims/remove-entity-mention/:mention_id
 * Removes an entity mention from a claim
 */

import { requireAuth } from '../../_shared/auth-helpers'
import { JSON_HEADERS, optionsResponse } from '../../_shared/api-utils'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
}

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  try {
    const authUserId = await requireAuth(context.request, context.env)

    const mentionId = context.params.id as string

    if (!mentionId) {
      return new Response(JSON.stringify({
        error: 'mention_id is required in URL path'
      }), {
        status: 400,
        headers: JSON_HEADERS
      })
    }

    // Verify ownership - user must own the content analysis
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
        headers: JSON_HEADERS
      })
    }

    // Only the content owner can remove entity mentions
    if (mention.content_owner !== authUserId) {
      return new Response(JSON.stringify({ error: 'Unauthorized to remove this entity mention' }), {
        status: 403,
        headers: JSON_HEADERS
      })
    }

    // Delete the mention
    await context.env.DB.prepare(`
      DELETE FROM claim_entity_mentions WHERE id = ?
    `).bind(mentionId).run()

    return new Response(JSON.stringify({
      success: true,
      message: 'Entity mention removed successfully'
    }), {
      headers: JSON_HEADERS
    })
  } catch (error) {
    console.error('[Remove Entity Mention] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to remove entity mention'
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
