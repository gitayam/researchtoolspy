/**
 * COP Public RFI Answer API
 *
 * POST /api/cop/public/:token/rfis/:rfiId/answers - Submit answer from public view
 */
import type { PagesFunction } from '@cloudflare/workers-types'
import { generatePrefixedId, JSON_HEADERS } from '../../../../../_shared/api-utils'
import { logEvent } from '../../../../../_shared/event-log'
import { sessionArchived, shareExpired, sharePanels } from '../../../../../_shared/cop-share'
import { emitCopEvent } from '../../../../../_shared/cop-events'
import { RFI_ANSWERED } from '../../../../../_shared/cop-event-types'
import { isMissingColumn } from '../../../../../_shared/cop-input'
import { takePublicSlot } from '../../../../../_shared/cop-public'
import type { KvLike } from '../../../../../_shared/kv-json'

interface Env {
  DB: D1Database
  CACHE?: KvLike
}

/** Answers per client address per 10 minutes through share links (anonymous writes). */
export const PUBLIC_ANSWERS_PER_WINDOW = 10
/**
 * Answers per share link per UTC hour, whoever sends them (migration 0028): the address
 * limit alone is beaten by rotating addresses, and these answers reach linked Signal rooms.
 */
export const SHARE_ANSWERS_PER_HOUR = 20

/**
 * One of the share's hourly answer slots, taken in one statement. 'ok', 'over', or
 * 'pending' while migration 0028 isn't applied (the address limit still applies).
 */
async function takeShareAnswerSlot(db: D1Database, shareId: string): Promise<'ok' | 'over' | 'pending'> {
  const hour = new Date().toISOString().slice(0, 13)
  try {
    const slot = await db.prepare(`
      INSERT INTO cop_share_answer_slots (share_id, hour, n) VALUES (?, ?, 1)
      ON CONFLICT (share_id, hour) DO UPDATE SET n = n + 1 WHERE n < ?
      RETURNING n
    `).bind(shareId, hour, SHARE_ANSWERS_PER_HOUR).first<{ n: number }>()
    return slot ? 'ok' : 'over'
  } catch (error) {
    if (/no such table:\s*(?:main\.)?cop_share_answer_slots/i.test(String(error instanceof Error ? error.message : error))) return 'pending'
    throw error
  }
}
const ANSWER_MAX = 4000
const URL_MAX = 2000
const NAME_MAX = 100
const SOURCE_DESCRIPTION_MAX = 1000

