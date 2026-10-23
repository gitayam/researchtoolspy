/**
 * Evidence filed under questions (RFIs, key questions) and tasks: the client side of
 * /api/cop/:id/evidence-links and /api/cop/:id/rfis/:rfiId/evidence (migration 0024).
 *
 * Filing evidence never answers or closes a question — it records that the item bears
 * on it (supports, contradicts, or context) so a question can collect evidence over
 * time. The pure helpers here are unit-tested (tests/unit/cop-evidence-links-ui.test.mjs).
 */
import { copRequest, NOT_AVAILABLE, notifyCopChanged, type CopRequestResult } from '@/lib/cop-request'
import type { CopEvidenceLink, CopEvidenceLinkTarget, CopEvidenceRelation, CopVoteValue } from '@/types/cop'

export const RELATION_OPTIONS: { value: CopEvidenceRelation; label: string; hint: string }[] = [
  { value: 'supports', label: 'Supports', hint: 'Points toward an answer' },
  { value: 'contradicts', label: 'Contradicts', hint: 'Points against it' },
  { value: 'context', label: 'Context', hint: 'Background, not a direct answer' },
]

export const RELATION_LABEL: Record<CopEvidenceRelation, string> = {
  supports: 'Supports',
  contradicts: 'Contradicts',
  context: 'Context',
}

export const NOTE_MAX = 1000

/** A stable key for one RFI or task. */
export const targetKey = (type: CopEvidenceLinkTarget, id: string) => `${type}:${id}`

/** Links grouped by the question or task they are filed under. */
export function groupByTarget(links: readonly CopEvidenceLink[]): Map<string, CopEvidenceLink[]> {
  const out = new Map<string, CopEvidenceLink[]>()
  for (const link of links) {
    const key = targetKey(link.target_type, link.target_id)
    const list = out.get(key)
    if (list) list.push(link)
    else out.set(key, [link])
  }
  return out
}

// ── Team votes and ranking ───────────────────────────────────────

/** A filing's score: helpful votes minus not-helpful ones. */
export const voteScore = (item: { up?: number; down?: number }) => (item.up ?? 0) - (item.down ?? 0)

/**
 * Filed evidence in the order a question shows it: score (up − down) first, then the
 * newest. The server sends lists in this order; the client re-ranks after a vote. Pure.
 */
export function rankFiled<T extends { up?: number; down?: number }>(items: readonly T[], createdAt: (item: T) => string): T[] {
  const time = (item: T) => {
    const at = Date.parse(createdAt(item))
    return Number.isFinite(at) ? at : 0
  }
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => voteScore(b.item) - voteScore(a.item) || time(b.item) - time(a.item) || a.index - b.index)
    .map(({ item }) => item)
}

/** The vote a press sends: pressing the vote you already gave clears it. */
export function nextVote(current: CopVoteValue, pressed: 1 | -1): CopVoteValue {
  return current === pressed ? 0 : pressed
}

/** A filing's counts once `next` replaces the caller's `current` vote (the optimistic update). */
export function applyVote<T extends { up: number; down: number; my_vote: CopVoteValue }>(item: T, next: CopVoteValue): T {
  const up = item.up - (item.my_vote === 1 ? 1 : 0) + (next === 1 ? 1 : 0)
  const down = item.down - (item.my_vote === -1 ? 1 : 0) + (next === -1 ? 1 : 0)
  return { ...item, up: Math.max(0, up), down: Math.max(0, down), my_vote: next }
}

const voteOf = (value: unknown): CopVoteValue => (value === 1 ? 1 : value === -1 ? -1 : 0)
const countOf = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0)

/** A link as the client keeps it: votes default to none (a server before migration 0026). */
export function normalizeLink(raw: Partial<CopEvidenceLink> & Pick<CopEvidenceLink, 'id' | 'evidence_id' | 'target_type' | 'target_id' | 'relation'>): CopEvidenceLink {
  return {
    id: String(raw.id),
    evidence_id: String(raw.evidence_id),
    target_type: raw.target_type,
    target_id: String(raw.target_id),
    relation: raw.relation,
    note: raw.note ?? null,
    created_at: raw.created_at ?? '',
    up: countOf(raw.up),
    down: countOf(raw.down),
    my_vote: voteOf(raw.my_vote),
  }
}

/** The message for a failed vote. */
export function voteErrorMessage(res: { status: number; code: string | null; error: string | null }): string {
  if (res.code === NOT_AVAILABLE || res.code === 'EVIDENCE_VOTES_UNAVAILABLE') return 'Voting isn’t available on this server yet.'
  if (res.status === 0) return 'Couldn’t reach the server. Your vote wasn’t saved.'
  if (res.status === 429 || res.code === 'VOTE_RATE_LIMITED') return 'Slow down: too many votes in a minute. Try again shortly.'
  if (res.status === 401) return 'Sign in to vote.'
  if (res.status === 403) return 'Only the COP’s team can vote.'
  if (res.code === 'LINK_NOT_FOUND') return 'That evidence isn’t filed here any more.'
  return 'Your vote wasn’t saved. Try again.'
}

