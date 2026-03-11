/**
 * COP RFI API - List and Create
 *
 * GET  /api/cop/:id/rfis - List RFIs for session (with answers)
 * POST /api/cop/:id/rfis - Create new RFI
 * PUT  /api/cop/:id/rfis - Update RFI (status, priority, answer)
 */
import type { PagesFunction } from '@cloudflare/workers-types'
import { getUserIdOrDefault } from '../../_shared/auth-helpers'
import { emitCopEvent } from '../../_shared/cop-events'
import { RFI_CREATED, RFI_ANSWERED, RFI_CLOSED } from '../../_shared/cop-event-types'

interface Env {
  DB: D1Database
}

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash, X-Workspace-ID',
}

function generateId(): string {
  return `rfi-${crypto.randomUUID().slice(0, 12)}`
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params } = context
  const sessionId = params.id as string

  try {
    const rfis = await env.DB.prepare(`
      SELECT * FROM cop_rfis WHERE cop_session_id = ? ORDER BY
        CASE priority
          WHEN 'critical' THEN 0
          WHEN 'high' THEN 1
          WHEN 'medium' THEN 2
          WHEN 'low' THEN 3
        END,
        created_at DESC
    `).bind(sessionId).all()

    // Fetch answers for each RFI
    const rfiIds = rfis.results.map((r: any) => r.id)
    let answers: any[] = []
    if (rfiIds.length > 0) {
      const placeholders = rfiIds.map(() => '?').join(',')
      const answerResults = await env.DB.prepare(`
        SELECT * FROM cop_rfi_answers WHERE rfi_id IN (${placeholders}) ORDER BY created_at ASC
      `).bind(...rfiIds).all()
      answers = answerResults.results
    }

    // Group answers by rfi_id
    const answersByRfi: Record<string, any[]> = {}
    for (const a of answers) {
      const rfiId = (a as any).rfi_id
      if (!answersByRfi[rfiId]) answersByRfi[rfiId] = []
      answersByRfi[rfiId].push(a)
    }

    const enriched = rfis.results.map((r: any) => ({
      ...r,
      answers: answersByRfi[r.id] || [],
    }))

    return new Response(JSON.stringify({ rfis: enriched }), { headers: corsHeaders })
  } catch (error) {
    console.error('[COP RFI API] List error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to list RFIs',
    }), { status: 500, headers: corsHeaders })
  }
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const sessionId = params.id as string

  try {
    const userId = await getUserIdOrDefault(request, env)
    const body = await request.json() as any

    if (!body.question?.trim()) {
      return new Response(JSON.stringify({ error: 'Question is required' }), {
        status: 400, headers: corsHeaders,
      })
    }

    const id = generateId()
    const now = new Date().toISOString()
    const priority = ['critical', 'high', 'medium', 'low'].includes(body.priority) ? body.priority : 'medium'
    const isBLocker = body.is_blocker ? 1 : 0

    await env.DB.prepare(`
      INSERT INTO cop_rfis (id, cop_session_id, question, priority, status, is_blocker, created_by, assigned_to, requester_name, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, ?)
    `).bind(id, sessionId, body.question.trim(), priority, isBLocker, userId, body.assigned_to ?? null, body.requester_name ?? null, now, now).run()

    await emitCopEvent(env.DB, {
      copSessionId: sessionId,
      eventType: RFI_CREATED,
      entityType: 'rfi',
      entityId: id,
      payload: { question: body.question, priority, is_blocker: !!body.is_blocker },
      createdBy: userId,
    })

    return new Response(JSON.stringify({ id, message: 'RFI created' }), {
      status: 201, headers: corsHeaders,
    })
  } catch (error) {
    console.error('[COP RFI API] Create error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to create RFI',
    }), { status: 500, headers: corsHeaders })
  }
}

// PUT - Update RFI status, priority, or add answer
export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const sessionId = params.id as string

  try {
    const body = await request.json() as any

    if (!body.id) {
      return new Response(JSON.stringify({ error: 'id is required' }), {
        status: 400, headers: corsHeaders,
      })
    }

    const now = new Date().toISOString()
    const sets: string[] = ['updated_at = ?']
    const vals: any[] = [now]

    if (body.status && ['open', 'answered', 'closed', 'blocked'].includes(body.status)) {
      sets.push('status = ?')
      vals.push(body.status)
      // Auto-clear blocker flag when RFI is resolved
      if (body.status === 'answered' || body.status === 'closed') {
        sets.push('is_blocker = ?')
        vals.push(0)
      }
    }
    if (body.priority && ['critical', 'high', 'medium', 'low'].includes(body.priority)) {
      sets.push('priority = ?')
      vals.push(body.priority)
    }
    if (body.is_blocker !== undefined && body.status !== 'answered' && body.status !== 'closed') {
      sets.push('is_blocker = ?')
      vals.push(body.is_blocker ? 1 : 0)
    }
    if (body.assigned_to !== undefined) {
      sets.push('assigned_to = ?')
      vals.push(body.assigned_to || null)
    }

    await env.DB.prepare(
      `UPDATE cop_rfis SET ${sets.join(', ')} WHERE id = ? AND cop_session_id = ?`
    ).bind(...vals, body.id, sessionId).run()

    // If an answer is provided, insert into cop_rfi_answers
    if (body.answer?.trim()) {
      const userId = await getUserIdOrDefault(request, env)
      const answerId = `rfa-${crypto.randomUUID().slice(0, 12)}`
      await env.DB.prepare(`
        INSERT INTO cop_rfi_answers (id, rfi_id, answer_text, source_description, created_by, responder_name, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(answerId, body.id, body.answer.trim(), body.source_description || null, userId, body.responder_name || null, now).run()
    }

    // Emit event for status transitions
    if (body.status) {
      const userId = await getUserIdOrDefault(request, env)
      const statusEventMap: Record<string, string> = {
        'answered': RFI_ANSWERED,
        'closed': RFI_CLOSED,
      }
      const eventType = statusEventMap[body.status]
      if (eventType) {
        await emitCopEvent(env.DB, {
          copSessionId: sessionId,
          eventType: eventType as any,
          entityType: 'rfi',
          entityId: body.id,
          payload: { new_status: body.status },
          createdBy: userId,
        })
      }
    }

    return new Response(JSON.stringify({ id: body.id, message: 'RFI updated' }), {
      headers: corsHeaders,
    })
  } catch (error) {
    console.error('[COP RFI API] Update error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to update RFI',
    }), { status: 500, headers: corsHeaders })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: corsHeaders })
}
