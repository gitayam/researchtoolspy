/**
 * COP RFI Answers API
 *
 * POST /api/cop/:id/rfis/:rfiId/answers - Submit answer
 * PUT  /api/cop/:id/rfis/:rfiId/answers - Accept/reject answer (body: { answer_id, is_accepted })
 */
import type { PagesFunction } from '@cloudflare/workers-types'
import { requireCopEditor } from '../../../../_shared/auth-helpers'
import { generatePrefixedId, JSON_HEADERS } from '../../../../_shared/api-utils'
import { logEvent } from '../../../../_shared/event-log'
import { copCallerUserId } from '../../../../_shared/cop-caller'
import { emitCopEvent } from '../../../../_shared/cop-events'
import { EVIDENCE_CREATED, RFI_ANSWERED, RFI_ANSWER_UPDATED } from '../../../../_shared/cop-event-types'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
  JWT_SECRET?: string
}


export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const sessionId = params.id as string
  const rfiId = params.rfiId as string

  try {
    const userId = await copCallerUserId(context)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: JSON_HEADERS,
      })
    }
    if (!(await requireCopEditor(env.DB, sessionId, userId))) {
      return new Response(JSON.stringify({ error: 'Access denied' }), {
        status: 403, headers: JSON_HEADERS,
      })
    }
    const body = await request.json() as any

    if (!body.answer_text?.trim()) {
      return new Response(JSON.stringify({ error: 'Answer text is required' }), {
        status: 400, headers: JSON_HEADERS,
      })
    }

    // Verify RFI belongs to this session
    const rfiCheck = await env.DB.prepare(
      'SELECT id FROM cop_rfis WHERE id = ? AND cop_session_id = ?'
    ).bind(rfiId, sessionId).first()
    if (!rfiCheck) {
      return new Response(JSON.stringify({ error: 'RFI not found' }), {
        status: 404, headers: JSON_HEADERS,
      })
    }

    const id = generatePrefixedId('rfia')
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
      await emitCopEvent(env.DB, {
        copSessionId: sessionId,
        eventType: EVIDENCE_CREATED,
        entityType: 'evidence',
        createdBy: userId,
      })
    } catch (err) {
      await logEvent(env, {
        level: 'error',
        source: 'cop/rfis/answers',
        message: String(err instanceof Error ? err.message : err).slice(0, 500),
        context: { error: String(err) },
      })
    }

    await emitCopEvent(env.DB, {
      copSessionId: sessionId,
      eventType: RFI_ANSWERED,
      entityType: 'rfi',
      entityId: rfiId,
      payload: { answer_id: id },
      createdBy: userId,
    })

    return new Response(JSON.stringify({ id, message: 'Answer submitted' }), {
      status: 201, headers: JSON_HEADERS,
    })
  } catch (error) {
    await logEvent(env, {
      level: 'error',
      source: 'cop/rfis/answers',
      message: String(error instanceof Error ? error.message : error).slice(0, 500),
      context: { error: String(error) },
    })
    return new Response(JSON.stringify({
      error: 'Failed to submit answer',
    }), { status: 500, headers: JSON_HEADERS })
  }
}

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const sessionId = params.id as string
  const rfiId = params.rfiId as string

  try {
    const userId = await copCallerUserId(context)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: JSON_HEADERS,
      })
    }
    if (!(await requireCopEditor(env.DB, sessionId, userId))) {
      return new Response(JSON.stringify({ error: 'Access denied' }), {
        status: 403, headers: JSON_HEADERS,
      })
    }
    const body = await request.json() as any
    const now = new Date().toISOString()

    if (!body.answer_id) {
      return new Response(JSON.stringify({ error: 'answer_id is required' }), {
        status: 400, headers: JSON_HEADERS,
      })
    }

    // Verify RFI belongs to this session
    const rfiCheck = await env.DB.prepare(
      'SELECT id FROM cop_rfis WHERE id = ? AND cop_session_id = ?'
    ).bind(rfiId, sessionId).first()
    if (!rfiCheck) {
      return new Response(JSON.stringify({ error: 'RFI not found' }), {
        status: 404, headers: JSON_HEADERS,
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

    await emitCopEvent(env.DB, {
      copSessionId: sessionId,
      eventType: RFI_ANSWER_UPDATED,
      entityType: 'rfi',
      entityId: rfiId,
      payload: { answer_id: body.answer_id ?? null, is_accepted: isAccepted === 1 },
      createdBy: userId,
    })

    return new Response(JSON.stringify({ message: 'Answer updated' }), { headers: JSON_HEADERS })
  } catch (error) {
    await logEvent(env, {
      level: 'error',
      source: 'cop/rfis/answers',
      message: String(error instanceof Error ? error.message : error).slice(0, 500),
      context: { error: String(error) },
    })
    return new Response(JSON.stringify({
      error: 'Failed to update answer',
    }), { status: 500, headers: JSON_HEADERS })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: JSON_HEADERS })
}

// Reject GET requests (POST-only endpoint)
export const onRequestGet: PagesFunction = async () => {
  return new Response(JSON.stringify({ error: 'Method not allowed. Use POST.' }), {
    status: 405, headers: JSON_HEADERS,
  })
}
