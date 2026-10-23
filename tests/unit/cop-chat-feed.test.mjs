/**
 * The COP → chat feed (GET /api/cop/:id/chat-feed) and the typed events it reads.
 *
 * - Callers: the Signal bot's credential (through the middleware) and the COP's owner
 *   and collaborators. Share links, strangers, readers of a public COP, anonymous
 *   callers and other services are refused.
 * - since= empty: the current cursor and nothing else.
 * - No echo: what the bot created or changed never comes back; the team's changes to
 *   it do (an answer to the bot's question, closing it, confirming its marker, filing
 *   its evidence, reopening its task).
 * - A drop-form tip is "anonymous tip" / "unverified", without its text, link or
 *   submitter; once an editor reviews it, its title and source domain (never the path).
 * - No user id, name or email anywhere in the JSON.
 * - Votes and the middleware's generic events are skipped and counted; events on one
 *   entity in a page coalesce; ids from another COP never resolve; limit/has_more
 *   page without losing or repeating an item.
 * - The writes that matter to a chat emit typed events with the entity id and the
 *   real actor, and no one's name in the payload.
 *
 * Run: npm run test:unit
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  call, CLIENT_ID, ENTRIES, fixture, migration, mod, OTHER_SESSION, OTHER_WS, SERVICE_USER, SESSION, setupCoreSuite, WS,
} from './cop-core-harness.mjs'

const R = 'functions/api/cop/[id]/'
Object.assign(ENTRIES, {
  chatFeed: `${R}chat-feed.ts`,
  copCaller: 'functions/api/_shared/cop-caller.ts',
  evidenceLinks: `${R}evidence-links.ts`,
  linkVote: `${R}evidence-links/[linkId]/vote.ts`,
  rfiEvidence: `${R}rfis/[rfiId]/evidence.ts`,
  dropSubmit: 'functions/api/surveys/public/[token]/drop-submit.ts',
})
setupCoreSuite()

const P = `/api/cop/${SESSION}`
const S = { id: SESSION }
const DROP = 'drop-chat-feed'
const SHARE = '44444444-0000-4000-8000-000000000001'
// A team member whose id, name and email are easy to find in any JSON.
const ANALYST = 918273
const ANALYST_NAME = 'Quinn Analyst'
const ANALYST_EMAIL = 'quinn.analyst@example.test'

async function feedFixture() {
  const f = await fixture()
  const { db, env } = f
  db.exec(migration('0023_cop_tags_uploads.sql'))
  db.exec(migration('0024_cop_evidence_links.sql'))
  db.exec(migration('0025_cop_upload_documents.sql'))
  db.exec(migration('0026_cop_evidence_link_votes.sql'))
  db.exec(`
    INSERT INTO users (id, username, email, full_name, hashed_password, role)
      VALUES (${ANALYST}, 'quinn.analyst', '${ANALYST_EMAIL}', '${ANALYST_NAME}', 'x', 'user');
    INSERT INTO cop_collaborators (id, cop_session_id, user_id, role) VALUES ('col-analyst', '${SESSION}', ${ANALYST}, 'editor');
    UPDATE cop_rfis SET is_key = 1 WHERE cop_session_id = '${SESSION}';
    INSERT INTO cop_rfis (id, cop_session_id, question, created_by, is_key, status) VALUES
      ('rfi-other', '${OTHER_SESSION}', 'Somebody else''s question', 4, 1, 'open');
    INSERT INTO cop_rfi_answers (id, rfi_id, answer_text, created_by) VALUES ('rfa-other', 'rfi-other', 'Somebody else''s answer', 4);
    INSERT INTO cop_tasks (id, cop_session_id, title, created_by, workspace_id) VALUES ('task-other', '${OTHER_SESSION}', 'Somebody else''s task', 4, '${OTHER_WS}');
    INSERT INTO cop_markers (id, cop_session_id, uid, lat, lon, label, workspace_id, created_by)
      VALUES ('mk-other', '${OTHER_SESSION}', 'uid-other', 1.5, 2.5, 'Somebody else''s marker', '${OTHER_WS}', 4);
    INSERT INTO evidence_items (id, title, description, source_url, evidence_type, credibility, reliability, workspace_id, created_by, cop_session_id, source_channel) VALUES
      (101, 'Police notice', 'x', 'https://example.org/notice', 'observation', 'probable', 'unknown', '${WS}', 1, '${SESSION}', 'web'),
      (201, 'Somebody else''s evidence', 'x', 'https://other.example/x', 'observation', 'probable', 'unknown', '${OTHER_WS}', 4, '${OTHER_SESSION}', 'web');
    INSERT INTO cop_evidence_links (id, cop_session_id, evidence_id, target_type, target_id, relation, created_by)
      VALUES ('evl-other', '${OTHER_SESSION}', '201', 'rfi', 'rfi-other', 'supports', 4);
  `)
  // The analyst signs in like the harness's users.
  const sessions = env.SESSIONS
  env.SESSIONS = { get: async (key) => (key === 'session-analyst' ? JSON.stringify({ user_id: ANALYST }) : sessions.get(key)) }
  return f
}

/** The feed as the bot reads it: its credential, through the COP middleware. */
const feed = async (env, since, { limit, who = 'service', session = SESSION } = {}) => {
  const query = new URLSearchParams({ since: since ?? '', ...(limit ? { limit: String(limit) } : {}) })
  const res = await call(env, 'chatFeed', 'GET', `/api/cop/${session}/chat-feed?${query}`, {
    who, params: { id: session }, through: who === 'service' ? 'middleware' : undefined,
  })
  const text = await res.text()
  assert.equal(res.status, 200, text)
  assert.equal(res.headers.get('Cache-Control'), 'no-store')
  return { ...JSON.parse(text), text }
}
const start = async (env) => (await feed(env, '')).cursor

