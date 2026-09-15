import { test, expect } from '@playwright/test'
import {
  formatBehaviorOffset,
  isBehaviorOffsetError,
  parseBehaviorOffset,
  resolveBehaviorTimelineToInstants,
  reviewBehaviorTimelineTiming,
} from '../../../src/lib/behavior-timeline-time'

const step = (id: string, label: string, time?: string) => ({ id, label, time })

test.describe('Behavior timeline time-domain contracts @smoke', () => {
  test('offsets parse from the behaviour start and round-trip to canonical text', () => {
    const cases: Array<[string, number]> = [
      ['T+0', 0], ['T+30min', 30], ['T+2h', 120], ['T-45min', -45],
      ['T+1d', 1440], ['T+1d 6h', 1800], ['T+1d6h', 1800], ['t + 90 minutes', 90],
    ]
    for (const [text, minutes] of cases) {
      const parsed = parseBehaviorOffset(text)
      expect(isBehaviorOffsetError(parsed), `${text} should parse`).toBe(false)
      expect((parsed as { minutes: number }).minutes, text).toBe(minutes)
    }
    expect(formatBehaviorOffset({ minutes: 0 })).toBe('T+0')
    expect(formatBehaviorOffset({ minutes: 1800 })).toBe('T+1d 6h')
    expect(formatBehaviorOffset({ minutes: -45 })).toBe('T-45min')
  })

  test('an unrecorded offset is not an error, but an unreadable one is', () => {
    expect(parseBehaviorOffset(undefined)).toBeNull()
    expect(parseBehaviorOffset('   ')).toBeNull()
    // These are exactly the values the free-text field used to accept silently.
    for (const bad of ['09:00', 'morning', '30 minutes', 'T+', 'T+30 parsecs', 'soon']) {
      expect(isBehaviorOffsetError(parseBehaviorOffset(bad)), bad).toBe(true)
    }
  })

  test('review reports unreadable and out-of-order offsets without changing them', () => {
    const events = [step('a', 'Prepare', 'T-10min'), step('b', 'Act', 'T+0'), step('c', 'Review', 'T+30min')]
    expect(reviewBehaviorTimelineTiming(events, 'anchor_relative')).toEqual([])

    const regressed = [step('a', 'Prepare', 'T+30min'), step('b', 'Act', 'T+10min')]
    const findings = reviewBehaviorTimelineTiming(regressed, 'anchor_relative')
    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({ eventId: 'b', kind: 'out_of_order' })
    // The review is read-only: the recorded values are untouched.
    expect(regressed.map(item => item.time)).toEqual(['T+30min', 'T+10min'])

    expect(reviewBehaviorTimelineTiming([step('a', 'Act', '09:00')], 'anchor_relative')[0]).toMatchObject({ kind: 'unparsed' })
    // An ordinal timeline records sequence only, so offsets are not reviewed against a clock.
    expect(reviewBehaviorTimelineTiming([step('a', 'Act', '09:00')], 'ordinal')).toEqual([])
  })

  test('a template gets real dates only from an analyst-supplied anchor', () => {
    const events = [step('a', 'Prepare', 'T-30min'), step('b', 'Act', 'T+0'), step('c', 'Unrecorded')]

    expect(resolveBehaviorTimelineToInstants(events, '2026-09-14T12:00:00.000Z', 'ordinal')).toMatchObject({ ok: false })
    expect(resolveBehaviorTimelineToInstants(events, 'not-a-date', 'anchor_relative')).toMatchObject({ ok: false })

    const mapped = resolveBehaviorTimelineToInstants(events, '2026-09-14T12:00:00.000Z', 'anchor_relative')
    expect(mapped.ok).toBe(true)
    if (!mapped.ok) return
    expect(mapped.resolved[0].instant).toBe('2026-09-14T11:30:00.000Z')
    expect(mapped.resolved[1].instant).toBe('2026-09-14T12:00:00.000Z')
    // A step with no offset is reported, never given a guessed time.
    expect(mapped.resolved[2].instant).toBeUndefined()
    expect(mapped.resolved[2].omitted).toBeTruthy()
  })

  test('the same template maps to different clocks without being rewritten', () => {
    const events = [step('a', 'Act', 'T+0'), step('b', 'Follow up', 'T+1d')]
    const first = resolveBehaviorTimelineToInstants(events, '2026-01-01T00:00:00.000Z', 'anchor_relative')
    const second = resolveBehaviorTimelineToInstants(events, '2026-06-15T09:30:00.000Z', 'anchor_relative')
    expect(first.ok && second.ok).toBe(true)
    if (!first.ok || !second.ok) return
    expect(first.resolved[1].instant).toBe('2026-01-02T00:00:00.000Z')
    expect(second.resolved[1].instant).toBe('2026-06-16T09:30:00.000Z')
    // The template itself is reusable: mapping produced a projection, not an edit.
    expect(events.map(item => item.time)).toEqual(['T+0', 'T+1d'])
  })
})
