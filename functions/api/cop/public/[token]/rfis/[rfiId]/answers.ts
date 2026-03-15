/**
 * COP Public RFI Answer API
 *
 * POST /api/cop/public/:token/rfis/:rfiId/answers - Submit answer from public view
 */
import type { PagesFunction } from '@cloudflare/workers-types'
import { generatePrefixedId, JSON_HEADERS } from '../../../../../_shared/api-utils'

interface Env {
  DB: D1Database
}

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash, X-Workspace-ID',
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const token = params.token as string
  const rfiId = params.rfiId as string

  try {
    // Verify share exists and allows RFI answers
    const share = await env.DB.prepare(`
      SELECT * FROM cop_shares WHERE share_token = ? AND allow_rfi_answers = 1
    `).bind(token).first()

    if (!share) {
      return new Response(JSON.stringify({ error: 'Share not found or RFI answers not allowed' }), {
        status: 403, headers: corsHeaders,
      })
    }

    const shareSessionId = (share as any).cop_session_id

    // Verify the RFI belongs to the share's session
    const rfiCheck = await env.DB.prepare(
      'SELECT id FROM cop_rfis WHERE id = ? AND cop_session_id = ?'
    ).bind(rfiId, shareSessionId).first()
    if (!rfiCheck) {
      return new Response(JSON.stringify({ error: 'RFI not found' }), {
        status: 404, headers: corsHeaders,
      })
    }

    const body = await request.json() as any

    if (!body.answer_text?.trim()) {
      return new Response(JSON.stringify({ error: 'Answer text is required' }), {
        status: 400, headers: corsHeaders,
      })
    }

    const id = generatePrefixedId('rfia')
    const now = new Date().toISOString()

    await env.DB.prepare(`
      INSERT INTO cop_rfi_answers (id, rfi_id, answer_text, source_url, source_description, is_accepted, created_by, responder_name, created_at)
      VALUES (?, ?, ?, ?, ?, 0, NULL, ?, ?)
    `).bind(
      id, rfiId, body.answer_text.trim(),
      body.source_url || null, body.source_description || null,
      body.responder_name || 'Anonymous', now
    ).run()

    // Update RFI status to 'answered' if currently 'open' — scoped to session
    await env.DB.prepare(`
      UPDATE cop_rfis SET status = 'answered', updated_at = ? WHERE id = ? AND cop_session_id = ? AND status = 'open'
    `).bind(now, rfiId, shareSessionId).run()

    return new Response(JSON.stringify({ id, message: 'Answer submitted' }), {
      status: 201, headers: corsHeaders,
    })
  } catch (error) {
    console.error('[COP Public RFI API] Submit error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to submit answer',
    }), { status: 500, headers: corsHeaders })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: corsHeaders })
}

// Reject GET requests (POST-only endpoint)
export const onRequestGet: PagesFunction = async () => {
  return new Response(JSON.stringify({ error: 'Method not allowed. Use POST.' }), {
    status: 405, headers: JSON_HEADERS,
  })
}
