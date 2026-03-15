/**
 * COP Hypotheses API - CRUD for Analysis of Competing Hypotheses (ACH)
 *
 * GET  /api/cop/:id/hypotheses - List hypotheses for session (with evidence)
 * POST /api/cop/:id/hypotheses - Create hypothesis OR link evidence to hypothesis
 * PUT  /api/cop/:id/hypotheses - Update hypothesis status/confidence
 */
import type { PagesFunction } from '@cloudflare/workers-types'
import { getUserFromRequest, verifyCopSessionAccess } from '../../_shared/auth-helpers'
import { emitCopEvent } from '../../_shared/cop-events'
import { HYPOTHESIS_CREATED, HYPOTHESIS_UPDATED, HYPOTHESIS_EVIDENCE_LINKED } from '../../_shared/cop-event-types'
import { createTimelineEntry } from '../../_shared/timeline-helper'

interface Env {
  DB: D1Database
}

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash, X-Workspace-ID',
}

function generateHypId(): string {
  return `hyp-${crypto.randomUUID().slice(0, 12)}`
}

function generateEvidenceLinkId(): string {
  return `hev-${crypto.randomUUID().slice(0, 12)}`
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params } = context
  const sessionId = params.id as string

  const userId = await getUserFromRequest(context.request, context.env)
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401, headers: corsHeaders })
  }
  const accessWorkspaceId = await verifyCopSessionAccess(env.DB, sessionId, userId, { readOnly: true })
  if (!accessWorkspaceId) {
    return new Response(JSON.stringify({ error: 'Access denied' }), { status: 403, headers: corsHeaders })
  }

  try {
    const hypotheses = await env.DB.prepare(`
      SELECT * FROM cop_hypotheses WHERE cop_session_id = ? ORDER BY created_at DESC LIMIT 200
    `).bind(sessionId).all()

    // Fetch evidence links for all hypotheses
    const hypIds = (hypotheses.results || []).map((h: any) => h.id)
    let evidenceLinks: any[] = []
    if (hypIds.length > 0) {
      const placeholders = hypIds.map(() => '?').join(',')
      const evidenceResults = await env.DB.prepare(`
        SELECT * FROM cop_hypothesis_evidence WHERE hypothesis_id IN (${placeholders}) ORDER BY created_at ASC
      `).bind(...hypIds).all()
      evidenceLinks = evidenceResults.results
    }

    // Group evidence by hypothesis_id
    const evidenceByHyp: Record<string, any[]> = {}
    for (const ev of evidenceLinks) {
      const hypId = (ev as any).hypothesis_id
      if (!evidenceByHyp[hypId]) evidenceByHyp[hypId] = []
      evidenceByHyp[hypId].push(ev)
    }

    const enriched = (hypotheses.results || []).map((h: any) => ({
      ...h,
      evidence: evidenceByHyp[h.id] || [],
    }))

    return new Response(JSON.stringify({ hypotheses: enriched }), { headers: corsHeaders })
  } catch (error) {
    console.error('[COP Hypotheses API] List error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to list hypotheses',
    }), { status: 500, headers: corsHeaders })
  }
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const sessionId = params.id as string

  try {
    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: corsHeaders,
      })
    }
    const postWorkspaceId = await verifyCopSessionAccess(env.DB, sessionId, userId)
    if (!postWorkspaceId) {
      return new Response(JSON.stringify({ error: 'Access denied' }), { status: 403, headers: corsHeaders })
    }
    const body = await request.json() as any

    // If hypothesis_id is present, this is an "add evidence link" request
    if (body.hypothesis_id) {
      // Verify hypothesis belongs to this session
      const hyp = await env.DB.prepare(
        'SELECT id FROM cop_hypotheses WHERE id = ? AND cop_session_id = ?'
      ).bind(body.hypothesis_id, sessionId).first()
      if (!hyp) {
        return new Response(JSON.stringify({ error: 'Hypothesis not found in this session' }), {
          status: 404, headers: corsHeaders,
        })
      }

      if (!body.title?.trim()) {
        return new Response(JSON.stringify({ error: 'Evidence title is required' }), {
          status: 400, headers: corsHeaders,
        })
      }

      const id = generateEvidenceLinkId()
      const evType = ['supporting', 'contradicting'].includes(body.type) ? body.type : 'supporting'

      await env.DB.prepare(`
        INSERT INTO cop_hypothesis_evidence (id, hypothesis_id, evidence_id, title, type)
        VALUES (?, ?, ?, ?, ?)
      `).bind(id, body.hypothesis_id, body.evidence_id ?? null, body.title.trim(), evType).run()

      await emitCopEvent(env.DB, {
        copSessionId: sessionId,
        eventType: HYPOTHESIS_EVIDENCE_LINKED,
        entityType: 'hypothesis',
        entityId: body.hypothesis_id,
        payload: { evidence_link_id: id, evidence_id: body.evidence_id, title: body.title, type: evType },
        createdBy: userId,
      })

      return new Response(JSON.stringify({ id, message: 'Evidence linked to hypothesis' }), {
        status: 201, headers: corsHeaders,
      })
    }

    // Otherwise, create a new hypothesis
    if (!body.statement?.trim()) {
      return new Response(JSON.stringify({ error: 'Statement is required' }), {
        status: 400, headers: corsHeaders,
      })
    }

    const workspaceId = postWorkspaceId
    const id = generateHypId()
    const now = new Date().toISOString()
    const confidence = typeof body.confidence === 'number' ? Math.max(0, Math.min(100, body.confidence)) : 50

    await env.DB.prepare(`
      INSERT INTO cop_hypotheses (id, cop_session_id, statement, status, confidence, created_by, workspace_id, created_at, updated_at)
      VALUES (?, ?, ?, 'active', ?, ?, ?, ?, ?)
    `).bind(id, sessionId, body.statement.trim(), confidence, userId, workspaceId, now, now).run()

    await emitCopEvent(env.DB, {
      copSessionId: sessionId,
      eventType: HYPOTHESIS_CREATED,
      entityType: 'hypothesis',
      entityId: id,
      payload: { statement: body.statement, status: 'active', confidence },
      createdBy: userId,
    })

    try {
      await createTimelineEntry(env.DB, sessionId, workspaceId, userId, {
        title: `Hypothesis: ${body.statement?.substring(0, 160) || body.title?.substring(0, 160) || 'Untitled'}`,
        category: 'event',
        importance: 'high',
        source_type: 'system',
        entity_type: 'hypothesis',
        entity_id: id,
        action: 'created',
      })
    } catch (e) { console.error('[COP Hypotheses] Timeline entry failed:', e) }

    return new Response(JSON.stringify({ id, message: 'Hypothesis created' }), {
      status: 201, headers: corsHeaders,
    })
  } catch (error) {
    console.error('[COP Hypotheses API] Create error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to create hypothesis',
    }), { status: 500, headers: corsHeaders })
  }
}

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const sessionId = params.id as string

  try {
    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: corsHeaders,
      })
    }
    const putAccessId = await verifyCopSessionAccess(env.DB, sessionId, userId)
    if (!putAccessId) {
      return new Response(JSON.stringify({ error: 'Access denied' }), { status: 403, headers: corsHeaders })
    }
    const body = await request.json() as any

    if (!body.id) {
      return new Response(JSON.stringify({ error: 'Hypothesis id is required' }), {
        status: 400, headers: corsHeaders,
      })
    }

    const updates: string[] = []
    const values: any[] = []

    if (body.status && ['active', 'proven', 'disproven', 'archived'].includes(body.status)) {
      updates.push('status = ?')
      values.push(body.status)
    }

    if (typeof body.confidence === 'number') {
      updates.push('confidence = ?')
      values.push(Math.max(0, Math.min(100, body.confidence)))
    }

    if (updates.length === 0) {
      return new Response(JSON.stringify({ error: 'No valid fields to update' }), {
        status: 400, headers: corsHeaders,
      })
    }

    updates.push('updated_at = ?')
    values.push(new Date().toISOString())
    values.push(body.id)
    values.push(sessionId)

    const updateResult = await env.DB.prepare(`
      UPDATE cop_hypotheses SET ${updates.join(', ')} WHERE id = ? AND cop_session_id = ?
    `).bind(...values).run()

    if (!updateResult.meta.changes || updateResult.meta.changes === 0) {
      return new Response(JSON.stringify({ error: 'Hypothesis not found in this session' }), {
        status: 404, headers: corsHeaders,
      })
    }

    await emitCopEvent(env.DB, {
      copSessionId: sessionId,
      eventType: HYPOTHESIS_UPDATED,
      entityType: 'hypothesis',
      entityId: body.id,
      payload: { status: body.status, confidence: body.confidence },
      createdBy: userId,
    })

    return new Response(JSON.stringify({ message: 'Hypothesis updated' }), { headers: corsHeaders })
  } catch (error) {
    console.error('[COP Hypotheses API] Update error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to update hypothesis',
    }), { status: 500, headers: corsHeaders })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: corsHeaders })
}
