import { test, expect } from '@playwright/test'
import { Miniflare } from 'miniflare'
import type { D1Database } from '@cloudflare/workers-types'
import { readFileSync } from 'node:fs'
import { onRequestPost as createRoute } from '../../../functions/api/timelines'
import { onRequestPatch as commitRoute,onRequestGet as metadataRoute } from '../../../functions/api/timelines/[id]'
import { onRequestGet as objectsRoute } from '../../../functions/api/timelines/[id]/objects'
import { onRequestGet as historyRoute } from '../../../functions/api/timelines/[id]/revisions'
import { onRequestGet as revisionRoute } from '../../../functions/api/timelines/[id]/revisions/[revisionId]'
import { hashContent,validArtifactDocument } from '../../../functions/api/_shared/timeline-artifact-contract'

const migration = readFileSync(new URL('../../../schema/managed-migrations/0011_timeline_foundation.sql', import.meta.url), 'utf8')
// Deliberately bounded schema-compatible prerequisites, not a full production migration rehearsal.
const prerequisites = [
  'CREATE TABLE users(id INTEGER PRIMARY KEY,user_hash TEXT UNIQUE,role TEXT NOT NULL,is_active INTEGER NOT NULL)',
  'CREATE TABLE workspaces(id TEXT PRIMARY KEY,owner_id INTEGER NOT NULL,is_public INTEGER NOT NULL,FOREIGN KEY(owner_id) REFERENCES users(id))',
  'CREATE TABLE workspace_members(id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,user_id INTEGER NOT NULL,role TEXT NOT NULL,FOREIGN KEY(workspace_id) REFERENCES workspaces(id),FOREIGN KEY(user_id) REFERENCES users(id))',
]
async function database() {
  const mf = new Miniflare({ modules: true, script: 'export default { fetch() { return new Response("ok") } }', d1Databases: { DB: 'timeline-artifact-test' } })
  const db = await mf.getD1Database('DB')
  try {
    for (const sql of prerequisites) await db.prepare(sql).run()
    await db.prepare("INSERT INTO users VALUES (1,'human-owner-hash-0001','researcher',1),(2,'human-editor-hash-002','researcher',1),(3,'human-viewer-hash-003','researcher',1),(4,'human-other-hash-0004','researcher',1),(5,'guest-fixture-hash-05','guest',1),(6,'service-fixture-hash6','service',1),(7,'inactive-fixture-hash','researcher',0)").run()
    await db.prepare("INSERT INTO workspaces VALUES ('workspace-a',1,0),('workspace-b',4,0),('1',1,0),('workspace-public',1,1)").run()
    await db.prepare("INSERT INTO workspace_members VALUES ('editor','workspace-a',2,'EDITOR'),('viewer','workspace-a',3,'VIEWER')").run()
    for (const statement of migration.split('-- statement\n').slice(1)) await db.prepare(statement.trim()).run()
    return { mf, db }
  } catch (error) { await mf.dispose(); throw error }
}
async function root(db: D1Database, id = 'artifact-a', workspace = 'workspace-a', user = 1) {
  await db.batch([
    db.prepare('INSERT INTO timeline_artifacts VALUES (?,?,?,?,?)').bind(workspace,id,'Fixture',user,'2026-09-11T00:00:00Z'),
    db.prepare('INSERT INTO timeline_revisions VALUES (?,?,?,0,NULL,0,0,?,?,?)').bind(workspace,id,'revision-root','0'.repeat(64),user,'2026-09-11T00:00:00Z'),
    db.prepare("INSERT INTO timeline_lineage_branches VALUES (?,?,'main','revision-root')").bind(workspace,id),
  ])
}
const hashFor=(user:number)=>({1:'human-owner-hash-0001',2:'human-editor-hash-002',3:'human-viewer-hash-003',4:'human-other-hash-0004',5:'guest-fixture-hash-05',6:'service-fixture-hash6',7:'inactive-fixture-hash'}[user]!)
async function call(db:D1Database,path:string,method='GET',body?:unknown,key?:string,etag?:string,user=1):Promise<Response>{
  const url=new URL(`https://researchtools.example/api/timelines${path}`)
  const parts=url.pathname.split('/').filter(Boolean)
  const id=parts[2],revisionId=parts[4]
  const request=new Request(url,{method,headers:{'X-User-Hash':hashFor(user),'Content-Type':'application/json',...(key?{'Idempotency-Key':key}:{}),...(etag?{'If-Match':etag}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})})
  const context={request,env:{DB:db},params:{id,revisionId}} as never
  if(method==='POST')return await createRoute(context)
  if(method==='PATCH')return await commitRoute(context)
  if(parts[3]==='objects')return await objectsRoute(context)
  if(parts[3]==='revisions')return await (revisionId?revisionRoute(context):historyRoute(context))
  return await metadataRoute(context)
}
const createInput={schemaVersion:'timeline-artifact-create.v1',workspaceId:'workspace-a',title:'Private fixture'}
const put=(objectId='event:a',title='Candidate')=>({op:'put',objectId,kind:'event-candidate.v1',payload:{title,description:null,eventDate:'2026-09',datePrecision:'month'}})
const commitInput=(changes:unknown[])=>({schemaVersion:'timeline-artifact-commit.v1',changes})
async function create(db:D1Database,key='create-fixture-0001'){
  const response=await call(db,'','POST',createInput,key)
  expect(response.status).toBe(201)
  const body=await response.json() as any
  expect(validArtifactDocument(body)).toBe(true)
  return {body,etag:response.headers.get('ETag')!}
}
async function counts(db:D1Database){
  const result:Record<string,number>={}
  for(const table of ['timeline_artifacts','timeline_revisions','timeline_revision_parents','timeline_objects','timeline_object_versions','timeline_revision_objects','timeline_revision_changes','timeline_idempotency']) result[table]=(await db.prepare(`SELECT count(*) AS n FROM ${table}`).first<{n:number}>())!.n
  return result
}
function intercept(db:D1Database,run:(statements:any[])=>Promise<any>):D1Database{
  return {prepare:(sql:string)=>db.prepare(sql),batch:run} as unknown as D1Database
}