function httpLink(raw: unknown): string | null | 'invalid' {
  if (raw === undefined || raw === null || raw === '') return null
  if (typeof raw !== 'string' || raw.length > URL_MAX) return 'invalid'
  try {
    const url = new URL(raw.trim())
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : 'invalid'
  } catch {
    return 'invalid'
  }
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

    // The same rules as the public page: an expired link, one that shows neither the RFI
    // panel nor (for a key question) the questions panel, or an archived session takes
    // no answers.
    const panels = share ? sharePanels(share) : []
    if (!share || shareExpired(share) || (!panels.includes('rfi') && !panels.includes('questions'))) {
      return new Response(JSON.stringify({ error: 'Share not found or RFI answers not allowed' }), {
        status: 403, headers: JSON_HEADERS,
      })
    }

    const shareSessionId = (share as any).cop_session_id
    const session = await env.DB.prepare('SELECT status FROM cop_sessions WHERE id = ?')
      .bind(shareSessionId).first<{ status?: string }>()
    if (!session || sessionArchived(session)) {
      return new Response(JSON.stringify({ error: 'This COP session is no longer taking answers' }), {
        status: 410, headers: JSON_HEADERS,
      })
    }

    // Verify the RFI belongs to the share's session
    let rfiCheck: { id: string; is_key?: number } | null
    try {
      rfiCheck = await env.DB.prepare('SELECT id, is_key FROM cop_rfis WHERE id = ? AND cop_session_id = ?')
        .bind(rfiId, shareSessionId).first()
    } catch (error) {
      if (!isMissingColumn(error)) throw error
      rfiCheck = await env.DB.prepare('SELECT id FROM cop_rfis WHERE id = ? AND cop_session_id = ?')
        .bind(rfiId, shareSessionId).first()
    }
    if (!rfiCheck) {
      return new Response(JSON.stringify({ error: 'RFI not found' }), {
        status: 404, headers: JSON_HEADERS,
      })
    }
    // Through the questions panel alone, only key questions (starred RFIs) are shown.
    if (!panels.includes('rfi') && rfiCheck.is_key !== 1) {
      return new Response(JSON.stringify({ error: 'Share not found or RFI answers not allowed' }), {
        status: 403, headers: JSON_HEADERS,
      })
    }

    // Anonymous writes, counted after the link checks and before the body is read:
    // limited per client address, and refused when the count can't be kept.
    const slot = await takePublicSlot(env.CACHE, request, 'cop-public-answers', PUBLIC_ANSWERS_PER_WINDOW, 600)
    if (slot !== 'ok') {
      return new Response(JSON.stringify(slot === 'over'
        ? { error: 'Too many answers from this address; try again later', code: 'RATE_LIMITED' }
        : { error: 'Answers are unavailable right now', code: 'RATE_LIMIT_UNAVAILABLE' }), {
        status: slot === 'over' ? 429 : 503, headers: { ...JSON_HEADERS, 'Retry-After': '60' },
      })
    }

    const body = await request.json() as any

    if (typeof body.answer_text !== 'string' || !body.answer_text.trim()) {
      return new Response(JSON.stringify({ error: 'Answer text is required' }), {
        status: 400, headers: JSON_HEADERS,
      })
    }
    if (body.answer_text.trim().length > ANSWER_MAX) {
      return new Response(JSON.stringify({ error: `Answer text is limited to ${ANSWER_MAX} characters` }), {
        status: 400, headers: JSON_HEADERS,
      })
    }
    const sourceUrl = httpLink(body.source_url)
    if (sourceUrl === 'invalid') {
      return new Response(JSON.stringify({ error: `source_url must be an http(s) link of at most ${URL_MAX} characters` }), {
        status: 400, headers: JSON_HEADERS,
      })
    }
    const responderName = typeof body.responder_name === 'string' && body.responder_name.trim()
      ? body.responder_name.trim().slice(0, NAME_MAX) : 'Anonymous'
    const sourceDescription = typeof body.source_description === 'string' && body.source_description.trim()
      ? body.source_description.trim().slice(0, SOURCE_DESCRIPTION_MAX) : null

    // The share's hourly cap, counted only for answers that would be stored.
    const shareSlot = await takeShareAnswerSlot(env.DB, String((share as { id?: unknown }).id ?? token))
    if (shareSlot === 'over') {
      return new Response(JSON.stringify({ error: 'This link has taken all the answers it can for now; try again later', code: 'SHARE_RATE_LIMITED' }), {
        status: 429, headers: { ...JSON_HEADERS, 'Retry-After': '600' },
      })
    }
    if (shareSlot === 'pending') console.warn('[cop/public/rfis/answers] share answer cap off: migration 0028 not applied')

    const id = generatePrefixedId('rfia')
    const now = new Date().toISOString()

    // created_by is NOT NULL (default 1) in production: an anonymous answer leaves it to
    // the default and names its responder instead. An explicit NULL failed every answer.
    await env.DB.prepare(`
      INSERT INTO cop_rfi_answers (id, rfi_id, answer_text, source_url, source_description, is_accepted, responder_name, created_at)
      VALUES (?, ?, ?, ?, ?, 0, ?, ?)
    `).bind(
      id, rfiId, body.answer_text.trim(),
      sourceUrl, sourceDescription,
      responderName, now
    ).run()

    // Update RFI status to 'answered' if currently 'open' — scoped to session
    await env.DB.prepare(`
      UPDATE cop_rfis SET status = 'answered', updated_at = ? WHERE id = ? AND cop_session_id = ? AND status = 'open'
    `).bind(now, rfiId, shareSessionId).run()

    await emitCopEvent(env.DB, {
      copSessionId: shareSessionId,
      eventType: RFI_ANSWERED,
      entityType: 'rfi',
      entityId: rfiId,
      // An anonymous visitor's answer: created_by 0, never the share's creator (who may be
      // the Signal bot, whose own events the chat feed leaves out).
      payload: { via: 'share', answer_id: id },
      createdBy: 0,
    })

    return new Response(JSON.stringify({ id, message: 'Answer submitted' }), {
      status: 201, headers: JSON_HEADERS,
    })
  } catch (error) {
    await logEvent(env, {
      level: 'error',
      source: 'cop/public/rfis/answers',
      message: String(error instanceof Error ? error.message : error).slice(0, 500),
      context: { error: String(error) },
    })
    return new Response(JSON.stringify({
      error: 'Failed to submit answer',
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
