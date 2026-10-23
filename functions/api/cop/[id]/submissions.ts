/**
 * COP Submissions API - Triage Queue
 *
 * GET /api/cop/:id/submissions         - List submissions (optional ?status=pending&form_id=x).
 *                                         Who sent it (name, contact, their position, country and
 *                                         city) only for the owner or an editor/admin; null for viewers.
 * PUT /api/cop/:id/submissions         - Triage a submission (id in body; editors)
 *
 * Accepting a submission that has no evidence yet files it on the COP (unverified
 * evidence, a marker for an explicit location field, the form's tag) through the
 * same ingest as auto-ingest (functions/api/_shared/cop-ingest.ts), once.
 * Rejecting an auto-ingested submission takes what ingest created back off the COP.
 * A `linked_evidence_id` given by the caller must be evidence in this session's
 * workspace.
 */
import type { PagesFunction } from '@cloudflare/workers-types'
import { getUserFromRequest, verifyCopSessionAccess } from '../../_shared/auth-helpers'
import { emitCopEvent } from '../../_shared/cop-events'
import { INGEST_SUBMISSION_TRIAGED, INGEST_SUBMISSION_REJECTED } from '../../_shared/cop-event-types'
import { JSON_HEADERS } from '../../_shared/api-utils'
import { logEvent } from '../../_shared/event-log'
import { mayEditCopSession } from '../../_shared/cop-webcams'
import { ingestSubmission, retractAutoIngest } from '../../_shared/cop-ingest'
import { queryEvidenceInSession } from '../../_shared/cop-input'
import type { R2Like } from '../../_shared/cop-uploads'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
  JWT_SECRET?: string
  UPLOADS?: R2Like
}


