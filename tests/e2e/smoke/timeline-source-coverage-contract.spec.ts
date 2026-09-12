import { test, expect } from '@playwright/test'
import { timelineSourceCoverage, timelineCorroboration, validateTimelineEvidence } from '../../../src/lib/timeline-evidence'
import type { TimelineEvidence, TimelineWorkspaceEvent } from '../../../src/types/timeline-workspace'

const zero = { sourceCount: 0, assertionCount: 0, supports: 0, contradicts: 0, context: 0, activeSupports: 0, retracted: 0, withdrawnAncestrySupports: 0 }
const event: TimelineWorkspaceEvent = { id: 'one', title: 'Event', description: null, category: 'event', importance: 'normal', origin: 'analyst', assessment: 'corroborated', analystNote: '', modified: false }
function fixture(): TimelineEvidence {
  return {
    schemaVersion: 'timeline-evidence.v1',
    sources: ['a', 'b', 'c', 'middle', 'root'].map(id => ({ id, url: `https://${id}.example/`, title: id, publisher: id })),
    assertions: ['a', 'b', 'c', 'middle', 'root'].map(id => ({ id, sourceId: id, claimText: id, temporalClaim: '', passage: { id: `passage:${id}`, quote: id, locator: 'Page 1' }, status: 'active', derivesFrom: [] })),
    links: [
      { id: 'link:a', eventId: 'one', assertionId: 'a', relation: 'supports' },
      { id: 'link:b', eventId: 'one', assertionId: 'b', relation: 'contradicts' },
      { id: 'link:c', eventId: 'one', assertionId: 'c', relation: 'context' },
      { id: 'link:other', eventId: 'other', assertionId: 'root', relation: 'supports' },
    ], reviews: [],
  }
}
function coverage(evidence: TimelineEvidence, eventId = 'one') {
  validateTimelineEvidence(evidence, ['one', 'other'])
  return timelineSourceCoverage(evidence, eventId)
}

test.describe('timeline source coverage @smoke', () => {
  test('absent evidence, empty links and an unrelated event produce all zeros', () => {
    expect(timelineSourceCoverage(undefined, 'one')).toEqual(zero)
    const evidence = fixture()
    expect(coverage(evidence, 'missing')).toEqual(zero)
    evidence.links = []
    expect(coverage(evidence)).toEqual(zero)
  })

  test('role and assertion counts are scoped to the selected event regardless of status', () => {
    const evidence = fixture()
    expect(coverage(evidence)).toEqual({ ...zero, sourceCount: 3, assertionCount: 3, supports: 1, contradicts: 1, context: 1, activeSupports: 1 })
    evidence.assertions[1].status = 'retracted'; evidence.assertions[2].status = 'retracted'
    expect(coverage(evidence)).toEqual({ ...zero, sourceCount: 3, assertionCount: 3, supports: 1, contradicts: 1, context: 1, activeSupports: 1, retracted: 2 })
    expect(coverage(evidence, 'other')).toEqual({ ...zero, sourceCount: 1, assertionCount: 1, supports: 1, activeSupports: 1 })
  })

  test('source counts use directly linked stable IDs, not URLs or ancestry origins', () => {
    const evidence = fixture()
    evidence.sources[1].url = evidence.sources[0].url
    evidence.assertions[0].derivesFrom = ['middle']; evidence.assertions[3].derivesFrom = ['root']
    expect(coverage(evidence).sourceCount).toBe(3)
    evidence.assertions[2].sourceId = 'a'
    expect(coverage(evidence).sourceCount).toBe(2)
    expect(coverage(evidence).assertionCount).toBe(3)
    evidence.links[1].relation = 'supports'
    evidence.links[2].relation = 'supports'
    expect(coverage(evidence).activeSupports).toBe(3)
    expect(timelineCorroboration(evidence, event).eligible).toBe(false)
  })

  test('shared transitive withdrawn ancestry is distinct from directly retracted support', () => {
    const evidence = fixture()
    evidence.links[1].relation = 'supports'; evidence.links[2].relation = 'supports'
    evidence.assertions[0].derivesFrom = ['middle']; evidence.assertions[1].derivesFrom = ['middle']
    evidence.assertions[2].derivesFrom = ['root']; evidence.assertions[3].derivesFrom = ['root']
    evidence.assertions[4].status = 'retracted'
    expect(coverage(evidence)).toEqual({ ...zero, sourceCount: 3, assertionCount: 3, supports: 3, withdrawnAncestrySupports: 3 })
    evidence.assertions[0].status = 'retracted'
    expect(coverage(evidence)).toEqual({ ...zero, sourceCount: 3, assertionCount: 3, supports: 3, retracted: 1, withdrawnAncestrySupports: 2 })
    evidence.assertions[4].status = 'active'
    expect(coverage(evidence)).toEqual({ ...zero, sourceCount: 3, assertionCount: 3, supports: 3, retracted: 1, activeSupports: 2 })
    evidence.links[1].relation = 'context'; evidence.assertions[4].status = 'retracted'
    expect(coverage(evidence).withdrawnAncestrySupports).toBe(1)
  })

  test('coverage is deterministic and preserves frozen evidence, review and assessment bytes', () => {
    const evidence = fixture()
    evidence.reviews = [{ eventId: 'one', independence: 'unresolved', compatibility: 'unresolved', rationale: 'Review pending', reviewedAt: '2026-09-12T00:00:00Z', basis: '{}' }]
    const bytes = JSON.stringify({ evidence, event })
    function freeze(value: unknown): void {
      if (value && typeof value === 'object') {
        Object.values(value).forEach(freeze)
        Object.freeze(value)
      }
    }
    freeze(evidence); freeze(event)
    const result = coverage(evidence)
    const reordered = structuredClone(evidence)
    reordered.sources.reverse(); reordered.assertions.reverse(); reordered.links.reverse()
    expect(coverage(reordered)).toEqual(result)
    expect(JSON.stringify({ evidence, event })).toBe(bytes)
    result.activeSupports = 100
    expect(coverage(evidence).activeSupports).toBe(1)
  })
})
