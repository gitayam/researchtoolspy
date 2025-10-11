/**
 * Remove Entity Mention API
 * DELETE /api/claims/remove-entity-mention/:mention_id
 * Removes an entity mention from a claim
 */

import { requireAuth } from '../_shared/auth-helpers'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
}

export const onRequestDelete: PagesFunction<Env> = async (context) => {
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

    if (!mentionId || mentionId === 'remove-entity-mention') {
      return new Response(JSON.stringify({
        error: 'mention_id is required in URL path'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
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
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Only the content owner can remove entity mentions
    if (mention.content_owner !== auth.user.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized to remove this entity mention' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
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
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('[Remove Entity Mention] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to remove entity mention',
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
      'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  })
}
