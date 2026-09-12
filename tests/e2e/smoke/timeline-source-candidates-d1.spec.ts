import {test,expect} from '@playwright/test'
import {Miniflare} from 'miniflare'
import type {D1Database} from '@cloudflare/workers-types'
import {onRequestGet,onRequestOptions} from '../../../functions/api/timeline-source-candidates'
async function setup() {
  const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:{DB:'candidate-test'}}),db=await mf.getD1Database('DB')
  try {
    for(const sql of [
      'CREATE TABLE users(id INTEGER PRIMARY KEY,user_hash TEXT,role TEXT,is_active INTEGER)',
      'CREATE TABLE workspaces(id TEXT PRIMARY KEY,owner_id INTEGER,is_public INTEGER)',
      'CREATE TABLE workspace_members(workspace_id TEXT,user_id INTEGER,role TEXT)',
      'CREATE TABLE content_analysis(id INTEGER PRIMARY KEY,user_id INTEGER,workspace_id TEXT,title TEXT,processing_status TEXT,expires_at TEXT,is_saved INTEGER,extracted_text TEXT)',
      "INSERT INTO users VALUES(1,'picker-owner-hash-001','researcher',1),(2,'picker-other-hash-002','researcher',1),(3,'picker-guest-hash-003','guest',1),(4,'picker-service-hash04','service',1)",
      "INSERT INTO workspaces VALUES('private-a',1,0),('private-b',2,0),('empty',1,0),('public',1,1),('1',1,0)",
    ]) await db.prepare(sql).run()
    for(let id=1;id<=25;id++) await db.prepare("INSERT INTO content_analysis VALUES(?,1,'private-a',?,'complete',NULL,1,'PRIVATE SOURCE TEXT MUST NEVER APPEAR')").bind(id,`Title ${id}`).run()
    return {mf,db}
  } catch(error) {await mf.dispose();throw error}
}
async function call(db:D1Database,query='workspaceId=private-a',headers:Record<string,string>={'X-User-Hash':'picker-owner-hash-001'}) {
  return onRequestGet({request:new Request(`https://example.test/api/timeline-source-candidates?${query}`,{headers}),env:{DB:db}} as never)
}
async function state(db:D1Database) {return Promise.all(['users','workspaces','workspace_members','content_analysis'].map(async table=>(await db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()).results))}
test.describe('recent owned source candidates actual D1 @smoke',()=>{
  test('metadata-only query returns newest20 IDs and distinguishes authorized empty workspace',async()=>{
    const {mf,db}=await setup()
    try {
      const before=await state(db),response=await call(db),raw=await response.text(),body=JSON.parse(raw)
      expect(response.status).toBe(200);expect(response.headers.get('cache-control')).toBe('no-store')
      expect(Object.keys(body).sort()).toEqual(['items','schemaVersion','workspaceId'])
      expect(body.schemaVersion).toBe('timeline-source-candidates.v1')
      expect(body.items.map((item:any)=>item.analysisId)).toEqual(Array.from({length:20},(_,i)=>25-i))
      expect(body.items.every((item:any)=>Object.keys(item).sort().join(',')==='analysisId,title')).toBe(true)
      expect(raw).not.toContain('PRIVATE SOURCE TEXT');expect(new TextEncoder().encode(raw).length).toBeLessThanOrEqual(65536)
      expect(await (await call(db,'workspaceId=empty')).json()).toEqual({schemaVersion:'timeline-source-candidates.v1',workspaceId:'empty',items:[]})
      expect(await state(db)).toEqual(before)
      // This DB has no content_chunks table: metadata listing must not depend on it.
    } finally {await mf.dispose()}
  })
  test('auth, exact workspace, record ownership and write permissions fail closed without provisioning',async()=>{
    const {mf,db}=await setup()
    try {
      const before=await state(db)
      for(const [headers,status] of [[{},401],[{'X-User-Hash':'picker-unknown-hash'},401],[{'X-User-Hash':'picker-guest-hash-003'},403],[{'X-User-Hash':'picker-service-hash04'},403],[{'X-User-Hash':'picker-owner-hash-001',Authorization:'Bearer rt_svc_bad'},403],[{'X-User-Hash':'picker-owner-hash-001','X-Guest-Session':'guest'},403],[{'X-User-Hash':'picker-owner-hash-001','X-Workspace-ID':'private-b'},404]] as Array<[Record<string,string>,number]>) expect((await call(db,undefined,headers)).status).toBe(status)
      for(const workspace of ['private-b','public','1','missing']) expect((await call(db,`workspaceId=${workspace}`)).status).toBe(404)
      expect(await state(db)).toEqual(before)
      await db.prepare("UPDATE workspaces SET owner_id=2 WHERE id='private-a'").run()
      await db.prepare("INSERT INTO workspace_members VALUES('private-a',1,'VIEWER')").run()
      expect((await call(db)).status).toBe(404)
      await db.prepare("UPDATE workspace_members SET role='EDITOR'").run()
      expect((await call(db)).status).toBe(200)
      await db.prepare('UPDATE content_analysis SET user_id=2').run()
      expect((await (await call(db)).json() as any).items).toEqual([])
    } finally {await mf.dispose()}
  })
  test('strict query, canonical retention and positive safe record IDs',async()=>{
    const {mf,db}=await setup()
    try {
      for(const query of ['', 'workspaceId=', 'workspaceId=private-a&workspaceId=private-a','workspaceId=private-a&limit=1','workspaceId=bad%2Fid','WorkspaceId=private-a']) expect((await call(db,query)).status).toBe(400)
      await db.prepare('DELETE FROM content_analysis').run()
      for(const [saved,expiry,complete,qualifies] of [[1,null,'complete',true],[0,'2999-01-01','complete',true],[null,'2999-01-01','complete',true],[0,null,'complete',false],[1,'2999-01-01','complete',false],[0,'invalid','complete',false],[0,'2000-01-01','complete',false],[1,null,'pending',false]] as Array<[number|null,string|null,string,boolean]>) {
        await db.prepare('DELETE FROM content_analysis').run()
        await db.prepare("INSERT INTO content_analysis VALUES(1,1,'private-a','Title',?,?,?,NULL)").bind(complete,expiry,saved).run()
        expect((await (await call(db)).json() as any).items.length).toBe(qualifies?1:0)
      }
      await db.prepare("UPDATE content_analysis SET processing_status='complete',id=0").run()
      expect((await (await call(db)).json() as any).items).toEqual([])
      await db.prepare('UPDATE content_analysis SET id=9007199254740992').run()
      expect((await (await call(db)).json() as any).items).toEqual([])
    } finally {await mf.dispose()}
  })
  test('titles are SQL-bounded, controls sanitized and missing titles have deterministic fallback',async()=>{
    const {mf,db}=await setup()
    try {
      await db.prepare('DELETE FROM content_analysis').run()
      for(const [id,title] of [[1,null],[2,' \t\n '],[3,'A\tB\nC\u007fD'],[4,'😀'.repeat(500)]] as Array<[number,string|null]>) await db.prepare("INSERT INTO content_analysis VALUES(?,1,'private-a',?,'complete',NULL,1,NULL)").bind(id,title).run()
      const items=(await (await call(db)).json() as any).items
      expect(items).toEqual([{analysisId:4,title:'😀'.repeat(200)},{analysisId:3,title:'A B C D'},{analysisId:2,title:'Stored analysis 2'},{analysisId:1,title:'Stored analysis 1'}])
    } finally {await mf.dispose()}
  })
  test('final SELECT rechecks authority and malformed datastore metadata fails closed',async()=>{
    for(const mutation of ["UPDATE users SET is_active=0 WHERE id=1","UPDATE users SET role='service' WHERE id=1","UPDATE workspaces SET is_public=1 WHERE id='private-a'","UPDATE workspaces SET owner_id=2 WHERE id='private-a'"]) {
      const {mf,db}=await setup()
      try {
        let reads=0
        const wrapped={prepare:(sql:string)=>{const prepared=db.prepare(sql);if(!sql.includes('WITH authorized')) return prepared;expect(sql).not.toContain('extracted_text');expect(sql).not.toContain('content_chunks');return {bind:(...args:any[])=>({all:async()=>{reads++;await db.prepare(mutation).run();return prepared.bind(...args).all()}})}} as unknown as D1Database
        expect((await call(wrapped)).status).toBe(404);expect(reads).toBe(1)
      } finally {await mf.dispose()}
    }
    const {mf,db}=await setup()
    try {
      for(const rows of [[{workspace_id:'private-a',analysis_id:1,title:'\ud800'}],[{workspace_id:'private-a',analysis_id:1,title:'x'.repeat(401)}],[{workspace_id:'foreign',analysis_id:1,title:'Title'}],[{workspace_id:'private-a',analysis_id:1,title:'Title'},{workspace_id:'private-a',analysis_id:1,title:'Duplicate'}]]) {
        const wrapped={prepare:(sql:string)=>sql.includes('WITH authorized')?{bind:()=>({all:async()=>({results:rows})})}:db.prepare(sql)} as unknown as D1Database
        expect((await call(wrapped)).status).toBe(503)
      }
      const unavailable={prepare:(sql:string)=>{if(sql.includes('WITH authorized')) throw new Error('synthetic failure');return db.prepare(sql)}} as unknown as D1Database
      expect((await call(unavailable)).status).toBe(503)
      const options=await onRequestOptions({} as never);expect(options.status).toBe(204);expect(options.headers.get('Access-Control-Allow-Methods')).toBe('GET, OPTIONS')
    } finally {await mf.dispose()}
  })
})
