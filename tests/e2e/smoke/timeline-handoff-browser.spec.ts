import { expect, test, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { Miniflare } from 'miniflare'
import type { D1Database } from '@cloudflare/workers-types'
import { onRequestPost as mintHandoff } from '../../../functions/api/timeline-handoffs'
import { onRequestPost as redeemHandoff } from '../../../functions/api/timeline-handoffs/[token]/redeem'
import { onRequestPost as createTimeline } from '../../../functions/api/timelines'
import { onRequestGet as readTimeline, onRequestPatch as commitTimeline } from '../../../functions/api/timelines/[id]'
import { onRequestGet as readObjects } from '../../../functions/api/timelines/[id]/objects'
import { onRequestGet as readRevisions } from '../../../functions/api/timelines/[id]/revisions'
import { deriveIntegrationTokenHash } from '../../../functions/api/_shared/service-auth'
import type { TimelineWorkspaceExport } from '../../../src/types/timeline-workspace'

// Copied verbatim from tests/e2e/smoke/timeline-handoff-d1.spec.ts — trigger-aware statement
// splitter so managed-migration files (with BEGIN...END trigger bodies) rehearse correctly.
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
const migration = (name: string) => statements(readFileSync(new URL(`../../../schema/managed-migrations/${name}`, import.meta.url), 'utf8'))

const hashKey = 'handoff-browser-key-material-0000000000000'
const client = 'handoff_browser_client_01'
const secret = 'A'.repeat(43)
const readerHash = 'handoff-browser-reader-0001'
const readerSubject = 'authentik-sub-browser-0001'
const otherSubject = 'authentik-sub-browser-0002'
const serviceEnv = (db: D1Database) => ({ DB: db, ENVIRONMENT: 'production', INTEGRATION_TOKEN_HASH_KEY: hashKey, COMMUNITY_INTEGRATIONS_ENABLED: 'true' })

const returnUrl = 'https://reader.example/link/abc123'
const storyReturnUrl = 'https://reader.example/story/content-update'
const returnLabel = 'IrregularChat Links — Content update deployed'

function event(overrides: Record<string, unknown> = {}) {
  return { eventDate: '2024-07-19', datePrecision: 'day', title: 'Something happened', description: null, category: 'event', importance: 'normal', sourceUrls: ['https://publisher.example/story'], ...overrides }
}
function articlePayload() {
  return {
    schemaVersion: 'timeline-handoff-request.v1', audience: 'researchtools-community.v1', kind: 'article',
    title: 'Content update deployed',
    origin: { product: 'irregulars-rss', returnUrl, returnLabel },
    items: [{ url: 'https://publisher.example/story', title: 'Publisher story', publisher: 'publisher.example', publishedAt: '2024-07-19' }],
    events: [event(), event({ eventDate: '2024-07-22', title: 'A second dated claim' })],
  }
}
function articleSetPayload() {
  return {
    ...articlePayload(), kind: 'article-set', title: 'Three outlets on one sequence',
    items: [
      { url: 'https://publisher.example/story', title: 'Publisher story', publisher: 'publisher.example', publishedAt: '2024-07-19' },
      { url: 'https://second.example/report', title: 'Second outlet report', publisher: 'second.example' },
    ],
    events: [
      event({ sourceUrls: ['https://publisher.example/story', 'https://second.example/report'] }),
      event({ eventDate: '2024-07-22', title: 'Corroborated by a second outlet', sourceUrls: ['https://second.example/report'] }),
    ],
  }
}
function storySnapshotPayload() {
  return {
    ...articlePayload(), kind: 'story-snapshot', title: 'Story snapshot at one moment',
    origin: { product: 'irregulars-rss', returnUrl: storyReturnUrl, returnLabel: 'IrregularChat Links — Content update story' },
    coverage: { eventCount: 42, sourceCount: 17 }, storyRevision: 'a1b2c3d4',
  }
}

async function setup() {
  const mf = new Miniflare({ modules: true, script: 'export default {fetch(){return new Response("ok")}}', d1Databases: { DB: 'timeline-handoff-browser' } })
  const db = await mf.getD1Database('DB')
  try {
    for (const statement of statements(`
    CREATE TABLE users(id INTEGER PRIMARY KEY,username TEXT NOT NULL UNIQUE,email TEXT NOT NULL UNIQUE,full_name TEXT NOT NULL,hashed_password TEXT NOT NULL,user_hash TEXT,account_hash TEXT,oidc_sub TEXT,oidc_provider TEXT,oidc_email TEXT,is_active INTEGER NOT NULL,role TEXT NOT NULL);
    CREATE TABLE workspaces(id TEXT PRIMARY KEY,owner_id INTEGER REFERENCES users(id),type TEXT NOT NULL,is_public INTEGER NOT NULL);
    CREATE TABLE workspace_members(id TEXT PRIMARY KEY,workspace_id TEXT REFERENCES workspaces(id),user_id INTEGER REFERENCES users(id),role TEXT NOT NULL);
    CREATE TABLE investigations(id TEXT PRIMARY KEY,workspace_id TEXT REFERENCES workspaces(id),created_by INTEGER REFERENCES users(id),status TEXT NOT NULL);
    `)) await db.prepare(statement).run()
    await db.prepare("INSERT INTO users VALUES(10,'reader','reader@example.test','Reader','disabled',?,NULL,?,'irregulars-io',NULL,1,'researcher')").bind(readerHash, readerSubject).run()
    await db.prepare("INSERT INTO workspaces VALUES('handoff-private',10,'PERSONAL',0)").run()
    for (const name of ['0009_community_service_auth.sql', '0010_service_principal_identity_compat.sql', '0011_timeline_foundation.sql', '0012_timeline_workspace_snapshots.sql', '0013_timeline_service_scopes.sql', '0014_timeline_presentations.sql', '0015_timeline_workspace_intervals.sql', '0016_timeline_workspace_circa.sql', '0017_timeline_handoffs.sql']) {
      await db.batch(migration(name).map(statement => db.prepare(statement)))
    }
    await db.prepare("INSERT INTO users VALUES(2,?,?, 'Service','SERVICE_AUTH_DISABLED',NULL,NULL,NULL,NULL,NULL,1,'service')").bind(`service_${client}`, `service+${client}@service.invalid`).run()
    await db.prepare("INSERT INTO workspaces VALUES('service-workspace',2,'TEAM',0)").run()
    await db.prepare("INSERT INTO investigations VALUES('service-intake','service-workspace',2,'active')").run()
    await db.prepare("INSERT INTO integration_clients(id,community_id,workspace_id,intake_investigation_id,principal_user_id,environment,maximum_visibility,status) VALUES(?,'community-browser','service-workspace','service-intake',2,'production','private','active')").bind(client).run()
    await db.prepare("INSERT INTO integration_client_tokens(id,client_id,slot,secret_hash,created_at,not_before,expires_at) VALUES('handoff_browser_token_01',?,'current',?,unixepoch()-60,unixepoch()-60,unixepoch()+3600)")
      .bind(client, await deriveIntegrationTokenHash(hashKey, client, secret)).run()
    await db.prepare("INSERT INTO integration_client_token_scopes VALUES('handoff_browser_token_01','timeline.write')").run()
    return { mf, db }
  } catch (failure) { await mf.dispose(); throw failure }
}

async function mintToken(db: D1Database, body: unknown, key: string): Promise<string> {
  const request = new Request('https://example.test/api/timeline-handoffs', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key, Authorization: `Bearer rt_svc_${client}.${secret}` },
    body: JSON.stringify(body),
  })
  const response = await mintHandoff({ request, env: serviceEnv(db) } as never)
  expect(response.status).toBe(201)
  return (await response.json() as { token: string }).token
}

