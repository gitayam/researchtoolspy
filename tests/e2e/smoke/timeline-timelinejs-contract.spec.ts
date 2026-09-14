import { test, expect } from '@playwright/test'
import { buildTimelineJSExport, resolveTimelinePresentationSchedule, type TimelinePresentationSchedule } from '../../../src/lib/timeline-timelinejs'
import type { TimelineWorkspaceEvent, TimelineWorkspaceExport } from '../../../src/types/timeline-workspace'

const event = (id: string, extra: Partial<TimelineWorkspaceEvent> = {}): TimelineWorkspaceEvent => ({ id, title: `Event ${id}`, description: 'Description', category: 'event', importance: 'normal', origin: 'analyst', assessment: 'unreviewed', analystNote: '', modified: false, eventDate: '2026-09-12', datePrecision: 'day', narrativeIncluded: true, whyItMatters: 'Consequence', transition: 'Transition excluded', ...extra })
function fixture(events = [event('one')]): TimelineWorkspaceExport {
  return { schemaVersion: 'timeline-workspace.v1', exportedAt: '2026-09-12T00:00:00Z', source: { schemaVersion: 'timeline-manual.v1', title: 'Source title excluded' }, analystWorkspace: { mode: 'basic', events, questions: [], hypotheses: [], narrative: { title: 'Narrative title', framing: 'Narrative framing', question: 'Question excluded', intendedUse: 'Use excluded', scope: 'Scope excluded', timezone: 'America/New_York', dataThrough: '2026-09-12', chapters: [] } } }
}

