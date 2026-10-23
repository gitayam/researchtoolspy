/**
 * Evidence filed under questions (RFIs, key questions) and tasks (migration 0024).
 *
 * A link says an evidence item bears on a question or task, as support, contradiction
 * or context, with an optional note. Linking never answers, closes or otherwise
 * changes the question: an RFI stays a line of inquiry that evidence keeps arriving
 * under.
 *
 * Both ends are checked IN SQL to belong to the session before a link is written:
 * the evidence through evidenceInSession (evidence_items is workspace-wide), the RFI
 * or task through its cop_session_id. A service credential (the Signal bot) may
 * change or remove only the links it created.
 */
import { emitCopEventLoose } from './cop-events-loose'
import {
  evidenceInSession, isMissingColumn, queryEvidenceInSession, UNVERIFIED_TIP_LABEL, unreviewedTipEvidence,
  type EvidenceSessionScope,
} from './cop-input'

export const LINK_TARGET_TYPES = ['rfi', 'task'] as const
export type LinkTargetType = (typeof LINK_TARGET_TYPES)[number]
export const LINK_RELATIONS = ['supports', 'contradicts', 'context'] as const
export type LinkRelation = (typeof LINK_RELATIONS)[number]

export const LINK_NOTE_MAX = 1000
/** Questions a single evidence item may be filed under in one call (the feed's picker). */
export const MAX_LINKS_PER_EVIDENCE = 50

export interface EvidenceLink {
  id: string
  evidence_id: string
  target_type: LinkTargetType
  target_id: string
  relation: LinkRelation
  note: string | null
  created_at: string
}

const LINK_COLUMNS = 'id, evidence_id, target_type, target_id, relation, note, created_at'

/** True when cop_evidence_links doesn't exist yet (migration 0024 pending). */
export function linksTableMissing(error: unknown): boolean {
  return /no such table:?\s*(?:main\.)?cop_evidence_links\b/i.test(String(error instanceof Error ? error.message : error))
}

export function isLinkTargetType(value: unknown): value is LinkTargetType {
  return typeof value === 'string' && (LINK_TARGET_TYPES as readonly string[]).includes(value)
}

export function cleanRelation(value: unknown): LinkRelation | null {
  if (value === undefined || value === null || value === '') return 'supports'
  return typeof value === 'string' && (LINK_RELATIONS as readonly string[]).includes(value) ? (value as LinkRelation) : null
}

/** A note as stored: trimmed, control characters removed, at most LINK_NOTE_MAX; '' → null. */
export function cleanNote(value: unknown): string | null | undefined {
  if (value === undefined || value === null) return null
  if (typeof value !== 'string') return undefined
  // eslint-disable-next-line no-control-regex
  const text = value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim()
  if (text.length > LINK_NOTE_MAX) return undefined
  return text || null
}

/** The evidence id as stored in links: digits only (evidence_items.id is an integer). */
export function cleanEvidenceId(value: unknown): string | null {
  const text = typeof value === 'number' ? String(value) : typeof value === 'string' ? value.trim() : ''
  return /^\d{1,15}$/.test(text) ? String(Number(text)) : null
}

export function cleanTargetId(value: unknown): string | null {
  return typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,80}$/.test(value.trim()) ? value.trim() : null
}

/** Is this evidence item the session's (evidenceInSession)? Checked in SQL. */
export async function evidenceIsInSession(db: D1Database, scope: EvidenceSessionScope, evidenceId: string): Promise<boolean> {
  const row = await queryEvidenceInSession(
    db,
    'SELECT id FROM evidence_items WHERE id = ? AND {EVIDENCE_SCOPE}',
    scope, [Number(evidenceId)], [],
    (statement) => statement.first<{ id: number }>(),
  )
  return Boolean(row)
}

/** Is this RFI or task the session's? Checked in SQL. */
export async function targetIsInSession(db: D1Database, sessionId: string, type: LinkTargetType, id: string): Promise<boolean> {
  const table = type === 'rfi' ? 'cop_rfis' : 'cop_tasks'
  const row = await db.prepare(`SELECT id FROM ${table} WHERE id = ? AND cop_session_id = ?`).bind(id, sessionId).first()
  return Boolean(row)
}

export type LinkWriteResult =
  | { ok: true; link: EvidenceLink; created: boolean }
  | { ok: false; status: number; error: string; code?: string }

