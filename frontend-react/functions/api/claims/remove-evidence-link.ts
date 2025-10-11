/**
 * Remove Claim Evidence Link API
 * DELETE /api/claims/remove-evidence-link/:link_id
 * Removes a link between a claim and evidence item
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

    // Get link_id from URL path
    const url = new URL(context.request.url)
    const pathParts = url.pathname.split('/')
    const linkId = pathParts[pathParts.length - 1]

    if (!linkId || linkId === 'remove-evidence-link') {
      return new Response(JSON.stringify({
        error: 'link_id is required in URL path'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
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
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Only the content owner can remove links
    if (link.content_owner !== auth.user.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized to remove this evidence link' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
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
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('[Remove Evidence Link] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to remove evidence link',
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
