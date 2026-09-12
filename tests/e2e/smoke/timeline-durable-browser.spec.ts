import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { Miniflare } from 'miniflare'
import { onRequestPost } from '../../../functions/api/timelines'
import { onRequestGet, onRequestPatch } from '../../../functions/api/timelines/[id]'
import { onRequestGet as objects } from '../../../functions/api/timelines/[id]/objects'
import { onRequestGet as sourceCandidates } from '../../../functions/api/timeline-source-candidates'
import { onRequestPost as sourceImport } from '../../../functions/api/timeline-source-import'
import { snapshotIdentity, prepareTimelineSave } from '../../../src/lib/timeline-durable'
import { decodeTimelineWorkspace } from '../../../src/lib/timeline-workspace-codec'
import type { TimelineWorkspaceExport } from '../../../src/types/timeline-workspace'

const hash = 'browser-snapshot-human-0001'
const storedSource = JSON.parse(readFileSync(new URL('../../fixtures/timeline-stored-source.json', import.meta.url), 'utf8'))
const sourceDigest = (text: string) => createHash('sha256').update(text).digest('hex')
const chunkFixture = JSON.parse(readFileSync(new URL('../../fixtures/timeline-chunked-source.json', import.meta.url), 'utf8'))
const chunkedSource = { ...chunkFixture, text: chunkFixture.prefixUnit.repeat(chunkFixture.prefixRepeats) + chunkFixture.quote + chunkFixture.suffix }
const draftKey = 'researchtools.timeline.manual-draft.v1'
function fixture(): TimelineWorkspaceExport {
  return decodeTimelineWorkspace(JSON.stringify({ schemaVersion: 'timeline-workspace.v1', exportedAt: '2026-09-11T12:00:00.000Z', source: { schemaVersion: 'timeline-manual.v1', title: 'Private browser investigation' }, analystWorkspace: {
    mode: 'robust', events: [{ id: 'event:unknown.1', title: 'Original uncertain event', description: 'Original claim', eventTime: '14:30:59', category: 'event', importance: 'normal', origin: 'analyst', assessment: 'disputed', analystNote: 'Conflicting accounts', modified: false, sequenceOrder: 0, placement: { mode: 'position', position: 1 }, narrativeRole: 'context', chapterId: 'chapter:one' }],
    evidence: { schemaVersion: 'timeline-evidence.v1', sources: [{ id: 'source:browser', url: 'https://example.test/report', title: 'Saved evidence report', publisher: 'Synthetic desk' }], assertions: [{ id: 'assertion:browser', sourceId: 'source:browser', claimText: 'A preserved source-specific account.', temporalClaim: 'Before sunrise', passage: { id: 'passage:browser', quote: 'Before sunrise, observers reported a meeting.', locator: 'paragraph 3' }, status: 'active', derivesFrom: [], reportedAt: '2026-09-11T12:00:00Z' }], links: [{ id: 'link:browser', eventId: 'event:unknown.1', assertionId: 'assertion:browser', relation: 'contradicts' }], reviews: [] },
    // A stale imported basis is preserved for explicit analyst review.
    analysis: JSON.parse(readFileSync(new URL('../../fixtures/timeline-judgment-snapshot.json', import.meta.url), 'utf8')),
    questions: [{ id: 'question:one', question: 'When did it happen?', status: 'open', answer: '', afterEventId: 'event:unknown.1' }], hypotheses: [],
    narrative: { title: 'Private account', framing: 'Preserve uncertainty', question: 'What changed?', intendedUse: 'Review', scope: 'Synthetic', timezone: 'UTC', dataThrough: '', chapters: [{ id: 'chapter:one', title: 'Context', claim: 'A disputed report' }] },
  } }))
}
async function bridge(page: Page, signedIn = true, chunked = false) {
  const mf = new Miniflare({ modules: true, script: 'export default {fetch(){return new Response("ok")}}', d1Databases: { DB: 'browser-snapshot' } })
  const db = await mf.getD1Database('DB')
  const sql = (name: string) => readFileSync(new URL(`../../../schema/managed-migrations/${name}`, import.meta.url), 'utf8').split('-- statement\n').slice(1).map(s => s.trim())
  for (const query of [
    'CREATE TABLE users(id INTEGER PRIMARY KEY,user_hash TEXT UNIQUE,role TEXT NOT NULL,is_active INTEGER NOT NULL)',
    'CREATE TABLE workspaces(id TEXT PRIMARY KEY,owner_id INTEGER REFERENCES users(id),is_public INTEGER NOT NULL)',
    'CREATE TABLE workspace_members(id TEXT PRIMARY KEY,workspace_id TEXT REFERENCES workspaces(id),user_id INTEGER REFERENCES users(id),role TEXT NOT NULL)',
    'CREATE TABLE content_analysis(id INTEGER PRIMARY KEY,user_id INTEGER,workspace_id TEXT,url TEXT,title TEXT,extracted_text TEXT,content_hash TEXT,expires_at TEXT,is_saved INTEGER,processing_status TEXT)',
    'CREATE TABLE content_chunks(content_analysis_id INTEGER,chunk_index INTEGER,chunk_size INTEGER,chunk_hash TEXT,chunk_text TEXT)',
    `INSERT INTO users VALUES(1,'${hash}','researcher',1)`,
    "INSERT INTO workspaces VALUES('browser-private',1,0),('browser-other',1,0)",
    ...sql('0011_timeline_foundation.sql'),
  ]) await db.prepare(query).run()
  await db.batch(sql('0012_timeline_workspace_snapshots.sql').map(s => db.prepare(s)))
  await db.prepare("INSERT INTO content_analysis VALUES(?,1,'browser-private',?,?,?,?,NULL,1,'complete')").bind(storedSource.analysisId, storedSource.url, storedSource.title, storedSource.text, sourceDigest(storedSource.text)).run()
  if (chunked) {
    await db.prepare("INSERT INTO content_analysis VALUES(?,1,'browser-private',?,?,?,?,NULL,1,'complete')").bind(chunkedSource.analysisId,chunkedSource.url,chunkedSource.title,chunkedSource.text.slice(0,102400)+'\n\n[Content truncated - see content_chunks table for full text]',sourceDigest(chunkedSource.text)).run()
    for (let start=0;start<chunkedSource.text.length;start+=51200) {
      const text=chunkedSource.text.slice(start,start+51200)
      await db.prepare('INSERT INTO content_chunks VALUES(?,?,?,?,?)').bind(chunkedSource.analysisId,start/51200,text.length,sourceDigest(text),text).run()
    }
  }
  const faults = { holdCandidates: null as Promise<void> | null, candidatesReady: false, candidatesDelivered: false, candidatesCalls: 0, candidatesOverride: null as string | null, dropCreate: false, dropCommit: false, malformedRead: false, holdSource: null as Promise<void> | null, sourceReady: false, sourceDelivered: false }
  const calls: Array<{ method: string; body: string | null; key?: string; etag?: string; status: number; response: any }> = []
  await page.addInitScript(({ hash, signedIn }) => {
    if (!signedIn) return
    localStorage.setItem('omnicore_user_hash', hash)
    localStorage.setItem('omnicore_tokens', JSON.stringify({ access_token: hash, issued_at: Date.now(), expires_in: 3600 }))
    localStorage.setItem('auth-storage', JSON.stringify({ state: { user: { id: 1, role: 'researcher', is_active: true }, isAuthenticated: true }, version: 0 }))
    localStorage.setItem('omnicore_workspace_id', 'browser-private')
  }, { hash, signedIn })
  await page.route('**/api/**', async route => {
    const incoming = route.request(), url = new URL(incoming.url())
    if (!url.pathname.startsWith('/api/')) return route.continue()
    if (url.pathname === '/api/workspaces') return route.fulfill({ json: { owned: ['browser-private', 'browser-other'].map(id => ({ id, name: id === 'browser-private' ? 'Private investigation' : 'Other workspace', owner_id: 1, is_public: false, type: 'PERSONAL' })), member: [] } })
    if (url.pathname === '/api/timeline-source-candidates') {
      faults.candidatesCalls++
      const response = await sourceCandidates({request:new Request(url,{headers:incoming.headers()}),env:{DB:db}} as never)
      const body=faults.candidatesOverride??await response.text();faults.candidatesReady=true
      if(faults.holdCandidates)await faults.holdCandidates
      return route.fulfill({status:response.status,body,headers:Object.fromEntries(response.headers)}).catch(()=>{}).finally(()=>{faults.candidatesDelivered=true})
    }
    if (url.pathname === '/api/timeline-source-import') {
      const response = await sourceImport({ request: new Request(url, { method: incoming.method(), headers: incoming.headers(), body: incoming.postData()! }), env: { DB: db } } as never)
      const body = await response.text(); faults.sourceReady = true
      if (faults.holdSource) await faults.holdSource
      return route.fulfill({ status: response.status, body, headers: Object.fromEntries(response.headers) }).catch(() => {}).finally(() => { faults.sourceDelivered = true })
    }
    if (!url.pathname.startsWith('/api/timelines')) return route.fulfill({ json: {} })
    const request = new Request(url, { method: incoming.method(), headers: incoming.headers(), ...(incoming.postData() ? { body: incoming.postData()! } : {}) })
    const id = url.pathname.split('/')[3]
    const handler = incoming.method() === 'POST' ? onRequestPost : incoming.method() === 'PATCH' ? onRequestPatch : url.pathname.endsWith('/objects') ? objects : onRequestGet
    const response = await handler({ request, env: { DB: db }, params: { id } } as never)
    const text = await response.text()
    calls.push({ method: request.method, body: incoming.postData(), key: incoming.headers()['idempotency-key'], etag: incoming.headers()['if-match'], status: response.status, response: JSON.parse(text) })
    if (request.method === 'POST' && faults.dropCreate) { faults.dropCreate = false; return route.abort('failed') }
    if (request.method === 'PATCH' && faults.dropCommit) { faults.dropCommit = false; return route.abort('failed') }
    if (request.method === 'GET' && faults.malformedRead) return route.fulfill({ status: 200, json: { schemaVersion: 'wrong' }, headers: Object.fromEntries(response.headers) })
    await route.fulfill({ status: response.status, body: text, headers: Object.fromEntries(response.headers) })
  })
  return { mf, db, faults, calls }
}
async function importFixture(page: Page, value = fixture()) {
  await page.getByLabel('Import timeline JSON').setInputFiles({ name: 'snapshot.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(value)) })
  await expect(page.getByRole('button', { name: 'Save timeline', exact: true })).toBeEnabled()
}
async function exported(page: Page) {
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export JSON', exact: true }).click()
  return JSON.parse(await readFile((await (await download).path())!, 'utf8')) as TimelineWorkspaceExport
}
async function saved(page: Page) { await expect(page.getByTestId('timeline-save-state')).toHaveText('Saved') }

test.describe('durable browser with actual D1 routes @smoke', () => {
  test('visual workspace hierarchy and event finding preserve the complete private sequence',async({page},testInfo)=>{
    test.setTimeout(120_000)
    const b=await bridge(page)
    try{
      const value=fixture()
      value.analystWorkspace.events.push({...value.analystWorkspace.events[0],id:'event:arrival',title:'Supplies arrive at the bridge',eventDate:'2026-09-10',datePrecision:'day',eventTime:'09:00',description:'A dated observation recorded separately from the disputed account.',assessment:'unreviewed',sequenceOrder:1,placement:{mode:'position',position:2}}, {...value.analystWorkspace.events[0],id:'event:reopening',title:'Reopening reported by the local desk',eventDate:'2026-09-11',datePrecision:'day',eventTime:undefined,description:'The report describes deliveries resuming; the underlying claim remains under review.',assessment:'hypothesis',sequenceOrder:2,placement:{mode:'position',position:3}})
      await page.goto('/dashboard/tools/timeline');await importFixture(page,value)
      await page.getByRole('button',{name:'Save timeline',exact:true}).click();await saved(page)
      await page.reload();await page.getByRole('button',{name:'Open saved timeline',exact:true}).click();await saved(page)
      const before=(await exported(page)).analystWorkspace,raw=await page.evaluate(key=>localStorage.getItem(key),draftKey)
      const finder=page.getByLabel('Find an event',{exact:true}),links=page.getByRole('navigation',{name:'Timeline events',exact:true})
      await finder.fill('supplies')
      await expect(links.getByRole('link')).toHaveCount(1)
      await links.getByRole('link').click()
      await expect(page).toHaveURL(/#timeline-event-event%3Aarrival$/)
      await expect(page.locator('#timeline-sequence .timeline-event-card')).toHaveCount(3)
      await finder.fill('no-match-record')
      await expect(links.getByRole('link')).toHaveCount(0)
      await expect(links.getByRole('status')).toContainText('0 matching event links')
      await finder.fill('')
      await expect(links.getByRole('link')).toHaveCount(3)
      const navigation=page.getByRole('navigation',{name:'Workspace navigation',exact:true})
      await navigation.getByRole('link',{name:/Judgments/}).focus();await page.keyboard.press('Enter')
      await expect(page.locator('#timeline-judgments')).toBeFocused()
      await navigation.getByRole('link',{name:/Event sequence/}).click()
      await expect(page.locator('#timeline-sequence')).toBeFocused()
      for(const theme of ['light','dark']){
        await page.evaluate(dark=>document.documentElement.classList.toggle('dark',dark),theme==='dark')
        expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true)
        for(const [name,selector] of [['navigation','.timeline-workspace-nav'],['sequence','#timeline-sequence'],['judgments','#timeline-judgments']] as const){
          const target=page.locator(selector),path=testInfo.outputPath(`${name}-${theme}.png`)
          await target.screenshot({path,animations:'disabled'});await testInfo.attach(`${name} ${theme}`,{path,contentType:'image/png'})
        }
      }
      expect((await exported(page)).analystWorkspace).toEqual(before)
      expect(await page.evaluate(key=>localStorage.getItem(key),draftKey)).toBe(raw)
    }finally{await b.mf.dispose()}
  })
  test('a passage beyond the stored prefix imports from verified chunks and survives private reopen', async ({ page }, testInfo) => {
    test.setTimeout(120_000)
    const b=await bridge(page,true,true)
    try {
      await page.goto('/dashboard/tools/timeline');await importFixture(page)
      await page.getByRole('button',{name:'Save timeline',exact:true}).click();await saved(page)
      await page.reload();await page.getByRole('button',{name:'Open saved timeline',exact:true}).click();await saved(page)
      const raw=await page.evaluate(key=>localStorage.getItem(key),draftKey)
      const panel=page.getByTestId('evidence-event:unknown.1');await panel.locator('summary').first().click()
      const form=panel.getByRole('region',{name:'Import stored passage'})
      expect(b.faults.candidatesCalls).toBe(0)
      await form.getByRole('button',{name:'Load recent stored sources',exact:true}).click()
      await expect(form.getByRole('button',{name:`Use analysis ${chunkedSource.analysisId}: ${chunkedSource.title}`,exact:true})).toBeVisible()
      const pickerBounds=await form.getByRole('region',{name:'Recent stored sources',exact:true}).boundingBox()
      const loadBounds=await form.getByRole('button',{name:'Load recent stored sources',exact:true}).boundingBox()
      expect(pickerBounds).not.toBeNull();expect(loadBounds).not.toBeNull()
      expect(loadBounds!.x).toBeGreaterThanOrEqual(pickerBounds!.x)
      expect(loadBounds!.x+loadBounds!.width).toBeLessThanOrEqual(pickerBounds!.x+pickerBounds!.width)
      const pickerScreenshot=testInfo.outputPath('source-picker.png');await form.getByRole('region',{name:'Recent stored sources',exact:true}).screenshot({path:pickerScreenshot,animations:'disabled'});await testInfo.attach('Recent stored source picker',{path:pickerScreenshot,contentType:'image/png'})
      await form.getByRole('button',{name:`Use analysis ${chunkedSource.analysisId}: ${chunkedSource.title}`,exact:true}).click()
      await expect(form.getByLabel('Stored analysis ID',{exact:true})).toHaveValue(String(chunkedSource.analysisId))
      await form.getByLabel('Exact stored quote',{exact:true}).fill(chunkedSource.quote)
      await form.getByRole('button',{name:'Check stored passage',exact:true}).click()
      await expect(form.getByText('Matched to stored extraction',{exact:true})).toBeVisible()
      await form.getByLabel('Imported assertion wording',{exact:true}).fill('The full report contains a later reopening account.')
      await form.getByRole('button',{name:'Import matched passage',exact:true}).click()
      await expect(form.getByText('Stored passage imported',{exact:true})).toBeVisible()
      const imported=(await exported(page)).analystWorkspace
      const assertion=imported.evidence!.assertions.find(item=>item.passage.quote===chunkedSource.quote)!
      expect(assertion.passage.id).toBe(`passage:${chunkedSource.analysisId}:${sourceDigest(chunkedSource.text)}:112000:${112000+chunkedSource.quote.length}`)
      expect(await page.evaluate(key=>localStorage.getItem(key),draftKey)).toBe(raw)
      const screenshot=testInfo.outputPath('chunk-import.png');await form.screenshot({path:screenshot,animations:'disabled'});await testInfo.attach('Chunk import form',{path:screenshot,contentType:'image/png'})
      await page.getByRole('button',{name:'Save changes',exact:true}).click();await saved(page)
      await page.reload();await page.getByRole('button',{name:'Open saved timeline',exact:true}).click();await saved(page)
      expect((await exported(page)).analystWorkspace.evidence).toEqual(imported.evidence)
      expect(await page.evaluate(key=>localStorage.getItem(key),draftKey)).toBe(raw)
    }finally{await b.mf.dispose()}
  })
  test('a delayed source list cannot restore private titles after sign-out',async({page})=>{
    test.setTimeout(90_000)
    const b=await bridge(page);let release=()=>{}
    try {
      await page.goto('/dashboard/tools/timeline');await importFixture(page)
      await page.getByRole('button',{name:'Save timeline',exact:true}).click();await saved(page)
      await page.reload();await page.getByRole('button',{name:'Open saved timeline',exact:true}).click();await saved(page)
      const raw=await page.evaluate(key=>localStorage.getItem(key),draftKey)
      const panel=page.getByTestId('evidence-event:unknown.1');await panel.locator('summary').first().click()
      b.faults.holdCandidates=new Promise<void>(resolve=>{release=resolve})
      await panel.getByRole('button',{name:'Load recent stored sources',exact:true}).click()
      await expect.poll(()=>b.faults.candidatesReady).toBe(true)
      await page.evaluate(async()=>{const {useAuthStore}=await import('/src/stores/auth.ts');useAuthStore.setState({isAuthenticated:false,user:null})})
      release();await expect.poll(()=>b.faults.candidatesDelivered).toBe(true)
      await expect(page.getByRole('region',{name:'Recent stored sources',exact:true})).toHaveCount(0)
      await expect(page.getByRole('button',{name:`Use analysis ${storedSource.analysisId}: ${storedSource.title}`,exact:true})).toHaveCount(0)
      expect(await page.evaluate(key=>localStorage.getItem(key),draftKey)).toBe(raw)
    }finally{release();await b.mf.dispose()}
  })
  test('source picker rejects malformed and oversized replies and ignores a list after manual ID editing',async({page})=>{
    test.setTimeout(120_000)
    const b=await bridge(page);let release=()=>{}
    try {
      await page.goto('/dashboard/tools/timeline');await importFixture(page)
      await page.getByRole('button',{name:'Save timeline',exact:true}).click();await saved(page)
      await page.reload();await page.getByRole('button',{name:'Open saved timeline',exact:true}).click();await saved(page)
      const raw=await page.evaluate(key=>localStorage.getItem(key),draftKey)
      const panel=page.getByTestId('evidence-event:unknown.1');await panel.locator('summary').first().click()
      const form=panel.getByRole('region',{name:'Import stored passage'}),picker=form.getByRole('region',{name:'Recent stored sources',exact:true})
      const valid={schemaVersion:'timeline-source-candidates.v1',workspaceId:'browser-private',items:[{analysisId:storedSource.analysisId,title:storedSource.title}]}
      for(const body of [JSON.stringify({...valid,workspaceId:'browser-other'}),JSON.stringify({...valid,items:[...valid.items,...valid.items]}),JSON.stringify({...valid,items:[{...valid.items[0],title:'x'.repeat(70000)}]})]){
        b.faults.candidatesOverride=body
        await picker.getByRole('button',{name:'Load recent stored sources',exact:true}).click()
        await expect(picker.getByRole('alert')).toBeVisible()
        await expect(picker.getByRole('button',{name:/Use analysis/})).toHaveCount(0)
        await expect(form.getByLabel('Stored analysis ID',{exact:true})).toHaveValue('')
      }
      b.faults.candidatesOverride=null;b.faults.candidatesReady=false;b.faults.candidatesDelivered=false
      b.faults.holdCandidates=new Promise<void>(resolve=>{release=resolve})
      await picker.getByRole('button',{name:'Load recent stored sources',exact:true}).click()
      await expect.poll(()=>b.faults.candidatesReady).toBe(true)
      await form.getByLabel('Stored analysis ID',{exact:true}).fill('999')
      release();await expect.poll(()=>b.faults.candidatesDelivered).toBe(true)
      await expect(picker.getByRole('button',{name:/Use analysis/})).toHaveCount(0)
      await expect(form.getByLabel('Stored analysis ID',{exact:true})).toHaveValue('999')
      expect(await page.evaluate(key=>localStorage.getItem(key),draftKey)).toBe(raw)
    }finally{release();await b.mf.dispose()}
  })
  test('a delayed private passage response cannot restore content after sign-out', async ({ page }) => {
    test.setTimeout(90_000)
    const b = await bridge(page)
    let release = () => {}
    try {
      await page.goto('/dashboard/tools/timeline'); await importFixture(page)
      await page.getByRole('button', { name: 'Save timeline', exact: true }).click(); await saved(page)
      await page.reload(); await page.getByRole('button', { name: 'Open saved timeline', exact: true }).click(); await saved(page)
      const raw = await page.evaluate(key => localStorage.getItem(key), draftKey)
      const panel = page.getByTestId('evidence-event:unknown.1')
      await panel.locator('summary').first().click()
      const form = panel.getByRole('region', { name: 'Import stored passage' })
      await form.getByLabel('Stored analysis ID', { exact: true }).fill(String(storedSource.analysisId))
      await form.getByLabel('Exact stored quote', { exact: true }).fill(storedSource.quote)
      b.faults.holdSource = new Promise<void>(resolve => { release = resolve })
      await form.getByRole('button', { name: 'Check stored passage', exact: true }).click()
      await expect.poll(() => b.faults.sourceReady).toBe(true)
      await page.evaluate(async () => { const { useAuthStore } = await import('/src/stores/auth.ts'); useAuthStore.setState({ isAuthenticated: false, user: null }) })
      await expect(page.getByRole('button', { name: 'Export JSON', exact: true })).toHaveCount(0)
      release()
      await expect.poll(() => b.faults.sourceDelivered).toBe(true)
      await expect(page.getByRole('region', { name: 'Import stored passage' })).toHaveCount(0)
      await expect(page.getByText('Matched to stored extraction', { exact: true })).toHaveCount(0)
      expect(await page.evaluate(key => localStorage.getItem(key), draftKey)).toBe(raw)
    } finally { release(); await b.mf.dispose() }
  })
  test('stored passage import survives private revisions without entering the browser draft', async ({ page }, testInfo) => {
    test.setTimeout(120_000)
    const b = await bridge(page)
    try {
      await page.goto('/dashboard/tools/timeline'); await importFixture(page)
      await page.getByRole('button', { name: 'Save timeline', exact: true }).click(); await saved(page)
      await page.reload(); await page.getByRole('button', { name: 'Open saved timeline', exact: true }).click(); await saved(page)
      const raw = await page.evaluate(key => localStorage.getItem(key), draftKey)
      const panel = page.getByTestId('evidence-event:unknown.1')
      await panel.locator('summary').first().click()
      const form = panel.getByRole('region', { name: 'Import stored passage' })
      await form.getByLabel('Stored analysis ID', { exact: true }).fill(String(storedSource.analysisId))
      await form.getByLabel('Exact stored quote', { exact: true }).fill(storedSource.quote)
      await form.getByRole('button', { name: 'Check stored passage', exact: true }).click()
      await expect(form.getByText('Matched to stored extraction', { exact: true })).toBeVisible()
      await form.getByLabel('Imported assertion wording', { exact: true }).fill('The stored report describes a delivery reopening.')
      await form.getByLabel('Imported assertion relation', { exact: true }).selectOption('supports')
      await form.getByRole('button', { name: 'Import matched passage', exact: true }).click()
      await expect(form.getByText('Stored passage imported', { exact: true })).toBeVisible()
      const imported = await exported(page)
      const assertion = imported.analystWorkspace.evidence!.assertions.find(item => item.passage.quote === storedSource.quote)!
      expect(assertion.claimText).toBe('The stored report describes a delivery reopening.')
      expect(assertion.passage.locator).toContain(sourceDigest(storedSource.text))
      const start = storedSource.text.indexOf(storedSource.quote)
      expect(assertion.passage.id).toBe(`passage:${storedSource.analysisId}:${sourceDigest(storedSource.text)}:${start}:${start + storedSource.quote.length}`)
      expect(imported.analystWorkspace.events[0].assessment).toBe('disputed')
      expect(await page.evaluate(key => localStorage.getItem(key), draftKey)).toBe(raw)
      await page.getByRole('button', { name: 'Save changes', exact: true }).click(); await saved(page)
      await page.reload(); await page.getByRole('button', { name: 'Open saved timeline', exact: true }).click(); await saved(page)
      expect((await exported(page)).analystWorkspace.evidence).toEqual(imported.analystWorkspace.evidence)
      await page.getByTestId('evidence-event:unknown.1').locator('summary').first().click()
      const screenshot = testInfo.outputPath('stored-source-import.png')
      await page.screenshot({ path: screenshot, fullPage: true, animations: 'disabled' })
      await testInfo.attach('Stored source import', { path: screenshot, contentType: 'image/png' })
      await page.evaluate(async () => { const { useAuthStore } = await import('/src/stores/auth.ts'); useAuthStore.setState({ isAuthenticated: false, user: null }) })
      await expect(page.getByRole('button', { name: 'Export JSON', exact: true })).toHaveCount(0)
      await expect(page.getByText(storedSource.quote, { exact: true })).toHaveCount(0)
      expect(await page.evaluate(key => localStorage.getItem(key), draftKey)).toBe(raw)
    } finally { await b.mf.dispose() }
  })
  test('stored passage changes after preview refuse import and preserve the open workspace', async ({ page }) => {
    test.setTimeout(90_000)
    const b = await bridge(page)
    try {
      await page.goto('/dashboard/tools/timeline'); await importFixture(page)
      await page.getByRole('button', { name: 'Save timeline', exact: true }).click(); await saved(page)
      await page.reload(); await page.getByRole('button', { name: 'Open saved timeline', exact: true }).click(); await saved(page)
      const before = (await exported(page)).analystWorkspace
      const panel = page.getByTestId('evidence-event:unknown.1')
      await panel.locator('summary').first().click()
      const form = panel.getByRole('region', { name: 'Import stored passage' })
      await form.getByLabel('Stored analysis ID', { exact: true }).fill(String(storedSource.analysisId))
      await form.getByLabel('Exact stored quote', { exact: true }).fill(storedSource.quote)
      await form.getByRole('button', { name: 'Check stored passage', exact: true }).click()
      await expect(form.getByText('Matched to stored extraction', { exact: true })).toBeVisible()
      await form.getByLabel('Imported assertion wording', { exact: true }).fill('Review this changed report.')
      const changed = storedSource.text + ' Updated later.'
      await b.db.prepare('UPDATE content_analysis SET extracted_text=?,content_hash=? WHERE id=?').bind(changed,sourceDigest(changed),storedSource.analysisId).run()
      await form.getByRole('button', { name: 'Import matched passage', exact: true }).click()
      await expect(form.getByRole('alert')).toBeVisible()
      expect((await exported(page)).analystWorkspace).toEqual(before)
    } finally { await b.mf.dispose() }
  })
  test('optional editor fields use the same JSON identity as durable saves', () => {
    const value = fixture(); value.analystWorkspace.events[0].chapterId = undefined
    expect(snapshotIdentity(value)).toBe(snapshotIdentity(prepareTimelineSave(value).snapshot))
  })
  test('complete save/reopen round trip preserves IDs and private edits stay out of local draft', async ({ page }, info) => {
    const b = await bridge(page)
    try {
      await page.goto('/dashboard/tools/timeline'); await importFixture(page)
      const before = await exported(page)
      await page.getByRole('button', { name: 'Save timeline', exact: true }).click(); await saved(page)
      const raw = await page.evaluate(key => localStorage.getItem(key), draftKey)
      await page.reload(); await page.getByRole('button', { name: 'Open saved timeline', exact: true }).click()
      await saved(page)
      const after = await exported(page)
      expect(after.source).toEqual(before.source); expect(after.analystWorkspace).toEqual(before.analystWorkspace)
      await page.getByLabel('Narrative title', { exact: true }).fill('Private remote edits')
      await expect(page.getByTestId('timeline-save-state')).toHaveText('Unsaved changes')
      expect(await page.evaluate(key => localStorage.getItem(key), draftKey)).toBe(raw)
      await page.getByRole('button', { name: 'Save changes', exact: true }).click(); await saved(page)
      expect(b.calls.filter(c => c.method === 'PATCH')).toHaveLength(2)
      await page.screenshot({ path: info.outputPath('durable-saving.png'), fullPage: true })
      await page.getByLabel('Saving workspace', { exact: true }).selectOption('browser-other')
      await expect(page.getByRole('button', { name: 'Export JSON', exact: true })).toHaveCount(0)
      expect(await page.evaluate(key => localStorage.getItem(key), draftKey)).toBe(raw)
    } finally { await b.mf.dispose() }
  })
  test('lost create and commit responses retry original keys without duplicate artifacts or revisions', async ({ page }) => {
    const b = await bridge(page)
    try {
      await page.goto('/dashboard/tools/timeline'); await importFixture(page)
      b.faults.dropCreate = true
      await page.getByRole('button', { name: 'Save timeline', exact: true }).click()
      await expect(page.getByRole('button', { name: 'Retry previous save', exact: true })).toBeEnabled()
      b.faults.dropCommit = true
      await page.getByRole('button', { name: 'Retry previous save', exact: true }).click()
      await expect(page.getByRole('button', { name: 'Retry previous save', exact: true })).toBeEnabled()
      const refreshed = 'browser-refreshed-human-0001'
      await b.db.prepare('UPDATE users SET user_hash=? WHERE id=1').bind(refreshed).run()
      await page.evaluate(token => { localStorage.setItem('omnicore_user_hash', token); localStorage.setItem('omnicore_tokens', JSON.stringify({ access_token: token, issued_at: Date.now(), expires_in: 3600 })) }, refreshed)
      await page.getByLabel('Narrative title', { exact: true }).fill('Edits made after lost response')
      await page.getByRole('button', { name: 'Retry previous save', exact: true }).click()
      await expect(page.getByTestId('timeline-save-state')).toHaveText('Unsaved changes')
      const creates = b.calls.filter(c => c.method === 'POST'), commits = b.calls.filter(c => c.method === 'PATCH')
      expect(creates).toHaveLength(2); expect(commits).toHaveLength(2)
      expect(creates[0].key).toBe(creates[1].key); expect(creates[0].body).toBe(creates[1].body)
      expect(commits[0].key).toBe(commits[1].key); expect(commits[0].etag).toBe(commits[1].etag); expect(commits[0].body).toBe(commits[1].body)
      expect((await b.db.prepare('SELECT count(*) AS n FROM timeline_artifacts').first())?.n).toBe(1)
      expect((await b.db.prepare('SELECT count(*) AS n FROM timeline_revisions').first())?.n).toBe(2)
      await page.getByRole('button', { name: 'Save changes', exact: true }).click(); await saved(page)
    } finally { await b.mf.dispose() }
  })
  test('stale save and malformed reopen preserve edited workspace; separate copy is explicit', async ({ page }) => {
    const b = await bridge(page)
    try {
      await page.goto('/dashboard/tools/timeline'); await importFixture(page)
      await page.getByRole('button', { name: 'Save timeline', exact: true }).click(); await saved(page)
      const last = b.calls.findLast(c => c.method === 'PATCH')!
      const outside = new Request(`https://fixture.test/api/timelines/${last.response.artifactId}`, { method: 'PATCH', headers: { 'X-User-Hash': hash, 'Content-Type': 'application/json', 'Idempotency-Key': 'outside-concurrent-save01', 'If-Match': `"${last.response.revisionId}"` }, body: last.body })
      expect((await onRequestPatch({ request: outside, env: { DB: b.db }, params: { id: last.response.artifactId } } as never)).status).toBe(200)
      await page.getByLabel('Narrative title', { exact: true }).fill('Local conflict edits')
      await page.getByRole('button', { name: 'Save changes', exact: true }).click()
      await expect(page.getByText(/Someone saved a newer revision/)).toBeVisible()
      expect((await exported(page)).analystWorkspace.narrative?.title).toBe('Local conflict edits')
      b.faults.malformedRead = true; page.once('dialog', dialog => dialog.accept())
      await page.getByRole('button', { name: 'Open saved timeline', exact: true }).click()
      await expect(page.getByText(/did not match this workspace/)).toBeVisible()
      expect((await exported(page)).analystWorkspace.narrative?.title).toBe('Local conflict edits')
      b.faults.malformedRead = false
      await page.getByRole('button', { name: 'Save a separate copy', exact: true }).click(); await saved(page)
      expect((await b.db.prepare('SELECT count(*) AS n FROM timeline_artifacts').first())?.n).toBe(2)
    } finally { await b.mf.dispose() }
  })
  test('oversize rejection sends no timeline requests and guest saving remains unavailable', async ({ page }) => {
    const b = await bridge(page)
    try {
      await page.goto('/dashboard/tools/timeline')
      const value = fixture()
      value.analystWorkspace.questions = Array.from({ length: 8 }, (_, i) => ({ id: `question-${i}`, question: 'x'.repeat(9000), status: 'open', answer: '' }))
      await importFixture(page, value)
      await page.getByRole('button', { name: 'Save timeline', exact: true }).click()
      await expect(page.getByText(/Workspace saving supports timelines up to 60 KiB/)).toBeVisible()
      expect(b.calls).toHaveLength(0); expect((await exported(page)).analystWorkspace.questions).toHaveLength(8)
      await page.evaluate(async () => { const { useAuthStore } = await import('/src/stores/auth.ts'); useAuthStore.setState({ isAuthenticated: false, user: null }) })
      await expect(page.getByText(/Sign in to save complete timelines/)).toBeVisible()
      await expect(page.getByRole('button', { name: 'Save timeline', exact: true })).toHaveCount(0)
    } finally { await b.mf.dispose() }
  })
  test('same-user deactivation clears opened private content and leaves local draft intact', async ({ page }) => {
    const b = await bridge(page)
    try {
      await page.goto('/dashboard/tools/timeline'); await importFixture(page)
      await page.getByRole('button', { name: 'Save timeline', exact: true }).click(); await saved(page)
      await page.reload(); await page.getByRole('button', { name: 'Open saved timeline', exact: true }).click(); await saved(page)
      const raw = await page.evaluate(key => localStorage.getItem(key), draftKey)
      for (const inactive of [false, 0]) {
        await page.evaluate(async inactive => { const { useAuthStore } = await import('/src/stores/auth.ts'); useAuthStore.setState({ user: { ...useAuthStore.getState().user!, is_active: inactive } as never }) }, inactive)
        await expect(page.getByRole('button', { name: 'Export JSON', exact: true })).toHaveCount(0)
        expect(await page.evaluate(key => localStorage.getItem(key), draftKey)).toBe(raw)
        if (inactive === false) {
          await page.evaluate(async () => { const { useAuthStore } = await import('/src/stores/auth.ts'); useAuthStore.setState({ user: { ...useAuthStore.getState().user!, is_active: true } }) })
          await page.getByRole('button', { name: 'Open saved timeline', exact: true }).click(); await saved(page)
        }
      }
    } finally { await b.mf.dispose() }
  })
})
