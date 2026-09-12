import { test, expect } from '@playwright/test'
import { createHash } from 'node:crypto'
import { timelineEvidenceBasis, timelineCorroboration, validateTimelineEvidence } from '../../../src/lib/timeline-evidence'
import { emptyTimelineSourceEvaluation, timelineSourceEvaluationBasis, timelineSourceEvaluationNeedsReview, validateTimelineSourceEvaluation } from '../../../src/lib/timeline-source-evaluation'
import { timelineJudgmentBasis, timelineJudgmentNeedsReview } from '../../../src/lib/timeline-judgments'
import { decodeTimelineWorkspace } from '../../../src/lib/timeline-workspace-codec'
import type { TimelineAssertionEpistemicType, TimelineEvidence, TimelineJudgment, TimelineWorkspaceEvent } from '../../../src/types/timeline-workspace'

const now = '2026-09-12T00:00:00.000Z'
const types: TimelineAssertionEpistemicType[] = ['observation', 'reported_claim', 'inference', 'hypothesis']
const event: TimelineWorkspaceEvent = { id: 'event:one', title: 'Event', description: null, category: 'event', importance: 'normal', origin: 'analyst', assessment: 'corroborated', analystNote: '', modified: false }
function fixture(): TimelineEvidence {
  return {
    schemaVersion: 'timeline-evidence.v1',
    sources: ['a', 'b', 'root'].map(id => ({ id, url: `https://${id}.example/`, title: id, publisher: id })),
    assertions: ['a', 'b', 'root'].map(id => ({ id, sourceId: id, claimText: `Claim ${id}`, temporalClaim: '', passage: { id: `passage:${id}`, quote: `Quote ${id}`, locator: 'Page 1' }, status: 'active', derivesFrom: id === 'a' ? ['root'] : [] })),
    links: ['a', 'b'].map(id => ({ id: `link:${id}`, assertionId: id, eventId: event.id, relation: 'supports' })), reviews: [],
  }
}
function canonical(value: any): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`
  return JSON.stringify(value)
}
const hash = (value: unknown) => createHash('sha256').update(canonical(value)).digest('hex')
const document = (evidence: TimelineEvidence) => ({ schemaVersion: 'timeline-workspace.v1', exportedAt: now, source: { schemaVersion: 'timeline-manual.v1', title: 'Fixture' }, analystWorkspace: { mode: 'basic', events: [event], questions: [], hypotheses: [], evidence } })
function evaluate(evidence: TimelineEvidence) {
  evidence.assertions[0].evaluation = emptyTimelineSourceEvaluation(timelineSourceEvaluationBasis(evidence, 'a'), now)
}

test.describe('timeline assertion epistemic types @smoke', () => {
  test('legacy absence preserves evidence hashes and exact historical basis bytes', () => {
    const evidence = fixture()
    const oldBasis = canonical({ schemaVersion: 'timeline-source-evaluation-basis.v1', assertionId: 'a', assertions: [evidence.assertions[0], evidence.assertions[2]], sources: [evidence.sources[0], evidence.sources[2]] })
    expect(timelineSourceEvaluationBasis(evidence, 'a')).toBe(oldBasis)
    evaluate(evidence)
    const evidenceBasis = timelineEvidenceBasis(evidence, event), bytes = JSON.stringify(evidence), digest = hash(evidence)
    const decoded = decodeTimelineWorkspace(JSON.stringify(document(evidence))).analystWorkspace.evidence!
    expect(JSON.stringify(decoded)).toBe(bytes)
    expect(hash(decoded)).toBe(digest)
    expect(decoded.assertions[0]).not.toHaveProperty('epistemicType')
    expect(decoded.assertions[0].evaluation!.basis).toBe(oldBasis)
    expect(timelineEvidenceBasis(decoded, event)).toBe(evidenceBasis)
    expect(timelineSourceEvaluationNeedsReview(decoded, 'a')).toBe(false)
  })

  test('all explicit types round trip independently of status, relation and event assessment', () => {
    for (const epistemicType of types) {
      const evidence = fixture()
      evidence.assertions[0].epistemicType = epistemicType
      evidence.assertions[0].status = 'retracted'
      evidence.links[0].relation = 'contradicts'
      evaluate(evidence)
      const decoded = decodeTimelineWorkspace(JSON.stringify(document(evidence)))
      expect(decoded.analystWorkspace.evidence).toEqual(evidence)
      expect(decoded.analystWorkspace.events[0].assessment).toBe('corroborated')
      expect(decoded.analystWorkspace.evidence!.assertions[0].status).toBe('retracted')
      expect(decoded.analystWorkspace.evidence!.links[0].relation).toBe('contradicts')
      expect(timelineCorroboration(evidence, event).eligible).toBe(false)
      expect(timelineSourceEvaluationNeedsReview(evidence, 'a')).toBe(false)
    }
  })

  test('invalid current and historical types are rejected rather than defaulted', () => {
    for (const invalid of [null, '', 'unclassified', 'fact', 'Observation', 1, false, {}, []]) {
      const current = fixture()
      Object.assign(current.assertions[0], { epistemicType: invalid })
      expect(() => validateTimelineEvidence(current, [event.id])).toThrow()
      expect(() => decodeTimelineWorkspace(JSON.stringify(document(current)))).toThrow()
      const historical = fixture(); evaluate(historical)
      const basis = JSON.parse(historical.assertions[0].evaluation!.basis)
      basis.assertions[1].epistemicType = invalid
      historical.assertions[0].evaluation!.basis = canonical(basis)
      expect(() => validateTimelineSourceEvaluation(historical.assertions[0].evaluation)).toThrow()
      expect(() => decodeTimelineWorkspace(JSON.stringify(document(historical)))).toThrow()
    }
    const explicitUndefined = fixture()
    Object.assign(explicitUndefined.assertions[0], { epistemicType: undefined })
    expect(() => validateTimelineEvidence(explicitUndefined, [event.id])).toThrow()
  })

  test('classification changes on an assertion or ancestor stale all dependent review bases', () => {
    for (const index of [0, 2]) {
      const evidence = fixture(); evaluate(evidence)
      evidence.reviews = [{ eventId: event.id, independence: 'independent', compatibility: 'compatible', rationale: 'Separate lineages', reviewedAt: now, basis: timelineEvidenceBasis(evidence, event) }]
      const judgment: TimelineJudgment = { id: 'judgment:a', claim: 'Assessment', scope: 'Fixture', asOf: now, reasoning: 'Reasoning', likelihood: { vocabulary: 'timeline-verbal.v1', value: 'unassessed' }, analyticConfidence: 'unassessed', confidenceBasis: 'Unassessed', assumptions: [], alternatives: [], changeIndicators: [], eventRefs: [event.id], evidenceRefs: [], contraryEvidenceRefs: [], status: 'active', changeReason: 'Initial', updatedAt: now, basis: '' }
      judgment.basis = timelineJudgmentBasis(judgment, [event], evidence)
      const direct = { ...judgment, eventRefs: [], evidenceRefs: ['a'] }
      direct.basis = timelineJudgmentBasis(direct, [event], evidence)
      expect(timelineCorroboration(evidence, event).eligible).toBe(true)
      expect(timelineJudgmentNeedsReview(judgment, [event], evidence)).toBe(false)
      evidence.assertions[index].epistemicType = 'inference'
      expect(timelineSourceEvaluationNeedsReview(evidence, 'a')).toBe(true)
      expect(timelineCorroboration(evidence, event).eligible).toBe(false)
      expect(timelineJudgmentNeedsReview(judgment, [event], evidence)).toBe(true)
      expect(timelineJudgmentNeedsReview(direct, [event], evidence)).toBe(true)
      expect(() => validateTimelineEvidence(evidence, [event.id])).not.toThrow()
    }
  })

  test('clearing a current classification retains classified historical inputs without rewriting them', () => {
    const evidence = fixture()
    evidence.assertions[0].epistemicType = 'reported_claim'
    evidence.assertions[2].epistemicType = 'observation'
    evaluate(evidence)
    const prior = evidence.assertions[0].evaluation!.basis
    delete evidence.assertions[0].epistemicType
    delete evidence.assertions[2].epistemicType
    const decoded = decodeTimelineWorkspace(JSON.stringify(document(evidence))).analystWorkspace.evidence!
    expect(decoded.assertions[0]).not.toHaveProperty('epistemicType')
    expect(decoded.assertions[2]).not.toHaveProperty('epistemicType')
    expect(decoded.assertions[0].evaluation!.basis).toBe(prior)
    expect(JSON.parse(prior).assertions.map((item: any) => item.epistemicType)).toEqual(['reported_claim', 'observation'])
    expect(timelineSourceEvaluationNeedsReview(decoded, 'a')).toBe(true)
    expect(() => validateTimelineSourceEvaluation(decoded.assertions[0].evaluation)).not.toThrow()
  })
})
