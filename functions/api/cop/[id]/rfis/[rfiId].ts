/**
 * COP RFI Single Item API
 *
 * PUT    /api/cop/:id/rfis/:rfiId - Update RFI (status, priority, assignee, is_key star).
 *                                  Optional if_updated_at / If-Match → 409 STALE_WRITE.
 * DELETE /api/cop/:id/rfis/:rfiId - Delete RFI and its answers (a service: only its own)
 *
 * Starring an RFI (is_key) makes it a key question: the session's key_questions list is
 * rewritten from the starred RFIs.
 */
import type { PagesFunction } from '@cloudflare/workers-types'
import { requireCopEditor } from '../../../_shared/auth-helpers'
import { emitCopEvent } from '../../../_shared/cop-events'
import {
  RFI_ANSWERED, RFI_ACCEPTED, RFI_CLOSED, RFI_DELETED, RFI_STARRED, RFI_UNSTARRED, RFI_UPDATED,
} from '../../../_shared/cop-event-types'
import { JSON_HEADERS } from '../../../_shared/api-utils'
import { logEvent } from '../../../_shared/event-log'
import { copCallerUserId } from '../../../_shared/cop-caller'
import {
  expectedUpdatedAt, isMissingColumn, rewriteSessionKeyQuestions, serviceChangeRefused, serviceDeleteRefused,
  serviceMayChange, serviceMayDelete, staleWriteResponse,
} from '../../../_shared/cop-input'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
  JWT_SECRET?: string
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
      return new Response(JSON.stringify({ error: 'Access denied' }), { status: 403, headers: JSON_HEADERS })
    }
    const body = await request.json() as any
    const now = new Date().toISOString()

    // Fetch existing RFI — scoped to this session
    const existing = await env.DB.prepare(
      'SELECT * FROM cop_rfis WHERE id = ? AND cop_session_id = ?'
    ).bind(rfiId, sessionId).first() as any

    if (!existing) {
      return new Response(JSON.stringify({ error: 'RFI not found' }), {
        status: 404, headers: JSON_HEADERS,
      })
    }
    // A service (the Signal bot) may change only the RFIs it created.
    if (!serviceMayChange(context, existing.created_by)) return serviceChangeRefused()

    const expected = expectedUpdatedAt(request, body)
    if (expected && expected !== existing.updated_at) return staleWriteResponse(existing)

    const updates: string[] = ['updated_at = ?']
    const values: any[] = [now]

    if (body.status && ['open', 'answered', 'accepted', 'closed'].includes(body.status)) {
      updates.push('status = ?')
      values.push(body.status)
      // Auto-clear blocker flag when RFI is resolved
      if (body.status === 'answered' || body.status === 'closed') {
        updates.push('is_blocker = ?')
        values.push(0)
      }
    }
    if (body.priority && ['critical', 'high', 'medium', 'low'].includes(body.priority)) {
      updates.push('priority = ?')
      values.push(body.priority)
    }
    if (body.assigned_to !== undefined) {
      updates.push('assigned_to = ?')
      values.push(body.assigned_to)
    }
    const starChange = typeof body.is_key === 'boolean' && 'is_key' in existing && Boolean(existing.is_key) !== body.is_key
    if (typeof body.is_key === 'boolean' && !('is_key' in existing)) {
      return new Response(JSON.stringify({ error: 'Starring questions is not available yet' }), {
        status: 503, headers: JSON_HEADERS,
      })
    }
    if (starChange) {
      updates.push('is_key = ?')
      values.push(body.is_key ? 1 : 0)
    }

    // With a version from the client, the update only lands on that version.
    const updated = await env.DB.prepare(`
      UPDATE cop_rfis SET ${updates.join(', ')} WHERE id = ? AND cop_session_id = ?${expected ? ' AND updated_at = ?' : ''}
    `).bind(...values, rfiId, sessionId, ...(expected ? [expected] : [])).run()
    if (expected && !updated.meta?.changes) {
      const current = await env.DB.prepare('SELECT * FROM cop_rfis WHERE id = ? AND cop_session_id = ?')
        .bind(rfiId, sessionId).first()
      return staleWriteResponse(current)
    }

    await emitCopEvent(env.DB, {
      copSessionId: sessionId,
      eventType: RFI_UPDATED,
      entityType: 'rfi',
      entityId: rfiId,
      createdBy: userId,
    })
    if (starChange) {
      await emitCopEvent(env.DB, {
        copSessionId: sessionId,
        eventType: body.is_key ? RFI_STARRED : RFI_UNSTARRED,
        entityType: 'rfi',
        entityId: rfiId,
        createdBy: userId,
      })
      await rewriteSessionKeyQuestions(env.DB, sessionId, userId)
    }

    // Emit event for status transitions
    if (body.status && body.status !== existing.status) {
      const statusEventMap: Record<string, string> = {
        'answered': RFI_ANSWERED,
        'accepted': RFI_ACCEPTED,
        'closed': RFI_CLOSED,
      }
      const eventType = statusEventMap[body.status]
      if (eventType) {
        await emitCopEvent(env.DB, {
          copSessionId: sessionId,
          eventType: eventType as any,
          entityType: 'rfi',
          entityId: rfiId,
          payload: { question: existing.question, previous_status: existing.status, new_status: body.status },
          createdBy: userId,
        })
      }
    }

    const row = await env.DB.prepare('SELECT * FROM cop_rfis WHERE id = ? AND cop_session_id = ?')
      .bind(rfiId, sessionId).first()
    return new Response(JSON.stringify({ message: 'RFI updated', rfi: row }), { headers: JSON_HEADERS })
  } catch (error) {
    await logEvent(env, {
      level: 'error',
      source: 'cop/rfis',
      message: String(error instanceof Error ? error.message : error).slice(0, 500),
      context: { error: String(error) },
    })
    return new Response(JSON.stringify({
      error: 'Failed to update RFI',
    }), { status: 500, headers: JSON_HEADERS })
  }
}

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { env, params } = context
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
      return new Response(JSON.stringify({ error: 'Access denied' }), { status: 403, headers: JSON_HEADERS })
    }

    let existing: { created_by: number; is_key?: number } | null
    try {
      existing = await env.DB.prepare('SELECT created_by, is_key FROM cop_rfis WHERE id = ? AND cop_session_id = ?')
        .bind(rfiId, sessionId).first()
    } catch (error) {
      if (!isMissingColumn(error)) throw error
      existing = await env.DB.prepare('SELECT created_by FROM cop_rfis WHERE id = ? AND cop_session_id = ?')
        .bind(rfiId, sessionId).first()
    }
    if (!existing) {
      return new Response(JSON.stringify({ error: 'RFI not found' }), {
        status: 404, headers: JSON_HEADERS,
      })
    }
    if (!serviceMayDelete(context, existing.created_by)) return serviceDeleteRefused()

    // Delete answers first (child records)
    await env.DB.prepare(
      'DELETE FROM cop_rfi_answers WHERE rfi_id = ? AND rfi_id IN (SELECT id FROM cop_rfis WHERE cop_session_id = ?)'
    ).bind(rfiId, sessionId).run()

    // Delete the RFI itself — session-scoped
    const result = await env.DB.prepare(
      'DELETE FROM cop_rfis WHERE id = ? AND cop_session_id = ?'
    ).bind(rfiId, sessionId).run()

    if (!result.meta.changes || result.meta.changes === 0) {
      return new Response(JSON.stringify({ error: 'RFI not found' }), {
        status: 404, headers: JSON_HEADERS,
      })
    }

    await emitCopEvent(env.DB, {
      copSessionId: sessionId,
      eventType: RFI_DELETED,
      entityType: 'rfi',
      entityId: rfiId,
      createdBy: userId,
    })
    if (existing.is_key) await rewriteSessionKeyQuestions(env.DB, sessionId, userId)

    return new Response(JSON.stringify({ message: 'RFI deleted' }), { headers: JSON_HEADERS })
  } catch (error) {
    await logEvent(env, {
      level: 'error',
      source: 'cop/rfis',
      message: String(error instanceof Error ? error.message : error).slice(0, 500),
      context: { error: String(error) },
    })
    return new Response(JSON.stringify({
      error: 'Failed to delete RFI',
    }), { status: 500, headers: JSON_HEADERS })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: JSON_HEADERS })
}
