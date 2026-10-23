/**
 * COP Batch Evidence API - Create multiple evidence items in one request
 *
 * POST /api/cop/:id/evidence/batch - Insert up to 100 evidence items via D1 batch.
 *   A link already in the workspace (or earlier in the batch) is not saved twice: it is
 *   listed in `duplicates` with the existing item's id.
 */
import type { PagesFunction } from '@cloudflare/workers-types'
import { requireCopEditor } from '../../../_shared/auth-helpers'
import { JSON_HEADERS } from '../../../_shared/api-utils'
import { logEvent } from '../../../_shared/event-log'
import { copCallerUserId } from '../../../_shared/cop-caller'
import { emitCopEvent } from '../../../_shared/cop-events'
import { EVIDENCE_BATCH_CREATED } from '../../../_shared/cop-event-types'
import { canonicalUrl, copSourceChannel, copSourceRef, isMissingColumn, setProvenance } from '../../../_shared/cop-input'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
  JWT_SECRET?: string
}

const MAX_BATCH_SIZE = 100


interface EvidenceInput {
  title: string
  url?: string
  description?: string
  evidence_type?: string
  source_type?: string
}

async function getSessionWorkspaceId(db: D1Database, sessionId: string): Promise<string | null> {
  const row = await db.prepare(
    `SELECT workspace_id FROM cop_sessions WHERE id = ?`
  ).bind(sessionId).first<{ workspace_id: string }>()
  return row?.workspace_id ?? null
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
    if (!(await requireCopEditor(env.DB, sessionId, userId))) {
      return new Response(JSON.stringify({ error: 'Access denied' }), { status: 403, headers: JSON_HEADERS })
    }
    const workspaceId = await getSessionWorkspaceId(env.DB, sessionId)
    if (!workspaceId) {
      return new Response(JSON.stringify({ error: 'COP session not found' }), {
        status: 404, headers: JSON_HEADERS,
      })
    }

    const body = await request.json() as any

    if (!Array.isArray(body.items) || body.items.length === 0) {
      return new Response(JSON.stringify({ error: 'items array is required and must not be empty' }), {
        status: 400, headers: JSON_HEADERS,
      })
    }

    if (body.items.length > MAX_BATCH_SIZE) {
      return new Response(JSON.stringify({
        error: `Batch size exceeds maximum of ${MAX_BATCH_SIZE} items`,
      }), {
        status: 400, headers: JSON_HEADERS,
      })
    }

    // Validate all items have a title (and any link is http(s)) before inserting any
    const canonicals: (string | null)[] = []
    for (let i = 0; i < body.items.length; i++) {
      const item = body.items[i] as EvidenceInput
      if (!item.title?.trim()) {
        return new Response(JSON.stringify({
          error: `Item at index ${i} is missing a required title`,
        }), {
          status: 400, headers: JSON_HEADERS,
        })
      }
      const raw = typeof item.url === 'string' && item.url.trim() ? item.url.trim() : null
      const canonical = raw ? canonicalUrl(raw) : null
      if (raw && !canonical) {
        return new Response(JSON.stringify({ error: `Item at index ${i} has a link that is not http(s)` }), {
          status: 400, headers: JSON_HEADERS,
        })
      }
      canonicals.push(canonical)
    }

    // Links already in the workspace, and repeats inside this batch, are not saved again.
    const duplicates: { index: number; id: number | null }[] = []
    const seen = new Map<string, number>()
    const fresh: number[] = []
    for (let i = 0; i < body.items.length; i++) {
      const canonical = canonicals[i]
      if (!canonical) { fresh.push(i); continue }
      if (seen.has(canonical)) { duplicates.push({ index: i, id: null }); continue }
      seen.set(canonical, i)
      const raw = String((body.items[i] as EvidenceInput).url).trim()
      let existing: { id: number } | null
      try {
        existing = await env.DB.prepare(`
          SELECT id FROM evidence_items
          WHERE workspace_id = ? AND (canonical_url = ? OR (canonical_url IS NULL AND source_url IN (?, ?)))
          ORDER BY id ASC LIMIT 1
        `).bind(workspaceId, canonical, raw, canonical).first<{ id: number }>()
      } catch (error) {
        if (!isMissingColumn(error)) throw error
        existing = await env.DB.prepare(
          'SELECT id FROM evidence_items WHERE workspace_id = ? AND source_url IN (?, ?) ORDER BY id ASC LIMIT 1'
        ).bind(workspaceId, raw, canonical).first<{ id: number }>()
      }
      if (existing) duplicates.push({ index: i, id: Number(existing.id) })
      else fresh.push(i)
    }

    const now = new Date().toISOString()
    const channel = copSourceChannel(context)
    const ref = copSourceRef(context)
    const toInsert: EvidenceInput[] = fresh.map((i) => body.items[i])

    // Build prepared statements for D1 batch insert
    const statements = toInsert.map((item: EvidenceInput) => {
      return env.DB.prepare(`
        INSERT INTO evidence_items (
          title, description, source_url, evidence_type, confidence_level,
          credibility, reliability,
          status, workspace_id, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?, ?, ?)
      `).bind(
        item.title.trim(),
        (item.description ?? '').trim(),
        typeof item.url === 'string' && item.url.trim() ? item.url.trim() : null,
        item.source_type ?? 'observation',
        'medium',
        'unverified',
        'unknown',
        workspaceId,
        userId,
        now,
        now
      )
    })

    const results = statements.length ? await env.DB.batch(statements) : []

    for (let k = 0; k < results.length; k++) {
      const id = (results[k] as D1Result).meta?.last_row_id
      if (!id) continue
      await setProvenance(env.DB, 'evidence_items', id, channel, ref)
      const canonical = canonicals[fresh[k]]
      if (canonical) {
        try {
          await env.DB.prepare('UPDATE evidence_items SET canonical_url = ? WHERE id = ?').bind(canonical, id).run()
        } catch (error) {
          if (!isMissingColumn(error)) throw error
        }
      }
    }
    if (results.length) {
      await emitCopEvent(env.DB, {
        copSessionId: sessionId,
        eventType: EVIDENCE_BATCH_CREATED,
        entityType: 'evidence',
        payload: { created: results.length },
        createdBy: userId,
      })
    }

    // Build response items with auto-incremented IDs from each insert result
    const items = toInsert.map((item: EvidenceInput, i: number) => ({
      id: (results[i] as any).meta?.last_row_id ?? 0,
      title: item.title.trim(),
      url: item.url ?? null,
      description: (item.description ?? '').trim(),
      evidence_type: item.source_type ?? 'observation',
      credibility: 'unverified',
      reliability: 'unknown',
      workspace_id: workspaceId,
      created_by: userId,
      created_at: now,
    }))

    return new Response(JSON.stringify({
      created: items.length,
      items,
      duplicates,
    }), {
      status: 201, headers: JSON_HEADERS,
    })
  } catch (error) {
    await logEvent(env, {
      level: 'error',
      source: 'cop/evidence/batch',
      message: String(error instanceof Error ? error.message : error).slice(0, 500),
      context: { error: String(error) },
    })
    return new Response(JSON.stringify({
      error: 'Failed to create evidence batch',
    }), { status: 500, headers: JSON_HEADERS })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: JSON_HEADERS })
}

// Reject GET requests (POST-only endpoint)
export const onRequestGet: PagesFunction = async () => {
  return new Response(JSON.stringify({ error: 'Method not allowed. Use POST.' }), {
    status: 405, headers: JSON_HEADERS,
  })
}
