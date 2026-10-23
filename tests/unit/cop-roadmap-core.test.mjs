/**
 * Chat-to-COP roadmap P1 (RT side): what the Signal bot may now do, and what readers
 * outside a COP no longer get.
 *
 * - The service allow-list admits PUT tasks, PUT evidence and POST rfis/:id/answers;
 *   each handler lets a service change only items it created (a task: only status,
 *   priority, assignee and due date).
 * - Evidence carries an archive reference (silo:/peertube: only) and a scan state;
 *   collaborators see "archived in Silo" / held, nobody outside the COP sees either.
 * - Public sessions: the events list is for collaborators; the change feed hides upload
 *   and submission ids from other readers; the share's evidence list flags held items.
 *
 * Run: npm run test:unit
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { call, fixture, mod, SERVICE_USER, SESSION, setupCoreSuite, WS } from './cop-core-harness.mjs'

setupCoreSuite()

const P = `/api/cop/${SESSION}`
const S = { id: SESSION }
const ok = (status) => status >= 200 && status < 300

function seed(db) {
  db.exec(`
    INSERT INTO cop_tasks (id, cop_session_id, title, created_by, workspace_id) VALUES
      ('tsk-bot', '${SESSION}', 'From chat', ${SERVICE_USER}, '${WS}'),
      ('tsk-human', '${SESSION}', 'A person''s task', 1, '${WS}');
    INSERT INTO cop_rfis (id, cop_session_id, question, created_by) VALUES ('rfi-bot', '${SESSION}', 'Asked in chat?', ${SERVICE_USER});
    INSERT INTO evidence_items (id, title, description, evidence_type, credibility, reliability, workspace_id, created_by, metadata) VALUES
      (9001, 'File posted in chat', 'held', 'document', 'unverified', 'unknown', '${WS}', ${SERVICE_USER}, '{"scan_state":"pending"}'),
      (9002, 'A person''s note', 'x', 'observation', 'unverified', 'unknown', '${WS}', 1, NULL),
      (9003, 'Photo from chat', 'x', 'image', 'unverified', 'unknown', '${WS}', ${SERVICE_USER}, '{"scan_state":"clean"}');
  `)
}

async function scoped() {
  const made = await fixture({ seed })
  made.db.exec(`UPDATE evidence_items SET cop_session_id = '${SESSION}' WHERE id IN (9001, 9002, 9003)`)
  made.db.exec(`UPDATE evidence_items SET source_ref = 'silo:4211', source_url = '${P}/uploads/upl-x' WHERE id = 9001`)
  made.db.exec(`UPDATE evidence_items SET source_ref = 'silo:4212', source_url = '${P}/uploads/upl-y' WHERE id = 9003`)
  return made
}

const service = (env, handler, method, path, body, params = S) =>
  call(env, handler, method, path, { who: 'service', through: 'middleware', body, params })

// ── The service allow-list, end to end through the middleware ─────

test('the bot updates its own task (status, priority, assignee, due date) and nobody else\'s', async () => {
  const { db, env } = await scoped()
  const own = await service(env, 'tasks', 'PUT', `${P}/tasks`, { id: 'tsk-bot', status: 'done', priority: 'high', assigned_to: 'a member', due_date: '2026-10-27' })
  assert.ok(ok(own.status), `${own.status} ${await own.text()}`)
  const row = db.prepare("SELECT status, priority, assigned_to, due_date, completed_at FROM cop_tasks WHERE id = 'tsk-bot'").get()
  assert.deepEqual({ ...row, completed_at: Boolean(row.completed_at) }, { status: 'done', priority: 'high', assigned_to: 'a member', due_date: '2026-10-27', completed_at: true })

  assert.equal((await service(env, 'tasks', 'PUT', `${P}/tasks`, { id: 'tsk-human', status: 'done' })).status, 403)
  // The bot may retitle its own task (a cancelled task becomes 'Cancelled: …'), never another field.
  const retitled = await service(env, 'tasks', 'PUT', `${P}/tasks`, { id: 'tsk-bot', title: 'Cancelled: Renamed by the bot' })
  assert.ok(ok(retitled.status), `${retitled.status} ${await retitled.text()}`)
  assert.equal(db.prepare("SELECT title FROM cop_tasks WHERE id = 'tsk-bot'").get().title, 'Cancelled: Renamed by the bot')
  assert.equal((await service(env, 'tasks', 'PUT', `${P}/tasks`, { id: 'tsk-human', title: 'Not mine' })).status, 403)
  const widened = await service(env, 'tasks', 'PUT', `${P}/tasks`, { id: 'tsk-bot', description: 'Not allowed' })
  assert.equal(widened.status, 400)
  assert.match((await widened.json()).error, /status, priority, assigned_to, due_date and title/)
  // A person with write access changes any task, title included.
  assert.ok(ok((await call(env, 'tasks', 'PUT', `${P}/tasks`, { who: 'editor', body: { id: 'tsk-human', title: 'Renamed' }, params: S })).status))
})

test('the bot lists the session\'s RFIs (for its q-numbers)', async () => {
  const { env } = await scoped()
  const res = await service(env, 'rfis', 'GET', `${P}/rfis`)
  assert.equal(res.status, 200, await res.clone().text())
  assert.ok(Array.isArray((await res.json()).rfis))
})

test('the bot answers (resolves) only RFIs it created', async () => {
  const { db, env } = await scoped()
  const own = await service(env, 'rfiAnswers', 'POST', `${P}/rfis/rfi-bot/answers`, { answer_text: 'Two guards', responder_name: 'a member' }, { ...S, rfiId: 'rfi-bot' })
  assert.equal(own.status, 201, await own.clone().text())
  assert.equal(db.prepare("SELECT status FROM cop_rfis WHERE id = 'rfi-bot'").get().status, 'answered')
  const human = await service(env, 'rfiAnswers', 'POST', `${P}/rfis/rfi-existing/answers`, { answer_text: 'x' }, { ...S, rfiId: 'rfi-existing' })
  assert.equal(human.status, 403)
})

test('the bot sets the archive reference and scan state on its own evidence only', async () => {
  const { db, env } = await scoped()
  const own = await service(env, 'evidence', 'PUT', `${P}/evidence`, { id: 9001, scan_state: 'clean', source_ref: 'silo:4299', description: 'Scanned clean' })
  assert.ok(ok(own.status), `${own.status} ${await own.text()}`)
  const row = db.prepare('SELECT description, source_ref, metadata FROM evidence_items WHERE id = 9001').get()
  assert.equal(row.description, 'Scanned clean')
  assert.equal(row.source_ref, 'silo:4299')
  assert.equal(JSON.parse(row.metadata).scan_state, 'clean')

  assert.equal((await service(env, 'evidence', 'PUT', `${P}/evidence`, { id: 9002, credibility: 'confirmed' })).status, 403)
  for (const body of [
    { id: 9001, source_ref: 'https://evil.example/doc' },
    { id: 9001, source_ref: 'silo:1;DROP TABLE x' },
    { id: 9001, scan_state: 'scanned' },
    { id: 9001, credibility: 'definitely' },
    { id: 'abc', title: 'x' },
  ]) {
    assert.equal((await service(env, 'evidence', 'PUT', `${P}/evidence`, body)).status, 400, JSON.stringify(body))
  }
  assert.equal((await service(env, 'evidence', 'PUT', `${P}/evidence`, { id: 2, title: 'Not this COP' })).status, 404)
})

test('evidence posted with an archive reference keeps it in place of the client id', async () => {
  const { db, env } = await scoped()
  const res = await service(env, 'evidence', 'POST', `${P}/evidence`, { title: 'File posted in chat', source_type: 'document', source_ref: 'silo:5000', scan_state: 'pending' })
  assert.equal(res.status, 201, await res.clone().text())
  const { id } = await res.json()
  const row = db.prepare('SELECT source_ref, source_channel, metadata FROM evidence_items WHERE id = ?').get(id)
  assert.equal(row.source_ref, 'silo:5000')
  assert.equal(row.source_channel, 'signal')
  assert.equal(JSON.parse(row.metadata).scan_state, 'pending')
  const plain = await service(env, 'evidence', 'POST', `${P}/evidence`, { title: 'Link from chat', url: 'https://news.example/a' })
  const plainRow = db.prepare('SELECT source_ref FROM evidence_items WHERE id = ?').get((await plain.json()).id)
  assert.match(plainRow.source_ref, /^integration|^community|signal|_/, 'without one, the client id as before')
})

test('the allow-list still refuses what the bot has no business doing', async () => {
  const { env } = await scoped()
  const timeline = await service(env, 'timeline', 'PUT', `${P}/timeline`, { id: 'x', title: 'y' })
  assert.equal(timeline.status, 403)
  const accept = await service(env, 'rfiAnswers', 'PUT', `${P}/rfis/rfi-bot/answers`, { answer_id: 'x', is_accepted: true }, { ...S, rfiId: 'rfi-bot' })
  assert.equal(accept.status, 403, 'accepting answers stays with people')
})

// ── Readers inside and outside the COP ────────────────────────────

test('collaborators see where a file is archived and whether it is held; outsiders see neither', async () => {
  const { db, env } = await scoped()
  const inside = await (await call(env, 'evidence', 'GET', `${P}/evidence`, { who: 'viewer', params: S })).json()
  const held = inside.evidence.find((e) => e.id === 9001)
  assert.equal(held.archived_in, 'silo')
  assert.equal(held.scan_state, 'pending')
  assert.equal(held.held, true)
  assert.equal(inside.evidence.find((e) => e.id === 9003).held, false)

  db.prepare('UPDATE cop_sessions SET is_public = 1 WHERE id = ?').run(SESSION)
  const outside = await (await call(env, 'evidence', 'GET', `${P}/evidence`, { who: 'stranger', params: S })).json()
  for (const row of outside.evidence) {
    assert.equal('source_ref' in row, false, 'no archive reference')
    assert.equal('metadata' in row, false, 'no scan state or upload ids')
    assert.equal('scan_state' in row, false)
  }
  assert.equal(outside.evidence.find((e) => e.id === 9001).source_url, null, 'a held file has no link outside the COP')
})

test('a share\'s evidence list flags held items and gives them no link', async () => {
  const { env } = await scoped()
  const items = await mod('copPublic').publicEvidence(env.DB, { sessionId: SESSION, workspaceId: WS })
  const held = items.find((e) => e.id === 9001)
  assert.equal(held.held, true)
  assert.equal(held.source_url, null)
  assert.equal('source_ref' in held, false)
})

test('on a public session, the events list is for collaborators', async () => {
  const { db, env } = await scoped()
  db.prepare('UPDATE cop_sessions SET is_public = 1 WHERE id = ?').run(SESSION)
  assert.equal((await call(env, 'events', 'GET', `${P}/events`, { who: 'stranger', params: S })).status, 403)
  assert.equal((await call(env, 'events', 'GET', `${P}/events`, { who: 'viewer', params: S })).status, 200)
})

test('the change feed hides upload and submission ids from readers outside the COP', async () => {
  const { db, env } = await scoped()
  db.prepare('UPDATE cop_sessions SET is_public = 1 WHERE id = ?').run(SESSION)
  const read = async (who) => {
    const start = await (await call(env, 'changes', 'GET', `${P}/changes?since=`, { who, params: S })).json()
    return start.cursor
  }
  const cursor = await read('viewer')
  db.exec(`INSERT INTO cop_events (id, cop_session_id, event_type, entity_type, entity_id, payload, created_by) VALUES
    ('ev-z1', '${SESSION}', 'upload.created', 'upload', 'upl-secret', '{}', 1),
    ('ev-z2', '${SESSION}', 'submission.received', 'submission', 'sub-secret', '{}', 1),
    ('ev-z3', '${SESSION}', 'task.created', 'task', 'tsk-bot', '{}', 1)`)
  const feed = async (who) => (await (await call(env, 'changes', 'GET', `${P}/changes?since=${encodeURIComponent(cursor)}`, { who, params: S })).json()).events
  const outside = await feed('stranger')
  assert.deepEqual(outside.map((e) => [e.entity_type, e.entity_id]), [['upload', null], ['submission', null], ['task', 'tsk-bot']])
  const inside = await feed('viewer')
  assert.deepEqual(inside.map((e) => e.entity_id), ['upl-secret', 'sub-secret', 'tsk-bot'])
})
