/**
 * COP Evidence API - List and Create (scoped to COP session's workspace)
 *
 * GET    /api/cop/:id/evidence          - List evidence items for session's workspace
 * POST   /api/cop/:id/evidence          - Create new evidence item scoped to session's workspace.
 *                                         A link already in the workspace (same canonical URL)
 *                                         answers 200 { evidence, duplicate: true } instead.
 * PUT    /api/cop/:id/evidence          - Update title, description, credibility, the archive
 *                                         reference (source_ref) and scan state (a service:
 *                                         only its own items)
 * DELETE /api/cop/:id/evidence?id=<id>  - Delete an evidence item (a service: only its own)
 *
 * `source_ref` from a caller is only ever an archive reference (silo:<id> or
 * peertube:<link>) and `scan_state` one of pending/clean/quarantined (cop-archive.ts);
 * neither reaches anyone outside the COP.
 */
import type { PagesFunction } from '@cloudflare/workers-types'
import { verifyCopSessionAccess, requireCopEditor } from '../../_shared/auth-helpers'
import { emitCopEvent } from '../../_shared/cop-events'
import { EVIDENCE_CREATED, EVIDENCE_DELETED, EVIDENCE_UPDATED } from '../../_shared/cop-event-types'
import { createTimelineEntry } from '../../_shared/timeline-helper'
import { JSON_HEADERS } from '../../_shared/api-utils'
import { logEvent } from '../../_shared/event-log'
import { copCallerUserId } from '../../_shared/cop-caller'
import {
  canonicalUrl, copSourceChannel, copSourceRef, isMissingColumn, maskTipEvidenceRow, queryEvidenceInSession,
  serviceChangeRefused, serviceDeleteRefused, serviceMayChange, serviceMayDelete, setEvidenceSession, setProvenance,
} from '../../_shared/cop-input'
import { archiveFields, cleanArchiveRef, cleanScanState, readMetadata, stripPrivateEvidenceFields } from '../../_shared/cop-archive'
import { deleteLinksOf, findDuplicateEvidence } from '../../_shared/cop-evidence-links'

interface Env {
  DB: D1Database
  COP_PEERTUBE_HOST?: string
}

const ALLOWED_CREDIBILITY = ['confirmed', 'probable', 'possible', 'doubtful', 'unverified']


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

    // This COP's evidence, not everything in its workspace (evidenceInSession).
    const results = await queryEvidenceInSession(
      env.DB,
      'SELECT * FROM evidence_items WHERE {EVIDENCE_SCOPE} ORDER BY created_at DESC LIMIT 500',
      { sessionId, workspaceId }, [], [],
      (statement) => statement.all<Record<string, unknown>>(),
    )
    // readOnly admits any signed-in reader of a public session: only the owner and
    // collaborators see unreviewed drop-form tips in full.
    // Archive references and scan states stay inside the COP too (cop-archive.ts).
    const collaborator = Boolean(await verifyCopSessionAccess(env.DB, sessionId, userId))
    const evidence = (results.results ?? []).map((row) => (collaborator
      ? { ...row, ...archiveFields(row) }
      : stripPrivateEvidenceFields(maskTipEvidenceRow(row))))

    return new Response(JSON.stringify({ evidence }), { headers: JSON_HEADERS })
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
      const duplicateId = await findDuplicateEvidence(env.DB, { sessionId, workspaceId }, rawUrl, canonical)
      if (duplicateId !== null) {
        const evidence = await evidenceRow(env.DB, duplicateId, workspaceId)
        return new Response(JSON.stringify({ id: duplicateId, evidence, duplicate: true, message: 'Evidence already saved' }), {
          status: 200, headers: JSON_HEADERS,
        })
      }
    }

    const archiveRef = cleanArchiveRef(body.source_ref, env)
    if (archiveRef.ok === false) return new Response(JSON.stringify({ error: archiveRef.error }), { status: 400, headers: JSON_HEADERS })
    const scanState = cleanScanState(body.scan_state)
    if (scanState.ok === false) return new Response(JSON.stringify({ error: scanState.error }), { status: 400, headers: JSON_HEADERS })

    const now = new Date().toISOString()

    const ALLOWED_SOURCE_TYPES = ['observation', 'document', 'image', 'video', 'audio', 'testimony', 'signal']
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
    await setEvidenceSession(env.DB, id, sessionId)
    // An archive reference (silo:/peertube:) takes the place of the client id.
    await setProvenance(env.DB, 'evidence_items', id, copSourceChannel(context), archiveRef.value ?? copSourceRef(context))
    if (scanState.value) {
      await env.DB.prepare('UPDATE evidence_items SET metadata = ? WHERE id = ?')
        .bind(JSON.stringify({ scan_state: scanState.value }), id).run()
    }
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