const bot = (env, handler, method, path, body, params = S) =>
  call(env, handler, method, path, { who: 'service', through: 'middleware', params, body })
const as = (who, env, handler, method, path, body, params = S) =>
  call(env, handler, method, path, { who, through: 'middleware', params, body })
const created = async (res) => {
  const text = await res.text()
  assert.ok(res.status === 201 || res.status === 200, text)
  return JSON.parse(text)
}

const ITEM_KEYS = new Set([
  'event_id', 'at', 'kind', 'action', 'entity_id', 'title', 'status', 'labels', 'actor',
  'question_id', 'question_title', 'task_id', 'evidence_id', 'relation', 'domain',
])
function assertShape(items) {
  for (const item of items) {
    for (const key of Object.keys(item)) assert.ok(ITEM_KEYS.has(key), `unexpected field ${key}`)
    assert.ok(['team', 'anonymous', 'system'].includes(item.actor), item.actor)
    assert.ok(Array.isArray(item.labels))
    assert.ok(item.title === null || (typeof item.title === 'string' && item.title.length <= 140 && !/\n/.test(item.title)))
  }
}
const byKind = (items, kind) => items.filter((i) => i.kind === kind)

// ── Callers ──────────────────────────────────────────────────────

test('the bot reads the feed with its credential; since= empty answers the current cursor and no history', async () => {
  const { db, env } = await feedFixture()
  await created(await as('editor', env, 'rfis', 'POST', `${P}/rfis`, { question: 'Is the north gate open?' }))
  const max = () => String(db.prepare('SELECT MAX(rowid) AS n FROM cop_events WHERE cop_session_id = ?').get(SESSION).n)

  const first = await feed(env, '')
  assert.deepEqual(first.items, [])
  assert.equal(first.cursor, max())
  assert.equal(first.has_more, false)

  const rfi = await created(await as('editor', env, 'rfis', 'POST', `${P}/rfis`, { question: 'Who closed the bridge?', priority: 'high' }))
  const next = await feed(env, first.cursor)
  assertShape(next.items)
  assert.deepEqual(next.items.map((i) => [i.kind, i.action, i.entity_id, i.title, i.status, i.actor]),
    [['rfi', 'created', rfi.id, 'Who closed the bridge?', 'open', 'team']])
  assert.deepEqual(next.items[0].labels, ['from the team', 'high priority'])
  assert.match(next.items[0].at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/)
  assert.equal(next.cursor, max())
  assert.deepEqual((await feed(env, next.cursor)).items, [])

  // The owner and every collaborator role read it too (a preview of what the rooms get).
  for (const who of ['owner', 'editor', 'admin', 'viewer', 'analyst']) {
    assert.equal((await feed(env, first.cursor, { who })).items.length, 1, who)
  }
  // Bad cursors are a 400, as on /changes.
  for (const bad of ['abc', 'evt-unknown-1', '-1']) {
    const res = await call(env, 'chatFeed', 'GET', `${P}/chat-feed?since=${bad}`, { who: 'owner', params: S })
    assert.equal(res.status, 400, bad)
  }
})

test('share links, strangers, readers of a public COP, anonymous callers and other services are refused', async () => {
  const { db, env } = await feedFixture()
  db.prepare('INSERT INTO cop_shares (id, cop_session_id, share_token, visible_panels, allow_rfi_answers) VALUES (?, ?, ?, ?, 1)')
    .run('sh-1', SESSION, SHARE, '["map","rfi","evidence"]')
  db.exec(`UPDATE cop_sessions SET is_public = 1 WHERE id = '${SESSION}'`)
  const get = (who, { headers = {}, query = '', session = SESSION, through } = {}) =>
    call(env, 'chatFeed', 'GET', `/api/cop/${session}/chat-feed?since=${query}`, { who, headers, params: { id: session }, through })

  assert.equal((await get('anonymous')).status, 401)
  assert.equal((await get('stranger')).status, 403) // signed in, and the COP is public: still not a member
  assert.equal((await get('anonymous', { headers: { 'X-Share-Token': SHARE } })).status, 403)
  assert.equal((await get('owner', { headers: { 'X-Share-Token': SHARE } })).status, 403)
  assert.equal((await get('owner', { query: `&share=${SHARE}` })).status, 403)
  // The bot on a COP nobody shared with it: the middleware refuses, and so would the route.
  const foreign = await get('service', { session: OTHER_SESSION, through: 'middleware' })
  assert.equal(foreign.status, 403)

  // Another integration admitted by the middleware (not the Signal bot) is refused.
  const request = new Request(`https://researchtools.test${P}/chat-feed?since=`)
  const other = await mod('chatFeed').onRequestGet({
    request, env, params: S, data: { copService: { clientId: 'osint-importer', principalUserId: SERVICE_USER, workspaceId: 'workspace-test' } },
  })
  assert.equal(other.status, 403)
  assert.equal((await other.json()).code, 'SERVICE_NOT_ALLOWED')
  const signal = await mod('chatFeed').onRequestGet({
    request, env, params: S, data: { copService: { clientId: CLIENT_ID, principalUserId: SERVICE_USER, workspaceId: 'workspace-test' } },
  })
  assert.equal(signal.status, 200)

  const { COP_SERVICE_ROUTES } = mod('copCaller')
  const allowed = (method, path) => COP_SERVICE_ROUTES.some((r) => r.method === method && r.path.test(path))
  assert.equal(allowed('GET', '/api/cop/cop-x/chat-feed'), true)
  assert.equal(allowed('POST', '/api/cop/cop-x/chat-feed'), false)
  assert.equal(allowed('GET', '/api/cop/public/chat-feed'), false)
  assert.equal(allowed('GET', '/api/cop/sessions/chat-feed'), false)
  assert.equal(allowed('GET', '/api/cop/cop-x/chat-feed/x'), false)
})

