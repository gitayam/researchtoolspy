import type { TimelineEvidence, TimelineSourceAssertion, TimelineWorkspaceEvent } from '../types/timeline-workspace'
import { validateTimelineSourceEvaluation } from './timeline-source-evaluation'

export function emptyTimelineEvidence(): TimelineEvidence { return {schemaVersion:'timeline-evidence.v1',sources:[],assertions:[],links:[],reviews:[]} }
type RecordValue = Record<string,unknown>
function fail(): never { throw new Error('Invalid timeline evidence.') }
function object(value:unknown,keys:string[]):RecordValue {
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!keys.includes(key))) fail()
  return value as RecordValue
}
function text(value:unknown,max:number,nonblank=false):asserts value is string {
  if(typeof value!=='string'||value.length>max||(nonblank&&!value.trim())) fail()
}
function id(value:unknown):asserts value is string {text(value,200,true);if(!/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(value)) fail()}
function list(value:unknown,max:number):unknown[] {if(!Array.isArray(value)||value.length>max) fail();return value}
function choice(value:unknown,values:string[]) {if(typeof value!=='string'||!values.includes(value)) fail()}
function timestamp(value:unknown) {
  text(value,64)
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(value)||!Number.isFinite(Date.parse(value))) fail()
  const date=value.slice(0,10)
  if(new Date(`${date}T00:00:00Z`).toISOString().slice(0,10)!==date) fail()
}
function normalizedUrl(value:string):string {const url=new URL(value);url.hash='';return url.href}
function canonical(value:unknown):string {
  if(Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if(value&&typeof value==='object') return `{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonical((value as RecordValue)[key])}`).join(',')}}`
  return JSON.stringify(value)
}
export function validateTimelineEvidence(value:unknown,eventIds:readonly string[]):asserts value is TimelineEvidence {
  const root=object(value,['schemaVersion','sources','assertions','links','reviews'])
  if(root.schemaVersion!=='timeline-evidence.v1') fail()
  const sources=new Set<string>(),assertions=new Map<string,RecordValue>(),passages=new Set<string>(),links=new Set<string>(),pairs=new Set<string>(),reviews=new Set<string>(),events=new Set(eventIds)
  for(const item of list(root.sources,100)) {
    const source=object(item,['id','url','title','publisher','publishedAt','retrievedAt'])
    id(source.id);if(sources.has(source.id)) fail();sources.add(source.id)
    text(source.url,4096,true)
    try {const url=new URL(source.url);if(!['http:','https:'].includes(url.protocol)||url.username||url.password) fail()} catch {fail()}
    text(source.title,1000,true);text(source.publisher,1000)
    for(const field of ['publishedAt','retrievedAt']) if(source[field]!==undefined) timestamp(source[field])
  }
  for(const item of list(root.assertions,200)) {
    const assertion=object(item,['id','sourceId','claimText','temporalClaim','passage','status','derivesFrom','observedAt','reportedAt','evaluation','epistemicType'])
    if(Object.prototype.hasOwnProperty.call(assertion,'epistemicType')) choice(assertion.epistemicType,['observation','reported_claim','inference','hypothesis'])
    id(assertion.id);if(assertions.has(assertion.id)) fail();assertions.set(assertion.id,assertion)
    if(assertion.evaluation!==undefined) {
      validateTimelineSourceEvaluation(assertion.evaluation)
      if(JSON.parse(assertion.evaluation.basis).assertionId!==assertion.id) fail()
    }
    id(assertion.sourceId);if(!sources.has(assertion.sourceId)) fail()
    text(assertion.claimText,4000,true);text(assertion.temporalClaim,1000)
    const passage=object(assertion.passage,['id','quote','locator'])
    id(passage.id);if(passages.has(passage.id)) fail();passages.add(passage.id)
    text(passage.quote,4000);text(passage.locator,1000,true)
    choice(assertion.status,['active','retracted'])
    const parents=list(assertion.derivesFrom,20),seen=new Set<string>()
    for(const parent of parents) {id(parent);if(seen.has(parent)||parent===assertion.id) fail();seen.add(parent)}
    for(const field of ['observedAt','reportedAt']) if(assertion[field]!==undefined) timestamp(assertion[field])
  }
  const visited=new Set<string>(),visiting=new Set<string>()
  function visit(key:string) {
    if(visiting.has(key)||!assertions.has(key)) fail()
    if(visited.has(key)) return
    visiting.add(key)
    for(const parent of assertions.get(key)!.derivesFrom as string[]) visit(parent)
    visiting.delete(key);visited.add(key)
  }
  for(const key of assertions.keys()) visit(key)
  for(const item of list(root.links,400)) {
    const link=object(item,['id','eventId','assertionId','relation'])
    id(link.id);id(link.eventId);id(link.assertionId)
    const pair=JSON.stringify([link.eventId,link.assertionId])
    if(links.has(link.id)||pairs.has(pair)||!events.has(link.eventId)||!assertions.has(link.assertionId)) fail()
    links.add(link.id);pairs.add(pair);choice(link.relation,['supports','contradicts','context'])
  }
  for(const item of list(root.reviews,100)) {
    const review=object(item,['eventId','independence','compatibility','rationale','reviewedAt','basis'])
    id(review.eventId);if(reviews.has(review.eventId)||!events.has(review.eventId)) fail();reviews.add(review.eventId)
    choice(review.independence,['independent','dependent','unresolved']);choice(review.compatibility,['compatible','incompatible','unresolved'])
    text(review.rationale,4000,true);timestamp(review.reviewedAt);text(review.basis,262144)
    // Old/stale bases are preserved for inspection, but malformed/noncanonical text is rejected.
    try {if(canonical(JSON.parse(review.basis))!==review.basis) fail()} catch {fail()}
  }
}

export function timelineEvidenceBasis(evidence:TimelineEvidence,event:TimelineWorkspaceEvent):string {
  const links=evidence.links.filter(link=>link.eventId===event.id)
  const byId=new Map(evidence.assertions.map(assertion=>[assertion.id,assertion])),selected=new Map<string,TimelineSourceAssertion>()
  function include(id:string) {if(selected.has(id)) return;const assertion=byId.get(id);if(!assertion) fail();selected.set(id,assertion);assertion.derivesFrom.forEach(include)}
  links.forEach(link=>include(link.assertionId))
  const sourceIds=new Set([...selected.values()].map(assertion=>assertion.sourceId))
  const sort=<T extends {id:string}>(values:T[])=>values.slice().sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0)
  const claim:RecordValue={id:event.id,title:event.title,description:event.description}
  for(const key of ['eventDate','eventTime','datePrecision','placement'] as const) if(event[key]!==undefined) claim[key]=event[key]
  return canonical({event:claim,links:sort(links),assertions:sort([...selected.values()].map(assertion=>({...assertion,derivesFrom:assertion.derivesFrom.slice().sort()}))),sources:sort(evidence.sources.filter(source=>sourceIds.has(source.id)))})
}

function activeLineagePredicate(byId: ReadonlyMap<string, TimelineSourceAssertion>) {
  const cache = new Map<string, boolean>()
  function activeLineage(assertion: TimelineSourceAssertion): boolean {
    const cached = cache.get(assertion.id)
    if (cached !== undefined) return cached
    const active = assertion.status === 'active' && assertion.derivesFrom.every(parent => activeLineage(byId.get(parent)!))
    cache.set(assertion.id, active)
    return active
  }
  return activeLineage
}

/** Inputs have passed evidence validation; this measures support loss, not truth or review currency. */
export function timelineFinalSupportLoss(before: TimelineEvidence, after: TimelineEvidence, events: readonly TimelineWorkspaceEvent[]): TimelineWorkspaceEvent[] {
  function supportedEvents(evidence: TimelineEvidence): Set<string> {
    const byId = new Map(evidence.assertions.map(assertion => [assertion.id, assertion]))
    const activeLineage = activeLineagePredicate(byId)
    return new Set(evidence.links.filter(link => link.relation === 'supports' && activeLineage(byId.get(link.assertionId)!)).map(link => link.eventId))
  }
  const previouslySupported = supportedEvents(before), currentlySupported = supportedEvents(after)
  return events.filter(event => event.assessment === 'corroborated' && previouslySupported.has(event.id) && !currentlySupported.has(event.id))
}

export function timelineCorroboration(evidence:TimelineEvidence|undefined,event:TimelineWorkspaceEvent):{eligible:boolean;reason:string} {
  const no=(reason:string)=>({eligible:false,reason})
  if(!evidence) return no('Add supporting assertions and review their independence.')
  try {validateTimelineEvidence(evidence,[...new Set([event.id,...evidence.links.map(link=>link.eventId),...evidence.reviews.map(review=>review.eventId)])])} catch {return no('Evidence needs repair before review.')}
  const byId=new Map(evidence.assertions.map(assertion=>[assertion.id,assertion])),sources=new Map(evidence.sources.map(source=>[source.id,source]))
  const links=evidence.links.filter(link=>link.eventId===event.id)
  if(links.some(link=>link.relation==='contradicts'&&byId.get(link.assertionId)!.status==='active')) return no('An active contradictory assertion remains.')
  const activeLineage=activeLineagePredicate(byId)
  const supports=links.filter(link=>link.relation==='supports'&&activeLineage(byId.get(link.assertionId)!)).map(link=>byId.get(link.assertionId)!)
  const lineageCache=new Map<string,Set<string>>()
  const lineageUrls=(assertion:TimelineSourceAssertion):Set<string>=>{
    const cached=lineageCache.get(assertion.id);if(cached) return cached
    // A shared intermediary is recorded dependence even when separately declared
    // roots differ. Include the complete lineage, not just its terminal sources.
    const result=new Set([normalizedUrl(sources.get(assertion.sourceId)!.url),...assertion.derivesFrom.flatMap(parent=>[...lineageUrls(byId.get(parent)!)])])
    lineageCache.set(assertion.id,result);return result
  }
  const origins=supports.map(lineageUrls)
  const separate=origins.some((a,index)=>origins.slice(index+1).some(b=>![...a].some(url=>b.has(url))))
  if(!separate) return no('At least two active supports with separate source origins are required.')
  const review=evidence.reviews.find(review=>review.eventId===event.id)
  if(!review||review.independence!=='independent'||review.compatibility!=='compatible') return no('Review source independence and claim compatibility.')
  if(review.basis!==timelineEvidenceBasis(evidence,event)) return no('Evidence or event wording changed; review again.')
  return {eligible:true,reason:'Analyst reviewed independent, compatible supporting assertions.'}
}
export function timelineAssessmentLabel(evidence:TimelineEvidence|undefined,event:TimelineWorkspaceEvent):string {
  if(event.assessment==='corroborated'&&!timelineCorroboration(evidence,event).eligible) return 'Corroboration needs review'
  return {unreviewed:'Unreviewed',corroborated:'Corroborated',disputed:'Disputed',hypothesis:'Hypothesis'}[event.assessment]
}
