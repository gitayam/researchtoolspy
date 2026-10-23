/**
 * The COP → chat feed: what happened in a COP, worded for people reading a chat
 * (GET /api/cop/:id/chat-feed; the contract is at the top of that route).
 *
 * Built on the change feed's cursor (cop_events rowid, resolveSinceCursor). Each event
 * is read server-side with its created_by and payload; neither leaves. Then:
 *   1. No echo: an event whose created_by is the calling service's principal (the
 *      Signal bot) is left out, so what the chat sent, and the bot's own syncs, never
 *      come back. The team's changes to those items do.
 *   2. Noise and what the feed doesn't cover are skipped and counted (`skipped`):
 *      votes, the middleware's generic entity.changed, events without an entity id,
 *      system timeline lines, tags, uploads, submissions, personas, shares, sessions,
 *      playbooks and team activity.
 *   3. Events on one entity in one page become one item, with the entity's current
 *      state; the action is picked by rank (see chooseAction). An item created and
 *      deleted within the page is skipped.
 *   4. Titles, statuses and labels are read from the entity rows, each query scoped to
 *      the session IN SQL (evidence through evidenceInSession). An id that doesn't
 *      resolve in this session yields nothing, except a deletion (no title).
 *
 * Unreviewed anonymous input keeps its text out of the chat, as share links do
 * (maskTipEvidenceRow): a drop-form tip still 'unverified', a tip marker still
 * POSSIBLE, and an answer from a share link nobody accepted come with labels and no
 * title or domain. Once an editor reviews them, the next item carries the text.
 *
 * Never in an item: user ids, names, emails, assignees, responders, full URLs,
 * coordinates, upload ids, payloads.
 */
import { resolveSinceCursor } from './cop-events'
import { evidenceInSession, isMissingColumn, type EvidenceSessionScope } from './cop-input'

export const CHAT_FEED_DEFAULT_LIMIT = 50
export const CHAT_FEED_MAX_LIMIT = 100
/** Event rows read per request at most (echoes and skips included). */
export const CHAT_FEED_SCAN_MAX = 500
export const CHAT_TITLE_MAX = 140

export const CHAT_KINDS = [
  'rfi', 'answer', 'task', 'evidence', 'evidence_link', 'marker', 'timeline', 'hypothesis', 'claim',
] as const
export type ChatKind = (typeof CHAT_KINDS)[number]

export const CHAT_ACTIONS = [
  'created', 'updated', 'status', 'answered', 'closed', 'reopened', 'confirmed', 'assigned',
  'starred', 'unstarred', 'filed', 'unfiled', 'deleted',
] as const
export type ChatAction = (typeof CHAT_ACTIONS)[number]
export type ChatActor = 'team' | 'anonymous' | 'system'
export type ChatRelation = 'supports' | 'contradicts' | 'context'

export interface ChatFeedItem {
  event_id: string
  at: string | null
  kind: ChatKind
  action: ChatAction
  entity_id: string
  title: string | null
  status: string | null
  labels: string[]
  actor: ChatActor
  question_id?: string
  question_title?: string
  task_id?: string
  evidence_id?: string
  relation?: ChatRelation
  domain?: string
}

export type ChatFeedResult =
  | { ok: true; items: ChatFeedItem[]; cursor: string; has_more: boolean; skipped: number; echoes: number }
  | { ok: false; status: 400; error: string }

export function chatFeedLimit(raw: string | null): number {
  const n = Number.parseInt(raw ?? '', 10)
  if (!Number.isFinite(n) || n < 1) return CHAT_FEED_DEFAULT_LIMIT
  return Math.min(n, CHAT_FEED_MAX_LIMIT)
}

// ── Events → (kind, action) ──────────────────────────────────────

