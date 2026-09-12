import { emptyTimelineSourceEvaluation, timelineSourceEvaluationBasis } from '../../../src/lib/timeline-source-evaluation'
import type { TimelineEvidence } from '../../../src/types/timeline-workspace'
import { test, expect } from '@playwright/test'
import { Miniflare } from 'miniflare'
import type { D1Database } from '@cloudflare/workers-types'
import { readFileSync } from 'node:fs'
import { onRequestPost } from '../../../functions/api/timelines'
import { onRequestPatch } from '../../../functions/api/timelines/[id]'
import { onRequestGet } from '../../../functions/api/timelines/[id]/objects'
import { canonicalJson, hashContent, WORKSPACE_SNAPSHOT_MAX_BYTES } from '../../../functions/api/_shared/timeline-artifact-contract'

const sql = (name:string) => readFileSync(new URL(`../../../schema/managed-migrations/${name}`,import.meta.url),'utf8').split('-- statement\n').slice(1).map(s=>s.trim())
const upgrade = sql('0012_timeline_workspace_snapshots.sql')
async function setup() {
  const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:{DB:'snapshot-test'}})
  const db=await mf.getD1Database('DB')
  try {
    for(const statement of [
      'CREATE TABLE users(id INTEGER PRIMARY KEY,user_hash TEXT UNIQUE,role TEXT NOT NULL,is_active INTEGER NOT NULL)',
      'CREATE TABLE workspaces(id TEXT PRIMARY KEY,owner_id INTEGER REFERENCES users(id),is_public INTEGER NOT NULL)',
      'CREATE TABLE workspace_members(id TEXT PRIMARY KEY,workspace_id TEXT REFERENCES workspaces(id),user_id INTEGER REFERENCES users(id),role TEXT NOT NULL)',
      "INSERT INTO users VALUES(1,'snapshot-owner-hash-0001','researcher',1)",
      "INSERT INTO workspaces VALUES('snapshot-private',1,0)",
      ...sql('0011_timeline_foundation.sql'),
    ]) await db.prepare(statement).run()
    return {mf,db}
  } catch(error) {await mf.dispose();throw error}
}
async function call(db:D1Database,method:string,id='',body?:unknown,key='snapshot-request-key01',etag?:string,revision?:string) {
  const request=new Request(`https://example.test/api/timelines${id?`/${id}`:''}${method==='GET'?'/objects':''}${revision?`?revisionId=${revision}`:''}`,{method,headers:{'X-User-Hash':'snapshot-owner-hash-0001','Content-Type':'application/json','Idempotency-Key':key,...(etag?{'If-Match':etag}:{})},...(body?{body:JSON.stringify(body)}:{})})
  const context={request,env:{DB:db},params:{id}} as never
  return await (method==='POST'?onRequestPost:method==='PATCH'?onRequestPatch:onRequestGet)(context)
}
const candidate={op:'put',objectId:'event:original',kind:'event-candidate.v1',payload:{title:'Original',description:null}}
const commit=(...changes:unknown[])=>({schemaVersion:'timeline-artifact-commit.v1',changes})
const snapshot=(title='Snapshot')=>({schemaVersion:'timeline-workspace.v1',exportedAt:'2026-09-11T00:00:00.000Z',source:{schemaVersion:'timeline-manual.v1',title},analystWorkspace:{mode:'basic',events:[],questions:[],hypotheses:[],narrative:{title,framing:'Original framing',question:'What happened?',intendedUse:'Analysis',scope:'Fixture',timezone:'UTC',dataThrough:'',chapters:[]}}})
function extractedSnapshot() {
  const original={eventDate:'2026-09',datePrecision:'month',title:'Original extraction',description:'Original wording',category:'event',importance:'normal'}
  return {...snapshot(),source:{schemaVersion:'timeline-analysis.v1',requestId:'snapshot:original-request',outcome:'events',article:{url:'https://example.test/article',title:'Original article',domain:'example.test'},events:[original],extraction:{contentSource:'supplied',sourceMode:'supplied',wordCount:100,quality:{version:'v1',score:90,accepted:true},fallbackAttempts:[]},model:{name:'fixture',status:'ok',rejectedEventCount:0}},analystWorkspace:{...snapshot().analystWorkspace,mode:'robust',presentation:'narrative',sortDirection:'oldest',events:[{...original,id:'event:stable.original',title:'Analyst revised title',origin:'source',assessment:'corroborated',analystNote:'Keep source wording',modified:true,original,narrativeIncluded:true,narrativeRole:'context',whyItMatters:'Context',transition:'Next',chapterId:'chapter:one',narrativeOrder:0}],questions:[{id:'question:one',afterEventId:'event:stable.original',question:'Why?',status:'open',answer:'',sources:[{id:'source:one',url:'https://example.test/source',title:'Citation'}]}],hypotheses:[{id:'hypothesis:one',beforeEventId:'event:stable.original',hypothesis:'Possible cause',rationale:'Tentative',origin:'ai'}],narrative:{...snapshot().analystWorkspace.narrative,chapters:[{id:'chapter:one',title:'Opening',claim:'Bounded claim'}]}}}
}
const put=(payload:unknown=snapshot())=>({op:'put',objectId:'browser-workspace',kind:'timeline-workspace.v1',payload})
async function create(db:D1Database) {
  const response=await call(db,'POST','',{schemaVersion:'timeline-artifact-create.v1',workspaceId:'snapshot-private',title:'Fixture'})
  expect(response.status).toBe(201)
  return {body:await response.json() as any,etag:response.headers.get('etag')!}
}
async function state(db:D1Database) {
  const result:Record<string,unknown>={}
  const tables=(await db.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name LIKE 'timeline_%' ORDER BY name").all<{name:string}>()).results
  for(const {name} of tables) result[name]=(await db.prepare(`SELECT * FROM ${name} ORDER BY rowid`).all()).results
  return result
}

test.describe('complete workspace snapshot actual D1 @smoke',()=>{
  test('source evaluation revisions preserve earlier factors and reject malformed or oversized evaluation writes atomically', async () => {
    const { mf, db } = await setup()
    try {
      await db.batch(upgrade.map(s => db.prepare(s)))
      const created = await create(db), id = created.body.artifactId
      const evidence: TimelineEvidence = { schemaVersion: 'timeline-evidence.v1', sources: [{ id: 's1', url: 'https://source.example/', title: 'Synthetic report', publisher: 'Desk' }], assertions: [{ id: 'a1', sourceId: 's1', claimText: 'A source account', temporalClaim: '', passage: { id: 'p1', quote: 'An observation', locator: 'paragraph 1' }, status: 'active', derivesFrom: [] }], links: [{ id: 'l1', eventId: 'event:stable.original', assertionId: 'a1', relation: 'supports' }], reviews: [] }
      evidence.assertions[0].evaluation = emptyTimelineSourceEvaluation(timelineSourceEvaluationBasis(evidence, 'a1'), '2026-09-12T00:00:00Z')
      evidence.assertions[0].evaluation.access = { value: 'direct', rationale: 'The author reports being present.' }
      const full = { ...extractedSnapshot(), analystWorkspace: { ...extractedSnapshot().analystWorkspace, evidence } }
      const first = await call(db, 'PATCH', id, commit(put(full)), 'evaluation-first-key', created.etag)
      expect(first.status).toBe(200)
      const revision = (await first.json() as any).revisionId
      const historical = await (await call(db, 'GET', id, undefined, undefined, undefined, revision)).text()
      const changed = structuredClone(full)
      changed.analystWorkspace.evidence.assertions[0].evaluation!.access = { value: 'indirect', rationale: 'A correction identifies an intermediary.' }
      const second = await call(db, 'PATCH', id, commit(put(changed)), 'evaluation-next-key', first.headers.get('etag')!)
      expect(second.status).toBe(200)
      expect(await (await call(db, 'GET', id, undefined, undefined, undefined, revision)).text()).toBe(historical)
      expect(JSON.parse(historical).objects[0].payload.analystWorkspace.evidence.assertions[0].evaluation.access.value).toBe('direct')
      expect((await (await call(db, 'GET', id)).json() as any).objects[0].payload.analystWorkspace.evidence).toEqual(changed.analystWorkspace.evidence)
      const before = await state(db)
      const malformed = structuredClone(changed)
      ;(malformed.analystWorkspace.evidence.assertions[0].evaluation as any).verified = true
      expect((await call(db, 'PATCH', id, commit(put(malformed)), 'evaluation-bad-key1', second.headers.get('etag')!)).status).toBe(400)
      expect(await state(db)).toEqual(before)
      const oversized = structuredClone(changed)
      for (const key of ['framing','question','intendedUse','scope','title'] as const) oversized.analystWorkspace.narrative[key] = 'é'.repeat(7000)
      expect((await call(db, 'PATCH', id, commit(put(oversized)), 'evaluation-large-key', second.headers.get('etag')!)).status).toBe(413)
      expect(await state(db)).toEqual(before)
      for (const key of ['framing','question','intendedUse','scope','title'] as const) oversized.analystWorkspace.narrative[key] = 'x'.repeat(10000)
      oversized.analystWorkspace.narrative.chapters[0].claim = ''
      const padding = WORKSPACE_SNAPSHOT_MAX_BYTES + 1 - new TextEncoder().encode(canonicalJson(oversized)).byteLength
      expect(padding).toBeGreaterThan(0); expect(padding).toBeLessThan(10000)
      oversized.analystWorkspace.narrative.chapters[0].claim = 'x'.repeat(padding)
      expect(new TextEncoder().encode(JSON.stringify(commit(put(oversized)))).byteLength).toBeLessThan(65536)
      expect((await call(db, 'PATCH', id, commit(put(oversized)), 'evaluation-canonical-large', second.headers.get('etag')!)).status).toBe(400)
      expect(await state(db)).toEqual(before)
    } finally { await mf.dispose() }
  })

  test('judgment revisions retain prior dissent snapshots and reject dangling current references atomically',async()=>{
    const {mf,db}=await setup()
    try {
      await db.batch(upgrade.map(s=>db.prepare(s)))
      const created=await create(db),id=created.body.artifactId
      const analysis=JSON.parse(readFileSync(new URL('../../fixtures/timeline-judgment-snapshot.json',import.meta.url),'utf8'))
      analysis.judgments[0].eventRefs=['event:stable.original']
      analysis.judgments[0].contraryEvidenceRefs=[]
      analysis.reviews[0].basis=canonicalJson(analysis.judgments[0])
      const full={...extractedSnapshot(),analystWorkspace:{...extractedSnapshot().analystWorkspace,analysis}}
      const first=await call(db,'PATCH',id,commit(put(full)),'judgment-first-key01',created.etag)
      expect(first.status).toBe(200)
      const firstBody=await first.json() as any
      const firstRead=await (await call(db,'GET',id,undefined,undefined,undefined,firstBody.revisionId)).text()
      const changed=structuredClone(full)
      changed.analystWorkspace.analysis.judgments[0].claim='The separate-meetings explanation now needs testing.'
      changed.analystWorkspace.analysis.judgments[0].changeReason='Retained dissent prompts a revised interpretation.'
      changed.analystWorkspace.analysis.judgments[0].updatedAt='2026-09-11T14:00:00Z'
      const second=await call(db,'PATCH',id,commit(put(changed)),'judgment-second-key01',first.headers.get('etag')!)
      expect(second.status).toBe(200)
      expect(await (await call(db,'GET',id,undefined,undefined,undefined,firstBody.revisionId)).text()).toBe(firstRead)
      expect(JSON.parse(firstRead).objects[0].contentHash).toBe(await hashContent({schemaVersion:'timeline-workspace.v1',tombstone:false,payload:full}))
      const latest=await (await call(db,'GET',id)).json() as any
      expect(latest.objects[0].payload.analystWorkspace.analysis).toEqual(changed.analystWorkspace.analysis)
      expect(latest.objects[0].payload.analystWorkspace.analysis.reviews).toEqual(analysis.reviews)
      expect(JSON.parse(analysis.reviews[0].basis).claim).toBe(analysis.judgments[0].claim)
      const invalid=structuredClone(changed)
      invalid.analystWorkspace.analysis.judgments[0].status='withdrawn'
      invalid.analystWorkspace.analysis.judgments[0].eventRefs=['event:missing']
      const before=await state(db)
      expect((await call(db,'PATCH',id,commit(put(invalid)),'judgment-invalid-key1',second.headers.get('etag')!)).status).toBe(400)
      expect(await state(db)).toEqual(before)
    } finally {await mf.dispose()}
  })

  test('source assertions and contrary passage snapshots survive immutable revisions and reject dangling provenance',async()=>{
    const {mf,db}=await setup()
    try {
      await db.batch(upgrade.map(s=>db.prepare(s)))
      const created=await create(db),id=created.body.artifactId
      const full={...extractedSnapshot(),analystWorkspace:{...extractedSnapshot().analystWorkspace,evidence:{"schemaVersion":"timeline-evidence.v1","sources":[{"id":"source:first","url":"https://example.test/first","title":"First report","publisher":"Fixture desk","publishedAt":"2026-09-01T10:00:00Z","retrievedAt":"2026-09-11T00:00:00Z"},{"id":"source:second","url":"https://other.example.test/second","title":"Conflicting report","publisher":"Other fixture desk"}],"assertions":[{"id":"assertion:first","sourceId":"source:first","claimText":"The source reported the meeting occurred in September.","temporalClaim":"September 2026","passage":{"id":"passage:first","quote":"The meeting took place in September.","locator":"paragraph 2"},"status":"active","derivesFrom":[],"reportedAt":"2026-09-01T10:00:00Z"},{"id":"assertion:contrary","sourceId":"source:second","claimText":"The second source reported October instead.","temporalClaim":"October 2026","passage":{"id":"passage:contrary","quote":"The meeting occurred in October.","locator":"paragraph 4"},"status":"active","derivesFrom":[]}],"links":[{"id":"link:support","eventId":"event:stable.original","assertionId":"assertion:first","relation":"supports"},{"id":"link:contrary","eventId":"event:stable.original","assertionId":"assertion:contrary","relation":"contradicts"}],"reviews":[]}}}
      const first=await call(db,'PATCH',id,commit(put(full)),'evidence-first-key01',created.etag)
      expect(first.status).toBe(200)
      const firstBody=await first.json() as any
      const firstRead=await (await call(db,'GET',id,undefined,undefined,undefined,firstBody.revisionId)).text()
      const changed=structuredClone(full)
      changed.analystWorkspace.evidence.assertions[0].claimText='Corrected transcription, retained in a new snapshot.'
      changed.analystWorkspace.evidence.assertions[0].passage.quote='Corrected wording.'
      const second=await call(db,'PATCH',id,commit(put(changed)),'evidence-second-key01',first.headers.get('etag')!)
      expect(second.status).toBe(200)
      expect(await (await call(db,'GET',id,undefined,undefined,undefined,firstBody.revisionId)).text()).toBe(firstRead)
      const old=JSON.parse(firstRead).objects[0]
      expect(old.payload.analystWorkspace.evidence).toEqual({"schemaVersion":"timeline-evidence.v1","sources":[{"id":"source:first","url":"https://example.test/first","title":"First report","publisher":"Fixture desk","publishedAt":"2026-09-01T10:00:00Z","retrievedAt":"2026-09-11T00:00:00Z"},{"id":"source:second","url":"https://other.example.test/second","title":"Conflicting report","publisher":"Other fixture desk"}],"assertions":[{"id":"assertion:first","sourceId":"source:first","claimText":"The source reported the meeting occurred in September.","temporalClaim":"September 2026","passage":{"id":"passage:first","quote":"The meeting took place in September.","locator":"paragraph 2"},"status":"active","derivesFrom":[],"reportedAt":"2026-09-01T10:00:00Z"},{"id":"assertion:contrary","sourceId":"source:second","claimText":"The second source reported October instead.","temporalClaim":"October 2026","passage":{"id":"passage:contrary","quote":"The meeting occurred in October.","locator":"paragraph 4"},"status":"active","derivesFrom":[]}],"links":[{"id":"link:support","eventId":"event:stable.original","assertionId":"assertion:first","relation":"supports"},{"id":"link:contrary","eventId":"event:stable.original","assertionId":"assertion:contrary","relation":"contradicts"}],"reviews":[]})
      expect(old.contentHash).toBe(await hashContent({schemaVersion:'timeline-workspace.v1',tombstone:false,payload:full}))
      const latest=await (await call(db,'GET',id)).json() as any
      expect(latest.objects[0].payload.analystWorkspace.evidence).toEqual(changed.analystWorkspace.evidence)
      const invalid=structuredClone(changed)
      invalid.analystWorkspace.evidence.assertions[0].derivesFrom=['assertion:missing']
      const before=await state(db)
      expect((await call(db,'PATCH',id,commit(put(invalid)),'evidence-invalid-key1',second.headers.get('etag')!)).status).toBe(400)
      expect(await state(db)).toEqual(before)
    } finally {await mf.dispose()}
  })

  test('populated 0011 upgrade preserves every history byte and rolls back a failed rebuild',async()=>{
    const {mf,db}=await setup()
    try {
      const created=await create(db)
      const saved=await call(db,'PATCH',created.body.artifactId,commit(candidate),'snapshot-candidate-key',created.etag)
      expect(saved.status).toBe(200)
      const savedBody=await saved.json() as any
      const removed=await call(db,'PATCH',created.body.artifactId,commit({op:'delete',objectId:candidate.objectId}),'snapshot-delete-key01',saved.headers.get('etag')!)
      expect(removed.status).toBe(200)
      const before=await state(db)
      const triggers=(await db.prepare("SELECT name,sql FROM sqlite_schema WHERE type='trigger' ORDER BY name").all()).results
      const indexes=(await db.prepare("SELECT name,tbl_name,sql FROM sqlite_schema WHERE type='index' ORDER BY name").all()).results
      const beforeRead=await (await call(db,'GET',created.body.artifactId,undefined,undefined,undefined,savedBody.revisionId)).text()
      // Failure occurs after the originals have been dropped and recreated.
      const injected=[...upgrade.slice(0,8),'INSERT INTO missing_migration_failure VALUES(1)',...upgrade.slice(8)]
      await expect(db.batch(injected.map(s=>db.prepare(s)))).rejects.toThrow()
      expect(await state(db)).toEqual(before)
      expect((await db.prepare("SELECT name,sql FROM sqlite_schema WHERE type='trigger' ORDER BY name").all()).results).toEqual(triggers)
      await db.batch(upgrade.map(s=>db.prepare(s)))
      expect(await state(db)).toEqual(before)
      const afterTriggers=(await db.prepare("SELECT name,sql FROM sqlite_schema WHERE type='trigger' AND name<>'timeline_version_kind' ORDER BY name").all()).results
      expect(afterTriggers).toEqual(triggers)
      expect((await db.prepare("SELECT name,tbl_name,sql FROM sqlite_schema WHERE type='index' ORDER BY name").all()).results).toEqual(indexes)
      expect((await db.prepare('PRAGMA foreign_key_check').all()).results).toEqual([])
      expect(await (await call(db,'GET',created.body.artifactId,undefined,undefined,undefined,savedBody.revisionId)).text()).toBe(beforeRead)
      await expect(db.prepare('INSERT OR REPLACE INTO timeline_object_versions SELECT * FROM timeline_object_versions LIMIT 1').run()).rejects.toThrow(/timeline_immutable|timeline_object_deleted/)
      await expect(db.prepare('DELETE FROM timeline_objects').run()).rejects.toThrow(/timeline_immutable/)
    } finally {await mf.dispose()}
  })

  test('save/reopen pinned full snapshot, hashes, replay, stale head and kind protection',async()=>{
    const {mf,db}=await setup()
    try {
      await db.batch(upgrade.map(s=>db.prepare(s)))
      const created=await create(db),id=created.body.artifactId
      const full=extractedSnapshot()
      const first=await call(db,'PATCH',id,commit(put(full)),'snapshot-first-key01',created.etag)
      expect(first.status).toBe(200)
      const raw=await first.text(),body=JSON.parse(raw),etag=first.headers.get('etag')!
      const second=await call(db,'PATCH',id,commit(put(snapshot('Second'))),'snapshot-second-key1',etag)
      expect(second.status).toBe(200)
      const page=await (await call(db,'GET',id,undefined,undefined,undefined,body.revisionId)).json() as any
      expect(page.objects[0].kind).toBe('timeline-workspace.v1')
      expect(page.objects[0].payload).toEqual(full)
      expect(page.objects[0].contentHash).toBe(await hashContent({schemaVersion:'timeline-workspace.v1',tombstone:false,payload:full}))
      const latest=await (await call(db,'GET',id)).json() as any
      expect(latest.objects[0].payload).toEqual(snapshot('Second'))
      const retry=await call(db,'PATCH',id,commit(put(full)),'snapshot-first-key01',created.etag)
      expect(retry.status).toBe(200);expect(await retry.text()).toBe(raw);expect(retry.headers.get('etag')).toBe(etag)
      expect((await call(db,'PATCH',id,commit(put()),'snapshot-stale-key01',etag)).status).toBe(412)
      const before=await state(db)
      expect((await call(db,'PATCH',id,commit({...candidate,objectId:'browser-workspace'}),'snapshot-kind-key001',second.headers.get('etag')!)).status).toBe(409)
      expect(await state(db)).toEqual(before)
      await expect(db.prepare("INSERT INTO timeline_object_versions SELECT workspace_id,artifact_id,object_id,'bad-kind-version','event-candidate.v1',tombstone,payload_json,content_hash,created_by,created_at FROM timeline_object_versions LIMIT 1").run()).rejects.toThrow(/timeline_kind_mismatch/)
      await expect(db.prepare('UPDATE timeline_object_versions SET payload_json=payload_json').run()).rejects.toThrow(/timeline_immutable/)
    } finally {await mf.dispose()}
  })

  test('malformed/oversized snapshots fail before writes and malformed stored payload fails closed',async()=>{
    const {mf,db}=await setup()
    try {
      await db.batch(upgrade.map(s=>db.prepare(s)))
      const created=await create(db),id=created.body.artifactId,before=await state(db)
      for(const payload of [{...snapshot(),unexpected:true},{...snapshot(),analystWorkspace:{}},{...snapshot(),source:{schemaVersion:'timeline-manual.v1',title:'x'.repeat(62000)}}]) {
        expect((await call(db,'PATCH',id,commit(put(payload)),'snapshot-invalid-key',created.etag)).status).toBe(400)
        expect(await state(db)).toEqual(before)
      }
      const good=await call(db,'PATCH',id,commit(put()),'snapshot-valid-key01',created.etag)
      expect(good.status).toBe(200)
      // Simulate preexisting corruption with a narrowly removed guard in this disposable DB.
      await db.prepare('DROP TRIGGER timeline_object_versions_immutable_update').run()
      await db.prepare("UPDATE timeline_object_versions SET payload_json='{}'").run()
      const corrupt=await call(db,'GET',id)
      expect(corrupt.status).toBe(503)
      expect((await corrupt.json() as any).error.code).toBe('datastore_unavailable')
    } finally {await mf.dispose()}
  })

  test('60 KiB canonical UTF-8 boundary is independent of valid field lengths and wire limit',async()=>{
    const {mf,db}=await setup()
    try {
      await db.batch(upgrade.map(s=>db.prepare(s)))
      const created=await create(db)
      const payload=snapshot()
      for(const field of ['framing','question','intendedUse','scope','title'] as const) payload.analystWorkspace.narrative[field]='x'.repeat(10000)
      payload.analystWorkspace.narrative.chapters=[{id:'boundary',title:'Boundary',claim:''}] as any
      const current=new TextEncoder().encode(canonicalJson(payload)).byteLength
      // Fill using multibyte text while keeping each codec string below 10000 characters.
      const needed=WORKSPACE_SNAPSHOT_MAX_BYTES-current
      ;(payload.analystWorkspace.narrative.chapters[0] as any).claim='é'.repeat(Math.floor(needed/2))+(needed%2?'x':'')
      expect(new TextEncoder().encode(canonicalJson(payload)).byteLength).toBe(WORKSPACE_SNAPSHOT_MAX_BYTES)
      const valid=await call(db,'PATCH',created.body.artifactId,commit(put(payload)),'snapshot-boundary-key',created.etag)
      expect(valid.status).toBe(200)
      ;(payload.analystWorkspace.narrative.chapters[0] as any).claim+='x'
      const before=await state(db)
      expect((await call(db,'PATCH',created.body.artifactId,commit(put(payload)),'snapshot-too-big-key1',valid.headers.get('etag')!)).status).toBe(400)
      expect(await state(db)).toEqual(before)
    } finally {await mf.dispose()}
  })
})