test.describe('durable timeline actual D1 @smoke', () => {
  test('migration preserves prerequisites and enforces root, transaction authorization and immutable publication', async () => {
    const { mf, db } = await database()
    try {
      expect((await db.prepare('SELECT count(*) AS n FROM users').first<{ n: number }>())?.n).toBe(7)
      await root(db)
      await expect(db.prepare("UPDATE timeline_revisions SET content_hash=? WHERE id='revision-root'").bind('1'.repeat(64)).run()).rejects.toThrow(/timeline_immutable/)
      await expect(db.prepare("INSERT OR REPLACE INTO timeline_revisions SELECT workspace_id,artifact_id,id,sequence,expected_head,object_count,change_count,?,created_by,created_at FROM timeline_revisions").bind('1'.repeat(64)).run()).rejects.toThrow(/timeline_immutable/)
      await expect(db.prepare("INSERT INTO timeline_revision_parents VALUES ('workspace-a','artifact-a','revision-root','revision-root',0)").run()).rejects.toThrow()
      for (const [workspace,user] of [['workspace-a',3],['workspace-b',1],['workspace-public',1],['1',1]] as const) {
        await expect(root(db,`denied-${workspace}-${user}`,workspace,user)).rejects.toThrow(/timeline_authorization_denied/)
        expect((await db.prepare('SELECT count(*) AS n FROM timeline_artifacts WHERE id=?').bind(`denied-${workspace}-${user}`).first<{ n: number }>())?.n).toBe(0)
      }
    } finally { await mf.dispose() }
  })

  test('concurrent create and commit retries replay exact status/body/ETag after later changes',async()=>{
    const {mf,db}=await database()
    try{
      const responses=await Promise.all([call(db,'','POST',createInput,'concurrent-create-001'),call(db,'','POST',createInput,'concurrent-create-001')])
      const raw=await responses[0].text()
      expect(responses.map(r=>r.status)).toEqual([201,201])
      expect(await responses[1].text()).toBe(raw)
      expect(responses[1].headers.get('etag')).toBe(responses[0].headers.get('etag'))
      const artifact=JSON.parse(raw),etag=responses[0].headers.get('etag')!
      const firstInput=commitInput([put()])
      const updates=await Promise.all([call(db,`/${artifact.artifactId}`,'PATCH',firstInput,'concurrent-commit-001',etag),call(db,`/${artifact.artifactId}`,'PATCH',firstInput,'concurrent-commit-001',etag)])
      const updatedRaw=await updates[0].text()
      expect(updates.map(r=>r.status)).toEqual([200,200])
      expect(await updates[1].text()).toBe(updatedRaw)
      const updated=JSON.parse(updatedRaw),updatedEtag=updates[0].headers.get('etag')!
      expect(validArtifactDocument(updated)).toBe(true)
      const later=await call(db,`/${artifact.artifactId}`,'PATCH',commitInput([put('event:a','Revised')]),'later-commit-key-01',updatedEtag)
      expect(later.status).toBe(200)
      const replay=await call(db,`/${artifact.artifactId}`,'PATCH',firstInput,'concurrent-commit-001',etag)
      expect(replay.status).toBe(200);expect(await replay.text()).toBe(updatedRaw);expect(replay.headers.get('etag')).toBe(updatedEtag)
      const createReplay=await call(db,'','POST',createInput,'concurrent-create-001')
      expect(await createReplay.text()).toBe(raw);expect(createReplay.headers.get('etag')).toBe(etag)
      expect((await call(db,`/${artifact.artifactId}`,'PATCH',firstInput,'concurrent-commit-001',updatedEtag)).status).toBe(409)
      expect((await call(db,`/${artifact.artifactId}`,'PATCH',commitInput([put('event:a','Different')]),'concurrent-commit-001',etag)).status).toBe(409)
      expect((await call(db,'','POST',{...createInput,title:'Different'},'concurrent-create-001')).status).toBe(409)
      expect((await counts(db)).timeline_revisions).toBe(3)
      expect((await counts(db)).timeline_objects).toBe(1)
    }finally{await mf.dispose()}
  })

  test('concurrent distinct keys at one expected head leave exactly one complete winner',async()=>{
    const {mf,db}=await database()
    try{
      const {body,etag}=await create(db)
      const responses=await Promise.all([call(db,`/${body.artifactId}`,'PATCH',commitInput([put('event:one')]),'race-writer-key-01',etag),call(db,`/${body.artifactId}`,'PATCH',commitInput([put('event:two')]),'race-writer-key-02',etag)])
      expect(responses.map(r=>r.status).sort()).toEqual([200,412])
      expect(await counts(db)).toEqual({timeline_artifacts:1,timeline_revisions:2,timeline_revision_parents:1,timeline_objects:1,timeline_object_versions:1,timeline_revision_objects:1,timeline_revision_changes:1,timeline_idempotency:2})
    }finally{await mf.dispose()}
  })

  test('failures before versions, manifest, head or replay publication roll back every inserted row',async()=>{
    const {mf,db}=await database()
    try{
      const {body,etag}=await create(db)
      const baseline=await counts(db)
      for(const position of [1,3,5,7,8]){
        const faulty=intercept(db,async(statements)=>{
          const fail=db.prepare('INSERT INTO timeline_artifacts SELECT * FROM timeline_artifacts WHERE id=?').bind(body.artifactId)
          return await db.batch([...statements.slice(0,position),fail,...statements.slice(position)])
        })
        const response=await call(faulty,`/${body.artifactId}`,'PATCH',commitInput([put()]),`failure-fixture-${position.toString().padStart(2,'0')}`,etag)
        expect(response.status).toBe(503)
        expect(await response.text()).not.toMatch(/SQL|INSERT|timeline_immutable/)
        expect(await counts(db)).toEqual(baseline)
        expect((await call(db,`/${body.artifactId}`)).headers.get('etag')).toBe(etag)
      }
    }finally{await mf.dispose()}
  })

  test('every read/replay is authorized and transaction guards reject revoked membership, user role or workspace privacy',async()=>{
    const {mf,db}=await database()
    try{
      const {body,etag}=await create(db)
      expect((await call(db,`/${body.artifactId}`,'GET',undefined,undefined,undefined,3)).status).toBe(200)
      expect((await call(db,`/${body.artifactId}`,'PATCH',commitInput([put()]),'viewer-denied-key1',etag,3)).status).toBe(404)
      expect((await call(db,`/${body.artifactId}`,'GET',undefined,undefined,undefined,4)).status).toBe(404)
      for(const user of [5,6,7])expect((await call(db,'','POST',createInput,`denied-principal-${user}`,undefined,user)).status).toBe(403)
      const baseline=await counts(db)
      for(const [revoke,restore] of [
        ["UPDATE workspace_members SET role='VIEWER' WHERE id='editor'","UPDATE workspace_members SET role='EDITOR' WHERE id='editor'"],
        ["UPDATE users SET is_active=0 WHERE id=2","UPDATE users SET is_active=1 WHERE id=2"],
        ["UPDATE users SET role=' ' WHERE id=2","UPDATE users SET role='researcher' WHERE id=2"],
        ["UPDATE workspaces SET is_public=1 WHERE id='workspace-a'","UPDATE workspaces SET is_public=0 WHERE id='workspace-a'"],
      ]){
        const revoked=intercept(db,async statements=>{await db.prepare(revoke).run();return await db.batch(statements)})
        expect((await call(revoked,`/${body.artifactId}`,'PATCH',commitInput([put()]),'transaction-auth-001',etag,2)).status).toBe(403)
        expect(await counts(db)).toEqual(baseline)
        await db.prepare(restore).run()
      }
      const success=await call(db,`/${body.artifactId}`,'PATCH',commitInput([put()]),'editor-success-001',etag,2)
      expect(success.status).toBe(200)
      await db.prepare("UPDATE workspace_members SET role='VIEWER' WHERE id='editor'").run()
      expect((await call(db,`/${body.artifactId}`,'PATCH',commitInput([put()]),'editor-success-001',etag,2)).status).toBe(404)
      await db.prepare("UPDATE workspaces SET is_public=1 WHERE id='workspace-a'").run()
      expect((await call(db,`/${body.artifactId}`)).status).toBe(404)
      expect((await call(db,'','POST',createInput,'create-fixture-0001')).status).toBe(403)
    }finally{await mf.dispose()}
  })

  test('history and object cursors remain pinned after edits; foreign revisions/cursors fail',async()=>{
    const {mf,db}=await database()
    try{
      const {body,etag}=await create(db)
      const first=await call(db,`/${body.artifactId}`,'PATCH',commitInput([put('event:a'),put('event:b')]),'pagination-first-01',etag)
      const rev1=await first.json() as any
      const page=await (await call(db,`/${body.artifactId}/objects?limit=1`)).json() as any
      expect(page.schemaVersion).toBe('timeline-object-page.v1');expect(page.objects[0].objectId).toBe('event:a')
      const history=await (await call(db,`/${body.artifactId}/revisions?limit=1`)).json() as any
      expect(history.schemaVersion).toBe('timeline-revision-page.v1')
      expect((await call(db,`/${body.artifactId}`,'PATCH',commitInput([put('event:aa')]),'pagination-second1',first.headers.get('etag')!)).status).toBe(200)
      const secondPage=await (await call(db,`/${body.artifactId}/objects?cursor=${page.nextCursor}&limit=1`)).json() as any
      expect(secondPage.revisionId).toBe(rev1.revisionId);expect(secondPage.objects.map((o:any)=>o.objectId)).toEqual(['event:b'])
      const historyNext=await (await call(db,`/${body.artifactId}/revisions?cursor=${history.nextCursor}`)).json() as any
      expect(historyNext.headRevisionId).toBe(rev1.revisionId);expect(historyNext.revisions.map((r:any)=>r.sequence)).toEqual([0])
      const detail=await (await call(db,`/${body.artifactId}/revisions/${rev1.revisionId}`)).json() as any
      expect(detail.schemaVersion).toBe('timeline-revision.v1');expect(await hashContent(detail.manifest)).toBe(detail.contentHash)
      expect(detail.parentRevisionIds).toEqual([body.revisionId]);expect(detail.changes).toHaveLength(2)
      const other=await create(db,'another-artifact-01')
      expect((await call(db,`/${other.body.artifactId}/objects?revisionId=${rev1.revisionId}`)).status).toBe(404)
      expect((await call(db,`/${other.body.artifactId}/objects?cursor=${page.nextCursor}`)).status).toBe(400)
      expect((await call(db,`/${other.body.artifactId}/revisions?cursor=${history.nextCursor}`)).status).toBe(400)
      expect((await call(db,`/${body.artifactId}/objects?limit=101`)).status).toBe(400)
    }finally{await mf.dispose()}
  })

  test('tombstones preserve history and cannot be resurrected, including reuse of an old version',async()=>{
    const {mf,db}=await database()
    try{
      const {body,etag}=await create(db)
      const first=await call(db,`/${body.artifactId}`,'PATCH',commitInput([put()]),'tombstone-create01',etag)
      const live=await first.json() as any
      const before=await (await call(db,`/${body.artifactId}/objects`)).json() as any
      const deleted=await call(db,`/${body.artifactId}`,'PATCH',commitInput([{op:'delete',objectId:'event:a'}]),'tombstone-delete01',first.headers.get('etag')!)
      const dead=await deleted.json() as any
      expect(dead.objectCount).toBe(1)
      const current=await (await call(db,`/${body.artifactId}/objects`)).json() as any
      expect(current.objects[0]).toMatchObject({objectId:'event:a',tombstone:true,payload:null})
      expect((await (await call(db,`/${body.artifactId}/objects?revisionId=${live.revisionId}`)).json() as any).objects).toEqual(before.objects)
      for(const changes of [[put()],[{op:'delete',objectId:'event:a'}],[{op:'delete',objectId:'absent'}]])expect((await call(db,`/${body.artifactId}`,'PATCH',commitInput(changes),'tombstone-refuse01',deleted.headers.get('etag')!)).status).toBe(409)
      const oldVersion=before.objects[0].versionId,deadVersion=current.objects[0].versionId
      await expect(db.batch([
        db.prepare('INSERT INTO timeline_revisions VALUES (?,?,?,?,?,1,1,?,?,?)').bind('workspace-a',body.artifactId,'rev_resurrection',3,dead.revisionId,'0'.repeat(64),1,'2026-09-11T00:00:00.000Z'),
        db.prepare('INSERT INTO timeline_revision_changes VALUES (?,?,?,?,?,?,?)').bind('workspace-a',body.artifactId,'rev_resurrection','event:a','revise',deadVersion,oldVersion),
      ])).rejects.toThrow(/timeline_object_deleted/)
      expect((await counts(db)).timeline_revisions).toBe(3)
      // INSERT after publication must not append data to either current or old revisions.
      for(const target of [body.revisionId,live.revisionId,dead.revisionId]){
        await expect(db.prepare('INSERT INTO timeline_revision_objects VALUES (?,?,?,?,?)').bind('workspace-a',body.artifactId,target,'event:a',oldVersion).run()).rejects.toThrow()
        await expect(db.prepare('INSERT INTO timeline_revision_changes VALUES (?,?,?,?,?,?,?)').bind('workspace-a',body.artifactId,target,'event:a','create',null,oldVersion).run()).rejects.toThrow()
        await expect(db.prepare('INSERT INTO timeline_revision_parents VALUES (?,?,?,?,0)').bind('workspace-a',body.artifactId,target,body.revisionId).run()).rejects.toThrow()
      }
      for(const table of ['timeline_objects','timeline_object_versions','timeline_revision_objects','timeline_revision_changes','timeline_revision_parents','timeline_idempotency','timeline_lineage_branches'])await expect(db.prepare(`INSERT OR REPLACE INTO ${table} SELECT * FROM ${table} LIMIT 1`).run()).rejects.toThrow()
    }finally{await mf.dispose()}
  })

  test('corrupt persisted replay is rejected instead of returning arbitrary stored JSON',async()=>{
    const {mf,db}=await database()
    try{
      await create(db)
      await db.prepare(`INSERT INTO timeline_idempotency SELECT workspace_id,principal_id,resource,?,request_hash,artifact_id,revision_id,?,response_status,created_at FROM timeline_idempotency LIMIT 1`).bind('corrupt-replay-key1',JSON.stringify({schemaVersion:'timeline-artifact.v1',secret:'must-not-echo'})).run()
      const response=await call(db,'','POST',createInput,'corrupt-replay-key1')
      expect(response.status).toBe(503)
      expect(await response.text()).not.toContain('must-not-echo')
    }finally{await mf.dispose()}
  })
})
