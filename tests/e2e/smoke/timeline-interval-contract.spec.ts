import { test, expect } from '@playwright/test'
import { decodeTimelineWorkspace, workspaceVersionForEvents } from '../../../src/lib/timeline-workspace-codec'
import { reviewTimelineTiming } from '../../../src/lib/timeline-timing'
import { emptyTimelineEvidence, timelineEvidenceBasis } from '../../../src/lib/timeline-evidence'
import { prepareTimelineSave, openTimelineRevision, type TimelineRevisionSummary } from '../../../src/lib/timeline-durable'
import { validArtifactPayload, hashContent } from '../../../functions/api/_shared/timeline-artifact-contract'
import { buildTimelineJSExport, resolveTimelinePresentationSchedule } from '../../../src/lib/timeline-timelinejs'
import type { TimelineWorkspaceEvent, TimelineWorkspaceExport } from '../../../src/types/timeline-workspace'

function event(id: string, extra: Partial<TimelineWorkspaceEvent> = {}): TimelineWorkspaceEvent {
  return { id, title: id, description: null, category: 'event', importance: 'normal', origin: 'analyst', assessment: 'unreviewed', analystNote: '', modified: false, eventDate: '2026-09-10', datePrecision: 'day', sequenceOrder: 0, narrativeOrder: 0, narrativeIncluded: true, whyItMatters: '', transition: '', placement: { mode: 'absolute' }, ...extra }
}
function snapshot(events = [event('repairs')]): TimelineWorkspaceExport {
  return { schemaVersion: workspaceVersionForEvents(events), exportedAt: '2026-09-14T12:00:00.000Z', source: { schemaVersion: 'timeline-manual.v1', title: 'Interval fixture' }, analystWorkspace: { mode: 'robust', presentation: 'analyst', sortDirection: 'oldest', events, questions: [], hypotheses: [], narrative: { title: 'Interval fixture', framing: '', question: '', intendedUse: '', scope: '', timezone: '', dataThrough: '', chapters: [] } } }
}
const decode = (value: unknown) => decodeTimelineWorkspace(JSON.stringify(value))