// ── No echo ──────────────────────────────────────────────────────

test('no echo: what the bot posted and synced never comes back; the team\'s changes to it do', async () => {
  const { env } = await feedFixture()
  const cursor = await start(env)

  // The chat posts a question, a second question, a task, a marker and a link; the bot
  // files the link under its question, answers it (!resolve) and marks its task done (!done).
  const q1 = await created(await bot(env, 'rfis', 'POST', `${P}/rfis`, { question: 'Who is at the east gate?' }))
  const q2 = await created(await bot(env, 'rfis', 'POST', `${P}/rfis`, { question: 'Is the metro running?' }))
  const task = await created(await bot(env, 'tasks', 'POST', `${P}/tasks`, { title: 'Check the metro map' }))
  const marker = await created(await bot(env, 'markers', 'POST', `${P}/markers`, { lat: 48.85, lon: 2.35, label: 'Crowd at the east gate' }))
  const ev = await created(await bot(env, 'evidence', 'POST', `${P}/evidence`, { title: 'Video of the gate', url: 'https://video.example/gate?t=1' }))
  await created(await bot(env, 'rfiEvidence', 'POST', `${P}/rfis/${q1.id}/evidence`, { url: 'https://news.example/gate' }, { ...S, rfiId: q1.id }))
  await created(await bot(env, 'rfiAnswers', 'POST', `${P}/rfis/${q2.id}/answers`, { answer_text: 'Yes, every 4 minutes' }, { ...S, rfiId: q2.id }))
  assert.equal((await bot(env, 'tasks', 'PUT', `${P}/tasks`, { id: task.id, status: 'done' })).status, 200)

  const quiet = await feed(env, cursor)
  assert.deepEqual(quiet.items, [])
  assert.ok(quiet.echoes >= 9, String(quiet.echoes))

  // The team acts on the chat's items.
  await created(await as('editor', env, 'rfiAnswers', 'POST', `${P}/rfis/${q1.id}/answers`, { answer_text: 'Two police vans', responder_name: ANALYST_NAME }, { ...S, rfiId: q1.id }))
  assert.equal((await as('editor', env, 'rfi', 'PUT', `${P}/rfis/${q2.id}`, { status: 'closed' }, { ...S, rfiId: q2.id })).status, 200)
  assert.equal((await as('editor', env, 'markers', 'PUT', `${P}/markers`, { id: marker.id, confidence: 'CONFIRMED' })).status, 200)
  await created(await as('editor', env, 'evidenceLinks', 'POST', `${P}/evidence-links`, { evidence_id: String(ev.id), target_type: 'rfi', target_id: 'rfi-existing', relation: 'contradicts' }))
  assert.equal((await as('editor', env, 'tasks', 'PUT', `${P}/tasks`, { id: task.id, status: 'todo' })).status, 200)

  const back = await feed(env, quiet.cursor)
  assertShape(back.items)
  assert.equal(back.echoes, 0)
  const [answer] = byKind(back.items, 'answer')
  assert.deepEqual(
    { kind: answer.kind, action: answer.action, title: answer.title, status: answer.status, actor: answer.actor, question_id: answer.question_id, question_title: answer.question_title },
    { kind: 'answer', action: 'answered', title: 'Two police vans', status: 'proposed', actor: 'team', question_id: q1.id, question_title: 'Who is at the east gate?' },
  )
  assert.ok(answer.labels.includes('from the team'))
  const closed = back.items.find((i) => i.kind === 'rfi' && i.entity_id === q2.id)
  assert.equal(closed.action, 'closed')
  assert.deepEqual(closed.labels, ['from chat', 'closed'])
  const confirmed = back.items.find((i) => i.kind === 'marker')
  assert.deepEqual([confirmed.action, confirmed.title, confirmed.status, confirmed.labels], ['confirmed', 'Crowd at the east gate', 'confirmed', ['from chat', 'confirmed']])
  const filed = back.items.find((i) => i.kind === 'evidence_link')
  assert.deepEqual([filed.action, filed.title, filed.relation, filed.question_id, filed.question_title, filed.domain, filed.actor, filed.evidence_id],
    ['filed', 'Video of the gate', 'contradicts', 'rfi-existing', 'who is at the gate', 'video.example', 'team', String(ev.id)])
  assert.deepEqual(filed.labels, ['contradicts', 'from chat', 'unverified', 'key question'])
  const reopened = back.items.find((i) => i.kind === 'task')
  assert.deepEqual([reopened.action, reopened.title, reopened.status], ['reopened', 'Check the metro map', 'todo'])
  assert.equal(back.items.length, 5, JSON.stringify(back.items))
  // The bot's own answer (and the RFI it resolved) never appear.
  assert.ok(!back.text.includes('every 4 minutes'))
})