/** Event types with one kind and action. The entity_type must match the kind. */
const SIMPLE_EVENTS: Readonly<Record<string, readonly [ChatKind, ChatAction]>> = {
  'rfi.created': ['rfi', 'created'],
  'rfi.updated': ['rfi', 'updated'],
  'rfi.starred': ['rfi', 'starred'],
  'rfi.unstarred': ['rfi', 'unstarred'],
  'rfi.accepted': ['rfi', 'answered'],
  'rfi.closed': ['rfi', 'closed'],
  'rfi.reopened': ['rfi', 'reopened'],
  'rfi.overdue': ['rfi', 'status'],
  'rfi.deleted': ['rfi', 'deleted'],
  'task.created': ['task', 'created'],
  'task.updated': ['task', 'updated'],
  'task.priority_changed': ['task', 'updated'],
  'task.assigned': ['task', 'assigned'],
  'task.started': ['task', 'status'],
  'task.blocked': ['task', 'status'],
  'task.unblocked': ['task', 'status'],
  'task.overdue': ['task', 'status'],
  'task.completed': ['task', 'closed'],
  'task.reopened': ['task', 'reopened'],
  'task.deleted': ['task', 'deleted'],
  'evidence.created': ['evidence', 'created'],
  'evidence.updated': ['evidence', 'updated'],
  'evidence.reviewed': ['evidence', 'status'],
  'evidence.deleted': ['evidence', 'deleted'],
  'marker.created': ['marker', 'created'],
  'marker.updated': ['marker', 'updated'],
  'marker.confirmed': ['marker', 'confirmed'],
  'marker.deleted': ['marker', 'deleted'],
  'timeline.created': ['timeline', 'created'],
  'timeline.updated': ['timeline', 'updated'],
  'timeline.deleted': ['timeline', 'deleted'],
  'hypothesis.created': ['hypothesis', 'created'],
  'hypothesis.updated': ['hypothesis', 'updated'],
  'hypothesis.evidence_linked': ['hypothesis', 'filed'],
  'hypothesis.deleted': ['hypothesis', 'deleted'],
  'claim.created': ['claim', 'created'],
  'claim.updated': ['claim', 'status'],
  'claim.deleted': ['claim', 'deleted'],
}

/** Filing evidence under a question or task: one event per end, one item per filing. */
const LINK_EVENTS: Readonly<Record<string, ChatAction>> = {
  'evidence.linked': 'filed',
  'evidence.link_updated': 'updated',
  'evidence.unlinked': 'unfiled',
}

interface EventRow {
  seq: number
  id: string
  event_type: string
  entity_type: string
  entity_id: string | null
  payload: string | null
  created_by: number | null
  created_at: string | null
}

interface FeedEvent {
  seq: number
  id: string
  at: string | null
  action: ChatAction
  createdBy: number
  publicInput: boolean
  relation?: ChatRelation
}

interface Group {
  key: string
  kind: ChatKind
  entityId: string
  events: FeedEvent[]
  /** answer: the RFI it answers (from the event's entity id). */
  questionId?: string
  /** evidence_link: the two ends, as the events recorded them. */
  linkEvidenceId?: string
  linkTargetType?: 'rfi' | 'task'
  linkTargetId?: string
}

type Classified =
  | { type: 'skip' }
  | { type: 'item'; key: string; kind: ChatKind; entityId: string; event: FeedEvent; extra?: Partial<Group> }

function readPayload(raw: string | null): Record<string, unknown> {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}
  } catch {
    return {}
  }
}

const idText = (value: unknown): string | null => {
  if (value === null || value === undefined) return null
  const text = String(value).trim()
  return text && text.length <= 200 ? text : null
}