// ── "Which questions does this help answer?" (the evidence form) ───

/** Questions one tip may be filed under (the server refuses more). */
export const MAX_QUESTIONS_PER_TIP = 5

/** A question ticked on the evidence form, with how the tip bears on it. */
export interface QuestionPick {
  id: string
  relation: CopEvidenceRelation
}

/** Tick or untick a question; a new tick says "supports"; never more than the limit. Pure. */
export function togglePick(picks: readonly QuestionPick[], id: string): QuestionPick[] {
  if (picks.some((p) => p.id === id)) return picks.filter((p) => p.id !== id)
  if (picks.length >= MAX_QUESTIONS_PER_TIP) return [...picks]
  return [...picks, { id, relation: 'supports' }]
}

/** Change how the tip bears on one ticked question. Pure. */
export function setPickRelation(picks: readonly QuestionPick[], id: string, relation: CopEvidenceRelation): QuestionPick[] {
  return picks.map((p) => (p.id === id ? { ...p, relation } : p))
}

/** What the form starts with: the question "+ Add evidence" was pressed on, if offered; else none. */
export function preselectPicks(initialId: string | null, offeredIds: readonly string[]): QuestionPick[] {
  return initialId && offeredIds.includes(initialId) ? [{ id: initialId, relation: 'supports' }] : []
}

/** Ticks still offered after the list reloads (e.g. the workspace's wider list arrived). Pure. */
export function keepOffered(picks: readonly QuestionPick[], offeredIds: readonly string[]): QuestionPick[] {
  return picks.filter((p) => offeredIds.includes(p.id))
}

/** "Filed under …": one question by name, several by count. */
export function filedUnderLabel(count: number): string {
  return count === 1 ? 'Filed under:' : `Filed under ${count} questions:`
}

/** Links grouped by evidence item. */
export function groupByEvidence(links: readonly CopEvidenceLink[]): Map<string, CopEvidenceLink[]> {
  const out = new Map<string, CopEvidenceLink[]>()
  for (const link of links) {
    const list = out.get(link.evidence_id)
    if (list) list.push(link)
    else out.set(link.evidence_id, [link])
  }
  return out
}

/** The evidence ids filed under one question (for the feed's "Evidence for" filter). */
export function evidenceIdsFor(links: readonly CopEvidenceLink[], type: CopEvidenceLinkTarget, id: string): Set<string> {
  const out = new Set<string>()
  for (const link of links) if (link.target_type === type && link.target_id === id) out.add(link.evidence_id)
  return out
}

/** What the "File under question" picker wants for one evidence item: question id → relation, absent = not filed. */
export type FilingChoice = Record<string, CopEvidenceRelation>

/**
 * The calls that turn the item's current filings into the chosen ones: new links to
 * create, existing links whose relation changed, and links to remove. Pure.
 */
export function planFiling(
  current: readonly CopEvidenceLink[],
  wanted: FilingChoice,
  targetType: CopEvidenceLinkTarget = 'rfi',
): { add: { targetId: string; relation: CopEvidenceRelation }[]; update: { targetId: string; relation: CopEvidenceRelation }[]; remove: CopEvidenceLink[] } {
  const mine = current.filter((l) => l.target_type === targetType)
  const byTarget = new Map(mine.map((l) => [l.target_id, l]))
  const add: { targetId: string; relation: CopEvidenceRelation }[] = []
  const update: { targetId: string; relation: CopEvidenceRelation }[] = []
  for (const [targetId, relation] of Object.entries(wanted)) {
    const existing = byTarget.get(targetId)
    if (!existing) add.push({ targetId, relation })
    else if (existing.relation !== relation) update.push({ targetId, relation })
  }
  const remove = mine.filter((l) => !(l.target_id in wanted))
  return { add, update, remove }
}

/** A link a person typed: http(s) only (javascript:, data: and the rest are refused). */
export function cleanLinkInput(raw: string): string | null {
  const text = raw.trim()
  if (!text) return null
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null
  } catch {
    return null
  }
}

/** The message for a failed filing call, by the server's code and status. */
export function linkErrorMessage(res: { status: number; code: string | null; error: string | null }): string {
  if (res.code === NOT_AVAILABLE || res.code === 'EVIDENCE_LINKS_UNAVAILABLE') {
    return 'Filing evidence under questions isn’t available on this server yet.'
  }
  if (res.status === 0) return 'Couldn’t reach the server. Check your connection and try again.'
  if (res.status === 401) return 'Sign in to file evidence.'
  if (res.status === 403) return res.code === 'NOT_OWN_LINK' ? 'Only the person who filed it can change this.' : 'Only the COP’s owner or an editor can file evidence.'
  if (res.code === 'EVIDENCE_NOT_FOUND') return 'That evidence item isn’t in this COP any more.'
  if (res.code === 'TARGET_NOT_FOUND') return 'That question isn’t in this COP any more.'
  return res.error ?? 'Couldn’t save that. Try again.'
}

