import { expect, test } from '@playwright/test'
import { calendarLabelBounds, parseCalendarTemporalClaim, temporalClaimBounds, type CalendarLabel, type CalendarTemporalClaim } from '../../../src/lib/timeline-temporal'
import { reviewTimelineTiming } from '../../../src/lib/timeline-timing'
import type { TimelineWorkspaceEvent } from '../../../src/types/timeline-workspace'

const schema = 'timeline-calendar-claim.v1' as const
const day = 86_400_000
function bounds(label: CalendarLabel) {
  const result = calendarLabelBounds(label)
  expect(result).not.toHaveProperty('reason')
  if ('reason' in result) throw new Error(`Unexpected bounds failure: ${result.reason}`)
  return result
}
function interval(start: CalendarLabel, end: CalendarLabel): CalendarTemporalClaim {
  return { schema, kind: 'interval', displayText: 'Recorded range, not a duration estimate.', start, end }
}

test.describe('Calendar temporal core @smoke', () => {
  test('strict claim parsing preserves display text and explicitly supplied precision', () => {
    const claims: CalendarTemporalClaim[] = [
      { schema, kind: 'date', displayText: '  Source says “September”\nwithout a day.  ', value: { date: '2026-09' } },
      { schema, kind: 'date', displayText: '<b>Exact wording</b>', value: { date: '2026-09-14', precision: 'day', time: '11:12:13' } },
      interval({ date: '2026', precision: 'year' }, { date: '2027-02', precision: 'month' }),
      { schema, kind: 'relative', displayText: 'Before opening', relation: 'before', anchorEventId: 'opening:1' },
      { schema, kind: 'unknown', displayText: '' },
    ]
    for (const claim of claims) expect(parseCalendarTemporalClaim(claim)).toEqual({ ok: true, claim })
    const parsed = parseCalendarTemporalClaim(claims[0])
    expect(parsed.ok && parsed.claim.kind === 'date' && Object.prototype.hasOwnProperty.call(parsed.claim.value, 'precision')).toBe(false)
    expect(parseCalendarTemporalClaim({ schema, kind: 'unknown', displayText: 'x'.repeat(4096) }).ok).toBe(true)
    for (const bad of [null, [], 'date', {}, { ...claims[0], extra: true }, { ...claims[0], schema: 'other' }, { ...claims[0], displayText: 4 }, { ...claims[0], displayText: 'x'.repeat(4097) }, { schema, kind: 'unknown', displayText: '', value: { date: '2026' } }, { schema, kind: 'relative', displayText: '', relation: 'during', anchorEventId: 'a' }, { schema, kind: 'relative', displayText: '', relation: 'after', anchorEventId: '' }]) {
      expect(parseCalendarTemporalClaim(bad)).toEqual({ ok: false, reason: 'invalid-claim' })
      expect(temporalClaimBounds(bad as CalendarTemporalClaim)).toHaveProperty('reason')
    }
    expect(parseCalendarTemporalClaim({ ...claims[0], value: { date: '2026-09', timezone: 'UTC' } }).ok).toBe(false)
  })

  test('Gregorian bounds preserve leap centuries, low years and the last exclusive boundary', () => {
    expect(bounds({ date: '2000-02' }).end - bounds({ date: '2000-02' }).start).toBe(29 * day)
    expect(bounds({ date: '1900-02' }).end - bounds({ date: '1900-02' }).start).toBe(28 * day)
    expect(bounds({ date: '2028' }).end - bounds({ date: '2028' }).start).toBe(366 * day)
    expect(bounds({ date: '0001' }).end - bounds({ date: '0001' }).start).toBe(365 * day)
    expect(bounds({ date: '0099' }).end).toBe(bounds({ date: '0100' }).start)
    expect(bounds({ date: '2000-02-29' }).end).toBe(bounds({ date: '2000-03-01' }).start)
    const last = bounds({ date: '9999-12-31', time: '23:59:59' })
    expect(last.end - last.start).toBe(1000)
    expect(last.end).toBe(bounds({ date: '9999' }).end)
    expect(Number.isFinite(last.end)).toBe(true)
    for (const date of ['0000', '10000', '1900-02-29', '2026-02-29', '2026-04-31', '2026-00', '2026-13', '2026-1', ' 2026', '2026-09-14Z']) {
      expect(calendarLabelBounds({ date })).toEqual({ reason: 'invalid-date' })
      expect(parseCalendarTemporalClaim({ schema, kind: 'date', displayText: date, value: { date } })).toEqual({ ok: false, reason: 'invalid-date' })
    }
    expect(calendarLabelBounds({ date: '' })).toEqual({ reason: 'missing-date' })
    expect(calendarLabelBounds({ date: undefined } as unknown as CalendarLabel)).toEqual({ reason: 'missing-date' })
  })

  test('day minute and second ranges retain precision without timezone or clock fabrication', () => {
    const whole = bounds({ date: '2026-03-08', precision: 'day' })
    const minute = bounds({ date: '2026-03-08', time: '01:59' })
    const second = bounds({ date: '2026-03-08', time: '01:59:59' })
    expect(whole.end - whole.start).toBe(day)
    expect(minute.end - minute.start).toBe(60_000)
    expect(second.end - second.start).toBe(1000)
    expect(minute.start - whole.start).toBe(119 * 60_000)
    expect(second.end).toBe(minute.end)
    expect(calendarLabelBounds({ date: '2026-03-08', time: '' })).toEqual(whole)
    expect(parseCalendarTemporalClaim({ schema, kind: 'date', displayText: '', value: { date: '2026-03-08', time: '' } }).ok).toBe(false)
    expect(minute.end).toBe(bounds({ date: '2026-03-08', time: '02:00' }).start)
    for (const label of [{ date: '2026', time: '10:00' }, { date: '2026-09', time: '10:00' }, { date: '2026-09-14', precision: 'month' }, ...['24:00', '12:60', '12:00:60', '1:00', '12:00Z'].map(time => ({ date: '2026-09-14', time }))]) {
      expect(calendarLabelBounds(label as CalendarLabel)).toEqual({ reason: 'invalid-date' })
    }
  })

  test('intervals include complete end units and preserve uncertain overlapping endpoint ranges', () => {
    for (const [start, end, days] of [
      ['2028-02-28', '2028-03-01', 3], ['2026-09-14', '2026-09-14', 1], ['2026-01', '2026-02', 59],
    ] as const) {
      expect(temporalClaimBounds(interval({ date: start }, { date: end }))).toEqual({ start: bounds({ date: start }).start, end: bounds({ date: end }).end })
      expect(bounds({ date: end }).end - bounds({ date: start }).start).toBe(days * day)
    }
    for (const [start, end] of [['2026-09-14', '2026'], ['2026', '2026-09-14'], ['2026-09-14', '2026-09']] as const) {
      const a = bounds({ date: start }), b = bounds({ date: end })
      expect(temporalClaimBounds(interval({ date: start }, { date: end }))).toEqual({ start: Math.min(a.start, b.start), end: Math.max(a.end, b.end) })
    }
    const clockRange = interval({ date: '2026-09-14', time: '10:00:59' }, { date: '2026-09-14', time: '10:00' })
    expect(temporalClaimBounds(clockRange)).toEqual(bounds({ date: '2026-09-14', time: '10:00' }))
  })

  test('definitely reversed and malformed intervals fail closed at parser and runtime boundaries', () => {
    for (const claim of [interval({ date: '2027' }, { date: '2026' }), interval({ date: '2026-09-15' }, { date: '2026-09-14' }), interval({ date: '2026-09-14', time: '10:01' }, { date: '2026-09-14', time: '10:00' })]) {
      expect(parseCalendarTemporalClaim(claim)).toEqual({ ok: false, reason: 'invalid-interval' })
      expect(temporalClaimBounds(claim)).toEqual({ reason: 'invalid-interval' })
    }
    for (const claim of [interval({ date: '2026-02-31' }, { date: '2027' }), { schema, kind: 'interval', displayText: '', start: { date: '2026' } }, { ...interval({ date: '2026' }, { date: '2027' }), end: null }]) {
      expect(parseCalendarTemporalClaim(claim).ok).toBe(false)
      expect(temporalClaimBounds(claim as CalendarTemporalClaim)).toHaveProperty('reason')
    }
  })

  test('relative and unknown claims never resolve and frozen inputs remain byte unchanged', () => {
    const claims: CalendarTemporalClaim[] = [
      { schema, kind: 'relative', displayText: '  After the opening?  ', relation: 'after', anchorEventId: 'opening' },
      { schema, kind: 'unknown', displayText: 'No date reported' },
      interval({ date: '2026-09', precision: 'month' }, { date: '2026', precision: 'year' }),
    ]
    const original = JSON.stringify(claims)
    for (const claim of claims) {
      if (claim.kind === 'interval') { Object.freeze(claim.start); Object.freeze(claim.end) }
      Object.freeze(claim)
      expect(parseCalendarTemporalClaim(claim)).toEqual({ ok: true, claim })
      temporalClaimBounds(claim)
    }
    expect(temporalClaimBounds(claims[0])).toEqual({ reason: 'relative' })
    expect(temporalClaimBounds(claims[1])).toEqual({ reason: 'unknown' })
    expect(JSON.stringify(claims)).toBe(original)
  })

  test('existing timing review still reports overlap, reversal and missing dates in supplied order', () => {
    const make = (id: string, date: string | undefined, anchor = false): TimelineWorkspaceEvent => ({ id, title: id, description: null, category: 'event', importance: 'normal', origin: 'analyst', assessment: 'unreviewed', analystNote: '', modified: false, eventDate: date, placement: anchor ? { mode: 'absolute' } : { mode: 'relative', relation: 'before', anchorEventId: 'anchor' } })
    const events = [make('reversed', '2027'), make('overlap', '2026-09'), make('missing', undefined), make('ordered', '2025'), make('anchor', '2026-09-14', true)]
    const original = JSON.stringify(events)
    events.forEach(event => { Object.freeze(event.placement); Object.freeze(event) }); Object.freeze(events)
    expect(reviewTimelineTiming(events).map(row => [row.eventId, row.status, row.reason])).toEqual([
      ['reversed', 'conflict', 'reversed'], ['overlap', 'unresolved', 'overlap'], ['missing', 'unresolved', 'missing-date'], ['ordered', 'consistent', 'ordered'],
    ])
    expect(JSON.stringify(events)).toBe(original)
  })
})