function classify(row: EventRow): Classified {
  const entityId = idText(row.entity_id)
  if (!entityId) return { type: 'skip' }
  const payload = readPayload(row.payload)
  const createdBy = Number(row.created_by ?? 0) || 0
  const via = typeof payload.via === 'string' ? payload.via : ''
  const event = (action: ChatAction, relation?: ChatRelation): FeedEvent => ({
    seq: Number(row.seq),
    id: String(row.id),
    at: isoTime(row.created_at),
    action,
    createdBy,
    publicInput: createdBy === 0 && (via === 'share' || via === 'tip' || payload.anonymous === true),
    ...(relation ? { relation } : {}),
  })

  const linkAction = LINK_EVENTS[row.event_type]
  if (linkAction) {
    const linkId = idText(payload.link_id)
    if (!linkId) return { type: 'skip' }
    const end = row.entity_type
    if (end !== 'evidence' && end !== 'rfi' && end !== 'task') return { type: 'skip' }
    const extra: Partial<Group> = end === 'evidence'
      ? { linkEvidenceId: entityId }
      : { linkTargetType: end, linkTargetId: entityId }
    return { type: 'item', key: `evidence_link:${linkId}`, kind: 'evidence_link', entityId: linkId, event: event(linkAction), extra }
  }

  if (row.event_type === 'rfi.answered' || row.event_type === 'rfi.answer_updated') {
    if (row.entity_type !== 'rfi') return { type: 'skip' }
    const answerId = idText(payload.answer_id)
    const action: ChatAction = row.event_type === 'rfi.answered' ? 'answered' : 'status'
    if (answerId) {
      return { type: 'item', key: `answer:${answerId}`, kind: 'answer', entityId: answerId, event: event(action), extra: { questionId: entityId } }
    }
    return { type: 'item', key: `rfi:${entityId}`, kind: 'rfi', entityId, event: event(row.event_type === 'rfi.answered' ? 'answered' : 'updated') }
  }

  const simple = SIMPLE_EVENTS[row.event_type]
  if (!simple || simple[0] !== row.entity_type) return { type: 'skip' }
  const [kind, action] = simple
  // The server's own timeline lines repeat what the feed already says ("Evidence added: …").
  if (kind === 'timeline' && action === 'created' && payload.source_type === 'system') return { type: 'skip' }
  let relation: ChatRelation | undefined
  if (row.event_type === 'hypothesis.evidence_linked') {
    relation = payload.type === 'contradicting' ? 'contradicts' : 'supports'
  }
  return { type: 'item', key: `${kind}:${entityId}`, kind, entityId, event: event(action, relation) }
}

/** cop_events.created_at ('YYYY-MM-DD HH:MM:SS', UTC) as ISO 8601. */
function isoTime(value: string | null): string | null {
  if (!value) return null
  return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value) ? `${value.replace(' ', 'T')}Z` : value
}

/**
 * One action for the events of one item: a deletion (or, for a filing, an unfiling)
 * wins, then a creation (filing), then the latest status change (answered, closed,
 * reopened, confirmed, status), the latest filing under a hypothesis, the latest star
 * change, an assignment, and last a plain update. null: born and gone in this page.
 */
export function chooseAction(kind: ChatKind, events: readonly { action: ChatAction; seq: number }[]): ChatAction | null {
  const has = (action: ChatAction) => events.some((e) => e.action === action)
  const latestOf = (actions: readonly ChatAction[]): ChatAction | null => {
    let best: { action: ChatAction; seq: number } | null = null
    for (const e of events) if (actions.includes(e.action) && (!best || e.seq > best.seq)) best = e
    return best?.action ?? null
  }
  const birth: ChatAction = kind === 'evidence_link' ? 'filed' : kind === 'answer' ? 'answered' : 'created'
  const death: ChatAction = kind === 'evidence_link' ? 'unfiled' : 'deleted'
  if (has(death)) return has(birth) ? null : death
  if (has(birth)) return birth
  return latestOf(['answered', 'closed', 'reopened', 'confirmed', 'status'])
    ?? latestOf(['filed', 'unfiled'])
    ?? latestOf(['starred', 'unstarred'])
    ?? (has('assigned') ? 'assigned' : 'updated')
}

// ── Text ─────────────────────────────────────────────────────────

// eslint-disable-next-line no-control-regex
const INVISIBLE = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u2069\ufeff]+/g

