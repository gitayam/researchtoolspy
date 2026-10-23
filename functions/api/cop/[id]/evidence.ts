/**
 * COP Evidence API - List and Create (scoped to COP session's workspace)
 *
 * GET    /api/cop/:id/evidence          - List evidence items for session's workspace
 * POST   /api/cop/:id/evidence          - Create new evidence item scoped to session's workspace.
 *                                         A link already in the workspace (same canonical URL)
 *                                         answers 200 { evidence, duplicate: true } instead.
 * DELETE /api/cop/:id/evidence?id=<id>  - Delete an evidence item (a service: only its own)
 */
import type { PagesFunction } from '@cloudflare/workers-types'
import { verifyCopSessionAccess, requireCopEditor } from '../../_shared/auth-helpers'
import { emitCopEvent } from '../../_shared/cop-events'
import { EVIDENCE_CREATED, EVIDENCE_DELETED } from '../../_shared/cop-event-types'
import { createTimelineEntry } from '../../_shared/timeline-helper'
import { JSON_HEADERS } from '../../_shared/api-utils'
import { logEvent } from '../../_shared/event-log'
import { copCallerUserId } from '../../_shared/cop-caller'
import {
  canonicalUrl, copSourceChannel, copSourceRef, isMissingColumn, serviceDeleteRefused, serviceMayDelete, setProvenance,
} from '../../_shared/cop-input'

interface Env {
  DB: D1Database
}


/** The evidence fields a write answers with. */
const EVIDENCE_COLUMNS = 'id, title, description, source_url, evidence_type, credibility, reliability, ' +
  'confidence_level, status, created_at, updated_at'

async function evidenceRow(db: D1Database, id: number | string, workspaceId: string): Promise<Record<string, unknown> | null> {
  try {
    return await db.prepare(
      `SELECT ${EVIDENCE_COLUMNS}, source_channel, canonical_url FROM evidence_items WHERE id = ? AND workspace_id = ?`
    ).bind(id, workspaceId).first()
  } catch (error) {
    if (!isMissingColumn(error)) throw error
    return db.prepare(`SELECT ${EVIDENCE_COLUMNS} FROM evidence_items WHERE id = ? AND workspace_id = ?`)
      .bind(id, workspaceId).first()
  }
}

/**
 * The workspace's evidence item for the same link, if any: by canonical_url (migration
 * 0022), or, for items saved before it, by the exact link as given or canonical.
 */
