/**
 * COP Share API (owner or editor/admin collaborator; a service only on its own sessions)
 *
 * POST   /api/cop/:id/shares          - Create share link with panel config and allow_evidence
 * GET    /api/cop/:id/shares          - List existing share links
 * PATCH  /api/cop/:id/shares?token=   - Change a link's panels or allow_evidence
 * DELETE /api/cop/:id/shares?token=   - Delete a share link
 *
 * allow_evidence (managed migration 0022): the shared view offers the session's evidence
 * form (an active drop linked to the session), so viewers can submit evidence in place.
 */
import type { PagesFunction } from '@cloudflare/workers-types'
import { requireCopEditor, verifyCopSessionAccess } from '../../_shared/auth-helpers'
import { emitCopEvent } from '../../_shared/cop-events'
import { SHARE_CREATED, SHARE_DELETED, SHARE_UPDATED } from '../../_shared/cop-event-types'
import { generatePrefixedId , JSON_HEADERS } from '../../_shared/api-utils'
import { logEvent } from '../../_shared/event-log'
import { copCallerUserId, copServiceCaller } from '../../_shared/cop-caller'
import { isMissingColumn } from '../../_shared/cop-input'

/** The panels a share link may show. 'evidence' lists the session's evidence (opt-in). */
export const SHARE_PANELS = ['map', 'event', 'claims', 'rfi', 'questions', 'network', 'cams', 'evidence'] as const

function sharePanelList(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null
  const panels = raw.filter((p): p is string => typeof p === 'string' && (SHARE_PANELS as readonly string[]).includes(p))
  const unique = [...new Set(panels)]
  // Always include map
  if (!unique.includes('map')) unique.unshift('map')
  return unique
}

function denied(): Response {
  return new Response(JSON.stringify({ error: 'Only the session owner or an editor can manage share links' }), {
    status: 403, headers: JSON_HEADERS,
  })
}

interface Env {
  DB: D1Database
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
    // Verify user has access to this session (owner or collaborator)
    const workspaceId = await verifyCopSessionAccess(env.DB, sessionId, userId)
    if (!workspaceId) {
      return new Response(JSON.stringify({ error: 'Access denied' }), {
        status: 403, headers: JSON_HEADERS,
      })
    }

    // A share link publishes the session to anyone holding it. Only the owner or an
    // editor/admin collaborator may create one; a service only on its own sessions.
    const owner = await env.DB.prepare('SELECT created_by FROM cop_sessions WHERE id = ?')
      .bind(sessionId).first<{ created_by: number | null }>()
    let mayShare = owner?.created_by != null && String(owner.created_by) === String(userId)
    if (!mayShare && !copServiceCaller(context.data)) {
      const collaborator = await env.DB.prepare(
        'SELECT role FROM cop_collaborators WHERE cop_session_id = ? AND user_id = ?'
      ).bind(sessionId, userId).first<{ role: string | null }>()
      const role = String(collaborator?.role ?? '').toLowerCase()
      mayShare = role === 'editor' || role === 'admin'
    }
    if (!mayShare) {
      return new Response(JSON.stringify({ error: 'Only the session owner or an editor can create share links' }), {
        status: 403, headers: JSON_HEADERS,
      })
    }

    const body = await request.json() as any

    const id = generatePrefixedId('cops')
    const token = crypto.randomUUID()
    const now = new Date().toISOString()

    const visiblePanels = sharePanelList(body.visible_panels) ?? ['map', 'event']
    const allowEvidence = body.allow_evidence === true

    // Optional expiry: ISO 8601, in the future, at most a year away. The column
    // comes from managed migration 0019; until it is applied, a request that asks for an
    // expiry is refused rather than given a link that never expires.
    let expiresAt: string | null = null
    if (body.expires_at !== undefined && body.expires_at !== null) {
      const at = typeof body.expires_at === 'string' ? Date.parse(body.expires_at) : Number.NaN
      const nowMs = Date.now()
      if (!Number.isFinite(at) || at <= nowMs || at > nowMs + 366 * 24 * 60 * 60 * 1000) {
        return new Response(JSON.stringify({ error: 'expires_at must be a future date within a year' }), {
          status: 400, headers: JSON_HEADERS,
        })
      }
      expiresAt = new Date(at).toISOString()
    }

