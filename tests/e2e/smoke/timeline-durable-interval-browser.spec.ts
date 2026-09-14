import { test, expect, type Page, type Locator } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { Miniflare } from 'miniflare'
import { onRequestPost } from '../../../functions/api/timelines'
import { onRequestGet, onRequestPatch } from '../../../functions/api/timelines/[id]'
import { onRequestGet as objects } from '../../../functions/api/timelines/[id]/objects'
import { onRequestGet as revisions } from '../../../functions/api/timelines/[id]/revisions'
import { decodeTimelineWorkspace } from '../../../src/lib/timeline-workspace-codec'

const human = 'durable-interval-synthetic-human'
function fixture(interval = false) {
  return decodeTimelineWorkspace(JSON.stringify({ schemaVersion: interval ? 'timeline-workspace.v2' : 'timeline-workspace.v1', exportedAt: '2026-09-14T12:00:00.000Z', source: { schemaVersion: 'timeline-manual.v1', title: 'Private interval notebook' }, analystWorkspace: {
    mode: 'robust', questions: [], hypotheses: [], narrative: { title: 'Private repair account', framing: 'A recorded maintenance window', question: '', intendedUse: '', scope: '', timezone: 'UTC', dataThrough: '', chapters: [] },
    events: [{ id: 'private:repairs', title: 'Repairs documented', description: 'The private record describes a maintenance window.', eventDate: '2026-09-10', eventTime: '09:00', datePrecision: 'day', ...(interval ? { recordedEnd: { date: '2026-09-12', precision: 'day', time: '17:30:59' } } : {}), category: 'event', importance: 'normal', origin: 'analyst', assessment: 'unreviewed', analystNote: 'Retain this private note', modified: false, placement: { mode: 'absolute' }, sequenceOrder: 0, narrativeIncluded: true, narrativeOrder: 0 }],
  } }))
}
async function disclose(page: Page, name: string) {
  const summary = page.locator('summary').filter({ hasText: new RegExp(`^${name}$`) })
  if (await summary.locator('..').getAttribute('open') === null) await summary.click()
}
async function bridge(page: Page) {
  const mf = new Miniflare({ modules: true, script: 'export default {fetch(){return new Response("ok")}}', d1Databases: { DB: 'durable-interval-browser' } })
  const db = await mf.getD1Database('DB')
  const sql = (name: string) => readFileSync(new URL(`../../../schema/managed-migrations/${name}`, import.meta.url), 'utf8').split('-- statement\n').slice(1).map(s => s.trim())
  for (const query of [
    'CREATE TABLE users(id INTEGER PRIMARY KEY,user_hash TEXT UNIQUE,role TEXT NOT NULL,is_active INTEGER NOT NULL)',
    'CREATE TABLE workspaces(id TEXT PRIMARY KEY,owner_id INTEGER REFERENCES users(id),is_public INTEGER NOT NULL)',
    'CREATE TABLE workspace_members(id TEXT PRIMARY KEY,workspace_id TEXT REFERENCES workspaces(id),user_id INTEGER REFERENCES users(id),role TEXT NOT NULL)',
    `INSERT INTO users VALUES(1,'${human}','researcher',1)`,
    "INSERT INTO workspaces VALUES('interval-private',1,0),('interval-other',1,0)",
    ...sql('0011_timeline_foundation.sql'),
  ]) await db.prepare(query).run()
  for (const name of ['0012_timeline_workspace_snapshots.sql', '0015_timeline_workspace_intervals.sql']) await db.batch(sql(name).map(s => db.prepare(s)))
  const faults = { dropCommit: false, malformedObjects: false }
  const calls: Array<{ path: string; method: string; body: string | null; key?: string; etag?: string; status: number; response: any }> = []
  await page.addInitScript(hash => {
    localStorage.setItem('omnicore_user_hash', hash)
    localStorage.setItem('omnicore_tokens', JSON.stringify({ access_token: hash, issued_at: Date.now(), expires_in: 3600 }))
    localStorage.setItem('auth-storage', JSON.stringify({ state: { user: { id: 1, role: 'researcher', is_active: true }, isAuthenticated: true }, version: 0 }))
    localStorage.setItem('omnicore_workspace_id', 'interval-private')
  }, human)
  await page.route('**/api/**', async route => {
    const incoming = route.request(), url = new URL(incoming.url())
    if (!url.pathname.startsWith('/api/')) return route.continue()
    if (url.pathname === '/api/workspaces') return route.fulfill({ json: { owned: ['interval-private', 'interval-other'].map(id => ({ id, name: id, owner_id: 1, is_public: false, type: 'PERSONAL' })), member: [] } })
    if (url.pathname === '/api/auth/me') return route.fulfill({ json: { id: 1, role: 'researcher', is_active: true } })
    if (!url.pathname.startsWith('/api/timelines')) return route.fulfill({ json: {} })
    const request = new Request(url, { method: incoming.method(), headers: incoming.headers(), ...(incoming.postData() ? { body: incoming.postData()! } : {}) })
    const id = url.pathname.split('/')[3]
    const handler = incoming.method() === 'POST' ? onRequestPost : incoming.method() === 'PATCH' ? onRequestPatch : url.pathname.endsWith('/objects') ? objects : url.pathname.endsWith('/revisions') ? revisions : onRequestGet
    const response = await handler({ request, env: { DB: db }, params: { id } } as never)
    const body = await response.text()
    calls.push({ path: url.pathname, method: request.method, body: incoming.postData(), key: incoming.headers()['idempotency-key'], etag: incoming.headers()['if-match'], status: response.status, response: JSON.parse(body) })
    if (request.method === 'PATCH' && faults.dropCommit) { faults.dropCommit = false; return route.abort('failed') }
    if (url.pathname.endsWith('/objects') && faults.malformedObjects) return route.fulfill({ status: 200, json: { schemaVersion: 'wrong' }, headers: Object.fromEntries(response.headers) })
    return route.fulfill({ status: response.status, body, headers: Object.fromEntries(response.headers) })
  })
  return { mf, db, calls, faults }
}
async function start(page: Page, interval = false) {
  await page.goto('/dashboard/tools/timeline')
  await disclose(page, 'Start or import a timeline')
  await page.getByLabel('Import timeline JSON').setInputFiles({ name: 'private.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(fixture(interval))) })
  await expect(page.getByRole('button', { name: 'Save timeline', exact: true })).toBeEnabled()
}
async function download(page: Page, root: Page | Locator = page, name = 'Export JSON') {
  const pending = page.waitForEvent('download')
  await root.getByRole('button', { name, exact: true }).click()
  return JSON.parse(await readFile((await (await pending).path())!, 'utf8'))
}
async function endDate(page: Page, enabled: boolean) {
  await page.getByRole('button', { name: 'Actions for Repairs documented', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Edit event', exact: true }).click()
  const editor = page.getByRole('dialog', { name: 'Edit timeline event', exact: true })
  await editor.getByLabel('Record an end date', { exact: true }).setChecked(enabled)
  if (enabled) {
    await editor.getByLabel('End date', { exact: true }).fill('2026-09-12')
    await editor.getByLabel('End time (optional)', { exact: true }).fill('17:30:59')
  }
  await editor.getByRole('button', { name: 'Save event', exact: true }).click()
  await expect(editor).toBeHidden()
}
async function save(page: Page, initial = false) {
  await page.getByRole('button', { name: initial ? 'Save timeline' : 'Save changes', exact: true }).click()
  await expect(page.getByTestId('timeline-save-state')).toHaveText('Saved')
}

test.describe('Durable recorded interval browser @smoke', () => {
  test('saves v1 to v2 to v1 in one artifact and inspects immutable interval history without replacing edits', async ({ page }, info) => {
    test.setTimeout(180_000)
    const b = await bridge(page)
    try {
      await start(page); await save(page, true)
      const first = b.calls.findLast(c => c.method === 'PATCH')!
      await endDate(page, true); await save(page)
      const second = b.calls.findLast(c => c.method === 'PATCH')!
      expect(JSON.parse(second.body!).changes[0].kind).toBe('timeline-workspace.v2')
      expect(second.response.artifactId).toBe(first.response.artifactId)
      await disclose(page, 'Saved versions and links')
      await expect(page.getByRole('button', { name: 'Save a separate copy', exact: true })).toBeEnabled()
      await page.reload(); await disclose(page, 'Saved versions and links')
      await page.getByRole('button', { name: 'Open saved timeline', exact: true }).click()
      await expect(page.getByTestId('timeline-save-state')).toHaveText('Saved')
      expect((await download(page)).analystWorkspace).toEqual(JSON.parse(second.body!).changes[0].payload.analystWorkspace)
      await endDate(page, false); await save(page)
      const third = b.calls.findLast(c => c.method === 'PATCH')!
      expect(JSON.parse(third.body!).changes[0].kind).toBe('timeline-workspace.v1')
      expect(third.response.artifactId).toBe(first.response.artifactId)
      expect([first.response.sequence, second.response.sequence, third.response.sequence]).toEqual([1, 2, 3])
      const versions = (await b.db.prepare('SELECT id,payload_json,content_hash,schema_version FROM timeline_object_versions ORDER BY created_at,id').all()).results
      expect(versions).toHaveLength(3)
      expect((await b.db.prepare('SELECT kind FROM timeline_objects').first())?.kind).toBe('timeline-workspace.v1')
      await page.getByLabel('Narrative title', { exact: true }).fill('Unsubmitted private revision')
      const editing = await download(page)
      await disclose(page, 'Saved versions and links')
      const history = page.getByRole('region', { name: 'Saved revision history', exact: true })
      await history.getByRole('button', { name: 'Load revision history', exact: true }).click()
      const writes = b.calls.filter(c => c.method === 'PATCH').length
      for (const commit of [first, second]) {
        await history.getByRole('button', { name: `Inspect revision ${commit.response.sequence}`, exact: true }).click()
        const selected = page.getByRole('region', { name: 'Selected historical revision', exact: true })
        await selected.getByRole('button', { name: 'Preview selected revision', exact: true }).click()
        const dialog = page.getByRole('dialog', { name: 'Selected revision preview', exact: true })
        expect(await download(page, dialog, 'Download ResearchTools JSON')).toEqual(JSON.parse(commit.body!).changes[0].payload)
        if (commit === second) {
          const projection = await download(page, dialog, 'Download TimelineJS JSON')
          expect(projection.events[0].end_date).toEqual({ year: 2026, month: 9, day: 12, hour: 17, minute: 30, second: 59 })
          await dialog.getByRole('button', { name: 'Open presentation', exact: true }).click()
          await expect(page.getByText('TimelineJS presentation loaded', { exact: true })).toBeAttached()
          const frame = page.frameLocator('iframe[title="TimelineJS narrative presentation"]')
          await frame.getByRole('button', { name: 'Next slide', exact: true }).click()
          await expect(frame.locator('#slide-position')).toHaveText('Slide 2 of 2')
          const headline = frame.locator('.tl-storyslider .tl-headline').filter({ hasText: /^Repairs documented$/ })
          await expect(headline).toBeInViewport({ ratio: 1 })
          await expect.poll(() => headline.evaluate(async element => {
            const bounds = () => element.getBoundingClientRect()
            const first = bounds()
            await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
            const last = bounds()
            const story = element.closest('.tl-storyslider')!.getBoundingClientRect()
            return Math.abs(first.x - last.x) < 0.5 && Math.abs(first.y - last.y) < 0.5
              && last.left >= story.left && last.right <= story.right
              && last.top >= story.top && last.bottom <= story.bottom
          })).toBe(true)
          await page.screenshot({ path: info.outputPath('durable-interval-history.png'), animations: 'disabled', scale: 'css' })
        }
        await dialog.getByRole('button', { name: 'Close', exact: true }).click()
        expect((await download(page)).analystWorkspace).toEqual(editing.analystWorkspace)
      }
      expect(b.calls.filter(c => c.method === 'PATCH')).toHaveLength(writes)
      expect((await b.db.prepare('SELECT id,payload_json,content_hash,schema_version FROM timeline_object_versions ORDER BY created_at,id').all()).results).toEqual(versions)
      expect(await page.evaluate(() => localStorage.getItem('researchtools.timeline.manual-draft.v1') || '')).not.toContain('Unsubmitted private revision')
      await save(page)
      expect(b.calls.findLast(c => c.method === 'PATCH')!.etag).toBe(`"${third.response.revisionId}"`)
    } finally { await b.mf.dispose() }
  })

  test('lost interval commit retries exact v2 bytes after v1 edits and malformed reopen preserves the working copy', async ({ page }) => {
    test.setTimeout(120_000)
    const b = await bridge(page)
    try {
      await start(page, true); b.faults.dropCommit = true
      await page.getByRole('button', { name: 'Save timeline', exact: true }).click()
      await expect(page.getByRole('button', { name: 'Retry previous save', exact: true })).toBeEnabled()
      const lost = b.calls.findLast(c => c.method === 'PATCH')!
      expect(lost.status).toBe(200)
      await endDate(page, false)
      const editing = await download(page); expect(editing.schemaVersion).toBe('timeline-workspace.v1')
      await page.getByRole('button', { name: 'Retry previous save', exact: true }).click()
      await expect(page.getByTestId('timeline-save-state')).toHaveText('Unsaved changes')
      const retry = b.calls.findLast(c => c.method === 'PATCH')!
      expect({ body: retry.body, key: retry.key, etag: retry.etag }).toEqual({ body: lost.body, key: lost.key, etag: lost.etag })
      expect(retry.response.revisionId).toBe(lost.response.revisionId)
      expect((await b.db.prepare('SELECT count(*) AS n FROM timeline_object_versions').first())?.n).toBe(1)
      await disclose(page, 'Saved versions and links')
      await page.getByRole('button', { name: 'Preview saved revision', exact: true }).click()
      const dialog = page.getByRole('dialog', { name: 'Saved revision preview', exact: true })
      expect(await download(page, dialog, 'Download ResearchTools JSON')).toEqual(JSON.parse(lost.body!).changes[0].payload)
      await dialog.getByRole('button', { name: 'Close', exact: true }).click()
      b.faults.malformedObjects = true
      page.once('dialog', dialog => void dialog.accept())
      await page.getByRole('button', { name: 'Open saved timeline', exact: true }).click()
      await expect(page.getByRole('region', { name: 'Workspace saving', exact: true })).toContainText('incomplete or mismatched revision')
      expect((await download(page)).analystWorkspace).toEqual(editing.analystWorkspace)
      await expect(page.getByTestId('timeline-save-state')).toHaveText('Unsaved changes')
      b.faults.malformedObjects = false; await save(page)
      const commit = b.calls.findLast(c => c.method === 'PATCH')!
      expect(JSON.parse(commit.body!).changes[0].kind).toBe('timeline-workspace.v1')
      expect(commit.etag).toBe(`"${lost.response.revisionId}"`)
      expect((await b.db.prepare('SELECT kind FROM timeline_objects').first())?.kind).toBe('timeline-workspace.v2')
      expect((await b.db.prepare('SELECT count(*) AS n FROM timeline_object_versions').first())?.n).toBe(2)
    } finally { await b.mf.dispose() }
  })
})
