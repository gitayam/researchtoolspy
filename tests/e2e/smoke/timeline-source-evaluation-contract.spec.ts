import { test, expect } from '@playwright/test'
import { createHash } from 'node:crypto'
import { emptyTimelineSourceEvaluation, timelineSourceEvaluationBasis, timelineSourceEvaluationNeedsReview, validateTimelineSourceEvaluation } from '../../../src/lib/timeline-source-evaluation'
import { timelineEvidenceBasis, timelineCorroboration, validateTimelineEvidence } from '../../../src/lib/timeline-evidence'
import { timelineJudgmentBasis, timelineJudgmentNeedsReview } from '../../../src/lib/timeline-judgments'
import { decodeTimelineWorkspace } from '../../../src/lib/timeline-workspace-codec'
import type { TimelineEvidence, TimelineJudgment, TimelineWorkspaceEvent } from '../../../src/types/timeline-workspace'

const now = '2026-09-12T00:00:00.000Z'
const event: TimelineWorkspaceEvent = { id: 'event:one', title: 'Reported event', description: null, category: 'event', importance: 'normal', origin: 'analyst', assessment: 'corroborated', analystNote: '', modified: false }
function fixture(): TimelineEvidence {
  return {
    schemaVersion: 'timeline-evidence.v1',
    sources: ['a', 'b', 'root', 'unrelated'].map(id => ({ id, url: `https://${id}.example/report`, title: id, publisher: id, publishedAt: now })),
    assertions: ['a', 'b', 'root', 'unrelated'].map(id => ({ id, sourceId: id, claimText: `Claim ${id}`, temporalClaim: 'September', passage: { id: `passage:${id}`, quote: `Quote ${id}`, locator: 'Page 1' }, status: 'active', derivesFrom: id === 'a' ? ['root'] : [], observedAt: now })),
    links: ['a', 'b'].map(id => ({ id: `link:${id}`, eventId: event.id, assertionId: id, relation: 'supports' })), reviews: [],
  }
}
function evaluated(): TimelineEvidence {
  const evidence = fixture()
  evidence.assertions[0].evaluation = emptyTimelineSourceEvaluation(timelineSourceEvaluationBasis(evidence, 'a'), now)
  return evidence
}
const document = (evidence: TimelineEvidence) => ({ schemaVersion: 'timeline-workspace.v1', exportedAt: now, source: { schemaVersion: 'timeline-manual.v1', title: 'Fixture' }, analystWorkspace: { mode: 'basic', events: [event], questions: [], hypotheses: [], evidence } })
function canonical(value: any): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`
  return JSON.stringify(value)
}
const hash = (value: unknown) => createHash('sha256').update(canonical(value)).digest('hex')

test.describe('timeline source evaluation contract @smoke', () => {
  test('legacy absence preserves exact evidence bytes, hashes and old review basis', () => {
    const evidence = fixture(), bytes = JSON.stringify(evidence), originalHash = hash(evidence)
    const expectedBasis = canonical({ event: { id: event.id, title: event.title, description: event.description }, links: evidence.links, assertions: evidence.assertions.slice(0, 3), sources: evidence.sources.slice(0, 3) })
    expect(timelineEvidenceBasis(evidence, event)).toBe(expectedBasis)
    const decoded = decodeTimelineWorkspace(JSON.stringify(document(evidence))).analystWorkspace.evidence!
    expect(JSON.stringify(decoded)).toBe(bytes)
    expect(hash(decoded)).toBe(originalHash)
    expect(decoded.assertions[0]).not.toHaveProperty('evaluation')
    expect(timelineSourceEvaluationNeedsReview(decoded, 'a')).toBe(true)
  })

  test('evaluation round trips with independent factors and no automatic corroboration', () => {
    const evidence = evaluated(), evaluation = evidence.assertions[0].evaluation!
    evaluation.access = { value: 'direct', rationale: 'Recorded first-hand access' }
    evaluation.bias = { value: 'possible', rationale: 'Declared advocacy' }
    expect(() => validateTimelineEvidence(evidence, [event.id])).not.toThrow()
    expect(decodeTimelineWorkspace(JSON.stringify(document(evidence))).analystWorkspace.evidence).toEqual(evidence)
    expect(timelineSourceEvaluationNeedsReview(evidence, 'a')).toBe(false)
    expect(timelineCorroboration(evidence, event).eligible).toBe(false)
    evaluation.reliability.rationale = 'Separate factor'
    expect(evaluation.credibility.rationale).toBe('')
  })

  test('basis binds complete lineage, excludes all evaluations and ignores unrelated changes', () => {
    const evidence = evaluated(), basis = evidence.assertions[0].evaluation!.basis
    const parsed = JSON.parse(basis)
    expect(parsed.schemaVersion).toBe('timeline-source-evaluation-basis.v1')
    expect(parsed.assertionId).toBe('a')
    expect(parsed.assertions.map((item: any) => item.id)).toEqual(['a', 'root'])
    evidence.assertions[2].evaluation = emptyTimelineSourceEvaluation(timelineSourceEvaluationBasis(evidence, 'root'), now)
    evidence.assertions[0].evaluation!.deception = { value: 'indicated', rationale: 'Analyst concern' }
    evidence.assertions[2].evaluation!.reliability = { value: 'low', rationale: 'Limited record' }
    evidence.assertions[3].claimText = 'Unrelated edit'; evidence.sources[3].title = 'Unrelated source'
    evidence.assertions.reverse(); evidence.sources.reverse(); evidence.links.reverse()
    expect(timelineSourceEvaluationBasis(evidence, 'a')).toBe(basis)
    expect(timelineSourceEvaluationNeedsReview(evidence, 'a')).toBe(false)
    expect(parsed.assertions.every((item: any) => !('evaluation' in item))).toBe(true)
    for (const mutate of [
      (value: TimelineEvidence) => { value.assertions[2].claimText = 'Changed ancestor' },
      (value: TimelineEvidence) => { value.assertions[2].status = 'retracted' },
      (value: TimelineEvidence) => { value.assertions[2].passage.quote = 'Changed quote' },
      (value: TimelineEvidence) => { value.assertions[2].passage.locator = 'Page 2' },
      (value: TimelineEvidence) => { value.assertions[0].observedAt = '2026-09-13T00:00:00Z' },
      (value: TimelineEvidence) => { value.sources[2].publisher = 'Changed publisher' },
      (value: TimelineEvidence) => { value.sources[2].publishedAt = '2026-09-13T00:00:00Z' },
      (value: TimelineEvidence) => { value.assertions[0].derivesFrom = [] },
    ]) {
      const changed = evaluated(); mutate(changed)
      expect(timelineSourceEvaluationNeedsReview(changed, 'a')).toBe(true)
      expect(() => validateTimelineEvidence(changed, [event.id])).not.toThrow()
      expect(changed.assertions[0].evaluation!.basis).toBe(basis)
    }
  })

  test('factor edits stale both event-linked and directly cited judgment bases and corroboration', () => {
    const evidence = evaluated()
    evidence.reviews = [{ eventId: event.id, independence: 'independent', compatibility: 'compatible', rationale: 'Separate accounts', reviewedAt: now, basis: timelineEvidenceBasis(evidence, event) }]
    const judgment: TimelineJudgment = { id: 'judgment:a', claim: 'Assessment', scope: 'Fixture', asOf: now, reasoning: 'Reasoning', likelihood: { vocabulary: 'timeline-verbal.v1', value: 'unassessed' }, analyticConfidence: 'unassessed', confidenceBasis: 'Not assessed', assumptions: [], alternatives: [], changeIndicators: [], eventRefs: [event.id], evidenceRefs: [], contraryEvidenceRefs: [], status: 'active', changeReason: 'Initial', updatedAt: now, basis: '' }
    judgment.basis = timelineJudgmentBasis(judgment, [event], evidence)
    const direct = { ...judgment, eventRefs: [], evidenceRefs: ['a'] }
    direct.basis = timelineJudgmentBasis(direct, [event], evidence)
    expect(timelineCorroboration(evidence, event).eligible).toBe(true)
    expect(timelineJudgmentNeedsReview(judgment, [event], evidence)).toBe(false)
    evidence.assertions[0].evaluation!.credibility = { value: 'low', rationale: 'Conflicting account' }
    expect(timelineCorroboration(evidence, event).eligible).toBe(false)
    expect(timelineJudgmentNeedsReview(judgment, [event], evidence)).toBe(true)
    expect(timelineJudgmentNeedsReview(direct, [event], evidence)).toBe(true)
    expect(timelineSourceEvaluationNeedsReview(evidence, 'a')).toBe(false)
  })

  test('strict fields, factor bounds, timestamps and canonical historical bases fail closed', () => {
    const mutations: Array<(value: any) => void> = [
      value => { value.extra = true }, value => { delete value.access }, value => { value.schemaVersion = 'other' },
      value => { value.access.extra = true }, value => { value.access.value = 'high' }, value => { value.reliability.value = 90 },
      value => { value.currency.value = 'fresh' }, value => { value.completeness.value = 'high' }, value => { value.bias.value = 'none' },
      value => { value.deception.value = 'confirmed' }, value => { value.credibility = { value: 'high', rationale: ' ' } },
      value => { value.access.rationale = 'x'.repeat(1001) }, value => { value.reviewedAt = '2026-02-30T00:00:00Z' },
      value => { value.reviewedAt = '2026-09-12' }, value => { value.basis = '{ "a": 1 }' }, value => { value.basis = '{}' },
      value => { value.basis = 'x'.repeat(262145) },
      value => { const basis = JSON.parse(value.basis); basis.extra = true; value.basis = canonical(basis) },
      value => { const basis = JSON.parse(value.basis); basis.assertionId = 'missing'; value.basis = canonical(basis) },
      value => { const basis = JSON.parse(value.basis); basis.assertions[0].evaluation = {}; value.basis = canonical(basis) },
      value => { const basis = JSON.parse(value.basis); basis.assertions[1].derivesFrom = ['a']; value.basis = canonical(basis) },
    ]
    for (const mutate of mutations) {
      const evidence = evaluated(); mutate(evidence.assertions[0].evaluation)
      expect(() => validateTimelineSourceEvaluation(evidence.assertions[0].evaluation)).toThrow()
      expect(() => decodeTimelineWorkspace(JSON.stringify(document(evidence)))).toThrow()
      expect(timelineSourceEvaluationNeedsReview(evidence, 'a')).toBe(true)
    }
    const evidence = evaluated()
    evidence.assertions[1].evaluation = evidence.assertions[0].evaluation
    expect(() => validateTimelineEvidence(evidence, [event.id])).toThrow()
    expect(timelineSourceEvaluationNeedsReview(evidence, 'missing')).toBe(true)
  })
})
