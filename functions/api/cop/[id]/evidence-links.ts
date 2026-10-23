/**
 * COP evidence links: evidence filed under questions (RFIs, key questions) and tasks.
 *
 * GET    /api/cop/:id/evidence-links[?target_type=&target_id=][&evidence_id=]
 *          → { links: [{ id, evidence_id, target_type, target_id, relation, note, created_at }] }
 *          (owner, collaborators, or any signed-in reader of a public session)
 * POST   /api/cop/:id/evidence-links { evidence_id, target_type, target_id, relation?, note? }
 *          → 201 { link } (200 when the link existed: relation/note updated)
 *          (owner, editor/admin, the bot service)
 * DELETE /api/cop/:id/evidence-links { id }  (owner, editor/admin; a service only its own)
 *
 * Linking never answers, closes or otherwise changes the question or task. Both ends
 * are checked in SQL to belong to this session (functions/api/_shared/cop-evidence-links.ts).
 * 503 EVIDENCE_LINKS_UNAVAILABLE until migration 0024 is applied.
 */
import type { PagesFunction } from '@cloudflare/workers-types'
import { requireCopEditor, verifyCopSessionAccess } from '../../_shared/auth-helpers'
import { JSON_HEADERS } from '../../_shared/api-utils'
import { logEvent } from '../../_shared/event-log'
import { copCallerUserId, copServiceCaller } from '../../_shared/cop-caller'
import {
  cleanEvidenceId, cleanNote, cleanRelation, cleanTargetId, deleteEvidenceLink, isLinkTargetType, linksTableMissing,
  listEvidenceLinks, upsertEvidenceLink, type LinkTargetType,
} from '../../_shared/cop-evidence-links'

interface Env {
  DB: D1Database
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: JSON_HEADERS })

const unavailable = () => json({
  error: 'Filing evidence under questions is not available on this server yet.',
  code: 'EVIDENCE_LINKS_UNAVAILABLE',
}, 503)

async function failed(env: Env, error: unknown, what: string): Promise<Response> {
  if (linksTableMissing(error)) return unavailable()
  await logEvent(env, {
    level: 'error',
    source: 'cop/evidence-links',
    message: String(error instanceof Error ? error.message : error).slice(0, 500),
    context: { error: String(error) },
  })
  return json({ error: `Failed to ${what}` }, 500)
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params, request } = context
  const sessionId = params.id as string
  const userId = await copCallerUserId(context)
  if (!userId) return json({ error: 'Authentication required' }, 401)
  if (!(await verifyCopSessionAccess(env.DB, sessionId, userId, { readOnly: true }))) {
    return json({ error: 'Access denied' }, 403)
  }

  const query = new URL(request.url).searchParams
  const rawType = query.get('target_type')
  if (rawType !== null && !isLinkTargetType(rawType)) return json({ error: "target_type must be 'rfi' or 'task'" }, 400)
  const targetType: LinkTargetType | undefined = rawType === null ? undefined : (rawType as LinkTargetType)
  const rawTarget = query.get('target_id')
  const targetId = rawTarget === null ? undefined : cleanTargetId(rawTarget)
  if (targetId === null) return json({ error: 'target_id is not valid' }, 400)
  const rawEvidence = query.get('evidence_id')
  const evidenceId = rawEvidence === null ? undefined : cleanEvidenceId(rawEvidence)
  if (evidenceId === null) return json({ error: 'evidence_id is not valid' }, 400)

  try {
    const links = await listEvidenceLinks(env.DB, sessionId, {
      targetType,
      targetId,
      evidenceId,
    })
    return json({ links })
  } catch (error) {
    return failed(env, error, 'list evidence links')
  }
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, params, request } = context
  const sessionId = params.id as string
  const userId = await copCallerUserId(context)
  if (!userId) return json({ error: 'Authentication required' }, 401)
  const workspaceId = await requireCopEditor(env.DB, sessionId, userId)
  if (!workspaceId) return json({ error: 'Only the session owner or an editor can file evidence' }, 403)

  let body: Record<string, unknown>
  try {
    const parsed = await request.json()
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object')
    body = parsed as Record<string, unknown>
  } catch {
    return json({ error: 'Expected a JSON body' }, 400)
  }
  const evidenceId = cleanEvidenceId(body.evidence_id)
  if (!evidenceId) return json({ error: 'evidence_id is required' }, 400)
  if (!isLinkTargetType(body.target_type)) return json({ error: "target_type must be 'rfi' or 'task'" }, 400)
  const targetId = cleanTargetId(body.target_id)
  if (!targetId) return json({ error: 'target_id is required' }, 400)
  const relation = cleanRelation(body.relation)
  if (!relation) return json({ error: "relation must be 'supports', 'contradicts' or 'context'" }, 400)
  const note = cleanNote(body.note)
  if (note === undefined) return json({ error: 'note must be text of at most 1000 characters' }, 400)

  try {
    const service = copServiceCaller(context.data)
    const result = await upsertEvidenceLink(env.DB, {
      scope: { sessionId, workspaceId },
      evidenceId,
      targetType: body.target_type,
      targetId,
      relation,
      note,
      actorUserId: userId,
      serviceUserId: service ? service.principalUserId : null,
    })
    if (result.ok === false) return json({ error: result.error, ...(result.code ? { code: result.code } : {}) }, result.status)
    return json({ link: result.link }, result.created ? 201 : 200)
  } catch (error) {
    return failed(env, error, 'file evidence')
  }
}

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { env, params, request } = context
  const sessionId = params.id as string
  const userId = await copCallerUserId(context)
  if (!userId) return json({ error: 'Authentication required' }, 401)
  if (!(await requireCopEditor(env.DB, sessionId, userId))) {
    return json({ error: 'Only the session owner or an editor can remove a link' }, 403)
  }
  let linkId: string | null = new URL(request.url).searchParams.get('id')
  if (!linkId) {
    try {
      const body = await request.json() as { id?: unknown }
      linkId = typeof body?.id === 'string' ? body.id : null
    } catch { /* no body */ }
  }
  if (!linkId || !/^evl-[0-9a-f-]{36}$/.test(linkId)) return json({ error: 'id is required' }, 400)

  try {
    const service = copServiceCaller(context.data)
    const result = await deleteEvidenceLink(env.DB, {
      sessionId, linkId, actorUserId: userId, serviceUserId: service ? service.principalUserId : null,
    })
    if (result.ok === false) return json({ error: result.error, ...(result.code ? { code: result.code } : {}) }, result.status)
    return json({ ok: true })
  } catch (error) {
    return failed(env, error, 'remove the link')
  }
}

export const onRequestOptions: PagesFunction = async () => new Response(null, { status: 204, headers: JSON_HEADERS })
