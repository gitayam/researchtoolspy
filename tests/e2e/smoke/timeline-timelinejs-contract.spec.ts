import { test, expect } from '@playwright/test'
import { buildTimelineJSExport } from '../../../src/lib/timeline-timelinejs'
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

  test('omits unknown and nonabsolute placements even with recorded dates', () => {
    const result = buildTimelineJSExport(fixture([
      event('unknown', { eventDate: undefined, datePrecision: undefined, narrativeOrder: 0 }),
      event('relative', { placement: { mode: 'relative', relation: 'after', anchorEventId: 'absolute' }, narrativeOrder: 1 }),
      event('position', { placement: { mode: 'position', position: 2 }, narrativeOrder: 2 }),
      event('absolute', { placement: { mode: 'absolute' }, narrativeOrder: 3 }),
    ]))
    expect(result.selectedCount).toBe(4)
    expect(result.timeline.events.map(item => item.unique_id)).toEqual(['event-absolute'])
    expect(result.omitted.map(item => item.eventId)).toEqual(['unknown', 'relative', 'position'])
    expect(result.omitted.map(item => item.reason).join(' ')).toContain('unknown dates are not invented')
    expect(result.omitted[1].reason).toContain('Relative placement')
    expect(result.omitted[2].reason).toContain('Position-only placement')
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
})
