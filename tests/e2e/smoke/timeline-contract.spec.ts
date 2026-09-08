import { expect, test } from '@playwright/test'
import {
  normalizeTimelineModelPayload,
  timelineDatePrecision,
} from '../../../functions/api/_shared/timeline-contract'

test.describe('timeline analysis contract @smoke', () => {
  test('@smoke validates date precision using calendar semantics', () => {
    expect(timelineDatePrecision('2026')).toBe('year')
    expect(timelineDatePrecision('2026-09')).toBe('month')
    expect(timelineDatePrecision('2024-02-29')).toBe('day')
    expect(timelineDatePrecision('2026-02-29')).toBeNull()
    expect(timelineDatePrecision('2026-13')).toBeNull()
    expect(timelineDatePrecision('September 2026')).toBeNull()
  })

  test('@smoke preserves supported precision and rejects unsupported events', () => {
    const result = normalizeTimelineModelPayload({
      events: [
        {
          event_date: '2026-09',
          title: '  September event  ',
          description: ' Supported by the article. ',
          category: 'political',
          importance: 'high',
        },
        {
          event_date: '2026-09-31',
          title: 'Impossible calendar date',
        },
        {
          event_date: '2026-10-02',
          title: 'Defaults unknown enums',
          category: 'invented',
          importance: 'urgent',
        },
        { title: 'Missing evidence-bearing date' },
      ],
    })

    expect(result.status).toBe('ok')
    expect(result.rejectedEventCount).toBe(2)
    expect(result.events).toEqual([
      {
        eventDate: '2026-09',
        datePrecision: 'month',
        title: 'September event',
        description: 'Supported by the article.',
        category: 'political',
        importance: 'high',
      },
      {
        eventDate: '2026-10-02',
        datePrecision: 'day',
        title: 'Defaults unknown enums',
        description: null,
        category: 'event',
        importance: 'normal',
      },
    ])
  })

  test('@smoke distinguishes no events from invalid model output', () => {
    expect(normalizeTimelineModelPayload({ events: [] })).toEqual({
      status: 'no_events',
      events: [],
      rejectedEventCount: 0,
    })
    expect(normalizeTimelineModelPayload({ events: [{ title: 'No date' }] })).toEqual({
      status: 'invalid_output',
      events: [],
      rejectedEventCount: 1,
    })
    expect(normalizeTimelineModelPayload({ timeline: [] })).toEqual({
      status: 'invalid_output',
      events: [],
      rejectedEventCount: 0,
    })
  })

  test('@smoke counts model events discarded beyond the bounded contract', () => {
    const output = normalizeTimelineModelPayload({
      events: Array.from({ length: 101 }, (_, index) => ({
        event_date: '2026-09',
        title: `Bounded event ${index}`,
      })),
    })

    expect(output.status).toBe('ok')
    expect(output.events).toHaveLength(100)
    expect(output.rejectedEventCount).toBe(1)
  })
})