test('the team answering a question the bot asked, by status, comes back as "answered"', async () => {
  const { env } = await feedFixture()
  const q = await created(await bot(env, 'rfis', 'POST', `${P}/rfis`, { question: 'Where did the march start?' }))
  const cursor = await start(env)
  assert.equal((await as('analyst', env, 'rfi', 'PUT', `${P}/rfis/${q.id}`, { status: 'answered' }, { ...S, rfiId: q.id })).status, 200)
  const { items } = await feed(env, cursor)
  assert.deepEqual(items.map((i) => [i.kind, i.action, i.entity_id, i.actor, i.labels]),
    [['rfi', 'answered', q.id, 'team', ['from chat', 'answered']]])
})

// ── Anonymous tips ───────────────────────────────────────────────

function seedDrop(db) {
  db.prepare(`INSERT INTO survey_drops (id, title, form_schema, share_token, status, cop_session_id, workspace_id, created_by, intent, auto_ingest, question_picker)
    VALUES ('drop-chat', 'Paris tips', ?, ?, 'active', ?, ?, 1, 'drop', 1, 1)`)
    .run(JSON.stringify([
      { name: 'what', label: 'What did you see?', type: 'textarea' },
      { name: 'link', label: 'A link', type: 'url' },
      { name: 'contact', label: 'Your phone (optional)', type: 'text' },
    ]), DROP, SESSION, WS)
}

test('an anonymous tip: "anonymous tip" and "unverified", without its text, link or submitter; reviewed, its title and domain', async () => {
  const { db, env } = await feedFixture()
  seedDrop(db)
  const cursor = await start(env)
  const res = await call(env, 'dropSubmit', 'POST', `/api/surveys/public/${DROP}/drop-submit`, {
    who: 'anonymous', params: { token: DROP },
    body: { form_data: { what: 'Crowd at gate C, call me 555-0100', link: 'https://tipster.example/private/path?u=me', contact: '555-0100', _questions: [{ id: 'rfi-existing' }] } },
  })
  const submitted = await res.json()
  assert.equal(submitted.ok, true, JSON.stringify(submitted))
  const evidenceId = String(submitted.ingested.evidence_id)

  const page = await feed(env, cursor)
  assertShape(page.items)
  const tip = page.items.find((i) => i.kind === 'evidence')
  assert.deepEqual(tip, {
    event_id: tip.event_id, at: tip.at, kind: 'evidence', action: 'created', entity_id: evidenceId,
    title: null, status: 'unverified', labels: ['anonymous tip', 'unverified'], actor: 'anonymous',
  })
  const filing = page.items.find((i) => i.kind === 'evidence_link')
  assert.deepEqual([filing.action, filing.actor, filing.relation, filing.question_id, filing.title, filing.domain, filing.evidence_id],
    ['filed', 'anonymous', 'supports', 'rfi-existing', null, undefined, evidenceId])
  assert.deepEqual(filing.labels, ['supports', 'anonymous tip', 'unverified', 'key question'])
  for (const secret of ['555-0100', 'tipster', 'private', 'Crowd at gate', 'Your phone', 'drop-', 'survey', 'response', 'upload']) {
    assert.ok(!page.text.includes(secret), secret)
  }
  // Submissions, tags and the server's timeline line are not chat items.
  assert.deepEqual(page.items.map((i) => i.kind).sort(), ['evidence', 'evidence_link'])
  assert.ok(page.skipped >= 2, String(page.skipped))

  // An editor reviews it: the next page carries its title and the source's domain only.
  assert.equal((await as('editor', env, 'evidence', 'PUT', `${P}/evidence`, { id: evidenceId, credibility: 'probable' })).status, 200)
  const reviewed = await feed(env, page.cursor)
  assert.deepEqual(reviewed.items.map((i) => [i.kind, i.action, i.title, i.status, i.labels, i.actor, i.domain]), [
    ['evidence', 'status', 'Tip: Crowd at gate C, call me 555-0100', 'probable', ['anonymous tip', 'reviewed'], 'team', 'tipster.example'],
  ])
  assert.ok(!reviewed.text.includes('/private'), 'no path')
  assert.ok(!reviewed.text.includes('u=me'), 'no query')
})

test('an answer through a share link is anonymous and unverified, without its text, until the team accepts it', async () => {
  const { db, env } = await feedFixture()
  // A share link the bot made: its visitors' answers are still theirs, not the bot's.
  db.prepare('INSERT INTO cop_shares (id, cop_session_id, share_token, visible_panels, allow_rfi_answers, created_by) VALUES (?, ?, ?, ?, 1, ?)')
    .run('sh-bot', SESSION, SHARE, '["map","rfi"]', SERVICE_USER)
  const cursor = await start(env)
  const res = await call(env, 'publicAnswers', 'POST', `/api/cop/public/${SHARE}/rfis/rfi-existing/answers`, {
    who: 'anonymous', params: { token: SHARE, rfiId: 'rfi-existing' },
    body: { answer_text: 'My neighbour Jo saw it', responder_name: 'Jo Bloggs' },
  })
  assert.equal(res.status, 201, await res.clone().text())
  const answerId = (await res.json()).id

  const page = await feed(env, cursor)
  assert.deepEqual(page.items.map((i) => [i.kind, i.action, i.entity_id, i.title, i.status, i.labels, i.actor, i.question_id]), [
    ['answer', 'answered', answerId, null, 'proposed', ['anonymous', 'unverified', 'key question'], 'anonymous', 'rfi-existing'],
  ])
  assert.ok(!page.text.includes('Jo'))

  const accepted = await as('owner', env, 'rfiAnswers', 'PUT', `${P}/rfis/rfi-existing/answers`, { answer_id: answerId, is_accepted: true }, { ...S, rfiId: 'rfi-existing' })
  assert.equal(accepted.status, 200, await accepted.clone().text())
  const after = await feed(env, page.cursor)
  const item = after.items.find((i) => i.kind === 'answer')
  assert.deepEqual([item.action, item.title, item.status, item.labels, item.actor],
    ['status', 'My neighbour Jo saw it', 'accepted', ['anonymous', 'accepted', 'key question'], 'team'])
  assert.ok(!after.text.includes('Bloggs'))
})

