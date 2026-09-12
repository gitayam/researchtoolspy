import { TimelineSourceEvaluation } from './TimelineSourceEvaluation'
import { TimelineSourceImport } from './TimelineSourceImport'
import { useState } from 'react'
import { FileSearch } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { emptyTimelineEvidence, timelineCorroboration, timelineEvidenceBasis, validateTimelineEvidence } from '@/lib/timeline-evidence'
import type { TimelineEvidence as Evidence, TimelineWorkspaceEvent, TimelineEvidenceSource, TimelineSourceAssertion, TimelineEvidenceLink, TimelineEvidenceReview } from '@/types/timeline-workspace'

interface Props { sourceImportWorkspaceId?: string; event: TimelineWorkspaceEvent; eventIds: string[]; evidence?: Evidence; onChange: (value: Evidence) => boolean }
const id = (prefix: string) => `${prefix}-${crypto.randomUUID()}`
const selectStyle = 'min-h-10 w-full rounded border bg-background p-2 text-sm'
const blankSource = { url: '', title: '', publisher: '', publishedAt: '', retrievedAt: '' }
const blankAssertion = { claimText: '', temporalClaim: '', quote: '', locator: '', observedAt: '', reportedAt: '', derivesFrom: [] as string[] }

/** Analyst-entered snapshots only. Source links never trigger an automatic fetch. */
export function TimelineEvidence({ sourceImportWorkspaceId, event, eventIds, evidence, onChange }: Props) {
  const data = evidence ?? emptyTimelineEvidence()
  const [sourceId, setSourceId] = useState('')
  const [editingSource, setEditingSource] = useState<string | null>(null)
  const [source, setSource] = useState(blankSource)
  const [assertion, setAssertion] = useState(blankAssertion)
  const [editingAssertion, setEditingAssertion] = useState<string | null>(null)
  const [relation, setRelation] = useState<TimelineEvidenceLink['relation']>('supports')
  const [existingAssertion, setExistingAssertion] = useState('')
  const [independence, setIndependence] = useState<TimelineEvidenceReview['independence']>('unresolved')
  const [compatibility, setCompatibility] = useState<TimelineEvidenceReview['compatibility']>('unresolved')
  const [rationale, setRationale] = useState('')
  const [error, setError] = useState<string | null>(null)
  const gate = timelineCorroboration(evidence, event)
  const review = data.reviews.find(item => item.eventId === event.id)
  function save(next: Evidence): boolean {
    try {
      validateTimelineEvidence(next, eventIds)
      if (!onChange(next)) { setError('Evidence was not saved. Check the timeline size limit.'); return false }
      setError(null); return true
    } catch { setError('Evidence was not saved. Check required fields, HTTP(S) URLs without credentials, ISO timestamps, limits and derivation references.'); return false }
  }
  function saveSource() {
    const value: TimelineEvidenceSource = { id: editingSource ?? id('source'), url: source.url.trim(), title: source.title.trim(), publisher: source.publisher.trim(), ...(source.publishedAt ? { publishedAt: source.publishedAt } : {}), ...(source.retrievedAt ? { retrievedAt: source.retrievedAt } : {}) }
    if (save({ ...data, sources: editingSource ? data.sources.map(item => item.id === editingSource ? value : item) : [...data.sources, value] })) {
      setSourceId(value.id); setEditingSource(null); setSource(blankSource)
    }
  }
  function saveAssertion() {
    const prior = data.assertions.find(item => item.id === editingAssertion)
    const value: TimelineSourceAssertion = { id: editingAssertion ?? id('assertion'), sourceId, claimText: assertion.claimText.trim(), temporalClaim: assertion.temporalClaim, passage: { id: prior?.passage.id ?? id('passage'), quote: assertion.quote, locator: assertion.locator.trim() }, status: prior?.status ?? 'active', ...(prior?.evaluation ? { evaluation: prior.evaluation } : {}), derivesFrom: assertion.derivesFrom, ...(assertion.observedAt ? { observedAt: assertion.observedAt } : {}), ...(assertion.reportedAt ? { reportedAt: assertion.reportedAt } : {}) }
    if (save({ ...data, assertions: editingAssertion ? data.assertions.map(item => item.id === editingAssertion ? value : item) : [...data.assertions, value], links: editingAssertion ? data.links : [...data.links, { id: id('link'), eventId: event.id, assertionId: value.id, relation }] })) {
      setEditingAssertion(null); setAssertion(blankAssertion)
    }
  }
  function editAssertion(item: TimelineSourceAssertion) {
    setEditingAssertion(item.id); setSourceId(item.sourceId)
    setAssertion({ claimText: item.claimText, temporalClaim: item.temporalClaim, quote: item.passage.quote, locator: item.passage.locator, observedAt: item.observedAt ?? '', reportedAt: item.reportedAt ?? '', derivesFrom: item.derivesFrom })
  }
  return <details className="timeline-evidence mt-4 min-w-0 rounded-xl border border-teal-200 border-l-4 border-l-teal-500 bg-teal-50/40 p-4 dark:border-teal-900 dark:border-l-teal-500 dark:bg-teal-950/20" data-testid={`evidence-${event.id}`}>
    <summary className="cursor-pointer break-words font-semibold leading-relaxed text-teal-950 dark:text-teal-100"><FileSearch aria-hidden="true" className="mr-2 inline-block h-4 w-4 align-text-bottom" />Evidence for {event.title} · {data.links.filter(item => item.eventId === event.id).length} assertions</summary>
    <div className="mt-4 space-y-5 break-words text-sm leading-relaxed">
      {sourceImportWorkspaceId ? <TimelineSourceImport workspaceId={sourceImportWorkspaceId} event={event} eventIds={eventIds} evidence={evidence} onChange={onChange} /> : <p>To import a stored Content Research passage, save this timeline to a private workspace, then reopen its saved link with write access.</p>}
      <p>Analyst-entered source assertions. Quotes, locators and derivation are recorded snapshots, not independently verified provenance. Event wording remains separate.</p>
      {(['supports', 'contradicts', 'context'] as const).map(group => <section key={group} aria-label={`${group} assertions`} className="space-y-2">
        <h4 className="border-b border-teal-200/70 pb-2 text-xs font-semibold uppercase tracking-wide text-teal-900 dark:border-teal-900 dark:text-teal-200">{group}</h4>
        {data.links.filter(link => link.eventId === event.id && link.relation === group).map(link => {
          const item = data.assertions.find(candidate => candidate.id === link.assertionId)!
          const cited = data.sources.find(candidate => candidate.id === item.sourceId)!
          return <article key={link.id} className="min-w-0 space-y-3 rounded-lg border border-teal-200/70 bg-background p-4 dark:border-teal-900">
            <p><strong>{item.claimText}</strong> · {item.status}</p>
            <a href={cited.url} target="_blank" rel="noopener noreferrer" className="break-all font-medium text-teal-800 underline underline-offset-4 dark:text-teal-200">{cited.title}</a>
            <p className="break-all">{cited.url}</p><p>Publisher: {cited.publisher || 'Not recorded'}</p>
            <p>Published: {cited.publishedAt || 'Not recorded'} · Retrieved: {cited.retrievedAt || 'Not recorded'}</p>
            <blockquote className="whitespace-pre-wrap rounded-r-md border-l-2 border-teal-400 bg-teal-50/60 py-3 pl-4 pr-3 dark:bg-teal-950/30">{item.passage.quote || 'No quotation recorded'}</blockquote>
            <p>Locator: {item.passage.locator}</p><p>Temporal claim: {item.temporalClaim || 'Not recorded'}</p>
            <p>Observed: {item.observedAt || 'Not recorded'} · Reported: {item.reportedAt || 'Not recorded'}</p>
            <p>Derives from: {item.derivesFrom.length ? item.derivesFrom.map(parent => data.assertions.find(candidate => candidate.id === parent)?.claimText).join('; ') : 'None recorded; independence requires review'}</p>
            <TimelineSourceEvaluation evidence={data} assertion={item} onSave={evaluation => save({ ...data, assertions: data.assertions.map(candidate => candidate.id === item.id ? { ...candidate, evaluation } : candidate) })} />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => editAssertion(item)}>Edit assertion</Button>
              <Button size="sm" variant="outline" onClick={() => save({ ...data, assertions: data.assertions.map(candidate => candidate.id === item.id ? { ...candidate, status: item.status === 'active' ? 'retracted' : 'active' } : candidate) })}>{item.status === 'active' ? 'Retract assertion' : 'Restore assertion'}</Button>
              <Button size="sm" variant="outline" onClick={() => save({ ...data, links: data.links.filter(candidate => candidate.id !== link.id) })}>Unlink assertion</Button>
              <label>Relation<select aria-label="Relation" className={selectStyle} value={link.relation} onChange={change => save({ ...data, links: data.links.map(candidate => candidate.id === link.id ? { ...candidate, relation: change.target.value as TimelineEvidenceLink['relation'] } : candidate) })}>{['supports','contradicts','context'].map(value => <option key={value}>{value}</option>)}</select></label>
            </div>
          </article>
        })}
        {!data.links.some(link => link.eventId === event.id && link.relation === group) && <p className="text-muted-foreground">None linked.</p>}
      </section>)}
      <details className="rounded border p-3"><summary className="cursor-pointer font-medium">Add or edit source</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="sm:col-span-2">Source to edit<select aria-label="Source to edit" className={selectStyle} value={editingSource ?? ''} onChange={change => { const item=data.sources.find(s=>s.id===change.target.value); setEditingSource(item?.id ?? null); setSource(item ? {url:item.url,title:item.title,publisher:item.publisher,publishedAt:item.publishedAt??'',retrievedAt:item.retrievedAt??''}:blankSource) }}><option value="">New source</option>{data.sources.map(item=><option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
          {(['url','title','publisher','publishedAt','retrievedAt'] as const).map(field=><label key={field} className={field==='url'?'sm:col-span-2':''}>{({url:'Source URL',title:'Source title',publisher:'Publisher',publishedAt:'Published at (ISO)',retrievedAt:'Retrieved at (ISO)'})[field]}<Input value={source[field]} maxLength={field==='url'?4096:1000} onChange={change=>setSource({...source,[field]:change.target.value})}/></label>)}
          <Button onClick={saveSource}>{editingSource?'Save source changes':'Add source'}</Button>
        </div>
      </details>
      <details className="rounded border p-3" open={editingAssertion ? true : undefined}><summary className="cursor-pointer font-medium">Add or edit assertion</summary>
        <div className="mt-3 space-y-3">
          <label className="block">Assertion source<select aria-label="Assertion source" className={selectStyle} value={sourceId} onChange={change=>setSourceId(change.target.value)}><option value="">Choose source</option>{data.sources.map(item=><option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
          {(['claimText','temporalClaim','quote','locator','observedAt','reportedAt'] as const).map(field=><label key={field} className="block">{({claimText:'Source claim',temporalClaim:'Temporal wording',quote:'Quoted passage',locator:'Passage locator',observedAt:'Observed at (ISO)',reportedAt:'Reported at (ISO)'})[field]}<Textarea aria-label={({claimText:'Source claim',temporalClaim:'Temporal wording',quote:'Quoted passage',locator:'Passage locator',observedAt:'Observed at (ISO)',reportedAt:'Reported at (ISO)'})[field]} value={assertion[field]} maxLength={field==='claimText'||field==='quote'?4000:1000} onChange={change=>setAssertion({...assertion,[field]:change.target.value})}/></label>)}
          <label className="block">Derives from assertions<select aria-label="Derives from assertions" multiple className={selectStyle} value={assertion.derivesFrom} onChange={change=>setAssertion({...assertion,derivesFrom:Array.from(change.target.selectedOptions,option=>option.value)})}>{data.assertions.filter(item=>item.id!==editingAssertion).map(item=><option key={item.id} value={item.id}>{item.claimText}</option>)}</select></label>
          {!editingAssertion && <label className="block">New assertion relation<select aria-label="New assertion relation" className={selectStyle} value={relation} onChange={change=>setRelation(change.target.value as TimelineEvidenceLink['relation'])}>{['supports','contradicts','context'].map(value=><option key={value}>{value}</option>)}</select></label>}
          <Button onClick={saveAssertion}>{editingAssertion?'Save assertion changes':'Add assertion'}</Button>
          {editingAssertion && <Button variant="outline" onClick={()=>{setEditingAssertion(null);setAssertion(blankAssertion)}}>Cancel assertion edit</Button>}
        </div>
      </details>
      <fieldset className="min-w-0 space-y-3 rounded-lg border bg-background p-4"><legend className="px-2 font-semibold">Link an existing assertion</legend>
        <label className="block">Existing assertion<select aria-label="Existing assertion" className={selectStyle} value={existingAssertion} onChange={change=>setExistingAssertion(change.target.value)}><option value="">Choose assertion</option>{data.assertions.filter(item=>!data.links.some(link=>link.eventId===event.id&&link.assertionId===item.id)).map(item=><option key={item.id} value={item.id}>{item.claimText}</option>)}</select></label>
        <label className="block">Link relation<select aria-label="Link relation" className={selectStyle} value={relation} onChange={change=>setRelation(change.target.value as TimelineEvidenceLink['relation'])}>{['supports','contradicts','context'].map(value=><option key={value}>{value}</option>)}</select></label>
        <Button disabled={!existingAssertion} onClick={()=>{if(save({...data,links:[...data.links,{id:id('link'),eventId:event.id,assertionId:existingAssertion,relation}]}))setExistingAssertion('')}}>Link assertion</Button>
      </fieldset>
      <fieldset className="min-w-0 space-y-3 rounded-lg border border-teal-200 bg-background p-4 dark:border-teal-900"><legend className="px-2 font-semibold">Review corroboration</legend>
        <p role="status">{gate.reason}</p>
        {review && <p>Recorded review: {review.independence} / {review.compatibility} · {review.reviewedAt}<br/>{review.rationale}</p>}
        <label className="block">Independence<select aria-label="Independence" className={selectStyle} value={independence} onChange={change=>setIndependence(change.target.value as TimelineEvidenceReview['independence'])}>{['unresolved','independent','dependent'].map(value=><option key={value}>{value}</option>)}</select></label>
        <label className="block">Compatibility<select aria-label="Compatibility" className={selectStyle} value={compatibility} onChange={change=>setCompatibility(change.target.value as TimelineEvidenceReview['compatibility'])}>{['unresolved','compatible','incompatible'].map(value=><option key={value}>{value}</option>)}</select></label>
        <label className="block">Review rationale<Textarea value={rationale} maxLength={4000} onChange={change=>setRationale(change.target.value)}/></label>
        <Button onClick={()=>{try {save({...data,reviews:[...data.reviews.filter(item=>item.eventId!==event.id),{eventId:event.id,independence,compatibility,rationale:rationale.trim(),reviewedAt:new Date().toISOString(),basis:timelineEvidenceBasis(data,event)}]})}catch{setError('This evidence basis exceeds the review limit.')}}}>Record review</Button>
        <p className="text-muted-foreground">Review records an analyst judgment. It does not certify the source or prove causation.</p>
      </fieldset>
      {error && <p role="alert" className="text-red-600">{error}</p>}
    </div>
  </details>
}
