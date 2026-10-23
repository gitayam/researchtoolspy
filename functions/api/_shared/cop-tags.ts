/**
 * COP tags: one vocabulary per session, applied to any COP item.
 *
 * Tables (managed migration 0023): `cop_tags` (the session's vocabulary, one row
 * per normalised name) and `cop_item_tags` (tag ↔ item links, unique per tag and
 * item). Every write checks IN SQL that the target item belongs to the session
 * (evidence: to the session's workspace), so a tag can never reach another
 * session's item by id.
 *
 * Names: trimmed, single-spaced, a leading `#` dropped, at most 40 characters of
 * letters, digits, spaces, `_`, `.` and `-`. The key used for uniqueness is the
 * lower-cased name, so `#Protest` and `protest` are one tag.
 */
import { emitCopEventLoose } from './cop-events-loose'
import { queryEvidenceInSession } from './cop-input'

export const TAG_TARGET_TYPES = [
  'evidence', 'marker', 'rfi', 'task', 'timeline', 'claim', 'hypothesis',
  'persona', 'asset', 'webcam', 'upload', 'submission',
] as const
export type TagTargetType = (typeof TAG_TARGET_TYPES)[number]

export const TAG_SOURCES = ['user', 'ai', 'rule', 'drop', 'chat'] as const
export type TagSource = (typeof TAG_SOURCES)[number]

export const MAX_TAG_LENGTH = 40
export const MAX_TAGS_PER_CALL = 10
export const MAX_TAGS_PER_SESSION = 500
export const MAX_BULK_TARGETS = 100
export const MAX_ITEM_TAG_ROWS = 5000

export const TAGS_UNAVAILABLE = 'TAGS_UNAVAILABLE'

const TAG_CHARS = /^[\p{L}\p{N} _.-]+$/u
const COLOR = /^#[0-9a-f]{6}$/i
const CATEGORY = /^[a-z0-9_-]{1,30}$/

export function isTagTargetType(value: unknown): value is TagTargetType {
  return typeof value === 'string' && (TAG_TARGET_TYPES as readonly string[]).includes(value)
}

export function isTagSource(value: unknown): value is TagSource {
  return typeof value === 'string' && (TAG_SOURCES as readonly string[]).includes(value)
}

/** The display form of a tag name, or null when it can't be one. */
export function cleanTagName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const name = raw.normalize('NFC').replace(/\s+/g, ' ').trim().replace(/^#+/, '').trim()
  if (!name || name.length > MAX_TAG_LENGTH || !TAG_CHARS.test(name)) return null
  return name
}

export function tagKey(name: string): string {
  return name.toLowerCase()
}

export function cleanTagColor(raw: unknown): string | null {
  return typeof raw === 'string' && COLOR.test(raw) ? raw.toLowerCase() : null
}

export function cleanTagCategory(raw: unknown): string | null {
  return typeof raw === 'string' && CATEGORY.test(raw) ? raw : null
}

/** `#words` in free text, as tag names (deterministic; no model). */
export function hashtagsIn(text: string): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const match of text.matchAll(/(?:^|[\s(,;])#([\p{L}\p{N}_][\p{L}\p{N}_.-]{0,39})/gu)) {
    const name = cleanTagName(match[1].replace(/[.-]+$/, ''))
    if (name && !seen.has(tagKey(name))) {
      seen.add(tagKey(name))
      out.push(name)
    }
  }
  return out
}

export function tagsTableMissing(error: unknown): boolean {
  return /no such table:\s*(?:main\.)?cop_(?:item_)?tags\b/i.test(String(error instanceof Error ? error.message : error))
}

export function isMissingTable(error: unknown): boolean {
  return /no such table/i.test(String(error instanceof Error ? error.message : error))
}

// ── Target ownership ───────────────────────────────────────────────────────

