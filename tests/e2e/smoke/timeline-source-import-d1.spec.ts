import {test,expect} from '@playwright/test'
import {Miniflare} from 'miniflare'
import type {D1Database} from '@cloudflare/workers-types'
import {onRequestPost,onRequestOptions} from '../../../functions/api/timeline-source-import'
const text='Opening 😀. Unique quoted passage. Closing.'
async function hash(value:string) {return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('')}
async function setup() {
  const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:{DB:'source-import'}})
  const db=await mf.getD1Database('DB')
  try {
    for(const sql of [
      'CREATE TABLE users(id INTEGER PRIMARY KEY,user_hash TEXT,role TEXT,is_active INTEGER)',
      'CREATE TABLE workspaces(id TEXT PRIMARY KEY,owner_id INTEGER,is_public INTEGER)',
      'CREATE TABLE workspace_members(id TEXT PRIMARY KEY,workspace_id TEXT,user_id INTEGER,role TEXT)',
      'CREATE TABLE content_analysis(id INTEGER PRIMARY KEY,user_id INTEGER,workspace_id TEXT,url TEXT,title TEXT,content_hash TEXT,extracted_text TEXT,processing_status TEXT,expires_at TEXT,is_saved INTEGER)',
      "INSERT INTO users VALUES(1,'source-owner-hash-0001','researcher',1),(2,'source-other-hash-0002','researcher',1),(3,'source-guest-hash-0003','guest',1),(4,'source-service-hash-04','service',1)",
      "INSERT INTO workspaces VALUES('private-a',1,0),('private-b',2,0),('1',1,0),('public',1,1)",
    ]) await db.prepare(sql).run()
    await db.prepare('INSERT INTO content_analysis VALUES(1,1,?,?,?,?,?,?,NULL,1)').bind('private-a','https://example.test/source','Stored title',await hash(text),text,'complete').run()
    return {mf,db}
  } catch(error) {await mf.dispose();throw error}
}
const body={schemaVersion:'timeline-source-import-request.v1',workspaceId:'private-a',analysisId:1,quote:'Unique quoted passage'}
async function call(db:D1Database,input:unknown=body,headers:Record<string,string>={'X-User-Hash':'source-owner-hash-0001'}) {
  return onRequestPost({request:new Request('https://example.test/api/timeline-source-import',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(input)}),env:{DB:db}} as never)
}
async function rows(db:D1Database) {return Promise.all(['users','workspaces','workspace_members','content_analysis'].map(async table=>(await db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()).results))}
test.describe('stored source import actual D1 @smoke',()=>{
  test('readonly exact Unicode match has deterministic IDs/hashes and no invented clocks',async()=>{
    const {mf,db}=await setup()
    try {
      const before=await rows(db),response=await call(db),result=await response.json() as any
      expect(response.status).toBe(200);expect(response.headers.get('cache-control')).toBe('no-store')
      expect(result).toMatchObject({schemaVersion:'timeline-source-import.v1',workspaceId:'private-a',analysisId:1,contentHash:await hash(text),quoteHash:await hash(body.quote),start:text.indexOf(body.quote),end:text.indexOf(body.quote)+body.quote.length})
      expect(result.source.id).toBe(`content:1:${await hash(text)}`)
      expect(result.passage.id).toBe(`passage:1:${await hash(text)}:${result.start}:${result.end}`)
      expect(result.passage.quote).toBe(body.quote);expect(result.passage.locator.length).toBeLessThanOrEqual(1000)
      expect(result.passage.locator).toContain(`UTF-16 [${result.start},${result.end})`)
      expect(result.passage.locator).toContain('not verified source truth')
      expect(result.source).not.toHaveProperty('retrievedAt');expect(result.source).not.toHaveProperty('publishedAt')
      expect((await call(db,{...body,expectedContentHash:result.contentHash})).status).toBe(200)
      expect(await rows(db)).toEqual(before)
    } finally {await mf.dispose()}
  })
  test('existing-human and exact owner/private/write boundaries never provision or disclose',async()=>{
    const {mf,db}=await setup()
    try {
      const before=await rows(db)
      for(const [headers,status] of [
        [{},401],[{'X-User-Hash':'source-unknown-hash-01'},401],[{'X-User-Hash':'source-guest-hash-0003'},403],
        [{'X-User-Hash':'source-service-hash-04'},403],[{'X-User-Hash':'source-owner-hash-0001',Authorization:'Bearer rt_svc_bad'},403],
        [{'X-User-Hash':'source-owner-hash-0001','X-Guest-Session':'x'},403],[{'X-User-Hash':'source-other-hash-0002'},404],
        [{'X-User-Hash':'source-owner-hash-0001','X-Workspace-ID':'private-b'},404],
      ] as Array<[Record<string,string>,number]>) expect((await call(db,body,headers)).status).toBe(status)
      expect((await call(db,{...body,workspaceId:'private-b'})).status).toBe(404)
      expect((await call(db,{...body,analysisId:2})).status).toBe(404)
      expect(await rows(db)).toEqual(before)
      await db.prepare("UPDATE workspaces SET owner_id=2 WHERE id='private-a'").run()
      await db.prepare("INSERT INTO workspace_members VALUES('membership','private-a',1,'VIEWER')").run()
      expect((await call(db)).status).toBe(404)
      await db.prepare("UPDATE workspace_members SET role='EDITOR'").run()
      expect((await call(db)).status).toBe(200)
      await db.prepare("UPDATE workspaces SET is_public=1 WHERE id='private-a'").run()
      expect((await call(db)).status).toBe(404)
    } finally {await mf.dispose()}
  })
  test('final source SELECT rechecks authority changed after identity resolution',async()=>{
    for(const mutation of ["UPDATE users SET is_active=0 WHERE id=1","UPDATE users SET role='guest' WHERE id=1","UPDATE workspaces SET is_public=1 WHERE id='private-a'","UPDATE content_analysis SET user_id=2 WHERE id=1","UPDATE workspaces SET owner_id=2 WHERE id='private-a'"]) {
      const {mf,db}=await setup()
      try {
        const wrapped={prepare:(sql:string)=>{
          const prepared=db.prepare(sql)
          if(!sql.includes('FROM content_analysis')) return prepared
          return {bind:(...args:any[])=>({first:async()=>{await db.prepare(mutation).run();return prepared.bind(...args).first()}})}
        }} as unknown as D1Database
        expect((await call(wrapped)).status).toBe(404)
      } finally {await mf.dispose()}
    }
  })
  test('expired, unfinished, missing, truncated and hash-mismatched stored text fails closed',async()=>{
    const cases=["expires_at='2000-01-01'","expires_at='not-a-date'","processing_status='processing'","processing_status=NULL","extracted_text=NULL","extracted_text=''","content_hash=NULL","content_hash='bad'","content_hash='"+'0'.repeat(64)+"'","url='https://user:secret@example.test/'","url='file:///private'","extracted_text='[Content truncated - see content_chunks table for full text]'" ]
    for(const change of cases) {
      const {mf,db}=await setup()
      try {await db.prepare(`UPDATE content_analysis SET ${change}`).run();const before=await rows(db);expect((await call(db)).status).toBe(400);expect(await rows(db)).toEqual(before)} finally {await mf.dispose()}
    }
  })
  test('ambiguous overlapping occurrences, absent quotes and malformed Unicode are rejected',async()=>{
    const {mf,db}=await setup()
    try {
      await db.prepare('UPDATE content_analysis SET extracted_text=?,content_hash=?').bind('aaaa',await hash('aaaa')).run()
      expect((await call(db,{...body,quote:'aa'})).status).toBe(400)
      expect((await call(db,{...body,quote:'missing'})).status).toBe(400)
      for(const input of [{...body,quote:'\ud800'},{...body,quote:'\udc00'},{...body,quote:' '},{...body,analysisId:0},{...body,analysisId:1.1},{...body,analysisId:'1'},{...body,expectedContentHash:'A'.repeat(64)},{...body,extra:true}]) expect((await call(db,input)).status).toBe(400)
      expect((await call(db,{...body,quote:'x'.repeat(4001)})).status).toBe(413)
      expect((await call(db,{...body,quote:'x'.repeat(65536)})).status).toBe(413)
      await db.prepare('UPDATE content_analysis SET extracted_text=?,content_hash=?').bind('😀'.repeat(51201),await hash('😀'.repeat(51201))).run()
      expect((await call(db)).status).toBe(413)
    } finally {await mf.dispose()}
  })
  test('retention and expiry accept only canonical retained or future unsaved records',async()=>{
    const {mf,db}=await setup()
    try {
      for(const [saved,expiry,status] of [
        [1,null,200],[0,'2999-01-01T00:00:00Z',200],[null,'2999-01-01T00:00:00Z',200],
        [0,null,400],[null,null,400],[0,'2000-01-01T00:00:00Z',400],[0,'invalid-date',400],
        [1,'2999-01-01T00:00:00Z',400],[1,'2000-01-01T00:00:00Z',400],[1,'invalid-date',400],
        [2,null,400],[2,'2999-01-01T00:00:00Z',400],
      ] as Array<[number|null,string|null,number]>) {
        await db.prepare('UPDATE content_analysis SET is_saved=?,expires_at=?').bind(saved,expiry).run()
        const before=await rows(db)
        expect((await call(db)).status).toBe(status)
        expect(await rows(db)).toEqual(before)
      }
    } finally {await mf.dispose()}
  })
  test('expected hash detects current source replacement without mutations and preflight is bounded',async()=>{
    const {mf,db}=await setup()
    try {
      const previous=await hash(text),changed=text+' New source version.'
      await db.prepare('UPDATE content_analysis SET extracted_text=?,content_hash=?').bind(changed,await hash(changed)).run()
      const before=await rows(db),response=await call(db,{...body,expectedContentHash:previous})
      expect(response.status).toBe(412);expect((await response.json() as any).error.code).toBe('stale_revision')
      expect(await rows(db)).toEqual(before)
      const options=await onRequestOptions({} as never)
      expect(options.status).toBe(204);expect(options.headers.get('Access-Control-Allow-Methods')).toBe('POST, OPTIONS')
    } finally {await mf.dispose()}
  })
})
