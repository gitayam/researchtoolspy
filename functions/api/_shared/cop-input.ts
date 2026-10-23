/**
 * COP input rules shared by the COP write routes (managed migration 0022):
 *   - provenance: where an item came from (`source_channel`), set by the server from
 *     the caller, never from the request body;
 *   - canonical URLs, so the same link twice is one evidence item;
 *   - stale-write checks (409 STALE_WRITE) for edits that carry the version they read;
 *   - key questions = starred RFIs (`cop_rfis.is_key`), kept in step with the session's
 *     `key_questions` list in both directions;
 *   - a service may delete only the items it created.
 *
 * Every helper tolerates migration 0022 not being applied yet: the missing column is
 * skipped and the write goes ahead as before.
 */
import { generatePrefixedId, JSON_HEADERS } from './api-utils'
import { copServiceCaller } from './cop-caller'
import { emitCopEvent } from './cop-events'
import { RFI_CREATED, RFI_STARRED, RFI_UNSTARRED, SESSION_UPDATED } from './cop-event-types'

export function isMissingColumn(error: unknown): boolean {
  return /no such column|has no column named/i.test(String(error instanceof Error ? error.message : error))
}

// ── Provenance ───────────────────────────────────────────────────

export type SourceChannel = 'web' | 'signal' | 'drop' | 'scrape' | 'api'

/**
 * Where a write came from, judged from the caller: a service credential whose client
 * is the Signal bot is 'signal', any other service 'api', a signed-in person 'web'.
 * Routes that create items for the drop form or the scraper pass 'drop' / 'scrape'.
 */
export function copSourceChannel(context: { data?: unknown }): SourceChannel {
  const service = copServiceCaller(context.data)
  if (!service) return 'web'
  return /signal/i.test(service.clientId) ? 'signal' : 'api'
}

/** The caller's service client id (source_ref for service writes), or null for a person. */
export function copSourceRef(context: { data?: unknown }): string | null {
  return copServiceCaller(context.data)?.clientId ?? null
}

const PROVENANCE_TABLES = new Set([
  'evidence_items', 'cop_markers', 'cop_rfis', 'cop_tasks', 'cop_timeline_entries', 'cop_claims', 'cop_hypotheses',
])

/**
 * Record where an item came from. A separate UPDATE after the insert, so the insert
 * itself never depends on migration 0022; before it, this does nothing.
 */
export async function setProvenance(
  db: D1Database,
  table: string,
  id: string | number,
  channel: SourceChannel,
  ref: string | null = null,
): Promise<void> {
  if (!PROVENANCE_TABLES.has(table)) throw new Error(`setProvenance: unknown table ${table}`)
  try {
    await db.prepare(`UPDATE ${table} SET source_channel = ?, source_ref = ? WHERE id = ?`)
      .bind(channel, ref, id).run()
  } catch (error) {
    if (!isMissingColumn(error)) throw error
  }
}

// ── Canonical URLs ───────────────────────────────────────────────

const TRACKING_PARAMS = /^(?:utm_[a-z0-9_]*|fbclid|gclid)$/i

/**
 * The form of a link used to spot the same page twice: http(s) only, lowercase host,
 * no fragment, no utm_* / fbclid / gclid, no trailing slash. Null for anything else.
 */
export function canonicalUrl(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return null
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_PARAMS.test(key)) url.searchParams.delete(key)
  }
  const search = url.searchParams.toString()
  const path = url.pathname.replace(/\/+$/, '')
  return `${url.protocol}//${url.host.toLowerCase()}${path}${search ? `?${search}` : ''}`
}

// ── Stale writes ─────────────────────────────────────────────────

/**
 * The version a client says it read: `if_updated_at` in the body, or an If-Match
 * header carrying the row's updated_at. Null when the client sent neither (then the
 * last write wins, as before).
 */