/**
 * File an evidence item under an RFI or task (both checked in SQL), or update the
 * relation/note of an existing link. `serviceUserId` is set for a service caller,
 * which may change only links it created.
 */
export async function upsertEvidenceLink(
  db: D1Database,
  input: {
    scope: EvidenceSessionScope
    evidenceId: string
    targetType: LinkTargetType
    targetId: string
    relation: LinkRelation
    note: string | null
    actorUserId: number
    serviceUserId: number | null
  },
): Promise<LinkWriteResult> {
  const { scope } = input
  if (!(await evidenceIsInSession(db, scope, input.evidenceId))) {
    return { ok: false, status: 404, error: 'Evidence not found in this COP', code: 'EVIDENCE_NOT_FOUND' }
  }
  if (!(await targetIsInSession(db, scope.sessionId, input.targetType, input.targetId))) {
    return { ok: false, status: 404, error: `${input.targetType === 'rfi' ? 'Question' : 'Task'} not found in this COP`, code: 'TARGET_NOT_FOUND' }
  }

  const existing = await db.prepare(
    `SELECT ${LINK_COLUMNS}, created_by FROM cop_evidence_links WHERE evidence_id = ? AND target_type = ? AND target_id = ?`
  ).bind(input.evidenceId, input.targetType, input.targetId).first<EvidenceLink & { created_by: number }>()

  if (existing) {
    if (input.serviceUserId !== null && String(existing.created_by) !== String(input.serviceUserId)) {
      return { ok: false, status: 403, error: 'A service may only change links it created', code: 'NOT_OWN_LINK' }
    }
    if (existing.relation !== input.relation || (existing.note ?? null) !== input.note) {
      await db.prepare('UPDATE cop_evidence_links SET relation = ?, note = ? WHERE id = ? AND cop_session_id = ?')
        .bind(input.relation, input.note, existing.id, scope.sessionId).run()
      await emitLinkEvents(db, scope.sessionId, 'evidence.link_updated', input, existing.id)
    }
    return {
      ok: true,
      created: false,
      link: {
        id: existing.id, evidence_id: existing.evidence_id, target_type: existing.target_type, target_id: existing.target_id,
        relation: input.relation, note: input.note, created_at: existing.created_at,
      },
    }
  }

  const id = `evl-${crypto.randomUUID()}`
  const now = new Date().toISOString()
  // The unique key settles a race between two writers: the loser keeps the winner's row.
  const inserted = await db.prepare(`
    INSERT INTO cop_evidence_links (id, cop_session_id, evidence_id, target_type, target_id, relation, note, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (evidence_id, target_type, target_id) DO NOTHING
  `).bind(id, scope.sessionId, input.evidenceId, input.targetType, input.targetId, input.relation, input.note, input.actorUserId, now).run()
  if (!inserted.meta?.changes) {
    const winner = await db.prepare(
      `SELECT ${LINK_COLUMNS} FROM cop_evidence_links WHERE evidence_id = ? AND target_type = ? AND target_id = ?`
    ).bind(input.evidenceId, input.targetType, input.targetId).first<EvidenceLink>()
    if (!winner) return { ok: false, status: 409, error: 'The link changed while saving; try again' }
    return { ok: true, created: false, link: winner }
  }
  await emitLinkEvents(db, scope.sessionId, 'evidence.linked', input, id)
  return {
    ok: true,
    created: true,
    link: { id, evidence_id: input.evidenceId, target_type: input.targetType, target_id: input.targetId, relation: input.relation, note: input.note, created_at: now },
  }
}

/** Remove one link of this session; a service only its own. */
export async function deleteEvidenceLink(
  db: D1Database,
  input: { sessionId: string; linkId: string; actorUserId: number; serviceUserId: number | null },
): Promise<{ ok: true } | { ok: false; status: number; error: string; code?: string }> {
  const existing = await db.prepare(
    `SELECT ${LINK_COLUMNS}, created_by FROM cop_evidence_links WHERE id = ? AND cop_session_id = ?`
  ).bind(input.linkId, input.sessionId).first<EvidenceLink & { created_by: number }>()
  if (!existing) return { ok: false, status: 404, error: 'Link not found in this COP' }
  if (input.serviceUserId !== null && String(existing.created_by) !== String(input.serviceUserId)) {
    return { ok: false, status: 403, error: 'A service may only remove links it created', code: 'NOT_OWN_LINK' }
  }
  const owner = input.serviceUserId !== null ? ' AND created_by = ?' : ''
  const removed = await db.prepare(`DELETE FROM cop_evidence_links WHERE id = ? AND cop_session_id = ?${owner}`)
    .bind(input.linkId, input.sessionId, ...(input.serviceUserId !== null ? [input.serviceUserId] : [])).run()
  if (!removed.meta?.changes) return { ok: false, status: 404, error: 'Link not found in this COP' }
  await emitLinkEvents(db, input.sessionId, 'evidence.unlinked', {
    evidenceId: existing.evidence_id, targetType: existing.target_type, targetId: existing.target_id, actorUserId: input.actorUserId,
  }, existing.id)
  return { ok: true }
}

