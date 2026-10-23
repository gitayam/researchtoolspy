import { AsyncLocalStorage } from 'node:async_hooks'
import {
  COP_FEED_ENTITY_TYPES,
  LEGACY_ENTITY_TYPES,
  type CopEventType,
  type CopEventEntityType,
  type CopFeedEntityType,
} from './cop-event-types'

interface EmitCopEventParams {
  copSessionId: string
  eventType: CopEventType
  entityType: CopEventEntityType
  entityId?: string | null
  payload?: Record<string, unknown>
  createdBy: number
}

/**
 * Generate a ULID-like sortable ID.
 * Uses timestamp prefix (base36) + random suffix for uniqueness.
 * Lexicographic order = chronological order.
 */
function generateEventId(): string {
  const timestamp = Date.now().toString(36).padStart(9, '0')
  const random = crypto.randomUUID().replace(/-/g, '').slice(0, 12)
  return `evt-${timestamp}-${random}`
}

// Counts the events a request emitted, so the COP middleware can tell a write that
// emitted nothing (see trackCopEvents).
// One tracker per isolate, even when a test bundles the middleware and a route
// separately (each bundle would otherwise get its own module copy and count nothing).
const TRACKER_KEY = Symbol.for('researchtools.copEventTracker')
const emitTracker: AsyncLocalStorage<{ emitted: number }> =
  ((globalThis as Record<symbol, unknown>)[TRACKER_KEY] as AsyncLocalStorage<{ emitted: number }> | undefined) ??
  ((globalThis as Record<symbol, unknown>)[TRACKER_KEY] = new AsyncLocalStorage<{ emitted: number }>())

/**
 * Run a request handler while counting the COP events it emits. The COP middleware
 * wraps every write in this and emits a generic `entity.changed` event when a
 * successful write emitted none, so the change feed never misses a write.
 */
export async function trackCopEvents<T>(fn: () => Promise<T>): Promise<{ result: T; emitted: number }> {
  const store = { emitted: 0 }
  const result = await emitTracker.run(store, fn)
  return { result, emitted: store.emitted }
}

/**
 * Emit a structured event to the cop_events bus.
 * Called after every COP mutation. Fire-and-forget — errors are logged
 * but never block the primary response.
 */
export async function emitCopEvent(
  db: D1Database,
  params: EmitCopEventParams
): Promise<void> {
  try {
    const id = generateEventId()
    const payloadStr = JSON.stringify(params.payload ?? {})

    await db.prepare(`
      INSERT INTO cop_events (id, cop_session_id, event_type, entity_type, entity_id, payload, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      params.copSessionId,
      params.eventType,
      params.entityType,
      params.entityId ?? null,
      payloadStr,
      params.createdBy
    ).run()
    const store = emitTracker.getStore()
    if (store) store.emitted += 1
  } catch (error) {
    // Fire-and-forget: log but never block the primary operation
    console.error('[COP Events] Failed to emit event:', params.eventType, error)
  }
}

/**
 * Emit several events in one D1 batch (e.g. one per claim of a bulk create), so each
 * carries its own entity id without a round trip per row. Same fire-and-forget rule.
 */
export async function emitCopEvents(db: D1Database, events: EmitCopEventParams[]): Promise<void> {
  // D1 binds at most 100 parameters per statement; one row per statement keeps it simple.
  for (let i = 0; i < events.length; i += 50) {
    const chunk = events.slice(i, i + 50)
    try {
      await db.batch(chunk.map((params) => db.prepare(`
        INSERT INTO cop_events (id, cop_session_id, event_type, entity_type, entity_id, payload, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        generateEventId(),
        params.copSessionId,
        params.eventType,
        params.entityType,
        params.entityId ?? null,
        JSON.stringify(params.payload ?? {}),
        params.createdBy,
      )))
      const store = emitTracker.getStore()
      if (store) store.emitted += chunk.length
    } catch (error) {
      console.error('[COP Events] Failed to emit events:', chunk[0]?.eventType, error)
    }
  }
}

// ── Change feed ──────────────────────────────────────────────────

const FEED_TYPES: ReadonlySet<string> = new Set(COP_FEED_ENTITY_TYPES)

/** The feed's entity type for a stored one, or null for a type the feed doesn't show. */
export function feedEntityType(stored: string | null | undefined): CopFeedEntityType | null {
  const type = String(stored ?? '')
  if (FEED_TYPES.has(type)) return type as CopFeedEntityType
  return LEGACY_ENTITY_TYPES[type] ?? null
}

