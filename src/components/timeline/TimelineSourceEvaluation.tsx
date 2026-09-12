import { useState } from 'react'
import { ClipboardCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { emptyTimelineSourceEvaluation, timelineSourceEvaluationBasis, timelineSourceEvaluationNeedsReview, validateTimelineSourceEvaluation } from '@/lib/timeline-source-evaluation'
import type { TimelineEvidence, TimelineSourceAssertion, TimelineSourceEvaluation as Evaluation } from '@/types/timeline-workspace'

const factors = [
  { key: 'access', label: 'Access', help: 'How directly could this source observe the reported information?', values: ['unassessed', 'direct', 'indirect'] },
  { key: 'reliability', label: 'Reliability', help: 'What does the source’s track record support?', values: ['unassessed', 'low', 'medium', 'high'] },
  { key: 'credibility', label: 'Credibility', help: 'How plausible is this particular account, given the available evidence?', values: ['unassessed', 'low', 'medium', 'high'] },
  { key: 'currency', label: 'Currency', help: 'Is the information current for the question being investigated?', values: ['unassessed', 'current', 'outdated', 'unclear'] },
  { key: 'completeness', label: 'Completeness', help: 'How much of the relevant account is available?', values: ['unassessed', 'complete', 'partial'] },
  { key: 'bias', label: 'Possible bias', help: 'What incentives, perspective or selection effects might shape the account?', values: ['unassessed', 'no_indication', 'possible', 'indicated'] },
  { key: 'deception', label: 'Possible deception', help: 'What evidence bears on deliberate misrepresentation?', values: ['unassessed', 'no_indication', 'possible', 'indicated'] },
] as const
const label = (value: string) => value.replaceAll('_', ' ')

export function TimelineSourceEvaluation({ evidence, assertion, onSave }: { evidence: TimelineEvidence; assertion: TimelineSourceAssertion; onSave: (value: Evaluation) => boolean }) {
  const [draft, setDraft] = useState<Evaluation | null>(null)
  const [error, setError] = useState('')
  const recorded = assertion.evaluation
  let currentBasis = ''
  try { currentBasis = timelineSourceEvaluationBasis(evidence, assertion.id) } catch { /* Invalid input remains unsavable. */ }
  function begin() {
    if (!currentBasis) { setError('The source inputs need repair before evaluation.'); return }
    setDraft(recorded ? { ...structuredClone(recorded), basis: currentBasis } : emptyTimelineSourceEvaluation(currentBasis, new Date().toISOString()))
    setError('')
  }
  function save() {
    if (!draft) return
    const value = { ...draft, reviewedAt: new Date().toISOString() }
    try {
      validateTimelineSourceEvaluation(value)
      if (!onSave(value)) { setError('Evaluation was not saved. Check the timeline size limit. Your evaluation draft is retained.'); return }
      setDraft(null); setError('')
    } catch { setError('Add a rationale for every assessed factor (up to 1,000 characters each).') }
  }
  return <section aria-label={`Source evaluation: ${assertion.claimText}`} className="min-w-0 space-y-3 rounded-lg border border-teal-200 bg-teal-50/50 p-3 dark:border-teal-800 dark:bg-teal-950/30">
    <h5 className="flex items-center gap-2 font-semibold"><ClipboardCheck aria-hidden="true" className="h-4 w-4 shrink-0" />Source evaluation</h5>
    <p className="text-sm text-muted-foreground">Analyst assessment of this account. Factors remain separate; no indication of bias or deception is not proof of absence.</p>
    {recorded ? <>
      <p role="status" className={timelineSourceEvaluationNeedsReview(evidence, assertion.id) ? 'font-medium text-amber-800 dark:text-amber-200' : 'text-sm'}>{timelineSourceEvaluationNeedsReview(evidence, assertion.id) ? 'Evaluation needs review — source inputs changed.' : 'Evaluation matches the recorded source inputs.'}</p>
      <p className="text-xs text-muted-foreground">Recorded {recorded.reviewedAt} · Analyst-entered, not an authenticated peer review</p>
      <dl className="grid min-w-0 gap-3 sm:grid-cols-2">{factors.map(factor => <div key={factor.key} className="min-w-0 rounded border bg-background p-3"><dt className="font-medium">{factor.label}: <span className="capitalize">{label(recorded[factor.key].value)}</span></dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm">{recorded[factor.key].rationale || 'No rationale recorded.'}</dd></div>)}</dl>
    </> : <p className="text-sm">No source evaluation recorded.</p>}
    {!draft ? <Button size="sm" variant="outline" onClick={begin}>{recorded ? 'Review source evaluation' : 'Evaluate source'}</Button> : <fieldset className="min-w-0 space-y-4">
      <legend className="font-semibold">Evaluate this account</legend>
      {draft.basis !== currentBasis && <p role="status" className="text-amber-800 dark:text-amber-200">Source inputs changed while this draft was open. Saving retains the original inputs and marks the evaluation as needing review. Cancel and reopen to assess the current inputs.</p>}
      {factors.map(factor => <div key={factor.key} className="min-w-0 space-y-2 rounded border bg-background p-3">
        <label className="block font-medium">{factor.label}<select aria-label={factor.label} className="mt-1 min-h-10 w-full rounded border bg-background p-2 text-sm" value={draft[factor.key].value} onChange={event => setDraft({ ...draft, [factor.key]: { ...draft[factor.key], value: event.target.value } } as Evaluation)}>{factor.values.map(value => <option key={value} value={value}>{label(value)}</option>)}</select></label>
        <p className="text-xs text-muted-foreground">{factor.help}</p>
        <label className="block text-sm">{factor.label} rationale<Textarea maxLength={1000} value={draft[factor.key].rationale} onChange={event => setDraft({ ...draft, [factor.key]: { ...draft[factor.key], rationale: event.target.value } })} /></label>
      </div>)}
      <div className="flex flex-wrap gap-2"><Button size="sm" onClick={save}>Record source evaluation</Button><Button size="sm" variant="outline" onClick={() => { setDraft(null); setError('') }}>Cancel evaluation</Button></div>
    </fieldset>}
    {error && <p role="alert" className="text-red-700 dark:text-red-300">{error}</p>}
  </section>
}