const MAX_TITLE = 300
const MAX_DESCRIPTION = 20_000

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const sessionId = params.id as string
  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: JSON_HEADERS })

  try {
    const userId = await copCallerUserId(context)
    if (!userId) return reply({ error: 'Authentication required' }, 401)
    const workspaceId = await requireCopEditor(env.DB, sessionId, userId)
    if (!workspaceId) return reply({ error: 'Access denied' }, 403)

    let body: Record<string, unknown>
    try {
      const parsed = await request.json()
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return reply({ error: 'Expected a JSON object' }, 400)
      body = parsed as Record<string, unknown>
    } catch {
      return reply({ error: 'Expected a JSON object' }, 400)
    }
    const rawId = String(body.id ?? '')
    if (!/^\d{1,15}$/.test(rawId)) return reply({ error: 'id is required' }, 400)

    const existing = await queryEvidenceInSession(
      env.DB,
      'SELECT id, created_by, metadata FROM evidence_items WHERE id = ? AND {EVIDENCE_SCOPE}',
      { sessionId, workspaceId }, [Number(rawId)], [],
      (statement) => statement.first<{ id: number; created_by: number; metadata: string | null }>(),
    )
    if (!existing) return reply({ error: 'Evidence not found' }, 404)
    if (!serviceMayChange(context, existing.created_by)) return serviceChangeRefused()

    const sets: string[] = []
    const binds: unknown[] = []
    if (body.title !== undefined) {
      const title = typeof body.title === 'string' ? body.title.trim() : ''
      if (!title || title.length > MAX_TITLE) return reply({ error: `title must be 1–${MAX_TITLE} characters` }, 400)
      sets.push('title = ?'); binds.push(title)
    }
    if (body.description !== undefined) {
      const description = typeof body.description === 'string' ? body.description.trim() : null
      if (description === null || description.length > MAX_DESCRIPTION) return reply({ error: 'description must be text' }, 400)
      sets.push('description = ?'); binds.push(description)
    }
    if (body.credibility !== undefined) {
      if (!ALLOWED_CREDIBILITY.includes(String(body.credibility))) return reply({ error: 'credibility is not valid' }, 400)
      sets.push('credibility = ?'); binds.push(body.credibility)
    }
    const archiveRef = cleanArchiveRef(body.source_ref, env)
    if (archiveRef.ok === false) return reply({ error: archiveRef.error }, 400)
    const scanState = cleanScanState(body.scan_state)
    if (scanState.ok === false) return reply({ error: scanState.error }, 400)
    if (scanState.value) {
      sets.push('metadata = ?'); binds.push(JSON.stringify({ ...readMetadata(existing.metadata), scan_state: scanState.value }))
    }
    if (sets.length === 0 && archiveRef.value === undefined) return reply({ error: 'No valid fields to update' }, 400)

    const now = new Date().toISOString()
    if (sets.length > 0) {
      sets.push('updated_at = ?'); binds.push(now)
      await env.DB.prepare(`UPDATE evidence_items SET ${sets.join(', ')} WHERE id = ? AND workspace_id = ?`)
        .bind(...binds, Number(rawId), workspaceId).run()
    }
    if (archiveRef.value !== undefined) {
      try {
        await env.DB.prepare('UPDATE evidence_items SET source_ref = ?, updated_at = ? WHERE id = ? AND workspace_id = ?')
          .bind(archiveRef.value ?? copSourceRef(context), now, Number(rawId), workspaceId).run()
      } catch (error) {
        if (!isMissingColumn(error)) throw error
        return reply({ error: 'Archive references are not available on this server yet' }, 503)
      }
    }

    await emitCopEvent(env.DB, {
      copSessionId: sessionId,
      eventType: EVIDENCE_UPDATED,
      entityType: 'evidence',
      entityId: rawId,
      createdBy: userId,
    })
    const evidence = await evidenceRow(env.DB, Number(rawId), workspaceId)
    return reply({ evidence })
  } catch (error) {
    await logEvent(env, {
      level: 'error',
      source: 'cop/evidence',
      message: String(error instanceof Error ? error.message : error).slice(0, 500),
      context: { error: String(error) },
    })
    return reply({ error: 'Failed to update evidence' }, 500)
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

    const query = new URL(request.url).searchParams
    const raw = query.get('id') ?? query.get('evidence_id') ?? ''
    if (!/^\d{1,15}$/.test(raw)) {
      return new Response(JSON.stringify({ error: 'id query parameter is required' }), { status: 400, headers: JSON_HEADERS })
    }
    const existing = await queryEvidenceInSession(
      env.DB,
      'SELECT id, created_by FROM evidence_items WHERE id = ? AND {EVIDENCE_SCOPE}',
      { sessionId, workspaceId }, [Number(raw)], [],
      (statement) => statement.first<{ id: number; created_by: number }>(),
    )
    if (!existing) {
      return new Response(JSON.stringify({ error: 'Evidence not found' }), { status: 404, headers: JSON_HEADERS })
    }
    if (!serviceMayDelete(context, existing.created_by)) return serviceDeleteRefused()

    const result = await env.DB.prepare('DELETE FROM evidence_items WHERE id = ? AND workspace_id = ?')
      .bind(Number(raw), workspaceId).run()
    if (!result.meta?.changes) {
      return new Response(JSON.stringify({ error: 'Evidence not found' }), { status: 404, headers: JSON_HEADERS })
    }
    // Its filings under questions and tasks go with it.
    await deleteLinksOf(env.DB, sessionId, { evidenceId: String(Number(raw)) })

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
