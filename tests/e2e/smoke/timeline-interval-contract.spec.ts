import { test, expect } from '@playwright/test'
import { decodeTimelineWorkspace, workspaceVersionForEvents } from '../../../src/lib/timeline-workspace-codec'
import { reviewTimelineTiming } from '../../../src/lib/timeline-timing'
import { emptyTimelineEvidence, timelineEvidenceBasis } from '../../../src/lib/timeline-evidence'
import { prepareTimelineSave, openTimelineRevision, type TimelineRevisionSummary } from '../../../src/lib/timeline-durable'
import { validArtifactPayload, hashContent } from '../../../functions/api/_shared/timeline-artifact-contract'
import { buildTimelineJSExport } from '../../../src/lib/timeline-timelinejs'
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

  test('private preparation and server v1 kind reject local v2 without making requests', () => {
    const local = snapshot([event('ranged', { recordedEnd: { date: '2026-09-12' } })])
    const originalFetch = globalThis.fetch; let calls = 0
    globalThis.fetch = (async () => { calls++; throw new Error('Unexpected network') }) as typeof fetch
    try {
      expect(() => prepareTimelineSave(local)).toThrow()
      expect(validArtifactPayload('timeline-workspace.v1', local)).toBe(false)
      expect(validArtifactPayload('timeline-workspace.v2', local)).toBe(false)
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

  test('TimelineJS explicitly omits intervals even with scheduling while complete JSON retains them', () => {
    const value = snapshot([event('range', { recordedEnd: { date: '2026-09-12' } }), event('single', { eventDate: '2026-09-15', sequenceOrder: 1, narrativeOrder: 1 })])
    const original = JSON.stringify(value)
    for (const schedule of [undefined, { defaultDate: '2028-02-29', events: { range: { date: '2028-03-01', time: '10:00', meaning: 'arrive' as const } } }]) {
      const result = buildTimelineJSExport(value, schedule)
      expect(result.timeline.events.map(item => item.unique_id)).toEqual(['event-single'])
      expect(result.omitted).toHaveLength(1)
      expect(result.omitted[0]).toMatchObject({ eventId: 'range' })
      expect(result.omitted[0].reason).toMatch(/interval/i)
    }
    expect(JSON.stringify(value)).toBe(original)
    expect(decode(value).analystWorkspace.events[0].recordedEnd).toEqual({ date: '2026-09-12' })
  })
})
