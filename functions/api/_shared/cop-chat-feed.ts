/**
 * The COP → chat feed: what happened in a COP, worded for people reading a chat
 * (GET /api/cop/:id/chat-feed; the contract is at the top of that route).
 *
 * Built on the change feed's cursor (cop_events rowid, resolveSinceCursor). Each event
 * is read server-side with its created_by and payload; neither leaves. Then:
 *   1. What the calling bot itself did (an event whose created_by is the calling
 *      service's principal) comes back with actor 'chat' and in items of its own,
 *      never merged with the team's changes to the same entity. The bot decides per
 *      room: it drops a room's own captures (no echo) and shows another linked
 *      room's. Which room is never said here.
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
 * Anonymous input comes with its text, labelled so a chat reader can weigh it: a
 * drop-form tip "anonymous tip" + "unverified" (then "reviewed" once an editor sets its
 * credibility), its marker "anonymous tip" + "possible", and an answer through a share
 * link "anonymous" + "proposed" (then "accepted"). Never its submitter's fields: a tip
 * (its evidence, marker and filings) has a title only when ingest recorded `title_safe`
 * (the title came from the form's summary or long-text answer; cop-ingest tipTitle), so
 * a tip titled before that, or from nothing safe, has title null and no domain. Until
 * the team reviews it, anonymous text has its hosts defanged ("evil[.]example", so no
 * chat client makes a link of them) and no domain. At most CHAT_ANONYMOUS_PER_HOUR
 * anonymous tips and answers per COP per rolling hour carry text; the rest, and more
 * than CHAT_ANONYMOUS_PER_PAGE in one page, become a summary item with their count.
 *
 * Never in an item: user ids, names, emails, assignees, responders, full URLs,
 * coordinates, upload ids, payloads.
 */
import { isSignalBotClient } from './cop-caller'
import { resolveSinceCursor } from './cop-events'
import { evidenceInSession, isMissingColumn, type EvidenceSessionScope } from './cop-input'

export const CHAT_FEED_DEFAULT_LIMIT = 50
export const CHAT_FEED_MAX_LIMIT = 100
/** Event rows read per request at most (skips included). */
export const CHAT_FEED_SCAN_MAX = 500
export const CHAT_TITLE_MAX = 140
/** Characters of an entity's text read to make its title. */
const CHAT_TEXT_SCAN = 2000

export const CHAT_KINDS = [
  'rfi', 'answer', 'task', 'evidence', 'evidence_link', 'marker', 'timeline', 'hypothesis', 'claim', 'summary',
] as const
export type ChatKind = (typeof CHAT_KINDS)[number]

export const CHAT_ACTIONS = [
  'created', 'updated', 'status', 'answered', 'closed', 'reopened', 'confirmed', 'assigned',
  'starred', 'unstarred', 'filed', 'unfiled', 'deleted',
] as const
export type ChatAction = (typeof CHAT_ACTIONS)[number]
export type ChatActor = 'team' | 'anonymous' | 'system' | 'chat'
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
  /** kind 'summary': how many anonymous tips and answers it stands for. */
  count?: number
}

/**
 * More than this many unreviewed anonymous submissions (tips still unverified, share-link
 * answers nobody accepted) in one page become one 'summary' item: share links and drop
 * forms are open to anyone, and a flood must not become a flood in the chat.
 */
export const CHAT_ANONYMOUS_PER_PAGE = 3

/**
 * Anonymous tips and share-link answers per COP per rolling hour that carry their text:
 * a tip or answer is shown only when at most this many (itself included) arrived in the
 * COP in the hour up to its arrival, whatever page it lands on. The rest go into a
 * summary item's count, so no hour of a flood puts more than this into the chat.
 */
export const CHAT_ANONYMOUS_PER_HOUR = 20

/** Ids an item may carry: anything else (an id a client chose, say) drops the item. */
const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/
const safeId = (value: unknown): string | undefined =>
  value !== null && value !== undefined && SAFE_ID.test(String(value)) ? String(value) : undefined

