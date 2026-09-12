import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useAuthStore } from '@/stores/auth'
import { emptyTimelineEvidence, validateTimelineEvidence } from '@/lib/timeline-evidence'
import type { TimelineEvidence, TimelineEvidenceLink, TimelineWorkspaceEvent } from '@/types/timeline-workspace'
import type { TimelineSourceImport as MatchedPassage } from '@/types/timeline-source-import'

interface Props { workspaceId: string; event: TimelineWorkspaceEvent; eventIds: string[]; evidence?: TimelineEvidence; onChange: (value: TimelineEvidence) => boolean }
function humanHeaders(): Record<string,string> {
  const headers:Record<string,string>={}
  try {
    const hash=localStorage.getItem('omnicore_user_hash')
    const token=JSON.parse(localStorage.getItem('omnicore_tokens')||'null')?.access_token
    if(hash)headers['X-User-Hash']=hash
    if(typeof token==='string'&&token)headers.Authorization=`Bearer ${token}`
  }catch {return {}}
  return headers
}
function identity() {
  const {user,isAuthenticated}=useAuthStore.getState()
  const role=(user?.role??'').trim().toLowerCase()
  const active=user?.is_active===undefined||user?.is_active===true||Number(user?.is_active)===1
  if(!isAuthenticated||!user||!active||!role||['guest','service'].includes(role))return null
  const headers=humanHeaders()
  if(!headers.Authorization&&!headers['X-User-Hash'])return null
  if(headers.Authorization&&/^Bearer\s+rt_svc_/i.test(headers.Authorization))return null
  return {headers,stamp:JSON.stringify([user.id,role,active,headers])}
}
const record=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value)
function exact(value:unknown,keys:string[]):value is Record<string,unknown>{return record(value)&&Object.keys(value).length===keys.length&&Object.keys(value).every(key=>keys.includes(key))}
const digest=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),byte=>byte.toString(16).padStart(2,'0')).join('')
const canonical=(value:unknown):string=>Array.isArray(value)?`[${value.map(canonical).join(',')}]`:record(value)?`{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`:JSON.stringify(value)
const wellFormed=(value:string)=>!/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(value)
async function responseBody(response:Response):Promise<unknown>{
  if(!response.headers.get('content-type')?.toLowerCase().includes('application/json')||!response.body){void response.body?.cancel().catch(()=>{});throw new Error('The passage response was unreadable.')}
  const reader=response.body.getReader(),decoder=new TextDecoder('utf-8',{fatal:true});let bytes=0,text=''
  try{for(;;){const part=await reader.read();if(part.done)break;bytes+=part.value.byteLength;if(bytes>65536)throw new Error('The passage response exceeded its limit.');text+=decoder.decode(part.value,{stream:true})}return JSON.parse(text+decoder.decode())}
  catch(error){void reader.cancel().catch(()=>{});throw error}finally{reader.releaseLock()}
}
async function validateReply(value:unknown,workspaceId:string,analysisId:number,quote:string,expected?:string):Promise<MatchedPassage>{
  const bad=()=>{throw new Error('The passage response did not match this request. Check the stored passage again.')}
  if(!exact(value,['schemaVersion','workspaceId','analysisId','contentHash','quoteHash','start','end','matchedAt','source','passage']))return bad()
  if(value.schemaVersion!=='timeline-source-import.v1'||value.workspaceId!==workspaceId||value.analysisId!==analysisId||typeof value.contentHash!=='string'||!/^[a-f0-9]{64}$/.test(value.contentHash)||typeof value.quoteHash!=='string'||!/^[a-f0-9]{64}$/.test(value.quoteHash)||(expected&&value.contentHash!==expected))return bad()
  if(!Number.isSafeInteger(value.start)||!Number.isSafeInteger(value.end)||Number(value.start)<0||Number(value.end)>102400||Number(value.end)-Number(value.start)!==quote.length)return bad()
  if(typeof value.matchedAt!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value.matchedAt)||!Number.isFinite(Date.parse(value.matchedAt))||new Date(value.matchedAt).toISOString()!==value.matchedAt)return bad()
  if(!exact(value.source,['id','url','title','publisher'])||value.source.id!==`content:${analysisId}:${value.contentHash}`||!exact(value.passage,['id','quote','locator'])||value.passage.id!==`passage:${analysisId}:${value.contentHash}:${value.start}:${value.end}`||value.passage.quote!==quote||value.quoteHash!==await digest(quote))return bad()
  const locator=`Recorded reference to stored analysis ${analysisId}; content SHA-256 ${value.contentHash}; UTF-16 [${value.start},${value.end}); quote SHA-256 ${value.quoteHash}; matched ${value.matchedAt}. Matches stored extraction, not verified source truth.`
  if(value.passage.locator!==locator||!Object.values(value.source).every(item=>typeof item==='string'&&wellFormed(item)))return bad()
  try{if(value.source.publisher!==new URL(String(value.source.url)).hostname)return bad()}catch{return bad()}
  const candidate={...emptyTimelineEvidence(),sources:[value.source],assertions:[{id:'assertion-validation',sourceId:value.source.id,claimText:'Response validation',temporalClaim:'',passage:value.passage,status:'active',derivesFrom:[]}]}
  try{validateTimelineEvidence(candidate,[])}catch{return bad()}
  return value as unknown as MatchedPassage
}

