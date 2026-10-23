/**
 * COP Claims API — List, Create, Update, and Promote claims
 *
 * GET    /api/cop/:id/claims          - List all claims for session
 * POST   /api/cop/:id/claims          - Bulk-create claims from URL extraction
 * PUT    /api/cop/:id/claims          - Update claim status (verify/dispute/promote); claim_id in
 *                                       the body; optional if_updated_at / If-Match → 409 STALE_WRITE
 * DELETE /api/cop/:id/claims?claim_id= - Delete a claim (a service: only its own)
 */
import type { PagesFunction } from '@cloudflare/workers-types'
import { verifyCopSessionAccess, requireCopEditor } from '../../_shared/auth-helpers'
import { createTimelineEntry } from '../../_shared/timeline-helper'
import { generatePrefixedId , JSON_HEADERS } from '../../_shared/api-utils'
import { logEvent } from '../../_shared/event-log'
import { copCallerUserId } from '../../_shared/cop-caller'
import { emitCopEvent, emitCopEvents } from '../../_shared/cop-events'
import { CLAIM_CREATED, CLAIM_DELETED, CLAIM_EXTRACTED, CLAIM_UPDATED, EVIDENCE_CREATED } from '../../_shared/cop-event-types'
import {
  copSourceChannel, copSourceRef, expectedUpdatedAt, serviceChangeRefused, serviceDeleteRefused, serviceMayChange, serviceMayDelete, setEvidenceSession, setProvenance,
  staleWriteResponse,
} from '../../_shared/cop-input'

interface Env {
  DB: D1Database
}


// GET — list claims for a session
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params, request } = context
  const sessionId = params.id as string

  const userId = await copCallerUserId(context)
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401, headers: JSON_HEADERS })
  }
  const accessWorkspaceId = await verifyCopSessionAccess(env.DB, sessionId, userId, { readOnly: true })
  if (!accessWorkspaceId) {
    return new Response(JSON.stringify({ error: 'Access denied' }), { status: 403, headers: JSON_HEADERS })
  }

  const url = new URL(request.url)
  const status = url.searchParams.get('status')

  try {
    let query = `SELECT * FROM cop_claims WHERE cop_session_id = ?`
    const bindings: any[] = [sessionId]

    if (status) {
      query += ` AND status = ?`
      bindings.push(status)
    }

    query += ` ORDER BY created_at DESC LIMIT 500`

    const results = await env.DB.prepare(query).bind(...bindings).all()

    return new Response(JSON.stringify({ claims: results.results }), { headers: JSON_HEADERS })
  } catch (error) {
    await logEvent(env, {
      level: 'error',
      source: 'cop/claims',
      message: String(error instanceof Error ? error.message : error).slice(0, 500),
      context: { error: String(error) },
    })
    return new Response(JSON.stringify({ error: 'Failed to list claims' }), {
      status: 500, headers: JSON_HEADERS,
    })
  }
}

