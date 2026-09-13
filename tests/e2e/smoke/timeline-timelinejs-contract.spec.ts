import { test, expect } from '@playwright/test'
import { buildTimelineJSExport, type TimelinePresentationSchedule } from '../../../src/lib/timeline-timelinejs'
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

})