export function TimelineSourceImport(props:Props){
  const user=useAuthStore(state=>state.user),signedIn=useAuthStore(state=>state.isAuthenticated)
  const [analysisId,setAnalysisId]=useState(''),[quote,setQuote]=useState(''),[claim,setClaim]=useState('')
  const [relation,setRelation]=useState<TimelineEvidenceLink['relation']>('supports')
  const [preview,setPreview]=useState<MatchedPassage|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('')
  const [messageIsError,setMessageIsError]=useState(false)
  const operation=useRef<AbortController|null>(null),version=useRef(0)
  const latest=useRef(props);latest.current=props
  const context=JSON.stringify([props.workspaceId,props.event,user,signedIn])
  const currentContext=useRef(context);currentContext.current=context
  function report(value:string,error=true){setMessage(value);setMessageIsError(error)}
  function cancel(){version.current++;operation.current?.abort();operation.current=null;setBusy(false)}
  useEffect(()=>{cancel();setPreview(null);setQuote('');setAnalysisId('');setClaim('');report('',false);return()=>{version.current++;operation.current?.abort()}},[context])
  useEffect(()=>{const changed=()=>{cancel();setPreview(null);setQuote('');setClaim('');report('Sign-in changed. Check the stored passage again.')};window.addEventListener('storage',changed);return()=>window.removeEventListener('storage',changed)},[])
  function invalidate(){cancel();setPreview(null);report('',false)}
  async function resolve(apply:boolean){
    cancel();report('',false)
    const auth=identity(),requestedContext=currentContext.current,requestVersion=version.current
    const sourceId=Number(analysisId),requestedQuote=quote,requestedClaim=claim.trim(),requestedRelation=relation
    if(!auth||!props.workspaceId||props.workspaceId==='1'){setPreview(null);report('Sign in and reopen a writable private timeline to import stored passages.');return}
    if(!/^\d+$/.test(analysisId)||!Number.isSafeInteger(sourceId)||sourceId<=0||!quote.trim()||quote.length>4000||!wellFormed(quote)){report('Enter a positive stored analysis ID and an exact quote of at most 4,000 characters.');return}
    if(apply&&(!preview||!requestedClaim||requestedClaim.length>4000||!wellFormed(requestedClaim))){report('Check the passage and enter separate assertion wording before importing.');return}
    const expected=apply?preview!.contentHash:undefined
    const controller=new AbortController();operation.current=controller;setBusy(true)
    const timeout=window.setTimeout(()=>controller.abort(),30000)
    const current=()=>!controller.signal.aborted&&version.current===requestVersion&&currentContext.current===requestedContext&&identity()?.stamp===auth.stamp
    try{
      const response=await fetch('/api/timeline-source-import',{method:'POST',redirect:'error',credentials:'same-origin',signal:controller.signal,headers:{...auth.headers,'Content-Type':'application/json','X-Workspace-ID':props.workspaceId},body:JSON.stringify({schemaVersion:'timeline-source-import-request.v1',workspaceId:props.workspaceId,analysisId:sourceId,quote:requestedQuote,...(expected?{expectedContentHash:expected}:{})})})
      if(!response.ok){void response.body?.cancel().catch(()=>{});throw new Error(({400:'This source or quote is not usable. Check for a complete extraction and one exact quote match.',401:'Sign in again before checking this private passage.',403:'You no longer have write access to this private workspace.',404:'This stored analysis is unavailable in the selected workspace.',412:'The stored text changed. Check the passage again before importing.',413:'The stored text or request exceeds the import limit.'} as Record<number,string>)[response.status]??'The stored passage could not be checked. Try again.')}
      const matched=await validateReply(await responseBody(response),props.workspaceId,sourceId,requestedQuote,expected)
      if(!current()){if(version.current===requestVersion&&currentContext.current===requestedContext){setPreview(null);setQuote('');setClaim('');report('Sign-in changed. Check the stored passage again.')}return}
      if(!apply){setPreview(matched);report('Matched to stored extraction. Enter separate assertion wording, then import.',false);return}
      const state=latest.current,data=state.evidence??emptyTimelineEvidence()
      validateTimelineEvidence(data,state.eventIds)
      if(!state.eventIds.includes(state.event.id))throw new Error('This event is no longer available.')
      const existingSource=data.sources.find(item=>item.id===matched.source.id)
      if(existingSource&&canonical(existingSource)!==canonical(matched.source))throw new Error('This recorded source ID already has different metadata. Resolve that source conflict before importing.')
      if(data.assertions.some(item=>item.passage.id===matched.passage.id))throw new Error('This passage is already imported. Use Link an existing assertion instead; the existing assertion was not changed.')
      const assertionId=`assertion-${crypto.randomUUID()}`
      const next:TimelineEvidence={...data,sources:existingSource?data.sources:[...data.sources,matched.source],assertions:[...data.assertions,{id:assertionId,sourceId:matched.source.id,claimText:requestedClaim,temporalClaim:'',passage:matched.passage,status:'active',derivesFrom:[]}],links:[...data.links,{id:`link-${crypto.randomUUID()}`,eventId:state.event.id,assertionId,relation:requestedRelation}]}
      validateTimelineEvidence(next,state.eventIds)
      if(!current())return
      if(!state.onChange(next))throw new Error('The passage was not imported. Check the evidence count and local timeline size limits.')
      setPreview(null);setQuote('');setClaim('');report('Stored passage imported',false)
    }catch(error){if(version.current===requestVersion&&currentContext.current===requestedContext){setPreview(null);report(controller.signal.aborted?'Passage check stopped. Check the passage again.':error instanceof Error?error.message:'The passage could not be imported.')}}
    finally{window.clearTimeout(timeout);if(operation.current===controller){operation.current=null;setBusy(false)}}
  }
  return <section aria-label="Import stored passage" className="space-y-3 rounded border p-3">
    <h4 className="font-semibold">Import a stored Content Research passage</h4>
    <p>Use a complete extraction you own in this private workspace. Matching records stored text at this moment; it does not verify source truth. Exported locators are recorded references, not authenticated receipts. Save the timeline after import to retain the reference in a new immutable revision.</p>
    <label className="block">Stored analysis ID<Input aria-label="Stored analysis ID" inputMode="numeric" value={analysisId} onChange={e=>{invalidate();setAnalysisId(e.target.value)}}/></label>
    <label className="block">Exact stored quote<Textarea aria-label="Exact stored quote" maxLength={4000} value={quote} onChange={e=>{invalidate();setQuote(e.target.value)}}/></label>
    <Button disabled={busy} variant="outline" onClick={()=>void resolve(false)}>Check stored passage</Button>
    {preview&&<div className="space-y-2 rounded border p-3"><p className="font-medium">Matched to stored extraction</p><a href={preview.source.url} target="_blank" rel="noopener noreferrer" className="break-all text-blue-600 underline">{preview.source.title}</a><blockquote className="whitespace-pre-wrap border-l-2 pl-3">{preview.passage.quote}</blockquote><p className="break-words text-xs">{preview.passage.locator}</p></div>}
    <label className="block">Imported assertion wording<Textarea aria-label="Imported assertion wording" maxLength={4000} disabled={busy} value={claim} onChange={e=>setClaim(e.target.value)}/></label>
    <label className="block">Imported assertion relation<select aria-label="Imported assertion relation" className="min-h-10 w-full rounded border bg-background p-2" disabled={busy} value={relation} onChange={e=>setRelation(e.target.value as TimelineEvidenceLink['relation'])}><option>supports</option><option>contradicts</option><option>context</option></select></label>
    <Button disabled={busy||!preview||!claim.trim()} onClick={()=>void resolve(true)}>Import matched passage</Button>
    {message&&<p role={messageIsError?'alert':'status'}>{message}</p>}
  </section>
}