test.describe('Local recorded interval contracts @smoke', () => {
  test('version selection and strict decoding retain endpoint precision without changing legacy bytes', () => {
    const legacy = snapshot(); const before = JSON.stringify(legacy)
    expect(workspaceVersionForEvents(legacy.analystWorkspace.events)).toBe('timeline-workspace.v1')
    expect(workspaceVersionForEvents([event('absent', { recordedEnd: undefined })])).toBe('timeline-workspace.v1')
    expect(decode(legacy)).toEqual(legacy)
    for (const recordedEnd of [{ date: '2026-09-12', precision: 'day' as const, time: '12:30:59' }, { date: '2026-09', precision: 'month' as const }, { date: '2026' }]) {
      const interval = snapshot([event('repairs', { recordedEnd })])
      expect(interval.schemaVersion).toBe('timeline-workspace.v2')
      expect(decode(interval)).toEqual(interval)
      expect(() => decode({ ...interval, schemaVersion: 'timeline-workspace.v1' })).toThrow()
    }
    expect(JSON.stringify(legacy)).toBe(before)
    expect(() => decode({ ...legacy, schemaVersion: 'timeline-workspace.v3' })).toThrow()
  })

  test('invalid missing or reversed endpoints reject while inclusive overlapping ranges survive', () => {
    for (const extra of [
      { recordedEnd: { date: '' } }, { recordedEnd: { date: '2026-02-31' } }, { recordedEnd: { date: '0999' } },
      { recordedEnd: { date: '2026-09-09' } }, { recordedEnd: { date: '2026-09-12', precision: 'month' } },
      { recordedEnd: { date: '2026-09', time: '12:00' } }, { recordedEnd: { date: '2026-09-12', time: '24:00' } },
      { recordedEnd: { date: '2026-09-12', timezone: 'UTC' } },
      { eventDate: undefined, datePrecision: undefined, recordedEnd: { date: '2026-09-12' } },
      { eventDate: '2026-09', datePrecision: 'month', eventTime: '10:00', recordedEnd: { date: '2026-10' } },
    ]) expect(() => decode(snapshot([event('bad', extra as Partial<TimelineWorkspaceEvent>)]))).toThrow()
    for (const end of ['2026-09-10', '2026-09', '2026']) expect(decode(snapshot([event('same-or-overlap', { recordedEnd: { date: end } })])).analystWorkspace.events[0].recordedEnd).toEqual({ date: end })
  })

  test('timing uses complete interval extents and end changes invalidate evidence basis without changing legacy basis', () => {
    const evidence = emptyTimelineEvidence(), single = event('subject', { placement: { mode: 'relative', relation: 'before', anchorEventId: 'anchor' } })
    const baseline = timelineEvidenceBasis(evidence, single)
    expect(timelineEvidenceBasis(evidence, { ...single, recordedEnd: undefined })).toBe(baseline)
    const ranged = { ...single, recordedEnd: { date: '2026-09-12' } }
    expect(timelineEvidenceBasis(evidence, ranged)).not.toBe(baseline)
    expect(timelineEvidenceBasis(evidence, { ...ranged, recordedEnd: { date: '2026-09-13' } })).not.toBe(timelineEvidenceBasis(evidence, ranged))
    const anchor = event('anchor', { eventDate: '2026-09-12', sequenceOrder: 1 })
    expect(reviewTimelineTiming([single, anchor])[0]).toMatchObject({ status: 'consistent' })
    expect(reviewTimelineTiming([ranged, anchor])[0]).toMatchObject({ status: 'unresolved', reason: 'overlap' })
    expect(reviewTimelineTiming([{ ...ranged, recordedEnd: { date: '2026-09-11' } }, anchor])[0]).toMatchObject({ status: 'consistent' })
  })

  test('private preparation supports v2 while rejecting a mismatched v1 kind without making requests', () => {
    const local = snapshot([event('ranged', { recordedEnd: { date: '2026-09-12' } })])
    const originalFetch = globalThis.fetch; let calls = 0
    globalThis.fetch = (async () => { calls++; throw new Error('Unexpected network') }) as typeof fetch
    try {
      expect(JSON.parse(prepareTimelineSave(local).body).changes[0]).toMatchObject({ kind: 'timeline-workspace.v2', payload: local })
      expect(validArtifactPayload('timeline-workspace.v1', local)).toBe(false)
      expect(validArtifactPayload('timeline-workspace.v2', local)).toBe(true)
      expect(validArtifactPayload('timeline-workspace.v1', snapshot())).toBe(true)
      expect(calls).toBe(0)
    } finally { globalThis.fetch = originalFetch }
  })

  test('hash-valid history still rejects a v2 payload disguised as a v1 object', async () => {
    const local = snapshot([event('ranged', { recordedEnd: { date: '2026-09-12' } })])
    const manifest = { objectId: 'browser-workspace', versionId: 'version_1', kind: 'timeline-workspace.v1', tombstone: false, contentHash: await hashContent({ schemaVersion: 'timeline-workspace.v1', tombstone: false, payload: local }) }
    const revision: TimelineRevisionSummary = { revisionId: 'rev_1', sequence: 1, parentRevisionIds: ['rev_0'], objectCount: 1, changeCount: 1, contentHash: await hashContent([manifest]), createdBy: 1, createdAt: '2026-09-14T12:00:00.000Z' }
    const originalFetch = globalThis.fetch; const requests: string[] = []
    globalThis.fetch = (async (url: string | URL | Request) => { requests.push(String(url)); return new Response(JSON.stringify({ schemaVersion: 'timeline-object-page.v1', artifactId: 'timeline_test', revisionId: 'rev_1', nextCursor: null, objects: [{ ...manifest, payload: local }] }), { headers: { 'Content-Type': 'application/json', ETag: '"rev_1"' } }) }) as typeof fetch
    try {
      await expect(openTimelineRevision('timeline_test', revision, { principalId: 1, workspaceId: 'workspace', headers: { 'X-User-Hash': 'synthetic' } }, new AbortController().signal)).rejects.toThrow()
      expect(requests).toHaveLength(1)
      expect(requests[0]).toContain('/objects?revisionId=rev_1&limit=1')
    } finally { globalThis.fetch = originalFetch }
  })

  test('TimelineJS preserves day clock month and year endpoints without inventing components', () => {
    const examples = [
      { start: '2026-09-10', precision: 'day' as const, end: { date: '2026-09-12', precision: 'day' as const }, expected: { year: 2026, month: 9, day: 12 } },
      { start: '2026-09-10', precision: 'day' as const, end: { date: '2026-09-10', time: '17:30:59' }, expected: { year: 2026, month: 9, day: 10, hour: 17, minute: 30, second: 59 } },
      { start: '2026-09', precision: 'month' as const, end: { date: '2026-11', precision: 'month' as const }, expected: { year: 2026, month: 11 } },
      { start: '2026', precision: 'year' as const, end: { date: '2028', precision: 'year' as const }, expected: { year: 2028 } },
      { start: '2026-09-10', precision: 'day' as const, end: { date: '2026-09-10' }, expected: { year: 2026, month: 9, day: 10 } },
    ]
    for (const example of examples) {
      const value = snapshot([event('range', { eventDate: example.start, datePrecision: example.precision, recordedEnd: example.end })])
      const original = JSON.stringify(value), result = buildTimelineJSExport(value)
      expect(result.omitted).toEqual([])
      expect(result.timeline.events).toHaveLength(1)
      expect(result.timeline.events[0].end_date).toEqual(example.expected)
      expect(result.timeline.events[0].display_date).toContain(example.start)
      expect(result.timeline.events[0].display_date).toContain(example.end.date)
      expect(JSON.stringify(value)).toBe(original)
      expect(decode(value)).toEqual(value)
    }
  })

  test('overlapping precision keeps the slide and full range while declining misleading geometry', () => {
    const value = snapshot([event('range', { eventDate: '2026-09-14', recordedEnd: { date: '2026', precision: 'year' } })])
    const result = buildTimelineJSExport(value)
    expect(result.omitted).toEqual([])
    expect(result.timeline.events).toHaveLength(1)
    expect(result.timeline.events[0]).not.toHaveProperty('end_date')
    expect(result.timeline.events[0].display_date).toContain('2026-09-14')
    expect(result.timeline.events[0].display_date).toContain('2026')
    expect(result.notices.join(' ')).toMatch(/overlap|precision|geometry/i)
    expect(decode(value).analystWorkspace.events[0].recordedEnd).toEqual({ date: '2026', precision: 'year' })
  })

  test('presentation scheduling rejects interval overrides and preserves recorded endpoints and backup', () => {
    const value = snapshot([event('range', { eventTime: '09:00', recordedEnd: { date: '2026-09-12', time: '17:30' } })])
    const original = JSON.stringify(value)
    const basic = { defaultDate: '2028-02-29', events: {} }
    const unscheduled = buildTimelineJSExport(value)
    for (const settings of [{}, { date: '', time: '', meaning: 'action' as const }]) {
      const result = buildTimelineJSExport(value, { ...basic, events: { range: settings } })
      expect(result.errors).toEqual([])
      expect(result.timeline.events).toEqual(unscheduled.timeline.events)
    }
    for (const settings of [{ date: '2028-03-01' }, { time: '10:00' }, { meaning: 'start' as const }, { meaning: 'arrive' as const }]) {
      const result = buildTimelineJSExport(value, { ...basic, events: { range: settings } })
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors.join(' ')).toMatch(/interval|recorded range/i)
      expect(result.timeline.events).toEqual([])
    }
    expect(JSON.stringify(value)).toBe(original)
  })

  test('automatic steps anchor only to a complete timed interval end and warn otherwise', () => {
    const untimed = event('next', { eventDate: undefined, datePrecision: undefined, placement: { mode: 'position', position: 2 }, sequenceOrder: 1, narrativeOrder: 1 })
    const timed = event('range', { eventTime: '09:00', recordedEnd: { date: '2026-09-10', time: '23:50:07' } })
    const schedule = { defaultDate: '2028-02-29', events: {}, automatic: { startTime: '08:00', intervalMinutes: 15 } }
    const resolved = resolveTimelinePresentationSchedule(snapshot([timed, untimed]), schedule)
    expect(resolved.errors).toEqual([])
    expect(resolved.events.next).toMatchObject({ date: '2026-09-11', time: '00:05:07', source: 'automatic' })
    const preceding = event('anchor', { eventDate: '2026-09-09', eventTime: '14:00', narrativeOrder: 0 })
    for (const end of [{ date: '2026-09-12' }, { date: '2026-09' }, { date: '2026' }]) {
      const range = { ...timed, narrativeOrder: 1, recordedEnd: end }
      const result = resolveTimelinePresentationSchedule(snapshot([preceding, range, { ...untimed, narrativeOrder: 2 }]), schedule)
      expect(result.errors).toEqual([])
      expect(result.events.next).toMatchObject({ date: '2026-09-09', time: '14:15' })
      expect(result.warnings.join(' ')).toMatch(/interval|end/i)
      const noPrior = resolveTimelinePresentationSchedule(snapshot([range, { ...untimed, narrativeOrder: 2 }]), schedule)
      expect(noPrior.events.next).toMatchObject({ date: '2028-02-29', time: '08:00' })
    }
  })
})