// ── Names never ──────────────────────────────────────────────────

test('no user id, name or email anywhere in the feed, whatever the team does', async () => {
  const { db, env } = await feedFixture()
  const cursor = await start(env)
  const a = (handler, method, path, body, params) => as('analyst', env, handler, method, path, body, params)
  const rfi = await created(await a('rfis', 'POST', `${P}/rfis`, { question: 'When did the march start?', assigned_to: ANALYST, requester_name: ANALYST_NAME }))
  await created(await a('rfiAnswers', 'POST', `${P}/rfis/${rfi.id}/answers`, { answer_text: 'At noon', responder_name: ANALYST_NAME }, { ...S, rfiId: rfi.id }))
  const task = await created(await a('tasks', 'POST', `${P}/tasks`, { title: 'Map the route from https://maps.example/route?token=abc', assigned_to: ANALYST_NAME }))
  assert.equal((await a('tasks', 'PUT', `${P}/tasks`, { id: task.id, assigned_to: ANALYST_EMAIL, priority: 'critical', status: 'in_progress' })).status, 200)
  await created(await a('markers', 'POST', `${P}/markers`, { lat: 48.86, lon: 2.29, label: 'Start of the march', updated_by_name: ANALYST_NAME }))
  await created(await a('timeline', 'POST', `${P}/timeline`, { title: 'March leaves the square', event_date: '2026-10-20', source_url: 'https://www.press.example/live' }))
  await created(await a('hypotheses', 'POST', `${P}/hypotheses`, { statement: 'The march was planned online' }))
  await created(await a('claims', 'POST', `${P}/claims`, { url: 'https://press.example/story', claims: [{ claim: 'The march began at noon' }, { claim: 'Police closed the bridge' }] }))
  await created(await a('evidence', 'POST', `${P}/evidence`, { title: 'Route photo', url: 'https://photos.example/p/1' }))

  const page = await feed(env, cursor)
  assertShape(page.items)
  assert.deepEqual([...new Set(page.items.map((i) => i.kind))].sort(),
    ['answer', 'claim', 'evidence', 'hypothesis', 'marker', 'rfi', 'task', 'timeline'])
  assert.equal(byKind(page.items, 'claim').length, 2)
  assert.deepEqual(byKind(page.items, 'claim').map((c) => [c.title, c.labels, c.domain]), [
    ['The march began at noon', ['from the team', 'AI first pass', 'unverified'], 'press.example'],
    ['Police closed the bridge', ['from the team', 'AI first pass', 'unverified'], 'press.example'],
  ])
  assert.deepEqual(byKind(page.items, 'timeline').map((t) => [t.title, t.domain]), [['March leaves the square', 'press.example']])
  const t = byKind(page.items, 'task')[0]
  assert.deepEqual([t.action, t.title, t.status, t.labels], ['created', 'Map the route from maps.example', 'in_progress', ['from the team', 'in progress', 'critical']])
  assert.ok(!page.text.includes('token=abc'), 'a link in a title is cut to its host')

  const lower = page.text.toLowerCase()
  for (const needle of [String(ANALYST), 'quinn', 'analyst', 'example.test', '"owner"', 'created_by', 'user_id', 'assigned', 'responder', 'requester', '48.86', '2.29']) {
    assert.ok(!lower.includes(needle.toLowerCase()), needle)
  }
  // The events themselves carry no one's name or email either (the new typed events).
  const payloads = db.prepare("SELECT event_type, payload FROM cop_events WHERE event_type IN ('task.assigned', 'task.priority_changed', 'rfi.answered', 'claim.created')").all()
  assert.ok(payloads.length >= 4)
  for (const p of payloads) assert.ok(!/quinn|example\.test|918273/i.test(p.payload), `${p.event_type}: ${p.payload}`)
})

// ── Noise, coalescing, scope, paging ─────────────────────────────

test('votes and the middleware\'s generic events are skipped and counted', async () => {
  const { db, env } = await feedFixture()
  const cursor = await start(env)
  const link = (await created(await as('owner', env, 'evidenceLinks', 'POST', `${P}/evidence-links`, { evidence_id: '101', target_type: 'rfi', target_id: 'rfi-existing' }))).link
  for (const who of ['owner', 'editor', 'viewer']) {
    const res = await call(env, 'linkVote', 'PUT', `${P}/evidence-links/${link.id}/vote`, { who, params: { ...S, linkId: link.id }, body: { value: 1 }, through: 'middleware' })
    assert.equal(res.status, 200)
  }
  // What the COP middleware writes for a write that emitted nothing.
  db.prepare("INSERT INTO cop_events (id, cop_session_id, event_type, entity_type, entity_id, payload, created_by) VALUES ('evt-fallback-1', ?, 'entity.changed', 'task', NULL, '{\"method\":\"PUT\"}', 2)").run(SESSION)

  const page = await feed(env, cursor)
  assert.deepEqual(page.items.map((i) => [i.kind, i.action, i.entity_id, i.title, i.relation]),
    [['evidence_link', 'filed', link.id, 'Police notice', 'supports']])
  assert.equal(page.skipped, 4) // 3 votes + 1 generic change
  assert.ok(!page.text.includes('vote'))
})