const WEB_LINK = /\bhttps?:\/\/[^\s<>"'()]+/gi

/**
 * One line of plain text, at most CHAT_TITLE_MAX characters; null when empty. A web
 * link inside the text is cut to its hostname (a full URL never leaves in a title).
 */
export function chatLine(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const text = String(value).replace(INVISIBLE, ' ').replace(WEB_LINK, (link) => chatDomain(link) ?? 'link')
    .replace(/\s+/g, ' ').trim()
  if (!text) return null
  const chars = Array.from(text)
  return chars.length > CHAT_TITLE_MAX ? `${chars.slice(0, CHAT_TITLE_MAX - 1).join('').trimEnd()}…` : text
}

/** The hostname of an http(s) URL with a dotted name (no IP literals, no ports, no path). */
export function chatDomain(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim() || value.length > 4000) return undefined
  let url: URL
  try {
    url = new URL(value.trim())
  } catch {
    return undefined
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return undefined
  const host = url.hostname.toLowerCase().replace(/^www\./, '').replace(/\.$/, '')
  if (!host || !host.includes('.') || host.startsWith('[') || /^[\d.]+$/.test(host) || host.length > 253) return undefined
  return host
}

// ── Entity rows (scoped to the session in SQL) ───────────────────

const CHUNK = 90

function chunks<T>(values: readonly T[]): T[][] {
  const out: T[][] = []
  for (let i = 0; i < values.length; i += CHUNK) out.push(values.slice(i, i + CHUNK))
  return out
}

const marks = (n: number) => Array.from({ length: n }, () => '?').join(', ')

/**
 * Rows of `table` in this session by id. `columns` first; when a column is missing
 * (a pending migration), `legacyColumns`.
 */
async function rowsInSession(
  db: D1Database,
  table: string,
  sessionId: string,
  ids: readonly string[],
  columns: string,
  legacyColumns: string,
): Promise<Map<string, Record<string, unknown>>> {
  const out = new Map<string, Record<string, unknown>>()
  for (const part of chunks([...new Set(ids)])) {
    const run = (cols: string) => db.prepare(`SELECT ${cols} FROM ${table} WHERE cop_session_id = ? AND id IN (${marks(part.length)})`)
      .bind(sessionId, ...part).all<Record<string, unknown>>()
    let result
    try {
      result = await run(columns)
    } catch (error) {
      if (!isMissingColumn(error)) throw error
      result = await run(legacyColumns)
    }
    for (const row of result.results ?? []) out.set(String(row.id), row)
  }
  return out
}

async function evidenceRows(db: D1Database, scope: EvidenceSessionScope, ids: readonly string[]): Promise<Map<string, Record<string, unknown>>> {
  const out = new Map<string, Record<string, unknown>>()
  const numeric = [...new Set(ids)].filter((id) => /^\d{1,15}$/.test(id))
  const clause = evidenceInSession(scope)
  for (const part of chunks(numeric)) {
    const binds = part.map(Number)
    let result
    try {
      result = await db.prepare(
        `SELECT id, title, credibility, source_url, source_channel FROM evidence_items WHERE id IN (${marks(part.length)}) AND ${clause.sql}`
      ).bind(...binds, ...clause.binds).all<Record<string, unknown>>()
    } catch (error) {
      if (!isMissingColumn(error)) throw error
      result = await db.prepare(
        `SELECT id, title, credibility, source_url FROM evidence_items WHERE id IN (${marks(part.length)}) AND ${clause.legacySql}`
      ).bind(...binds, ...clause.legacyBinds).all<Record<string, unknown>>()
    }
    for (const row of result.results ?? []) out.set(String(row.id), row)
  }
  return out
}

async function answerRows(db: D1Database, sessionId: string, ids: readonly string[]): Promise<Map<string, Record<string, unknown>>> {
  const out = new Map<string, Record<string, unknown>>()
  for (const part of chunks([...new Set(ids)])) {
    const result = await db.prepare(
      `SELECT a.id, a.rfi_id, a.answer_text, a.is_accepted, a.created_by
       FROM cop_rfi_answers a JOIN cop_rfis r ON r.id = a.rfi_id
       WHERE r.cop_session_id = ? AND a.id IN (${marks(part.length)})`
    ).bind(sessionId, ...part).all<Record<string, unknown>>()
    for (const row of result.results ?? []) out.set(String(row.id), row)
  }
  return out
}

/** Answers this session received from share-link visitors (their rfi.answered event is anonymous). */
async function anonymousAnswerIds(db: D1Database, sessionId: string, ids: readonly string[]): Promise<Set<string>> {
  const out = new Set<string>()
  for (const part of chunks([...new Set(ids)])) {
    const result = await db.prepare(
      `SELECT json_extract(payload, '$.answer_id') AS answer_id FROM cop_events
       WHERE cop_session_id = ? AND event_type = 'rfi.answered' AND created_by = 0
         AND (CASE WHEN json_valid(payload) THEN json_extract(payload, '$.answer_id') END) IN (${marks(part.length)})`
    ).bind(sessionId, ...part).all<{ answer_id: unknown }>()
    for (const row of result.results ?? []) out.add(String(row.answer_id))
  }
  return out
}

async function linkRows(db: D1Database, sessionId: string, ids: readonly string[]): Promise<Map<string, Record<string, unknown>>> {
  try {
    return await rowsInSession(db, 'cop_evidence_links', sessionId, ids,
      'id, evidence_id, target_type, target_id, relation', 'id, evidence_id, target_type, target_id, relation')
  } catch (error) {
    if (/no such table:?\s*(?:main\.)?cop_evidence_links\b/i.test(String(error instanceof Error ? error.message : error))) return new Map()
    throw error
  }
}

async function serviceUserIds(db: D1Database, ids: readonly number[]): Promise<Set<number>> {
  const out = new Set<number>()
  for (const part of chunks([...new Set(ids)].filter((id) => id > 0))) {
    const result = await db.prepare(`SELECT id FROM users WHERE role = 'service' AND id IN (${marks(part.length)})`)
      .bind(...part).all<{ id: number }>()
    for (const row of result.results ?? []) out.add(Number(row.id))
  }
  return out
}

// ── Labels ───────────────────────────────────────────────────────

/** Where an item came from, as a chat reader would say it. */
function originLabel(channel: unknown): string {
  switch (channel) {
    case 'drop': return 'anonymous tip'
    case 'signal': return 'from chat'
    case 'scrape': return 'scraped'
    case 'api': return 'automated'
    default: return 'from the team' // 'web', or a row from before provenance (migration 0022)
  }
}

const priorityLabel = (priority: unknown): string | null =>
  priority === 'critical' ? 'critical' : priority === 'high' ? 'high priority' : null

const isUnreviewedTipEvidence = (row: Record<string, unknown>) =>
  row.source_channel === 'drop' && (row.credibility == null || row.credibility === 'unverified')
const isUnreviewedTipMarker = (row: Record<string, unknown>) =>
  row.source_channel === 'drop' && (row.confidence == null || row.confidence === 'POSSIBLE')

function evidenceLabels(row: Record<string, unknown>): string[] {
  const labels = [originLabel(row.source_channel)]
  if (row.source_channel === 'drop') labels.push(isUnreviewedTipEvidence(row) ? 'unverified' : 'reviewed')
  else if (row.credibility === 'unverified') labels.push('unverified')
  if (row.credibility === 'confirmed') labels.push('confirmed')
  if (row.credibility === 'doubtful') labels.push('doubtful')
  return labels
}

const tidy = (labels: (string | null | undefined | false)[]): string[] => [...new Set(labels.filter((l): l is string => Boolean(l)))]

// ── The feed ─────────────────────────────────────────────────────

/**
 * The chat feed of a session after `since`. `echoUserId` is the calling service's
 * principal (its events are left out), or null for a person.
 */
export async function listChatFeed(
  db: D1Database,
  scope: EvidenceSessionScope,
  since: string | null,
  limit: number,
  echoUserId: number | null,
): Promise<ChatFeedResult> {
  const { sessionId } = scope
  const start = await resolveSinceCursor(db, sessionId, since)
  if (start.ok === false) return start
  if (start.fromNow === true) return { ok: true, items: [], cursor: start.cursor, has_more: false, skipped: 0, echoes: 0 }

  const rows = (await db.prepare(`
    SELECT rowid AS seq, id, event_type, entity_type, entity_id, payload, created_by, created_at
    FROM cop_events
    WHERE cop_session_id = ? AND rowid > ?
    ORDER BY rowid ASC
    LIMIT ?
  `).bind(sessionId, start.after, CHAT_FEED_SCAN_MAX + 1).all<EventRow>()).results ?? []

  const groups = new Map<string, Group>()
  let consumed = start.after
  let stoppedEarly = false
  let skipped = 0
  let echoes = 0
  for (const row of rows.slice(0, CHAT_FEED_SCAN_MAX)) {
    const isEcho = echoUserId !== null && Number(row.created_by) === echoUserId
    const classified = isEcho ? null : classify(row)
    if (classified?.type === 'item' && !groups.has(classified.key) && groups.size >= limit) {
      stoppedEarly = true
      break
    }
    consumed = Number(row.seq)
    if (isEcho) { echoes += 1; continue }
    if (!classified || classified.type === 'skip') { skipped += 1; continue }
    let group = groups.get(classified.key)
    if (!group) {
      group = { key: classified.key, kind: classified.kind, entityId: classified.entityId, events: [] }
      groups.set(classified.key, group)
    }
    group.events.push(classified.event)
    Object.assign(group, Object.fromEntries(Object.entries(classified.extra ?? {}).filter(([, v]) => v !== undefined)))
  }
  const hasMore = stoppedEarly || rows.length > CHAT_FEED_SCAN_MAX

  // Resolve every entity the page names, each lookup scoped to this session.
  const idsOf = (kind: ChatKind) => [...groups.values()].filter((g) => g.kind === kind).map((g) => g.entityId)
  const links = await linkRows(db, sessionId, idsOf('evidence_link'))
  const linkEnds = (g: Group) => {
    const row = links.get(g.entityId)
    return {
      evidenceId: row ? String(row.evidence_id) : g.linkEvidenceId,
      targetType: (row ? row.target_type : g.linkTargetType) as 'rfi' | 'task' | undefined,
      targetId: row ? String(row.target_id) : g.linkTargetId,
    }
  }
  const answers = await answerRows(db, sessionId, idsOf('answer'))
  const linkGroups = [...groups.values()].filter((g) => g.kind === 'evidence_link')
  const rfiIds = [
    ...idsOf('rfi'),
    ...[...groups.values()].filter((g) => g.kind === 'answer' && g.questionId).map((g) => g.questionId as string),
    ...linkGroups.map(linkEnds).filter((e) => e.targetType === 'rfi' && e.targetId).map((e) => e.targetId as string),
  ]
  const rfis = await rowsInSession(db, 'cop_rfis', sessionId, rfiIds,
    'id, question, status, priority, is_key, is_blocker, source_channel', 'id, question, status, priority, is_blocker')
  const tasks = await rowsInSession(db, 'cop_tasks', sessionId, [
    ...idsOf('task'),
    ...linkGroups.map(linkEnds).filter((e) => e.targetType === 'task' && e.targetId).map((e) => e.targetId as string),
  ], 'id, title, status, priority, source_channel', 'id, title, status, priority')
  const evidence = await evidenceRows(db, scope, [
    ...idsOf('evidence'),
    ...linkGroups.map(linkEnds).map((e) => e.evidenceId).filter((id): id is string => Boolean(id)),
  ])
  const markers = await rowsInSession(db, 'cop_markers', sessionId, idsOf('marker'),
    'id, label, confidence, source_channel', 'id, label, confidence')
  const timeline = await rowsInSession(db, 'cop_timeline_entries', sessionId, idsOf('timeline'),
    'id, title, importance, source_type, source_url, source_channel', 'id, title, importance, source_type, source_url')
  const hypotheses = await rowsInSession(db, 'cop_hypotheses', sessionId, idsOf('hypothesis'),
    'id, statement, status, source_channel', 'id, statement, status')
  const claims = await rowsInSession(db, 'cop_claims', sessionId, idsOf('claim'),
    'id, claim_text, status, url, source_channel', 'id, claim_text, status, url')
  const anonymousAnswers = await anonymousAnswerIds(db, sessionId, idsOf('answer'))
  const services = await serviceUserIds(db, [
    ...[...groups.values()].flatMap((g) => g.events.map((e) => e.createdBy)),
    ...[...answers.values()].map((a) => Number(a.created_by) || 0),
  ])

  const items: { item: ChatFeedItem; seq: number }[] = []
  for (const group of groups.values()) {
    const action = chooseAction(group.kind, group.events)
    if (action === null) { skipped += group.events.length; continue }
    const latest = group.events.reduce((a, b) => (b.seq > a.seq ? b : a))
    const actorOf = (e: FeedEvent): ChatActor =>
      e.createdBy === 0 ? (e.publicInput ? 'anonymous' : 'system') : services.has(e.createdBy) ? 'system' : 'team'
    const item: ChatFeedItem = {
      event_id: latest.id,
      at: latest.at,
      kind: group.kind,
      action,
      entity_id: group.entityId,
      title: null,
      status: null,
      labels: [],
      actor: actorOf(latest),
    }
    const gone = action === 'deleted' || action === 'unfiled'
    const question = (id: string | undefined) => (id ? rfis.get(id) : undefined)
    let resolved = true

    switch (group.kind) {
      case 'rfi': {
        const row = rfis.get(group.entityId)
        if (!row) { resolved = gone; break }
        item.title = chatLine(row.question)
        item.status = chatLine(row.status)
        item.labels = tidy([
          originLabel(row.source_channel), Number(row.is_key) === 1 && 'key question',
          (row.status === 'answered' || row.status === 'accepted') && 'answered', row.status === 'closed' && 'closed',
          Number(row.is_blocker) === 1 && 'blocker', priorityLabel(row.priority),
        ])
        break
      }
      case 'answer': {
        const row = answers.get(group.entityId)
        const q = question(row ? String(row.rfi_id) : undefined)
        if (!row || !q) { resolved = false; break }
        const anonymous = anonymousAnswers.has(group.entityId)
        const accepted = Number(row.is_accepted) === 1
        item.question_id = String(row.rfi_id)
        item.question_title = chatLine(q.question) ?? undefined
        item.title = anonymous && !accepted ? null : chatLine(row.answer_text)
        item.status = accepted ? 'accepted' : 'proposed'
        item.labels = tidy([
          anonymous ? 'anonymous' : services.has(Number(row.created_by)) ? 'from chat' : 'from the team',
          anonymous && !accepted && 'unverified', accepted && 'accepted', Number(q.is_key) === 1 && 'key question',
        ])
        if (anonymous && action === 'answered') item.actor = 'anonymous'
        break
      }
      case 'task': {
        const row = tasks.get(group.entityId)
        if (!row) { resolved = gone; break }
        item.title = chatLine(row.title)
        item.status = chatLine(row.status)
        item.labels = tidy([
          originLabel(row.source_channel), row.status === 'done' && 'done', row.status === 'in_progress' && 'in progress',
          row.status === 'blocked' && 'blocked', priorityLabel(row.priority),
        ])
        break
      }
      case 'evidence': {
        const row = evidence.get(group.entityId)
        if (!row) { resolved = gone; break }
        const masked = isUnreviewedTipEvidence(row)
        item.title = masked ? null : chatLine(row.title)
        item.status = chatLine(row.credibility)
        item.labels = evidenceLabels(row)
        const domain = masked ? undefined : chatDomain(row.source_url)
        if (domain) item.domain = domain
        if (action === 'created' && row.source_channel === 'drop') item.actor = 'anonymous'
        break
      }
      case 'evidence_link': {
        const ends = linkEnds(group)
        const link = links.get(group.entityId)
        const row = ends.evidenceId ? evidence.get(ends.evidenceId) : undefined
        if (!gone && (!link || !row)) { resolved = false; break }
        const q = ends.targetType === 'rfi' ? question(ends.targetId) : undefined
        if (q) {
          item.question_id = String(q.id)
          const qt = chatLine(q.question)
          if (qt) item.question_title = qt
        } else if (ends.targetType === 'task' && ends.targetId && tasks.has(ends.targetId)) {
          item.task_id = ends.targetId
        }
        if (row) item.evidence_id = String(row.id)
        const relation = link ? String(link.relation) : ''
        if (relation === 'supports' || relation === 'contradicts' || relation === 'context') item.relation = relation
        if (row) {
          const masked = isUnreviewedTipEvidence(row)
          item.title = masked ? null : chatLine(row.title)
          item.labels = tidy([item.relation, ...evidenceLabels(row), q && Number(q.is_key) === 1 && 'key question'])
          const domain = masked ? undefined : chatDomain(row.source_url)
          if (domain) item.domain = domain
        }
        break
      }
      case 'marker': {
        const row = markers.get(group.entityId)
        if (!row) { resolved = gone; break }
        const masked = isUnreviewedTipMarker(row)
        item.title = masked ? null : chatLine(row.label)
        item.status = chatLine(String(row.confidence ?? '').toLowerCase())
        item.labels = tidy([
          originLabel(row.source_channel),
          row.source_channel === 'drop' && (masked ? 'unverified' : 'reviewed'),
          row.confidence === 'CONFIRMED' && 'confirmed',
        ])
        if (action === 'created' && row.source_channel === 'drop') item.actor = 'anonymous'
        break
      }
      case 'timeline': {
        const row = timeline.get(group.entityId)
        if (!row) { resolved = gone; break }
        if (row.source_type === 'system') { resolved = false; break }
        item.title = chatLine(row.title)
        item.labels = tidy([
          originLabel(row.source_channel),
          row.importance === 'critical' ? 'critical' : row.importance === 'high' && 'important',
        ])
        const domain = chatDomain(row.source_url)
        if (domain) item.domain = domain
        break
      }
      case 'hypothesis': {
        const row = hypotheses.get(group.entityId)
        if (!row) { resolved = gone; break }
        item.title = chatLine(row.statement)
        item.status = chatLine(row.status)
        const filing = action === 'filed' ? group.events.filter((e) => e.action === 'filed').at(-1) : undefined
        if (filing?.relation) item.relation = filing.relation
        item.labels = tidy([originLabel(row.source_channel), item.relation, row.status !== 'active' && chatLine(row.status)])
        break
      }
      case 'claim': {
        const row = claims.get(group.entityId)
        if (!row) { resolved = gone; break }
        item.title = chatLine(row.claim_text)
        item.status = chatLine(row.status)
        const status = String(row.status ?? 'unverified')
        item.labels = tidy([
          originLabel(row.source_channel),
          status === 'unverified' && 'AI first pass', status === 'unverified' && 'unverified',
          status === 'verified' && 'reviewed', status === 'verified' && 'verified',
          status === 'disputed' && 'disputed', status === 'false' && 'false',
        ])
        const domain = chatDomain(row.url)
        if (domain) item.domain = domain
        break
      }
    }
    if (!resolved) { skipped += group.events.length; continue }
    if (gone) {
      item.title = null
      item.status = null
      if (group.kind !== 'evidence_link') item.labels = []
      delete item.domain
    }
    items.push({ item, seq: latest.seq })
  }

  // Oldest first, by each item's latest event (the order the chat would have seen them).
  items.sort((a, b) => a.seq - b.seq)
  return { ok: true, items: items.map((i) => i.item), cursor: String(consumed), has_more: hasMore, skipped, echoes }
}
