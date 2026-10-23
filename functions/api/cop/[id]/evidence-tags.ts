/**
 * COP Evidence Tags API - List, Create, Delete
 *
 * GET    /api/cop/:id/evidence-tags?evidence_id=xxx - List tags for an evidence item
 * POST   /api/cop/:id/evidence-tags                 - Create a tag
 * DELETE  /api/cop/:id/evidence-tags?tag_id=xxx      - Remove a tag
 *
 * Every call is scoped to this COP's own evidence, in SQL (the session rule in
 * functions/api/_shared/cop-input.ts): any other evidence id, in this workspace or
 * another, is 404 (read) or refused (write), never touched. Writes need the session
 * owner or an editor/admin collaborator.
 */
import type { PagesFunction } from '@cloudflare/workers-types'
import { getUserFromRequest, verifyCopSessionAccess } from '../../_shared/auth-helpers'
import { emitCopEvent } from '../../_shared/cop-events'
import { EVIDENCE_TAGGED } from '../../_shared/cop-event-types'
import { generatePrefixedId , JSON_HEADERS } from '../../_shared/api-utils'
import { logEvent } from '../../_shared/event-log'
import { mayEditCopSession } from '../../_shared/cop-webcams'
import { queryEvidenceInSession, type EvidenceSessionScope } from '../../_shared/cop-input'

/** True when the evidence item is this COP session's own. */
async function evidenceInSession(db: D1Database, evidenceId: string, scope: EvidenceSessionScope): Promise<boolean> {
  const row = await queryEvidenceInSession(
    db, 'SELECT 1 AS found FROM evidence_items WHERE CAST(id AS TEXT) = ? AND {EVIDENCE_SCOPE}',
    scope, [evidenceId], [], (statement) => statement.first(),
  )
  return Boolean(row)
}

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
  JWT_SECRET?: string
}


