/**
 * COP RFI Answers API
 *
 * POST /api/cop/:id/rfis/:rfiId/answers - Submit answer
 * PUT  /api/cop/:id/rfis/:rfiId/answers - Accept/reject answer (body: { answer_id, is_accepted })
 */
import type { PagesFunction } from '@cloudflare/workers-types'
import { getUserIdOrDefault } from '../../../../_shared/auth-helpers'

interface Env {
  DB: D1Database
}

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash, X-Workspace-ID',
}

function generateId(): string {
  return `rfia-${crypto.randomUUID().slice(0, 12)}`
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const rfiId = params.rfiId as string

  try {
    const userId = await getUserIdOrDefault(request, env)
    const body = await request.json() as any

    if (!body.answer_text?.trim()) {
      return new Response(JSON.stringify({ error: 'Answer text is required' }), {
        status: 400, headers: corsHeaders,
      })
    }

    const id = generateId()
    const now = new Date().toISOString()

    await env.DB.prepare(`
      INSERT INTO cop_rfi_answers (id, rfi_id, answer_text, source_url, source_description, is_accepted, created_by, responder_name, created_at)
      VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)
    `).bind(
      id, rfiId, body.answer_text.trim(),
      body.source_url || null, body.source_description || null,
      userId, body.responder_name || null, now
    ).run()

    // Update RFI status to 'answered' if currently 'open'
    await env.DB.prepare(`
      UPDATE cop_rfis SET status = 'answered', updated_at = ? WHERE id = ? AND status = 'open'
    `).bind(now, rfiId).run()

    return new Response(JSON.stringify({ id, message: 'Answer submitted' }), {
      status: 201, headers: corsHeaders,
    })
  } catch (error) {
    console.error('[COP RFI Answers API] Submit error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to submit answer',
      details: error instanceof Error ? error.message : 'Unknown error',
    }), { status: 500, headers: corsHeaders })
  }
}

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const rfiId = params.rfiId as string

  try {
    const body = await request.json() as any
    const now = new Date().toISOString()

    if (!body.answer_id) {
      return new Response(JSON.stringify({ error: 'answer_id is required' }), {
        status: 400, headers: corsHeaders,
      })
    }

    const isAccepted = body.is_accepted ? 1 : 0

    // Clear other accepted answers first if accepting
    if (isAccepted) {
      await env.DB.prepare(`
        UPDATE cop_rfi_answers SET is_accepted = 0 WHERE rfi_id = ?
      `).bind(rfiId).run()
    }

    // Set this answer
    await env.DB.prepare(`
      UPDATE cop_rfi_answers SET is_accepted = ? WHERE id = ? AND rfi_id = ?
    `).bind(isAccepted, body.answer_id, rfiId).run()

    // Update RFI status
    const newStatus = isAccepted ? 'accepted' : 'answered'
    await env.DB.prepare(`
      UPDATE cop_rfis SET status = ?, updated_at = ? WHERE id = ?
    `).bind(newStatus, now, rfiId).run()

    return new Response(JSON.stringify({ message: 'Answer updated' }), { headers: corsHeaders })
  } catch (error) {
    console.error('[COP RFI Answers API] Accept error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to update answer',
      details: error instanceof Error ? error.message : 'Unknown error',
    }), { status: 500, headers: corsHeaders })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: corsHeaders })
}
