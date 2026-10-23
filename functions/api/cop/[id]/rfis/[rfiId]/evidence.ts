/**
 * POST /api/cop/:id/rfis/:rfiId/evidence { url?, title?, note?, relation? }
 *   → 201 { evidence: { id, title, source_url }, link, duplicate }
 *
 * Add evidence under a question in one call: the link (or a titled note) becomes a
 * COP evidence item — or, when this COP already holds the same link, that item is
 * reused (duplicate: true) — and is filed under the RFI. The RFI keeps its status:
 * filing evidence never answers or closes it. Owner, editor/admin, or the bot service.
 * Attaching evidence already in the COP is POST /api/cop/:id/evidence-links.
 */
import type { PagesFunction } from '@cloudflare/workers-types'
import { requireCopEditor } from '../../../../_shared/auth-helpers'
import { JSON_HEADERS } from '../../../../_shared/api-utils'
import { logEvent } from '../../../../_shared/event-log'
import { copCallerUserId, copServiceCaller } from '../../../../_shared/cop-caller'
import { canonicalUrl, copSourceChannel, copSourceRef, isMissingColumn, setProvenance } from '../../../../_shared/cop-input'
import { copSessionScope, insertCopEvidence } from '../../../../_shared/cop-records'
import {
  cleanNote, cleanRelation, findDuplicateEvidence, linksTableMissing, targetIsInSession, upsertEvidenceLink,
} from '../../../../_shared/cop-evidence-links'

interface Env {
  DB: D1Database
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: JSON_HEADERS })

const TITLE_MAX = 300

/** A readable title for a link with none given: host and path, shortened. */
function titleFromUrl(raw: string): string {
  try {
    const url = new URL(raw)
    const path = url.pathname.replace(/\/+$/, '')
    return `${url.host}${path}`.slice(0, 160)
  } catch {
    return raw.slice(0, 160)
  }
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, params, request } = context
  const sessionId = params.id as string
  const rfiId = params.rfiId as string
  const userId = await copCallerUserId(context)
  if (!userId) return json({ error: 'Authentication required' }, 401)
  const workspaceId = await requireCopEditor(env.DB, sessionId, userId)
  if (!workspaceId) return json({ error: 'Only the session owner or an editor can add evidence' }, 403)

  let body: Record<string, unknown>
  try {
    const parsed = await request.json()
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object')
    body = parsed as Record<string, unknown>
  } catch {
    return json({ error: 'Expected a JSON body' }, 400)
  }

  const rawUrl = typeof body.url === 'string' && body.url.trim() ? body.url.trim() : null
  const canonical = rawUrl ? canonicalUrl(rawUrl) : null
  if (rawUrl && !canonical) return json({ error: 'url must be an http(s) link' }, 400)
  if (rawUrl && rawUrl.length > 2000) return json({ error: 'url is too long' }, 400)
  const note = cleanNote(body.note)
  if (note === undefined) return json({ error: 'note must be text of at most 1000 characters' }, 400)
  const relation = cleanRelation(body.relation)
  if (!relation) return json({ error: "relation must be 'supports', 'contradicts' or 'context'" }, 400)
  const givenTitle = typeof body.title === 'string' ? body.title.trim().slice(0, TITLE_MAX) : ''
  if (!rawUrl && !givenTitle && !note) return json({ error: 'Give a link, a title or a note' }, 400)

  try {
    // Before migration 0024 nothing is written: no evidence without the link it was for.
    await env.DB.prepare('SELECT id FROM cop_evidence_links LIMIT 1').first()
    if (!(await targetIsInSession(env.DB, sessionId, 'rfi', rfiId))) {
      return json({ error: 'Question not found in this COP', code: 'TARGET_NOT_FOUND' }, 404)
    }
    const scope = await copSessionScope(env.DB, sessionId)
    if (!scope) return json({ error: 'COP session not found' }, 404)
    if (scope.archived) return json({ error: 'This COP session is archived' }, 410)

    let evidenceId: string | null = null
    let duplicate = false
    if (rawUrl && canonical) {
      const existing = await findDuplicateEvidence(env.DB, { sessionId, workspaceId }, rawUrl, canonical)
      if (existing !== null) {
        evidenceId = String(existing)
        duplicate = true
      }
    }
    if (!evidenceId) {
      const title = givenTitle || (rawUrl ? titleFromUrl(rawUrl) : (note ?? '').split('\n')[0].slice(0, 120))
      evidenceId = await insertCopEvidence(env.DB, scope, {
        title,
        description: '',
        sourceUrl: rawUrl,
        evidenceType: 'observation',
        credibility: 'unverified',
        sourceName: null,
        sourceChannel: copSourceChannel(context),
        metadata: { filed_under: { target_type: 'rfi', target_id: rfiId } },
        createdBy: userId,
      })
      await setProvenance(env.DB, 'evidence_items', evidenceId, copSourceChannel(context), copSourceRef(context))
      if (canonical) {
        try {
          await env.DB.prepare('UPDATE evidence_items SET canonical_url = ? WHERE id = ?').bind(canonical, evidenceId).run()
        } catch (error) {
          if (!isMissingColumn(error)) throw error
        }
      }
    }

    const service = copServiceCaller(context.data)
    const linked = await upsertEvidenceLink(env.DB, {
      scope: { sessionId, workspaceId },
      evidenceId,
      targetType: 'rfi',
      targetId: rfiId,
      relation,
      note,
      actorUserId: userId,
      serviceUserId: service ? service.principalUserId : null,
    })
    if (linked.ok === false) return json({ error: linked.error, ...(linked.code ? { code: linked.code } : {}) }, linked.status)

    const evidence = await env.DB.prepare('SELECT id, title, source_url FROM evidence_items WHERE id = ? AND workspace_id = ?')
      .bind(Number(evidenceId), workspaceId).first<{ id: number; title: string; source_url: string | null }>()
    return json({ evidence, link: linked.link, duplicate }, 201)
  } catch (error) {
    if (linksTableMissing(error)) {
      return json({ error: 'Filing evidence under questions is not available on this server yet.', code: 'EVIDENCE_LINKS_UNAVAILABLE' }, 503)
    }
    await logEvent(env, {
      level: 'error',
      source: 'cop/rfi-evidence',
      message: String(error instanceof Error ? error.message : error).slice(0, 500),
      context: { error: String(error) },
    })
    return json({ error: 'Failed to add evidence' }, 500)
  }
}

export const onRequestOptions: PagesFunction = async () => new Response(null, { status: 204, headers: JSON_HEADERS })