/** SQL that finds one item of a type in a session (or, for evidence, its workspace). */
const TARGET_SQL: Record<TagTargetType, { sql: string; scope: 'session' | 'workspace' }> = {
  // Evidence is checked by targetInSession with evidenceInSession (the COP's own items).
  evidence: { sql: 'SELECT 1 FROM evidence_items WHERE CAST(id AS TEXT) = ? AND workspace_id = ?', scope: 'workspace' },
  marker: { sql: 'SELECT 1 FROM cop_markers WHERE id = ? AND cop_session_id = ?', scope: 'session' },
  rfi: { sql: 'SELECT 1 FROM cop_rfis WHERE id = ? AND cop_session_id = ?', scope: 'session' },
  task: { sql: 'SELECT 1 FROM cop_tasks WHERE id = ? AND cop_session_id = ?', scope: 'session' },
  timeline: { sql: 'SELECT 1 FROM cop_timeline_entries WHERE id = ? AND cop_session_id = ?', scope: 'session' },
  claim: { sql: 'SELECT 1 FROM cop_claims WHERE id = ? AND cop_session_id = ?', scope: 'session' },
  hypothesis: { sql: 'SELECT 1 FROM cop_hypotheses WHERE id = ? AND cop_session_id = ?', scope: 'session' },
  persona: { sql: 'SELECT 1 FROM cop_personas WHERE id = ? AND cop_session_id = ?', scope: 'session' },
  asset: { sql: 'SELECT 1 FROM cop_assets WHERE id = ? AND cop_session_id = ?', scope: 'session' },
  webcam: { sql: 'SELECT 1 FROM cop_webcams WHERE id = ? AND cop_session_id = ? AND archived_at IS NULL', scope: 'session' },
  upload: { sql: 'SELECT 1 FROM cop_uploads WHERE id = ? AND cop_session_id = ? AND archived_at IS NULL', scope: 'session' },
  submission: { sql: 'SELECT 1 FROM survey_responses WHERE id = ? AND cop_session_id = ?', scope: 'session' },
}

/** True when the item exists in this session (evidence: in the session's workspace). */
export async function targetInSession(
  db: D1Database,
  scope: { sessionId: string; workspaceId: string },
  targetType: TagTargetType,
  targetId: string,
): Promise<boolean> {
  if (targetType === 'evidence') {
    // Only this COP's evidence, never another COP's in the same workspace.
    return Boolean(await queryEvidenceInSession(
      db,
      'SELECT 1 AS found FROM evidence_items WHERE CAST(id AS TEXT) = ? AND {EVIDENCE_SCOPE}',
      scope, [targetId], [],
      (statement) => statement.first(),
    ))
  }
  const { sql, scope: by } = TARGET_SQL[targetType]
  try {
    const row = await db.prepare(sql).bind(targetId, by === 'workspace' ? scope.workspaceId : scope.sessionId).first()
    return Boolean(row)
  } catch (error) {
    if (isMissingTable(error)) return false
    throw error
  }
}

export function cleanTargetId(raw: unknown): string | null {
  const id = typeof raw === 'number' && Number.isSafeInteger(raw) ? String(raw) : raw
  return typeof id === 'string' && /^[A-Za-z0-9_.:-]{1,80}$/.test(id) ? id : null
}

// ── Vocabulary ─────────────────────────────────────────────────────────────

export interface TagRow {
  id: string
  name: string
  color: string | null
  category: string | null
}

export class TagLimitError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TagLimitError'
  }
}

/**
 * The tag rows for these names in the session, creating the missing ones.
 * Concurrent creators converge on one row per name (INSERT OR IGNORE on the unique key).
 */