async function bridge(page: Page, db: D1Database, signedIn = true) {
  const redeems: string[] = []
  await page.addInitScript(({ hash, signedIn }) => {
    if (!signedIn) return
    localStorage.setItem('omnicore_user_hash', hash)
    localStorage.setItem('omnicore_tokens', JSON.stringify({ access_token: hash, issued_at: Date.now(), expires_in: 3600 }))
    localStorage.setItem('auth-storage', JSON.stringify({ state: { user: { id: 10, role: 'researcher', is_active: true }, isAuthenticated: true }, version: 0 }))
    localStorage.setItem('omnicore_workspace_id', 'handoff-private')
  }, { hash: readerHash, signedIn })
  await page.route('**/api/**', async route => {
    const incoming = route.request(), url = new URL(incoming.url())
    if (!url.pathname.startsWith('/api/')) return route.continue()
    if (url.pathname === '/api/workspaces') {
      return route.fulfill({ json: { owned: [{ id: 'handoff-private', name: 'Private investigation', owner_id: 10, is_public: false, type: 'PERSONAL' }], member: [] } })
    }
    const request = new Request(url, { method: incoming.method(), headers: incoming.headers(), ...(incoming.postData() ? { body: incoming.postData()! } : {}) })
    const redeem = /^\/api\/timeline-handoffs\/([^/]+)\/redeem$/.exec(url.pathname)
    if (redeem) {
      redeems.push(redeem[1])
      const response = await redeemHandoff({ request, env: serviceEnv(db), params: { token: redeem[1] } } as never)
      return route.fulfill({ status: response.status, body: await response.text(), headers: Object.fromEntries(response.headers) })
    }
    if (!url.pathname.startsWith('/api/timelines')) return route.fulfill({ json: {} })
    const id = url.pathname.split('/')[3]
    const handler = incoming.method() === 'POST' ? createTimeline
      : incoming.method() === 'PATCH' ? commitTimeline
        : url.pathname.endsWith('/objects') ? readObjects
          : url.pathname.endsWith('/revisions') ? readRevisions : readTimeline
    const response = await handler({ request, env: { DB: db }, params: { id } } as never)
    return route.fulfill({ status: response.status, body: await response.text(), headers: Object.fromEntries(response.headers) })
  })
  return { redeems }
}

