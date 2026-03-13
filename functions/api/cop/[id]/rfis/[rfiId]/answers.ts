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
  const sessionId = params.id as string
  const rfiId = params.rfiId as string

  try {
    const userId = await getUserIdOrDefault(request, env)
    const body = await request.json() as any

    if (!body.answer_text?.trim()) {
      return new Response(JSON.stringify({ error: 'Answer text is required' }), {
        status: 400, headers: corsHeaders,
      })
    }

    // Verify RFI belongs to this session
    const rfiCheck = await env.DB.prepare(
      'SELECT id FROM cop_rfis WHERE id = ? AND cop_session_id = ?'
    ).bind(rfiId, sessionId).first()
    if (!rfiCheck) {
      return new Response(JSON.stringify({ error: 'RFI not found' }), {
        status: 404, headers: corsHeaders,
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
      UPDATE cop_rfis SET status = 'answered', updated_at = ? WHERE id = ? AND cop_session_id = ? AND status = 'open'
    `).bind(now, rfiId, sessionId).run()

    // Auto-seed evidence item from RFI answer
    try {
      const rfi = await env.DB.prepare(
        `SELECT question FROM cop_rfis WHERE id = ?`
      ).bind(rfiId).first<{ question: string }>()
      const session = await env.DB.prepare(
        `SELECT workspace_id FROM cop_sessions WHERE id = ?`
      ).bind(sessionId).first<{ workspace_id: string }>()
      const workspaceId = session?.workspace_id ?? sessionId

      await env.DB.prepare(`
        INSERT INTO evidence_items (title, description, evidence_type, credibility, confidence_level, workspace_id, created_by, created_at, updated_at)
        VALUES (?, ?, 'rfi_answer', 'unverified', 'medium', ?, ?, ?, ?)
      `).bind(
        `RFI Answer: ${(rfi?.question ?? 'Unknown').substring(0, 80)}`,
        body.answer_text.trim(),
        workspaceId, userId, now, now,
      ).run()
    } catch (err) {
      console.error('[COP RFI Answers] Evidence seed failed (non-blocking):', err)
    }

    return new Response(JSON.stringify({ id, message: 'Answer submitted' }), {
      status: 201, headers: corsHeaders,
    })
  } catch (error) {
    console.error('[COP RFI Answers API] Submit error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to submit answer',
    }), { status: 500, headers: corsHeaders })
  }
}

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const sessionId = params.id as string
  const rfiId = params.rfiId as string

  try {
    const body = await request.json() as any
    const now = new Date().toISOString()

    if (!body.answer_id) {
      return new Response(JSON.stringify({ error: 'answer_id is required' }), {
        status: 400, headers: corsHeaders,
      })
    }

    // Verify RFI belongs to this session
    const rfiCheck = await env.DB.prepare(
      'SELECT id FROM cop_rfis WHERE id = ? AND cop_session_id = ?'
    ).bind(rfiId, sessionId).first()
    if (!rfiCheck) {
      return new Response(JSON.stringify({ error: 'RFI not found' }), {
        status: 404, headers: corsHeaders,
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

    // Update RFI status — scoped to session
    const newStatus = isAccepted ? 'accepted' : 'answered'
    await env.DB.prepare(`
      UPDATE cop_rfis SET status = ?, updated_at = ? WHERE id = ? AND cop_session_id = ?
    `).bind(newStatus, now, rfiId, sessionId).run()

    return new Response(JSON.stringify({ message: 'Answer updated' }), { headers: corsHeaders })
  } catch (error) {
    console.error('[COP RFI Answers API] Accept error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to update answer',
    }), { status: 500, headers: corsHeaders })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: corsHeaders })
}
