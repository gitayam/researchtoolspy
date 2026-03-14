/**
 * COP RFI Single Item API
 *
 * PUT /api/cop/:id/rfis/:rfiId - Update RFI (status, priority)
 */
import type { PagesFunction } from '@cloudflare/workers-types'
import { getUserFromRequest } from '../../../_shared/auth-helpers'
import { emitCopEvent } from '../../../_shared/cop-events'
import { RFI_ANSWERED, RFI_ACCEPTED, RFI_CLOSED } from '../../../_shared/cop-event-types'

interface Env {
  DB: D1Database
}

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash, X-Workspace-ID',
}

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const sessionId = params.id as string
  const rfiId = params.rfiId as string

  try {
    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: corsHeaders,
      })
    }
    const body = await request.json() as any
    const now = new Date().toISOString()

    // Fetch existing RFI — scoped to this session
    const existing = await env.DB.prepare(
      'SELECT status, question FROM cop_rfis WHERE id = ? AND cop_session_id = ?'
    ).bind(rfiId, sessionId).first() as any

    if (!existing) {
      return new Response(JSON.stringify({ error: 'RFI not found' }), {
        status: 404, headers: corsHeaders,
      })
    }

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

    values.push(rfiId)

    await env.DB.prepare(`
      UPDATE cop_rfis SET ${updates.join(', ')} WHERE id = ? AND cop_session_id = ?
    `).bind(...values, sessionId).run()

    // Emit event for status transitions
    if (body.status && existing && body.status !== existing.status) {
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

    return new Response(JSON.stringify({ message: 'RFI updated' }), { headers: corsHeaders })
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
