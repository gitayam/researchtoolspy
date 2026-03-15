/**
 * Remove Claim Evidence Link API (dynamic route)
 * DELETE /api/claims/remove-evidence-link/:link_id
 * Removes a link between a claim and evidence item
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

    const linkId = context.params.id as string

    if (!linkId) {
      return new Response(JSON.stringify({
        error: 'link_id is required in URL path'
      }), {
        status: 400,
        headers: JSON_HEADERS
      })
    }

    // Verify ownership - user must own the content analysis
    const link = await context.env.DB.prepare(`
      SELECT cel.id, cel.linked_by, co.user_id as content_owner
      FROM claim_evidence_links cel
      JOIN claim_adjustments ca ON cel.claim_adjustment_id = ca.id
      JOIN content_analysis co ON ca.content_analysis_id = co.id
      WHERE cel.id = ?
    `).bind(linkId).first()

    if (!link) {
      return new Response(JSON.stringify({ error: 'Evidence link not found' }), {
        status: 404,
        headers: JSON_HEADERS
      })
    }

    // Only the content owner can remove links
    if (link.content_owner !== authUserId) {
      return new Response(JSON.stringify({ error: 'Unauthorized to remove this evidence link' }), {
        status: 403,
        headers: JSON_HEADERS
      })
    }

    // Delete the link
    await context.env.DB.prepare(`
      DELETE FROM claim_evidence_links WHERE id = ?
    `).bind(linkId).run()

    return new Response(JSON.stringify({
      success: true,
      message: 'Evidence link removed successfully'
    }), {
      headers: JSON_HEADERS
    })
  } catch (error) {
    if (error instanceof Response) return error
    console.error('[Remove Evidence Link] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to remove evidence link'
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
