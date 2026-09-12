import type { TimelineEvidence, TimelineSourceAssertion, TimelineSourceEvaluation } from '../types/timeline-workspace'

const factors = {
  access: ['unassessed', 'direct', 'indirect'],
  reliability: ['unassessed', 'low', 'medium', 'high'],
  credibility: ['unassessed', 'low', 'medium', 'high'],
  currency: ['unassessed', 'current', 'outdated', 'unclear'],
  completeness: ['unassessed', 'complete', 'partial'],
  bias: ['unassessed', 'no_indication', 'possible', 'indicated'],
  deception: ['unassessed', 'no_indication', 'possible', 'indicated'],
} as const
type RecordValue = Record<string, unknown>
function fail(): never { throw new Error('Invalid timeline source evaluation.') }
function record(value: unknown, required: string[], optional: string[] = []): RecordValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail()
  const result = value as RecordValue
  if (required.some(key => !Object.prototype.hasOwnProperty.call(result, key)) || Object.keys(result).some(key => !required.includes(key) && !optional.includes(key))) fail()
  return result
}
function text(value: unknown, max: number, nonblank = false): asserts value is string {
  if (typeof value !== 'string' || value.length > max || (nonblank && !value.trim())) fail()
}
function id(value: unknown): asserts value is string {
  text(value, 200, true)
  if (!/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(value)) fail()
}
function timestamp(value: unknown): void {
  text(value, 64)
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) fail()
  const date = value.slice(0, 10)
  if (new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) fail()
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical((value as RecordValue)[key])}`).join(',')}}`
  return JSON.stringify(value)
}

// This module intentionally has no runtime dependency on timeline-evidence.
// Historical inputs resolve within their own snapshot, never against live data.
function validateBasis(value: unknown): void {
  text(value, 262144, true)
  let parsed: unknown
  try { parsed = JSON.parse(value) } catch { fail() }
  if (canonical(parsed) !== value) fail()
  const root = record(parsed, ['schemaVersion', 'assertionId', 'assertions', 'sources'])
  if (root.schemaVersion !== 'timeline-source-evaluation-basis.v1') fail()
  id(root.assertionId)
  if (!Array.isArray(root.assertions) || root.assertions.length < 1 || root.assertions.length > 200 || !Array.isArray(root.sources) || root.sources.length < 1 || root.sources.length > 100) fail()
  const sources = new Set<string>()
  for (const value of root.sources) {
    const source = record(value, ['id', 'url', 'title', 'publisher'], ['publishedAt', 'retrievedAt'])
    id(source.id)
    if (sources.has(source.id)) fail()
    sources.add(source.id)
    text(source.url, 4096, true)
    try { const url = new URL(source.url); if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) fail() } catch { fail() }
    text(source.title, 1000, true); text(source.publisher, 1000)
    for (const field of ['publishedAt', 'retrievedAt']) if (source[field] !== undefined) timestamp(source[field])
  }
  const assertions = new Map<string, RecordValue>(), passages = new Set<string>()
  for (const value of root.assertions) {
    const assertion = record(value, ['id', 'sourceId', 'claimText', 'temporalClaim', 'passage', 'status', 'derivesFrom'], ['observedAt', 'reportedAt'])
    id(assertion.id); id(assertion.sourceId)
    if (assertions.has(assertion.id) || !sources.has(assertion.sourceId)) fail()
    assertions.set(assertion.id, assertion)
    text(assertion.claimText, 4000, true); text(assertion.temporalClaim, 1000)
    const passage = record(assertion.passage, ['id', 'quote', 'locator'])
    id(passage.id); if (passages.has(passage.id)) fail(); passages.add(passage.id)
    text(passage.quote, 4000); text(passage.locator, 1000, true)
    if (!['active', 'retracted'].includes(assertion.status as string)) fail()
    if (!Array.isArray(assertion.derivesFrom) || assertion.derivesFrom.length > 20) fail()
    const parents = new Set<string>()
    for (const parent of assertion.derivesFrom) { id(parent); if (parents.has(parent)) fail(); parents.add(parent) }
    for (const field of ['observedAt', 'reportedAt']) if (assertion[field] !== undefined) timestamp(assertion[field])
  }
  const visiting = new Set<string>(), visited = new Set<string>(), usedSources = new Set<string>()
  function visit(key: string): void {
    if (visiting.has(key)) fail()
    if (visited.has(key)) return
    const assertion = assertions.get(key)
    if (!assertion) fail()
    visiting.add(key); usedSources.add(assertion.sourceId as string)
    for (const parent of assertion.derivesFrom as string[]) visit(parent)
    visiting.delete(key); visited.add(key)
  }
  visit(root.assertionId)
  if (visited.size !== assertions.size || usedSources.size !== sources.size) fail()
}

export function validateTimelineSourceEvaluation(value: unknown): asserts value is TimelineSourceEvaluation {
  const evaluation = record(value, ['schemaVersion', ...Object.keys(factors), 'reviewedAt', 'basis'])
  if (evaluation.schemaVersion !== 'timeline-source-evaluation.v1') fail()
  for (const key of Object.keys(factors) as (keyof typeof factors)[]) {
    const factor = record(evaluation[key], ['value', 'rationale'])
    if (typeof factor.value !== 'string' || !(factors[key] as readonly string[]).includes(factor.value)) fail()
    text(factor.rationale, 1000, factor.value !== 'unassessed')
  }
  timestamp(evaluation.reviewedAt)
  validateBasis(evaluation.basis)
}

export function timelineSourceEvaluationBasis(evidence: TimelineEvidence, assertionId: string): string {
  const assertions = new Map(evidence.assertions.map(assertion => [assertion.id, assertion]))
  const selected = new Map<string, Omit<TimelineSourceAssertion, 'evaluation'>>()
  const visiting = new Set<string>()
  function include(key: string): void {
    if (visiting.has(key)) fail()
    if (selected.has(key)) return
    const assertion = assertions.get(key)
    if (!assertion) fail()
    visiting.add(key)
    assertion.derivesFrom.forEach(include)
    const { evaluation: _evaluation, ...input } = assertion
    selected.set(key, { ...input, derivesFrom: input.derivesFrom.slice().sort() })
    visiting.delete(key)
  }
  include(assertionId)
  const sourceIds = new Set([...selected.values()].map(assertion => assertion.sourceId))
  const sort = <T extends { id: string }>(values: T[]): T[] => values.slice().sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  const result = canonical({ schemaVersion: 'timeline-source-evaluation-basis.v1', assertionId, assertions: sort([...selected.values()]), sources: sort(evidence.sources.filter(source => sourceIds.has(source.id))) })
  validateBasis(result)
  return result
}

export function timelineSourceEvaluationNeedsReview(evidence: TimelineEvidence, assertionId: string): boolean {
  try {
    const evaluation = evidence.assertions.find(assertion => assertion.id === assertionId)?.evaluation
    validateTimelineSourceEvaluation(evaluation)
    return evaluation.basis !== timelineSourceEvaluationBasis(evidence, assertionId)
  } catch { return true }
}

export function emptyTimelineSourceEvaluation(basis: string, reviewedAt: string): TimelineSourceEvaluation {
  const factor = () => ({ value: 'unassessed' as const, rationale: '' })
  const evaluation: TimelineSourceEvaluation = { schemaVersion: 'timeline-source-evaluation.v1', access: factor(), reliability: factor(), credibility: factor(), currency: factor(), completeness: factor(), bias: factor(), deception: factor(), reviewedAt, basis }
  validateTimelineSourceEvaluation(evaluation)
  return evaluation
}
