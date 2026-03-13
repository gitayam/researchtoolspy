/**
 * COP Evidence API - List and Create (scoped to COP session's workspace)
 *
 * GET  /api/cop/:id/evidence - List evidence items for session's workspace
 * POST /api/cop/:id/evidence - Create new evidence item scoped to session's workspace
 */
import type { PagesFunction } from '@cloudflare/workers-types'
import { getUserIdOrDefault } from '../../_shared/auth-helpers'
import { emitCopEvent } from '../../_shared/cop-events'
import { EVIDENCE_CREATED } from '../../_shared/cop-event-types'
import { createTimelineEntry } from '../../_shared/timeline-helper'

interface Env {
  DB: D1Database
}

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash, X-Workspace-ID',
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

  try {
    const workspaceId = await getSessionWorkspaceId(env.DB, sessionId)
    if (!workspaceId) {
      return new Response(JSON.stringify({ error: 'COP session not found' }), {
        status: 404, headers: corsHeaders,
      })
    }

    const results = await env.DB.prepare(`
      SELECT * FROM evidence_items WHERE workspace_id = ? ORDER BY created_at DESC
    `).bind(workspaceId).all()

    return new Response(JSON.stringify({ evidence: results.results }), { headers: corsHeaders })
  } catch (error) {
    console.error('[COP Evidence API] List error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to list evidence',
    }), { status: 500, headers: corsHeaders })
  }
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const sessionId = params.id as string

  try {
    const userId = await getUserIdOrDefault(request, env)
    const workspaceId = await getSessionWorkspaceId(env.DB, sessionId)
    if (!workspaceId) {
      return new Response(JSON.stringify({ error: 'COP session not found' }), {
        status: 404, headers: corsHeaders,
      })
    }

    const body = await request.json() as any

    if (!body.title?.trim()) {
      return new Response(JSON.stringify({ error: 'Title is required' }), {
        status: 400, headers: corsHeaders,
      })
    }

    const now = new Date().toISOString()

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
      body.source_type ?? 'observation',
      body.confidence ?? 'medium',
      body.credibility ?? 'unverified',
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
      status: 201, headers: corsHeaders,
    })
  } catch (error) {
    console.error('[COP Evidence API] Create error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to create evidence',
    }), { status: 500, headers: corsHeaders })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: corsHeaders })
}
