import { test, expect } from '@playwright/test'
import { Miniflare } from 'miniflare'
import { readFileSync } from 'node:fs'
import type { D1Database } from '@cloudflare/workers-types'
import { onRequestPost } from '../../../functions/api/timelines'
import { onRequestGet as detail, onRequestPatch } from '../../../functions/api/timelines/[id]'
import { onRequestGet as objects } from '../../../functions/api/timelines/[id]/objects'
import { onRequestGet as revisions } from '../../../functions/api/timelines/[id]/revisions'
import { onRequestGet as revision } from '../../../functions/api/timelines/[id]/revisions/[revisionId]'
import { deriveIntegrationTokenHash } from '../../../functions/api/_shared/service-auth'

function statements(sql: string): string[] {
  const result: string[] = []
  let start = 0
  let token = ''
  let tokens: string[] = []
  let trigger = false
  let depth = 0
  let quote = ''
  let lineComment = false
  let blockComment = false
  const flush = () => {
    if (!token) return
    const word = token.toUpperCase()
    tokens.push(word)
    if (tokens[0] === 'CREATE' && word === 'TRIGGER') trigger = true
    if (trigger && (word === 'BEGIN' || word === 'CASE')) depth += 1
    if (trigger && word === 'END') depth -= 1
    token = ''
  }
  for (let index = 0; index < sql.length; index += 1) {
    const character = sql[index]
    const next = sql[index + 1]
    if (lineComment) { if (character === '\n') lineComment = false; continue }
    if (blockComment) { if (character === '*' && next === '/') { blockComment = false; index += 1 }; continue }
    if (quote) {
      if (character === quote) {
        if (next === quote && quote !== ']') index += 1
        else quote = ''
      }
      continue
    }
    if (character === '-' && next === '-') { flush(); lineComment = true; index += 1; continue }
    if (character === '/' && next === '*') { flush(); blockComment = true; index += 1; continue }
    if (character === "'" || character === '"' || character === '`' || character === '[') { flush(); quote = character === '[' ? ']' : character; continue }
    if (/[A-Za-z_]/.test(character)) { token += character; continue }
    flush()
    if (character === ';' && (!trigger || depth === 0)) {
      if (tokens.length) result.push(sql.slice(start, index + 1).trim())
      start = index + 1
      tokens = []
      trigger = false
      depth = 0
    }
  }
  flush()
  if (quote || blockComment || depth !== 0) throw new Error('Unterminated SQL statement in migration rehearsal')
  if (tokens.length) result.push(sql.slice(start).trim())
  return result
}
const migration=(name:string)=>statements(readFileSync(new URL(`../../../schema/managed-migrations/${name}`,import.meta.url),'utf8'))
const upgrade=migration('0013_timeline_service_scopes.sql')
const key='service-test-key-material-0000000000000000'
const client='timeline_client_01', other='timeline_client_02'
const tokenId='timeline_token_current_01', nextId='timeline_token_next_0001'
const secret='A'.repeat(43), nextSecret='B'.repeat(43)
const bearer=(value=secret,id=client)=>`Bearer rt_svc_${id}.${value}`
async function setup(apply=true) {
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:{DB:'timeline-service'}})
 const db=await mf.getD1Database('DB')
 try {
  for(const statement of statements(`
  CREATE TABLE users(id INTEGER PRIMARY KEY,username TEXT NOT NULL UNIQUE,email TEXT NOT NULL UNIQUE,full_name TEXT NOT NULL,hashed_password TEXT NOT NULL,user_hash TEXT,account_hash TEXT,oidc_sub TEXT,oidc_provider TEXT,oidc_email TEXT,is_active INTEGER NOT NULL,role TEXT NOT NULL);
  CREATE TABLE workspaces(id TEXT PRIMARY KEY,owner_id INTEGER REFERENCES users(id),type TEXT NOT NULL,is_public INTEGER NOT NULL);
  CREATE TABLE workspace_members(id TEXT PRIMARY KEY,workspace_id TEXT REFERENCES workspaces(id),user_id INTEGER REFERENCES users(id),role TEXT NOT NULL);
  CREATE TABLE investigations(id TEXT PRIMARY KEY,workspace_id TEXT REFERENCES workspaces(id),created_by INTEGER REFERENCES users(id),status TEXT NOT NULL);
  INSERT INTO users VALUES(1,'human','human@example.test','Human','disabled','timeline-human-hash-001',NULL,NULL,NULL,NULL,1,'researcher');
  INSERT INTO workspaces VALUES('human-private',1,'TEAM',0);
  `)) await db.prepare(statement).run()
  for(const name of ['0009_community_service_auth.sql','0010_service_principal_identity_compat.sql','0011_timeline_foundation.sql','0012_timeline_workspace_snapshots.sql']) await db.batch(migration(name).map(s=>db.prepare(s)))
  for(const [id,n] of [[client,2],[other,3]] as const) {
   await db.prepare("INSERT INTO users VALUES(?, ?, ?, 'Service','SERVICE_AUTH_DISABLED',NULL,NULL,NULL,NULL,NULL,1,'service')").bind(n,`service_${id}`,`service+${id}@service.invalid`).run()
   await db.prepare("INSERT INTO workspaces VALUES(?,?,'TEAM',0)").bind(`workspace-${n}`,n).run()
   await db.prepare("INSERT INTO investigations VALUES(?,?,?,'active')").bind(`intake-${n}`,`workspace-${n}`,n).run()
   await db.prepare("INSERT INTO integration_clients(id,community_id,workspace_id,intake_investigation_id,principal_user_id,environment,maximum_visibility,status) VALUES(?,?,?,?,?,'production','private','active')").bind(id,`community-${n}`,`workspace-${n}`,`intake-${n}`,n).run()
  }
  const digest=await deriveIntegrationTokenHash(key,client,secret)
  await db.prepare("INSERT INTO integration_client_tokens(id,client_id,slot,secret_hash,created_at,not_before,expires_at) VALUES(?,?,'current',?,unixepoch()-60,unixepoch()-60,unixepoch()+3600)").bind(tokenId,client,digest).run()
  await db.prepare("INSERT INTO integration_client_token_scopes VALUES(?,'community.research.execute')").bind(tokenId).run()
  if(apply) await db.batch(upgrade.map(s=>db.prepare(s)))
  return {mf,db,digest}
 } catch(e) {await mf.dispose();throw e}
}
async function scopes(db:D1Database,values:string[],id=tokenId) {
 await db.prepare('DELETE FROM integration_client_token_scopes WHERE token_id=?').bind(id).run()
 for(const scope of values) await db.prepare('INSERT INTO integration_client_token_scopes VALUES(?,?)').bind(id,scope).run()
}
async function call(db:D1Database,method:string,path='',body?:unknown,opts:{auth?:string;enabled?:string;key?:string;etag?:string;human?:boolean}={}) {
 const headers:Record<string,string>={'Content-Type':'application/json','Idempotency-Key':opts.key??'timeline-service-request01','X-User-Hash':'timeline-human-hash-001'}
 if(!opts.human) headers.Authorization=opts.auth??bearer()
 if(opts.etag) headers['If-Match']=opts.etag
 const request=new Request(`https://example.test/api/timelines${path?'/'+path:''}`,{method,headers,...(body?{body:JSON.stringify(body)}:{})})
 const [id,,revisionId]=path.split('/')
 const handler=method==='POST'?onRequestPost:method==='PATCH'?onRequestPatch:path.includes('/objects')?objects:revisionId?revision:path.includes('/revisions')?revisions:detail
 return handler({request,env:{DB:db,ENVIRONMENT:'production',INTEGRATION_TOKEN_HASH_KEY:key,COMMUNITY_INTEGRATIONS_ENABLED:opts.enabled??'true'},params:{id,revisionId}} as never)
}
const createBody=(workspaceId='workspace-2')=>({schemaVersion:'timeline-artifact-create.v1',workspaceId,title:'Service timeline'})
const commitBody={schemaVersion:'timeline-artifact-commit.v1',changes:[{op:'put',objectId:'event:service',kind:'event-candidate.v1',payload:{title:'Service event',description:null}}]}
async function create(db:D1Database,opts:Parameters<typeof call>[4]={}) {
 const response=await call(db,'POST','',createBody(),opts);expect(response.status).toBe(201)
 return {body:await response.json() as any,etag:response.headers.get('etag')!}
}
async function state(db:D1Database) {
 const result:Record<string,unknown>={}
 for(const {name} of (await db.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name LIKE 'timeline_%' ORDER BY name").all<{name:string}>()).results) result[name]=(await db.prepare(`SELECT * FROM ${name} ORDER BY rowid`).all()).results
 return result
}
function racing(db:D1Database,mutate:()=>Promise<unknown>):D1Database {
 let fired=false
 return new Proxy(db,{get(target,property){if(property==='batch')return async (batch:any)=>{if(!fired){fired=true;await mutate()}return db.batch(batch)};const v=Reflect.get(target,property);return typeof v==='function'?v.bind(target):v}})
}

test.describe('timeline exact scoped service actual D1 @smoke',()=>{
 test('independent read/write scopes, all pinned routes, workspace isolation and human compatibility',async()=>{
  const {mf,db}=await setup();try {
   await scopes(db,['timeline.read']);expect((await call(db,'POST','',createBody())).status).toBe(403)
   await scopes(db,['timeline.write']);const c=await create(db)
   expect((await call(db,'GET',c.body.artifactId)).status).toBe(403)
   const response=await call(db,'PATCH',c.body.artifactId,commitBody,{etag:c.etag,key:'timeline-service-commit01'});expect(response.status).toBe(200)
   const saved=await response.json() as any
   const snapshot={schemaVersion:'timeline-workspace.v1',exportedAt:'2026-09-11T00:00:00.000Z',source:{schemaVersion:'timeline-manual.v1',title:'Service snapshot'},analystWorkspace:{mode:'basic',events:[],questions:[],hypotheses:[],narrative:{title:'Service snapshot',framing:'',question:'',intendedUse:'',scope:'',timezone:'UTC',dataThrough:'',chapters:[]}}}
   expect((await call(db,'PATCH',c.body.artifactId,{schemaVersion:'timeline-artifact-commit.v1',changes:[{op:'put',objectId:'browser-workspace',kind:'timeline-workspace.v1',payload:snapshot}]},{etag:response.headers.get('etag')!,key:'timeline-service-snapshot'})).status).toBe(200)
   await scopes(db,['timeline.read'])
   for(const path of [c.body.artifactId,`${c.body.artifactId}/objects`,`${c.body.artifactId}/revisions`,`${c.body.artifactId}/revisions/${saved.revisionId}`]) {const r=await call(db,'GET',path);expect(r.status).toBe(200);expect(await r.text()).not.toContain('secret_hash')}
   expect((await call(db,'PATCH',c.body.artifactId,commitBody,{etag:c.etag,key:'timeline-service-commit01'})).status).toBe(403)
   await scopes(db,['timeline.write']);expect((await call(db,'POST','',createBody('workspace-3'))).status).toBe(403)
   const human=await call(db,'POST','',createBody('human-private'),{human:true,key:'timeline-human-create01'});expect(human.status).toBe(201)
   const h=await human.json() as any;await scopes(db,['timeline.read']);expect((await call(db,'GET',h.artifactId)).status).toBe(404)
   expect((await call(db,'GET',c.body.artifactId,{},{human:true})).status).toBe(404)
  }finally{await mf.dispose()}
 })
 test('disabled, malformed, expired, revoked and replaced credentials never use the human fallback',async()=>{
  const {mf,db}=await setup();try {
   await scopes(db,['timeline.read','timeline.write']);const c=await create(db)
   for(const opts of [{enabled:'false'},{auth:'Bearer rt_svc_bad'},{auth:bearer('C'.repeat(43))}]) {const r=await call(db,'GET',c.body.artifactId,undefined,opts);expect([401,403]).toContain(r.status);expect((await r.json() as any).schemaVersion).toBe('timeline-artifact-error.v1')}
   for(const sql of ["UPDATE integration_client_tokens SET expires_at=unixepoch()-1", "UPDATE integration_client_tokens SET revoked_at=unixepoch()", "UPDATE integration_client_tokens SET secret_hash='"+'f'.repeat(64)+"'"]) {
    await db.prepare(sql).run();expect((await call(db,'GET',c.body.artifactId)).status).toBe(401)
    await db.prepare('UPDATE integration_client_tokens SET expires_at=unixepoch()+3600,revoked_at=NULL,secret_hash=?').bind(await deriveIntegrationTokenHash(key,client,secret)).run()
   }
  }finally{await mf.dispose()}
 })
 test('current/next token rotation preserves principal retry identity and checks the presented scope',async()=>{
  const {mf,db}=await setup();try {
   await scopes(db,['timeline.write']);const c=await create(db)
   await db.prepare("INSERT INTO integration_client_tokens(id,client_id,slot,secret_hash,created_at,not_before,expires_at) VALUES(?,?,'next',?,unixepoch()-60,unixepoch()-60,unixepoch()+3600)").bind(nextId,client,await deriveIntegrationTokenHash(key,client,nextSecret)).run()
   await scopes(db,['timeline.read'],nextId)
   expect((await call(db,'POST','',createBody(),{auth:bearer(nextSecret)})).status).toBe(403)
   await scopes(db,['timeline.write'],nextId)
   const replay=await call(db,'POST','',createBody(),{auth:bearer(nextSecret)});expect(replay.status).toBe(201);expect(await replay.json()).toEqual(c.body)
   await db.prepare('UPDATE integration_client_tokens SET revoked_at=unixepoch() WHERE id=?').bind(tokenId).run()
   expect((await call(db,'POST','',createBody())).status).toBe(401)
   expect((await call(db,'POST','',createBody(),{auth:bearer(nextSecret)})).status).toBe(201)
   await db.prepare('DELETE FROM integration_client_tokens WHERE id=?').bind(tokenId).run()
   await db.prepare("UPDATE integration_client_tokens SET slot='current' WHERE id=?").bind(nextId).run()
   expect((await call(db,'POST','',createBody(),{auth:bearer(nextSecret)})).status).toBe(201)
  }finally{await mf.dispose()}
 })
 test('exact token, scope and binding races abort whole create and commit batches before replay or stale classification',async()=>{
  test.setTimeout(120000)
  for(const mutation of [
   "UPDATE integration_client_tokens SET revoked_at=unixepoch() WHERE slot='current'",
   "DELETE FROM integration_client_token_scopes WHERE scope='timeline.write' AND token_id='"+tokenId+"'",
   "UPDATE integration_client_tokens SET secret_hash='"+'e'.repeat(64)+"' WHERE slot='current'",
   "UPDATE integration_client_tokens SET expires_at=unixepoch()-1 WHERE slot='current'",
   "UPDATE integration_clients SET status='disabled'",
   "UPDATE integration_clients SET environment='staging'",
   "UPDATE integration_clients SET community_id='changed-community'",
  ]) for(const op of ['POST','PATCH']) {
   const {mf,db}=await setup();try {
    await scopes(db,['timeline.write']);const c=await create(db);const before=await state(db)
    // A second valid writer must not lend authority to a revoked/demoted/replaced presented slot.
    await db.prepare("INSERT INTO integration_client_tokens(id,client_id,slot,secret_hash,created_at,not_before,expires_at) VALUES(?,?,'next',?,unixepoch()-60,unixepoch()-60,unixepoch()+3600)").bind(nextId,client,await deriveIntegrationTokenHash(key,client,nextSecret)).run()
    await scopes(db,['timeline.write'],nextId)
    const proxy=racing(db,()=>db.prepare(mutation).run())
    const r=await call(proxy,op,op==='PATCH'?c.body.artifactId:'',op==='PATCH'?commitBody:createBody(),{etag:c.etag,key:'timeline-racing-write01'})
    expect(r.status).toBe(403);expect((await r.json() as any).schemaVersion).toBe('timeline-artifact-error.v1');expect(await state(db)).toEqual(before)
   }finally{await mf.dispose()}
  }
 })
 test('populated scope/history upgrade preserves rows, keys, foreign keys and rolls back failed rebuild',async()=>{
  const {mf,db}=await setup(false);try {
   const h=await call(db,'POST','',createBody('human-private'),{human:true});expect(h.status).toBe(201)
   const before=await state(db),scopeRows=(await db.prepare('SELECT * FROM integration_client_token_scopes ORDER BY token_id,scope').all()).results
   const catalog=(await db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").all()).results
   await expect(db.batch([...upgrade.slice(0,4),'INSERT INTO missing_migration_target VALUES(1)',...upgrade.slice(4)].map(s=>db.prepare(s)))).rejects.toThrow()
   expect(await state(db)).toEqual(before);expect((await db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").all()).results).toEqual(catalog)
   await db.batch(upgrade.map(s=>db.prepare(s)))
   expect(await state(db)).toEqual(before);expect((await db.prepare('SELECT * FROM integration_client_token_scopes ORDER BY token_id,scope').all()).results).toEqual(scopeRows)
   expect((await db.prepare('PRAGMA foreign_key_check').all()).results).toEqual([])
   await expect(db.prepare("INSERT INTO integration_client_token_scopes VALUES(?,'community.research.execute')").bind(tokenId).run()).rejects.toThrow()
   await expect(db.prepare("INSERT INTO integration_client_token_scopes VALUES('missing-token','timeline.read')").run()).rejects.toThrow()
   await scopes(db,['timeline.write']);await create(db)
  }finally{await mf.dispose()}
 })
})