export type ChatFeedResult =
  | { ok: true; items: ChatFeedItem[]; cursor: string; has_more: boolean; skipped: number; from_chat: number }
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
  // One per claim of a bulk extraction (claim.created stays one event per request, for playbooks).
  'claim.extracted': ['claim', 'created'],
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
  /** The calling bot's own events (actor 'chat'), kept apart from everyone else's. */
  fromChat: boolean
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

const idText = (value: unknown): string | null => safeId(value) ?? null

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

// Line and paragraph breaks and other controls become a space; format characters and
// default-ignorable ones (bidi controls, zero-width, soft hyphen, Hangul fillers, tag
// characters) are removed, so nothing hidden can reorder the text or split a link.
const BREAKS = /[\p{Cc}\p{Zl}\p{Zp}]+/gu
// Lone surrogates (\p{Cs} in a u-regex) go too: they are no character at all.
const INVISIBLE = /[\p{Cf}\p{Cs}\p{Default_Ignorable_Code_Point}]+/gu

const WEB_LINK = /\bhttps?:\/\/[^\s<>"'()]+/gi

/** One label of a host name, in any script: letters, marks, digits, emoji and other symbols, '-' and '_'. */
const LABEL = String.raw`[\p{L}\p{M}\p{N}\p{So}\p{Sk}_-]`
/**
 * A host name in any script ("пример.рф", "пример.com", "example.xn--p1ai", "i❤.ws"):
 * labels and dots, ending in a top-level label of 2 or more characters with a letter or
 * symbol in it (so "3.5" is no host); or an IPv4 address. Labels are at most 63
 * characters (as in DNS), which also bounds the regex's backtracking.
 */
const HOST = String.raw`(?:${LABEL}{1,63}\.)+(?=${LABEL}{0,62}[\p{L}\p{So}])${LABEL}{2,63}|\d{1,3}(?:\.\d{1,3}){3}`
/**
 * A host with a path, query or fragment but no scheme ("example.com/a?b", "10.0.0.1:8080/x",
 * "пример.рф/путь") still reads as a link: cut to the host. A backslash or a fullwidth
 * solidus starts a path too (browsers read them as "/").
 */
const BARE_LINK = new RegExp(String.raw`(${HOST})(?::\d{1,5})?[/?#\\／][^\s<>"'()\[\]{}]*`, 'gu')
const HOST_IN_TEXT = new RegExp(HOST, 'gu')

/** "evil.example" → "evil[.]example": still readable, never made a link by a chat client. */
const defangHosts = (text: string): string => text.replace(HOST_IN_TEXT, (host) => host.replace(/\./g, '[.]'))

/**
 * One line of plain text, at most CHAT_TITLE_MAX characters; null when empty. A link
 * inside the text, with or without a scheme, is cut to its hostname: a path never
 * leaves in a title. `defang`: every host left in the text is defanged (anonymous text
 * nobody on the team has reviewed: a tipster's "signal-help.example" is no link in chat).
 */
export function chatLine(value: unknown, { defang = false }: { defang?: boolean } = {}): string | null {
  if (value === null || value === undefined) return null
  // A title shows CHAT_TITLE_MAX characters; reading at most CHAT_TEXT_SCAN keeps the link
  // patterns linear on long input (a link cut here still loses its path; a split
  // surrogate pair is removed with INVISIBLE).
  const raw = String(value)
  let text = (raw.length > CHAT_TEXT_SCAN ? raw.slice(0, CHAT_TEXT_SCAN) : raw).replace(BREAKS, ' ').replace(INVISIBLE, '').replace(WEB_LINK, (link) => chatDomain(link) ?? 'link')
    .replace(BARE_LINK, '$1').replace(/\s+/g, ' ').trim()
  if (defang) text = defangHosts(text)
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

/** evidence_items.metadata's title_safe (set by cop-ingest for a drop-form tip titled from a safe field). */
const TITLE_SAFE = "CASE WHEN json_valid(metadata) THEN json_extract(metadata, '$.title_safe') END AS title_safe"

async function evidenceRows(db: D1Database, scope: EvidenceSessionScope, ids: readonly string[]): Promise<Map<string, Record<string, unknown>>> {
  const out = new Map<string, Record<string, unknown>>()
  const numeric = [...new Set(ids)].filter((id) => /^\d{1,15}$/.test(id))
  const clause = evidenceInSession(scope)
  for (const part of chunks(numeric)) {
    const binds = part.map(Number)
    let result
    try {
      result = await db.prepare(
        `SELECT id, title, credibility, source_url, source_channel, ${TITLE_SAFE} FROM evidence_items WHERE id IN (${marks(part.length)}) AND ${clause.sql}`
      ).bind(...binds, ...clause.binds).all<Record<string, unknown>>()
    } catch (error) {
      if (!isMissingColumn(error)) throw error
      result = await db.prepare(
        `SELECT id, title, credibility, source_url, ${TITLE_SAFE} FROM evidence_items WHERE id IN (${marks(part.length)}) AND ${clause.legacySql}`
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

/**
 * Who answered, by the answer's own rfi.answered event: an answer is the team's (or the
 * bot's) only when such an event with created_by > 0 names it. Anything else (a
 * share-link visitor's answer, one from before answer ids were recorded, one whose
 * event was lost) counts as anonymous. answer id → created_by.
 */
async function answerAuthors(db: D1Database, sessionId: string, ids: readonly string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>()
  for (const part of chunks([...new Set(ids)])) {
    const result = await db.prepare(
      `SELECT json_extract(payload, '$.answer_id') AS answer_id, created_by FROM cop_events
       WHERE cop_session_id = ? AND event_type = 'rfi.answered' AND created_by > 0
         AND (CASE WHEN json_valid(payload) THEN json_extract(payload, '$.answer_id') END) IN (${marks(part.length)})
       ORDER BY rowid`
    ).bind(sessionId, ...part).all<{ answer_id: unknown; created_by: unknown }>()
    for (const row of result.results ?? []) {
      const id = String(row.answer_id)
      if (!out.has(id)) out.set(id, Number(row.created_by))
    }
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

/**
 * The service users among `ids` that are the Signal bot (the principal of an integration
 * client in SIGNAL_BOT_CLIENT_IDS): their answers are "from chat"; any other service's
 * are "automated".
 */
async function signalBotUserIds(db: D1Database, ids: readonly number[]): Promise<Set<number>> {
  const out = new Set<number>()
  for (const part of chunks([...new Set(ids)].filter((id) => id > 0))) {
    let result
    try {
      result = await db.prepare(`SELECT id, principal_user_id FROM integration_clients WHERE principal_user_id IN (${marks(part.length)})`)
        .bind(...part).all<{ id: string; principal_user_id: number }>()
    } catch (error) {
      if (/no such table:?\s*(?:main\.)?integration_clients\b/i.test(String(error instanceof Error ? error.message : error))) return out
      throw error
    }
    for (const row of result.results ?? []) if (isSignalBotClient(String(row.id))) out.add(Number(row.principal_user_id))
  }
  return out
}

// ── Anonymous input per hour ─────────────────────────────────────

/** A cop_events row `p` that is an anonymous arrival: a drop-form tip's evidence, or a share-link answer. */
const ANONYMOUS_ARRIVAL = `(
  (p.event_type = 'evidence.created' AND p.entity_type = 'evidence'
    AND (CASE WHEN json_valid(p.payload) THEN json_extract(p.payload, '$.source_channel') END) = 'drop')
  OR (p.event_type = 'rfi.answered'
    AND (p.created_by = 0 OR (CASE WHEN json_valid(p.payload) THEN json_extract(p.payload, '$.via') END) = 'share'))
)`

const eventMillis = (value: unknown): number => Date.parse(isoTime(value == null ? null : String(value)) ?? '')

/**
 * For each anonymous tip (`tip:<evidence id>`) and share-link answer (`answer:<answer id>`),
 * how many anonymous tips and answers arrived in the COP in the hour up to and including
 * its own arrival (its evidence.created / rfi.answered event), from the events' own
 * timestamps. A key whose arrival event isn't found is left out (and not capped).
 */
async function anonymousArrivalRanks(db: D1Database, sessionId: string, keys: readonly string[]): Promise<Map<string, number>> {
  const ranks = new Map<string, number>()
  const tipIds = [...new Set(keys.filter((k) => k.startsWith('tip:')).map((k) => k.slice(4)))]
  const answerIds = [...new Set(keys.filter((k) => k.startsWith('answer:')).map((k) => k.slice(7)))]
  if (tipIds.length === 0 && answerIds.length === 0) return ranks

  // Each key's arrival: its first event.
  const arrivalOf = new Map<string, { seq: number; at: number }>()
  const note = (key: string, seq: unknown, at: unknown) => {
    if (!arrivalOf.has(key)) arrivalOf.set(key, { seq: Number(seq), at: eventMillis(at) })
  }
  for (const part of chunks(tipIds)) {
    const rows = (await db.prepare(`
      SELECT rowid AS seq, entity_id, created_at FROM cop_events
      WHERE cop_session_id = ? AND event_type = 'evidence.created' AND entity_type = 'evidence' AND entity_id IN (${marks(part.length)})
      ORDER BY rowid
    `).bind(sessionId, ...part).all<{ seq: number; entity_id: string; created_at: string }>()).results ?? []
    for (const row of rows) note(`tip:${row.entity_id}`, row.seq, row.created_at)
  }
  for (const part of chunks(answerIds)) {
    const rows = (await db.prepare(`
      SELECT rowid AS seq, json_extract(payload, '$.answer_id') AS answer_id, created_at FROM cop_events
      WHERE cop_session_id = ? AND event_type = 'rfi.answered'
        AND (CASE WHEN json_valid(payload) THEN json_extract(payload, '$.answer_id') END) IN (${marks(part.length)})
      ORDER BY rowid
    `).bind(sessionId, ...part).all<{ seq: number; answer_id: string; created_at: string }>()).results ?? []
    for (const row of rows) note(`answer:${row.answer_id}`, row.seq, row.created_at)
  }
  const arrivals = [...arrivalOf.values()].filter((a) => Number.isFinite(a.at))
  if (arrivals.length === 0) return ranks

  // Every anonymous arrival in the COP from an hour before the earliest to the latest of them.
  const HOUR = 3_600_000
  const from = new Date(Math.min(...arrivals.map((a) => a.at)) - HOUR).toISOString().replace('T', ' ').slice(0, 19)
  const upTo = Math.max(...arrivals.map((a) => a.seq))
  const nearby = ((await db.prepare(`
    SELECT p.rowid AS seq, p.created_at FROM cop_events p
    WHERE p.cop_session_id = ? AND p.event_type IN ('evidence.created', 'rfi.answered') AND p.rowid <= ?
      AND julianday(p.created_at) >= julianday(?) AND ${ANONYMOUS_ARRIVAL}
  `).bind(sessionId, upTo, from).all<{ seq: number; created_at: string }>()).results ?? [])
    .map((row) => ({ seq: Number(row.seq), at: eventMillis(row.created_at) }))

  for (const [key, own] of arrivalOf) {
    if (!Number.isFinite(own.at)) continue
    ranks.set(key, nearby.filter((p) => p.seq <= own.seq && p.at > own.at - HOUR).length)
  }
  return ranks
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

/** A drop-form tip nobody has reviewed yet (labelled "unverified" / "possible", text shown). */
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

/**
 * Whether a drop-form tip's text may be a title: only when ingest recorded that it came
 * from the form's summary or long-text answer (metadata title_safe). A tip titled before
 * that (from any text field, its tipster's name included) or from nothing safe has none.
 */
const tipTitleSafe = (tipEvidence: Record<string, unknown> | undefined): boolean =>
  !!tipEvidence && tipEvidence.source_channel === 'drop' && (tipEvidence.title_safe === 1 || tipEvidence.title_safe === true)

/**
 * A drop-form tip's text (its evidence title or its marker's label) as a chat title: null
 * unless `tipEvidence` is marked safe; without the stored "Tip: " prefix (the labels say
 * "anonymous tip"); hosts defanged while unreviewed.
 */
function tipText(tipEvidence: Record<string, unknown> | undefined, value: unknown, unreviewed: boolean): string | null {
  if (!tipTitleSafe(tipEvidence)) return null
  return chatLine(String(value ?? '').trim().replace(/^Tip:\s+/, ''), { defang: unreviewed })
}

/** An evidence row's title and domain: a tip's under tipText's rule, with a domain only once reviewed. */
function evidenceText(row: Record<string, unknown>): { title: string | null; domain: string | undefined } {
  if (row.source_channel !== 'drop') return { title: chatLine(row.title), domain: chatDomain(row.source_url) }
  const unreviewed = isUnreviewedTipEvidence(row)
  return {
    title: tipText(row, row.title, unreviewed),
    domain: tipTitleSafe(row) && !unreviewed ? chatDomain(row.source_url) : undefined,
  }
}

const tidy = (labels: (string | null | undefined | false)[]): string[] => [...new Set(labels.filter((l): l is string => Boolean(l)))]

// ── The feed ─────────────────────────────────────────────────────

/**
 * The chat feed of a session after `since`. `chatUserId` is the calling service's
 * principal (its events come back as actor 'chat'), or null for a person.
 */
export async function listChatFeed(
  db: D1Database,
  scope: EvidenceSessionScope,
  since: string | null,
  limit: number,
  chatUserId: number | null,
): Promise<ChatFeedResult> {
  const { sessionId } = scope
  const start = await resolveSinceCursor(db, sessionId, since)
  if (start.ok === false) return start
  if (start.fromNow === true) return { ok: true, items: [], cursor: start.cursor, has_more: false, skipped: 0, from_chat: 0 }

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
  let fromChatEvents = 0
  for (const row of rows.slice(0, CHAT_FEED_SCAN_MAX)) {
    const fromChat = chatUserId !== null && Number(row.created_by) === chatUserId
    const classified = classify(row)
    const key = classified.type === 'item' ? `${classified.key}${fromChat ? '|chat' : ''}` : ''
    if (classified.type === 'item' && !groups.has(key) && groups.size >= limit) {
      stoppedEarly = true
      break
    }
    consumed = Number(row.seq)
    if (fromChat) fromChatEvents += 1
    if (classified.type === 'skip') { skipped += 1; continue }
    let group = groups.get(key)
    if (!group) {
      group = { key, kind: classified.kind, entityId: classified.entityId, fromChat, events: [] }
      groups.set(key, group)
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
  const markers = await rowsInSession(db, 'cop_markers', sessionId, idsOf('marker'),
    'id, label, confidence, source_type, source_id, source_channel', 'id, label, confidence, source_type, source_id')
  // A drop-form marker's label is its tip's title: the tip's evidence says whether it is safe.
  const tipOfMarker = (row: Record<string, unknown>): string | undefined =>
    row.source_channel === 'drop' && String(row.source_type ?? '').toUpperCase() === 'EVIDENCE' ? safeId(row.source_id) : undefined
  const evidence = await evidenceRows(db, scope, [
    ...idsOf('evidence'),
    ...linkGroups.map(linkEnds).map((e) => e.evidenceId).filter((id): id is string => Boolean(id)),
    ...[...markers.values()].map(tipOfMarker).filter((id): id is string => Boolean(id)),
  ])
  const timeline = await rowsInSession(db, 'cop_timeline_entries', sessionId, idsOf('timeline'),
    'id, title, importance, source_type, source_url, source_channel', 'id, title, importance, source_type, source_url')
  const hypotheses = await rowsInSession(db, 'cop_hypotheses', sessionId, idsOf('hypothesis'),
    'id, statement, status, source_channel', 'id, statement, status')
  const claims = await rowsInSession(db, 'cop_claims', sessionId, idsOf('claim'),
    'id, claim_text, status, url, source_channel', 'id, claim_text, status, url')
  const authors = await answerAuthors(db, sessionId, idsOf('answer'))
  const services = await serviceUserIds(db, [
    ...[...groups.values()].flatMap((g) => g.events.map((e) => e.createdBy)),
    ...authors.values(),
  ])
  const signalBots = await signalBotUserIds(db, [...authors.values()].filter((id) => services.has(id)))

  const items: FeedEntry[] = []
  for (const group of groups.values()) {
    const action = chooseAction(group.kind, group.events)
    if (action === null) { skipped += group.events.length; continue }
    const latest = group.events.reduce((a, b) => (b.seq > a.seq ? b : a))
    const actorOf = (e: FeedEvent): ChatActor =>
      group.fromChat ? 'chat' : e.createdBy === 0 ? (e.publicInput ? 'anonymous' : 'system') : services.has(e.createdBy) ? 'system' : 'team'
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
    /** The anonymous submission the item's text comes from (tip:<evidence id> | answer:<id>), for the hourly cap. */
    let anonymousKey: string | undefined

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
        const author = authors.get(group.entityId)
        const anonymous = author === undefined
        const accepted = Number(row.is_accepted) === 1
        const questionId = safeId(row.rfi_id)
        if (questionId) item.question_id = questionId
        item.question_title = chatLine(q.question) ?? undefined
        // A share-link answer nobody accepted: its hosts defanged.
        item.title = chatLine(row.answer_text, { defang: anonymous && !accepted })
        item.status = accepted ? 'accepted' : 'proposed'
        item.labels = tidy([
          // "from chat" only for the Signal bot; another integration's answer is "automated".
          anonymous ? 'anonymous' : signalBots.has(author) ? 'from chat' : services.has(author) ? 'automated' : 'from the team',
          anonymous && !accepted && 'proposed', accepted && 'accepted', Number(q.is_key) === 1 && 'key question',
        ])
        if (anonymous && action === 'answered' && !group.fromChat) item.actor = 'anonymous'
        if (anonymous) anonymousKey = `answer:${group.entityId}`
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
        const text = evidenceText(row)
        item.title = text.title
        item.status = chatLine(row.credibility)
        item.labels = evidenceLabels(row)
        if (text.domain) item.domain = text.domain
        if (action === 'created' && row.source_channel === 'drop' && !group.fromChat) item.actor = 'anonymous'
        if (row.source_channel === 'drop') anonymousKey = `tip:${group.entityId}`
        break
      }
      case 'evidence_link': {
        const ends = linkEnds(group)
        const link = links.get(group.entityId)
        const row = ends.evidenceId ? evidence.get(ends.evidenceId) : undefined
        if (!gone && (!link || !row)) { resolved = false; break }
        const q = ends.targetType === 'rfi' ? question(ends.targetId) : undefined
        if (q) {
          const questionId = safeId(q.id)
          if (questionId) item.question_id = questionId
          const qt = chatLine(q.question)
          if (qt) item.question_title = qt
        } else if (ends.targetType === 'task' && ends.targetId && tasks.has(ends.targetId)) {
          const taskId = safeId(ends.targetId)
          if (taskId) item.task_id = taskId
        }
        const evidenceId = row ? safeId(row.id) : undefined
        if (evidenceId) item.evidence_id = evidenceId
        const relation = link ? String(link.relation) : ''
        if (relation === 'supports' || relation === 'contradicts' || relation === 'context') item.relation = relation
        if (row) {
          const text = evidenceText(row)
          item.title = text.title
          item.labels = tidy([item.relation, ...evidenceLabels(row), q && Number(q.is_key) === 1 && 'key question'])
          if (text.domain) item.domain = text.domain
          if (row.source_channel === 'drop' && evidenceId) anonymousKey = `tip:${evidenceId}`
        }
        break
      }
      case 'marker': {
        const row = markers.get(group.entityId)
        if (!row) { resolved = gone; break }
        if (row.source_channel === 'drop') {
          // Its label is its tip's title: shown only when the tip's evidence is marked safe.
          const tipId = tipOfMarker(row)
          item.title = tipText(tipId ? evidence.get(tipId) : undefined, row.label, isUnreviewedTipMarker(row))
          if (tipId) anonymousKey = `tip:${tipId}`
        } else {
          item.title = chatLine(row.label)
        }
        item.status = chatLine(String(row.confidence ?? '').toLowerCase())
        item.labels = tidy([
          originLabel(row.source_channel),
          row.source_channel === 'drop' && (isUnreviewedTipMarker(row) ? 'possible' : 'reviewed'),
          row.confidence === 'CONFIRMED' && 'confirmed',
        ])
        if (action === 'created' && row.source_channel === 'drop' && !group.fromChat) item.actor = 'anonymous'
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
    items.push({ item, seq: latest.seq, events: group.events.length, anonymousKey })
  }

  // Oldest first, by each item's latest event (the order the chat would have seen them).
  items.sort((a, b) => a.seq - b.seq)
  // The hourly cap: an unreviewed anonymous tip or answer past CHAT_ANONYMOUS_PER_HOUR in
  // its hour carries no text (nor do its marker and filings).
  const capped = items.filter((e) => e.anonymousKey && unreviewedAnonymous(e.item)).map((e) => e.anonymousKey as string)
  const ranks = await anonymousArrivalRanks(db, sessionId, capped)
  const overCap = (e: FeedEntry) => e.anonymousKey !== undefined && (ranks.get(e.anonymousKey) ?? 0) > CHAT_ANONYMOUS_PER_HOUR
  const collapsed = collapseAnonymous(items, overCap)
  return { ok: true, items: collapsed.items, cursor: String(consumed), has_more: hasMore, skipped: skipped + collapsed.dropped, from_chat: fromChatEvents }
}

interface FeedEntry {
  item: ChatFeedItem
  seq: number
  /** How many events the item stands for. */
  events: number
  anonymousKey?: string
}

/** Anonymous input nobody on the team has looked at yet (a tip, its marker and filing, an answer). */
function unreviewedAnonymous(item: ChatFeedItem): boolean {
  if (item.actor !== 'anonymous') return false
  const has = (label: string) => item.labels.includes(label)
  switch (item.kind) {
    case 'answer': return item.status === 'proposed'
    case 'evidence': case 'evidence_link': return has('anonymous tip') && has('unverified')
    case 'marker': return has('anonymous tip') && has('possible')
    default: return false
  }
}

/**
 * Unreviewed anonymous tips and answers that don't carry their text: those past the
 * hourly cap (`overCap`), or all of them when more than CHAT_ANONYMOUS_PER_PAGE of the
 * rest are in this page. With their markers and filings they become one 'summary' item
 * with the count of tips and answers, where the latest of them was. Markers and filings
 * of a tip summarised on an earlier page (count 0 here) are dropped, their events counted
 * in `dropped` (they go into `skipped`).
 */
function collapseAnonymous(sorted: FeedEntry[], overCap: (entry: FeedEntry) => boolean): { items: ChatFeedItem[]; dropped: number } {
  const anonymous = sorted.filter((i) => unreviewedAnonymous(i.item))
  const counted = (list: FeedEntry[]) => list.filter((i) => i.item.kind === 'answer' || i.item.kind === 'evidence').length
  const shown = anonymous.filter((i) => !overCap(i))
  const hidden = new Set(counted(shown) > CHAT_ANONYMOUS_PER_PAGE ? anonymous : anonymous.filter(overCap))
  if (hidden.size === 0) return { items: sorted.map((i) => i.item), dropped: 0 }
  const count = counted([...hidden])
  if (count === 0) {
    return { items: sorted.filter((i) => !hidden.has(i)).map((i) => i.item), dropped: [...hidden].reduce((n, i) => n + i.events, 0) }
  }
  const last = [...hidden].at(-1) as FeedEntry
  const summary: ChatFeedItem = {
    event_id: last.item.event_id,
    at: last.item.at,
    kind: 'summary',
    action: 'created',
    entity_id: 'anonymous',
    title: null,
    status: null,
    labels: ['anonymous'],
    actor: 'anonymous',
    count,
  }
  return { items: sorted.flatMap((i) => (i === last ? [summary] : hidden.has(i) ? [] : [i.item])), dropped: 0 }
}