async function emitLinkEvents(
  db: D1Database,
  sessionId: string,
  eventType: string,
  input: { evidenceId: string; targetType: LinkTargetType; targetId: string; actorUserId: number },
  linkId: string,
): Promise<void> {
  // Both ends change for the people watching them; no note or titles in the payload.
  const payload = { link_id: linkId, target_type: input.targetType }
  await emitCopEventLoose(db, {
    copSessionId: sessionId, eventType, entityType: 'evidence', entityId: input.evidenceId, payload, createdBy: input.actorUserId,
  })
  await emitCopEventLoose(db, {
    copSessionId: sessionId, eventType, entityType: input.targetType, entityId: input.targetId, payload, createdBy: input.actorUserId,
  })
}

/** The session's links, optionally narrowed; [] before migration 0024. */
export async function listEvidenceLinks(
  db: D1Database,
  sessionId: string,
  filter: { targetType?: LinkTargetType; targetId?: string; evidenceId?: string } = {},
): Promise<EvidenceLink[]> {
  const where = ['cop_session_id = ?']
  const binds: unknown[] = [sessionId]
  if (filter.targetType) { where.push('target_type = ?'); binds.push(filter.targetType) }
  if (filter.targetId) { where.push('target_id = ?'); binds.push(filter.targetId) }
  if (filter.evidenceId) { where.push('evidence_id = ?'); binds.push(filter.evidenceId) }
  try {
    const rows = await db.prepare(
      `SELECT ${LINK_COLUMNS} FROM cop_evidence_links WHERE ${where.join(' AND ')} ORDER BY created_at ASC, id ASC LIMIT 5000`
    ).bind(...binds).all<EvidenceLink>()
    return rows.results ?? []
  } catch (error) {
    if (linksTableMissing(error)) return []
    throw error
  }
}

/** How much evidence is filed under each of these RFIs/tasks; empty before migration 0024. */
export async function evidenceCounts(
  db: D1Database,
  sessionId: string,
  targetType: LinkTargetType,
  targetIds: readonly string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>()
  if (targetIds.length === 0) return counts
  try {
    for (let i = 0; i < targetIds.length; i += 90) {
      const chunk = targetIds.slice(i, i + 90)
      const rows = await db.prepare(`
        SELECT target_id, COUNT(*) AS n FROM cop_evidence_links
        WHERE cop_session_id = ? AND target_type = ? AND target_id IN (${chunk.map(() => '?').join(',')})
        GROUP BY target_id
      `).bind(sessionId, targetType, ...chunk).all<{ target_id: string; n: number }>()
      for (const row of rows.results ?? []) counts.set(String(row.target_id), Number(row.n) || 0)
    }
  } catch (error) {
    if (!linksTableMissing(error)) throw error
  }
  return counts
}

/** Remove the links of a deleted evidence item, RFI or task; nothing before migration 0024. */
export async function deleteLinksOf(
  db: D1Database,
  sessionId: string,
  end: { evidenceId: string } | { targetType: LinkTargetType; targetId: string },
): Promise<void> {
  try {
    if ('evidenceId' in end) {
      await db.prepare('DELETE FROM cop_evidence_links WHERE cop_session_id = ? AND evidence_id = ?')
        .bind(sessionId, end.evidenceId).run()
    } else {
      await db.prepare('DELETE FROM cop_evidence_links WHERE cop_session_id = ? AND target_type = ? AND target_id = ?')
        .bind(sessionId, end.targetType, end.targetId).run()
    }
  } catch (error) {
    if (!linksTableMissing(error)) throw error
  }
}

