import { expect, test } from '@playwright/test'
import { reviewTimelineOverlaps } from '../../../src/lib/timeline-overlap'
import type { TimelineWorkspaceEvent } from '../../../src/types/timeline-workspace'

function event(id: string, eventDate?: string, extra: Partial<TimelineWorkspaceEvent> = {}): TimelineWorkspaceEvent {
  return { id, eventDate, title: id, description: null, category: 'event', importance: 'normal', origin: 'analyst', assessment: 'unreviewed', analystNote: '', modified: false, ...extra }
}
function pair(a: TimelineWorkspaceEvent, b: TimelineWorkspaceEvent) {
  return reviewTimelineOverlaps([a, b], a.id).rows[0]
}

test.describe('conservative recorded overlap review @smoke', () => {
  test('retains year/month/day uncertainty and never claims definite concurrency', () => {
    const anchor = event('anchor', '2026-09')
    const result = reviewTimelineOverlaps([
      anchor, event('day', '2026-09-14'), event('year', '2026'), event('same-month', '2026-09'),
      event('before', '2026-08'), event('after', '2026-10'),
    ], anchor.id)
    expect(result).toEqual({ anchorStatus: 'ready', rows: [
      { eventId: 'day', status: 'possible', reason: 'overlap' },
      { eventId: 'year', status: 'possible', reason: 'overlap' },
      { eventId: 'same-month', status: 'possible', reason: 'overlap' },
      { eventId: 'before', status: 'disjoint', reason: 'separate' },
      { eventId: 'after', status: 'disjoint', reason: 'separate' },
    ] })
    expect(pair(event('a', '2026-09-14'), event('b', '2026-09-14')).status).toBe('possible')
  })

  test('keeps minute/second precision and adjacent units separate in either direction', () => {
    const minute = event('a', '2026-09-14', { eventTime: '10:00' })
    expect(pair(minute, event('b', '2026-09-14', { eventTime: '10:00:59' })).status).toBe('possible')
    expect(pair(minute, event('b', '2026-09-14', { eventTime: '10:01:00' })).status).toBe('disjoint')
    for (const [a, b] of [
      [event('a', '2026-09-14'), event('b', '2026-09-15')],
      [event('a', '2026-09-14', { eventTime: '23:59:59' }), event('b', '2026-09-15', { eventTime: '00:00:00' })],
      [event('a', '2026-09-14', { eventTime: '10:00:00' }), event('b', '2026-09-14', { eventTime: '10:00:01' })],
    ]) {
      expect(pair(a, b).status).toBe('disjoint')
      expect(pair(b, a).status).toBe('disjoint')
    }
  })

  test('includes recorded interval endpoint units without treating outer extent as duration', () => {
    const range = event('range', '2026-09-10', { recordedEnd: { date: '2026-09-12', time: '17:30:59' } })
    expect(pair(range, event('end', '2026-09-12', { eventTime: '17:30:59' })).status).toBe('possible')
    expect(pair(range, event('after', '2026-09-12', { eventTime: '17:31:00' })).status).toBe('disjoint')
    expect(pair(range, event('nested', '2026-09-11', { recordedEnd: { date: '2026-09-12' } })).status).toBe('possible')
    const broad = event('broad', '2026', { recordedEnd: { date: '2026-09' } })
    expect(pair(broad, event('late', '2026-12-31')).status).toBe('possible')
    expect(pair(event('same', '2026-09-14', { recordedEnd: { date: '2026-09-14' } }), event('day', '2026-09-14')).status).toBe('possible')
    expect(pair(event('months', '2026-09', { recordedEnd: { date: '2026-10' } }), event('november', '2026-11')).status).toBe('disjoint')
  })

  test('uses Gregorian leap boundaries and the exclusive end after year 9999', () => {
    expect(pair(event('feb', '2000-02'), event('leap', '2000-02-29')).status).toBe('possible')
    expect(pair(event('year', '9999'), event('last', '9999-12-31', { eventTime: '23:59:59' })).status).toBe('possible')
    expect(pair(event('early', '0099'), event('next', '0100')).status).toBe('disjoint')
    expect(pair(event('first', '0001'), event('day', '0001-01-01')).status).toBe('possible')
    for (const bad of ['0000', '10000', '1900-02-29', '2026-04-31']) {
      expect(pair(event('anchor', '2026'), event('bad', bad))).toMatchObject({ status: 'unresolved', reason: 'invalid-date' })
    }
  })

  test('returns no rows for missing, ambiguous, undated or malformed anchors', () => {
    const good = event('good', '2026')
    expect(reviewTimelineOverlaps([], 'none')).toEqual({ anchorStatus: 'missing-anchor', rows: [] })
    expect(reviewTimelineOverlaps([good], 'gone')).toEqual({ anchorStatus: 'missing-anchor', rows: [] })
    expect(reviewTimelineOverlaps([event(' ', '2026'), good], ' ')).toEqual({ anchorStatus: 'missing-anchor', rows: [] })
    expect(reviewTimelineOverlaps([good, { ...good }], good.id)).toEqual({ anchorStatus: 'ambiguous-anchor', rows: [] })
    for (const date of [undefined, '']) expect(reviewTimelineOverlaps([event('anchor', date), good], 'anchor')).toEqual({ anchorStatus: 'missing-date', rows: [] })
    for (const bad of [
      event('anchor', 'bad'), event('anchor', '2026-09', { eventTime: '10:00' }),
      event('anchor', '2026-09-14', { recordedEnd: { date: '2026-09-13' } }),
    ]) expect(reviewTimelineOverlaps([bad, good], 'anchor')).toEqual({ anchorStatus: 'invalid-date', rows: [] })
    expect(reviewTimelineOverlaps([good], good.id)).toEqual({ anchorStatus: 'ready', rows: [] })
  })

  test('retains ambiguous candidate rows and refuses invalid precision or intervals', () => {
    const candidates = [event('', '2026'), event(' ', '2026'), event('duplicate', '2026'), event('duplicate', undefined), event('unknown'),
      event('precision', '2026-09-14', { datePrecision: 'month' }), event('clock', '2026-09-14', { eventTime: '24:00' }),
      event('end', '2026-09-14', { recordedEnd: { date: '2026-09-13' } })]
    const rows = reviewTimelineOverlaps([event('anchor', '2026'), ...candidates], 'anchor').rows
    expect(rows.map(row => row.eventId)).toEqual(candidates.map(item => item.id))
    expect(rows.map(row => row.reason)).toEqual(['ambiguous-event', 'ambiguous-event', 'ambiguous-event', 'ambiguous-event', 'missing-date', 'invalid-date', 'invalid-date', 'invalid-date'])
    expect(rows.every(row => row.status === 'unresolved')).toBe(true)
  })

  test('preserves frozen inputs and array order without placement or presentation inference', () => {
    const events = [event('relative', undefined, { placement: { mode: 'relative', relation: 'before', anchorEventId: 'anchor' } }),
      event('anchor', '2026'), event('position', undefined, { placement: { mode: 'position', position: 1 } }),
      event('dated-relative', '2026-09', { placement: { mode: 'relative', relation: 'after', anchorEventId: 'anchor' }, narrativeIncluded: false, narrativeOrder: 99, sequenceOrder: 0 }),
      event('last', '2027', { recordedEnd: { date: '2028' } })]
    const bytes = JSON.stringify(events)
    for (const item of events) { if (item.placement) Object.freeze(item.placement); if (item.recordedEnd) Object.freeze(item.recordedEnd); Object.freeze(item) }
    Object.freeze(events)
    const result = reviewTimelineOverlaps(events, 'anchor')
    expect(result.rows.map(row => [row.eventId, row.status])).toEqual([['relative', 'unresolved'], ['position', 'unresolved'], ['dated-relative', 'possible'], ['last', 'disjoint']])
    result.rows[0].reason = 'overlap'
    expect(JSON.stringify(events)).toBe(bytes)
    expect(reviewTimelineOverlaps(events, 'anchor').rows[0].reason).toBe('missing-date')
  })
})
