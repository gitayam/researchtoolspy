import { expect, test } from '@playwright/test'
import {
  normalizeTimelineEventOrder,
  placeTimelineEvent,
  removeTimelineEvent,
  timelineEventTemporalLabel,
} from '../../../src/lib/timeline-workspace'
import type { TimelineWorkspaceEvent } from '../../../src/types/timeline-workspace'

function event(id: string, eventDate?: string, eventTime?: string): TimelineWorkspaceEvent {
  return {
    id,
    ...(eventDate ? { eventDate, datePrecision: 'day' as const } : {}),
    ...(eventTime ? { eventTime } : {}),
    title: id,
    description: null,
    category: 'event',
    importance: 'normal',
    origin: 'analyst',
    assessment: 'unreviewed',
    analystNote: '',
    modified: false,
  }
}

test.describe('timeline workspace ordering @smoke', () => {
  test('@smoke resolves absolute, relative, and numbered placement deterministically', () => {
    const initial = normalizeTimelineEventOrder([
      event('later', '2026-09-10'),
      event('first', '2026-09-01'),
    ])
    expect(initial.map(item => item.id)).toEqual(['first', 'later'])

    const withDated = placeTimelineEvent(initial, event('middle', '2026-09-05'), { mode: 'absolute' })
    expect(withDated.map(item => item.id)).toEqual(['first', 'middle', 'later'])

    const withRelative = placeTimelineEvent(withDated, event('after-first'), {
      mode: 'relative',
      relation: 'after',
      anchorEventId: 'first',
    })
    expect(withRelative.map(item => item.id)).toEqual(['first', 'after-first', 'middle', 'later'])

    const withPosition = placeTimelineEvent(withRelative, event('second-to-last'), {
      mode: 'position',
      position: 4,
    })
    expect(withPosition.map(item => item.id)).toEqual([
      'first',
      'after-first',
      'middle',
      'second-to-last',
      'later',
    ])
    expect(withPosition.map(item => item.sequenceOrder)).toEqual([0, 1, 2, 3, 4])
  })

  test('@smoke preserves relative order after anchor deletion and labels unknown dates honestly', () => {
    const anchored = placeTimelineEvent(
      normalizeTimelineEventOrder([event('anchor', '2026-09-01'), event('later', '2026-09-02')]),
      event('time-only', undefined, '14:30'),
      { mode: 'relative', relation: 'after', anchorEventId: 'anchor' },
    )
    expect(timelineEventTemporalLabel(anchored[1])).toBe('14:30 (date unknown)')

    const remaining = removeTimelineEvent(anchored, 'anchor')
    expect(remaining.map(item => item.id)).toEqual(['time-only', 'later'])
    expect(remaining[0].placement).toEqual({ mode: 'position', position: 1 })
    expect(remaining.map(item => item.sequenceOrder)).toEqual([0, 1])
  })
})
