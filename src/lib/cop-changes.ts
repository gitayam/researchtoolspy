/**
 * The pure parts of the COP change feed (`GET /api/cop/:id/changes`), kept apart
 * from the React hook so they can be unit-tested.
 *
 * The server answers `{ events, cursor, has_more }`, oldest first. An empty
 * `since` returns no events and the latest cursor: a starting point, since what
 * happened before it is already on screen. A server without the route answers
 * 404/405, or (Pages' SPA fallback for an unknown GET) the app's HTML with 200;
 * both mean "no feed here", and the page falls back to a slow full refresh.
 */
import type { CopChangeEvent, CopEntityType } from '@/types/cop'

/** Poll interval while the feed works and the tab is visible. */
export const CHANGES_LIVE_MS = 5_000
/** Full refresh interval when the server has no change feed. */
export const CHANGES_NO_FEED_MS = 30_000
/** Longest wait between retries after errors. */
export const CHANGES_MAX_BACKOFF_MS = 60_000
/** Delay before the next page while the server says it has more. */
export const CHANGES_MORE_MS = 250
/** Each panel still refetches this often, in case an event was missed. */
export const PANEL_SAFETY_MS = 120_000

/** Every entity type the server's feed can report (contract vocabulary). */
export const COP_ENTITY_TYPES: readonly CopEntityType[] = [
  'evidence', 'marker', 'rfi', 'task', 'timeline', 'claim', 'hypothesis',
  'persona', 'poo', 'asset', 'webcam', 'tag', 'upload', 'submission',
  'share', 'session', 'playbook', 'activity',
]
const KNOWN = new Set<string>(COP_ENTITY_TYPES)

export type ChangesOutcome =
  | { kind: 'events'; events: CopChangeEvent[]; cursor: string | null; hasMore: boolean }
  | { kind: 'no-feed' }
  | { kind: 'error' }

/** Read one `/changes` response (status, content type and parsed body, or null). */
export function interpretChangesResponse(status: number, contentType: string | null, body: unknown): ChangesOutcome {
  if (status === 404 || status === 405) return { kind: 'no-feed' }
  const isJson = (contentType ?? '').toLowerCase().includes('application/json')
  if (status >= 200 && status < 300 && !isJson) return { kind: 'no-feed' }
  if (status < 200 || status >= 300) return { kind: 'error' }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { kind: 'error' }
  const data = body as { events?: unknown; cursor?: unknown; has_more?: unknown }
  if (!Array.isArray(data.events)) return { kind: 'error' }
  const events = data.events.filter(isChangeEvent)
  return {
    kind: 'events',
    events,
    cursor: typeof data.cursor === 'string' && data.cursor.length > 0 && data.cursor.length <= 200 ? data.cursor : null,
    hasMore: data.has_more === true,
  }
}

function isChangeEvent(value: unknown): value is CopChangeEvent {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (typeof v.id === 'string' || typeof v.id === 'number') && typeof v.entity_type === 'string'
}

/** The known entity types among some events, each once, in the vocabulary's order. */
export function changedEntityTypes(events: readonly Pick<CopChangeEvent, 'entity_type'>[]): CopEntityType[] {
  const seen = new Set(events.map(e => e.entity_type).filter(t => KNOWN.has(t)))
  return COP_ENTITY_TYPES.filter(t => seen.has(t))
}

/**
 * Where the poller goes next, given what it had and what came back.
 * `notify` lists the types to announce: none for the first answer (a starting
 * point) or an empty page; every type once per slow tick while there is no feed.
 */
export function planNextPoll(
  state: { cursor: string | null; delay: number; started: boolean },
  outcome: ChangesOutcome,
): { cursor: string | null; delay: number; started: boolean; mode: 'live' | 'fallback' | 'retry'; notify: CopEntityType[] } {
  if (outcome.kind === 'no-feed') {
    return { cursor: state.cursor, delay: CHANGES_NO_FEED_MS, started: state.started, mode: 'fallback', notify: [...COP_ENTITY_TYPES] }
  }
  if (outcome.kind === 'error') {
    const delay = Math.min(Math.max(state.delay, CHANGES_LIVE_MS) * 2, CHANGES_MAX_BACKOFF_MS)
    return { cursor: state.cursor, delay, started: state.started, mode: 'retry', notify: [] }
  }
  const notify = state.started ? changedEntityTypes(outcome.events) : []
  return {
    // Keep the old cursor if the server sent none, so nothing is replayed or skipped.
    cursor: outcome.cursor ?? state.cursor,
    delay: outcome.hasMore ? CHANGES_MORE_MS : CHANGES_LIVE_MS,
    started: true,
    mode: 'live',
    notify,
  }
}

/** Does a change of `changed` concern a listener of `wanted` ('*' = everything)? */
export function concerns(changed: readonly string[], wanted: readonly CopEntityType[] | '*'): boolean {
  if (changed.length === 0) return false
  if (wanted === '*') return true
  return changed.some(t => (wanted as readonly string[]).includes(t))
}