    if (expiresAt) {
      try {
        await env.DB.prepare(`
          INSERT INTO cop_shares (id, cop_session_id, share_token, visible_panels, allow_rfi_answers, created_by, created_at, view_count, expires_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
        `).bind(
          id, sessionId, token,
          JSON.stringify(visiblePanels),
          body.allow_rfi_answers ? 1 : 0,
          userId, now, expiresAt
        ).run()
      } catch (insertError) {
        if (/no such column|has no column named/i.test(String(insertError))) {
          return new Response(JSON.stringify({ error: 'Share link expiry is not available yet' }), {
            status: 503, headers: JSON_HEADERS,
          })
        }
        throw insertError
      }
    } else {
      await env.DB.prepare(`
        INSERT INTO cop_shares (id, cop_session_id, share_token, visible_panels, allow_rfi_answers, created_by, created_at, view_count)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0)
      `).bind(
        id, sessionId, token,
        JSON.stringify(visiblePanels),
        body.allow_rfi_answers ? 1 : 0,
        userId, now
      ).run()
    }

    if (allowEvidence) {
      try {
        await env.DB.prepare('UPDATE cop_shares SET allow_evidence = 1 WHERE id = ? AND cop_session_id = ?')
          .bind(id, sessionId).run()
      } catch (error) {
        if (!isMissingColumn(error)) throw error
        // Before migration 0022 the link works, without the evidence form.
        await env.DB.prepare('DELETE FROM cop_shares WHERE id = ? AND cop_session_id = ?').bind(id, sessionId).run()
        return new Response(JSON.stringify({ error: 'Evidence submission through share links is not available yet' }), {
          status: 503, headers: JSON_HEADERS,
        })
      }
    }

    await emitCopEvent(env.DB, {
      copSessionId: sessionId,
      eventType: SHARE_CREATED,
      entityType: 'share',
      entityId: id,
      payload: { visible_panels: visiblePanels, allow_rfi_answers: !!body.allow_rfi_answers, allow_evidence: allowEvidence, expires_at: expiresAt },
      createdBy: userId,
    })

    return new Response(JSON.stringify({
      id,
      share_token: token,
      url: `/public/cop/${token}`,
      visible_panels: visiblePanels,
      allow_evidence: allowEvidence,
      expires_at: expiresAt,
      message: 'Share link created',
    }), { status: 201, headers: JSON_HEADERS })
  } catch (error) {
    await logEvent(env, {
      level: 'error',
      source: 'cop/shares',
      message: String(error instanceof Error ? error.message : error).slice(0, 500),
      context: { error: String(error) },
    })
    return new Response(JSON.stringify({
      error: 'Failed to create share link',
    }), { status: 500, headers: JSON_HEADERS })
  }
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params } = context
  const sessionId = params.id as string

  try {
    const userId = await copCallerUserId(context)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: JSON_HEADERS,
      })
    }

    // Share tokens are capability URLs: only those who may create links may list them.
    if (!(await requireCopEditor(env.DB, sessionId, userId))) return denied()

    const results = await env.DB.prepare(`
      SELECT * FROM cop_shares WHERE cop_session_id = ? ORDER BY created_at DESC
    `).bind(sessionId).all()

    const shares = (results.results || []).map((r: any) => ({
      ...r,
      visible_panels: JSON.parse(r.visible_panels || '["map"]'),
      allow_evidence: r.allow_evidence === 1,
    }))

    return new Response(JSON.stringify({ shares }), { headers: JSON_HEADERS })
  } catch (error) {
    await logEvent(env, {
      level: 'error',
      source: 'cop/shares',
      message: String(error instanceof Error ? error.message : error).slice(0, 500),
      context: { error: String(error) },
    })
    return new Response(JSON.stringify({
      error: 'Failed to list share links',
    }), { status: 500, headers: JSON_HEADERS })
  }
}

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const sessionId = params.id as string

  try {
    const userId = await copCallerUserId(context)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: JSON_HEADERS,
      })
    }

    const url = new URL(request.url)
    const shareToken = url.searchParams.get('token')
    if (!shareToken) {
      return new Response(JSON.stringify({ error: 'token query parameter required' }), {
        status: 400, headers: JSON_HEADERS,
      })
    }

    // Verify share exists, belongs to this session, and user is owner/collaborator
    const share = await env.DB.prepare(
      'SELECT id FROM cop_shares WHERE share_token = ? AND cop_session_id = ?'
    ).bind(shareToken, sessionId).first<{ id: string }>()

    if (!share) {
      return new Response(JSON.stringify({ error: 'Share not found in this session' }), {
        status: 404, headers: JSON_HEADERS,
      })
    }

    if (!(await requireCopEditor(env.DB, sessionId, userId))) return denied()

    await env.DB.prepare(
      'DELETE FROM cop_shares WHERE share_token = ? AND cop_session_id = ?'
    ).bind(shareToken, sessionId).run()

    await emitCopEvent(env.DB, {
      copSessionId: sessionId,
      eventType: SHARE_DELETED,
      entityType: 'share',
      entityId: share.id,
      createdBy: userId,
    })
    return new Response(JSON.stringify({ message: 'Share link deleted' }), { headers: JSON_HEADERS })
  } catch (error) {
    await logEvent(env, {
      level: 'error',
      source: 'cop/shares',
      message: String(error instanceof Error ? error.message : error).slice(0, 500),
      context: { error: String(error) },
    })
    return new Response(JSON.stringify({
      error: 'Failed to delete share link',
    }), { status: 500, headers: JSON_HEADERS })
  }
}