/** Remove links left on tasks that no longer exist (a deleted task takes its subtasks with it). */
export async function deleteOrphanTaskLinks(db: D1Database, sessionId: string): Promise<void> {
  try {
    await db.prepare(`
      DELETE FROM cop_evidence_links
      WHERE cop_session_id = ? AND target_type = 'task'
        AND target_id NOT IN (SELECT id FROM cop_tasks WHERE cop_session_id = ?)
    `).bind(sessionId, sessionId).run()
  } catch (error) {
    if (!linksTableMissing(error)) throw error
  }
}

// ── Duplicate links in evidence ──────────────────────────────────

/**
 * The session's evidence item for the same link, if any: by canonical_url (migration
 * 0022), or, for items saved before it, by the exact link as given or canonical. Only
 * this COP's evidence (evidenceInSession), never another COP's in the same workspace.
 */
export async function findDuplicateEvidence(
  db: D1Database,
  scope: EvidenceSessionScope,
  raw: string,
  canonical: string,
): Promise<number | null> {
  const clause = evidenceInSession(scope)
  try {
    const row = await db.prepare(`
      SELECT id FROM evidence_items
      WHERE ${clause.sql} AND (canonical_url = ? OR (canonical_url IS NULL AND source_url IN (?, ?)))
      ORDER BY id ASC LIMIT 1
    `).bind(...clause.binds, canonical, raw, canonical).first<{ id: number }>()
    return row ? Number(row.id) : null
  } catch (error) {
    if (!isMissingColumn(error)) throw error
    const row = await db.prepare(
      `SELECT id FROM evidence_items WHERE ${clause.legacySql} AND source_url IN (?, ?) ORDER BY id ASC LIMIT 1`
    ).bind(...clause.legacyBinds, raw, canonical).first<{ id: number }>()
    return row ? Number(row.id) : null
  }
}

// ── Public share ─────────────────────────────────────────────────

export interface PublicLinkedEvidence {
  title: string
  url: string | null
  credibility: string | null
  relation: LinkRelation
  created_at: string
}

const httpUrl = (value: unknown): string | null => {
  if (typeof value !== 'string') return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null
  } catch {
    return null
  }
}

/** Per question, at most this many evidence items in a share payload (newest first). */
export const PUBLIC_EVIDENCE_PER_QUESTION = 20

/**
 * The evidence filed under these RFIs, for a share showing the evidence panel: title,
 * link (http(s) only), credibility, relation and date. Only the session's evidence;
 * an unreviewed drop-form tip shows as "Unverified tip" without its link, exactly as
 * the share's evidence list does. Never notes or descriptions.
 */
export async function publicEvidenceByRfi(
  db: D1Database,
  scope: EvidenceSessionScope,
  rfiIds: readonly string[],
): Promise<Map<string, PublicLinkedEvidence[]>> {
  const out = new Map<string, PublicLinkedEvidence[]>()
  if (rfiIds.length === 0) return out
  const clause = evidenceInSession(scope, 'e')
  const ids = rfiIds.slice(0, 200)
  const marks = ids.map(() => '?').join(',')
  let rows: Record<string, unknown>[]
  try {
    try {
      rows = ((await db.prepare(`
        SELECT l.target_id, l.relation, e.title, e.source_url, e.credibility, e.source_channel, e.created_at
        FROM cop_evidence_links l JOIN evidence_items e ON CAST(e.id AS TEXT) = l.evidence_id
        WHERE l.cop_session_id = ? AND l.target_type = 'rfi' AND l.target_id IN (${marks}) AND ${clause.sql}
        ORDER BY e.created_at DESC, e.id DESC
      `).bind(scope.sessionId, ...ids, ...clause.binds).all<Record<string, unknown>>()).results ?? [])
    } catch (error) {
      if (!isMissingColumn(error) || linksTableMissing(error)) throw error
      rows = ((await db.prepare(`
        SELECT l.target_id, l.relation, e.title, e.source_url, e.credibility, e.created_at
        FROM cop_evidence_links l JOIN evidence_items e ON CAST(e.id AS TEXT) = l.evidence_id
        WHERE l.cop_session_id = ? AND l.target_type = 'rfi' AND l.target_id IN (${marks}) AND ${clause.legacySql}
        ORDER BY e.created_at DESC, e.id DESC
      `).bind(scope.sessionId, ...ids, ...clause.legacyBinds).all<Record<string, unknown>>()).results ?? [])
    }
  } catch (error) {
    if (linksTableMissing(error)) return out
    throw error
  }
  for (const row of rows) {
    const key = String(row.target_id)
    const list = out.get(key) ?? []
    if (list.length >= PUBLIC_EVIDENCE_PER_QUESTION) continue
    const unreviewed = unreviewedTipEvidence(row)
    list.push({
      title: unreviewed ? UNVERIFIED_TIP_LABEL : String(row.title ?? '').slice(0, 300),
      url: unreviewed ? null : httpUrl(row.source_url),
      credibility: (row.credibility as string | null) ?? null,
      relation: (cleanRelation(row.relation) ?? 'supports'),
      created_at: String(row.created_at ?? ''),
    })
    out.set(key, list)
  }
  return out
}