export function expectedUpdatedAt(request: Request, body: unknown): string | null {
  const fromBody = (body as { if_updated_at?: unknown } | null)?.if_updated_at
  if (typeof fromBody === 'string' && fromBody.trim()) return fromBody.trim()
  const header = request.headers.get('If-Match')
  if (!header) return null
  const value = header.trim().replace(/^W\//, '').replace(/^"(.*)"$/, '$1').trim()
  return value && value !== '*' ? value : null
}

export function staleWriteResponse(current: unknown): Response {
  return new Response(JSON.stringify({
    error: 'Someone else changed this since you loaded it',
    code: 'STALE_WRITE',
    current,
  }), { status: 409, headers: JSON_HEADERS })
}

// ── Services delete only their own items ─────────────────────────

/**
 * A person with write access may delete any item; a service (the Signal bot's
 * credential) only items its principal user created, so a leaked bot token can undo
 * the bot's own captures and nothing else.
 */
export function serviceMayDelete(context: { data?: unknown }, createdBy: unknown): boolean {
  const service = copServiceCaller(context.data)
  if (!service) return true
  return createdBy != null && String(createdBy) === String(service.principalUserId)
}

/** The same rule for edits a service makes (confirming a marker, starring an RFI). */
export const serviceMayChange = serviceMayDelete

export function serviceChangeRefused(): Response {
  return new Response(JSON.stringify({ error: 'A service may only change items it created' }), {
    status: 403, headers: JSON_HEADERS,
  })
}

export function serviceDeleteRefused(): Response {
  return new Response(JSON.stringify({ error: 'A service may only delete items it created' }), {
    status: 403, headers: JSON_HEADERS,
  })
}

// ── Key questions = starred RFIs ─────────────────────────────────

const MAX_KEY_QUESTIONS = 50
const MAX_QUESTION_LENGTH = 1000

/** Comparison form of a question: lowercase, single spaces, no trailing ? or spaces. */
export function normalizeQuestion(question: string): string {
  return question.toLowerCase().replace(/\s+/g, ' ').trim().replace(/[?\s]+$/, '')
}

/** A session's key_questions value as a clean list of question strings. */
export function cleanKeyQuestions(value: unknown): string[] {
  let list: unknown = value
  if (typeof value === 'string') {
    try { list = JSON.parse(value) } catch { return [] }
  }
  if (!Array.isArray(list)) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const item of list) {
    if (typeof item !== 'string') continue
    const text = item.trim().slice(0, MAX_QUESTION_LENGTH)
    const key = normalizeQuestion(text)
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(text)
    if (out.length >= MAX_KEY_QUESTIONS) break
  }
  return out
}

interface RfiRow { id: string; question: string; is_key: number | null }

/**
 * Make the session's starred RFIs match `questions`: an RFI with the same question is
 * starred, a question without one becomes a new open, high-priority RFI, and a starred
 * RFI whose question is no longer listed is unstarred (never deleted). Does nothing
 * before migration 0022 (no is_key column).
 */
export async function syncKeyQuestionsToRfis(
  db: D1Database,
  sessionId: string,
  questions: string[],
  actorUserId: number,
): Promise<{ created: number; starred: number; unstarred: number }> {
  const counts = { created: 0, starred: 0, unstarred: 0 }
  let rows: RfiRow[]
  try {
    rows = ((await db.prepare('SELECT id, question, is_key FROM cop_rfis WHERE cop_session_id = ?')
      .bind(sessionId).all<RfiRow>()).results ?? [])
  } catch (error) {
    if (isMissingColumn(error)) return counts
    throw error
  }
  const byQuestion = new Map<string, RfiRow>()
  for (const row of rows) {
    const key = normalizeQuestion(String(row.question ?? ''))
    if (key && !byQuestion.has(key)) byQuestion.set(key, row)
  }

  const wanted = new Set<string>()
  const now = new Date().toISOString()
  for (const question of questions) {
    const key = normalizeQuestion(question)
    if (!key) continue
    wanted.add(key)
    const existing = byQuestion.get(key)
    if (existing) {
      if (!existing.is_key) {
        await db.prepare('UPDATE cop_rfis SET is_key = 1, updated_at = ? WHERE id = ? AND cop_session_id = ?')
          .bind(now, existing.id, sessionId).run()
        existing.is_key = 1
        counts.starred += 1
        await emitCopEvent(db, { copSessionId: sessionId, eventType: RFI_STARRED, entityType: 'rfi', entityId: existing.id, createdBy: actorUserId })
      }
      continue
    }
    const id = generatePrefixedId('rfi')
    await db.prepare(`
      INSERT INTO cop_rfis (id, cop_session_id, question, priority, status, is_blocker, created_by, requester_name, created_at, updated_at, is_key)
      VALUES (?, ?, ?, 'high', 'open', 0, ?, 'Key question', ?, ?, 1)
    `).bind(id, sessionId, question, actorUserId, now, now).run()
    await setProvenance(db, 'cop_rfis', id, 'web')
    byQuestion.set(key, { id, question, is_key: 1 })
    counts.created += 1
    await emitCopEvent(db, { copSessionId: sessionId, eventType: RFI_CREATED, entityType: 'rfi', entityId: id, payload: { is_key: true }, createdBy: actorUserId })
  }

  for (const row of rows) {
    if (!row.is_key) continue
    if (wanted.has(normalizeQuestion(String(row.question ?? '')))) continue
    await db.prepare('UPDATE cop_rfis SET is_key = 0, updated_at = ? WHERE id = ? AND cop_session_id = ?')
      .bind(now, row.id, sessionId).run()
    counts.unstarred += 1
    await emitCopEvent(db, { copSessionId: sessionId, eventType: RFI_UNSTARRED, entityType: 'rfi', entityId: row.id, createdBy: actorUserId })
  }
  return counts
}

/**
 * Rewrite the session's key_questions from its starred RFIs, keeping the session's
 * own order for questions still starred and appending newly starred ones, so readers
 * of key_questions see the same list as the Questions tab.
 */
