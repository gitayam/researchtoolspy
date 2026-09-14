import type { TimelineWorkspaceEvent } from '../types/timeline-workspace'
import { calendarLabelBounds } from './timeline-temporal'

export interface TimelineTimingReviewRow {
  eventId: string
  anchorEventId: string
  relation: 'before' | 'after'
  status: 'consistent' | 'conflict' | 'unresolved'
  reason: 'ordered' | 'reversed' | 'overlap' | 'missing-date' | 'invalid-date' | 'missing-anchor'
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
      const a = calendarLabelBounds({ date: event.eventDate === undefined ? '' : event.eventDate, precision: event.datePrecision, time: event.eventTime })
      const b = calendarLabelBounds({ date: anchors[0].eventDate === undefined ? '' : anchors[0].eventDate, precision: anchors[0].datePrecision, time: anchors[0].eventTime })
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