export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const sessionId = params.id as string

  try {
    const userId = await copCallerUserId(context)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401, headers: JSON_HEADERS })
    }
    if (!(await requireCopEditor(env.DB, sessionId, userId))) return denied()

    const shareToken = new URL(request.url).searchParams.get('token')
    if (!shareToken) {
      return new Response(JSON.stringify({ error: 'token query parameter required' }), { status: 400, headers: JSON_HEADERS })
    }
    const share = await env.DB.prepare('SELECT id FROM cop_shares WHERE share_token = ? AND cop_session_id = ?')
      .bind(shareToken, sessionId).first<{ id: string }>()
    if (!share) {
      return new Response(JSON.stringify({ error: 'Share not found in this session' }), { status: 404, headers: JSON_HEADERS })
    }

    let body: { visible_panels?: unknown; allow_rfi_answers?: unknown; allow_evidence?: unknown }
    try {
      body = await request.json()
    } catch {
      return new Response(JSON.stringify({ error: 'Expected a JSON body' }), { status: 400, headers: JSON_HEADERS })
    }
    const sets: string[] = []
    const values: unknown[] = []
    const panels = body.visible_panels === undefined ? null : sharePanelList(body.visible_panels)
    if (body.visible_panels !== undefined && !panels) {
      return new Response(JSON.stringify({ error: 'visible_panels must be a list' }), { status: 400, headers: JSON_HEADERS })
    }
    if (panels) { sets.push('visible_panels = ?'); values.push(JSON.stringify(panels)) }
    if (typeof body.allow_rfi_answers === 'boolean') { sets.push('allow_rfi_answers = ?'); values.push(body.allow_rfi_answers ? 1 : 0) }
    if (typeof body.allow_evidence === 'boolean') { sets.push('allow_evidence = ?'); values.push(body.allow_evidence ? 1 : 0) }
    if (sets.length === 0) {
      return new Response(JSON.stringify({ error: 'Nothing to change' }), { status: 400, headers: JSON_HEADERS })
    }

    try {
      await env.DB.prepare(`UPDATE cop_shares SET ${sets.join(', ')} WHERE id = ? AND cop_session_id = ?`)
        .bind(...values, share.id, sessionId).run()
    } catch (error) {
      if (!isMissingColumn(error)) throw error
      return new Response(JSON.stringify({ error: 'Evidence submission through share links is not available yet' }), {
        status: 503, headers: JSON_HEADERS,
      })
    }

    await emitCopEvent(env.DB, {
      copSessionId: sessionId,
      eventType: SHARE_UPDATED,
      entityType: 'share',
      entityId: share.id,
      payload: { visible_panels: panels ?? undefined, allow_evidence: body.allow_evidence, allow_rfi_answers: body.allow_rfi_answers },
      createdBy: userId,
    })
    const row = await env.DB.prepare('SELECT * FROM cop_shares WHERE id = ? AND cop_session_id = ?')
      .bind(share.id, sessionId).first<Record<string, unknown> & { visible_panels: string | null; allow_evidence?: number }>()
    return new Response(JSON.stringify({
      share: row ? { ...row, visible_panels: JSON.parse(row.visible_panels || '["map"]'), allow_evidence: row.allow_evidence === 1 } : null,
    }), { headers: JSON_HEADERS })
  } catch (error) {
    await logEvent(env, {
      level: 'error',
      source: 'cop/shares',
      message: String(error instanceof Error ? error.message : error).slice(0, 500),
      context: { error: String(error) },
    })
    return new Response(JSON.stringify({ error: 'Failed to update share link' }), { status: 500, headers: JSON_HEADERS })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: JSON_HEADERS })
}