test.describe('TimelineJS selected narrative adapter @smoke', () => {
  test('maps title and event text with explicit presentation losses and no fabricated media', () => {
    const result = buildTimelineJSExport(fixture())
    expect(result.selectedCount).toBe(1)
    expect(result.omitted).toEqual([])
    expect(result.timeline.title).toEqual({ unique_id: 'narrative-title', autolink: false, text: { headline: 'Narrative title', text: '<p>Narrative framing</p>' } })
    expect(result.timeline.events[0].text.text).toBe('<p>Description</p><p><strong>Why it matters:</strong> Consequence</p><p><strong>Assessment:</strong> Unreviewed</p>')
    expect(result.timeline.scale).toBe('human')
    expect(result.timeline.events[0]).not.toHaveProperty('media')
    expect(result.timeline).not.toHaveProperty('eras')
    expect(JSON.stringify(result.timeline)).not.toContain('excluded')
    expect(result.notices.join(' ')).toContain('TimelineJS sorts chronologically')
    expect(result.notices.join(' ')).toContain('ResearchTools backup keeps all events')
  })

  test('preserves partial dates and recorded time precision without conversion or invented parts', () => {
    const result = buildTimelineJSExport(fixture([
      event('year', { eventDate: '2026', datePrecision: 'year', eventTime: '01:02', narrativeOrder: 0 }),
      event('month', { eventDate: '2026-09', datePrecision: 'month', narrativeOrder: 1 }),
      event('day', { narrativeOrder: 2 }),
      event('minute', { eventTime: '00:03', narrativeOrder: 3 }),
      event('second', { eventTime: '23:59:07', narrativeOrder: 4 }),
    ]))
    expect(result.timeline.events.map(item => item.start_date)).toEqual([
      { year: 2026 }, { year: 2026, month: 9 }, { year: 2026, month: 9, day: 12 },
      { year: 2026, month: 9, day: 12, hour: 0, minute: 3 },
      { year: 2026, month: 9, day: 12, hour: 23, minute: 59, second: 7 },
    ])
    expect(result.timeline.events[3].display_date).toBe('2026-09-12 00:03 (America/New_York)')
    expect(result.notices.join(' ')).toContain('does not encode a timezone or convert')
    expect(result.notices.join(' ')).toContain('year- or month-precision')
    const noZone = fixture([event('time', { eventTime: '12:00' })]); noZone.analystWorkspace.narrative!.timezone = ''
    expect(buildTimelineJSExport(noZone).timeline.events[0].display_date).toContain('timezone not recorded')
  })

  test('omits unknown dates but exports recorded dates on relative and position events', () => {
    const result = buildTimelineJSExport(fixture([
      event('unknown', { eventDate: undefined, datePrecision: undefined, narrativeOrder: 0 }),
      event('relative', { placement: { mode: 'relative', relation: 'after', anchorEventId: 'absolute' }, narrativeOrder: 1 }),
      event('position', { placement: { mode: 'position', position: 2 }, narrativeOrder: 2 }),
      event('absolute', { placement: { mode: 'absolute' }, narrativeOrder: 3 }),
    ]))
    expect(result.selectedCount).toBe(4)
    expect(result.timeline.events.map(item => item.unique_id)).toEqual(['event-relative', 'event-position', 'event-absolute'])
    expect(result.timeline.events.map(item => item.start_date)).toEqual(Array(3).fill({ year: 2026, month: 9, day: 12 }))
    expect(result.omitted.map(item => item.eventId)).toEqual(['unknown'])
    expect(result.omitted.map(item => item.reason).join(' ')).toContain('unknown dates are not invented')
    expect(result.eventDetails['event-relative'].placementLabel).toMatch(/after.*Event absolute/i)
    expect(result.eventDetails['event-position'].placementLabel).toMatch(/position.*2/i)
    expect(result.scheduledCount).toBe(0)
    expect(result.errors).toEqual([])
  })

  test('selection retains narrative order, stable encoded IDs and distinct duplicate chapter titles', () => {
    const snapshot = fixture([
      event('later:one', { eventDate: '2026-10-01', narrativeOrder: 0, chapterId: 'chapter:a' }),
      event('earlier.two', { eventDate: '2026-01-01', narrativeOrder: 1, chapterId: 'chapter:b' }),
      event('unselected', { narrativeIncluded: false }),
      event('unspecified', { narrativeIncluded: undefined }),
    ])
    snapshot.analystWorkspace.narrative!.chapters = [{ id: 'chapter:a', title: 'Same title', claim: 'Claim A' }, { id: 'chapter:b', title: 'Same title', claim: 'Claim B' }]
    const result = buildTimelineJSExport(snapshot)
    expect(result.selectedCount).toBe(2)
    expect(result.timeline.events.map(item => item.unique_id)).toEqual(['event-later%3Aone', 'event-earlier.two'])
    expect(result.timeline.events.map(item => item.group)).toEqual(['Same title [chapter:a]', 'Same title [chapter:b]'])
    expect(result.omitted).toEqual([])
    expect(buildTimelineJSExport(fixture([])).timeline.events).toEqual([])
  })

  test('escapes all HTML-facing human fields and disables automatic linking', () => {
    const attack = '<img src=x onerror="alert(1)"> & \'quoted\''
    const snapshot = fixture([event('safe:id', { title: attack, description: attack, whyItMatters: attack, chapterId: 'chapter:one' })])
    snapshot.analystWorkspace.narrative!.title = attack
    snapshot.analystWorkspace.narrative!.framing = attack
    snapshot.analystWorkspace.narrative!.chapters = [{ id: 'chapter:one', title: attack, claim: '' }]
    const result = buildTimelineJSExport(snapshot)
    for (const value of [result.timeline.title.text.headline, result.timeline.title.text.text, result.timeline.events[0].text.headline, result.timeline.events[0].text.text, result.timeline.events[0].group!]) {
      expect(value).not.toContain('<img')
      expect(value).toContain('&lt;img')
      expect(value).toContain('&quot;')
      expect(value).toContain('&#39;')
      expect(value).toContain('&amp;')
    }
    expect(result.timeline.title.autolink).toBe(false)
    expect(result.timeline.events[0].autolink).toBe(false)
  })

  test('qualifies unsupported corroboration and never mutates frozen workspace or companion content', () => {
    const snapshot = fixture([event('one', { assessment: 'corroborated' })])
    snapshot.analystWorkspace.questions = [{ id: 'question:one', question: 'Retained question', status: 'open', answer: '' }]
    const bytes = JSON.stringify(snapshot)
    function freeze(value: unknown): void {
      if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) }
    }
    freeze(snapshot)
    const result = buildTimelineJSExport(snapshot)
    expect(result.timeline.events[0].text.text).toContain('Corroboration needs review')
    expect(JSON.stringify(snapshot)).toBe(bytes)
    expect(snapshot.analystWorkspace.events[0].assessment).toBe('corroborated')
    expect(JSON.stringify(result.timeline)).not.toContain('Retained question')
    result.timeline.events[0].text.headline = 'Changed output'
    expect(JSON.stringify(snapshot)).toBe(bytes)
  })

  test('explicit scheduling preserves equal-date sequence without invented clocks or source mutation', () => {
    const snapshot = fixture(Array.from({ length: 4 }, (_, index) => event(`drink-${index}`, {
      title: 'Buy a drink', description: `Step ${index + 1}`, eventDate: undefined, datePrecision: undefined,
      narrativeOrder: index, placement: index ? { mode: 'relative', relation: 'after', anchorEventId: `drink-${index - 1}` } : { mode: 'position', position: 1 },
    })))
    const schedule: TimelinePresentationSchedule = { defaultDate: '2028-02-29', events: {} }
    const original = JSON.stringify(snapshot), settings = JSON.stringify(schedule)
    const result = buildTimelineJSExport(snapshot, schedule)
    expect(result.errors).toEqual([])
    expect(result.scheduledCount).toBe(4)
    expect(result.timeline.events.map(item => item.unique_id)).toEqual(['event-drink-0', 'event-drink-1', 'event-drink-2', 'event-drink-3'])
    expect(result.timeline.events.map(item => item.start_date)).toEqual(Array(4).fill({ year: 2028, month: 2, day: 29 }))
    expect(result.timeline.events.every(item => !('hour' in item.start_date) && !('minute' in item.start_date) && !('end_date' in item))).toBe(true)
    for (const detail of Object.values(result.eventDetails)) {
      expect(detail.scheduled).toBe(true)
      expect(detail.dateLabel).toMatch(/presentation assumption/i)
    }
    expect(result.eventDetails['event-drink-1'].placementLabel).toMatch(/after.*Buy a drink/i)
    expect(result.notices.join(' ')).toMatch(/chronolog/i)
    expect(JSON.stringify(snapshot)).toBe(original)
    expect(JSON.stringify(schedule)).toBe(settings)
    expect(buildTimelineJSExport(snapshot).timeline.events).toEqual([])
  })

  test('schedule precedence and action meanings preserve recorded precision and never propagate anchor time', () => {
    const snapshot = fixture([
      event('recorded', { eventTime: '09:15:07', narrativeOrder: 0 }),
      event('partial', { eventDate: '2026-09', datePrecision: 'month', narrativeOrder: 1 }),
      event('unknown', { eventDate: undefined, datePrecision: undefined, narrativeOrder: 2, placement: { mode: 'relative', relation: 'after', anchorEventId: 'recorded' } }),
    ])
    const untouched = buildTimelineJSExport(snapshot, { defaultDate: '2028-02-29', events: {} })
    expect(untouched.timeline.events.map(item => item.start_date)).toEqual([{ year: 2026, month: 9, day: 12, hour: 9, minute: 15, second: 7 }, { year: 2026, month: 9 }, { year: 2028, month: 2, day: 29 }])
    expect(untouched.scheduledCount).toBe(1)
    const changed = buildTimelineJSExport(snapshot, { defaultDate: '2028-02-29', events: {
      recorded: { date: '2026-09-12', time: '09:15:07', meaning: 'start' },
      partial: { date: '2028-03-01', time: '00:01', meaning: 'arrive' },
      unknown: { date: '', time: '', meaning: 'action' },
    } })
    expect(changed.errors).toEqual([])
    expect(changed.scheduledCount).toBe(3)
    expect(changed.timeline.events.map(item => item.start_date)).toEqual([{ year: 2026, month: 9, day: 12, hour: 9, minute: 15, second: 7 }, { year: 2028, month: 3, day: 1, hour: 0, minute: 1 }, { year: 2028, month: 2, day: 29 }])
    expect(changed.eventDetails['event-recorded'].dateLabel).toMatch(/start/i)
    expect(changed.eventDetails['event-partial'].dateLabel).toMatch(/arriv/i)
    expect(buildTimelineJSExport(fixture(), { defaultDate: '2028-02-29', events: { one: { meaning: 'arrive' } } }).scheduledCount).toBe(1)
    expect(buildTimelineJSExport(fixture(), { defaultDate: '2028-02-29', events: { one: { date: '2026-09-12' } } }).scheduledCount).toBe(1)
  })

  test('invalid schedule dates, times and partial-date time overrides fail the complete projection closed', () => {
    const snapshot = fixture([event('one'), event('partial', { eventDate: '2026', datePrecision: 'year', narrativeOrder: 1 })])
    const original = JSON.stringify(snapshot)
    const invalid: TimelinePresentationSchedule[] = [
      ...['', '2027-02-29', '2028-02-30', '2028-13-01', '2028-02', '2028-02-29x'].map(defaultDate => ({ defaultDate, events: {} })),
      ...['2027-02-29', '2028-04-31', '2028-02'].map(date => ({ defaultDate: '2028-02-29', events: { one: { date } } })),
      ...['24:00', '12:60', '12:00:60', '9:00', '12:00Z'].map(time => ({ defaultDate: '2028-02-29', events: { one: { time } } })),
      { defaultDate: '2028-02-29', events: { partial: { time: '09:00' } } },
    ]
    for (const schedule of invalid) {
      const result = buildTimelineJSExport(snapshot, schedule)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.timeline.events).toEqual([])
      expect(JSON.stringify(snapshot)).toBe(original)
    }
    expect(buildTimelineJSExport(snapshot, { defaultDate: '2028-02-29', events: { partial: { date: '2028-02-29', time: '09:00' } } }).errors).toEqual([])
  })

  test('placement descriptions are escaped in scheduled projection and plain text in accessible details', () => {
    const title = '<img src=x onerror="attack()"> & anchor'
    const snapshot = fixture([event('anchor', { title }), event('later', { eventDate: undefined, datePrecision: undefined, narrativeOrder: 1, placement: { mode: 'relative', relation: 'before', anchorEventId: 'anchor' } })])
    const result = buildTimelineJSExport(snapshot, { defaultDate: '2028-02-29', events: {} })
    expect(result.errors).toEqual([])
    expect(result.eventDetails['event-later'].placementLabel).toContain(title)
    expect(result.timeline.events[1].text.text).toContain('&lt;img')
    expect(result.timeline.events[1].text.text).not.toContain('<img')
    expect(result.timeline.events[1].autolink).toBe(false)
  })

  test('automatic flow follows explicit anchors and reconnects when an override is removed', () => {
    const snapshot = fixture(Array.from({ length: 4 }, (_, index) => event(`step-${index}`, { eventDate: undefined, datePrecision: undefined, narrativeOrder: index })))
    const schedule: TimelinePresentationSchedule = { defaultDate: '2028-02-29', automatic: { startTime: '09:00', intervalMinutes: 15 }, events: {} }
    const before = JSON.stringify(snapshot)
    const times = (input: TimelinePresentationSchedule) => Object.values(resolveTimelinePresentationSchedule(snapshot, input).events).map(item => item.time)
    expect(times(schedule)).toEqual(['09:00', '09:15', '09:30', '09:45'])
    const anchored = { ...schedule, events: { 'step-0': { time: '14:00', meaning: 'arrive' as const } } }
    expect(times(anchored)).toEqual(['14:00', '14:15', '14:30', '14:45'])
    expect(times({ ...anchored, automatic: { startTime: '09:00', intervalMinutes: 30 } })).toEqual(['14:00', '14:30', '15:00', '15:30'])
    const middle = { ...anchored, events: { ...anchored.events, 'step-2': { time: '16:00' } } }
    expect(times(middle)).toEqual(['14:00', '14:15', '16:00', '16:15'])
    expect(times({ ...middle, events: { ...middle.events, 'step-2': {} } })).toEqual(['14:00', '14:15', '14:30', '14:45'])
    expect(times({ ...middle, events: { ...middle.events, 'step-2': { time: '' } } })).toEqual(['14:00', '14:15', '14:30', '14:45'])
    const resolved = resolveTimelinePresentationSchedule(snapshot, anchored)
    expect(resolved.errors).toEqual([])
    expect(Object.values(resolved.events).map(item => item.source)).toEqual(['override', 'automatic', 'automatic', 'automatic'])
    expect(Object.values(resolved.events).every(item => item.scheduled)).toBe(true)
    expect(buildTimelineJSExport(snapshot, anchored).timeline.events.map(item => item.start_date)).toEqual([0, 15, 30, 45].map(minute => ({ year: 2028, month: 2, day: 29, hour: 14, minute })))
    expect(JSON.stringify(snapshot)).toBe(before)
    expect(schedule.events).toEqual({})
  })

  test('automatic arithmetic preserves wall-clock seconds across leap, year and DST calendar boundaries', () => {
    const snapshot = fixture([event('one', { eventDate: undefined, datePrecision: undefined, narrativeOrder: 0 }), event('two', { eventDate: undefined, datePrecision: undefined, narrativeOrder: 1 })])
    const cases = [
      ['2028-02-28', '23:50:07', 15, '2028-02-29', '00:05:07'],
      ['2028-02-29', '23:50', 15, '2028-03-01', '00:05'],
      ['0099-12-31', '23:50', 15, '0100-01-01', '00:05'],
      ['2026-03-08', '01:50', 15, '2026-03-08', '02:05'],
      ['2026-11-01', '01:50', 15, '2026-11-01', '02:05'],
      ['0001-01-01', '09:00', 1440, '0001-01-02', '09:00'],
    ] as const
    for (const [defaultDate, startTime, intervalMinutes, date, time] of cases) {
      const result = resolveTimelinePresentationSchedule(snapshot, { defaultDate, automatic: { startTime, intervalMinutes }, events: {} })
      expect(result.errors).toEqual([])
      expect(result.events.two).toMatchObject({ date, time, source: 'automatic', scheduled: true })
    }
    const dateOnly = resolveTimelinePresentationSchedule(snapshot, { defaultDate: '2028-02-29', automatic: { startTime: '23:50:07', intervalMinutes: 15 }, events: { two: { date: '2028-03-05' } } })
    expect(dateOnly.events.two).toMatchObject({ date: '2028-03-05', time: '00:05:07', source: 'override' })
  })

  test('recorded precision stays pinned while timed anchors and untimed gaps disclose chronological differences', () => {
    const snapshot = fixture([
      event('first', { eventDate: undefined, datePrecision: undefined, narrativeOrder: 0 }),
      event('partial', { eventDate: '2026-09', datePrecision: 'month', narrativeOrder: 1 }),
      event('following', { eventDate: undefined, datePrecision: undefined, narrativeOrder: 2 }),
      event('past', { eventDate: '2025-01-01', eventTime: '08:00', narrativeOrder: 3 }),
      event('after-past', { eventDate: undefined, datePrecision: undefined, narrativeOrder: 4 }),
      event('clock-only', { eventDate: undefined, datePrecision: undefined, eventTime: '17:30:05', narrativeOrder: 5 }),
      event('last', { eventDate: undefined, datePrecision: undefined, narrativeOrder: 6 }),
    ])
    const bytes = JSON.stringify(snapshot)
    const schedule: TimelinePresentationSchedule = { defaultDate: '2028-02-29', automatic: { startTime: '09:00', intervalMinutes: 15 }, events: {} }
    const result = resolveTimelinePresentationSchedule(snapshot, schedule)
    expect(result.errors).toEqual([])
    expect(result.events.partial).toMatchObject({ date: '2026-09', source: 'recorded', scheduled: false })
    expect(result.events.partial.time).toBeUndefined()
    expect(result.events.following).toMatchObject({ date: '2028-02-29', time: '09:15' })
    expect(result.events.past).toMatchObject({ date: '2025-01-01', time: '08:00', source: 'recorded', scheduled: false })
    expect(result.events['after-past']).toMatchObject({ date: '2025-01-01', time: '08:15' })
    expect(result.events['clock-only']).toMatchObject({ date: '2025-01-01', time: '17:30:05', source: 'recorded', scheduled: true })
    expect(result.events.last).toMatchObject({ date: '2025-01-01', time: '17:45:05' })
    expect(result.warnings.length).toBeGreaterThanOrEqual(2)
    expect(result.warnings.join(' ')).toMatch(/chronolog|earlier|before/i)
    expect(JSON.stringify(snapshot)).toBe(bytes)
  })

  test('malformed automatic configuration and calendar overflow fail closed without changing source or settings', () => {
    const snapshot = fixture([event('one', { eventDate: undefined, datePrecision: undefined, narrativeOrder: 0 }), event('two', { eventDate: undefined, datePrecision: undefined, narrativeOrder: 1 })])
    const invalid = [null, {}, { startTime: '24:00', intervalMinutes: 15 }, { startTime: '9:00', intervalMinutes: 15 }, ...[0, -1, 1.5, 1441, '15', null].map(intervalMinutes => ({ startTime: '09:00', intervalMinutes }))]
    for (const automatic of invalid) {
      const schedule = { defaultDate: '2028-02-29', events: {}, automatic } as unknown as TimelinePresentationSchedule
      const before = JSON.stringify({ snapshot, schedule })
      expect(resolveTimelinePresentationSchedule(snapshot, schedule).errors.length).toBeGreaterThan(0)
      expect(resolveTimelinePresentationSchedule(snapshot, schedule).events).toEqual({})
      expect(buildTimelineJSExport(snapshot, schedule).timeline.events).toEqual([])
      expect(JSON.stringify({ snapshot, schedule })).toBe(before)
    }
    const overflow: TimelinePresentationSchedule = { defaultDate: '9999-12-31', automatic: { startTime: '23:59', intervalMinutes: 1 }, events: {} }
    expect(resolveTimelinePresentationSchedule(snapshot, overflow).errors.length).toBeGreaterThan(0)
    expect(buildTimelineJSExport(snapshot, overflow).timeline.events).toEqual([])
  })

})
