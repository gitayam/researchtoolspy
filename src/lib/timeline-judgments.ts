import type { TimelineEvidence, TimelineJudgment, TimelineJudgments, TimelineWorkspaceEvent } from '../types/timeline-workspace'
import { emptyTimelineEvidence, timelineEvidenceBasis } from './timeline-evidence'

type RecordValue=Record<string,unknown>
const judgmentKeys=['id','claim','scope','asOf','reasoning','likelihood','analyticConfidence','confidenceBasis','assumptions','alternatives','changeIndicators','eventRefs','evidenceRefs','contraryEvidenceRefs','status','changeReason','updatedAt','basis']
export function emptyTimelineJudgments():TimelineJudgments {return {schemaVersion:'timeline-judgments.v1',judgments:[],reviews:[]}}
function fail():never {throw new Error('Invalid timeline judgments.')}
function object(value:unknown,keys:string[]):RecordValue {
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==keys.length||Object.keys(value).some(key=>!keys.includes(key))) fail()
  return value as RecordValue
}
function text(value:unknown,max:number,nonblank=true):asserts value is string {if(typeof value!=='string'||value.length>max||(nonblank&&!value.trim())) fail()}
function id(value:unknown):asserts value is string {text(value,200);if(!/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(value)) fail()}
function list(value:unknown,max:number):unknown[] {if(!Array.isArray(value)||value.length>max) fail();return value}
function choice(value:unknown,values:string[]) {if(typeof value!=='string'||!values.includes(value)) fail()}
function timestamp(value:unknown) {
  text(value,64)
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(value)||!Number.isFinite(Date.parse(value))) fail()
  const day=value.slice(0,10)
  if(new Date(`${day}T00:00:00Z`).toISOString().slice(0,10)!==day) fail()
}
function canonical(value:unknown):string {
  if(Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if(value&&typeof value==='object') return `{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonical((value as RecordValue)[key])}`).join(',')}}`
  return JSON.stringify(value)
}
function basis(value:unknown):asserts value is string {text(value,262144);try {if(canonical(JSON.parse(value))!==value) fail()} catch {fail()}}
function validateJudgment(value:unknown,events?:Set<string>,assertions?:Set<string>):asserts value is TimelineJudgment {
  const judgment=object(value,judgmentKeys)
  id(judgment.id)
  for(const key of ['claim','reasoning','confidenceBasis','changeReason']) text(judgment[key],4000)
  text(judgment.scope,1000);timestamp(judgment.asOf);timestamp(judgment.updatedAt);basis(judgment.basis)
  const likelihood=object(judgment.likelihood,['vocabulary','value'])
  if(likelihood.vocabulary!=='timeline-verbal.v1') fail()
  choice(likelihood.value,['unassessed','unlikely','roughly_even','likely'])
  choice(judgment.analyticConfidence,['unassessed','low','medium','high']);choice(judgment.status,['active','withdrawn'])
  for(const key of ['assumptions','alternatives','changeIndicators']) for(const item of list(judgment[key],10)) text(item,1000)
  for(const key of ['eventRefs','evidenceRefs','contraryEvidenceRefs']) {
    const seen=new Set<string>(),allowed=key==='eventRefs'?events:assertions
    for(const ref of list(judgment[key],20)) {id(ref);if(seen.has(ref)||(allowed&&!allowed.has(ref))) fail();seen.add(ref)}
  }
  if(!(judgment.eventRefs as string[]).length&&!(judgment.evidenceRefs as string[]).length&&!(judgment.contraryEvidenceRefs as string[]).length) fail()
  if((judgment.evidenceRefs as string[]).some(ref=>(judgment.contraryEvidenceRefs as string[]).includes(ref))) fail()
}
export function validateTimelineJudgments(value:unknown,events:readonly TimelineWorkspaceEvent[],evidence?:TimelineEvidence):asserts value is TimelineJudgments {
  const root=object(value,['schemaVersion','judgments','reviews'])
  if(root.schemaVersion!=='timeline-judgments.v1') fail()
  const eventIds=new Set(events.map(event=>event.id)),assertionIds=new Set(evidence?.assertions.map(assertion=>assertion.id)??[]),judgments=new Set<string>(),reviews=new Set<string>()
  for(const judgment of list(root.judgments,50)) {validateJudgment(judgment,eventIds,assertionIds);if(judgments.has(judgment.id)) fail();judgments.add(judgment.id)}
  for(const item of list(root.reviews,100)) {
    const review=object(item,['id','judgmentId','reviewerLabel','position','rationale','alternative','createdAt','basis'])
    id(review.id);id(review.judgmentId)
    if(reviews.has(review.id)||!judgments.has(review.judgmentId)) fail();reviews.add(review.id)
    text(review.reviewerLabel,200);choice(review.position,['agree','challenge','dissent']);text(review.rationale,4000);text(review.alternative,4000,false);timestamp(review.createdAt);basis(review.basis)
    // A review contains a complete historical judgment, whose old references may
    // legitimately differ from the current workspace. Preserve, do not relink it.
    const snapshot=JSON.parse(review.basis)
    validateJudgment(snapshot)
    if(snapshot.id!==review.judgmentId) fail()
  }
}
export function timelineJudgmentBasis(judgment:TimelineJudgment,events:readonly TimelineWorkspaceEvent[],evidence?:TimelineEvidence):string {
  const data=evidence??emptyTimelineEvidence(),byId=new Map(events.map(event=>[event.id,event]))
  const selected=judgment.eventRefs.slice().sort().map(ref=>{const event=byId.get(ref);if(!event) fail();return JSON.parse(timelineEvidenceBasis(data,event))})
  // Reuse the evidence basis traversal for directly cited assertions; a synthetic
  // event is only an in-memory selector and is never persisted as an occurrence.
  const refs=[...new Set([...judgment.evidenceRefs,...judgment.contraryEvidenceRefs])].sort()
  const selector:TimelineWorkspaceEvent={id:'judgment-input-selector',title:'',description:null,category:'event',importance:'normal',origin:'analyst',assessment:'unreviewed',analystNote:'',modified:false}
  const direct=JSON.parse(timelineEvidenceBasis({...data,links:refs.map((assertionId,index)=>({id:`reference-${index}`,eventId:selector.id,assertionId,relation:'context' as const}))},selector))
  return canonical({eventRefs:judgment.eventRefs.slice().sort(),evidenceRefs:judgment.evidenceRefs.slice().sort(),contraryEvidenceRefs:judgment.contraryEvidenceRefs.slice().sort(),events:selected,assertions:direct.assertions,sources:direct.sources})
}
export function timelineJudgmentNeedsReview(judgment:TimelineJudgment,events:readonly TimelineWorkspaceEvent[],evidence?:TimelineEvidence):boolean {
  try {return judgment.basis!==timelineJudgmentBasis(judgment,events,evidence)} catch {return true}
}
export function timelineJudgmentReviewBasis(judgment:TimelineJudgment):string {return canonical(judgment)}