test('several events on one entity in a page are one item with its latest state; the cursor stays exact', async () => {
  const { db, env } = await feedFixture()
  const task = await created(await as('editor', env, 'tasks', 'POST', `${P}/tasks`, { title: 'Count the vans' }))
  const rfi = await created(await as('editor', env, 'rfis', 'POST', `${P}/rfis`, { question: 'How many vans?' }))
  const cursor = await start(env)

  const put = (body) => as('editor', env, 'tasks', 'PUT', `${P}/tasks`, { id: task.id, ...body })
  assert.equal((await put({ priority: 'high' })).status, 200)
  assert.equal((await put({ assigned_to: 'someone' })).status, 200)
  assert.equal((await put({ status: 'in_progress' })).status, 200)
  assert.equal((await put({ status: 'done' })).status, 200)
  assert.equal((await as('editor', env, 'rfi', 'PUT', `${P}/rfis/${rfi.id}`, { status: 'closed' }, { ...S, rfiId: rfi.id })).status, 200)
  assert.equal((await as('editor', env, 'rfi', 'PUT', `${P}/rfis/${rfi.id}`, { status: 'open' }, { ...S, rfiId: rfi.id })).status, 200)
  // Created and deleted in the same page: nothing to tell the chat.
  const gone = await created(await as('editor', env, 'tasks', 'POST', `${P}/tasks`, { title: 'Short-lived task' }))
  assert.equal((await call(env, 'tasks', 'DELETE', `${P}/tasks?task_id=${gone.id}`, { who: 'editor', params: S, through: 'middleware' })).status, 200)

  const page = await feed(env, cursor)
  const last = (id) => db.prepare('SELECT id FROM cop_events WHERE cop_session_id = ? AND entity_id = ? ORDER BY rowid DESC LIMIT 1').get(SESSION, id).id
  assert.deepEqual(page.items.map((i) => [i.kind, i.action, i.entity_id, i.status, i.labels, i.event_id]), [
    ['task', 'closed', task.id, 'done', ['from the team', 'done', 'high priority'], last(task.id)],
    ['rfi', 'reopened', rfi.id, 'open', ['from the team'], last(rfi.id)],
  ])
  assert.ok(!page.text.includes('Short-lived'))
  assert.equal(page.cursor, String(db.prepare('SELECT MAX(rowid) AS n FROM cop_events WHERE cop_session_id = ?').get(SESSION).n))
  assert.equal(page.has_more, false)
  assert.deepEqual((await feed(env, page.cursor)).items, [])
})

test('ids from another COP never resolve, whatever an event names', async () => {
  const { db, env } = await feedFixture()
  db.exec(`INSERT INTO cop_markers (id, cop_session_id, uid, lat, lon, label, workspace_id, created_by)
    VALUES ('mk-ours', '${SESSION}', 'uid-ours', 1, 1, 'Our marker', '${WS}', 1)`)
  const cursor = await start(env)
  const insert = db.prepare('INSERT INTO cop_events (id, cop_session_id, event_type, entity_type, entity_id, payload, created_by) VALUES (?, ?, ?, ?, ?, ?, 2)')
  const rows = [
    ['rfi.updated', 'rfi', 'rfi-other', '{}'],
    ['evidence.updated', 'evidence', '201', '{}'],
    ['marker.updated', 'marker', 'mk-other', '{}'],
    ['task.updated', 'task', 'task-other', '{}'],
    ['rfi.answered', 'rfi', 'rfi-other', '{"answer_id":"rfa-other"}'],
    ['rfi.answered', 'rfi', 'rfi-existing', '{"answer_id":"rfa-other"}'],
    ['evidence.linked', 'evidence', '201', '{"link_id":"evl-other","target_type":"rfi"}'],
    ['evidence.linked', 'rfi', 'rfi-other', '{"link_id":"evl-other","target_type":"rfi"}'],
    ['rfi.deleted', 'rfi', 'rfi-other', '{}'],
  ]
  rows.forEach(([type, entity, id, payload], i) => insert.run(`evt-idor-${i}`, SESSION, type, entity, id, payload))
  insert.run('evt-ours', SESSION, 'marker.updated', 'marker', 'mk-ours', '{}')

  const page = await feed(env, cursor)
  assert.deepEqual(page.items.map((i) => [i.kind, i.action, i.entity_id, i.title, i.status, i.labels]), [
    ['rfi', 'deleted', 'rfi-other', null, null, []],
    ['marker', 'updated', 'mk-ours', 'Our marker', 'possible', ['from the team']],
  ])
  assert.ok(!/Somebody else|other\.example/.test(page.text), page.text)
  // Everything else is skipped (the rfi.updated on rfi-other went into its deletion item).
  assert.equal(page.skipped, 7)
})

