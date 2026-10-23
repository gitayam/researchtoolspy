/**
 * Hardening of the COP → chat feed and the anonymous inputs it carries into Signal rooms
 * (security review of feat/cop-chat-feed):
 * - An answer is "from the team" only when its own rfi.answered event (created_by > 0,
 *   naming its answer id) says so; a legacy share-link answer, or one whose event was
 *   lost, is anonymous.
 * - Share-link answers have an atomic per-share hourly cap (429), and the address limit
 *   counts an IPv6 client by its /64.
 * - More than 3 unreviewed anonymous tips or answers in a page become one summary item.
 * - Titles lose every control, format and default-ignorable character, and links with or
 *   without a scheme (path, query or fragment) are cut to the host; items with an id that
 *   isn't a plain id are dropped.
 * - A tip's title comes from its long-text answer, never a short field
 *   (cop-chat-feed-anonymous.test.mjs has the rest).
 * - Compatibility: PUT /rfis with an answer keeps new_status on rfi.answered.
 * - Only the Signal bot's exact client ids count as the Signal bot.
 *
 * Run: npm run test:unit
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  call, CLIENT_ID, ENTRIES, fixture, migration, mod, SERVICE_USER, SESSION, setupCoreSuite, WS,
} from './cop-core-harness.mjs'

const R = 'functions/api/cop/[id]/'
Object.assign(ENTRIES, {
  chatFeed: `${R}chat-feed.ts`,
  chatFeedLib: 'functions/api/_shared/cop-chat-feed.ts',
  copCaller: 'functions/api/_shared/cop-caller.ts',
  dropSubmit: 'functions/api/surveys/public/[token]/drop-submit.ts',
})
setupCoreSuite()

const P = `/api/cop/${SESSION}`
const S = { id: SESSION }
const SHARE = '55555555-0000-4000-8000-000000000001'
const SHARE_2 = '55555555-0000-4000-8000-000000000002'
const DROP = 'drop-hardening'

async function hardFixture({ answerSlots = true } = {}) {
  const f = await fixture()
  const { db } = f
  db.exec(migration('0023_cop_tags_uploads.sql'))
  db.exec(migration('0024_cop_evidence_links.sql'))
  db.exec(migration('0025_cop_upload_documents.sql'))
  db.exec(migration('0026_cop_evidence_link_votes.sql'))
  if (answerSlots) db.exec(migration('0028_cop_share_answer_slots.sql'))
  db.exec(`UPDATE cop_rfis SET is_key = 1 WHERE cop_session_id = '${SESSION}'`)
  const share = db.prepare('INSERT INTO cop_shares (id, cop_session_id, share_token, visible_panels, allow_rfi_answers) VALUES (?, ?, ?, ?, 1)')
  share.run('sh-1', SESSION, SHARE, '["map","rfi"]')
  share.run('sh-2', SESSION, SHARE_2, '["map","rfi"]')
  return f
}

const feed = async (env, since, who = 'owner') => {
  const res = await call(env, 'chatFeed', 'GET', `${P}/chat-feed?since=${since}`, { who, params: S })
  const text = await res.text()
  assert.equal(res.status, 200, text)
  return { ...JSON.parse(text), text }
}
const start = async (env) => (await feed(env, '')).cursor
const publicAnswer = (env, text, { share = SHARE, ip = '203.0.113.7', rfi = 'rfi-existing' } = {}) =>
  call(env, 'publicAnswers', 'POST', `/api/cop/public/${share}/rfis/${rfi}/answers`, {
    who: 'anonymous', params: { token: share, rfiId: rfi }, body: { answer_text: text }, headers: { 'CF-Connecting-IP': ip },
  })

// ── 1. Who answered ──────────────────────────────────────────────

test('a legacy share-link answer (no answer-id event) is anonymous, even after the team touches it', async () => {
  const { db, env } = await hardFixture()
  // As production wrote it before answer ids: created_by left to the column default
  // (user 1, the owner) and an event {via:'share'} attributed to the share's creator.
  db.prepare(`INSERT INTO cop_rfi_answers (id, rfi_id, answer_text, is_accepted, responder_name, created_at)
    VALUES ('rfia-legacy', 'rfi-existing', 'Visitor text: go to evil.example now', 0, 'Anonymous', '2026-10-01')`).run()
  db.prepare(`INSERT INTO cop_events (id, cop_session_id, event_type, entity_type, entity_id, payload, created_by)
    VALUES ('evt-legacy-1', ?, 'rfi.answered', 'rfi', 'rfi-existing', '{"via":"share"}', 1)`).run(SESSION)
  // And an answer whose own event was never written (a lost fire-and-forget insert).
  db.prepare(`INSERT INTO cop_rfi_answers (id, rfi_id, answer_text, is_accepted, created_at)
    VALUES ('rfia-lost', 'rfi-existing', 'No event for me', 0, '2026-10-01')`).run()

  const cursor = await start(env)
  for (const id of ['rfia-legacy', 'rfia-lost']) {
    const put = await call(env, 'rfiAnswers', 'PUT', `${P}/rfis/rfi-existing/answers`, {
      who: 'owner', params: { ...S, rfiId: 'rfi-existing' }, body: { answer_id: id, is_accepted: false },
    })
    assert.equal(put.status, 200)
  }
  const page = await feed(env, cursor)
  const labels = Object.fromEntries(page.items.filter((i) => i.kind === 'answer').map((i) => [i.entity_id, i.labels]))
  assert.deepEqual(labels, {
    'rfia-legacy': ['anonymous', 'proposed', 'key question'],
    'rfia-lost': ['anonymous', 'proposed', 'key question'],
  })
})

test('an answer is the team\'s, or the chat\'s, only by its own answered event', async () => {
  const { env } = await hardFixture()
  const cursor = await start(env)
  const team = await call(env, 'rfiAnswers', 'POST', `${P}/rfis/rfi-existing/answers`, {
    who: 'editor', params: { ...S, rfiId: 'rfi-existing' }, body: { answer_text: 'Police vans' },
  })
  assert.equal(team.status, 201)
  const bot = await call(env, 'rfis', 'POST', `${P}/rfis`, { who: 'service', through: 'middleware', params: S, body: { question: 'Bot question?' } })
  const botRfi = (await bot.json()).id
  const resolved = await call(env, 'rfiAnswers', 'POST', `${P}/rfis/${botRfi}/answers`, {
    who: 'service', through: 'middleware', params: { ...S, rfiId: botRfi }, body: { answer_text: 'Resolved in chat' },
  })
  assert.equal(resolved.status, 201)
  const page = await feed(env, cursor)
  const answers = page.items.filter((i) => i.kind === 'answer').map((i) => [i.title, i.labels[0]])
  assert.deepEqual(answers, [['Police vans', 'from the team'], ['Resolved in chat', 'from chat']])
})

// ── 2. Share-link answer limits ──────────────────────────────────

test('a share link takes at most SHARE_ANSWERS_PER_HOUR answers an hour, whatever the addresses', async () => {
  const { db, env } = await hardFixture()
  const { SHARE_ANSWERS_PER_HOUR } = mod('publicAnswers')
  assert.equal(SHARE_ANSWERS_PER_HOUR, 20)
  for (let i = 0; i < SHARE_ANSWERS_PER_HOUR; i += 1) {
    const res = await publicAnswer(env, `Answer ${i}`, { ip: `198.51.100.${i + 1}` })
    assert.equal(res.status, 201, `answer ${i}: ${await res.clone().text()}`)
  }
  const over = await publicAnswer(env, 'One too many', { ip: '198.51.100.200' })
  assert.equal(over.status, 429)
  assert.equal((await over.json()).code, 'SHARE_RATE_LIMITED')
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM cop_rfi_answers WHERE answer_text = 'One too many'").get().n, 0)
  // Another share of the same COP has its own allowance.
  assert.equal((await publicAnswer(env, 'Other link', { share: SHARE_2, ip: '198.51.100.201' })).status, 201)
  // A request refused for its body takes no slot.
  const bad = await call(env, 'publicAnswers', 'POST', `/api/cop/public/${SHARE_2}/rfis/rfi-existing/answers`, {
    who: 'anonymous', params: { token: SHARE_2, rfiId: 'rfi-existing' }, body: { answer_text: '' }, headers: { 'CF-Connecting-IP': '198.51.100.202' },
  })
  assert.equal(bad.status, 400)
  assert.equal(db.prepare("SELECT n FROM cop_share_answer_slots WHERE share_id = 'sh-2'").get().n, 1)
})

test('before migration 0028 share-link answers still work (the address limit stays)', async () => {
  const { env } = await hardFixture({ answerSlots: false })
  assert.equal((await publicAnswer(env, 'Before the migration')).status, 201)
})

test('the address limit counts an IPv6 client by its /64', async () => {
  const { env } = await hardFixture()
  const { limiterAddress } = mod('copPublic')
  assert.equal(limiterAddress('2001:db8:1:2::1'), '2001:db8:1:2::/64')
  assert.equal(limiterAddress('2001:0db8:0001:0002:ffff:ffff:ffff:ffff'), '2001:db8:1:2::/64')
  assert.equal(limiterAddress('2001:db8::1'), '2001:db8:0:0::/64')
  assert.equal(limiterAddress('::ffff:192.0.2.9'), '192.0.2.9')
  assert.equal(limiterAddress('192.0.2.9'), '192.0.2.9')
  assert.equal(limiterAddress(''), 'no-address')
  // Ten answers from one /64, then an eleventh from another address in it: refused.
  for (let i = 1; i <= 10; i += 1) {
    assert.equal((await publicAnswer(env, `v6 ${i}`, { ip: `2001:db8:1:2::${i.toString(16)}` })).status, 201)
  }
  const sameNet = await publicAnswer(env, 'v6 same /64', { ip: '2001:db8:1:2:abcd::99' })
  assert.equal(sameNet.status, 429)
  assert.equal((await sameNet.json()).code, 'RATE_LIMITED')
  assert.equal((await publicAnswer(env, 'v6 next /64', { ip: '2001:db8:1:3::1' })).status, 201)
})

// ── Summary of anonymous floods ──────────────────────────────────

test('more than 3 unreviewed anonymous answers in a page become one summary item; 3 stay as they are', async () => {
  const { env } = await hardFixture()
  let cursor = await start(env)
  for (let i = 1; i <= 3; i += 1) await publicAnswer(env, `Three ${i}`, { ip: `192.0.2.${i}` })
  let page = await feed(env, cursor)
  assert.deepEqual(page.items.map((i) => [i.kind, i.title]), [['answer', 'Three 1'], ['answer', 'Three 2'], ['answer', 'Three 3']])

  cursor = page.cursor
  const team = await call(env, 'rfis', 'POST', `${P}/rfis`, { who: 'editor', params: S, body: { question: 'Team question?' } })
  assert.equal(team.status, 201)
  for (let i = 1; i <= 5; i += 1) await publicAnswer(env, `Flood ${i}`, { ip: `192.0.2.${10 + i}` })
  page = await feed(env, cursor)
  assert.deepEqual(page.items.map((i) => [i.kind, i.action, i.title, i.labels, i.actor, i.count]), [
    ['rfi', 'created', 'Team question?', ['from the team'], 'team', undefined],
    ['summary', 'created', null, ['anonymous'], 'anonymous', 5],
  ])
  assert.ok(!page.text.includes('Flood'))
})

test('more than 3 unverified tips in a page become one summary item (their markers and filings too)', async () => {
  const { db, env } = await hardFixture()
  db.prepare(`INSERT INTO survey_drops (id, title, form_schema, share_token, status, cop_session_id, workspace_id, created_by, intent, auto_ingest, question_picker)
    VALUES ('drop-h', 'Tips', ?, ?, 'active', ?, ?, 1, 'drop', 1, 1)`)
    .run(JSON.stringify([{ name: 'what', label: 'What did you see?', type: 'textarea' }, { name: 'spot', label: 'Spot', type: 'geopoint' }]), DROP, SESSION, WS)
  const cursor = await start(env)
  for (let i = 1; i <= 4; i += 1) {
    const res = await call(env, 'dropSubmit', 'POST', `/api/surveys/public/${DROP}/drop-submit`, {
      who: 'anonymous', params: { token: DROP }, body: { form_data: { what: `Tip ${i}`, spot: `48.8${i},2.3${i}`, _questions: [{ id: 'rfi-existing' }] } },
    })
    assert.equal((await res.json()).ok, true)
  }
  const page = await feed(env, cursor)
  assert.deepEqual(page.items.map((i) => [i.kind, i.count, i.labels]), [['summary', 4, ['anonymous']]])
})

// ── 3. Title cleaning and ids ────────────────────────────────────

test('titles lose hidden characters, and links with or without a scheme are cut to the host', () => {
  const { chatLine } = mod('chatFeedLib')
  const cp = (...points) => String.fromCodePoint(...points)
  const tags = cp(0xe0001, 0xe0041, 0xe0042, 0xe007f)
  const cases = [
    [`Gate${cp(0x061c)} B`, 'Gate B'], // Arabic letter mark
    [`Gate B${tags} closed`, 'Gate B closed'], // tag characters
    [`ev${cp(0x00ad)}il.example/login`, 'evil.example'], // soft hyphen inside a link
    [`Hidden${cp(0x3164)}filler`, 'Hiddenfiller'], // Hangul filler
    [`go${cp(0x200b)} to evil.exam${cp(0x200d)}ple/x`, 'go to evil.example'], // zero-width joiner and space
    ['see evil.example?login=1&t=2 now', 'see evil.example now'],
    ['see evil.example#/login now', 'see evil.example now'],
    ['see evil.example:8443/x?y', 'see evil.example'],
    [`line${cp(0x2028)}break${cp(0x2029)}para\nnew`, 'line break para new'],
    [`right${cp(0x202e)}to-left${cp(0x2066)}isolate`, 'rightto-leftisolate'],
    ['https://user:pw@evil.example/a?b#c', 'evil.example'],
  ]
  for (const [input, expected] of cases) assert.equal(chatLine(input), expected, JSON.stringify(input))
})

test('an item whose id is not a plain id is dropped and counted', async () => {
  const { db, env } = await hardFixture()
  const cursor = await start(env)
  const insert = db.prepare("INSERT INTO cop_events (id, cop_session_id, event_type, entity_type, entity_id, payload, created_by) VALUES (?, ?, ?, 'rfi', ?, '{}', 2)")
  db.exec(`INSERT INTO cop_rfis (id, cop_session_id, question, created_by) VALUES ('rfi with space', '${SESSION}', 'Odd id', 1), ('${'r'.repeat(65)}', '${SESSION}', 'Long id', 1)`)
  insert.run('evt-bad-1', SESSION, 'rfi.updated', 'rfi with space')
  insert.run('evt-bad-2', SESSION, 'rfi.updated', 'r'.repeat(65))
  insert.run('evt-bad-3', SESSION, 'rfi.updated', '../rfi-existing')
  insert.run('evt-good', SESSION, 'rfi.updated', 'rfi-existing')
  const page = await feed(env, cursor)
  assert.deepEqual(page.items.map((i) => i.entity_id), ['rfi-existing'])
  assert.equal(page.skipped, 3)
})

// ── 4. Tip titles ────────────────────────────────────────────────

test('a tip is titled from its long-text answer, never a short field; with none it has no title', async () => {
  const { db, env } = await hardFixture()
  db.prepare(`INSERT INTO survey_drops (id, title, form_schema, share_token, status, cop_session_id, workspace_id, created_by, intent, auto_ingest)
    VALUES ('drop-t', 'Tips', ?, ?, 'active', ?, ?, 1, 'drop', 1)`)
    .run(JSON.stringify([
      { name: 'your_name', label: 'Your name (optional)', type: 'text' },
      { name: 'reach', label: 'Contact (Signal, phone or email)', type: 'text' },
      { name: 'place', label: 'Where were you?', type: 'text' },
      { name: 'what', label: 'What did you see?', type: 'textarea' },
    ]), DROP, SESSION, WS)
  const submit = (formData) => call(env, 'dropSubmit', 'POST', `/api/surveys/public/${DROP}/drop-submit`, {
    who: 'anonymous', params: { token: DROP }, body: { form_data: formData },
  }).then((r) => r.json())

  let cursor = await start(env)
  await submit({ your_name: 'Jo Bloggs', reach: '555-0100', place: 'Rue Royale 12', what: 'Vans at gate B' })
  let page = await feed(env, cursor)
  assert.deepEqual(page.items.map((i) => [i.kind, i.title]), [['evidence', 'Vans at gate B']])
  for (const secret of ['Jo', '555', 'Royale']) assert.ok(!page.text.includes(secret), secret)

  cursor = page.cursor
  const only = await submit({ your_name: 'Jo Bloggs', reach: '555-0100', place: 'Rue Royale 12' })
  page = await feed(env, cursor)
  assert.deepEqual(page.items.map((i) => [i.kind, i.title, i.labels]), [['evidence', null, ['anonymous tip', 'unverified']]])
  assert.equal(db.prepare('SELECT title FROM evidence_items WHERE id = ?').get(Number(only.ingested.evidence_id)).title, 'Anonymous tip')
  for (const secret of ['Jo', '555', 'Royale']) assert.ok(!page.text.includes(secret), secret)
})

// ── 5. Compatibility for playbooks ───────────────────────────────

test('PUT /rfis with an answer and a status keeps new_status on its rfi.answered event', async () => {
  const { db, env } = await hardFixture()
  const at = db.prepare('SELECT MAX(rowid) AS n FROM cop_events').get().n ?? 0
  const res = await call(env, 'rfis', 'PUT', `${P}/rfis`, { who: 'editor', params: S, body: { id: 'rfi-existing', status: 'answered', answer: 'At noon' } })
  assert.equal(res.status, 200)
  const answered = db.prepare("SELECT payload FROM cop_events WHERE rowid > ? AND event_type = 'rfi.answered'").all(at).map((e) => JSON.parse(e.payload))
  assert.equal(answered.length, 1)
  assert.equal(answered[0].new_status, 'answered')
  assert.match(answered[0].answer_id, /^rfa-/)
})

// ── 6. The Signal bot, by exact client id ────────────────────────

test('only the Signal bot\'s exact client ids read the chat feed or write as "from chat"', async () => {
  const { env } = await hardFixture()
  const { SIGNAL_BOT_CLIENT_IDS, isSignalBotClient } = mod('copCaller')
  assert.ok(SIGNAL_BOT_CLIENT_IDS.has('irregularchat-signal-prod'))
  assert.equal(isSignalBotClient(CLIENT_ID), true)
  for (const id of ['signal', 'my-signal-importer', 'IRREGULARCHAT-SIGNAL-PROD', 'irregularchat-signal-prod2']) {
    assert.equal(isSignalBotClient(id), false, id)
    const request = new Request(`https://researchtools.test${P}/chat-feed?since=`)
    const res = await mod('chatFeed').onRequestGet({
      request, env, params: S, data: { copService: { clientId: id, principalUserId: SERVICE_USER, workspaceId: 'workspace-test' } },
    })
    assert.equal(res.status, 403, id)
  }
  const { copSourceChannel } = mod('copInput')
  assert.equal(copSourceChannel({ data: { copService: { clientId: 'my-signal-importer', principalUserId: SERVICE_USER } } }), 'api')
  assert.equal(copSourceChannel({ data: { copService: { clientId: CLIENT_ID, principalUserId: SERVICE_USER } } }), 'signal')
})
