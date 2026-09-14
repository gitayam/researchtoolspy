import { expect, test } from '@playwright/test'
import { reviewTimelineTiming } from '../../../src/lib/timeline-timing'
import type { TimelineWorkspaceEvent } from '../../../src/types/timeline-workspace'

function event(id: string, eventDate?: string, extra: Partial<TimelineWorkspaceEvent> = {}): TimelineWorkspaceEvent {
  return { id, eventDate, title: id, description: null, category: 'event', importance: 'normal', origin: 'analyst', assessment: 'unreviewed', analystNote: '', modified: false, ...extra }
}
function pair(date: string | undefined, anchorDate: string | undefined, relation: 'before' | 'after' = 'before', extra: Partial<TimelineWorkspaceEvent> = {}, anchorExtra: Partial<TimelineWorkspaceEvent> = {}) {
  return reviewTimelineTiming([
    event('subject', date, { placement: { mode: 'relative', relation, anchorEventId: 'anchor' }, ...extra }),
    event('anchor', anchorDate, anchorExtra),
  ])[0]
}

test.describe('recorded timeline placement review @smoke', () => {
  test('distinguishes definite before/after from reversals and equal-day uncertainty', () => {
    expect(pair('2026-09-13', '2026-09-14')).toEqual({ eventId: 'subject', anchorEventId: 'anchor', relation: 'before', status: 'consistent', reason: 'ordered' })
    expect(pair('2026-09-15', '2026-09-14')).toMatchObject({ status: 'conflict', reason: 'reversed' })
    expect(pair('2026-09-15', '2026-09-14', 'after')).toMatchObject({ status: 'consistent', reason: 'ordered' })
    expect(pair('2026-09-13', '2026-09-14', 'after')).toMatchObject({ status: 'conflict', reason: 'reversed' })
    for (const relation of ['before', 'after'] as const) expect(pair('2026-09-14', '2026-09-14', relation)).toMatchObject({ status: 'unresolved', reason: 'overlap' })
  })

  test('retains year/month ranges and only orders disjoint half-open ranges', () => {
    expect(pair('2025', '2026')).toMatchObject({ status: 'consistent' })
    expect(pair('2026-02', '2026-03')).toMatchObject({ status: 'consistent' })
    expect(pair('2026', '2026-03')).toMatchObject({ status: 'unresolved', reason: 'overlap' })
    expect(pair('2026-03-15', '2026-03', 'after')).toMatchObject({ status: 'unresolved', reason: 'overlap' })
    expect(pair('2026-04', '2026-03', 'after')).toMatchObject({ status: 'consistent' })
    expect(pair('2027', '2026-12')).toMatchObject({ status: 'conflict' })
  })

  test('uses minute/second intervals, preserving overlap and clock boundary adjacency', () => {
    expect(pair('2026-09-14', '2026-09-14', 'before', { eventTime: '10:00' }, { eventTime: '10:01' })).toMatchObject({ status: 'consistent' })
    expect(pair('2026-09-14', '2026-09-14', 'before', { eventTime: '10:00' }, { eventTime: '10:00:59' })).toMatchObject({ status: 'unresolved', reason: 'overlap' })
    expect(pair('2026-09-14', '2026-09-14', 'after', { eventTime: '10:00:01' }, { eventTime: '10:00:00' })).toMatchObject({ status: 'consistent' })
    expect(pair('2026-09-14', '2026-09-15', 'before', { eventTime: '23:59:59' }, { eventTime: '00:00:00' })).toMatchObject({ status: 'consistent' })
    expect(pair('2026-09-14', '2026-09-14', 'after', { eventTime: '00:00' })).toMatchObject({ status: 'unresolved', reason: 'overlap' })
  })

  test('validates proleptic Gregorian limits and leap centuries without the year-1900 offset', () => {
    expect(pair('0001-12-31', '0002-01-01')).toMatchObject({ status: 'consistent' })
    expect(pair('0099', '0100')).toMatchObject({ status: 'consistent' })
    expect(pair('2000-02-29', '2000-03-01')).toMatchObject({ status: 'consistent' })
    expect(pair('9999-12-31', '9999-12', 'after')).toMatchObject({ status: 'unresolved', reason: 'overlap' })
    expect(pair('9999', '9998', 'after')).toMatchObject({ status: 'consistent' })
    for (const invalid of ['0000', '10000', '1900-02-29', '2026-02-29', '2026-04-31', '2026-13', '2026-00-01']) expect(pair(invalid, '2026')).toMatchObject({ status: 'unresolved', reason: 'invalid-date' })
  })

  test('fails unresolved for missing, malformed, mismatched or partial-date clock inputs', () => {
    expect(pair(undefined, '2026')).toMatchObject({ status: 'unresolved', reason: 'missing-date' })
    expect(pair('2026', undefined)).toMatchObject({ status: 'unresolved', reason: 'missing-date' })
    for (const invalid of ['2026-1', '2026-01-01Z', ' 2026', 'not a date']) expect(pair(invalid, '2027')).toMatchObject({ status: 'unresolved', reason: 'invalid-date' })
    expect(pair('2026-01-01', '2027', 'before', { datePrecision: 'month' })).toMatchObject({ status: 'unresolved', reason: 'invalid-date' })
    expect(pair('2026', '2027', 'before', {}, { eventTime: '10:00' })).toMatchObject({ status: 'unresolved', reason: 'invalid-date' })
    expect(pair('2026-01', '2027', 'before', { eventTime: '10:00' })).toMatchObject({ status: 'unresolved', reason: 'invalid-date' })
    for (const invalid of ['24:00', '12:60', '12:00:60', '1:00', '12:00Z']) expect(pair('2026-01-01', '2027', 'before', { eventTime: invalid })).toMatchObject({ status: 'unresolved', reason: 'invalid-date' })
  })

  test('does not guess missing, self, duplicate-anchor or duplicate-subject identities', () => {
    const relative = event('subject', '2026', { placement: { mode: 'relative', relation: 'before', anchorEventId: 'anchor' } })
    const anchor = event('anchor', '2027')
    for (const events of [[relative], [relative, anchor, { ...anchor }], [relative, { ...relative }, anchor], [event('self', '2026', { placement: { mode: 'relative', relation: 'after', anchorEventId: 'self' } })]]) {
      const rows = reviewTimelineTiming(events)
      expect(rows.length).toBeGreaterThan(0)
      expect(rows.every(row => row.status === 'unresolved' && row.reason === 'missing-anchor')).toBe(true)
    }
  })

  test('preserves supplied relative order and frozen input, ignoring position and narrative order', () => {
    const events = [
      event('later', '2028', { narrativeOrder: 0, narrativeIncluded: false, placement: { mode: 'relative', relation: 'after', anchorEventId: 'anchor' } }),
      event('position', '2025', { placement: { mode: 'position', position: 1 } }),
      event('anchor', '2027', { placement: { mode: 'absolute' } }),
      event('earlier', '2026', { narrativeOrder: 99, sequenceOrder: 0, placement: { mode: 'relative', relation: 'before', anchorEventId: 'anchor' } }),
    ]
    const bytes = JSON.stringify(events)
    for (const item of events) { Object.freeze(item.placement); Object.freeze(item) }
    Object.freeze(events)
    const rows = reviewTimelineTiming(events)
    expect(rows.map(row => row.eventId)).toEqual(['later', 'earlier'])
    expect(rows.every(row => row.status === 'consistent')).toBe(true)
    rows[0].status = 'conflict'
    expect(JSON.stringify(events)).toBe(bytes)
    expect(reviewTimelineTiming([])).toEqual([])
  })
})
