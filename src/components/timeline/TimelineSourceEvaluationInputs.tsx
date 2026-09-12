import type { TimelineEvidence, TimelineEvidenceSource, TimelineSourceAssertion } from '@/types/timeline-workspace'
import { timelineSourceEvaluationBasis, validateTimelineSourceEvaluation } from '@/lib/timeline-source-evaluation'

type AssertionInput = Omit<TimelineSourceAssertion, 'evaluation'>
interface InputBasis {
  schemaVersion: 'timeline-source-evaluation-basis.v1'
  assertionId: string
  assertions: AssertionInput[]
  sources: TimelineEvidenceSource[]
}
interface Props {
  evidence: TimelineEvidence
  assertion: TimelineSourceAssertion
}
interface Field<T> {
  label: string
  read: (value: T) => string | undefined
}

const assertionFields: Field<AssertionInput>[] = [
  { label: 'Assertion ID', read: value => value.id },
  { label: 'Type', read: value => value.epistemicType?.replace('_', ' ') || 'Unclassified' },
  { label: 'Claim wording', read: value => value.claimText },
  { label: 'Temporal wording', read: value => value.temporalClaim },
  { label: 'Passage ID', read: value => value.passage.id },
  { label: 'Quote', read: value => value.passage.quote },
  { label: 'Locator', read: value => value.passage.locator },
  { label: 'Status', read: value => value.status },
  { label: 'Source ID', read: value => value.sourceId },
  { label: 'Observed at', read: value => value.observedAt },
  { label: 'Reported at', read: value => value.reportedAt },
  { label: 'Derives from', read: value => [...new Set(value.derivesFrom)].sort().join('\n') },
]
const sourceFields: Field<TimelineEvidenceSource>[] = [
  { label: 'Source ID', read: value => value.id },
  { label: 'URL', read: value => value.url },
  { label: 'Title', read: value => value.title },
  { label: 'Publisher', read: value => value.publisher },
  { label: 'Published at', read: value => value.publishedAt },
  { label: 'Retrieved at', read: value => value.retrievedAt },
]

function compareRecords<T extends { id: string }>(recorded: T[], current: T[], fields: Field<T>[], kind: 'Assertion' | 'Source') {
  const previous = new Map(recorded.map(value => [value.id, value]))
  const latest = new Map(current.map(value => [value.id, value]))
  return [...new Set([...previous.keys(), ...latest.keys()])].sort().map(id => {
    const before = previous.get(id), after = latest.get(id)
    const changed = fields.filter(field => before && after && field.read(before) !== field.read(after)).map(field => field.label)
    const status = !before ? 'Added to current inputs' : !after ? 'Removed from current inputs' : changed.length ? 'Changed' : 'Unchanged'
    return <section key={`${kind}:${id}`} aria-label={`${kind} inputs: ${id}`} className="min-w-0 space-y-3 rounded-lg border bg-background p-3 sm:p-4">
      <h5 className="break-words font-semibold">{kind} inputs: {id}</h5>
      <p className={status === 'Unchanged' ? 'text-sm text-muted-foreground' : 'text-sm font-medium text-amber-800 dark:text-amber-200'}>{status}</p>
      {changed.length > 0 && <p className="text-sm">Changed fields: {changed.join(', ')}</p>}
      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        {([{ label: 'Recorded inputs', value: before }, { label: 'Current inputs', value: after }] as const).map(column => <div key={column.label} className="min-w-0 space-y-3 rounded-md border p-3">
          <h6 className="text-sm font-semibold">{column.label}</h6>
          {!column.value ? <p className="text-sm text-muted-foreground">Not in these inputs</p> : <dl className="space-y-3 text-sm">
            {fields.map(field => {
              const value = field.read(column.value!)
              const fieldChanged = changed.includes(field.label)
              return <div key={field.label} className={fieldChanged ? 'min-w-0 rounded border-l-2 border-amber-500 bg-amber-50/60 p-2 dark:bg-amber-950/20' : 'min-w-0'}>
                <dt className="font-medium">{field.label}{fieldChanged ? ' · Changed' : ''}</dt>
                <dd className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{value === undefined || value === '' ? 'Not recorded' : value}</dd>
              </div>
            })}
          </dl>}
        </div>)}
      </div>
    </section>
  })
}

export function TimelineSourceEvaluationInputs({ evidence, assertion }: Props) {
  let recorded: InputBasis | undefined, current: InputBasis | undefined
  let recordedAt: string | undefined
  try {
    validateTimelineSourceEvaluation(assertion.evaluation)
    const parsed = JSON.parse(assertion.evaluation.basis) as InputBasis
    if (parsed.assertionId !== assertion.id) throw new Error('Mismatched assertion')
    recorded = parsed
    recordedAt = assertion.evaluation.reviewedAt
  } catch { /* The unavailable state never substitutes current data for recorded inputs. */ }
  try {
    // The helper strictly validates the complete generated basis before returning it.
    current = JSON.parse(timelineSourceEvaluationBasis(evidence, assertion.id)) as InputBasis
  } catch { /* Missing or invalid current ancestry remains explicitly unavailable. */ }

  return <details className="min-w-0 rounded-lg border border-teal-200 bg-background p-3 dark:border-teal-900">
    <summary className="cursor-pointer font-medium">Compare evaluation inputs</summary>
    <div role="region" aria-label="Evaluation input comparison" className="mt-4 min-w-0 space-y-4 break-words text-sm leading-relaxed">
      <p>These are analyst-entered input snapshots, not verified source truth, authenticated provenance or a reconstruction of what was known at a past date.</p>
      {recordedAt && <p>Recorded inputs accompany the analyst-entered evaluation dated {recordedAt}. Current inputs reflect this timeline’s present content. Source clocks below are recorded values.</p>}
      {!recorded && <p role="status">Recorded inputs unavailable: the stored evaluation inputs are missing or invalid.</p>}
      {!current && <p role="status">Current inputs unavailable: this assertion or its source ancestry is missing or invalid.</p>}
      {recorded && current && <>
        {compareRecords(recorded.assertions, current.assertions, assertionFields, 'Assertion')}
        {compareRecords(recorded.sources, current.sources, sourceFields, 'Source')}
      </>}
    </div>
  </details>
}
