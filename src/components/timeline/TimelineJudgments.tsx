import { useState } from 'react'
import { Scale, MessagesSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { emptyTimelineJudgments, timelineJudgmentBasis, timelineJudgmentNeedsReview, timelineJudgmentReviewBasis, validateTimelineJudgments } from '@/lib/timeline-judgments'
import type { TimelineEvidence, TimelineJudgment, TimelineJudgmentReview, TimelineJudgments as Analysis, TimelineWorkspaceEvent } from '@/types/timeline-workspace'

interface Props { analysis?: Analysis; events: TimelineWorkspaceEvent[]; evidence?: TimelineEvidence; editable?: boolean; onChange?: (value: Analysis) => boolean }
const selectStyle = 'min-h-10 w-full rounded border bg-background p-2 text-sm'
const fields = [ ['claim','Judgment claim',4000], ['scope','Judgment scope',1000], ['asOf','As of (ISO timestamp)',1000], ['reasoning','Reasoning',4000], ['confidenceBasis','Confidence basis',4000], ['changeReason','Reason for this change',4000] ] as const
const listFields = [['assumptions','Assumptions'],['alternatives','Alternatives'],['changeIndicators','Change indicators']] as const
const empty = (): TimelineJudgment => ({ id:`judgment-${crypto.randomUUID()}`,claim:'',scope:'',asOf:new Date().toISOString(),reasoning:'',likelihood:{vocabulary:'timeline-verbal.v1',value:'unassessed'},analyticConfidence:'unassessed',confidenceBasis:'',assumptions:[],alternatives:[],changeIndicators:[],eventRefs:[],evidenceRefs:[],contraryEvidenceRefs:[],status:'active',changeReason:'',updatedAt:new Date().toISOString(),basis:'{}' })

export function TimelineJudgments({ analysis, events, evidence, editable=false, onChange }: Props) {
  const data=analysis??emptyTimelineJudgments()
  const [editor,setEditor]=useState<TimelineJudgment|null>(null)
  const [reviewing,setReviewing]=useState<{ id: string; basis: string }|null>(null)
  const [reviewerLabel,setReviewerLabel]=useState('')
  const [position,setPosition]=useState<TimelineJudgmentReview['position']>('challenge')
  const [rationale,setRationale]=useState('')
  const [alternative,setAlternative]=useState('')
  const [error,setError]=useState<string|null>(null)
  const reviewedJudgment=data.judgments.find(item=>item.id===reviewing?.id)
  const draftVersionChanged=!!reviewing&&(!reviewedJudgment||timelineJudgmentReviewBasis(reviewedJudgment)!==reviewing.basis)
  function save(next:Analysis):boolean {
    try {
      validateTimelineJudgments(next,events,evidence)
      if (!onChange?.(next)) {setError('Changes were not saved. Check the timeline size limit.');return false}
      setError(null);return true
    } catch {setError('Changes were not saved. Complete required fields, valid ISO timestamps and references; keep each list to 10 nonblank items of at most 1,000 characters.');return false}
  }
  function saveJudgment() {
    if(!editor)return
    try {
      const next={...editor,updatedAt:new Date().toISOString()}
      next.basis=timelineJudgmentBasis(next,events,evidence)
      if(save({...data,judgments:data.judgments.some(item=>item.id===next.id)?data.judgments.map(item=>item.id===next.id?next:item):[...data.judgments,next]}))setEditor(null)
    }catch{setError('The referenced input basis is too large or invalid. Review the selected references.')}
  }
  function saveReview() {
    const judgment=data.judgments.find(item=>item.id===reviewing?.id)
    if(!judgment||timelineJudgmentNeedsReview(judgment,events,evidence)){setError('Review cannot be recorded while judgment inputs need review. Edit and save the judgment first.');return}
    if(!reviewing||timelineJudgmentReviewBasis(judgment)!==reviewing.basis){setError('This judgment changed while the review was being drafted. Cancel and reopen the review after inspecting the new version.');return}
    const review:TimelineJudgmentReview={id:`review-${crypto.randomUUID()}`,judgmentId:judgment.id,reviewerLabel:reviewerLabel.trim(),position,rationale:rationale.trim(),alternative,createdAt:new Date().toISOString(),basis:reviewing.basis}
    if(save({...data,reviews:[...data.reviews,review]})){setReviewing(null);setReviewerLabel('');setRationale('');setAlternative('')}
  }
  return <section aria-label={editable?'Analytic judgments':'Narrative judgments'} className="timeline-judgments min-w-0 space-y-5 rounded-xl border border-violet-200 border-l-4 border-l-violet-500 bg-violet-50/40 p-4 sm:p-5 dark:border-violet-900 dark:border-l-violet-500 dark:bg-violet-950/20">
    <h2 className="flex items-start gap-3 text-xl font-semibold leading-snug text-violet-950 dark:text-violet-100"><Scale aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" /><span>Analytic judgments and retained dissent</span></h2>
    <p className="text-sm text-muted-foreground">Judgments are separate from event and source wording. Likelihood uses a local verbal vocabulary, not numeric probabilities. Analytical confidence is stated separately and is not calculated from source counts. Review labels are self-attributed, not verified identities or sign-off.</p>
    {!data.judgments.length&&<p>No analytic judgments recorded.</p>}
    {data.judgments.map(judgment=>{
      const stale=timelineJudgmentNeedsReview(judgment,events,evidence)
      const referenced=new Set([...judgment.evidenceRefs,...judgment.contraryEvidenceRefs,...(evidence?.links.filter(link=>judgment.eventRefs.includes(link.eventId)).map(link=>link.assertionId)??[])])
      const visit=(id:string)=>{for(const parent of evidence?.assertions.find(item=>item.id===id)?.derivesFrom??[])if(!referenced.has(parent)){referenced.add(parent);visit(parent)}}
      for(const id of [...referenced])visit(id)
      return <article key={judgment.id} aria-label={`Judgment: ${judgment.claim}`} className="min-w-0 space-y-4 break-words rounded-lg border border-violet-200/70 bg-background p-4 leading-relaxed dark:border-violet-900">
        <h3 className="text-lg font-semibold leading-snug">{judgment.claim}</h3><p className="text-xs text-muted-foreground">{judgment.status} · As of {judgment.asOf} · Updated {judgment.updatedAt}</p>
        <p><strong>Scope:</strong> {judgment.scope}</p><p><strong>Reasoning:</strong> {judgment.reasoning}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <p className="rounded-lg border border-violet-200 bg-violet-50/50 p-3 dark:border-violet-900 dark:bg-violet-950/30"><strong className="block text-sm">Likelihood:</strong> {judgment.likelihood.value.replace('_',' ')} (timeline-verbal.v1)</p>
          <p className="rounded-lg border bg-muted/30 p-3"><strong className="block text-sm">Analytical confidence:</strong> {judgment.analyticConfidence}</p>
        </div><p><strong>Confidence basis:</strong> {judgment.confidenceBasis}</p>
        {listFields.map(([key,label])=><div key={key}><strong>{label}:</strong>{judgment[key].length?<ul className="list-disc pl-5">{judgment[key].map((item,index)=><li key={index}>{item}</li>)}</ul>:<p>None recorded.</p>}</div>)}
        <p><strong>Change reason:</strong> {judgment.changeReason}</p>
        {stale&&<p role="status" className="font-medium text-amber-700 dark:text-amber-300">Judgment inputs changed; review and save this judgment before recording another review.</p>}
        <details className="rounded border p-3"><summary className="cursor-pointer font-medium">Inspect judgment references</summary>
          <ul className="mt-2 list-disc pl-5">{judgment.eventRefs.map(id=>{const event=events.find(item=>item.id===id)!;return <li key={id}>Event: {event.title} · {event.eventDate||'Date unknown'} {event.eventTime??''}<p>{event.description}</p></li>})}</ul>
          {[...referenced].map(id=>{const assertion=evidence?.assertions.find(item=>item.id===id);const source=evidence?.sources.find(item=>item.id===assertion?.sourceId);return assertion&&source?<div key={id} className="mt-3 space-y-1 border-t pt-2"><p><strong>{judgment.contraryEvidenceRefs.includes(id)?'Contrary assertion':judgment.evidenceRefs.includes(id)?'Cited assertion':'Event-linked or derived assertion'}:</strong> {assertion.claimText} · {assertion.status}</p><a className="break-all text-blue-600 underline" href={source.url} target="_blank" rel="noopener noreferrer">{source.title} — {source.url}</a><blockquote className="whitespace-pre-wrap border-l-2 pl-3">{assertion.passage.quote||'No quote recorded'}</blockquote><p>Locator: {assertion.passage.locator}</p><p>Temporal wording: {assertion.temporalClaim||'Not recorded'}</p></div>:null})}
        </details>
        <details><summary className="cursor-pointer">Recorded input basis</summary><pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all text-xs">{judgment.basis}</pre></details>
        <section aria-label="Retained reviews and dissent" className="space-y-3 border-t border-violet-200 pt-4 dark:border-violet-900">
          <h4 className="flex items-center gap-2 font-semibold text-violet-900 dark:text-violet-200"><MessagesSquare aria-hidden="true" className="h-4 w-4 shrink-0" />Retained reviews and dissent</h4>
          {data.reviews.filter(review=>review.judgmentId===judgment.id).map(review=><article key={review.id} className="space-y-2 rounded-lg border border-l-4 border-l-violet-400 bg-violet-50/40 p-4 dark:bg-violet-950/20">
            <p><strong>{review.position}</strong> · {review.reviewerLabel} (self-attributed) · {review.createdAt}</p><p>{review.rationale}</p>{review.alternative&&<p>Alternative: {review.alternative}</p>}
            {review.basis!==timelineJudgmentReviewBasis(judgment)&&<p className="font-medium">Review concerns an earlier judgment version.</p>}
            <details><summary className="cursor-pointer">Reviewed judgment snapshot</summary><pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all text-xs">{review.basis}</pre></details>
          </article>)}
          {!data.reviews.some(review=>review.judgmentId===judgment.id)&&<p>No reviews recorded.</p>}
        </section>
        {editable&&<div className="flex flex-wrap gap-2"><Button variant="outline" onClick={()=>{setEditor({...judgment,changeReason:''});setError(null)}}>Edit judgment</Button><Button variant="outline" onClick={()=>{setEditor({...judgment,status:judgment.status==='active'?'withdrawn':'active',changeReason:''});setError(null)}}>{judgment.status==='active'?'Withdraw judgment':'Restore judgment'}</Button><Button variant="outline" disabled={stale||data.reviews.length>=100||reviewing!==null} onClick={()=>{setReviewing({id:judgment.id,basis:timelineJudgmentReviewBasis(judgment)});setError(null)}}>Add review or dissent</Button></div>}
      </article>
    })}
    {editable&&<Button disabled={data.judgments.length>=50} onClick={()=>{setEditor(empty());setError(null)}}>Add analytic judgment</Button>}
    {editable&&editor&&<fieldset className="space-y-3 rounded border p-4" aria-label="Judgment editor"><legend className="font-semibold">Judgment editor</legend>
      {fields.map(([key,label,limit])=><label key={key} className="block">{label}{key==='asOf'?<Input aria-label={label} value={editor[key]} maxLength={limit} onChange={e=>setEditor({...editor,[key]:e.target.value})}/>:<Textarea aria-label={label} value={editor[key]} maxLength={limit} onChange={e=>setEditor({...editor,[key]:e.target.value})}/>}</label>)}
      <label className="block">Likelihood<select aria-label="Likelihood" className={selectStyle} value={editor.likelihood.value} onChange={e=>setEditor({...editor,likelihood:{vocabulary:'timeline-verbal.v1',value:e.target.value as TimelineJudgment['likelihood']['value']}})}>{['unassessed','unlikely','roughly_even','likely'].map(v=><option key={v} value={v}>{v.replace('_',' ')}</option>)}</select></label>
      <label className="block">Analytical confidence<select aria-label="Analytical confidence" className={selectStyle} value={editor.analyticConfidence} onChange={e=>setEditor({...editor,analyticConfidence:e.target.value as TimelineJudgment['analyticConfidence']})}>{['unassessed','low','medium','high'].map(v=><option key={v}>{v}</option>)}</select></label>
      {listFields.map(([key,label])=><label key={key} className="block">{label} (one per line, up to 10)<Textarea aria-label={label} value={editor[key].join('\n')} maxLength={10009} onChange={e=>setEditor({...editor,[key]:e.target.value===''?[]:e.target.value.split('\n')})}/></label>)}
      {(['eventRefs','evidenceRefs','contraryEvidenceRefs'] as const).map(key=>{const label={eventRefs:'Cited events',evidenceRefs:'Cited assertions',contraryEvidenceRefs:'Contrary assertions'}[key];return <label key={key} className="block">{label}<select multiple aria-label={label} className={selectStyle} value={editor[key]} onChange={e=>setEditor({...editor,[key]:Array.from(e.target.selectedOptions,o=>o.value)})}>{(key==='eventRefs'?events.map(e=>({id:e.id,label:e.title})):evidence?.assertions.map(a=>({id:a.id,label:a.claimText}))??[]).map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select></label>})}
      <label className="block">Judgment status<select aria-label="Judgment status" className={selectStyle} value={editor.status} onChange={e=>setEditor({...editor,status:e.target.value as TimelineJudgment['status']})}><option>active</option><option>withdrawn</option></select></label>
      <div className="flex flex-wrap gap-2"><Button onClick={saveJudgment}>Save judgment</Button><Button variant="outline" onClick={()=>setEditor(null)}>Cancel judgment edit</Button></div>
    </fieldset>}
    {editable&&reviewing&&<fieldset className="space-y-3 rounded border p-4" aria-label="Review editor"><legend>Append review or dissent</legend>
      {draftVersionChanged&&<p role="status">This judgment changed while the review was being drafted. Your draft is retained. Cancel and reopen after inspecting the new version.</p>}
      <label className="block">Reviewer label (self-attributed)<Input aria-label="Reviewer label (self-attributed)" maxLength={200} value={reviewerLabel} onChange={e=>setReviewerLabel(e.target.value)}/></label>
      <label className="block">Review position<select aria-label="Review position" className={selectStyle} value={position} onChange={e=>setPosition(e.target.value as TimelineJudgmentReview['position'])}>{['agree','challenge','dissent'].map(v=><option key={v}>{v}</option>)}</select></label>
      <label className="block">Review rationale<Textarea aria-label="Review rationale" maxLength={4000} value={rationale} onChange={e=>setRationale(e.target.value)}/></label>
      <label className="block">Review alternative<Textarea aria-label="Review alternative" maxLength={4000} value={alternative} onChange={e=>setAlternative(e.target.value)}/></label>
      <Button disabled={draftVersionChanged||!reviewedJudgment||timelineJudgmentNeedsReview(reviewedJudgment,events,evidence)} onClick={saveReview}>Record judgment review</Button><Button variant="outline" onClick={()=>setReviewing(null)}>Cancel review</Button>
    </fieldset>}
    {error&&<p role="alert" className="text-red-600">{error}</p>}
  </section>
}
