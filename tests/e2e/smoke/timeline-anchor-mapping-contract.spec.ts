import { test, expect } from '@playwright/test'
import {
  describeMappedWindow,
  projectMappedStep,
  resolveAnchorMapping,
  type TimelineAnchor,
} from '../../../src/lib/timeline-anchor-mapping'

const anchor = (eventId: string, date: string, extra: Partial<TimelineAnchor> = {}): TimelineAnchor => ({
  eventId, label: { date }, childOffsetMinutes: 0, ...extra,
})

test.describe('Timeline anchor mapping contracts @smoke', () => {
  test('an unmapped sequence stays on its own axis rather than being placed', () => {
    const result = resolveAnchorMapping([])
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toContain('T± axis')
  })

  test('one anchor places a sequence at the anchor’s own precision, not finer', () => {
    const dayResult = resolveAnchorMapping([anchor('landing', '2026-09-14', { label: { date: '2026-09-14', precision: 'day' } })])
    expect(dayResult.ok).toBe(true)
    if (!dayResult.ok) return
    expect(dayResult.t0.precision).toBe('day')
    expect(describeMappedWindow(dayResult.t0)).toBe('2026-09-14')

    // A year-precision anchor constrains the sequence to that year and no further.
    const yearResult = resolveAnchorMapping([anchor('invasion', '1979')])
    expect(yearResult.ok).toBe(true)
    if (!yearResult.ok) return
    expect(yearResult.t0.precision).toBe('year')
    expect(describeMappedWindow(yearResult.t0)).toBe('1979')
    // The window really is a year wide: a point instant would be manufactured precision.
    expect(yearResult.t0.end).toBeGreaterThan(yearResult.t0.start)
  })

  test('an offset anchor shifts the start it implies', () => {
    // The host record is 30 minutes into the sequence, so T0 is 30 minutes earlier.
    const result = resolveAnchorMapping([
      anchor('rollback', '2026-09-14', { label: { date: '2026-09-14', precision: 'day', time: '12:30:00' }, childOffsetMinutes: 30 }),
    ])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(describeMappedWindow(result.t0)).toBe('2026-09-14 12:00:00')
    expect(describeMappedWindow(projectMappedStep(result.t0, 90))).toBe('2026-09-14 13:30:00')
  })

  test('disagreeing anchors are a conflict, never a stretched sequence', () => {
    const result = resolveAnchorMapping([
      anchor('first', '2026-09-14', { label: { date: '2026-09-14', precision: 'day' } }),
      anchor('second', '2026-09-20', { label: { date: '2026-09-20', precision: 'day' } }),
    ])
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.conflict?.eventIds).toEqual(['first', 'second'])
    expect(result.reason).toContain('not stretched')
  })

  test('agreeing anchors narrow the window without refining what either said', () => {
    // A day inside a year: the finer anchor narrows the range, but the mapping still
    // reports the coarsest precision any constraint actually carried.
    const result = resolveAnchorMapping([
      anchor('era', '1979'),
      anchor('report', '1979-04-02', { label: { date: '1979-04-02', precision: 'day' } }),
    ])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.t0.precision).toBe('year')
    expect(result.constrainedBy).toEqual(['era', 'report'])
    expect(describeMappedWindow(result.t0)).toBe('1979')
  })

  test('an approximate anchor keeps every step it places approximate', () => {
    const result = resolveAnchorMapping([anchor('circa-start', '1979', { approximate: true })])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.t0.approximate).toBe(true)
    expect(describeMappedWindow(result.t0)).toBe('circa 1979')

    const step = projectMappedStep(result.t0, 60 * 24)
    expect(step.approximate).toBe(true)
    expect(describeMappedWindow(step)).toContain('circa')
  })

  test('an anchor without a usable date does not produce a guessed mapping', () => {
    for (const label of [{ date: '' }, { date: 'not-a-date' }]) {
      const result = resolveAnchorMapping([{ eventId: 'broken', label, childOffsetMinutes: 0 }])
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.reason).toContain('not guessed')
    }
  })
})
