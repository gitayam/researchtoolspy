import type { TimelineWorkspaceEvent } from '../types/timeline-workspace'

export interface TimelineTimingReviewRow {
  eventId: string
  anchorEventId: string
  relation: 'before' | 'after'
  status: 'consistent' | 'conflict' | 'unresolved'
  reason: 'ordered' | 'reversed' | 'overlap' | 'missing-date' | 'invalid-date' | 'missing-anchor'
}

type Bounds = { start: number; end: number }
type BoundsResult = Bounds | { reason: 'missing-date' | 'invalid-date' }

// UTC setters provide an unambiguous numeric calendar coordinate, not a claim
// that recorded labels are UTC instants. setUTCFullYear preserves years 0001–0099.
function calendarNumber(year: number, month: number, day: number): number {
  const value = new Date(0)
  value.setUTCFullYear(year, month - 1, day)
  return value.getTime()
}

function recordedBounds(event: TimelineWorkspaceEvent): BoundsResult {
  const date = event.eventDate
  if (date === undefined || date === '') return { reason: 'missing-date' }
  if (typeof date !== 'string' || !/^\d{4}(?:-\d{2}(?:-\d{2})?)?$/.test(date)) return { reason: 'invalid-date' }
  const parts = date.split('-').map(Number)
  const [year, month = 1, day = 1] = parts
  const precision = parts.length === 1 ? 'year' : parts.length === 2 ? 'month' : 'day'
  if (event.datePrecision !== undefined && event.datePrecision !== precision) return { reason: 'invalid-date' }
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  if (year < 1 || year > 9999 || month < 1 || month > 12 || day < 1 || day > days[month - 1]) return { reason: 'invalid-date' }
  let start = calendarNumber(year, month, day)
  if (event.eventTime !== undefined && event.eventTime !== '') {
    if (precision !== 'day' || typeof event.eventTime !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(event.eventTime)) return { reason: 'invalid-date' }
    const clock = event.eventTime.split(':').map(Number)
    start += ((clock[0] * 60 + clock[1]) * 60 + (clock[2] || 0)) * 1000
    return { start, end: start + (clock.length === 3 ? 1000 : 60_000) }
  }
  // End coordinates may reach year 10000: it is the exclusive boundary of the
  // final valid recorded year, never an accepted recorded input.
  const end = precision === 'year' ? calendarNumber(year + 1, 1, 1)
    : precision === 'month' ? calendarNumber(year, month + 1, 1)
      : calendarNumber(year, month, day + 1)
  return { start, end }
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
