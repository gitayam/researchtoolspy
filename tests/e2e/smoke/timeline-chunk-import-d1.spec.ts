import {test,expect} from '@playwright/test'
import {Miniflare} from 'miniflare'
import type {D1Database} from '@cloudflare/workers-types'
import {onRequestPost} from '../../../functions/api/timeline-source-import'
const suffix='\n\n[Content truncated - see content_chunks table for full text]'
const quote='Boundary 😀 passage'
const full='a'.repeat(153595)+quote+'z'.repeat(100)
const digest=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('')
async function setup(content=full) {
  const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:{DB:'chunk-import'}}),db=await mf.getD1Database('DB')
  try {
    for(const sql of [
      'CREATE TABLE users(id INTEGER PRIMARY KEY,user_hash TEXT,role TEXT,is_active INTEGER)',
      'CREATE TABLE workspaces(id TEXT PRIMARY KEY,owner_id INTEGER,is_public INTEGER)',
      'CREATE TABLE workspace_members(workspace_id TEXT,user_id INTEGER,role TEXT)',
      'CREATE TABLE content_analysis(id INTEGER PRIMARY KEY,user_id INTEGER,workspace_id TEXT,url TEXT,title TEXT,content_hash TEXT,extracted_text TEXT,processing_status TEXT,expires_at TEXT,is_saved INTEGER)',
      // Intentionally no unique index: corrupt duplicate ordinals must fail closed.
      'CREATE TABLE content_chunks(id INTEGER PRIMARY KEY,content_analysis_id INTEGER,chunk_index INTEGER,chunk_size INTEGER,chunk_hash TEXT,chunk_text TEXT)',
      "INSERT INTO users VALUES(1,'chunk-human-hash-0001','researcher',1)","INSERT INTO workspaces VALUES('chunk-private',1,0)",
    ]) await db.prepare(sql).run()
    await db.prepare("INSERT INTO content_analysis VALUES(1,1,'chunk-private','https://example.test/chunk','Chunk fixture',?,?,'complete',NULL,1)").bind(await digest(content),content.length>102400?content.slice(0,102400)+suffix:content).run()
    // Reverse physical insertion order tests that the final query orders by ordinal.
    for(let i=Math.ceil(content.length/51200)-1;i>=0;i--) {
      const part=content.slice(i*51200,(i+1)*51200)
      await db.prepare('INSERT INTO content_chunks(content_analysis_id,chunk_index,chunk_size,chunk_hash,chunk_text) VALUES(1,?,?,?,?)').bind(i,part.length,await digest(part),part).run()
    }
    return {mf,db}
  } catch(error) {await mf.dispose();throw error}
}
async function call(db:D1Database,selectedQuote=quote,extra={}) {
  return onRequestPost({request:new Request('https://example.test/api/timeline-source-import',{method:'POST',headers:{'Content-Type':'application/json','X-User-Hash':'chunk-human-hash-0001'},body:JSON.stringify({schemaVersion:'timeline-source-import-request.v1',workspaceId:'chunk-private',analysisId:1,quote:selectedQuote,...extra})}),env:{DB:db}} as never)
}
async function state(db:D1Database) {return {parent:(await db.prepare('SELECT * FROM content_analysis').all()).results,chunks:(await db.prepare('SELECT * FROM content_chunks ORDER BY id').all()).results}}
test.describe('bounded chunk reconstruction actual D1 @smoke',()=>{
  test('ordered snapshot reconstructs cross-boundary quote beyond old limit without writes',async()=>{
    const {mf,db}=await setup()
    try {
      const before=await state(db),response=await call(db),result=await response.json() as any
      expect(response.status).toBe(200);expect(result.start).toBe(153595);expect(result.end).toBe(153595+quote.length)
      expect(result.contentHash).toBe(await digest(full));expect(result.quoteHash).toBe(await digest(quote))
      expect(result.passage.quote).toBe(quote);expect(result.passage.id).toBe(`passage:1:${await digest(full)}:153595:${153595+quote.length}`)
      expect(await state(db)).toEqual(before)
      expect((await call(db,quote,{expectedContentHash:'0'.repeat(64)})).status).toBe(412)
    } finally {await mf.dispose()}
  })
  test('missing, duplicate, gapped, wrong-size/hash/prefix chunk sets never fall back',async()=>{
    const changes=[
      'DELETE FROM content_chunks WHERE chunk_index=1',
      'UPDATE content_chunks SET chunk_index=1 WHERE chunk_index=0',
      'UPDATE content_chunks SET chunk_index=7 WHERE chunk_index=0',
      'UPDATE content_chunks SET chunk_size=1 WHERE chunk_index=0',
      "UPDATE content_chunks SET chunk_hash='"+'0'.repeat(64)+"' WHERE chunk_index=1",
      "UPDATE content_chunks SET chunk_text='' WHERE chunk_index=3",
      "UPDATE content_analysis SET content_hash='"+'0'.repeat(64)+"'",
      "UPDATE content_analysis SET extracted_text='b'||substr(extracted_text,2)",
      "UPDATE content_analysis SET extracted_text=substr(extracted_text,2)",
    ]
    for(const change of changes) {
      const {mf,db}=await setup()
      try {await db.prepare(change).run();const before=await state(db);expect((await call(db)).status).toBe(400);expect(await state(db)).toEqual(before)} finally {await mf.dispose()}
    }
  })
  test('row, chunk, parent, aggregate JSON and assembled UTF-8 budgets reject before returning content',async()=>{
    const {mf,db}=await setup()
    try {
      for(let i=4;i<9;i++) await db.prepare("INSERT INTO content_chunks(content_analysis_id,chunk_index,chunk_size,chunk_hash,chunk_text) VALUES(1,?,1,?,'x')").bind(i,await digest('x')).run()
      expect((await call(db)).status).toBe(413)
      await db.prepare('DELETE FROM content_chunks WHERE chunk_index>=4').run()
      await db.prepare('UPDATE content_chunks SET chunk_text=? WHERE chunk_index=0').bind('x'.repeat(51201)).run()
      expect((await call(db)).status).toBe(413)
      await db.prepare('UPDATE content_analysis SET extracted_text=?').bind('x'.repeat(102501)).run()
      expect((await call(db)).status).toBe(413)
      await db.prepare('UPDATE content_analysis SET extracted_text=?').bind('😀'.repeat(102500)).run()
      expect((await call(db)).status).toBe(413)
    } finally {await mf.dispose()}
    // Each chunk and parent are bounded, but escaped control characters exceed JSON budget.
    const escaped=await setup('\u0001'.repeat(200000))
    try {expect((await call(escaped.db,'\u0001')).status).toBe(413)} finally {await escaped.mf.dispose()}
    const bytes=await setup('界'.repeat(180000))
    try {expect((await call(bytes.db,'界')).status).toBe(413)} finally {await bytes.mf.dispose()}
  })
  test('full maximum UTF-16 size is accepted while short records ignore unrelated chunks',async()=>{
    const content='a'.repeat(409600-quote.length)+quote,{mf,db}=await setup(content)
    try {const response=await call(db);expect(response.status).toBe(200);expect((await response.json() as any).end).toBe(409600)} finally {await mf.dispose()}
    const short=await setup('Short '+quote)
    try {await short.db.prepare("UPDATE content_chunks SET chunk_hash='bad',chunk_size=-1").run();expect((await call(short.db)).status).toBe(200)} finally {await short.mf.dispose()}
  })
  test('legacy surrogate split is refused, intact astral characters retain correct offsets',async()=>{
    const split='a'.repeat(51199)+'😀'+'b'.repeat(60000)+quote,{mf,db}=await setup(split)
    try {expect((await call(db)).status).toBe(400)} finally {await mf.dispose()}
    const intact=await setup('😀'.repeat(25600)+'b'.repeat(51200)+quote)
    try {const response=await call(intact.db);expect(response.status).toBe(200);expect((await response.json() as any).start).toBe(102400)} finally {await intact.mf.dispose()}
  })
  test('parent and chunks resolve in one final authority snapshot and current changes fail closed',async()=>{
    for(const mutation of ["UPDATE users SET is_active=0 WHERE id=1","UPDATE workspaces SET is_public=1","UPDATE content_analysis SET user_id=2","DELETE FROM content_chunks WHERE chunk_index=1"]) {
      const {mf,db}=await setup()
      try {
        let sourceReads=0
        const wrapped = {
          prepare: (sql: string) => {
            const prepared = db.prepare(sql)
            if (!sql.includes('WITH authorized')) return prepared
            return { bind: (...args: any[]) => ({ first: async () => {
              sourceReads++
              await db.prepare(mutation).run()
              return prepared.bind(...args).first()
            } }) }
          },
        } as unknown as D1Database
        expect((await call(wrapped)).status).toBe(mutation.startsWith('DELETE')?400:404)
        expect(sourceReads).toBe(1)
      } finally {await mf.dispose()}
    }
  })
})
