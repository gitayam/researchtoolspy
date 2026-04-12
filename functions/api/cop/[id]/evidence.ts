/**
 * COP Evidence API - List and Create (scoped to COP session's workspace)
 *
 * GET  /api/cop/:id/evidence - List evidence items for session's workspace
 * POST /api/cop/:id/evidence - Create new evidence item scoped to session's workspace
 */
import type { PagesFunction } from '@cloudflare/workers-types'
import { getUserFromRequest, verifyCopSessionAccess } from '../../_shared/auth-helpers'
import { emitCopEvent } from '../../_shared/cop-events'
import { EVIDENCE_CREATED } from '../../_shared/cop-event-types'
import { createTimelineEntry } from '../../_shared/timeline-helper'
import { JSON_HEADERS } from '../../_shared/api-utils'

interface Env {
  DB: D1Database
}


async function getSessionWorkspaceId(db: D1Database, sessionId: string): Promise<string | null> {
  const row = await db.prepare(
    `SELECT workspace_id FROM cop_sessions WHERE id = ?`
  ).bind(sessionId).first<{ workspace_id: string }>()
  return row?.workspace_id ?? null
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params } = context
  const sessionId = params.id as string

  const userId = await getUserFromRequest(context.request, context.env)
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401, headers: JSON_HEADERS })
  }
  const workspaceId = await verifyCopSessionAccess(env.DB, sessionId, userId, { readOnly: true })
  if (!workspaceId) {
    return new Response(JSON.stringify({ error: 'Access denied' }), { status: 403, headers: JSON_HEADERS })
  }

  try {

    const results = await env.DB.prepare(`
      SELECT * FROM evidence_items WHERE workspace_id = ? ORDER BY created_at DESC LIMIT 500
    `).bind(workspaceId).all()

    return new Response(JSON.stringify({ evidence: results.results }), { headers: JSON_HEADERS })
  } catch (error) {
    console.error('[COP Evidence API] List error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to list evidence',
    }), { status: 500, headers: JSON_HEADERS })
  }
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const sessionId = params.id as string

  try {
    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: JSON_HEADERS,
      })
    }
    const workspaceId = await verifyCopSessionAccess(env.DB, sessionId, userId)
    if (!workspaceId) {
      return new Response(JSON.stringify({ error: 'Access denied' }), { status: 403, headers: JSON_HEADERS })
    }

    const body = await request.json() as any

    if (!body.title?.trim()) {
      return new Response(JSON.stringify({ error: 'Title is required' }), {
        status: 400, headers: JSON_HEADERS,
      })
    }

    const now = new Date().toISOString()

    const ALLOWED_SOURCE_TYPES = ['observation', 'document', 'image', 'video', 'testimony', 'signal']
    const ALLOWED_CREDIBILITY = ['confirmed', 'probable', 'possible', 'doubtful', 'unverified']
    const sourceType = ALLOWED_SOURCE_TYPES.includes(body.source_type) ? body.source_type : 'observation'
    const credibility = ALLOWED_CREDIBILITY.includes(body.credibility) ? body.credibility : 'unverified'

    const result = await env.DB.prepare(`
      INSERT INTO evidence_items (
        title, description, source_url, evidence_type, confidence_level,
        credibility, reliability,
        status, workspace_id, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?, ?, ?)
    `).bind(
      body.title.trim(),
      (body.content ?? '').trim(),
      body.url ?? null,
      sourceType,
      body.confidence ?? 'medium',
      credibility,
      body.reliability ?? 'unknown',
      workspaceId,
      userId,
      now,
      now
    ).run()

    const id = result.meta?.last_row_id ?? 0

    await emitCopEvent(env.DB, {
      copSessionId: sessionId,
      eventType: EVIDENCE_CREATED,
      entityType: 'evidence',
      entityId: String(id),
      payload: { title: body.title, evidence_type: body.source_type ?? 'observation' },
      createdBy: userId,
    })

    try {
      await createTimelineEntry(env.DB, sessionId, workspaceId, userId, {
        title: `Evidence added: ${body.title?.substring(0, 160) || 'Untitled'}`,
        category: 'event',
        importance: 'normal',
        source_type: 'system',
        entity_type: 'evidence',
        entity_id: String(id),
        action: 'created',
      })
    } catch { /* non-fatal */ }

    return new Response(JSON.stringify({ id, message: 'Evidence created' }), {
      status: 201, headers: JSON_HEADERS,
    })
  } catch (error) {
    console.error('[COP Evidence API] Create error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to create evidence',
    }), { status: 500, headers: JSON_HEADERS })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: JSON_HEADERS })
}