export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const sessionId = params.id as string
  const url = new URL(request.url)
  const evidenceId = url.searchParams.get('evidence_id')

  const userId = await getUserFromRequest(request, env)
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401, headers: JSON_HEADERS })
  }
  const accessWorkspaceId = await verifyCopSessionAccess(env.DB, sessionId, userId, { readOnly: true })
  if (!accessWorkspaceId) {
    return new Response(JSON.stringify({ error: 'Access denied' }), { status: 403, headers: JSON_HEADERS })
  }

  try {
    if (!evidenceId) {
      return new Response(JSON.stringify({ error: 'evidence_id query parameter is required' }), {
        status: 400, headers: JSON_HEADERS,
      })
    }

    const scope = { sessionId, workspaceId: accessWorkspaceId }
    if (!(await evidenceInSession(env.DB, evidenceId, scope))) {
      return new Response(JSON.stringify({ error: 'Evidence not found' }), { status: 404, headers: JSON_HEADERS })
    }
    const tags = await queryEvidenceInSession(env.DB, `
      SELECT t.id, t.evidence_id, t.tag_category, t.tag_value, t.confidence, t.created_by, t.created_at
      FROM cop_evidence_tags t
      WHERE t.evidence_id = ?
        AND EXISTS (SELECT 1 FROM evidence_items e WHERE CAST(e.id AS TEXT) = t.evidence_id AND {EVIDENCE_SCOPE})
      ORDER BY t.tag_category, t.tag_value
    `, scope, [evidenceId], [], (statement) => statement.all(), 'e')

    return new Response(JSON.stringify({ tags: tags.results }), { headers: JSON_HEADERS })
  } catch (error) {
    await logEvent(env, {
      level: 'error',
      source: 'cop/evidence-tags',
      message: String(error instanceof Error ? error.message : error).slice(0, 500),
      context: { error: String(error) },
    })
    return new Response(JSON.stringify({
      error: 'Failed to list evidence tags',
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
    if (!workspaceId || !(await mayEditCopSession(env.DB, sessionId, userId))) {
      return new Response(JSON.stringify({ error: 'Only the session owner or an editor can tag evidence' }), { status: 403, headers: JSON_HEADERS })
    }
    const body = await request.json() as any

    if (!body.evidence_id?.trim()) {
      return new Response(JSON.stringify({ error: 'evidence_id is required' }), {
        status: 400, headers: JSON_HEADERS,
      })
    }

    if (!body.tag_category?.trim()) {
      return new Response(JSON.stringify({ error: 'tag_category is required' }), {
        status: 400, headers: JSON_HEADERS,
      })
    }

    if (!body.tag_value?.trim()) {
      return new Response(JSON.stringify({ error: 'tag_value is required' }), {
        status: 400, headers: JSON_HEADERS,
      })
    }

    if (typeof body.evidence_id !== 'string' || !(await evidenceInSession(env.DB, body.evidence_id.trim(), { sessionId, workspaceId }))) {
      return new Response(JSON.stringify({ error: 'Evidence not found' }), { status: 404, headers: JSON_HEADERS })
    }

    const id = generatePrefixedId('etg')
    const now = new Date().toISOString()
    const confidence = Math.min(Math.max(Number(body.confidence ?? 100) || 0, 0), 100)

    await env.DB.prepare(`
      INSERT INTO cop_evidence_tags (id, evidence_id, tag_category, tag_value, confidence, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(id, body.evidence_id.trim(), body.tag_category.trim(), body.tag_value.trim(), confidence, userId, now).run()

    await emitCopEvent(env.DB, {
      copSessionId: sessionId,
      eventType: EVIDENCE_TAGGED,
      entityType: 'evidence',
      entityId: body.evidence_id,
      payload: { tag_category: body.tag_category, tag_value: body.tag_value, confidence },
      createdBy: userId,
    })

    return new Response(JSON.stringify({ id, message: 'Evidence tag created' }), {
      status: 201, headers: JSON_HEADERS,
    })
  } catch (error) {
    await logEvent(env, {
      level: 'error',
      source: 'cop/evidence-tags',
      message: String(error instanceof Error ? error.message : error).slice(0, 500),
      context: { error: String(error) },
    })
    return new Response(JSON.stringify({
      error: 'Failed to create evidence tag',
    }), { status: 500, headers: JSON_HEADERS })
  }
}

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const sessionId = params.id as string
  const url = new URL(request.url)
  const tagId = url.searchParams.get('tag_id')

  try {
    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: JSON_HEADERS,
      })
    }
    const accessWorkspaceId = await verifyCopSessionAccess(env.DB, sessionId, userId)
    if (!accessWorkspaceId || !(await mayEditCopSession(env.DB, sessionId, userId))) {
      return new Response(JSON.stringify({ error: 'Only the session owner or an editor can remove tags' }), { status: 403, headers: JSON_HEADERS })
    }
    if (!tagId) {
      return new Response(JSON.stringify({ error: 'tag_id query parameter is required' }), {
        status: 400, headers: JSON_HEADERS,
      })
    }

    // Only delete if the tag belongs to evidence in this session's workspace
    await queryEvidenceInSession(env.DB, `
      DELETE FROM cop_evidence_tags WHERE id = ? AND EXISTS (
        SELECT 1 FROM evidence_items e WHERE CAST(e.id AS TEXT) = cop_evidence_tags.evidence_id AND {EVIDENCE_SCOPE}
      )
    `, { sessionId, workspaceId: accessWorkspaceId }, [tagId], [], (statement) => statement.run(), 'e')

    return new Response(JSON.stringify({ message: 'Evidence tag deleted' }), { headers: JSON_HEADERS })
  } catch (error) {
    await logEvent(env, {
      level: 'error',
      source: 'cop/evidence-tags',
      message: String(error instanceof Error ? error.message : error).slice(0, 500),
      context: { error: String(error) },
    })
    return new Response(JSON.stringify({
      error: 'Failed to delete evidence tag',
    }), { status: 500, headers: JSON_HEADERS })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: JSON_HEADERS })
}
