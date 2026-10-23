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
import { serviceChangeRefused, serviceMayChange, setEvidenceSession } from '../../../../_shared/cop-input'
import { copServiceCaller } from '../../../../_shared/cop-caller'

const MAX_ANSWER = 4000
const MAX_URL = 2000
const MAX_SOURCE_DESCRIPTION = 1000
const MAX_RESPONDER = 100
/** What a service (the Signal bot's !resolve) may send with an answer. */
const SERVICE_ANSWER_FIELDS = new Set(['answer_text', 'responder_name'])

const httpLink = (value: unknown): string | null => {
  if (typeof value !== 'string' || !value.trim() || value.length > MAX_URL) return null
  try {
    const url = new URL(value.trim())
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null
  } catch {
    return null
  }
}
const shortText = (value: unknown, max: number): string | null =>
  typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null

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
    const bad = (error: string) => new Response(JSON.stringify({ error }), { status: 400, headers: JSON_HEADERS })
    if (!body || typeof body !== 'object' || Array.isArray(body)) return bad('Expected a JSON object')

    if (typeof body.answer_text !== 'string' || !body.answer_text.trim()) return bad('Answer text is required')
    if (body.answer_text.trim().length > MAX_ANSWER) return bad(`Answers are limited to ${MAX_ANSWER} characters`)
    if (copServiceCaller(context.data)) {
      const extra = Object.keys(body).filter((key) => !SERVICE_ANSWER_FIELDS.has(key))
      if (extra.length > 0) return bad(`A service may only send answer_text and responder_name (not ${extra.join(', ')})`)
    }
    // Links are http(s) only: an answer's source is shown as a link to every reader.
    const sourceUrl = body.source_url === undefined || body.source_url === null || body.source_url === '' ? null : httpLink(body.source_url)
    if (body.source_url && !sourceUrl) return bad(`source_url must be an http(s) link of at most ${MAX_URL} characters`)

    // Verify RFI belongs to this session
    const rfiCheck = await env.DB.prepare(
      'SELECT id, created_by FROM cop_rfis WHERE id = ? AND cop_session_id = ?'
    ).bind(rfiId, sessionId).first<{ id: string; created_by: number | null }>()
    if (!rfiCheck) {
      return new Response(JSON.stringify({ error: 'RFI not found' }), {
        status: 404, headers: JSON_HEADERS,
      })
    }
    // A service (the Signal bot's !resolve) answers only the RFIs it created.
    if (!serviceMayChange(context, rfiCheck.created_by)) return serviceChangeRefused()

    const id = generatePrefixedId('rfia')
    const now = new Date().toISOString()

    await env.DB.prepare(`
      INSERT INTO cop_rfi_answers (id, rfi_id, answer_text, source_url, source_description, is_accepted, created_by, responder_name, created_at)
      VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)
    `).bind(
      id, rfiId, body.answer_text.trim(),
      sourceUrl, shortText(body.source_description, MAX_SOURCE_DESCRIPTION),
      userId, shortText(body.responder_name, MAX_RESPONDER), now
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

      const seeded = await env.DB.prepare(`
        INSERT INTO evidence_items (title, description, evidence_type, credibility, reliability, confidence_level, workspace_id, created_by, created_at, updated_at)
        VALUES (?, ?, 'rfi_answer', 'unverified', 'unknown', 'medium', ?, ?, ?, ?)
      `).bind(
        `RFI Answer: ${(rfi?.question ?? 'Unknown').substring(0, 80)}`,
        body.answer_text.trim(),
        workspaceId, userId, now, now,
      ).run()
      if (seeded.meta?.last_row_id) await setEvidenceSession(env.DB, seeded.meta.last_row_id, sessionId)
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