export interface CopChange {
  id: string
  entity_type: CopFeedEntityType
  entity_id: string | null
  event_type: string
  created_at: string | null
}

export type CopChangesResult =
  | { ok: true; events: CopChange[]; cursor: string; has_more: boolean }
  | { ok: false; status: 400; error: string }

export const CHANGES_DEFAULT_LIMIT = 200
export const CHANGES_MAX_LIMIT = 500

export function changesLimit(raw: string | null): number {
  const n = Number.parseInt(raw ?? '', 10)
  if (!Number.isFinite(n) || n < 1) return CHANGES_DEFAULT_LIMIT
  return Math.min(n, CHANGES_MAX_LIMIT)
}

export type SinceCursor =
  | { ok: true; fromNow: true; cursor: string }
  | { ok: true; fromNow: false; after: number }
  | { ok: false; status: 400; error: string }

/**
 * Where a feed read starts (the change feed and the chat feed). `since` '' or absent:
 * from now (fromNow, with the session's latest cursor). A cursor from an earlier answer
 * (the event row's rowid), or an event id of this session: after that row. Anything
 * else is a 400.
 */
export async function resolveSinceCursor(db: D1Database, sessionId: string, since: string | null): Promise<SinceCursor> {
  const raw = (since ?? '').trim()
  if (raw === '') {
    const latest = await db.prepare('SELECT MAX(rowid) AS seq FROM cop_events WHERE cop_session_id = ?')
      .bind(sessionId).first<{ seq: number | null }>()
    return { ok: true, fromNow: true, cursor: String(latest?.seq ?? 0) }
  }
  if (/^\d{1,15}$/.test(raw)) return { ok: true, fromNow: false, after: Number(raw) }
  if (/^evt-[a-z0-9-]{1,64}$/i.test(raw)) {
    const row = await db.prepare('SELECT rowid AS seq FROM cop_events WHERE id = ? AND cop_session_id = ?')
      .bind(raw, sessionId).first<{ seq: number }>()
    if (!row) return { ok: false, status: 400, error: 'Unknown since cursor' }
    return { ok: true, fromNow: false, after: Number(row.seq) }
  }
  return { ok: false, status: 400, error: 'Invalid since cursor' }
}

/**
 * The session's changes after `since`, oldest first.
 *
 * The cursor is the event row's rowid, as an opaque string. D1 runs one writer, so a
 * later commit always has a larger rowid: a client that resumes from the cursor sees
 * every later event, with no gap even when more events arrived than `limit`. (Event
 * ids are time-sortable but random within a millisecond, so they can't be a cursor.)
 *
 * `since` is '' or absent to start from now (no events, the latest cursor), a cursor
 * from an earlier answer, or an event id. `allowed` restricts the entity types
 * returned (the public feed); rows of other types still advance the cursor.
 * `redactIds` lists types whose entity_id is answered as null (the public feed).
 * Payloads and user ids never leave.
 */
export async function listCopChanges(
  db: D1Database,
  sessionId: string,
  since: string | null,
  limit: number,
  allowed?: ReadonlySet<CopFeedEntityType>,
  redactIds?: ReadonlySet<CopFeedEntityType>,
): Promise<CopChangesResult> {
  const start = await resolveSinceCursor(db, sessionId, since)
  if (start.ok === false) return start
  if (start.fromNow === true) return { ok: true, events: [], cursor: start.cursor, has_more: false }
  const after = start.after

  const rows = await db.prepare(`
    SELECT rowid AS seq, id, entity_type, entity_id, event_type, created_at
    FROM cop_events
    WHERE cop_session_id = ? AND rowid > ?
    ORDER BY rowid ASC
    LIMIT ?
  `).bind(sessionId, after, limit + 1).all<{
    seq: number; id: string; entity_type: string; entity_id: string | null; event_type: string; created_at: string | null
  }>()

  const scanned = (rows.results ?? []).slice(0, limit)
  const events: CopChange[] = []
  for (const row of scanned) {
    const type = feedEntityType(row.entity_type)
    if (!type || (allowed && !allowed.has(type))) continue
    events.push({
      id: row.id,
      entity_type: type,
      entity_id: row.entity_id == null || redactIds?.has(type) ? null : String(row.entity_id),
      event_type: row.event_type,
      created_at: row.created_at ?? null,
    })
  }
  const last = scanned.at(-1)
  return {
    ok: true,
    events,
    cursor: String(last ? last.seq : after),
    has_more: (rows.results ?? []).length > limit,
  }
}
