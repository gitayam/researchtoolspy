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
 *
 * Collaborators vote on a filing (migration 0026): 👍 "this helps answer the
 * question", 👎 "it doesn't". Lists come ranked by score (up − down), then newest.
 */
import { emitCopEventLoose } from './cop-events-loose'
import { EVIDENCE_LINK_UPDATED, EVIDENCE_LINK_VOTED, EVIDENCE_LINKED, EVIDENCE_UNLINKED } from './cop-event-types'
import { shareExpired, sharePanels } from './cop-share'
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

/** A filing as the lists show it: with its team votes, and the caller's own. */
export interface ListedEvidenceLink extends EvidenceLink {
  up: number
  down: number
  my_vote: VoteValue
}

export type VoteValue = -1 | 0 | 1

const LINK_COLUMNS = 'id, evidence_id, target_type, target_id, relation, note, created_at'

/** True when cop_evidence_links doesn't exist yet (migration 0024 pending). */
export function linksTableMissing(error: unknown): boolean {
  return /no such table:?\s*(?:main\.)?cop_evidence_links\b/i.test(String(error instanceof Error ? error.message : error))
}

/** True when cop_evidence_link_votes doesn't exist yet (migration 0026 pending). */
export function votesTableMissing(error: unknown): boolean {
  return /no such table:?\s*(?:main\.)?cop_evidence_link_votes\b/i.test(String(error instanceof Error ? error.message : error))
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
    /**
     * The tipster chose this question on the drop form: the row is still written as
     * `actorUserId` (the form's owner or the reviewer), but its events are anonymous
     * (created_by 0, via 'tip'), as the tipster's choice.
     */
    viaTip?: boolean
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
    `SELECT ${LINK_COLUMNS}, created_by FROM cop_evidence_links
     WHERE cop_session_id = ? AND evidence_id = ? AND target_type = ? AND target_id = ?`
  ).bind(scope.sessionId, input.evidenceId, input.targetType, input.targetId).first<EvidenceLink & { created_by: number }>()

  if (existing) {
    if (input.serviceUserId !== null && String(existing.created_by) !== String(input.serviceUserId)) {
      return { ok: false, status: 403, error: 'A service may only change links it created', code: 'NOT_OWN_LINK' }
    }
    if (existing.relation !== input.relation || (existing.note ?? null) !== input.note) {
      const updated = await db.prepare('UPDATE cop_evidence_links SET relation = ?, note = ? WHERE id = ? AND cop_session_id = ?')
        .bind(input.relation, input.note, existing.id, scope.sessionId).run()
      if (!updated.meta?.changes) return { ok: false, status: 404, error: 'Link not found in this COP' }
      await emitLinkEvents(db, scope.sessionId, EVIDENCE_LINK_UPDATED, input, existing.id)
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
  // One statement: the per-evidence cap and the unique key are checked as the row is
  // written, so neither a race nor parallel callers can pass them. A lost race keeps
  // the winner's row.
  const inserted = await db.prepare(`
    INSERT INTO cop_evidence_links (id, cop_session_id, evidence_id, target_type, target_id, relation, note, created_by, created_at)
    SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?
    WHERE (SELECT COUNT(*) FROM cop_evidence_links WHERE cop_session_id = ? AND evidence_id = ?) < ?
    ON CONFLICT (evidence_id, target_type, target_id) DO NOTHING
  `).bind(
    id, scope.sessionId, input.evidenceId, input.targetType, input.targetId, input.relation, input.note, input.actorUserId, now,
    scope.sessionId, input.evidenceId, MAX_LINKS_PER_EVIDENCE,
  ).run()
  if (!inserted.meta?.changes) {
    const winner = await db.prepare(
      `SELECT ${LINK_COLUMNS} FROM cop_evidence_links WHERE cop_session_id = ? AND evidence_id = ? AND target_type = ? AND target_id = ?`
    ).bind(scope.sessionId, input.evidenceId, input.targetType, input.targetId).first<EvidenceLink>()
    if (winner) return { ok: true, created: false, link: winner }
    return {
      ok: false,
      status: 409,
      error: `An evidence item can be filed under at most ${MAX_LINKS_PER_EVIDENCE} questions and tasks`,
      code: 'LINK_LIMIT',
    }
  }
  await emitLinkEvents(db, scope.sessionId, EVIDENCE_LINKED, input, id)
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
  await emitLinkEvents(db, input.sessionId, EVIDENCE_UNLINKED, {
    evidenceId: existing.evidence_id, targetType: existing.target_type, targetId: existing.target_id, actorUserId: input.actorUserId,
  }, existing.id)
  return { ok: true }
}

async function emitLinkEvents(
  db: D1Database,
  sessionId: string,
  eventType: string,
  input: { evidenceId: string; targetType: LinkTargetType; targetId: string; actorUserId: number; viaTip?: boolean },
  linkId: string,
): Promise<void> {
  // Both ends change for the people watching them; no note or titles in the payload.
  const payload = { link_id: linkId, target_type: input.targetType, ...(input.viaTip ? { via: 'tip' } : {}) }
  const createdBy = input.viaTip ? 0 : input.actorUserId
  await emitCopEventLoose(db, {
    copSessionId: sessionId, eventType, entityType: 'evidence', entityId: input.evidenceId, payload, createdBy,
  })
  await emitCopEventLoose(db, {
    copSessionId: sessionId, eventType, entityType: input.targetType, entityId: input.targetId, payload, createdBy,
  })
}

/** SQL: each filing's vote totals in the session (`v.up`, `v.down`), joined on `l.id`; binds the session id. */
const VOTE_TOTALS_JOIN = `LEFT JOIN (
       SELECT link_id, SUM(CASE WHEN value = 1 THEN 1 ELSE 0 END) AS up, SUM(CASE WHEN value = -1 THEN 1 ELSE 0 END) AS down
       FROM cop_evidence_link_votes WHERE cop_session_id = ? GROUP BY link_id
     ) v ON v.link_id = l.id`

const voteValue = (value: unknown): VoteValue => (Number(value) === 1 ? 1 : Number(value) === -1 ? -1 : 0)

/**
 * The session's links, optionally narrowed; [] before migration 0024. Joined to the
 * session's evidence (evidenceInSession), so a link whose evidence is gone or isn't
 * this COP's is never listed. Each carries its votes (`up`, `down`) and `viewerId`'s
 * own (`my_vote`; 0 before migration 0026), ranked per question or task: score
 * (up − down) first, then the newest evidence.
 */
export async function listEvidenceLinks(
  db: D1Database,
  scope: EvidenceSessionScope,
  filter: { targetType?: LinkTargetType; targetId?: string; evidenceId?: string } = {},
  viewerId: number | null = null,
): Promise<ListedEvidenceLink[]> {
  const where = ['l.cop_session_id = ?']
  const binds: unknown[] = [scope.sessionId]
  if (filter.targetType) { where.push('l.target_type = ?'); binds.push(filter.targetType) }
  if (filter.targetId) { where.push('l.target_id = ?'); binds.push(filter.targetId) }
  if (filter.evidenceId) { where.push('l.evidence_id = ?'); binds.push(filter.evidenceId) }
  const run = (withVotes: boolean) => queryEvidenceInSession(
    db,
    `SELECT l.id, l.evidence_id, l.target_type, l.target_id, l.relation, l.note, l.created_at,
       ${withVotes ? 'COALESCE(v.up, 0) AS up, COALESCE(v.down, 0) AS down, COALESCE(mv.value, 0) AS my_vote' : '0 AS up, 0 AS down, 0 AS my_vote'}
     FROM cop_evidence_links l JOIN evidence_items e ON CAST(e.id AS TEXT) = l.evidence_id
     ${withVotes ? `${VOTE_TOTALS_JOIN} LEFT JOIN cop_evidence_link_votes mv ON mv.link_id = l.id AND mv.user_id = ?` : ''}
     WHERE ${where.join(' AND ')} AND {EVIDENCE_SCOPE}
     ORDER BY l.target_type, l.target_id, ${withVotes ? '(COALESCE(v.up, 0) - COALESCE(v.down, 0)) DESC, ' : ''}e.created_at DESC, e.id DESC
     LIMIT 5000`,
    scope, withVotes ? [scope.sessionId, viewerId ?? -1, ...binds] : binds, [],
    (statement) => statement.all<Record<string, unknown>>(),
    'e',
  )
  try {
    let rows: Record<string, unknown>[]
    try {
      rows = (await run(true)).results ?? []
    } catch (error) {
      if (!votesTableMissing(error)) throw error
      rows = (await run(false)).results ?? []
    }
    return rows.map((r) => ({
      id: String(r.id),
      evidence_id: String(r.evidence_id),
      target_type: r.target_type as LinkTargetType,
      target_id: String(r.target_id),
      relation: (cleanRelation(r.relation) ?? 'supports'),
      note: (r.note as string | null) ?? null,
      created_at: String(r.created_at ?? ''),
      up: Number(r.up) || 0,
      down: Number(r.down) || 0,
      my_vote: voteValue(r.my_vote),
    }))
  } catch (error) {
    if (linksTableMissing(error)) return []
    throw error
  }
}

// ── Team votes on a filing ───────────────────────────────────────

/** A vote as the route takes it: 1 (helpful), -1 (not helpful), 0 (clear my vote). */
export function cleanVote(value: unknown): VoteValue | null {
  return value === 1 || value === -1 || value === 0 ? value : null
}

export interface LinkTally {
  link_id: string
  up: number
  down: number
  my_vote: VoteValue
}

export type VoteResult =
  | { ok: true; tally: LinkTally }
  | { ok: false; status: 404; code: 'LINK_NOT_FOUND'; error: string }

/**
 * Set (1 / -1) or clear (0) one collaborator's vote on a filing. The filing must be
 * this session's, with this session's evidence (checked in SQL, as the lists show it);
 * one vote per person per filing (UNIQUE), changed in place. The caller has already
 * checked that `userId` is the owner or a collaborator, and not a service or a share.
 * Throws "no such table" before migration 0026 (the route answers 503).
 */
export async function setLinkVote(
  db: D1Database,
  input: { scope: EvidenceSessionScope; linkId: string; userId: number; value: VoteValue },
): Promise<VoteResult> {
  const { scope, linkId, userId, value } = input
  const link = await queryEvidenceInSession(
    db,
    `SELECT l.id, l.target_type, l.target_id FROM cop_evidence_links l
     JOIN evidence_items e ON CAST(e.id AS TEXT) = l.evidence_id
     WHERE l.id = ? AND l.cop_session_id = ? AND {EVIDENCE_SCOPE}`,
    scope, [linkId, scope.sessionId], [],
    (statement) => statement.first<{ id: string; target_type: LinkTargetType; target_id: string }>(),
    'e',
  )
  if (!link) return { ok: false, status: 404, code: 'LINK_NOT_FOUND', error: 'That filing isn’t in this COP any more' }

  const now = new Date().toISOString()
  const changed = value === 0
    ? await db.prepare('DELETE FROM cop_evidence_link_votes WHERE link_id = ? AND user_id = ? AND cop_session_id = ?')
      .bind(link.id, userId, scope.sessionId).run()
    : await db.prepare(`
        INSERT INTO cop_evidence_link_votes (id, cop_session_id, link_id, user_id, value, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (link_id, user_id) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
        WHERE cop_evidence_link_votes.value <> excluded.value
      `).bind(`evv-${crypto.randomUUID()}`, scope.sessionId, link.id, userId, value, now, now).run()

  const tally = await db.prepare(`
    SELECT COALESCE(SUM(CASE WHEN value = 1 THEN 1 ELSE 0 END), 0) AS up,
           COALESCE(SUM(CASE WHEN value = -1 THEN 1 ELSE 0 END), 0) AS down,
           COALESCE(MAX(CASE WHEN user_id = ? THEN value END), 0) AS my_vote
    FROM cop_evidence_link_votes WHERE link_id = ? AND cop_session_id = ?
  `).bind(userId, link.id, scope.sessionId).first<{ up: number; down: number; my_vote: number }>()
  const result: LinkTally = {
    link_id: link.id,
    up: Number(tally?.up) || 0,
    down: Number(tally?.down) || 0,
    my_vote: voteValue(tally?.my_vote),
  }
  // Everyone watching the question re-ranks it. Counts only: never who voted.
  if ((changed.meta?.changes ?? 0) > 0) {
    await emitCopEventLoose(db, {
      copSessionId: scope.sessionId,
      eventType: EVIDENCE_LINK_VOTED,
      entityType: link.target_type,
      entityId: link.target_id,
      payload: { link_id: link.id, up: result.up, down: result.down },
      createdBy: 0,
    })
  }
  return { ok: true, tally: result }
}

/** SQL (on evidence_items as `e`): a drop-form tip no editor has reviewed yet. Needs migration 0022. */
const UNREVIEWED_TIP_SQL = "(e.source_channel = 'drop' AND (e.credibility IS NULL OR e.credibility = 'unverified'))"

export interface FiledCounts {
  /** Everything filed under it that is the session's evidence. */
  all: number
  /** Unreviewed drop-form tips among them (what a share leaves out of its count). */
  unreviewed: number
}

/**
 * How much evidence is filed under each of these RFIs/tasks: only links whose evidence
 * is the session's (evidenceInSession), so an orphaned link never counts. Empty before
 * migration 0024; `unreviewed` is 0 before migration 0022.
 */
export async function filedCounts(
  db: D1Database,
  scope: EvidenceSessionScope,
  targetType: LinkTargetType,
  targetIds: readonly string[],
): Promise<Map<string, FiledCounts>> {
  const counts = new Map<string, FiledCounts>()
  if (targetIds.length === 0) return counts
  const run = async (chunk: readonly string[], unreviewedSql: string) => queryEvidenceInSession(
    db,
    `SELECT l.target_id, COUNT(*) AS n, SUM(CASE WHEN ${unreviewedSql} THEN 1 ELSE 0 END) AS tips
     FROM cop_evidence_links l JOIN evidence_items e ON CAST(e.id AS TEXT) = l.evidence_id
     WHERE l.cop_session_id = ? AND l.target_type = ? AND l.target_id IN (${chunk.map(() => '?').join(',')})
       AND {EVIDENCE_SCOPE}
     GROUP BY l.target_id`,
    scope, [scope.sessionId, targetType, ...chunk], [],
    (statement) => statement.all<{ target_id: string; n: number; tips: number }>(),
    'e',
  )
  try {
    for (let i = 0; i < targetIds.length; i += 90) {
      const chunk = targetIds.slice(i, i + 90)
      let rows
      try {
        rows = await run(chunk, UNREVIEWED_TIP_SQL)
      } catch (error) {
        if (!isMissingColumn(error) || linksTableMissing(error)) throw error
        rows = await run(chunk, '0 = 1')
      }
      for (const row of rows.results ?? []) {
        counts.set(String(row.target_id), { all: Number(row.n) || 0, unreviewed: Number(row.tips) || 0 })
      }
    }
  } catch (error) {
    if (!linksTableMissing(error)) throw error
  }
  return counts
}

/** The number of evidence items filed under each of these RFIs/tasks (for the team). */
export async function evidenceCounts(
  db: D1Database,
  scope: EvidenceSessionScope,
  targetType: LinkTargetType,
  targetIds: readonly string[],
): Promise<Map<string, number>> {
  const out = new Map<string, number>()
  for (const [id, c] of await filedCounts(db, scope, targetType, targetIds)) out.set(id, c.all)
  return out
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

/** Remove every link of an evidence item deleted outside a COP route (the evidence library). */
export async function deleteLinksOfEvidenceAnywhere(db: D1Database, evidenceId: string): Promise<void> {
  try {
    await db.prepare('DELETE FROM cop_evidence_links WHERE evidence_id = ?').bind(evidenceId).run()
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
  /** null for an unreviewed drop-form tip: its tipster's say-so is not shown. */
  relation: LinkRelation | null
  created_at: string
  /** The team's votes on this filing (counts only; 0 before migration 0026). */
  up: number
  down: number
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

/** Per question, at most this many evidence items in a share payload (best ranked first). */
export const PUBLIC_EVIDENCE_PER_QUESTION = 20

/**
 * The evidence filed under these RFIs, for a share showing the evidence panel: title,
 * link (http(s) only), credibility, relation, date and the team's vote counts, ranked
 * as the workspace ranks them (score, then newest), at most
 * PUBLIC_EVIDENCE_PER_QUESTION per question (limited in SQL). Only the session's
 * evidence; an unreviewed drop-form tip shows as "Unverified tip" without its link or
 * relation, exactly as the share's evidence list does (its counts show). Never notes,
 * descriptions or who voted.
 */
export async function publicEvidenceByRfi(
  db: D1Database,
  scope: EvidenceSessionScope,
  rfiIds: readonly string[],
): Promise<Map<string, PublicLinkedEvidence[]>> {
  const out = new Map<string, PublicLinkedEvidence[]>()
  if (rfiIds.length === 0) return out
  const ids = rfiIds.slice(0, 200)
  const marks = ids.map(() => '?').join(',')
  const query = (columns: string, withVotes: boolean) => queryEvidenceInSession(
    db,
    `SELECT target_id, relation, up, down, ${columns} FROM (
       SELECT l.target_id, l.relation, ${columns.split(', ').map((c) => `e.${c}`).join(', ')},
         ${withVotes ? 'COALESCE(v.up, 0) AS up, COALESCE(v.down, 0) AS down' : '0 AS up, 0 AS down'},
         ROW_NUMBER() OVER (
           PARTITION BY l.target_id
           ORDER BY ${withVotes ? '(COALESCE(v.up, 0) - COALESCE(v.down, 0)) DESC, ' : ''}e.created_at DESC, e.id DESC
         ) AS rn
       FROM cop_evidence_links l JOIN evidence_items e ON CAST(e.id AS TEXT) = l.evidence_id
       ${withVotes ? VOTE_TOTALS_JOIN : ''}
       WHERE l.cop_session_id = ? AND l.target_type = 'rfi' AND l.target_id IN (${marks}) AND {EVIDENCE_SCOPE}
     ) WHERE rn <= ${PUBLIC_EVIDENCE_PER_QUESTION}
     ORDER BY target_id, rn`,
    scope, withVotes ? [scope.sessionId, scope.sessionId, ...ids] : [scope.sessionId, ...ids], [],
    (statement) => statement.all<Record<string, unknown>>(),
    'e',
  )
  const queryColumns = async (withVotes: boolean) => {
    try {
      return (await query('title, source_url, credibility, source_channel, created_at', withVotes)).results ?? []
    } catch (error) {
      if (!isMissingColumn(error) || linksTableMissing(error)) throw error
      return (await query('title, source_url, credibility, created_at', withVotes)).results ?? []
    }
  }
  let rows: Record<string, unknown>[]
  try {
    try {
      rows = await queryColumns(true)
    } catch (error) {
      if (!votesTableMissing(error)) throw error
      rows = await queryColumns(false)
    }
  } catch (error) {
    if (linksTableMissing(error)) return out
    throw error
  }
  for (const row of rows) {
    const key = String(row.target_id)
    const list = out.get(key) ?? []
    const unreviewed = unreviewedTipEvidence(row)
    list.push({
      title: unreviewed ? UNVERIFIED_TIP_LABEL : String(row.title ?? '').slice(0, 300),
      url: unreviewed ? null : httpUrl(row.source_url),
      credibility: (row.credibility as string | null) ?? null,
      relation: unreviewed ? null : (cleanRelation(row.relation) ?? 'supports'),
      created_at: String(row.created_at ?? ''),
      up: Number(row.up) || 0,
      down: Number(row.down) || 0,
    })
    out.set(key, list)
  }
  return out
}

// ── "Which question does this help answer?" on a COP's evidence form ──

export interface QuestionChoice {
  id: string
  question: string
  /** A key question (starred RFI): listed first, starred in the form. */
  key: boolean
}

/**
 * Where the evidence form was opened, which decides the questions it may offer:
 * - nothing: the standalone /drop/<token> link — the COP's key questions, and only
 *   when the form's owner turned the picker on (survey_drops.question_picker);
 * - `shareToken`: the Submit sheet of a share link that offers evidence — besides the
 *   above, the questions that share shows (its `questions` panel: key questions; its
 *   `rfi` panel: every RFI);
 * - `ticketSessionId`: a collaborator's workspace (a verified question ticket,
 *   functions/api/_shared/cop-question-ticket.ts) — every question of the COP.
 */
export interface QuestionContext {
  shareToken?: string | null
  ticketSessionId?: string | null
}

const SHARE_TOKEN_RE = /^[A-Za-z0-9_-]{8,128}$/

/** The panels of a live share of this session that offers evidence; null for anything else. */
async function evidenceSharePanels(db: D1Database, shareToken: string, sessionId: string): Promise<string[] | null> {
  if (!SHARE_TOKEN_RE.test(shareToken)) return null
  const share = await db.prepare('SELECT * FROM cop_shares WHERE share_token = ? AND cop_session_id = ?')
    .bind(shareToken, sessionId).first<Record<string, unknown>>()
  if (!share || shareExpired(share) || Number(share.allow_evidence) !== 1) return null
  return sharePanels(share)
}

/**
 * The open questions (any RFI not closed) a COP-linked evidence form offers, by where it
 * was opened (QuestionContext), key questions first. Only for a form made by the
 * session's owner or a current editor/admin collaborator (the rule auto-ingest uses),
 * only that session's RFIs, never on an archived session. [] otherwise, or before
 * migrations 0022/0024.
 */
export async function questionChoicesForForm(
  db: D1Database,
  formId: string,
  context: QuestionContext = {},
): Promise<QuestionChoice[]> {
  try {
    const form = await db.prepare(`
      SELECT d.cop_session_id AS session_id, d.question_picker FROM survey_drops d
      JOIN cop_sessions s ON s.id = d.cop_session_id
      WHERE d.id = ? AND upper(coalesce(s.status, '')) <> 'ARCHIVED'
        AND (
          s.created_by = d.created_by
          OR EXISTS (
            SELECT 1 FROM cop_collaborators c
            WHERE c.cop_session_id = s.id AND c.user_id = d.created_by
              AND lower(trim(c.role)) IN ('editor', 'admin')
          )
        )
    `).bind(formId).first<{ session_id: string; question_picker: number | null }>()
    if (!form) return []

    let keyQuestions = Number(form.question_picker) === 1
    let everyQuestion = false
    if (context.ticketSessionId && context.ticketSessionId === form.session_id) {
      keyQuestions = everyQuestion = true
    } else if (context.shareToken) {
      const panels = await evidenceSharePanels(db, context.shareToken, form.session_id)
      if (panels?.includes('questions')) keyQuestions = true
      if (panels?.includes('rfi')) everyQuestion = true
    }
    if (!keyQuestions && !everyQuestion) return []

    const rows = await db.prepare(`
      SELECT r.id, r.question, r.is_key FROM cop_rfis r
      WHERE r.cop_session_id = ? AND lower(coalesce(r.status, 'open')) <> 'closed'
        ${everyQuestion ? '' : 'AND r.is_key = 1'}
      ORDER BY r.is_key DESC, r.created_at ASC, r.rowid ASC
      LIMIT 100
    `).bind(form.session_id).all<{ id: string; question: string; is_key: number | null }>()
    return (rows.results ?? []).map((r) => ({
      id: String(r.id),
      question: String(r.question ?? '').slice(0, 500),
      key: Number(r.is_key) === 1,
    }))
  } catch (error) {
    if (isMissingColumn(error)) return []
    throw error
  }
}

/** The standalone form's choices (no context): key questions, when the picker is on. */
export function questionChoicesForDrop(db: D1Database, formId: string): Promise<QuestionChoice[]> {
  return questionChoicesForForm(db, formId)
}

/**
 * The form field names a tipster's choices travel in (helper keys: not shown as answers).
 * `_questions` is [{ id, relation }]; the single `_question` / `_question_relation` pair
 * comes from forms loaded before multi-select and counts as a one-element list.
 */
export const QUESTIONS_FIELD = '_questions'
export const QUESTION_FIELD = '_question'
export const QUESTION_RELATION_FIELD = '_question_relation'
/** Questions one tip may be filed under. */
export const MAX_QUESTIONS_PER_TIP = 5

const QUESTION_ID_RE = /^[A-Za-z0-9_.:-]{1,80}$/

export interface QuestionPick {
  rfiId: string
  relation: LinkRelation
}

const NOT_OFFERED = 'A question you picked can’t take evidence from this form now. Untick it, or leave them all unticked (not about a specific question).'

/**
 * The questions a submission names, as written: `_questions` plus the legacy single
 * `_question`, duplicates collapsed (the first relation wins). null when malformed: not
 * a list, an entry without a valid id, an unknown relation, or more than
 * MAX_QUESTIONS_PER_TIP distinct questions. Not checked against anything yet.
 */
export function parseQuestionPicks(formData: Record<string, unknown>): QuestionPick[] | null {
  const entries: { id: unknown; relation: unknown }[] = []
  const list = formData[QUESTIONS_FIELD]
  if (list !== undefined && list !== null) {
    if (!Array.isArray(list) || list.length > MAX_QUESTIONS_PER_TIP * 4) return null
    for (const item of list) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return null
      entries.push({ id: (item as { id?: unknown }).id, relation: (item as { relation?: unknown }).relation })
    }
  }
  const single = formData[QUESTION_FIELD]
  if (single !== undefined && single !== null && single !== '') {
    entries.push({ id: single, relation: formData[QUESTION_RELATION_FIELD] })
  }
  const picks: QuestionPick[] = []
  for (const entry of entries) {
    const id = typeof entry.id === 'string' ? entry.id.trim() : ''
    if (!QUESTION_ID_RE.test(id)) return null
    const relation = cleanRelation(entry.relation)
    if (!relation) return null
    if (!picks.some((p) => p.rfiId === id)) picks.push({ rfiId: id, relation })
  }
  return picks.length > MAX_QUESTIONS_PER_TIP ? null : picks
}

export type ChosenQuestions =
  | { ok: true; picks: QuestionPick[] }
  | { ok: false; error: string }

/**
 * The questions a submission names, every one checked against the questions the form
 * offered in its context (questionChoicesForForm). None named → []. Any one the form
 * didn't offer (another COP's, closed, not shown to this caller), or a malformed list,
 * refuses the whole submission: nothing is stored or filed.
 */
export async function chosenQuestionsForSubmission(
  db: D1Database,
  formId: string,
  formData: Record<string, unknown>,
  context: QuestionContext,
): Promise<ChosenQuestions> {
  const picks = parseQuestionPicks(formData)
  if (picks === null) return { ok: false, error: NOT_OFFERED }
  if (picks.length === 0) return { ok: true, picks }
  const offered = new Set((await questionChoicesForForm(db, formId, context)).map((choice) => choice.id))
  if (!picks.every((pick) => offered.has(pick.rfiId))) return { ok: false, error: NOT_OFFERED }
  return { ok: true, picks }
}

/** The checked choices as survey_responses.question_choices stores them (null for none). */
export function storedQuestionChoices(picks: readonly QuestionPick[]): string | null {
  return picks.length > 0 ? JSON.stringify(picks.map((p) => ({ id: p.rfiId, relation: p.relation }))) : null
}

/** survey_responses.question_choices read back; anything off-shape is dropped. */
function readStoredChoices(raw: unknown): QuestionPick[] {
  if (typeof raw !== 'string' || !raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parseQuestionPicks({ [QUESTIONS_FIELD]: parsed.slice(0, MAX_QUESTIONS_PER_TIP) }) ?? []
  } catch {
    return []
  }
}

/**
 * File an ingested tip under each question its tipster chose. A submission made after
 * migration 0026 carries the choices drop-submit checked (survey_responses.question_choices);
 * an older one, its `_question(s)` answers, of which only the standalone form's key
 * questions are filed (checked again here). Every RFI must be this session's (in SQL).
 * Whether it was closed since is not checked again: a reviewer accepting the tip after a
 * question closed still files it there, which is fine (a closed question keeps its
 * evidence). Best effort per question: a bad or stale one files nothing. Returns the
 * RFI ids filed.
 */
export async function fileTipUnderChosenQuestions(
  db: D1Database,
  input: {
    formId: string
    responseId: string
    scope: EvidenceSessionScope
    evidenceId: string
    formData: Record<string, unknown>
    actorUserId: number
  },
): Promise<string[]> {
  let stored: { question_choices: string | null } | null = null
  try {
    stored = await db.prepare('SELECT question_choices FROM survey_responses WHERE id = ? AND cop_session_id = ?')
      .bind(input.responseId, input.scope.sessionId).first()
  } catch (error) {
    if (!isMissingColumn(error)) throw error
  }

  let picks = readStoredChoices(stored?.question_choices)
  if (picks.length === 0 && !stored?.question_choices) {
    const legacy = parseQuestionPicks(input.formData) ?? []
    if (legacy.length > 0) {
      const offered = new Set((await questionChoicesForForm(db, input.formId)).map((choice) => choice.id))
      picks = legacy.filter((pick) => offered.has(pick.rfiId))
    }
  }

  const filed: string[] = []
  for (const pick of picks) {
    try {
      const inSession = await db.prepare('SELECT id FROM cop_rfis WHERE id = ? AND cop_session_id = ?')
        .bind(pick.rfiId, input.scope.sessionId).first()
      if (!inSession) continue
      const result = await upsertEvidenceLink(db, {
        scope: input.scope,
        evidenceId: input.evidenceId,
        targetType: 'rfi',
        targetId: pick.rfiId,
        relation: pick.relation,
        note: null,
        actorUserId: input.actorUserId,
        serviceUserId: null,
        viaTip: true,
      })
      if (result.ok) filed.push(result.link.target_id)
    } catch (error) {
      if (linksTableMissing(error)) throw error
      console.error('[cop-evidence-links] tip not filed under one question:', error instanceof Error ? error.message : error)
    }
  }
  return filed
}
