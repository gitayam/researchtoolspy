import type { TimelineWorkspaceEvent } from '../types/timeline-workspace'
import { recordedBounds } from './timeline-timing'

export interface TimelineOverlapRow {
  eventId: string
  status: 'possible' | 'disjoint' | 'unresolved'
  reason: 'overlap' | 'separate' | 'missing-date' | 'invalid-date' | 'ambiguous-event'
}

export interface TimelineOverlapReview {
  anchorStatus: 'ready' | 'missing-anchor' | 'ambiguous-anchor' | 'missing-date' | 'invalid-date'
  rows: TimelineOverlapRow[]
}

/** Compare conservative recorded calendar windows, never confirmed concurrency. */
export function reviewTimelineOverlaps(
  events: readonly TimelineWorkspaceEvent[],
  anchorEventId: string,
): TimelineOverlapReview {
  const counts = new Map<string, number>()
  for (const event of events) counts.set(event.id, (counts.get(event.id) ?? 0) + 1)
  if (!anchorEventId.trim() || !counts.has(anchorEventId)) return { anchorStatus: 'missing-anchor', rows: [] }
  if (counts.get(anchorEventId) !== 1) return { anchorStatus: 'ambiguous-anchor', rows: [] }
  const anchor = events.find(event => event.id === anchorEventId)!
  const anchorBounds = recordedBounds(anchor)
  if ('reason' in anchorBounds) return { anchorStatus: anchorBounds.reason, rows: [] }

  const rows: TimelineOverlapRow[] = []
  for (const event of events) {
    if (event.id === anchorEventId) continue
    if (!event.id.trim() || counts.get(event.id) !== 1) {
      rows.push({ eventId: event.id, status: 'unresolved', reason: 'ambiguous-event' })
      continue
    }
    const bounds = recordedBounds(event)
    if ('reason' in bounds) {
      rows.push({ eventId: event.id, status: 'unresolved', reason: bounds.reason })
      continue
    }
    // Exclusive upper bounds keep adjacent recorded units separate.
    const intersects = bounds.start < anchorBounds.end && anchorBounds.start < bounds.end
    rows.push({ eventId: event.id, status: intersects ? 'possible' : 'disjoint', reason: intersects ? 'overlap' : 'separate' })
  }
  return { anchorStatus: 'ready', rows }
}
