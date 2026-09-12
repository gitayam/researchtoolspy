import { test, expect } from '@playwright/test'
import { timelineFinalSupportLoss, timelineCorroboration, validateTimelineEvidence } from '../../../src/lib/timeline-evidence'
import type { TimelineEvidence, TimelineWorkspaceEvent } from '../../../src/types/timeline-workspace'

const event = (id: string): TimelineWorkspaceEvent => ({ id, title: `Event ${id}`, description: null, category: 'event', importance: 'normal', origin: 'analyst', assessment: 'corroborated', analystNote: '', modified: false })
const events = [event('one'), event('two'), event('three')]
function fixture(): TimelineEvidence {
  return {
    schemaVersion: 'timeline-evidence.v1',
    sources: ['a', 'b', 'middle', 'root'].map(id => ({ id, url: `https://${id}.example/`, title: id, publisher: id })),
    assertions: ['a', 'b', 'middle', 'root'].map(id => ({ id, sourceId: id, claimText: id, temporalClaim: '', passage: { id: `passage:${id}`, quote: id, locator: 'Page 1' }, status: 'active', derivesFrom: [] })),
    links: [{ id: 'link:one', eventId: 'one', assertionId: 'a', relation: 'supports' }], reviews: [],
  }
}
function impact(before: TimelineEvidence, after: TimelineEvidence, context = events) {
  validateTimelineEvidence(before, context.map(item => item.id))
  validateTimelineEvidence(after, context.map(item => item.id))
  return timelineFinalSupportLoss(before, after, context)
}

test.describe('timeline final support warning @smoke', () => {
  test('direct retraction, unlink and relation changes identify final support loss', () => {
    for (const mutate of [
      (value: TimelineEvidence) => { value.assertions[0].status = 'retracted' },
      (value: TimelineEvidence) => { value.links = [] },
      (value: TimelineEvidence) => { value.links[0].relation = 'context' },
      (value: TimelineEvidence) => { value.links[0].relation = 'contradicts' },
    ]) {
      const before = fixture(), after = structuredClone(before)
      mutate(after)
      expect(impact(before, after)).toEqual([events[0]])
    }
  })

  test('shared and transitive ancestry losses return every affected event in supplied order', () => {
    const before = fixture()
    before.assertions[0].derivesFrom = ['middle']
    before.assertions[1].derivesFrom = ['middle']
    before.assertions[2].derivesFrom = ['root']
    before.links.push(
      { id: 'link:two', eventId: 'two', assertionId: 'a', relation: 'supports' },
      { id: 'link:three', eventId: 'three', assertionId: 'b', relation: 'supports' },
    )
    const after = structuredClone(before); after.assertions[3].status = 'retracted'
    const reversed = [...events].reverse()
    expect(impact(before, after, reversed)).toEqual(reversed)
    const direct = structuredClone(before); direct.assertions[0].status = 'retracted'
    expect(impact(before, direct, reversed)).toEqual([events[1], events[0]])
  })

  test('edited derivation onto withdrawn ancestry counts despite stale or missing reviews', () => {
    const before = fixture(); before.assertions[3].status = 'retracted'
    before.assertions[2].derivesFrom = ['root']
    expect(timelineCorroboration(before, events[0]).eligible).toBe(false)
    const after = structuredClone(before); after.assertions[0].derivesFrom = ['middle']
    expect(impact(before, after)).toEqual([events[0]])
    before.reviews = [{ eventId: 'one', independence: 'independent', compatibility: 'compatible', rationale: 'Earlier review', reviewedAt: '2026-09-12T00:00:00Z', basis: '{}' }]
    after.reviews = structuredClone(before.reviews)
    expect(impact(before, after)).toEqual([events[0]])
  })

  test('remaining support, already-zero support, restoration and other assessments do not warn', () => {
    const before = fixture()
    before.links.push({ id: 'link:remaining', eventId: 'one', assertionId: 'b', relation: 'supports' })
    const after = structuredClone(before); after.assertions[0].status = 'retracted'
    expect(impact(before, after)).toEqual([])
    const zero = fixture(); zero.assertions[0].status = 'retracted'
    const removed = structuredClone(zero); removed.links = []
    expect(impact(zero, removed)).toEqual([])
    expect(impact(zero, fixture())).toEqual([])
    for (const assessment of ['unreviewed', 'disputed', 'hypothesis'] as const) {
      expect(impact(fixture(), zero, [{ ...events[0], assessment }])).toEqual([])
    }
    const unrelated = fixture(); unrelated.sources[1].title = 'Edited unrelated source'
    expect(impact(fixture(), unrelated)).toEqual([])
  })

  test('pure impact analysis preserves all input bytes, reviews and event assessments', () => {
    const before = fixture(), after = fixture()
    after.links = []
    const original = JSON.stringify({ before, after, events })
    function freeze(value: unknown): void {
      if (value && typeof value === 'object') {
        Object.values(value).forEach(freeze)
        Object.freeze(value)
      }
    }
    freeze(before); freeze(after); freeze(events)
    const result = impact(before, after)
    expect(result).toEqual([events[0]])
    expect(result[0]).toBe(events[0])
    expect(JSON.stringify({ before, after, events })).toBe(original)
    expect(timelineCorroboration(fixture(), events[0]).eligible).toBe(false)
  })
})
