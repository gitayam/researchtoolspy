import type { TimelineWorkspaceEvent } from '../types/timeline-workspace'
import { calendarLabelBounds, temporalClaimBounds } from './timeline-temporal'

export interface TimelineTimingReviewRow {
  eventId: string
  anchorEventId: string
  relation: 'before' | 'after'
  status: 'consistent' | 'conflict' | 'unresolved'
  reason: 'ordered' | 'reversed' | 'overlap' | 'missing-date' | 'invalid-date' | 'missing-anchor'
}

function recordedBounds(event: TimelineWorkspaceEvent): ReturnType<typeof calendarLabelBounds> {
  const start = { date: event.eventDate === undefined ? '' : event.eventDate, ...(event.datePrecision !== undefined ? { precision: event.datePrecision } : {}), ...(event.eventTime !== undefined ? { time: event.eventTime } : {}) }
  if (event.recordedEnd === undefined) return calendarLabelBounds(start)
  const bounds = temporalClaimBounds({ schema: 'timeline-calendar-claim.v1', kind: 'interval', displayText: '', start, end: event.recordedEnd })
  return 'reason' in bounds ? { reason: 'invalid-date' } : bounds
}

/** Review recorded placement consistency only; never infer evidence or timing. */
export function reviewTimelineTiming(events: readonly TimelineWorkspaceEvent[]): TimelineTimingReviewRow[] {
  const byId = new Map<string, TimelineWorkspaceEvent[]>()
  for (const event of events) {
    const matches = byId.get(event.id)
    if (matches) matches.push(event)
    else byId.set(event.id, [event])
  }
  const rows: TimelineTimingReviewRow[] = []
  for (const event of events) {
    if (event.placement?.mode !== 'relative') continue
    const { anchorEventId, relation } = event.placement
    const row: TimelineTimingReviewRow = { eventId: event.id, anchorEventId, relation, status: 'unresolved', reason: 'missing-anchor' }
    const anchors = byId.get(anchorEventId)
    if (anchorEventId !== event.id && byId.get(event.id)?.length === 1 && anchors?.length === 1) {
      const a = recordedBounds(event)
      const b = recordedBounds(anchors[0])
      if ('reason' in a) row.reason = a.reason
      else if ('reason' in b) row.reason = b.reason
      else {
        const ordered = relation === 'before' ? a.end <= b.start : a.start >= b.end
        const reversed = relation === 'before' ? a.start >= b.end : a.end <= b.start
        row.status = ordered ? 'consistent' : reversed ? 'conflict' : 'unresolved'
        row.reason = ordered ? 'ordered' : reversed ? 'reversed' : 'overlap'
      }
    }
    rows.push(row)
  }
  return rows
}
