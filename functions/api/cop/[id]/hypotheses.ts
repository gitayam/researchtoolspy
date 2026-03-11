/**
 * COP Hypotheses API - CRUD for Analysis of Competing Hypotheses (ACH)
 *
 * GET  /api/cop/:id/hypotheses - List hypotheses for session (with evidence)
 * POST /api/cop/:id/hypotheses - Create hypothesis OR link evidence to hypothesis
 * PUT  /api/cop/:id/hypotheses - Update hypothesis status/confidence
 */
import type { PagesFunction } from '@cloudflare/workers-types'
import { getUserIdOrDefault } from '../../_shared/auth-helpers'
import { emitCopEvent } from '../../_shared/cop-events'
import { HYPOTHESIS_CREATED, HYPOTHESIS_UPDATED, HYPOTHESIS_EVIDENCE_LINKED } from '../../_shared/cop-event-types'

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

  try {
    const hypotheses = await env.DB.prepare(`
      SELECT * FROM cop_hypotheses WHERE cop_session_id = ? ORDER BY created_at DESC
    `).bind(sessionId).all()

    // Fetch evidence links for all hypotheses
    const hypIds = hypotheses.results.map((h: any) => h.id)
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

    const enriched = hypotheses.results.map((h: any) => ({
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
    const userId = await getUserIdOrDefault(request, env)
    const body = await request.json() as any

    // If hypothesis_id is present, this is an "add evidence link" request
    if (body.hypothesis_id) {
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

    // Look up workspace_id from the session
    const session = await env.DB.prepare(`
      SELECT workspace_id FROM cop_sessions WHERE id = ?
    `).bind(sessionId).first() as any

    const workspaceId = session?.workspace_id ?? '1'
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

    await env.DB.prepare(`
      UPDATE cop_hypotheses SET ${updates.join(', ')} WHERE id = ?
    `).bind(...values).run()

    const userId = await getUserIdOrDefault(request, env)
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
