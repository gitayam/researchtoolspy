/**
 * COP input core (managed migration 0022): the change feed, provenance, duplicates,
 * marker upsert, stale writes, key questions as starred RFIs, the share link's evidence
 * form and public feed, and the routes working before the migration.
 *
 * Run: npm run test:unit
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { call, count, events, fixture, mod, OTHER_SESSION, SERVICE_USER, SESSION, setupCoreSuite, WS } from './cop-core-harness.mjs'

setupCoreSuite()

const P = `/api/cop/${SESSION}`
const S = { id: SESSION }
const T0 = '2026-10-23T00:00:00.000Z'
const json = (res) => res.json()

async function changes(env, since, { who = 'owner', limit } = {}) {
  const q = new URLSearchParams({ since: since ?? '' })
  if (limit) q.set('limit', String(limit))
  return call(env, 'changes', 'GET', `${P}/changes?${q}`, { who, params: S })
}

// ── Change feed ────────────────────────────────────────────────────

test('changes: starts at now, then returns every later event oldest first, paged without gaps', async () => {
  const { db, env } = await fixture()
  const start = await json(await changes(env, ''))
  assert.deepEqual(start.events, [])
  assert.equal(start.has_more, false)

  for (let i = 0; i < 7; i++) {
    assert.equal((await call(env, 'rfis', 'POST', `${P}/rfis`, { params: S, body: { question: `Question ${i}?` } })).status, 201)
  }
  // Two events in the same millisecond whose random ids sort the other way: the feed
  // follows commit order, not id order.
  db.prepare("INSERT INTO cop_events (id, cop_session_id, event_type, entity_type, created_by) VALUES ('evt-zzzzzzzzz-zzz', ?, 'marker.created', 'marker', 1)").run(SESSION)
  db.prepare("INSERT INTO cop_events (id, cop_session_id, event_type, entity_type, created_by) VALUES ('evt-000000000-aaa', ?, 'task.created', 'task', 1)").run(SESSION)
  // Another session's events never appear.
  db.prepare("INSERT INTO cop_events (id, cop_session_id, event_type, entity_type, created_by) VALUES ('evt-other', ?, 'rfi.created', 'rfi', 4)").run(OTHER_SESSION)

  const seen = []
  let cursor = start.cursor
  const pages = []
  for (;;) {
    const page = await json(await changes(env, cursor, { limit: 3 }))
    pages.push(page.events.length)
    seen.push(...page.events)
    cursor = page.cursor
    if (!page.has_more) break
  }
  const expected = events(db).filter((e) => e.seq > Number(start.cursor))
  assert.deepEqual(seen.map((e) => e.id), expected.map((e) => e.id))
  assert.ok(seen.map((e) => e.id).indexOf('evt-zzzzzzzzz-zzz') < seen.map((e) => e.id).indexOf('evt-000000000-aaa'))
  assert.equal(expected.length, 9)
  assert.deepEqual(pages, [3, 3, 3])
  // Only the feed fields: no payloads, no user ids.
  for (const e of seen) assert.deepEqual(Object.keys(e).sort(), ['created_at', 'entity_id', 'entity_type', 'event_type', 'id'])

  // Nothing new: an empty page that keeps the cursor.
  const idle = await json(await changes(env, cursor))
  assert.deepEqual(idle.events, [])
  assert.equal(idle.cursor, cursor)

  // An event id works as a cursor too.
  const fromId = await json(await changes(env, expected.at(-2).id))
  assert.deepEqual(fromId.events.map((e) => e.id), [expected.at(-1).id])
})

test('changes: viewers read the feed, strangers do not, bad cursors are refused, legacy types are mapped', async () => {
  const { db, env } = await fixture()
  db.prepare("INSERT INTO cop_events (id, cop_session_id, event_type, entity_type, created_by) VALUES ('evt-legacy', ?, 'collaborator.added', 'collaborator', 1)").run(SESSION)
  db.prepare("INSERT INTO cop_events (id, cop_session_id, event_type, entity_type, created_by) VALUES ('evt-odd', ?, 'x.y', 'not-a-feed-type', 1)").run(SESSION)
  const viewer = await json(await changes(env, '0', { who: 'viewer' }))
  assert.equal(viewer.events.find((e) => e.id === 'evt-legacy').entity_type, 'activity')
  assert.equal(viewer.events.find((e) => e.id === 'evt-odd'), undefined)
  assert.equal((await changes(env, '0', { who: 'stranger' })).status, 403)
  assert.equal((await changes(env, '0', { who: 'anonymous' })).status, 401)
  assert.equal((await changes(env, "1 OR 1=1")).status, 400)
  assert.equal((await changes(env, 'evt-unknown')).status, 400)
})

test('the middleware emits entity.changed for a successful write that emitted nothing, and nothing extra otherwise', async () => {
  const { db, env } = await fixture()
  // One bundle for the middleware and the handlers, as in production (see COMBINED).
  const pipeline = mod('pipeline')
  const run = async (method, path, next) => {
    const request = new Request(`https://researchtools.test${path}`, { method, headers: { Authorization: 'Bearer session-editor' } })
    const context = { request, env, params: S, data: {}, waitUntil() {}, next }
    return pipeline.middleware(context)
  }
  let before = events(db).length
  assert.equal((await run('POST', `${P}/evidence-tags`, async () => new Response('{}', { status: 201 }))).status, 201)
  const fallback = events(db).slice(before)
  assert.deepEqual(fallback.map((e) => [e.event_type, e.entity_type]), [['entity.changed', 'tag']])

  before = events(db).length
  await run('POST', `${P}/rfis`, async () => {
    await pipeline.emitCopEvent(env.DB, { copSessionId: SESSION, eventType: 'rfi.created', entityType: 'rfi', createdBy: 2 })
    return new Response('{}', { status: 201 })
  })
  assert.deepEqual(events(db).slice(before).map((e) => e.event_type), ['rfi.created'])

  // The real RFI route behind the real middleware: its own event, no fallback.
  before = events(db).length
  const request = new Request(`https://researchtools.test${P}/rfis`, {
    method: 'POST', headers: { Authorization: 'Bearer session-editor', 'Content-Type': 'application/json' },
    body: JSON.stringify({ question: 'Through the middleware?' }),
  })
  const context = { request, env, params: S, data: {}, waitUntil() {} }
  context.next = () => pipeline.rfisPost(context)
  assert.equal((await pipeline.middleware(context)).status, 201)
  assert.deepEqual(events(db).slice(before).map((e) => e.event_type), ['rfi.created'])

  before = events(db).length
  await run('POST', `${P}/rfis`, async () => new Response('{}', { status: 400 }))
  await run('GET', `${P}/rfis`, async () => new Response('{}', { status: 200 }))
  assert.equal(events(db).length, before)
})

// ── Provenance ─────────────────────────────────────────────────────

test('source_channel comes from the caller, never from the body', async () => {
  const { db, env } = await fixture()
  const web = await json(await call(env, 'evidence', 'POST', `${P}/evidence`, { params: S, body: { title: 'From the web', source_channel: 'drop', url: 'https://a.example/web' } }))
  assert.equal(db.prepare('SELECT source_channel FROM evidence_items WHERE id = ?').get(web.id).source_channel, 'web')

  const bot = await call(env, 'evidence', 'POST', `${P}/evidence`, { who: 'service', through: 'middleware', params: S, body: { title: 'From chat', source_channel: 'web', url: 'https://a.example/chat' } })
  assert.equal(bot.status, 201, await bot.clone().text())
  const botRow = db.prepare('SELECT source_channel, source_ref, created_by FROM evidence_items WHERE id = ?').get((await bot.json()).id)
  assert.deepEqual({ ...botRow }, { source_channel: 'signal', source_ref: 'irregularchat-signal-test', created_by: SERVICE_USER })

  const rfi = await json(await call(env, 'rfis', 'POST', `${P}/rfis`, { who: 'service', through: 'middleware', params: S, body: { question: 'Asked in chat?' } }))
  assert.equal(db.prepare('SELECT source_channel FROM cop_rfis WHERE id = ?').get(rfi.id).source_channel, 'signal')
  const marker = await json(await call(env, 'markers', 'POST', `${P}/markers`, { params: S, body: { lat: 1, lon: 2, source_channel: 'signal' } }))
  assert.equal(db.prepare('SELECT source_channel FROM cop_markers WHERE id = ?').get(marker.id).source_channel, 'web')
})

// ── Duplicates and upserts ─────────────────────────────────────────

test('evidence: the same link twice (tracking parameters, fragment, trailing slash, host case) is one item', async () => {
  const { db, env } = await fixture({ seed: (d) => d.exec(`INSERT INTO evidence_items (id, title, description, evidence_type, credibility, reliability, workspace_id, created_by, source_url, metadata)
    VALUES (900, 'Saved before 0022', 'x', 'observation', 'unverified', 'unknown', '${WS}', 1, 'https://old.example/story', '{"cop_session_id":"${SESSION}","origin":"verified_claim"}')`) })
  const first = await call(env, 'evidence', 'POST', `${P}/evidence`, { params: S, body: { title: 'Story', url: 'https://News.example/story/?utm_source=x&id=7#top' } })
  assert.equal(first.status, 201)
  const { id } = await first.json()
  const again = await call(env, 'evidence', 'POST', `${P}/evidence`, { params: S, body: { title: 'Same story', url: 'https://news.example/story?id=7&fbclid=abc' } })
  assert.equal(again.status, 200)
  const body = await again.json()
  assert.equal(body.duplicate, true)
  assert.equal(body.id, id)
  assert.equal(body.evidence.title, 'Story')
  assert.equal(count(db, 'evidence_items', 'workspace_id = ?', WS), 2)
  // A row saved before 0022 (no canonical_url) is found by its link.
  const old = await json(await call(env, 'evidence', 'POST', `${P}/evidence`, { params: S, body: { title: 'x', url: 'https://old.example/story' } }))
  assert.equal(old.id, 900)
  // A different query value is a different page; non-http links are refused.
  assert.equal((await call(env, 'evidence', 'POST', `${P}/evidence`, { params: S, body: { title: 'x', url: 'https://news.example/story?id=8' } })).status, 201)
  assert.equal((await call(env, 'evidence', 'POST', `${P}/evidence`, { params: S, body: { title: 'x', url: 'javascript:alert(1)' } })).status, 400)
  // The batch route skips links already saved, and repeats inside the batch.
  const batch = await json(await call(env, 'evidenceBatch', 'POST', `${P}/evidence/batch`, { params: S, body: { items: [
    { title: 'dup', url: 'https://news.example/story?id=7' },
    { title: 'new', url: 'https://fresh.example/1' },
    { title: 'repeat', url: 'https://fresh.example/1/' },
  ] } }))
  assert.equal(batch.created, 1)
  assert.deepEqual(batch.duplicates, [{ index: 0, id }, { index: 2, id: null }])
})

test('markers: the same uid in a session updates that marker; a service cannot take a person’s uid', async () => {
  const { db, env } = await fixture()
  const first = await call(env, 'markers', 'POST', `${P}/markers`, { params: S, body: { uid: 'cot-unit-1', lat: 48.9, lon: 2.3, label: 'Unit' } })
  assert.equal(first.status, 201)
  const moved = await call(env, 'markers', 'POST', `${P}/markers`, { params: S, body: { uid: 'cot-unit-1', lat: 48.91, lon: 2.31 } })
  assert.equal(moved.status, 200)
  const body = await moved.json()
  assert.equal(body.updated, true)
  assert.equal(body.marker.lat, 48.91)
  assert.equal(body.marker.label, 'Unit')
  assert.equal(count(db, 'cop_markers', 'uid = ?', 'cot-unit-1'), 1)
  // The same uid in another session is another marker.
  db.prepare("INSERT INTO cop_collaborators (id, cop_session_id, user_id, role) VALUES ('c-o', ?, 1, 'editor')").run(OTHER_SESSION)
  assert.equal((await call(env, 'markers', 'POST', `/api/cop/${OTHER_SESSION}/markers`, { params: { id: OTHER_SESSION }, body: { uid: 'cot-unit-1', lat: 1, lon: 1 } })).status, 201)
  // The bot may move its own markers, never a person's.
  const taken = await call(env, 'markers', 'POST', `${P}/markers`, { who: 'service', through: 'middleware', params: S, body: { uid: 'cot-unit-1', lat: 0, lon: 0 } })
  assert.equal(taken.status, 409)
  assert.equal((await taken.json()).code, 'UID_TAKEN')
  assert.equal(db.prepare('SELECT lat FROM cop_markers WHERE uid = ? AND cop_session_id = ?').get('cot-unit-1', SESSION).lat, 48.91)
})

// ── Stale writes ───────────────────────────────────────────────────

const STALE_CASES = [
  ['tasks', 'PUT', `${P}/tasks`, S, { id: 'task-s', priority: 'high' }, 'cop_tasks', 'task-s'],
  ['rfis', 'PUT', `${P}/rfis`, S, { id: 'rfi-s', priority: 'high' }, 'cop_rfis', 'rfi-s'],
  ['rfi', 'PUT', `${P}/rfis/rfi-s`, { ...S, rfiId: 'rfi-s' }, { priority: 'high' }, 'cop_rfis', 'rfi-s'],
  ['claims', 'PUT', `${P}/claims`, S, { claim_id: 'clm-s', status: 'disputed' }, 'cop_claims', 'clm-s'],
  ['hypotheses', 'PUT', `${P}/hypotheses`, S, { id: 'hyp-s', confidence: 80 }, 'cop_hypotheses', 'hyp-s'],
]
const seedStale = (db) => db.exec(`
  INSERT INTO cop_tasks (id, cop_session_id, title, created_by, workspace_id, updated_at) VALUES ('task-s', '${SESSION}', 'T', 1, '${WS}', '${T0}');
  INSERT INTO cop_rfis (id, cop_session_id, question, created_by, updated_at) VALUES ('rfi-s', '${SESSION}', 'Q?', 1, '${T0}');
  INSERT INTO cop_claims (id, cop_session_id, workspace_id, claim_text, created_by, created_at, updated_at) VALUES ('clm-s', '${SESSION}', '${WS}', 'C', '1', '${T0}', '${T0}');
  INSERT INTO cop_hypotheses (id, cop_session_id, statement, created_by, workspace_id, updated_at) VALUES ('hyp-s', '${SESSION}', 'H', 1, '${WS}', '${T0}');
`)

for (const [handler, method, path, params, body, table, id] of STALE_CASES) {
  test(`${handler} ${method}: an edit made on an old version answers 409 STALE_WRITE with the current row`, async () => {
    const { db, env } = await fixture({ seed: seedStale })
    const stale = await call(env, handler, method, path, { params, body: { ...body, if_updated_at: '2026-10-22T00:00:00.000Z' } })
    assert.equal(stale.status, 409)
    const conflict = await stale.json()
    assert.equal(conflict.code, 'STALE_WRITE')
    assert.equal(conflict.current.id, id)
    assert.equal(db.prepare(`SELECT updated_at FROM ${table} WHERE id = ?`).get(id).updated_at, T0)

    const header = await call(env, handler, method, path, { params, body, headers: { 'If-Match': `"${T0}"` } })
    assert.equal(header.status, 200, await header.clone().text())
    // Without a version: the last write wins, as before.
    assert.equal((await call(env, handler, method, path, { params, body })).status, 200)
  })
}

// ── Key questions = starred RFIs ───────────────────────────────────

test('migration 0022 stars the RFI that asks a key question and adds RFIs for the others', async () => {
  const { db } = await fixture()
  const rows = db.prepare('SELECT id, question, is_key, priority, requester_name FROM cop_rfis WHERE cop_session_id = ? ORDER BY question').all(SESSION)
  assert.deepEqual(rows.map((r) => [r.question, r.is_key]), [['When does it start?', 1], ['who is at the gate', 1]])
  assert.equal(rows.find((r) => r.question === 'When does it start?').requester_name, 'Key question')
})

test('key questions and starred RFIs stay in step both ways; the RFI list puts them first', async () => {
  const { db, env } = await fixture()
  const put = await call(env, 'sessionItem', 'PUT', `/api/cop/sessions/${SESSION}`, { params: S, body: { key_questions: ['When does it start', ' Where do the buses park? ', 'when does it start?'] } })
  assert.equal(put.status, 200, await put.clone().text())
  const starred = () => db.prepare('SELECT question FROM cop_rfis WHERE cop_session_id = ? AND is_key = 1 ORDER BY question').all(SESSION).map((r) => r.question)
  assert.deepEqual(starred(), ['When does it start?', 'Where do the buses park?'])
  assert.equal(db.prepare("SELECT is_key FROM cop_rfis WHERE id = 'rfi-existing'").get().is_key, 0)
  assert.deepEqual(JSON.parse(db.prepare('SELECT key_questions FROM cop_sessions WHERE id = ?').get(SESSION).key_questions),
    ['When does it start', 'Where do the buses park?'])

  // Starring an RFI adds it to the session's key questions; unstarring removes it.
  assert.equal((await call(env, 'rfi', 'PUT', `${P}/rfis/rfi-existing`, { params: { ...S, rfiId: 'rfi-existing' }, body: { is_key: true } })).status, 200)
  const keyQuestions = () => JSON.parse(db.prepare('SELECT key_questions FROM cop_sessions WHERE id = ?').get(SESSION).key_questions)
  assert.deepEqual(keyQuestions(), ['When does it start', 'Where do the buses park?', 'who is at the gate'])
  const buses = db.prepare("SELECT id FROM cop_rfis WHERE question = 'Where do the buses park?'").get().id
  assert.equal((await call(env, 'rfis', 'PUT', `${P}/rfis`, { params: S, body: { id: buses, is_key: false } })).status, 200)
  assert.deepEqual(keyQuestions(), ['When does it start', 'who is at the gate'])

  const list = (await json(await call(env, 'rfis', 'GET', `${P}/rfis`, { who: 'viewer', params: S }))).rfis
  assert.deepEqual(list.map((r) => r.is_key), [...list.map((r) => r.is_key)].sort((a, b) => b - a))
  assert.equal(list.filter((r) => r.is_key === 1).length, 2)

  // A new session's key questions are starred RFIs from the start.
  const created = await call(env, 'sessions', 'POST', '/api/cop/sessions', { body: { name: 'New COP', key_questions: ['Who has the keys?'] } })
  assert.equal(created.status, 201, await created.clone().text())
  const newId = (await created.json()).id
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM cop_rfis WHERE cop_session_id = ? AND is_key = 1').get(newId).n, 1)
})

// ── Webcams layer ──────────────────────────────────────────────────

test('the first webcam switches the webcams map layer on, once', async () => {
  const { db, env } = await fixture()
  const layers = () => JSON.parse(db.prepare('SELECT active_layers FROM cop_sessions WHERE id = ?').get(SESSION).active_layers)
  assert.deepEqual(layers(), ['cop-markers'])
  assert.equal((await call(env, 'webcams', 'POST', `${P}/webcams`, { params: S, body: { url: 'windy:1706619137', label: 'A' } })).status, 201)
  assert.equal((await call(env, 'webcams', 'POST', `${P}/webcams`, { params: S, body: { url: 'windy:1706619138', label: 'B' } })).status, 201)
  assert.deepEqual(layers(), ['cop-markers', 'webcams'])
})

// ── Share links ────────────────────────────────────────────────────

const TOKEN = '22222222-2222-4222-8222-222222222222'
function seedShare(panels, { allowEvidence = 0, expires = null } = {}) {
  return (db) => db.prepare(`INSERT INTO cop_shares (id, cop_session_id, share_token, visible_panels, created_by, expires_at) VALUES ('cops-s', ?, ?, ?, 1, ?)`)
    .run(SESSION, TOKEN, JSON.stringify(panels), expires)
}
const publicGet = (env) => call(env, 'publicShare', 'GET', `/api/cop/public/${TOKEN}`, { who: 'anonymous', params: { token: TOKEN } })

test('shares: allow_evidence is set by the owner or an editor, listed for editors only; share events carry no token', async () => {
  const { db, env } = await fixture()
  const created = await call(env, 'shares', 'POST', `${P}/shares`, { who: 'editor', params: S, body: { visible_panels: ['map', 'evidence', 'bogus'], allow_evidence: true } })
  assert.equal(created.status, 201, await created.clone().text())
  const share = await created.json()
  assert.deepEqual(share.visible_panels, ['map', 'evidence'])
  assert.equal(share.allow_evidence, true)
  assert.equal(db.prepare('SELECT allow_evidence FROM cop_shares WHERE share_token = ?').get(share.share_token).allow_evidence, 1)
  for (const row of db.prepare("SELECT payload FROM cop_events WHERE entity_type = 'share'").all()) {
    assert.ok(!row.payload.includes(share.share_token))
  }
  assert.equal((await call(env, 'shares', 'GET', `${P}/shares`, { who: 'viewer', params: S })).status, 403)
  const listed = await json(await call(env, 'shares', 'GET', `${P}/shares`, { who: 'editor', params: S }))
  assert.equal(listed.shares[0].allow_evidence, true)
  const patched = await call(env, 'shares', 'PATCH', `${P}/shares?token=${share.share_token}`, { params: S, body: { allow_evidence: false } })
  assert.equal(patched.status, 200)
  assert.equal((await patched.json()).share.allow_evidence, false)
  // An old share event that carried the token: the events list strips it.
  db.prepare(`INSERT INTO cop_events (id, cop_session_id, event_type, entity_type, payload, created_by) VALUES ('evt-old-share', ?, 'share.created', 'share', '{"share_token":"secret-token","visible_panels":["map"]}', 1)`).run(SESSION)
  const listedEvents = await json(await call(env, 'events', 'GET', `${P}/events`, { who: 'viewer', params: S }))
  assert.ok(!JSON.stringify(listedEvents).includes('secret-token'))
})

const seedDrops = (db) => db.exec(`
  INSERT INTO survey_drops (id, title, share_token, status, access_level, intent, cop_session_id, created_by, require_location, created_at)
    VALUES ('drop-old', 'Old form', 'drop-token-old', 'active', 'public', 'drop', '${SESSION}', 1, 0, '2026-01-01T00:00:00Z');
  INSERT INTO survey_drops (id, title, share_token, status, access_level, intent, cop_session_id, created_by, require_location, require_contact, created_at)
    VALUES ('drop-1', 'Paris evidence form', 'drop-token-1', 'active', 'public', 'drop', '${SESSION}', 1, 1, 0, '2026-10-22T00:00:00Z');
  INSERT INTO survey_drops (id, title, share_token, status, access_level, intent, cop_session_id, created_by, created_at, expires_at)
    VALUES ('drop-expired', 'Expired', 'drop-token-expired', 'active', 'public', 'drop', '${SESSION}', 1, '2026-10-23T00:00:00Z', '2026-01-02T00:00:00Z');
  INSERT INTO survey_drops (id, title, share_token, status, access_level, intent, password_hash, cop_session_id, created_by, created_at)
    VALUES ('drop-pw', 'Password', 'drop-token-pw', 'active', 'password', 'drop', 'h', '${SESSION}', 1, '2026-10-23T01:00:00Z');
  INSERT INTO survey_drops (id, title, share_token, status, access_level, intent, cop_session_id, created_by, created_at)
    VALUES ('drop-other', 'Other COP', 'drop-token-other', 'active', 'public', 'drop', '${OTHER_SESSION}', 4, '2026-10-23T02:00:00Z');
`)

test('public payload: evidence_form only when the link allows evidence and an active drop is linked to this session', async () => {
  let { db, env } = await fixture({ seed: (d) => { seedShare(['map', 'questions', 'evidence'])(d); seedDrops(d) } })
  let payload = await json(await publicGet(env))
  assert.equal(payload.evidence_form, null)
  db.prepare("UPDATE cop_shares SET allow_evidence = 1 WHERE share_token = ?").run(TOKEN)
  payload = await json(await publicGet(env))
  assert.deepEqual(payload.evidence_form, { token: 'drop-token-1', title: 'Paris evidence form', require_location: true, require_contact: false })
  assert.equal(payload.allow_evidence, true)

  // No active, public, unexpired drop linked to this session: no form (never another session's).
  db.exec("UPDATE survey_drops SET status = 'closed' WHERE id IN ('drop-1', 'drop-old')")
  assert.equal((await json(await publicGet(env))).evidence_form, null)

  // A link that allows evidence on a session with no drop linked: no form.
  ;({ db, env } = await fixture({ seed: seedShare(['map']) }))
  db.exec('UPDATE cop_shares SET allow_evidence = 1')
  assert.equal((await json(await publicGet(env))).evidence_form, null)
})

test('public payload: key_rfis with the questions panel; evidence with the evidence panel, without descriptions or other links', async () => {
  const { env } = await fixture({ seed: (d) => {
    seedShare(['map', 'questions', 'evidence'])(d)
    d.exec(`INSERT INTO evidence_items (id, title, description, evidence_type, credibility, reliability, workspace_id, created_by, source_url, metadata)
      VALUES (1, 'Tip', 'Call me on +33 6 00 00 00 00', 'observation', 'unverified', 'unknown', '${WS}', 1, 'javascript:alert(1)', '{"cop_session_id":"${SESSION}","origin":"verified_claim"}'),
             (2, 'Story', 'x', 'observation', 'unverified', 'unknown', '${WS}', 1, 'https://news.example/a', '{"cop_session_id":"${SESSION}","origin":"verified_claim"}'),
             (3, 'Other workspace', 'x', 'observation', 'unverified', 'unknown', 'ws-other', 4, 'https://other.example', NULL)`)
    d.exec("INSERT INTO cop_rfi_answers (id, rfi_id, answer_text, created_by) VALUES ('a1', 'rfi-existing', 'two', 1)")
  } })
  const payload = await json(await publicGet(env))
  assert.deepEqual(payload.key_rfis.map((r) => [r.question, r.answer_count]).sort(), [['When does it start?', 0], ['who is at the gate', 1]])
  assert.deepEqual(payload.evidence.map((e) => e.title).sort(), ['Story', 'Tip'])
  assert.equal(payload.evidence.find((e) => e.title === 'Tip').source_url, null)
  assert.ok(!JSON.stringify(payload).includes('+33'))
  for (const e of payload.evidence) assert.deepEqual(Object.keys(e).sort(), ['created_at', 'credibility', 'evidence_type', 'id', 'source_channel', 'source_url', 'title'])
})

test('a share showing only key questions takes answers to starred RFIs, not to others', async () => {
  const { db, env } = await fixture({ seed: (d) => {
    seedShare(['map', 'questions'])(d)
    d.exec("UPDATE cop_shares SET allow_rfi_answers = 1")
    d.exec(`INSERT INTO cop_rfis (id, cop_session_id, question, created_by) VALUES ('rfi-plain', '${SESSION}', 'Not a key question', 1)`)
  } })
  const answer = (rfiId) => call(env, 'publicAnswers', 'POST', `/api/cop/public/${TOKEN}/rfis/${rfiId}/answers`, { who: 'anonymous', params: { token: TOKEN, rfiId }, body: { answer_text: 'Here' } })
  assert.equal((await answer('rfi-existing')).status, 201)
  assert.equal((await answer('rfi-plain')).status, 403)
  assert.ok(events(db).some((e) => e.event_type === 'rfi.answered' && e.entity_id === 'rfi-existing'))
})

// ── Public change feed ─────────────────────────────────────────────

const publicChanges = (env, since = '0', headers = {}) =>
  call(env, 'publicChanges', 'GET', `/api/cop/public/${TOKEN}/changes?since=${since}`, { who: 'anonymous', params: { token: TOKEN }, headers })

test('public changes: only the entity types the share shows, same shape as the private feed', async () => {
  const { db, env } = await fixture({ seed: seedShare(['map', 'rfi']) })
  for (const [type, entity] of [['marker.created', 'marker'], ['rfi.created', 'rfi'], ['evidence.created', 'evidence'], ['task.created', 'task'], ['share.created', 'share']]) {
    db.prepare("INSERT INTO cop_events (id, cop_session_id, event_type, entity_type, created_by) VALUES (?, ?, ?, ?, 1)").run(`evt-${entity}`, SESSION, type, entity)
  }
  const res = await publicChanges(env)
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.deepEqual(body.events.map((e) => e.id), ['evt-marker', 'evt-rfi'])
  assert.equal(body.cursor, String(events(db).at(-1).seq))
  for (const e of body.events) assert.deepEqual(Object.keys(e).sort(), ['created_at', 'entity_id', 'entity_type', 'event_type', 'id'])
})

test('public changes: unknown or expired link 404, archived session 410', async () => {
  let { db, env } = await fixture({ seed: seedShare(['map'], { expires: '2026-01-01T00:00:00Z' }) })
  assert.equal((await publicChanges(env)).status, 404)
  ;({ db, env } = await fixture({ seed: seedShare(['map']) }))
  db.prepare("UPDATE cop_sessions SET status = 'ARCHIVED' WHERE id = ?").run(SESSION)
  assert.equal((await publicChanges(env)).status, 410)
  assert.equal((await call(env, 'publicChanges', 'GET', '/api/cop/public/nope/changes?since=0', { who: 'anonymous', params: { token: 'nope' } })).status, 404)
})

test('public changes: limited per client address; no KV refuses; a failed counter write still answers', async () => {
  const { env, kv } = await fixture({ seed: seedShare(['map']) })
  const ip = { 'CF-Connecting-IP': '203.0.113.7' }
  for (let i = 0; i < 60; i++) assert.equal((await publicChanges(env, '0', ip)).status, 200)
  const over = await publicChanges(env, '0', ip)
  assert.equal(over.status, 429)
  assert.equal((await over.json()).code, 'RATE_LIMITED')
  // Another address has its own allowance; the key holds a digest, not the address.
  assert.equal((await publicChanges(env, '0', { 'CF-Connecting-IP': '198.51.100.1' })).status, 200)
  assert.ok(![...kv.store.keys()].some((k) => k.includes('203.0.113.7')))
  kv.failPuts = true
  assert.equal((await publicChanges(env, '0', { 'CF-Connecting-IP': '198.51.100.2' })).status, 200)
  kv.failGets = true
  assert.equal((await publicChanges(env, '0', { 'CF-Connecting-IP': '198.51.100.3' })).status, 503)

  const noKv = await fixture({ seed: seedShare(['map']), kv: false })
  assert.equal((await publicChanges(noKv.env)).status, 503)
})

// ── Before migration 0022 ──────────────────────────────────────────

test('without migration 0022 the routes keep working with the old columns', async () => {
  const { db, env } = await fixture({ core: false, seed: (d) => d.exec(`INSERT INTO evidence_items (id, title, description, evidence_type, credibility, reliability, workspace_id, created_by, source_url)
    VALUES (900, 'Old', 'x', 'observation', 'unverified', 'unknown', '${WS}', 1, 'https://old.example/story')`) })
  assert.equal(count(db, "pragma_table_info('cop_rfis')", "name = 'is_key'"), 0)

  const ev = await call(env, 'evidence', 'POST', `${P}/evidence`, { params: S, body: { title: 'New', url: 'https://new.example/a' } })
  assert.equal(ev.status, 201, await ev.clone().text())
  // Before 0022 a COP sharing its owner's workspace can't tell its own old evidence from
  // the workspace's, so an old item is not a duplicate: the link is saved for this COP.
  const again = await call(env, 'evidence', 'POST', `${P}/evidence`, { params: S, body: { title: 'x', url: 'https://old.example/story/' } })
  assert.equal(again.status, 201)
  assert.notEqual((await again.json()).id, 900)
  assert.equal((await call(env, 'evidenceBatch', 'POST', `${P}/evidence/batch`, { params: S, body: { items: [{ title: 'b', url: 'https://b.example' }] } })).status, 201)
  assert.equal((await call(env, 'markers', 'POST', `${P}/markers`, { params: S, body: { lat: 1, lon: 2 } })).status, 201)
  assert.equal((await call(env, 'rfis', 'POST', `${P}/rfis`, { params: S, body: { question: 'Q?', is_key: true } })).status, 201)
  const rfis = (await json(await call(env, 'rfis', 'GET', `${P}/rfis`, { params: S }))).rfis
  assert.ok(rfis.every((r) => r.is_key === 0))
  assert.equal((await call(env, 'rfi', 'PUT', `${P}/rfis/rfi-existing`, { params: { ...S, rfiId: 'rfi-existing' }, body: { is_key: true } })).status, 503)
  assert.equal((await call(env, 'rfi', 'PUT', `${P}/rfis/rfi-existing`, { params: { ...S, rfiId: 'rfi-existing' }, body: { status: 'closed' } })).status, 200)
  assert.equal((await call(env, 'rfi', 'DELETE', `${P}/rfis/rfi-existing`, { params: { ...S, rfiId: 'rfi-existing' } })).status, 200)
  assert.equal((await call(env, 'sessionItem', 'PUT', `/api/cop/sessions/${SESSION}`, { params: S, body: { key_questions: ['A?'] } })).status, 200)
  assert.equal((await call(env, 'tasks', 'POST', `${P}/tasks`, { params: S, body: { title: 'T' } })).status, 201)
  assert.equal((await call(env, 'timeline', 'POST', `${P}/timeline`, { params: S, body: { title: 'E' } })).status, 201)
  assert.equal((await call(env, 'claims', 'POST', `${P}/claims`, { params: S, body: { claims: [{ claim: 'c' }] } })).status, 201)
  assert.equal((await call(env, 'hypotheses', 'POST', `${P}/hypotheses`, { params: S, body: { statement: 'h' } })).status, 201)

  // A share link that asks for the evidence form needs 0022; one that doesn't still works.
  const evidenceShare = await call(env, 'shares', 'POST', `${P}/shares`, { params: S, body: { visible_panels: ['map'], allow_evidence: true } })
  assert.equal(evidenceShare.status, 503)
  assert.equal(count(db, 'cop_shares'), 0)
  const plain = await json(await call(env, 'shares', 'POST', `${P}/shares`, { params: S, body: { visible_panels: ['map', 'questions', 'evidence'] } }))
  const payload = await json(await call(env, 'publicShare', 'GET', `/api/cop/public/${plain.share_token}`, { who: 'anonymous', params: { token: plain.share_token } }))
  assert.equal(payload.evidence_form, null)
  assert.deepEqual(payload.key_rfis, [])
  assert.ok(Array.isArray(payload.evidence))
  assert.equal((await changes(env, '0')).status, 200)
})

// ── Follow-ups: the workspace's evidence form, starred RFIs on create ──

test('the workspace session response carries the evidence form for the owner and editors only', async () => {
  const { db, env } = await fixture({ seed: seedDrops })
  const get = (who) => call(env, 'sessionItem', 'GET', `/api/cop/sessions/${SESSION}`, { who, params: S })
  const form = { token: 'drop-token-1', title: 'Paris evidence form', require_location: true, require_contact: false }
  for (const who of ['owner', 'editor', 'admin']) {
    const body = await json(await get(who))
    assert.deepEqual(body.evidence_form, form, who)
    assert.equal(body.session.id, SESSION)
  }
  assert.equal((await json(await get('viewer'))).evidence_form, null)
  assert.equal((await get('stranger')).status, 403)

  // A public session: anyone may read it, the form still only for those who manage it.
  db.prepare('UPDATE cop_sessions SET is_public = 1 WHERE id = ?').run(SESSION)
  assert.equal((await json(await get('stranger'))).evidence_form, null)
  assert.equal((await json(await get('anonymous'))).evidence_form, null)
  assert.deepEqual((await json(await get('editor'))).evidence_form, form)

  // No active drop linked to this session: null (never another session's drop).
  db.exec("UPDATE survey_drops SET status = 'closed' WHERE cop_session_id = 'cop-core'")
  assert.equal((await json(await get('owner'))).evidence_form, null)
})

test('POST /rfis with is_key: true creates a starred RFI and adds it to the key questions', async () => {
  const { db, env } = await fixture()
  const res = await call(env, 'rfis', 'POST', `${P}/rfis`, { who: 'editor', params: S, body: { question: 'Who opens the gate?', is_key: true } })
  assert.equal(res.status, 201)
  const { id } = await res.json()
  assert.equal(db.prepare('SELECT is_key FROM cop_rfis WHERE id = ?').get(id).is_key, 1)
  assert.deepEqual(JSON.parse(db.prepare('SELECT key_questions FROM cop_sessions WHERE id = ?').get(SESSION).key_questions),
    ['Who is at the gate?', 'When does it start?', 'Who opens the gate?'])
  assert.ok(events(db).some((e) => e.event_type === 'rfi.created' && e.entity_id === id))
  assert.ok(events(db).some((e) => e.event_type === 'session.updated'))
  // Without is_key it is an ordinary RFI.
  const plain = await json(await call(env, 'rfis', 'POST', `${P}/rfis`, { params: S, body: { question: 'Anything else?' } }))
  assert.equal(db.prepare('SELECT is_key FROM cop_rfis WHERE id = ?').get(plain.id).is_key, 0)
})
