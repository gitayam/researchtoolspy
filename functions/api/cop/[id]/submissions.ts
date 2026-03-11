/**
 * COP Submissions API - Triage Queue
 *
 * GET /api/cop/:id/submissions         - List submissions (optional ?status=pending&form_id=x)
 * PUT /api/cop/:id/submissions         - Triage a submission (id in body)
 */
import type { PagesFunction } from '@cloudflare/workers-types'
import { getUserIdOrDefault } from '../../_shared/auth-helpers'
import { emitCopEvent } from '../../_shared/cop-events'
import { INGEST_SUBMISSION_TRIAGED, INGEST_SUBMISSION_REJECTED } from '../../_shared/cop-event-types'

interface Env {
  DB: D1Database
}

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash, X-Workspace-ID',
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params, request } = context
  const sessionId = params.id as string

  try {
    const url = new URL(request.url)
    const status = url.searchParams.get('status')
    const formId = url.searchParams.get('form_id')

    let query = 'SELECT * FROM cop_submissions WHERE cop_session_id = ?'
    const bindings: any[] = [sessionId]

    if (status) { query += ' AND status = ?'; bindings.push(status) }
    if (formId) { query += ' AND intake_form_id = ?'; bindings.push(formId) }

    query += ' ORDER BY created_at DESC LIMIT 200'

    const results = await env.DB.prepare(query).bind(...bindings).all()

    const submissions = (results.results || []).map((row: any) => {
      let form_data = {}
      try { form_data = row.form_data ? JSON.parse(row.form_data) : {} } catch { form_data = {} }
      return { ...row, form_data }
    })

    return new Response(JSON.stringify({ submissions }), { headers: corsHeaders })
  } catch (error) {
    console.error('[COP Submissions] List error:', error)
    return new Response(JSON.stringify({ error: 'Failed to list submissions' }), {
      status: 500, headers: corsHeaders,
    })
  }
}

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { env, params, request } = context
  const sessionId = params.id as string
  const userId = await getUserIdOrDefault(request, env)

  try {
    const body = await request.json() as any
    const subId = body.id

    if (!subId) {
      return new Response(JSON.stringify({ error: 'Submission ID required' }), {
        status: 400, headers: corsHeaders,
      })
    }

    const existing = await env.DB.prepare(
      'SELECT * FROM cop_submissions WHERE id = ? AND cop_session_id = ?'
    ).bind(subId, sessionId).first() as any

    if (!existing) {
      return new Response(JSON.stringify({ error: 'Submission not found' }), {
        status: 404, headers: corsHeaders,
      })
    }

    const updates: string[] = []
    const bindings: any[] = []

    const VALID_STATUSES = ['pending', 'triaged', 'accepted', 'rejected']
    if (body.status && VALID_STATUSES.includes(body.status)) {
      updates.push('status = ?'); bindings.push(body.status)
      updates.push('triaged_by = ?'); bindings.push(userId)
    }
    if (body.rejection_reason !== undefined) {
      updates.push('rejection_reason = ?'); bindings.push(body.rejection_reason)
    }
    if (body.linked_evidence_id !== undefined) {
      updates.push('linked_evidence_id = ?'); bindings.push(body.linked_evidence_id)
    }
    if (body.linked_task_id !== undefined) {
      updates.push('linked_task_id = ?'); bindings.push(body.linked_task_id)
    }

    if (updates.length === 0) {
      return new Response(JSON.stringify({ message: 'No changes' }), { headers: corsHeaders })
    }

    bindings.push(subId, sessionId)

    await env.DB.prepare(
      `UPDATE cop_submissions SET ${updates.join(', ')} WHERE id = ? AND cop_session_id = ?`
    ).bind(...bindings).run()

    // Emit event based on triage decision
    if (body.status === 'accepted' || body.status === 'triaged') {
      await emitCopEvent(env.DB, {
        copSessionId: sessionId,
        eventType: INGEST_SUBMISSION_TRIAGED,
        entityType: 'submission',
        entityId: subId,
        payload: {
          status: body.status,
          linked_evidence_id: body.linked_evidence_id || null,
          linked_task_id: body.linked_task_id || null,
        },
        createdBy: userId,
      })
    } else if (body.status === 'rejected') {
      await emitCopEvent(env.DB, {
        copSessionId: sessionId,
        eventType: INGEST_SUBMISSION_REJECTED,
        entityType: 'submission',
        entityId: subId,
        payload: { rejection_reason: body.rejection_reason || null },
        createdBy: userId,
      })
    }

    return new Response(JSON.stringify({ id: subId, message: 'Submission updated' }), { headers: corsHeaders })
  } catch (error) {
    console.error('[COP Submissions] Triage error:', error)
    return new Response(JSON.stringify({ error: 'Failed to triage submission' }), {
      status: 500, headers: corsHeaders,
    })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: corsHeaders })
}