async function openWorkflowDisclosure(page: Page, label: string) {
  const summary = page.locator('summary').filter({ hasText: new RegExp(`^${label}$`) })
  if (await summary.locator('..').getAttribute('open') === null) await summary.click()
}
async function exported(page: Page): Promise<TimelineWorkspaceExport> {
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export JSON', exact: true }).click()
  return JSON.parse(await readFile((await (await download).path())!, 'utf8')) as TimelineWorkspaceExport
}
const openControl = (page: Page) => page.getByRole('button', { name: 'Open handed-off material' })
const panel = (page: Page) => page.getByRole('region', { name: 'Handed-off material' })

/** A fragment-only goto is a same-document navigation, so land through a real one each time. */
async function landing(page: Page, token: string) {
  await page.goto('about:blank')
  await page.goto(`/dashboard/tools/timeline#handoff=${token}`)
}

/** Loads the landing page and proves nothing was consumed by the load itself. */
async function landUnredeemed(page: Page, token: string, redeems: string[]) {
  await landing(page, token)
  await expect(panel(page)).toBeVisible()
  // The fragment is cleared before the first fetch: no request log and no Referer carries it.
  expect(page.url()).not.toContain(token)
  expect(await page.evaluate(() => window.location.hash)).toBe('')
  expect(redeems).toEqual([])
}

/** Redeems, then saves durably and reopens from the saved link. Returns the reopened export. */
async function roundTrip(page: Page, token: string, redeems: string[], expectation: RegExp): Promise<TimelineWorkspaceExport> {
  await landUnredeemed(page, token, redeems)
  await expect(openControl(page)).toBeEnabled()
  expect(redeems).toEqual([])
  await openControl(page).click()
  await expect(panel(page)).toContainText(expectation)
  expect(redeems).toEqual([token])
  await page.getByRole('button', { name: 'Save timeline', exact: true }).click()
  await expect(page.getByTestId('timeline-save-state')).toHaveText('Saved')
  await page.reload()
  await openWorkflowDisclosure(page, 'Saved versions and links')
  await page.getByRole('button', { name: 'Open saved timeline', exact: true }).click()
  await expect(page.getByTestId('timeline-save-state')).toHaveText('Saved')
  return exported(page)
}