async function findDuplicate(db: D1Database, workspaceId: string, raw: string, canonical: string): Promise<number | null> {
  try {
    const row = await db.prepare(`
      SELECT id FROM evidence_items
      WHERE workspace_id = ? AND (canonical_url = ? OR (canonical_url IS NULL AND source_url IN (?, ?)))
      ORDER BY id ASC LIMIT 1
    `).bind(workspaceId, canonical, raw, canonical).first<{ id: number }>()
    return row ? Number(row.id) : null
  } catch (error) {
    if (!isMissingColumn(error)) throw error
    const row = await db.prepare(
      'SELECT id FROM evidence_items WHERE workspace_id = ? AND source_url IN (?, ?) ORDER BY id ASC LIMIT 1'
    ).bind(workspaceId, raw, canonical).first<{ id: number }>()
    return row ? Number(row.id) : null
  }
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

  const userId = await copCallerUserId(context)
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
    await logEvent(env, {
      level: 'error',
      source: 'cop/evidence',
      message: String(error instanceof Error ? error.message : error).slice(0, 500),
      context: { error: String(error) },
    })
    return new Response(JSON.stringify({
      error: 'Failed to list evidence',
    }), { status: 500, headers: JSON_HEADERS })
  }
}

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
    const workspaceId = await requireCopEditor(env.DB, sessionId, userId)
    if (!workspaceId) {
      return new Response(JSON.stringify({ error: 'Access denied' }), { status: 403, headers: JSON_HEADERS })
    }

    const body = await request.json() as any

    if (!body.title?.trim()) {
      return new Response(JSON.stringify({ error: 'Title is required' }), {
        status: 400, headers: JSON_HEADERS,
      })
    }

    const rawUrl = typeof body.url === 'string' && body.url.trim() ? body.url.trim() : null
    const canonical = rawUrl ? canonicalUrl(rawUrl) : null
    if (rawUrl && !canonical) {
      return new Response(JSON.stringify({ error: 'url must be an http(s) link' }), {
        status: 400, headers: JSON_HEADERS,
      })
    }
    if (rawUrl && canonical) {
      const duplicateId = await findDuplicate(env.DB, workspaceId, rawUrl, canonical)
      if (duplicateId !== null) {
        const evidence = await evidenceRow(env.DB, duplicateId, workspaceId)
        return new Response(JSON.stringify({ id: duplicateId, evidence, duplicate: true, message: 'Evidence already saved' }), {
          status: 200, headers: JSON_HEADERS,
        })
      }
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
      rawUrl,
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
    await setProvenance(env.DB, 'evidence_items', id, copSourceChannel(context), copSourceRef(context))
    if (canonical) {
      try {
        await env.DB.prepare('UPDATE evidence_items SET canonical_url = ? WHERE id = ?').bind(canonical, id).run()
      } catch (error) {
        if (!isMissingColumn(error)) throw error
      }
    }

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

    const evidence = await evidenceRow(env.DB, id, workspaceId)
    return new Response(JSON.stringify({ id, evidence, message: 'Evidence created' }), {
      status: 201, headers: JSON_HEADERS,
    })
  } catch (error) {
    await logEvent(env, {
      level: 'error',
      source: 'cop/evidence',
      message: String(error instanceof Error ? error.message : error).slice(0, 500),
      context: { error: String(error) },
    })
    return new Response(JSON.stringify({
      error: 'Failed to create evidence',
    }), { status: 500, headers: JSON_HEADERS })
  }
}

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const sessionId = params.id as string

  try {
    const userId = await copCallerUserId(context)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401, headers: JSON_HEADERS })
    }
    const workspaceId = await requireCopEditor(env.DB, sessionId, userId)
    if (!workspaceId) {
      return new Response(JSON.stringify({ error: 'Access denied' }), { status: 403, headers: JSON_HEADERS })
    }

    const raw = new URL(request.url).searchParams.get('id') ?? ''
    if (!/^\d{1,15}$/.test(raw)) {
      return new Response(JSON.stringify({ error: 'id query parameter is required' }), { status: 400, headers: JSON_HEADERS })
    }
    const existing = await env.DB.prepare('SELECT id, created_by FROM evidence_items WHERE id = ? AND workspace_id = ?')
      .bind(Number(raw), workspaceId).first<{ id: number; created_by: number }>()
    if (!existing) {
      return new Response(JSON.stringify({ error: 'Evidence not found' }), { status: 404, headers: JSON_HEADERS })
    }
    if (!serviceMayDelete(context, existing.created_by)) return serviceDeleteRefused()

    const result = await env.DB.prepare('DELETE FROM evidence_items WHERE id = ? AND workspace_id = ?')
      .bind(Number(raw), workspaceId).run()
    if (!result.meta?.changes) {
      return new Response(JSON.stringify({ error: 'Evidence not found' }), { status: 404, headers: JSON_HEADERS })
    }

    await emitCopEvent(env.DB, {
      copSessionId: sessionId,
      eventType: EVIDENCE_DELETED,
      entityType: 'evidence',
      entityId: raw,
      createdBy: userId,
    })
    return new Response(JSON.stringify({ message: 'Evidence deleted' }), { headers: JSON_HEADERS })
  } catch (error) {
    await logEvent(env, {
      level: 'error',
      source: 'cop/evidence',
      message: String(error instanceof Error ? error.message : error).slice(0, 500),
      context: { error: String(error) },
    })
    return new Response(JSON.stringify({ error: 'Failed to delete evidence' }), { status: 500, headers: JSON_HEADERS })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: JSON_HEADERS })
}