export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params, request } = context
  const sessionId = params.id as string

  const userId = await getUserFromRequest(request, env)
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401, headers: JSON_HEADERS })
  }
  // Submissions (answers, inline photos) are for the session's owner and collaborators,
  // not any signed-in user who can open a public session.
  const accessWorkspaceId = await verifyCopSessionAccess(env.DB, sessionId, userId)
  if (!accessWorkspaceId) {
    return new Response(JSON.stringify({ error: 'Access denied' }), { status: 403, headers: JSON_HEADERS })
  }

  try {
    const url = new URL(request.url)
    const status = url.searchParams.get('status')
    const formId = url.searchParams.get('form_id')

    let query = `SELECT id, survey_id, form_data, submitter_name, submitter_contact,
             lat, lon, submitter_country, submitter_city, status,
             triaged_by, rejection_reason, cop_session_id, linked_evidence_id,
             created_at, updated_at
      FROM survey_responses WHERE cop_session_id = ?`
    const bindings: any[] = [sessionId]

    if (status) { query += ' AND status = ?'; bindings.push(status) }
    if (formId) { query += ' AND survey_id = ?'; bindings.push(formId) }

    query += ' ORDER BY created_at DESC LIMIT 200'

    const results = await env.DB.prepare(query).bind(...bindings).all()

    // Submitters' identity and whereabouts are for the people who triage, not viewers.
    const mayTriage = await mayEditCopSession(env.DB, sessionId, userId)
    const submissions = (results.results || []).map((row: Record<string, unknown>) => {
      let form_data = {}
      try { form_data = row.form_data ? JSON.parse(String(row.form_data)) : {} } catch { /* unreadable: empty */ }
      const submitter = mayTriage
        ? {}
        : { submitter_name: null, submitter_contact: null, lat: null, lon: null, submitter_country: null, submitter_city: null }
      return { ...row, ...submitter, form_data }
    })

    return new Response(JSON.stringify({ submissions }), { headers: JSON_HEADERS })
  } catch (error) {
    await logEvent(env, {
      level: 'error',
      source: 'cop/submissions',
      message: String(error instanceof Error ? error.message : error).slice(0, 500),
      context: { error: String(error) },
    })
    return new Response(JSON.stringify({ error: 'Failed to list submissions' }), {
      status: 500, headers: JSON_HEADERS,
    })
  }
}

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { env, params, request } = context
  const sessionId = params.id as string

  const userId = await getUserFromRequest(request, env)
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), {
      status: 401, headers: JSON_HEADERS,
    })
  }
  const workspaceId = await verifyCopSessionAccess(env.DB, sessionId, userId)
  if (!workspaceId || !(await mayEditCopSession(env.DB, sessionId, userId))) {
    return new Response(JSON.stringify({ error: 'Only the session owner or an editor can triage submissions' }), { status: 403, headers: JSON_HEADERS })
  }

  try {
    const body = await request.json() as any
    const subId = body.id

    if (!subId) {
      return new Response(JSON.stringify({ error: 'Submission ID required' }), {
        status: 400, headers: JSON_HEADERS,
      })
    }

    const existing = await env.DB.prepare(
      `SELECT id, survey_id, form_data, submitter_name, submitter_country,
              status, triaged_by, cop_session_id, linked_evidence_id, created_at
       FROM survey_responses WHERE id = ? AND cop_session_id = ?`
    ).bind(subId, sessionId).first() as any

    if (!existing) {
      return new Response(JSON.stringify({ error: 'Submission not found' }), {
        status: 404, headers: JSON_HEADERS,
      })
    }

    if (body.linked_evidence_id !== undefined && body.linked_evidence_id !== null) {
      const linked = String(body.linked_evidence_id)
      // The COP's own evidence, not anything else in its workspace.
      const inSession = await queryEvidenceInSession(
        env.DB,
        'SELECT 1 AS found FROM evidence_items WHERE CAST(id AS TEXT) = ? AND {EVIDENCE_SCOPE}',
        { sessionId, workspaceId },
        [linked],
        [],
        (statement) => statement.first(),
      )
      if (!inSession) {
        return new Response(JSON.stringify({ error: 'linked_evidence_id must be evidence in this COP' }), {
          status: 400, headers: JSON_HEADERS,
        })
      }
    }

    // Accept with nothing linked: file the submission on the COP (once).
    if (body.status === 'accepted' && !existing.linked_evidence_id && body.linked_evidence_id == null) {
      const ingested = await ingestSubmission(env, { responseId: subId, sessionId, actorUserId: userId, auto: false })
      if (ingested.ok === false) {
        return new Response(JSON.stringify({ error: ingested.error }), { status: ingested.status, headers: JSON_HEADERS })
      }
      return new Response(JSON.stringify({
        id: subId,
        message: 'Submission accepted',
        linked_evidence_id: ingested.evidenceId,
        linked_marker_id: ingested.markerId,
      }), { headers: JSON_HEADERS })
    }

    // Reject an auto-ingested submission: its evidence and marker come back off the COP.
    if (body.status === 'rejected') {
      await retractAutoIngest(env, { responseId: subId, sessionId, actorUserId: userId })
    }

    const updates: string[] = []
    const bindings: any[] = []

    const VALID_STATUSES = ['pending', 'triaged', 'accepted', 'rejected']
    if (body.status && VALID_STATUSES.includes(body.status)) {
      updates.push('status = ?'); bindings.push(body.status)
      updates.push('triaged_by = ?'); bindings.push(userId)
    }
    if (body.rejection_reason !== undefined) {
      updates.push('rejection_reason = ?'); bindings.push(body.rejection_reason === null ? null : String(body.rejection_reason).slice(0, 1000))
    }
    if (body.linked_evidence_id !== undefined) {
      updates.push('linked_evidence_id = ?'); bindings.push(body.linked_evidence_id === null ? null : String(body.linked_evidence_id))
    }
    if (updates.length === 0) {
      return new Response(JSON.stringify({ message: 'No changes' }), { headers: JSON_HEADERS })
    }

    updates.push("updated_at = datetime('now')")
    bindings.push(subId, sessionId)

    await env.DB.prepare(
      `UPDATE survey_responses SET ${updates.join(', ')} WHERE id = ? AND cop_session_id = ?`
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

    return new Response(JSON.stringify({ id: subId, message: 'Submission updated' }), { headers: JSON_HEADERS })
  } catch (error) {
    await logEvent(env, {
      level: 'error',
      source: 'cop/submissions',
      message: String(error instanceof Error ? error.message : error).slice(0, 500),
      context: { error: String(error) },
    })
    return new Response(JSON.stringify({ error: 'Failed to triage submission' }), {
      status: 500, headers: JSON_HEADERS,
    })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: JSON_HEADERS })
}