test.describe('timeline handoff redemption in the SPA @smoke', () => {
  test('a single-article handoff seeds, saves and reopens with the return link intact', async ({ page }) => {
    test.setTimeout(120_000)
    const { mf, db } = await setup()
    try {
      const { redeems } = await bridge(page, db)
      const token = await mintToken(db, articlePayload(), 'browser-article-01')
      const reopened = await roundTrip(page, token, redeems, /Opened 2 events and 2 sources into a local draft below\./)

      await openWorkflowDisclosure(page, 'Find events and contents')
      await expect(page.getByRole('heading', { name: 'A second dated claim' })).toBeVisible()
      expect(reopened.schemaVersion).toBe('timeline-workspace.v1')
      expect(reopened.source).toEqual({ schemaVersion: 'timeline-manual.v1', title: 'Content update deployed' })
      const evidence = reopened.analystWorkspace.evidence!
      expect(evidence.sources[0]).toMatchObject({ id: 'handoff:origin', url: returnUrl, title: returnLabel, publisher: 'reader.example' })
      expect(evidence.sources[1]).toMatchObject({ id: 'handoff:source:1', url: 'https://publisher.example/story', publishedAt: '2024-07-19T00:00:00.000Z' })
      expect(evidence.assertions).toHaveLength(2)
      expect(evidence.assertions[0].epistemicType).toBe('reported_claim')
      expect(evidence.assertions[0].passage.quote).toBe('')
      expect(evidence.assertions[0].passage.locator).toContain('Aggregated listing, not a verified quotation from the source.')
      expect(evidence.links.every(link => link.relation === 'supports')).toBe(true)
      expect(evidence.reviews).toEqual([])
      expect(reopened.analystWorkspace.events.every(item => item.origin === 'source' && item.assessment === 'unreviewed' && item.modified === false)).toBe(true)
    } finally { await mf.dispose() }
  })

  test('a multi-article handoff carries every contributing outlet through the save', async ({ page }) => {
    test.setTimeout(120_000)
    const { mf, db } = await setup()
    try {
      const { redeems } = await bridge(page, db)
      const token = await mintToken(db, articleSetPayload(), 'browser-article-set-01')
      const reopened = await roundTrip(page, token, redeems, /Opened 2 events and 3 sources into a local draft below\./)

      const evidence = reopened.analystWorkspace.evidence!
      expect(evidence.sources.map(source => source.url)).toEqual([returnUrl, 'https://publisher.example/story', 'https://second.example/report'])
      // Three (event, cited item) pairs: the first event cites both outlets, the second cites one.
      expect(evidence.assertions).toHaveLength(3)
      expect(evidence.assertions.map(assertion => assertion.sourceId)).toEqual(['handoff:source:1', 'handoff:source:2', 'handoff:source:2'])
      expect(evidence.links.map(link => link.eventId)).toEqual(['handoff:event:1', 'handoff:event:1', 'handoff:event:2'])
    } finally { await mf.dispose() }
  })

  test('a story-snapshot handoff records which slice of a moving story it took', async ({ page }) => {
    test.setTimeout(120_000)
    const { mf, db } = await setup()
    try {
      const { redeems } = await bridge(page, db)
      const token = await mintToken(db, storySnapshotPayload(), 'browser-story-01')
      const reopened = await roundTrip(page, token, redeems, /Opened 2 events and 2 sources into a local draft below\./)

      const evidence = reopened.analystWorkspace.evidence!
      expect(evidence.sources[0]).toMatchObject({ id: 'handoff:origin', url: storyReturnUrl })
      expect(evidence.assertions[0].passage.locator).toContain('Story revision a1b2c3d4.')
      expect(reopened.analystWorkspace.narrative!.title).toBe('Story snapshot at one moment')
    } finally { await mf.dispose() }
  })

  test('the landing page never redeems on load, and the return link is offered after it does', async ({ page }) => {
    const { mf, db } = await setup()
    try {
      const { redeems } = await bridge(page, db)
      const token = await mintToken(db, articlePayload(), 'browser-no-load-redeem-01')
      await landUnredeemed(page, token, redeems)
      // A reload with the fragment already stripped must still consume nothing.
      await page.reload()
      await expect(panel(page)).toHaveCount(0)
      expect(redeems).toEqual([])
      const row = await db.prepare('SELECT redeemed_at,payload FROM timeline_handoffs WHERE token=?').bind(token).first<{ redeemed_at: number | null; payload: string | null }>()
      expect(row!.redeemed_at).toBeNull()
      expect(row!.payload).not.toBeNull()

      await landing(page, token)
      await openControl(page).click()
      await expect(page.getByRole('link', { name: returnLabel })).toHaveAttribute('href', returnUrl)
      expect(redeems).toEqual([token])
    } finally { await mf.dispose() }
  })

  test('an expired link says so in the reader\'s own words and still offers a way back', async ({ page }) => {
    const { mf, db } = await setup()
    try {
      const { redeems } = await bridge(page, db)
      // expires_at is immutable once inserted, so an expired row is built directly rather than mutated.
      const token = 'a'.repeat(64)
      await db.prepare(`INSERT INTO timeline_handoffs(token,client_id,minted_by,request_key,audience,audience_subject,origin_return_url,payload_hash,payload,created_at,expires_at)
        VALUES(?,?,2,?,'researchtools-community.v1',NULL,?,?,?,unixepoch()-3600,unixepoch()-1800)`)
        .bind(token, client, 'browser-expired-seed', returnUrl, 'd'.repeat(64), '{"schemaVersion":"timeline-handoff.v1"}').run()

      await landUnredeemed(page, token, redeems)
      await openControl(page).click()
      await expect(panel(page).getByRole('alert')).toContainText('This handoff link expired. Handoff links last 30 minutes.')
      await expect(page.getByRole('link', { name: 'Open the original story' })).toHaveAttribute('href', returnUrl)
      await expect(panel(page).getByRole('alert')).toContainText('and choose Continue in ResearchTools again.')
      await expect(openControl(page)).toHaveCount(0)
    } finally { await mf.dispose() }
  })

  test('already-opened, withdrawn and wrong-account links each say what happened, and none is a dead end', async ({ page }) => {
    const { mf, db } = await setup()
    try {
      const { redeems } = await bridge(page, db)
      const spent = await mintToken(db, articlePayload(), 'browser-spent-01')
      const first = await redeemHandoff({ request: new Request(`https://example.test/api/timeline-handoffs/${spent}/redeem`, { method: 'POST', headers: { 'X-User-Hash': readerHash } }), env: serviceEnv(db), params: { token: spent } } as never)
      expect(first.status).toBe(200)
      await landUnredeemed(page, spent, redeems)
      await openControl(page).click()
      await expect(panel(page).getByRole('alert')).toContainText('This link was already opened. Ask for a fresh handoff link.')
      await expect(page.getByRole('link', { name: 'Open the original story' })).toHaveAttribute('href', returnUrl)

      // Withdrawn state is seeded in SQL rather than through DELETE /api/timeline-handoffs/{token}:
      // that route currently answers 503, because revokeTimelineHandoff builds its 204 through
      // handoffResponse(null, 204) and the Response constructor rejects a body on a 204. The
      // pre-existing tests/e2e/smoke/timeline-handoff-d1.spec.ts:332 fails on the same defect.
      const withdrawn = await mintToken(db, articlePayload(), 'browser-withdrawn-01')
      await db.prepare('UPDATE timeline_handoffs SET payload=NULL,revoked_at=unixepoch() WHERE token=?').bind(withdrawn).run()
      await landing(page, withdrawn)
      await openControl(page).click()
      await expect(panel(page).getByRole('alert')).toContainText('This handoff link was withdrawn.')

      const foreign = await mintToken(db, { ...articlePayload(), audience: 'researchtools-oidc-subject.v1', audienceSubject: otherSubject }, 'browser-foreign-01')
      await landing(page, foreign)
      await openControl(page).click()
      await expect(panel(page).getByRole('alert')).toContainText('This link was prepared for a different account. Sign in as that account to open it.')
      // A mismatched reader must not consume the token the intended recipient still holds.
      const row = await db.prepare('SELECT redeemed_at,payload FROM timeline_handoffs WHERE token=?').bind(foreign).first<{ redeemed_at: number | null; payload: string | null }>()
      expect(row!.redeemed_at).toBeNull()
      expect(row!.payload).not.toBeNull()
    } finally { await mf.dispose() }
  })

  test('a signed-out reader is told to sign in and is offered no way to spend the link', async ({ page }) => {
    const { mf, db } = await setup()
    try {
      const { redeems } = await bridge(page, db, false)
      const token = await mintToken(db, articlePayload(), 'browser-signed-out-01')
      await landUnredeemed(page, token, redeems)
      await expect(panel(page)).toContainText('Sign in to ResearchTools to open this material.')
      await expect(openControl(page)).toHaveCount(0)
      await page.getByRole('button', { name: 'Dismiss this handoff' }).click()
      await expect(panel(page)).toHaveCount(0)
      expect(redeems).toEqual([])
      const row = await db.prepare('SELECT redeemed_at FROM timeline_handoffs WHERE token=?').bind(token).first<{ redeemed_at: number | null }>()
      expect(row!.redeemed_at).toBeNull()
    } finally { await mf.dispose() }
  })
})