export async function rewriteSessionKeyQuestions(
  db: D1Database,
  sessionId: string,
  actorUserId: number,
): Promise<string[] | null> {
  let starred: { question: string }[]
  try {
    starred = ((await db.prepare(
      'SELECT question FROM cop_rfis WHERE cop_session_id = ? AND is_key = 1 ORDER BY created_at ASC, rowid ASC'
    ).bind(sessionId).all<{ question: string }>()).results ?? [])
  } catch (error) {
    if (isMissingColumn(error)) return null
    throw error
  }
  const session = await db.prepare('SELECT key_questions FROM cop_sessions WHERE id = ?')
    .bind(sessionId).first<{ key_questions: string | null }>()
  const starredKeys = new Map(starred.map((r) => [normalizeQuestion(r.question), r.question]))
  const out: string[] = []
  const used = new Set<string>()
  for (const question of cleanKeyQuestions(session?.key_questions)) {
    const key = normalizeQuestion(question)
    if (starredKeys.has(key) && !used.has(key)) {
      out.push(question)
      used.add(key)
    }
  }
  for (const [key, question] of starredKeys) {
    if (!used.has(key)) {
      out.push(question)
      used.add(key)
    }
  }
  await db.prepare('UPDATE cop_sessions SET key_questions = ?, updated_at = ? WHERE id = ?')
    .bind(JSON.stringify(out), new Date().toISOString(), sessionId).run()
  await emitCopEvent(db, { copSessionId: sessionId, eventType: SESSION_UPDATED, entityType: 'session', entityId: sessionId, payload: { key_questions: out.length }, createdBy: actorUserId })
  return out
}

// ── Evidence that belongs to a COP session ───────────────────────

/**
 * evidence_items is workspace-wide, and a COP often shares its owner's main workspace,
 * so the COP's evidence is what carries its cop_session_id (migration 0022). A row
 * without one (saved before it) is the session's only when the session has a workspace
 * of its own (workspace_id = session id).
 */
export interface EvidenceSessionScope {
  sessionId: string
  workspaceId: string
}

/**
 * The WHERE clause (columns of evidence_items, optionally prefixed) and its binds that
 * keep a query to the session's evidence. `legacy` is the clause to use when
 * cop_session_id doesn't exist yet: only a dedicated workspace counts then.
 */
export function evidenceInSession(scope: EvidenceSessionScope, alias = ''): {
  sql: string
  binds: unknown[]
  legacySql: string
  legacyBinds: unknown[]
} {
  const a = alias ? `${alias}.` : ''
  const dedicated = scope.workspaceId === scope.sessionId
  return {
    sql: dedicated
      ? `(${a}workspace_id = ? AND (${a}cop_session_id = ? OR ${a}cop_session_id IS NULL))`
      : `(${a}workspace_id = ? AND ${a}cop_session_id = ?)`,
    binds: [scope.workspaceId, scope.sessionId],
    legacySql: dedicated ? `(${a}workspace_id = ?)` : '(0 = 1)',
    legacyBinds: dedicated ? [scope.workspaceId] : [],
  }
}

/**
 * Run a query that has one `{EVIDENCE_SCOPE}` placeholder for evidenceInSession's clause:
 * with cop_session_id, or (before migration 0022) with the legacy clause. `before` and
 * `after` are the binds around the placeholder.
 */
export async function queryEvidenceInSession<T>(
  db: D1Database,
  sqlTemplate: string,
  scope: EvidenceSessionScope,
  before: unknown[],
  after: unknown[],
  run: (statement: D1PreparedStatement) => Promise<T>,
  alias = '',
): Promise<T> {
  const clause = evidenceInSession(scope, alias)
  try {
    return await run(db.prepare(sqlTemplate.replace('{EVIDENCE_SCOPE}', clause.sql)).bind(...before, ...clause.binds, ...after))
  } catch (error) {
    if (!isMissingColumn(error)) throw error
    return run(db.prepare(sqlTemplate.replace('{EVIDENCE_SCOPE}', clause.legacySql)).bind(...before, ...clause.legacyBinds, ...after))
  }
}

/** Record the COP session an evidence item belongs to; nothing before migration 0022. */
export async function setEvidenceSession(db: D1Database, evidenceId: string | number, sessionId: string): Promise<void> {
  try {
    await db.prepare('UPDATE evidence_items SET cop_session_id = ? WHERE id = ? AND cop_session_id IS NULL')
      .bind(sessionId, evidenceId).run()
  } catch (error) {
    if (!isMissingColumn(error)) throw error
  }
}

// ── Unreviewed drop-form tips on public views ─────────────────────

/** The label a public view shows for a drop-form tip no editor has confirmed yet. */
export const UNVERIFIED_TIP_LABEL = 'Unverified tip'

/** A marker from the drop form that nobody has raised above POSSIBLE. */
export function unreviewedTipMarker(row: { source_channel?: unknown; confidence?: unknown }): boolean {
  return row.source_channel === 'drop' && (row.confidence == null || row.confidence === 'POSSIBLE')
}

/** An evidence item from the drop form whose credibility nobody has changed. */
export function unreviewedTipEvidence(row: { source_channel?: unknown; credibility?: unknown }): boolean {
  return row.source_channel === 'drop' && (row.credibility == null || row.credibility === 'unverified')
}
