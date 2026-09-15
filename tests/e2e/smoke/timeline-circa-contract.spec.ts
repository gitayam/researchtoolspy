import { test, expect } from '@playwright/test'
import { decodeTimelineWorkspace, workspaceVersionForEvents } from '../../../src/lib/timeline-workspace-codec'
import { reviewTimelineTiming } from '../../../src/lib/timeline-timing'
import type { TimelineWorkspaceEvent, TimelineWorkspaceExport } from '../../../src/types/timeline-workspace'

function event(id: string, extra: Partial<TimelineWorkspaceEvent> = {}): TimelineWorkspaceEvent {
  return { id, title: id, description: null, category: 'event', importance: 'normal', origin: 'analyst', assessment: 'unreviewed', analystNote: '', modified: false, eventDate: '2026-09-10', datePrecision: 'day', sequenceOrder: 0, narrativeOrder: 0, narrativeIncluded: true, whyItMatters: '', transition: '', placement: { mode: 'absolute' }, ...extra }
}
function snapshot(events = [event('recorded')]): TimelineWorkspaceExport {
  return { schemaVersion: workspaceVersionForEvents(events), exportedAt: '2026-09-14T12:00:00.000Z', source: { schemaVersion: 'timeline-manual.v1', title: 'Circa fixture' }, analystWorkspace: { mode: 'robust', presentation: 'analyst', sortDirection: 'oldest', events, questions: [], hypotheses: [], narrative: { title: 'Circa fixture', framing: '', question: '', intendedUse: '', scope: '', timezone: '', dataThrough: '', chapters: [] } } }
}
const decode = (value: unknown) => decodeTimelineWorkspace(JSON.stringify(value))

test.describe('Approximate recorded date contracts @smoke', () => {
  test('version follows content so timelines without circa keep their existing bytes', () => {
    const legacy = snapshot(); const before = JSON.stringify(legacy)
    expect(legacy.schemaVersion).toBe('timeline-workspace.v1')
    expect(workspaceVersionForEvents([event('interval', { recordedEnd: { date: '2026-09-12', precision: 'day' } })])).toBe('timeline-workspace.v2')

    // Only an explicitly recorded approximation promotes the export.
    expect(workspaceVersionForEvents([event('circa', { dateApproximate: true })])).toBe('timeline-workspace.v3')
    expect(workspaceVersionForEvents([event('exact', { dateApproximate: false })])).toBe('timeline-workspace.v3')
    expect(workspaceVersionForEvents([event('absent', { dateApproximate: undefined })])).toBe('timeline-workspace.v1')

    expect(decode(legacy)).toEqual(legacy)
    expect(JSON.stringify(legacy)).toBe(before)
  })

  test('v3 round-trips approximate dates and keeps false distinct from absent', () => {
    for (const dateApproximate of [true, false]) {
      const doc = snapshot([event('recorded', { dateApproximate })])
      expect(doc.schemaVersion).toBe('timeline-workspace.v3')
      const decoded = decode(doc)
      expect(decoded).toEqual(doc)
      expect(decoded.analystWorkspace.events[0].dateApproximate).toBe(dateApproximate)
    }
    // An unmarked event must not acquire the field on the way through.
    expect(decode(snapshot()).analystWorkspace.events[0].dateApproximate).toBeUndefined()
  })

  test('an approximate date declared under an older version is rejected', () => {
    const circa = snapshot([event('recorded', { dateApproximate: true })])
    for (const schemaVersion of ['timeline-workspace.v1', 'timeline-workspace.v2']) {
      expect(() => decode({ ...circa, schemaVersion })).toThrow()
    }
    expect(decode(circa)).toEqual(circa)
  })

  test('circa qualifies a recorded date and is rejected without one or when not boolean', () => {
    const undated = snapshot([event('undated', { eventDate: undefined, datePrecision: undefined, dateApproximate: true })])
    expect(() => decode(undated)).toThrow()

    for (const bad of ['true', 1, null, {}]) {
      const doc = snapshot([event('recorded', { dateApproximate: bad as unknown as boolean })])
      expect(() => decode({ ...doc, schemaVersion: 'timeline-workspace.v3' })).toThrow()
    }
  })

  test('an approximate recorded date coexists with a recorded interval at v3', () => {
    const doc = snapshot([event('repairs', { dateApproximate: true, recordedEnd: { date: '2026-09-12', precision: 'day' } })])
    expect(doc.schemaVersion).toBe('timeline-workspace.v3')
    const decoded = decode(doc)
    expect(decoded).toEqual(doc)
    expect(decoded.analystWorkspace.events[0].recordedEnd).toEqual({ date: '2026-09-12', precision: 'day' })
    expect(decoded.analystWorkspace.events[0].dateApproximate).toBe(true)
  })

  test('marking a date approximate does not move it or invent a window', () => {
    const exact = [event('first', { eventDate: '2026-09-10' }), event('second', { eventDate: '2026-09-12', placement: { mode: 'relative', relation: 'after', anchorEventId: 'first' } })]
    const circa = [event('first', { eventDate: '2026-09-10', dateApproximate: true }), event('second', { eventDate: '2026-09-12', dateApproximate: true, placement: { mode: 'relative', relation: 'after', anchorEventId: 'first' } })]
    // Circa is a qualifier on the recorded value, not a widened bound: the review is unchanged.
    expect(reviewTimelineTiming(circa)).toEqual(reviewTimelineTiming(exact))
  })
})