// ── "Which question is this about?" on a COP's evidence form ──────

export interface QuestionChoice {
  id: string
  question: string
}

/**
 * The key questions (starred RFIs) a COP-linked evidence form offers its tipsters, when
 * the form's owner turned the picker on (survey_drops.question_picker, migration 0024).
 * Only for a form made by the session's owner or a current editor/admin collaborator
 * (the rule auto-ingest uses), and only that session's starred RFIs. [] otherwise, or
 * before migrations 0022/0024.
 */
export async function questionChoicesForDrop(db: D1Database, formId: string): Promise<QuestionChoice[]> {
  try {
    const rows = await db.prepare(`
      SELECT r.id, r.question FROM survey_drops d
      JOIN cop_sessions s ON s.id = d.cop_session_id
      JOIN cop_rfis r ON r.cop_session_id = s.id AND r.is_key = 1
      WHERE d.id = ? AND d.question_picker = 1
        AND (
          s.created_by = d.created_by
          OR EXISTS (
            SELECT 1 FROM cop_collaborators c
            WHERE c.cop_session_id = s.id AND c.user_id = d.created_by
              AND lower(trim(c.role)) IN ('editor', 'admin')
          )
        )
      ORDER BY r.created_at ASC, r.rowid ASC
      LIMIT 50
    `).bind(formId).all<{ id: string; question: string }>()
    return (rows.results ?? []).map((r) => ({ id: String(r.id), question: String(r.question ?? '').slice(0, 500) }))
  } catch (error) {
    if (isMissingColumn(error)) return []
    throw error
  }
}

/** The form field names a tipster's choice travels in (helper keys: not shown as answers). */
export const QUESTION_FIELD = '_question'
export const QUESTION_RELATION_FIELD = '_question_relation'

/**
 * File an ingested tip under the key question its tipster chose, if the form offers
 * the picker and the choice is one of that COP's starred RFIs (checked in SQL — a
 * tipster can never name an RFI outside the COP). Relation 'supports' unless the
 * tipster said it contradicts. Best effort: a bad or stale choice files nothing.
 */
export async function fileTipUnderChosenQuestion(
  db: D1Database,
  input: {
    formId: string
    scope: EvidenceSessionScope
    evidenceId: string
    formData: Record<string, unknown>
    actorUserId: number
  },
): Promise<string | null> {
  const chosen = typeof input.formData[QUESTION_FIELD] === 'string' ? String(input.formData[QUESTION_FIELD]).trim() : ''
  if (!chosen || !/^[A-Za-z0-9_.:-]{1,80}$/.test(chosen)) return null
  const offered = await questionChoicesForDrop(db, input.formId)
  if (!offered.some((choice) => choice.id === chosen)) return null
  // The choices query already scoped the RFI to the form's session; ingest runs for that session.
  const inSession = await db.prepare('SELECT id FROM cop_rfis WHERE id = ? AND cop_session_id = ? AND is_key = 1')
    .bind(chosen, input.scope.sessionId).first()
  if (!inSession) return null
  const relation: LinkRelation = input.formData[QUESTION_RELATION_FIELD] === 'contradicts' ? 'contradicts' : 'supports'
  const result = await upsertEvidenceLink(db, {
    scope: input.scope,
    evidenceId: input.evidenceId,
    targetType: 'rfi',
    targetId: chosen,
    relation,
    note: null,
    actorUserId: input.actorUserId,
    serviceUserId: null,
  })
  return result.ok ? result.link.target_id : null
}
