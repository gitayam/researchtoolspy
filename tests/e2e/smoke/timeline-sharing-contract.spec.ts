import { test, expect } from '@playwright/test'
import { decodeTimelinePresentation, presentationPlainText, type TimelinePresentation } from '../../../src/lib/timeline-presentation-contract'
import { buildTimelineJSExport } from '../../../src/lib/timeline-timelinejs'
import type { TimelineWorkspaceExport } from '../../../src/types/timeline-workspace'

function presentation(): TimelinePresentation {
  return { schemaVersion: 'timeline-presentation.v1', timeline: { scale: 'human', title: { unique_id: 'narrative-title', autolink: false, text: { headline: 'Library &amp; reading room', text: '<p>A selected <strong>account</strong>.</p>' } }, events: [{ unique_id: 'event-record%3A1', autolink: false, start_date: { year: 2026, month: 9, day: 10, hour: 9, minute: 0 }, end_date: { year: 2026, month: 9, day: 10, hour: 17, minute: 30, second: 59 }, display_date: 'Recorded interval: 09:00 through 17:30:59', text: { headline: 'Repairs &lt;reported&gt;', text: '<p>Public description.</p><p><strong>Assessment:</strong> Unreviewed</p>' } }] } }
}
const withEvent = (extra: Record<string, unknown>) => { const value = presentation(); return { ...value, timeline: { ...value.timeline, events: [{ ...value.timeline.events[0], ...extra }] } } }