export async function ensureTags(
  db: D1Database,
  sessionId: string,
  names: string[],
  actorUserId: number | null,
  options: { color?: string | null; category?: string | null } = {},
): Promise<TagRow[]> {
  const byKey = new Map<string, string>()
  for (const raw of names) {
    const name = cleanTagName(raw)
    if (name && !byKey.has(tagKey(name))) byKey.set(tagKey(name), name)
  }
  if (byKey.size === 0) return []

  const existing = await selectTags(db, sessionId, [...byKey.keys()])
  const missing = [...byKey.entries()].filter(([key]) => !existing.has(key))
  // Archived rows count as existing (the UPDATE below revives them).
  if (missing.length > 0) {
    const count = await db.prepare('SELECT COUNT(*) AS n FROM cop_tags WHERE cop_session_id = ? AND archived_at IS NULL')
      .bind(sessionId).first<{ n: number }>()
    if (Number(count?.n ?? 0) + missing.length > MAX_TAGS_PER_SESSION) {
      throw new TagLimitError(`A session holds at most ${MAX_TAGS_PER_SESSION} tags.`)
    }
    const now = new Date().toISOString()
    for (const [key, name] of missing) {
      const created = await db.prepare(`
        INSERT OR IGNORE INTO cop_tags (id, cop_session_id, name, name_key, color, category, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(`tag-${crypto.randomUUID()}`, sessionId, name, key, options.color ?? null, options.category ?? null, actorUserId, now).run()
      if (created.meta?.changes) {
        await emitCopEventLoose(db, {
          copSessionId: sessionId, eventType: 'tag.created', entityType: 'tag', entityId: key,
          payload: { name }, createdBy: actorUserId ?? 0,
        })
      }
    }
  }
  // An archived row with the same key is brought back rather than duplicated.
  await db.prepare(`UPDATE cop_tags SET archived_at = NULL WHERE cop_session_id = ? AND name_key IN (${[...byKey.keys()].map(() => '?').join(',')}) AND archived_at IS NOT NULL`)
    .bind(sessionId, ...byKey.keys()).run()
  const all = await selectTags(db, sessionId, [...byKey.keys()])
  return [...byKey.keys()].map((key) => all.get(key)).filter((row): row is TagRow => Boolean(row))
}

async function selectTags(db: D1Database, sessionId: string, keys: string[]): Promise<Map<string, TagRow>> {
  const rows = await db.prepare(
    `SELECT id, name, name_key, color, category FROM cop_tags WHERE cop_session_id = ? AND name_key IN (${keys.map(() => '?').join(',')})`
  ).bind(sessionId, ...keys).all<TagRow & { name_key: string }>()
  return new Map((rows.results ?? []).map((r) => [r.name_key, { id: r.id, name: r.name, color: r.color, category: r.category }]))
}

/** The session's tags with how many items carry each. */
export async function listSessionTags(db: D1Database, sessionId: string): Promise<(TagRow & { count: number })[]> {
  const rows = await db.prepare(`
    SELECT t.id, t.name, t.color, t.category, COUNT(it.id) AS count
    FROM cop_tags t
    LEFT JOIN cop_item_tags it ON it.tag_id = t.id AND it.cop_session_id = t.cop_session_id
    WHERE t.cop_session_id = ? AND t.archived_at IS NULL
    GROUP BY t.id
    ORDER BY count DESC, t.name_key ASC
    LIMIT ${MAX_TAGS_PER_SESSION}
  `).bind(sessionId).all<TagRow & { count: number }>()
  return (rows.results ?? []).map((r) => ({ id: r.id, name: r.name, color: r.color, category: r.category, count: Number(r.count) || 0 }))
}

/** Names of the session's live tags (the vocabulary AI suggestions are filtered to). */
export async function sessionTagNames(db: D1Database, sessionId: string): Promise<string[]> {
  try {
    const rows = await db.prepare('SELECT name FROM cop_tags WHERE cop_session_id = ? AND archived_at IS NULL ORDER BY name_key LIMIT ?')
      .bind(sessionId, MAX_TAGS_PER_SESSION).all<{ name: string }>()
    return (rows.results ?? []).map((r) => r.name)
  } catch (error) {
    if (tagsTableMissing(error)) return []
    throw error
  }
}

// ── Item tags ──────────────────────────────────────────────────────────────

export interface ApplyTagsInput {
  sessionId: string
  targetType: TagTargetType
  targetId: string
  names: string[]
  source: TagSource
  actorUserId: number | null
  confidence?: number | null
}

/**
 * Link tags (created as needed) to one item. The caller has already checked the
 * item belongs to the session. Returns the item's tag names afterwards.
 */
export async function applyItemTags(db: D1Database, input: ApplyTagsInput): Promise<string[]> {
  if (input.names.length > MAX_TAGS_PER_CALL) throw new TagLimitError(`At most ${MAX_TAGS_PER_CALL} tags at a time.`)
  const tags = await ensureTags(db, input.sessionId, input.names, input.actorUserId)
  const now = new Date().toISOString()
  const confidence = Number.isInteger(input.confidence) ? Math.min(100, Math.max(0, input.confidence as number)) : null
  const added: string[] = []
  for (const tag of tags) {
    const linked = await db.prepare(`
      INSERT OR IGNORE INTO cop_item_tags (id, cop_session_id, tag_id, target_type, target_id, source, confidence, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(`itg-${crypto.randomUUID()}`, input.sessionId, tag.id, input.targetType, input.targetId, input.source, confidence, input.actorUserId, now).run()
    if (linked.meta?.changes) added.push(tag.name)
  }
  if (added.length > 0) {
    await emitCopEventLoose(db, {
      copSessionId: input.sessionId, eventType: 'tag.applied', entityType: 'tag', entityId: `${input.targetType}:${input.targetId}`,
      payload: { target_type: input.targetType, target_id: input.targetId, tags: added, source: input.source },
      createdBy: input.actorUserId ?? 0,
    })
  }
  return itemTagNames(db, input.sessionId, input.targetType, input.targetId)
}

export async function removeItemTags(
  db: D1Database,
  input: { sessionId: string; targetType: TagTargetType; targetId: string; names: string[]; actorUserId: number | null },
): Promise<string[]> {
  const keys = input.names.map(cleanTagName).filter((n): n is string => Boolean(n)).map(tagKey)
  if (keys.length > 0) {
    const removed = await db.prepare(`
      DELETE FROM cop_item_tags
      WHERE cop_session_id = ? AND target_type = ? AND target_id = ?
        AND tag_id IN (SELECT id FROM cop_tags WHERE cop_session_id = ? AND name_key IN (${keys.map(() => '?').join(',')}))
    `).bind(input.sessionId, input.targetType, input.targetId, input.sessionId, ...keys).run()
    if (removed.meta?.changes) {
      await emitCopEventLoose(db, {
        copSessionId: input.sessionId, eventType: 'tag.removed', entityType: 'tag', entityId: `${input.targetType}:${input.targetId}`,
        payload: { target_type: input.targetType, target_id: input.targetId, tags: keys },
        createdBy: input.actorUserId ?? 0,
      })
    }
  }
  return itemTagNames(db, input.sessionId, input.targetType, input.targetId)
}

/** Remove every tag link of one item (the item itself went away). */
export async function dropItemTags(db: D1Database, sessionId: string, targetType: TagTargetType, targetId: string): Promise<void> {
  try {
    await db.prepare('DELETE FROM cop_item_tags WHERE cop_session_id = ? AND target_type = ? AND target_id = ?')
      .bind(sessionId, targetType, targetId).run()
  } catch (error) {
    if (!tagsTableMissing(error)) throw error
  }
}

export async function itemTagNames(db: D1Database, sessionId: string, targetType: TagTargetType, targetId: string): Promise<string[]> {
  const rows = await db.prepare(`
    SELECT t.name FROM cop_item_tags it JOIN cop_tags t ON t.id = it.tag_id
    WHERE it.cop_session_id = ? AND it.target_type = ? AND it.target_id = ?
    ORDER BY t.name_key
  `).bind(sessionId, targetType, targetId).all<{ name: string }>()
  return (rows.results ?? []).map((r) => r.name)
}

/** Every tagged item in the session, optionally one type and/or one tag, grouped per item. */
export async function listItemTags(
  db: D1Database,
  sessionId: string,
  filter: { targetType?: TagTargetType; tag?: string } = {},
): Promise<{ items: { target_type: string; target_id: string; tags: string[] }[]; truncated: boolean }> {
  const where = ['it.cop_session_id = ?']
  const binds: unknown[] = [sessionId]
  if (filter.targetType) {
    where.push('it.target_type = ?')
    binds.push(filter.targetType)
  }
  if (filter.tag) {
    where.push(`it.target_type || ':' || it.target_id IN (
      SELECT i2.target_type || ':' || i2.target_id FROM cop_item_tags i2 JOIN cop_tags t2 ON t2.id = i2.tag_id
      WHERE i2.cop_session_id = ? AND t2.name_key = ?)`)
    binds.push(sessionId, tagKey(filter.tag))
  }
  const rows = await db.prepare(`
    SELECT it.target_type, it.target_id, t.name FROM cop_item_tags it JOIN cop_tags t ON t.id = it.tag_id
    WHERE ${where.join(' AND ')}
    ORDER BY it.target_type, it.target_id, t.name_key
    LIMIT ${MAX_ITEM_TAG_ROWS + 1}
  `).bind(...binds).all<{ target_type: string; target_id: string; name: string }>()
  const results = rows.results ?? []
  const truncated = results.length > MAX_ITEM_TAG_ROWS
  const items = new Map<string, { target_type: string; target_id: string; tags: string[] }>()
  for (const r of results.slice(0, MAX_ITEM_TAG_ROWS)) {
    const key = `${r.target_type}:${r.target_id}`
    let item = items.get(key)
    if (!item) {
      item = { target_type: r.target_type, target_id: r.target_id, tags: [] }
      items.set(key, item)
    }
    item.tags.push(r.name)
  }
  return { items: [...items.values()], truncated }
}
