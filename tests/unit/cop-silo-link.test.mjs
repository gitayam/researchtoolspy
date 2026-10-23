/**
 * Roadmap 3.4 (ResearchTools side): a COP collaborator can open an evidence item's
 * original — the community portal's member download for a Silo file, or the PeerTube
 * page for a saved video — through `archive_url`, derived on read from source_ref.
 *
 * - Collaborators (owner, editor, admin, viewer) get archive_url; a held Silo item none.
 * - It needs SILO_PORTAL_BASE to be a plain https prefix ending in '/'.
 * - It never leaves the COP: not for readers outside it on a public session, not in the
 *   share payload or the public change feed, not in CoT, and export stays collaborators-only.
 *
 * Run: npm run test:unit
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { call, fixture, mod, SERVICE_USER, SESSION, setupCoreSuite, WS } from './cop-core-harness.mjs'

setupCoreSuite()

const P = `/api/cop/${SESSION}`
const S = { id: SESSION }
const BASE = 'https://irregulars.io/files/breakout/'
const VIDEO = 'https://videos.irregularchat.com/w/abc123'
const TOKEN = '44444444-4444-4444-8444-444444444444'

function seed(db) {
  db.exec(`
    INSERT INTO evidence_items (id, title, description, evidence_type, credibility, reliability, workspace_id, created_by, metadata) VALUES
      (9101, 'Photo from chat', 'x', 'image', 'unverified', 'unknown', '${WS}', ${SERVICE_USER}, '{"scan_state":"clean"}'),
      (9102, 'Report from chat', 'x', 'document', 'unverified', 'unknown', '${WS}', ${SERVICE_USER}, '{"scan_state":"pending"}'),
      (9103, 'Video from chat', 'x', 'video', 'unverified', 'unknown', '${WS}', ${SERVICE_USER}, NULL),
      (9104, 'A person''s note', 'x', 'observation', 'unverified', 'unknown', '${WS}', 1, NULL);
  `)
}

async function scoped({ base = BASE, peertube = 'videos.irregularchat.com' } = {}) {
  const made = await fixture({ seed })
  made.db.exec(`UPDATE evidence_items SET cop_session_id = '${SESSION}' WHERE id IN (9101, 9102, 9103, 9104)`)
  made.db.exec(`UPDATE evidence_items SET source_ref = 'silo:4212' WHERE id = 9101`)
  made.db.exec(`UPDATE evidence_items SET source_ref = 'silo:4211' WHERE id = 9102`)
  made.db.exec(`UPDATE evidence_items SET source_ref = 'peertube:${VIDEO}' WHERE id = 9103`)
  if (base !== undefined) made.env.SILO_PORTAL_BASE = base
  if (peertube !== undefined) made.env.COP_PEERTUBE_HOST = peertube
  return made
}

const evidenceAs = async (env, who) => (await (await call(env, 'evidence', 'GET', `${P}/evidence`, { who, params: S })).json()).evidence
const byId = (rows, id) => rows.find((e) => e.id === id)
const leaks = (text) => text.includes('archive_url') || text.includes('irregulars.io/files/breakout') || text.includes('silo:')

test('collaborators get the member download for a Silo original and the PeerTube page for a video', async () => {
  const { env } = await scoped()
  for (const who of ['owner', 'editor', 'viewer']) {
    const rows = await evidenceAs(env, who)
    assert.equal(byId(rows, 9101).archive_url, `${BASE}4212`, who)
    assert.equal(byId(rows, 9101).archived_in, 'silo')
    assert.equal(byId(rows, 9103).archive_url, VIDEO, who)
    assert.equal(byId(rows, 9103).archived_in, 'peertube')
    assert.equal(byId(rows, 9104).archive_url, null, 'a note has no original')
  }
})

test('a held Silo item (scan pending) gets no link, only its held state', async () => {
  const { env } = await scoped()
  const held = byId(await evidenceAs(env, 'viewer'), 9102)
  assert.equal(held.held, true)
  assert.equal(held.scan_state, 'pending')
  assert.equal(held.archive_url, null)
})

test('no link unless SILO_PORTAL_BASE is a plain https prefix ending in a slash', async () => {
  for (const base of [null, '', 'http://irregulars.io/files/breakout/', 'https://irregulars.io/files/breakout',
    'https://irregulars.io/files/breakout/?x=1', 'https://user:pw@irregulars.io/files/breakout/', 'javascript:alert(1)//']) {
    const { env } = await scoped({ base: base ?? undefined })
    if (base === null) delete env.SILO_PORTAL_BASE
    assert.equal(byId(await evidenceAs(env, 'viewer'), 9101).archive_url, null, String(base))
  }
  const archive = mod('copArchive')
  assert.equal(archive.archiveUrl('silo:4212', { SILO_PORTAL_BASE: BASE }), `${BASE}4212`)
  assert.equal(archive.archiveUrl('silo:../x', { SILO_PORTAL_BASE: BASE }), null)
  assert.equal(archive.archiveUrl('peertube:http://videos.irregularchat.com/w/a', { COP_PEERTUBE_HOST: 'videos.irregularchat.com' }), null)
  assert.equal(archive.archiveUrl(`peertube:${VIDEO}`, { COP_PEERTUBE_HOST: 'other.example' }), null)
})

test('readers outside the COP on a public session get no link, reference or scan state', async () => {
  const { db, env } = await scoped()
  db.prepare('UPDATE cop_sessions SET is_public = 1 WHERE id = ?').run(SESSION)
  const rows = await evidenceAs(env, 'stranger')
  assert.ok(rows.length >= 3)
  for (const row of rows) {
    for (const key of ['archive_url', 'archived_in', 'scan_state', 'source_ref', 'metadata']) assert.equal(key in row, false, key)
  }
  assert.equal(leaks(JSON.stringify(rows)), false)
  const stripped = mod('copArchive').stripPrivateEvidenceFields({ id: 1, archive_url: `${BASE}1`, archived_in: 'silo', scan_state: 'clean', source_ref: 'silo:1' })
  assert.deepEqual(Object.keys(stripped).sort(), ['held', 'id'])
})

test('the share payload, the public change feed and CoT through a share never carry the link', async () => {
  const { db, env } = await scoped()
  db.prepare(`INSERT INTO cop_shares (id, cop_session_id, share_token, visible_panels, created_by) VALUES ('cops-silo', ?, ?, ?, 1)`)
    .run(SESSION, TOKEN, JSON.stringify(['map', 'event', 'evidence', 'rfi', 'questions', 'cams']))
  const payload = await (await call(env, 'publicShare', 'GET', `/api/cop/public/${TOKEN}`, { who: 'anonymous', params: { token: TOKEN } })).text()
  assert.ok(payload.includes('Photo from chat'), 'the share does list the evidence')
  assert.equal(leaks(payload), false)
  const feed = await (await call(env, 'publicChanges', 'GET', `/api/cop/public/${TOKEN}/changes?since=0`, { who: 'anonymous', params: { token: TOKEN } })).text()
  assert.equal(leaks(feed), false)
  const cot = await (await call(env, 'cot', 'GET', `${P}/cot?token=${TOKEN}`, { who: 'anonymous', params: S })).text()
  assert.equal(leaks(cot), false)
})

test('export stays with collaborators: a reader outside a public COP cannot export it', async () => {
  const { db, env } = await scoped()
  db.prepare('UPDATE cop_sessions SET is_public = 1 WHERE id = ?').run(SESSION)
  assert.equal((await call(env, 'export', 'POST', `${P}/export`, { who: 'stranger', body: { format: 'geojson' }, params: S })).status, 403)
})