// POST — bulk-create claims from a URL extraction
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const sessionId = params.id as string

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

    if (!Array.isArray(body.claims) || body.claims.length === 0) {
      return new Response(JSON.stringify({ error: 'claims[] is required' }), {
        status: 400, headers: JSON_HEADERS,
      })
    }

    const claims = body.claims.slice(0, 100)

    // Look up session's workspace
    const session = await env.DB.prepare(
      `SELECT workspace_id FROM cop_sessions WHERE id = ?`
    ).bind(sessionId).first<{ workspace_id: string }>()
    const workspaceId = session?.workspace_id ?? sessionId

    const now = new Date().toISOString()
    const ids: string[] = []

    const stmts = claims.map((claim: any) => {
      const id = generatePrefixedId('clm')
      ids.push(id)
      return env.DB.prepare(`
        INSERT INTO cop_claims (id, cop_session_id, workspace_id, url, url_title, url_domain, claim_text, category, confidence, summary, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id, sessionId, workspaceId,
        body.url || null, body.title ?? null, body.domain ?? null,
        claim.claim ?? claim.text ?? '',
        claim.category ?? null,
        claim.confidence ?? 50,
        body.summary ?? null,
        userId, now, now,
      )
    })

    await env.DB.batch(stmts)
    const channel = copSourceChannel(context)
    const ref = copSourceRef(context)
    for (const id of ids) await setProvenance(env.DB, 'cop_claims', id, channel, ref)
    // The request's event, as before (playbooks trigger on it), then one claim.extracted
    // per claim with its id, which the chat feed reads and playbook triggers don't offer.
    await emitCopEvent(env.DB, {
      copSessionId: sessionId,
      eventType: CLAIM_CREATED,
      entityType: 'claim',
      entityId: ids.length === 1 ? ids[0] : null,
      payload: { count: ids.length },
      createdBy: userId,
    })
    await emitCopEvents(env.DB, ids.map((id) => ({
      copSessionId: sessionId,
      eventType: CLAIM_EXTRACTED,
      entityType: 'claim' as const,
      entityId: id,
      createdBy: userId,
    })))

    try {
      const domain = body.url ? new URL(body.url).hostname.replace(/^www\./, '') : 'unknown'
      await createTimelineEntry(env.DB, sessionId, workspaceId, userId, {
        title: `Extracted ${ids.length} claims from ${body.domain || domain}`,
        category: 'publication',
        importance: 'normal',
        source_type: 'system',
        entity_type: 'claim',
        entity_id: body.domain || domain,
        action: 'extracted',
      })
    } catch (e) { await logEvent(env, { level: 'error', source: 'cop/claims', message: String(e instanceof Error ? e.message : e).slice(0, 500), context: { error: String(e) } }) }

    return new Response(JSON.stringify({
      message: `${ids.length} claims saved`,
      ids,
    }), { status: 201, headers: JSON_HEADERS })
  } catch (error) {
    await logEvent(env, {
      level: 'error',
      source: 'cop/claims',
      message: String(error instanceof Error ? error.message : error).slice(0, 500),
      context: { error: String(error) },
    })
    return new Response(JSON.stringify({ error: 'Failed to save claims' }), {
      status: 500, headers: JSON_HEADERS,
    })
  }
}

// PUT — update a claim's status or promote to evidence
export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const sessionId = params.id as string

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
    const claimId = body.claim_id

    if (!claimId) {
      return new Response(JSON.stringify({ error: 'claim_id is required' }), {
        status: 400, headers: JSON_HEADERS,
      })
    }

    const session = await env.DB.prepare(
      `SELECT workspace_id FROM cop_sessions WHERE id = ?`
    ).bind(sessionId).first<{ workspace_id: string }>()
    const workspaceId = session?.workspace_id ?? sessionId

    const now = new Date().toISOString()

    const current = await env.DB.prepare('SELECT * FROM cop_claims WHERE id = ? AND cop_session_id = ?')
      .bind(claimId, sessionId).first<Record<string, unknown> & { status: string | null; updated_at: string }>()
    if (!current) {
      return new Response(JSON.stringify({ error: 'Claim not found in this session' }), {
        status: 404, headers: JSON_HEADERS,
      })
    }
    // A service (the bot's credential) changes only claims it created.
    if (!serviceMayChange(context, current.created_by)) return serviceChangeRefused()
    const expected = expectedUpdatedAt(request, body)
    if (expected && expected !== current.updated_at) return staleWriteResponse(current)

    // If promoting to evidence, create an evidence_item
    if (body.status === 'verified' && body.promote_to_evidence) {
      const claim = await env.DB.prepare(
        `SELECT * FROM cop_claims WHERE id = ? AND cop_session_id = ?`
      ).bind(claimId, sessionId).first<any>()

      if (!claim) {
        return new Response(JSON.stringify({ error: 'Claim not found' }), {
          status: 404, headers: JSON_HEADERS,
        })
      }

      // Create evidence item from verified claim
      const evidenceRes = await env.DB.prepare(`
        INSERT INTO evidence_items (
          title, description, source_url, source_classification,
          evidence_type, category, confidence_level, credibility, reliability,
          metadata, workspace_id, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, 'secondary', 'statement', 'verified_claim', 'high', '2', 'B', ?, ?, ?, ?, ?)
      `).bind(
        `Verified: ${claim.claim_text.substring(0, 100)}`,
        claim.claim_text,
        claim.url,
        JSON.stringify({
          cop_session_id: sessionId,
          cop_claim_id: claimId,
          origin: 'verified_claim',
        }),
        workspaceId,
        userId, now, now,
      ).run()

      const evidenceId = evidenceRes.meta?.last_row_id

      // Update claim with evidence link (only on the version the client read, when it sent one)
      try {
        const promoted = await env.DB.prepare(`
          UPDATE cop_claims SET status = 'verified', evidence_item_id = ?, updated_at = ?
          WHERE id = ? AND cop_session_id = ?${expected ? ' AND updated_at = ?' : ''}
        `).bind(evidenceId, now, claimId, sessionId, ...(expected ? [expected] : [])).run()

        if (!promoted.meta.changes) {
          throw new Error('Claim promotion update did not modify a row')
        }
      } catch (error) {
        await env.DB.prepare(
          'DELETE FROM evidence_items WHERE id = ? AND created_by = ?'
        ).bind(evidenceId, userId).run()
        if (expected) {
          const latest = await env.DB.prepare('SELECT * FROM cop_claims WHERE id = ? AND cop_session_id = ?')
            .bind(claimId, sessionId).first<Record<string, unknown> & { updated_at: string }>()
          if (latest && latest.updated_at !== expected) return staleWriteResponse(latest)
        }
        throw error
      }
      if (evidenceId) {
        await setEvidenceSession(env.DB, evidenceId, sessionId)
        await setProvenance(env.DB, 'evidence_items', evidenceId, copSourceChannel(context), copSourceRef(context))
      }
      await emitCopEvent(env.DB, { copSessionId: sessionId, eventType: CLAIM_UPDATED, entityType: 'claim', entityId: claimId, payload: { status: 'verified', promoted: true }, createdBy: userId })
      await emitCopEvent(env.DB, { copSessionId: sessionId, eventType: EVIDENCE_CREATED, entityType: 'evidence', entityId: evidenceId ? String(evidenceId) : null, createdBy: userId })

      try {
        await createTimelineEntry(env.DB, sessionId, workspaceId, userId, {
          title: `Claim verified: ${claim.claim_text.substring(0, 160)}`,
          category: 'legal',
          importance: 'high',
          source_type: 'system',
          entity_type: 'claim',
          entity_id: claimId,
          action: 'verified',
        })
      } catch { /* non-fatal */ }

      return new Response(JSON.stringify({
        message: 'Claim verified and promoted to evidence',
        evidence_item_id: evidenceId,
      }), { headers: JSON_HEADERS })
    }

    // Simple status update
    const validStatuses = ['unverified', 'verified', 'disputed', 'false']
    if (body.status && !validStatuses.includes(body.status)) {
      return new Response(JSON.stringify({ error: `status must be one of: ${validStatuses.join(', ')}` }), {
        status: 400, headers: JSON_HEADERS,
      })
    }

    const updateResult = await env.DB.prepare(`
      UPDATE cop_claims SET status = ?, updated_at = ?
      WHERE id = ? AND cop_session_id = ?${expected ? ' AND updated_at = ?' : ''}
    `).bind(body.status ?? current.status, now, claimId, sessionId, ...(expected ? [expected] : [])).run()

    if (!updateResult.meta.changes || updateResult.meta.changes === 0) {
      if (expected) {
        const latest = await env.DB.prepare('SELECT * FROM cop_claims WHERE id = ? AND cop_session_id = ?')
          .bind(claimId, sessionId).first()
        if (latest) return staleWriteResponse(latest)
      }
      return new Response(JSON.stringify({ error: 'Claim not found in this session' }), {
        status: 404, headers: JSON_HEADERS,
      })
    }
    await emitCopEvent(env.DB, { copSessionId: sessionId, eventType: CLAIM_UPDATED, entityType: 'claim', entityId: claimId, payload: { status: body.status ?? null }, createdBy: userId })

    if (body.status === 'verified' || body.status === 'disputed') {
      try {
        const claim = await env.DB.prepare(
          `SELECT claim_text FROM cop_claims WHERE id = ? AND cop_session_id = ?`
        ).bind(claimId, sessionId).first<{ claim_text: string }>()
        if (claim) {
          await createTimelineEntry(env.DB, sessionId, workspaceId, userId, {
            title: `Claim ${body.status}: ${claim.claim_text.substring(0, 160)}`,
            category: body.status === 'verified' ? 'legal' : 'event',
            importance: body.status === 'verified' ? 'high' : 'normal',
            source_type: 'system',
            entity_type: 'claim',
            entity_id: claimId,
            action: body.status,
          })
        }
      } catch (e) { await logEvent(env, { level: 'error', source: 'cop/claims', message: String(e instanceof Error ? e.message : e).slice(0, 500), context: { error: String(e) } }) }
    }

    return new Response(JSON.stringify({ message: 'Claim updated' }), { headers: JSON_HEADERS })
  } catch (error) {
    await logEvent(env, {
      level: 'error',
      source: 'cop/claims',
      message: String(error instanceof Error ? error.message : error).slice(0, 500),
      context: { error: String(error) },
    })
    return new Response(JSON.stringify({ error: 'Failed to update claim' }), {
      status: 500, headers: JSON_HEADERS,
    })
  }
}

// DELETE — remove a claim (?claim_id=); a service only removes claims it created
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const sessionId = params.id as string

  try {
    const userId = await copCallerUserId(context)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401, headers: JSON_HEADERS })
    }
    if (!(await requireCopEditor(env.DB, sessionId, userId))) {
      return new Response(JSON.stringify({ error: 'Access denied' }), { status: 403, headers: JSON_HEADERS })
    }
    const claimId = new URL(request.url).searchParams.get('claim_id')
    if (!claimId) {
      return new Response(JSON.stringify({ error: 'claim_id query parameter is required' }), { status: 400, headers: JSON_HEADERS })
    }
    const existing = await env.DB.prepare('SELECT id, created_by FROM cop_claims WHERE id = ? AND cop_session_id = ?')
      .bind(claimId, sessionId).first<{ id: string; created_by: string | null }>()
    if (!existing) {
      return new Response(JSON.stringify({ error: 'Claim not found in this session' }), { status: 404, headers: JSON_HEADERS })
    }
    if (!serviceMayDelete(context, existing.created_by)) return serviceDeleteRefused()
    await env.DB.prepare('DELETE FROM cop_claims WHERE id = ? AND cop_session_id = ?').bind(claimId, sessionId).run()
    await emitCopEvent(env.DB, { copSessionId: sessionId, eventType: CLAIM_DELETED, entityType: 'claim', entityId: claimId, createdBy: userId })
    return new Response(JSON.stringify({ message: 'Claim deleted' }), { headers: JSON_HEADERS })
  } catch (error) {
    await logEvent(env, {
      level: 'error',
      source: 'cop/claims',
      message: String(error instanceof Error ? error.message : error).slice(0, 500),
      context: { error: String(error) },
    })
    return new Response(JSON.stringify({ error: 'Failed to delete claim' }), { status: 500, headers: JSON_HEADERS })
  }
}

// OPTIONS — CORS preflight
export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: JSON_HEADERS })
}