// ── API ──────────────────────────────────────────────────────────

const base = (sessionId: string) => `/api/cop/${encodeURIComponent(sessionId)}`

export async function fetchEvidenceLinks(sessionId: string): Promise<CopRequestResult<{ links: CopEvidenceLink[] }>> {
  const res = await copRequest<{ links: CopEvidenceLink[] }>(`${base(sessionId)}/evidence-links`, { newRoute: true })
  if (res.ok === false) return res
  const links = Array.isArray(res.data.links) ? res.data.links.map(normalizeLink) : []
  return { ...res, data: { links } }
}

/** Vote on a filing: 1 helpful, -1 not helpful, 0 clears. Answers the new counts. */
export async function voteOnLink(
  sessionId: string,
  linkId: string,
  value: CopVoteValue,
): Promise<CopRequestResult<{ link_id: string; up: number; down: number; my_vote: CopVoteValue }>> {
  return copRequest(`${base(sessionId)}/evidence-links/${encodeURIComponent(linkId)}/vote`, {
    method: 'PUT',
    newRoute: true,
    json: { value },
  })
}

/** A question ticket: lets the workspace's evidence form offer every open question. */
export async function fetchQuestionTicket(sessionId: string): Promise<string | null> {
  const res = await copRequest<{ ticket?: unknown }>(`${base(sessionId)}/question-ticket`, { newRoute: true })
  return res.ok === true && typeof res.data.ticket === 'string' ? res.data.ticket : null
}

export async function fileEvidence(
  sessionId: string,
  input: { evidenceId: string; targetType: CopEvidenceLinkTarget; targetId: string; relation: CopEvidenceRelation; note?: string | null },
): Promise<CopRequestResult<{ link: CopEvidenceLink }>> {
  const res = await copRequest<{ link: CopEvidenceLink }>(`${base(sessionId)}/evidence-links`, {
    method: 'POST',
    newRoute: true,
    json: {
      evidence_id: input.evidenceId,
      target_type: input.targetType,
      target_id: input.targetId,
      relation: input.relation,
      ...(input.note !== undefined ? { note: input.note } : {}),
    },
  })
  if (res.ok) notifyCopChanged(['evidence', input.targetType])
  return res
}

export async function unfileEvidence(sessionId: string, link: CopEvidenceLink): Promise<CopRequestResult<{ ok: true }>> {
  const res = await copRequest<{ ok: true }>(`${base(sessionId)}/evidence-links?id=${encodeURIComponent(link.id)}`, {
    method: 'DELETE',
    newRoute: true,
  })
  if (res.ok) notifyCopChanged(['evidence', link.target_type])
  return res
}

/** Add a link or a titled note under a question in one call (creates or reuses the evidence item). */
export async function addEvidenceToQuestion(
  sessionId: string,
  rfiId: string,
  input: { url?: string; title?: string; note?: string; relation: CopEvidenceRelation },
): Promise<CopRequestResult<{ evidence: { id: number; title: string; source_url: string | null }; link: CopEvidenceLink; duplicate: boolean }>> {
  const res = await copRequest<{ evidence: { id: number; title: string; source_url: string | null }; link: CopEvidenceLink; duplicate: boolean }>(
    `${base(sessionId)}/rfis/${encodeURIComponent(rfiId)}/evidence`,
    { method: 'POST', newRoute: true, json: input },
  )
  if (res.ok) notifyCopChanged(['evidence', 'rfi'])
  return res
}

/** A task has no one-call route: create the evidence item (or reuse it), then file it. */
export async function addEvidenceToTask(
  sessionId: string,
  taskId: string,
  input: { url?: string; title?: string; note?: string; relation: CopEvidenceRelation },
): Promise<CopRequestResult<{ link: CopEvidenceLink }>> {
  const title = input.title?.trim() || (input.url ? new URL(input.url).host : (input.note ?? '').split('\n')[0].slice(0, 120))
  const created = await copRequest<Record<string, unknown>>(`${base(sessionId)}/evidence`, {
    method: 'POST',
    json: { title, url: input.url, content: '' },
  })
  if (created.ok === false) return created
  const raw = created.data.id ?? (created.data.evidence as { id?: unknown } | undefined)?.id
  const evidenceId = raw === undefined || raw === null ? '' : String(raw)
  if (!/^\d+$/.test(evidenceId)) return { ok: false, status: 500, code: null, error: 'The evidence item was not created.' }
  return fileEvidence(sessionId, { evidenceId, targetType: 'task', targetId: taskId, relation: input.relation, note: input.note ?? null })
}