test('limit and has_more page through the feed without losing or repeating an item', async () => {
  const { db, env } = await feedFixture()
  const cursor = await start(env)
  const ids = []
  for (let i = 1; i <= 7; i += 1) ids.push((await created(await as('editor', env, 'rfis', 'POST', `${P}/rfis`, { question: `Question ${i}?` }))).id)
  // A bot echo between them takes no item slot.
  await created(await bot(env, 'rfis', 'POST', `${P}/rfis`, { question: 'From the chat?' }))

  const seen = []
  let since = cursor
  const pages = []
  for (let n = 0; n < 5; n += 1) {
    const page = await feed(env, since, { limit: 3 })
    pages.push([page.items.length, page.has_more])
    seen.push(...page.items.map((i) => i.entity_id))
    since = page.cursor
    if (!page.has_more) break
  }
  assert.deepEqual(pages, [[3, true], [3, true], [1, false]])
  assert.deepEqual(seen, ids)
  assert.equal(since, String(db.prepare('SELECT MAX(rowid) AS n FROM cop_events WHERE cop_session_id = ?').get(SESSION).n))
  // limit is clamped: 0 and junk fall back to the default, a huge one to the maximum.
  for (const limit of ['0', 'x', '100000']) {
    const res = await call(env, 'chatFeed', 'GET', `${P}/chat-feed?since=${cursor}&limit=${limit}`, { who: 'owner', params: S })
    assert.equal((await res.json()).items.length, 8, limit)
  }
})

// ── Typed events ─────────────────────────────────────────────────

async function typedFixture() {
  const f = await feedFixture()
  const { db } = f
  const since = () => db.prepare('SELECT MAX(rowid) AS n FROM cop_events').get().n ?? 0
  const typed = (after, type) => db.prepare('SELECT event_type, entity_type, entity_id, payload, created_by FROM cop_events WHERE rowid > ? AND event_type = ? ORDER BY rowid')
    .all(after, type)
  const a = (handler, method, path, body, params) => as('analyst', f.env, handler, method, path, body, params)
  return { ...f, since, typed, a }
}

test('typed: reopening a question emits rfi.reopened (both RFI routes); an answer given with a status edit emits rfi.answered with its id', async () => {
  const { since, typed, a } = await typedFixture()
  const rfi = await created(await a('rfis', 'POST', `${P}/rfis`, { question: 'Typed?' }))
  let at = since()
  await a('rfi', 'PUT', `${P}/rfis/${rfi.id}`, { status: 'closed' }, { ...S, rfiId: rfi.id })
  await a('rfi', 'PUT', `${P}/rfis/${rfi.id}`, { status: 'open' }, { ...S, rfiId: rfi.id })
  await a('rfi', 'PUT', `${P}/rfis/${rfi.id}`, { status: 'open' }, { ...S, rfiId: rfi.id }) // already open: nothing
  assert.deepEqual(typed(at, 'rfi.reopened').map((e) => [e.entity_id, Number(e.created_by), Object.keys(JSON.parse(e.payload)).sort()]),
    [[rfi.id, ANALYST, ['new_status', 'previous_status', 'question']]])
  at = since()
  await a('rfis', 'PUT', `${P}/rfis`, { id: rfi.id, status: 'closed' })
  await a('rfis', 'PUT', `${P}/rfis`, { id: rfi.id, status: 'open', answer: 'Answered in passing' })
  assert.equal(typed(at, 'rfi.reopened').length, 1)
  const inline = typed(at, 'rfi.answered').map((e) => JSON.parse(e.payload))
  assert.equal(inline.length, 1)
  assert.match(inline[0].answer_id, /^rfa-/)
})

test('typed: a task\'s priority, assignee and leaving "done" emit their own events; the assignee\'s name stays out', async () => {
  const { since, typed, a } = await typedFixture()
  const task = await created(await a('tasks', 'POST', `${P}/tasks`, { title: 'Typed task' }))
  const at = since()
  await a('tasks', 'PUT', `${P}/tasks`, { id: task.id, priority: 'high', assigned_to: ANALYST_NAME })
  await a('tasks', 'PUT', `${P}/tasks`, { id: task.id, priority: 'high', assigned_to: ANALYST_NAME }) // no change: no typed event
  await a('tasks', 'PUT', `${P}/tasks`, { id: task.id, status: 'done' })
  await a('tasks', 'PUT', `${P}/tasks`, { id: task.id, status: 'in_progress' })
  assert.deepEqual(typed(at, 'task.priority_changed').map((e) => [e.entity_id, JSON.parse(e.payload)]), [[task.id, { priority: 'high' }]])
  assert.deepEqual(typed(at, 'task.assigned').map((e) => [e.entity_id, Number(e.created_by), /quinn/i.test(e.payload)]), [[task.id, ANALYST, false]])
  assert.deepEqual(typed(at, 'task.reopened').map((e) => e.entity_id), [task.id])
  assert.deepEqual(typed(at, 'task.started').map((e) => e.entity_id), [task.id]) // the existing event still fires
})

test('typed: confirming a marker emits marker.confirmed once', async () => {
  const { since, typed, a } = await typedFixture()
  const marker = await created(await a('markers', 'POST', `${P}/markers`, { lat: 1, lon: 1, label: 'Typed marker' }))
  const at = since()
  await a('markers', 'PUT', `${P}/markers`, { id: marker.id, confidence: 'CONFIRMED' })
  await a('markers', 'PUT', `${P}/markers`, { id: marker.id, confidence: 'CONFIRMED', rationale: 'again' })
  assert.deepEqual(typed(at, 'marker.confirmed').map((e) => [e.entity_id, Number(e.created_by)]), [[marker.id, ANALYST]])
})