test.describe('Shared presentation boundary @smoke', () => {
  test('accepts real interval and schedule projections while excluding the complete private workspace', () => {
    const source: TimelineWorkspaceExport = { schemaVersion: 'timeline-workspace.v2', exportedAt: '2026-09-14T12:00:00.000Z', source: { schemaVersion: 'timeline-manual.v1', title: 'PRIVATE_SOURCE' }, analystWorkspace: { mode: 'robust', questions: [], hypotheses: [], narrative: { title: 'Library & reading room', framing: 'An account with <literal text>.', question: 'PRIVATE_QUESTION', intendedUse: '', scope: '', timezone: 'UTC', dataThrough: '', chapters: [] }, events: [
      { id: 'range', title: 'Repair session', description: 'Recorded work.', eventDate: '2026-09-10', eventTime: '09:00', datePrecision: 'day', recordedEnd: { date: '2026-09-10', time: '17:30:59' }, category: 'event', importance: 'normal', origin: 'analyst', assessment: 'unreviewed', analystNote: 'PRIVATE_NOTE', modified: false, narrativeIncluded: true, narrativeOrder: 0 },
      { id: 'next', title: 'Follow-up visit', description: 'A planned follow-up.', category: 'event', importance: 'normal', origin: 'analyst', assessment: 'unreviewed', analystNote: '', modified: false, narrativeIncluded: true, narrativeOrder: 1, placement: { mode: 'relative', relation: 'after', anchorEventId: 'range' } },
    ] } }
    const before = JSON.stringify(source)
    const timeline = buildTimelineJSExport(source, { defaultDate: '2028-02-29', automatic: { startTime: '09:00', intervalMinutes: 15 }, events: {} }).timeline
    const decoded = decodeTimelinePresentation({ schemaVersion: 'timeline-presentation.v1', timeline })
    expect(decoded.timeline).toEqual(timeline)
    expect(decoded.timeline.events[0].end_date).toEqual({ year: 2026, month: 9, day: 10, hour: 17, minute: 30, second: 59 })
    expect(decoded.timeline.events[1].start_date).toEqual({ year: 2026, month: 9, day: 10, hour: 17, minute: 45, second: 59 })
    expect(decoded.timeline.events[1].display_date).toContain('presentation assumption')
    expect(JSON.stringify(decoded)).not.toMatch(/PRIVATE_|analystWorkspace|recordedEnd/)
    expect(JSON.stringify(source)).toBe(before)
  })

  test('rejects private extra fields and code or media at every public projection level', () => {
    const good = presentation()
    for (const value of [null, [], {}, { ...good, schemaVersion: 'timeline-workspace.v2' }, { ...good, source: {} }, { ...good, analystWorkspace: {} }, { ...good, timeline: { ...good.timeline, evidence: [] } }, { ...good, timeline: { ...good.timeline, title: { ...good.timeline.title, media: { url: 'https://example.test/' } } } }, ...[
      { media: { url: 'https://example.test/' } }, { url: 'https://example.test/' }, { recordedEnd: { date: '2026' } }, { autolink: true }, { text: { ...good.timeline.events[0].text, private: 'secret' } }, { start_date: { year: 2026, timezone: 'UTC' } },
    ].map(withEvent)]) expect(() => decodeTimelinePresentation(value)).toThrow()
    for (const html of ['<script>alert(1)</script>', '<img src=x onerror=alert(1)>', '<p onclick="alert(1)">Text</p>', '<a href="javascript:alert(1)">Link</a>', '<iframe srcdoc="x"></iframe>', '<svg/onload=alert(1)>', '<!--hidden-->']) {
      expect(() => decodeTimelinePresentation(withEvent({ text: { headline: 'Title', text: html } }))).toThrow()
      expect(() => presentationPlainText(html)).toThrow()
    }
    expect(() => decodeTimelinePresentation(withEvent({ display_date: '<strong>date</strong>' }))).toThrow()
    expect(() => decodeTimelinePresentation(withEvent({ group: '<b>group</b>' }))).toThrow()
  })

  test('validates Gregorian components and rejects geometric reversal, malformed or duplicate identities', () => {
    for (const date of [{ year: 2026, month: 2, day: 29 }, { year: 1900, month: 2, day: 29 }, { year: 2026, day: 10 }, { year: 2026, month: 9, hour: 10, minute: 0 }, { year: 2026, month: 9, day: 10, hour: 10 }, { year: 2026, month: 9, day: 10, hour: 10, minute: 60 }, { year: '2026' }, { year: 2026.5 }, { year: 10000 }]) expect(() => decodeTimelinePresentation(withEvent({ start_date: date }))).toThrow()
    expect(() => decodeTimelinePresentation(withEvent({ start_date: { year: 2000, month: 2, day: 29 }, end_date: { year: 2000, month: 3, day: 1 } }))).not.toThrow()
    for (const end of [{ year: 2025 }, { year: 2026, month: 9, day: 10, hour: 8, minute: 59 }, { year: 2026 }]) expect(() => decodeTimelinePresentation(withEvent({ end_date: end }))).toThrow()
    expect(() => decodeTimelinePresentation(withEvent({ end_date: presentation().timeline.events[0].start_date }))).not.toThrow()
    for (const unique_id of ['narrative-title', 'event-', 'event-record:1', 'event-%ZZ', 'event-%3Cscript%3E', 'event-' + 'a'.repeat(201)]) expect(() => decodeTimelinePresentation(withEvent({ unique_id }))).toThrow()
    const duplicate = presentation(); duplicate.timeline.events.push(structuredClone(duplicate.timeline.events[0]))
    expect(() => decodeTimelinePresentation(duplicate)).toThrow()
  })

  test('enforces event count and total UTF-8 byte bounds and returns detached copies', () => {
    const empty = presentation(); empty.timeline.events = []; expect(() => decodeTimelinePresentation(empty)).toThrow()
    const count = presentation(); count.timeline.events = Array.from({ length: 100 }, (_, i) => ({ ...count.timeline.events[0], unique_id: `event-${i}` }))
    expect(decodeTimelinePresentation(count).timeline.events).toHaveLength(100)
    count.timeline.events.push({ ...count.timeline.events[0], unique_id: 'event-100' }); expect(() => decodeTimelinePresentation(count)).toThrow()
    const oversized = presentation(); oversized.timeline.events = Array.from({ length: 3 }, (_, i) => ({ ...oversized.timeline.events[0], unique_id: `event-${i}`, text: { headline: 'Title', text: 'é'.repeat(90_000) } }))
    expect(JSON.stringify(oversized).length).toBeLessThan(512 * 1024)
    expect(new TextEncoder().encode(JSON.stringify(oversized)).byteLength).toBeGreaterThan(512 * 1024)
    expect(() => decodeTimelinePresentation(oversized)).toThrow()
    const original = presentation(), bytes = JSON.stringify(original), decoded = decodeTimelinePresentation(original)
    decoded.timeline.events[0].start_date.year = 2030; decoded.timeline.events[0].text.headline = 'Changed'; decoded.timeline.title.text.text = 'Changed'
    expect(JSON.stringify(original)).toBe(bytes)
  })

  test('plain text removes only allowed formatting and decodes escaped entities exactly once', () => {
    expect(presentationPlainText('<p>A <strong>careful</strong> &amp; readable account.</p><p>&lt;literal&gt; &quot;quote&quot; &#39;apostrophe&#39;</p>')).toBe('A careful & readable account.\n\n<literal> "quote" \'apostrophe\'')
    expect(presentationPlainText('&amp;lt;script&amp;gt;')).toBe('&lt;script&gt;')
    expect(presentationPlainText('&lt;img src=x onerror=alert(1)&gt;')).toBe('<img src=x onerror=alert(1)>')
    const encoded = withEvent({ text: { headline: '&lt;script&gt;', text: '<p>&lt;img src=x&gt;</p>' } })
    expect(decodeTimelinePresentation(encoded).timeline.events[0].text.headline).toBe('&lt;script&gt;')
    // The decoded string is for React text rendering, never an HTML-safe value.
    expect(presentationPlainText('&#x3c;script&#x3e;')).toBe('&#x3c;script&#x3e;')
  })
})
