export interface CalendarLabel {
  date: string
  precision?: 'year' | 'month' | 'day'
  time?: string
}

type ClaimBase = { schema: 'timeline-calendar-claim.v1'; displayText: string }
export type CalendarTemporalClaim = ClaimBase & (
  | { kind: 'date'; value: CalendarLabel }
  | { kind: 'interval'; start: CalendarLabel; end: CalendarLabel }
  | { kind: 'relative'; relation: 'before' | 'after'; anchorEventId: string }
  | { kind: 'unknown' }
)
export type CalendarBounds = { start: number; end: number }
export type CalendarClaimParseResult = { ok: true; claim: CalendarTemporalClaim }
  | { ok: false; reason: 'invalid-claim' | 'invalid-date' | 'invalid-interval' }

// Numeric calendar coordinates only: these setters do not imply UTC instants
// or resolve a recorded local clock. They also preserve years 0001–0099.
function calendarNumber(year: number, month: number, day: number): number {
  const value = new Date(0)
  value.setUTCFullYear(year, month - 1, day)
  return value.getTime()
}

/** Legacy timing bounds retain absent/empty date and clock behavior. */
export function calendarLabelBounds(label: CalendarLabel): CalendarBounds | { reason: 'missing-date' | 'invalid-date' } {
  if (label === null || typeof label !== 'object' || Array.isArray(label)) return { reason: 'invalid-date' }
  const date = label.date
  if (date === undefined || date === '') return { reason: 'missing-date' }
  if (typeof date !== 'string' || !/^\d{4}(?:-\d{2}(?:-\d{2})?)?$/.test(date)) return { reason: 'invalid-date' }
  const parts = date.split('-').map(Number)
  const [year, month = 1, day = 1] = parts
  const precision = parts.length === 1 ? 'year' : parts.length === 2 ? 'month' : 'day'
  if (label.precision !== undefined && label.precision !== precision) return { reason: 'invalid-date' }
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  if (year < 1 || year > 9999 || month < 1 || month > 12 || day < 1 || day > days[month - 1]) return { reason: 'invalid-date' }
  let start = calendarNumber(year, month, day)
  if (label.time !== undefined && label.time !== '') {
    if (precision !== 'day' || typeof label.time !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(label.time)) return { reason: 'invalid-date' }
    const clock = label.time.split(':').map(Number)
    start += ((clock[0] * 60 + clock[1]) * 60 + (clock[2] || 0)) * 1000
    return { start, end: start + (clock.length === 3 ? 1000 : 60_000) }
  }
  // Year 10000 is permitted only as the exclusive end of a valid 9999 unit.
  const end = precision === 'year' ? calendarNumber(year + 1, 1, 1)
    : precision === 'month' ? calendarNumber(year, month + 1, 1)
      : calendarNumber(year, month, day + 1)
  return { start, end }
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
}
function hasOnlyKeys(value: Record<string, unknown>, allowed: string[]): boolean {
  return Reflect.ownKeys(value).every(key => typeof key === 'string' && allowed.includes(key))
}

function parseLabel(value: unknown): { ok: true; label: CalendarLabel; bounds: CalendarBounds } | { ok: false; reason: 'invalid-claim' | 'invalid-date' } {
  if (!record(value) || !hasOnlyKeys(value, ['date', 'precision', 'time']) || typeof value.date !== 'string') return { ok: false, reason: 'invalid-claim' }
  if (Object.hasOwn(value, 'precision') && (typeof value.precision !== 'string' || !['year', 'month', 'day'].includes(value.precision))) return { ok: false, reason: 'invalid-claim' }
  if (Object.hasOwn(value, 'time') && typeof value.time !== 'string') return { ok: false, reason: 'invalid-claim' }
  const label: CalendarLabel = {
    date: value.date,
    ...(Object.hasOwn(value, 'precision') ? { precision: value.precision as CalendarLabel['precision'] } : {}),
    ...(Object.hasOwn(value, 'time') ? { time: value.time as string } : {}),
  }
  const bounds = calendarLabelBounds(label)
  // Strict claims have no empty clock placeholder; the legacy bounds helper
  // accepts it so existing timing review integration does not change behavior.
  if ('reason' in bounds || label.time === '') return { ok: false, reason: 'invalid-date' }
  return { ok: true, label, bounds }
}

/** Parse a strict internal calendar claim without normalizing recorded labels. */
export function parseCalendarTemporalClaim(value: unknown): CalendarClaimParseResult {
  if (!record(value) || value.schema !== 'timeline-calendar-claim.v1' || typeof value.displayText !== 'string' || value.displayText.length > 4096) return { ok: false, reason: 'invalid-claim' }
  const base: ClaimBase = { schema: 'timeline-calendar-claim.v1', displayText: value.displayText }
  if (value.kind === 'unknown') {
    if (!hasOnlyKeys(value, ['schema', 'displayText', 'kind'])) return { ok: false, reason: 'invalid-claim' }
    return { ok: true, claim: { ...base, kind: 'unknown' } }
  }
  if (value.kind === 'relative') {
    if (!hasOnlyKeys(value, ['schema', 'displayText', 'kind', 'relation', 'anchorEventId']) || (value.relation !== 'before' && value.relation !== 'after') || typeof value.anchorEventId !== 'string' || !value.anchorEventId.trim()) return { ok: false, reason: 'invalid-claim' }
    return { ok: true, claim: { ...base, kind: 'relative', relation: value.relation, anchorEventId: value.anchorEventId } }
  }
  if (value.kind === 'date') {
    if (!hasOnlyKeys(value, ['schema', 'displayText', 'kind', 'value'])) return { ok: false, reason: 'invalid-claim' }
    const parsed = parseLabel(value.value)
    if (parsed.ok === false) return parsed
    return { ok: true, claim: { ...base, kind: 'date', value: parsed.label } }
  }
  if (value.kind === 'interval') {
    if (!hasOnlyKeys(value, ['schema', 'displayText', 'kind', 'start', 'end'])) return { ok: false, reason: 'invalid-claim' }
    const start = parseLabel(value.start)
    if (start.ok === false) return start
    const end = parseLabel(value.end)
    if (end.ok === false) return end
    if (start.bounds.start >= end.bounds.end) return { ok: false, reason: 'invalid-interval' }
    return { ok: true, claim: { ...base, kind: 'interval', start: start.label, end: end.label } }
  }
  return { ok: false, reason: 'invalid-claim' }
}

/** Inclusive endpoint units yield a conservative extent, never a duration. */
export function temporalClaimBounds(claim: CalendarTemporalClaim): CalendarBounds | { reason: 'relative' | 'unknown' | 'invalid-date' | 'invalid-interval' | 'invalid-claim' } {
  const parsed = parseCalendarTemporalClaim(claim)
  if (parsed.ok === false) return { reason: parsed.reason }
  const valid = parsed.claim
  if (valid.kind === 'unknown' || valid.kind === 'relative') return { reason: valid.kind }
  if (valid.kind === 'date') {
    const bounds = calendarLabelBounds(valid.value)
    return 'reason' in bounds ? { reason: 'invalid-date' } : bounds
  }
  const start = calendarLabelBounds(valid.start)
  const end = calendarLabelBounds(valid.end)
  if ('reason' in start || 'reason' in end) return { reason: 'invalid-date' }
  return { start: Math.min(start.start, end.start), end: Math.max(start.end, end.end) }
}