test('typed: changing evidence credibility emits evidence.reviewed; other edits do not', async () => {
  const { since, typed, a } = await typedFixture()
  const at = since()
  await a('evidence', 'PUT', `${P}/evidence`, { id: '101', credibility: 'confirmed' })
  await a('evidence', 'PUT', `${P}/evidence`, { id: '101', credibility: 'confirmed', title: 'Police notice (copy)' })
  assert.deepEqual(typed(at, 'evidence.reviewed').map((e) => [e.entity_id, JSON.parse(e.payload)]), [['101', { credibility: 'confirmed' }]])
})

test('typed: a bulk claim extraction emits one claim.created per claim, each with its id', async () => {
  const { db, since, typed, a } = await typedFixture()
  const at = since()
  await a('claims', 'POST', `${P}/claims`, { claims: [{ claim: 'One' }, { claim: 'Two' }, { claim: 'Three' }] })
  const claimIds = db.prepare('SELECT id FROM cop_claims WHERE cop_session_id = ? ORDER BY rowid').all(SESSION).map((r) => r.id)
  assert.equal(claimIds.length, 3)
  assert.deepEqual(typed(at, 'claim.created').map((e) => e.entity_id), claimIds)
})

test('typed: a share-link answer is anonymous (created_by 0, its answer id), even on a link the bot made', async () => {
  const { db, env, since, typed } = await typedFixture()
  db.prepare('INSERT INTO cop_shares (id, cop_session_id, share_token, visible_panels, allow_rfi_answers, created_by) VALUES (?, ?, ?, ?, 1, ?)')
    .run('sh-1', SESSION, SHARE, '["map","rfi"]', SERVICE_USER)
  const at = since()
  const answered = await call(env, 'publicAnswers', 'POST', `/api/cop/public/${SHARE}/rfis/rfi-existing/answers`, {
    who: 'anonymous', params: { token: SHARE, rfiId: 'rfi-existing' }, body: { answer_text: 'From a visitor' },
  })
  const answerId = (await answered.json()).id
  assert.deepEqual(typed(at, 'rfi.answered').map((e) => [e.entity_id, Number(e.created_by), JSON.parse(e.payload)]),
    [['rfi-existing', 0, { via: 'share', answer_id: answerId }]])
})

test('typed: a tipster\'s chosen question files the tip with anonymous events; the filing row keeps the form owner', async () => {
  const { db, env, since, typed } = await typedFixture()
  seedDrop(db)
  const at = since()
  await call(env, 'dropSubmit', 'POST', `/api/surveys/public/${DROP}/drop-submit`, {
    who: 'anonymous', params: { token: DROP }, body: { form_data: { what: 'Typed tip', _questions: [{ id: 'rfi-existing' }] } },
  })
  const linked = typed(at, 'evidence.linked')
  assert.equal(linked.length, 2)
  for (const e of linked) {
    assert.equal(Number(e.created_by), 0)
    assert.equal(JSON.parse(e.payload).via, 'tip')
  }
  assert.equal(db.prepare("SELECT created_by FROM cop_evidence_links WHERE target_id = 'rfi-existing'").get().created_by, 1)
})

test('typed: live clients still refetch: the change feed passes the new event types through with their entity types', async () => {
  const { env, a } = await typedFixture()
  const rfi = await created(await a('rfis', 'POST', `${P}/rfis`, { question: 'Typed?' }))
  const task = await created(await a('tasks', 'POST', `${P}/tasks`, { title: 'Typed task' }))
  const marker = await created(await a('markers', 'POST', `${P}/markers`, { lat: 1, lon: 1, label: 'Typed marker' }))
  const cursor = (await (await call(env, 'changes', 'GET', `${P}/changes?since=`, { who: 'viewer', params: S })).json()).cursor
  await a('rfi', 'PUT', `${P}/rfis/${rfi.id}`, { status: 'closed' }, { ...S, rfiId: rfi.id })
  await a('rfi', 'PUT', `${P}/rfis/${rfi.id}`, { status: 'open' }, { ...S, rfiId: rfi.id })
  await a('tasks', 'PUT', `${P}/tasks`, { id: task.id, priority: 'high', status: 'done' })
  await a('tasks', 'PUT', `${P}/tasks`, { id: task.id, status: 'todo' })
  await a('markers', 'PUT', `${P}/markers`, { id: marker.id, confidence: 'CONFIRMED' })
  await a('evidence', 'PUT', `${P}/evidence`, { id: '101', credibility: 'confirmed' })
  const changes = await call(env, 'changes', 'GET', `${P}/changes?since=${cursor}`, { who: 'viewer', params: S })
  const types = new Map((await changes.json()).events.map((e) => [e.event_type, [e.entity_type, e.entity_id]]))
  assert.deepEqual(Object.fromEntries(['rfi.reopened', 'task.priority_changed', 'task.reopened', 'marker.confirmed', 'evidence.reviewed'].map((t) => [t, types.get(t)])), {
    'rfi.reopened': ['rfi', rfi.id],
    'task.priority_changed': ['task', task.id],
    'task.reopened': ['task', task.id],
    'marker.confirmed': ['marker', marker.id],
    'evidence.reviewed': ['evidence', '101'],
  })
})
