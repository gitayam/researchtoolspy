/**
 * Evidence filed under questions (RFIs, key questions) and tasks — migration 0024.
 *
 * - POST/GET/DELETE /api/cop/:id/evidence-links: both ends checked in SQL to be the
 *   session's (another session's evidence or RFI, or library evidence elsewhere in the
 *   workspace, is 404); viewers and strangers can't write; a service changes and
 *   removes only the links it created; the same (evidence, question) pair is one row.
 * - POST /api/cop/:id/rfis/:rfiId/evidence: create (or reuse by canonical URL) and file
 *   in one call; the RFI's status never changes.
 * - Lists carry evidence_count; deleting evidence, an RFI or a task removes its links.
 * - The public share: counts always; filed evidence only with the evidence panel, an
 *   unreviewed drop tip masked as "Unverified tip" without its link.
 * - The evidence form's "Which question is this about?": only when the owner turned it
 *   on; only the COP's starred RFIs; a tipster can't file under another COP's RFI.
 * - Before migration 0024 everything answers cleanly.
 *
 * Run: npm run test:unit
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  call, count, ENTRIES, events, fixture, migration, mod, OTHER_SESSION, OTHER_WS, SERVICE_USER, SESSION,
  setupCoreSuite, WS,
} from './cop-core-harness.mjs'

const R = 'functions/api/cop/[id]/'
Object.assign(ENTRIES, {
  evidenceLinks: `${R}evidence-links.ts`,
  rfiEvidence: `${R}rfis/[rfiId]/evidence.ts`,
  copCaller: 'functions/api/_shared/cop-caller.ts',
  surveyPublic: 'functions/api/surveys/public/[token].ts',
  dropSubmit: 'functions/api/surveys/public/[token]/drop-submit.ts',
  surveyItem: 'functions/api/surveys/[id].ts',
  submissions: `${R}submissions.ts`,
  verifyPassword: 'functions/api/surveys/public/[token]/verify-password.ts',
  evidenceItems: 'functions/api/evidence-items.ts',
})
setupCoreSuite()

const P = `/api/cop/${SESSION}`
const S = { id: SESSION }
const SHARE = '22222222-3333-4444-8555-666666666666'
const SHARE_NO_EVIDENCE = '22222222-3333-4444-8555-777777777777'
const DROP = 'drop-token-links'

/** The core fixture plus 0023 and 0024 (as production will have them), and seed items. */
async function linksFixture({ links = true } = {}) {
  const f = await fixture()
  const { db } = f
  db.exec(migration('0023_cop_tags_uploads.sql'))
  if (links) db.exec(migration('0024_cop_evidence_links.sql'))
  db.exec(`
    UPDATE cop_rfis SET is_key = 1 WHERE cop_session_id = '${SESSION}';
    INSERT INTO cop_rfis (id, cop_session_id, question, created_by, is_key) VALUES
      ('rfi-plain', '${SESSION}', 'Is the north gate open?', 1, 0),
      ('rfi-other', '${OTHER_SESSION}', 'Somebody else''s question', 4, 1);
    INSERT INTO evidence_items (id, title, description, source_url, evidence_type, credibility, reliability, workspace_id, created_by, cop_session_id, source_channel) VALUES
      (101, 'Police notice', 'x', 'https://example.org/notice', 'observation', 'probable', 'unknown', '${WS}', 1, '${SESSION}', 'web'),
      (102, 'Second report', 'x', 'https://example.org/second', 'observation', 'possible', 'unknown', '${WS}', 1, '${SESSION}', 'web'),
      (103, 'Tip: crowd at the gate, call 555-0100', 'contact me', 'https://tipster.example/secret', 'observation', 'unverified', 'unknown', '${WS}', 1, '${SESSION}', 'drop'),
      (201, 'Someone else''s evidence', 'x', 'https://example.org/other', 'observation', 'probable', 'unknown', '${OTHER_WS}', 4, '${OTHER_SESSION}', 'web'),
      (301, 'Library item in the owner''s workspace', 'x', 'https://example.org/library', 'observation', 'probable', 'unknown', '${WS}', 1, 'cop-sibling', 'web');
    INSERT INTO cop_tasks (id, cop_session_id, title, status, created_by) VALUES ('task-1', '${SESSION}', 'Check the gate', 'todo', 1);
  `)
  return f
}

const rfiIds = (db, session = SESSION) => db.prepare('SELECT id FROM cop_rfis WHERE cop_session_id = ? AND is_key = 1 ORDER BY rowid').all(session).map((r) => r.id)
const link = (env, who, body) => call(env, 'evidenceLinks', 'POST', `${P}/evidence-links`, { who, params: S, body })

// ── Writing links ───────────────────────────────────────────────────

test('an editor files evidence under a key question; the question stays open and unanswered', async () => {
  const { db, env } = await linksFixture()
  const [keyRfi] = rfiIds(db)
  const before = db.prepare('SELECT status, updated_at FROM cop_rfis WHERE id = ?').get(keyRfi)

  const res = await link(env, 'editor', { evidence_id: 101, target_type: 'rfi', target_id: keyRfi, note: 'Posted 09:10' })
  assert.equal(res.status, 201, await res.clone().text())
  const { link: created } = await res.json()
  assert.equal(created.relation, 'supports')
  assert.equal(created.note, 'Posted 09:10')
  assert.equal(created.evidence_id, '101')

  const after = db.prepare('SELECT status, updated_at FROM cop_rfis WHERE id = ?').get(keyRfi)
  assert.deepEqual(after, before)
  assert.equal(count(db, 'cop_rfi_answers', 'rfi_id = ?', keyRfi), 0)

  // Same pair again: one row, relation/note updated, 200.
  const again = await link(env, 'owner', { evidence_id: '101', target_type: 'rfi', target_id: keyRfi, relation: 'contradicts', note: '' })
  assert.equal(again.status, 200)
  assert.equal((await again.json()).link.relation, 'contradicts')
  assert.equal(count(db, 'cop_evidence_links'), 1)
  assert.equal(db.prepare('SELECT note FROM cop_evidence_links').get().note, null)

  const types = events(db).filter((e) => e.event_type.startsWith('evidence.link')).map((e) => `${e.event_type}:${e.entity_type}`)
  assert.deepEqual(types, ['evidence.linked:evidence', 'evidence.linked:rfi', 'evidence.link_updated:evidence', 'evidence.link_updated:rfi'])
})

test('both ends must be the session\'s: other sessions\' evidence or RFIs, and library evidence, are 404', async () => {
  const { db, env } = await linksFixture()
  const [keyRfi] = rfiIds(db)
  const cases = [
    [{ evidence_id: 201, target_type: 'rfi', target_id: keyRfi }, 'EVIDENCE_NOT_FOUND'],
    [{ evidence_id: 301, target_type: 'rfi', target_id: keyRfi }, 'EVIDENCE_NOT_FOUND'],
    [{ evidence_id: 999, target_type: 'rfi', target_id: keyRfi }, 'EVIDENCE_NOT_FOUND'],
    [{ evidence_id: 101, target_type: 'rfi', target_id: 'rfi-other' }, 'TARGET_NOT_FOUND'],
    [{ evidence_id: 101, target_type: 'task', target_id: 'task-nope' }, 'TARGET_NOT_FOUND'],
  ]
  for (const [body, code] of cases) {
    const res = await link(env, 'owner', body)
    assert.equal(res.status, 404, JSON.stringify(body))
    assert.equal((await res.json()).code, code, JSON.stringify(body))
  }
  for (const body of [
    { evidence_id: 101, target_type: 'hypothesis', target_id: keyRfi },
    { evidence_id: 'x1', target_type: 'rfi', target_id: keyRfi },
    { evidence_id: 101, target_type: 'rfi', target_id: keyRfi, relation: 'proves' },
    { evidence_id: 101, target_type: 'rfi', target_id: keyRfi, note: 'n'.repeat(1001) },
  ]) {
    assert.equal((await link(env, 'owner', body)).status, 400, JSON.stringify(body))
  }
  assert.equal(count(db, 'cop_evidence_links'), 0)
})

test('viewers, strangers and anonymous callers cannot file or remove; readers can list', async () => {
  const { db, env } = await linksFixture()
  const [keyRfi] = rfiIds(db)
  const body = { evidence_id: 101, target_type: 'rfi', target_id: keyRfi }
  assert.equal((await link(env, 'viewer', body)).status, 403)
  assert.equal((await link(env, 'stranger', body)).status, 403)
  assert.equal((await link(env, 'anonymous', body)).status, 401)
  assert.equal((await call(env, 'rfiEvidence', 'POST', `${P}/rfis/${keyRfi}/evidence`, { who: 'viewer', params: { ...S, rfiId: keyRfi }, body: { url: 'https://example.org/x' } })).status, 403)

  const created = await (await link(env, 'admin', body)).json()
  const del = (who) => call(env, 'evidenceLinks', 'DELETE', `${P}/evidence-links`, { who, params: S, body: { id: created.link.id } })
  assert.equal((await del('viewer')).status, 403)
  assert.equal((await del('stranger')).status, 403)
  const listed = await call(env, 'evidenceLinks', 'GET', `${P}/evidence-links?target_type=rfi&target_id=${keyRfi}`, { who: 'viewer', params: S })
  assert.equal(listed.status, 200)
  assert.equal((await listed.json()).links.length, 1)
  assert.equal((await call(env, 'evidenceLinks', 'GET', `${P}/evidence-links`, { who: 'stranger', params: S })).status, 403)
  assert.equal(count(db, 'cop_evidence_links'), 1)
})

test('a service files evidence, but changes and removes only the links it created', async () => {
  const { db, env } = await linksFixture()
  const [keyRfi, secondKey] = rfiIds(db)
  const human = await (await link(env, 'owner', { evidence_id: 101, target_type: 'rfi', target_id: keyRfi })).json()

  const ownRes = await call(env, 'evidenceLinks', 'POST', `${P}/evidence-links`, {
    who: 'service-admitted', params: S, body: { evidence_id: 102, target_type: 'rfi', target_id: secondKey },
  })
  assert.equal(ownRes.status, 201)
  const own = await ownRes.json()
  assert.equal(db.prepare('SELECT created_by FROM cop_evidence_links WHERE id = ?').get(own.link.id).created_by, SERVICE_USER)

  const retag = await call(env, 'evidenceLinks', 'POST', `${P}/evidence-links`, {
    who: 'service-admitted', params: S, body: { evidence_id: 101, target_type: 'rfi', target_id: keyRfi, relation: 'contradicts' },
  })
  assert.equal(retag.status, 403)
  assert.equal(db.prepare('SELECT relation FROM cop_evidence_links WHERE id = ?').get(human.link.id).relation, 'supports')

  const delHuman = await call(env, 'evidenceLinks', 'DELETE', `${P}/evidence-links`, { who: 'service-admitted', params: S, body: { id: human.link.id } })
  assert.equal(delHuman.status, 403)
  const delOwn = await call(env, 'evidenceLinks', 'DELETE', `${P}/evidence-links?id=${own.link.id}`, { who: 'service-admitted', params: S })
  assert.equal(delOwn.status, 200)
  assert.equal(count(db, 'cop_evidence_links'), 1)
})

test('the service allow-list admits filing and unfiling, nothing broader', () => {
  const { COP_SERVICE_ROUTES } = mod('copCaller')
  const allowed = (method, path) => COP_SERVICE_ROUTES.some((r) => r.method === method && r.path.test(path))
  assert.equal(allowed('POST', '/api/cop/cop-x/evidence-links'), true)
  assert.equal(allowed('DELETE', '/api/cop/cop-x/evidence-links'), true)
  assert.equal(allowed('POST', '/api/cop/cop-x/rfis/rfi-1/evidence'), true)
  assert.equal(allowed('GET', '/api/cop/cop-x/evidence-links'), false)
  assert.equal(allowed('PUT', '/api/cop/cop-x/evidence-links'), false)
  assert.equal(allowed('POST', '/api/cop/cop-x/rfis/rfi-1/evidence/extra'), false)
  assert.equal(allowed('POST', '/api/cop/public/rfis/rfi-1/evidence'), false)
  assert.equal(allowed('POST', '/api/cop/sessions/rfis/rfi-1/evidence'), false)
})

// ── Add evidence to a question in one call ─────────────────────────

test('adding a link under a question creates the evidence once and files it; the status never changes', async () => {
  const { db, env } = await linksFixture()
  const [keyRfi, secondKey] = rfiIds(db)
  const add = (rfiId, body, who = 'editor') => call(env, 'rfiEvidence', 'POST', `${P}/rfis/${rfiId}/evidence`, { who, params: { ...S, rfiId }, body })
  const evidenceBefore = count(db, 'evidence_items')

  const res = await add(keyRfi, { url: 'https://news.example/live?utm_source=x', note: 'Live blog', relation: 'context' })
  assert.equal(res.status, 201, await res.clone().text())
  const first = await res.json()
  assert.equal(first.duplicate, false)
  assert.equal(first.link.relation, 'context')
  assert.equal(count(db, 'evidence_items'), evidenceBefore + 1)
  const row = db.prepare('SELECT cop_session_id, canonical_url, source_channel FROM evidence_items WHERE id = ?').get(first.evidence.id)
  assert.deepEqual({ ...row }, { cop_session_id: SESSION, canonical_url: 'https://news.example/live', source_channel: 'web' })

  // The same page under another question: reused, not duplicated.
  const again = await (await add(secondKey, { url: 'https://news.example/live' })).json()
  assert.equal(again.duplicate, true)
  assert.equal(again.evidence.id, first.evidence.id)
  assert.equal(count(db, 'evidence_items'), evidenceBefore + 1)
  assert.equal(count(db, 'cop_evidence_links'), 2)

  // A titled note without a link.
  const note = await add(keyRfi, { title: 'Steward says the gate opens at 18:00' })
  assert.equal(note.status, 201)

  for (const body of [{}, { url: 'javascript:alert(1)' }, { url: 'ftp://example.org/x' }]) {
    assert.equal((await add(keyRfi, body)).status, 400, JSON.stringify(body))
  }
  const foreign = await add('rfi-other', { url: 'https://example.org/fresh' })
  assert.equal(foreign.status, 404)
  assert.equal(count(db, 'evidence_items', "source_url = 'https://example.org/fresh'"), 0)

  const statuses = db.prepare('SELECT status FROM cop_rfis WHERE cop_session_id = ?').all(SESSION).map((r) => r.status)
  assert.ok(statuses.every((s) => s === 'open'), JSON.stringify(statuses))
})

test('lists carry evidence_count; deleting evidence, an RFI or a task removes its links', async () => {
  const { db, env } = await linksFixture()
  const [keyRfi, secondKey] = rfiIds(db)
  await link(env, 'owner', { evidence_id: 101, target_type: 'rfi', target_id: keyRfi })
  await link(env, 'owner', { evidence_id: 102, target_type: 'rfi', target_id: keyRfi })
  await link(env, 'owner', { evidence_id: 102, target_type: 'rfi', target_id: secondKey })
  await link(env, 'owner', { evidence_id: 101, target_type: 'task', target_id: 'task-1' })

  const rfis = (await (await call(env, 'rfis', 'GET', `${P}/rfis`, { who: 'viewer', params: S })).json()).rfis
  const byId = Object.fromEntries(rfis.map((r) => [r.id, r.evidence_count]))
  assert.equal(byId[keyRfi], 2)
  assert.equal(byId[secondKey], 1)
  assert.equal(byId['rfi-plain'], 0)
  const tasks = (await (await call(env, 'tasks', 'GET', `${P}/tasks`, { who: 'viewer', params: S })).json()).tasks
  assert.equal(tasks.find((t) => t.id === 'task-1').evidence_count, 1)

  assert.equal((await call(env, 'evidence', 'DELETE', `${P}/evidence?id=101`, { who: 'owner', params: S })).status, 200)
  assert.equal(count(db, 'cop_evidence_links', "evidence_id = '101'"), 0)
  assert.equal((await call(env, 'rfi', 'DELETE', `${P}/rfis/${secondKey}`, { who: 'owner', params: { ...S, rfiId: secondKey } })).status, 200)
  assert.equal(count(db, 'cop_evidence_links', 'target_id = ?', secondKey), 0)
  assert.equal(count(db, 'cop_evidence_links'), 1)
  assert.equal(count(db, 'evidence_items', 'id = 102'), 1)
})

test('a task delete removes the links of the task and its subtasks', async () => {
  const { db, env } = await linksFixture()
  db.exec(`INSERT INTO cop_tasks (id, cop_session_id, title, status, created_by, parent_task_id) VALUES ('task-sub', '${SESSION}', 'Sub', 'todo', 1, 'task-1')`)
  await link(env, 'owner', { evidence_id: 101, target_type: 'task', target_id: 'task-1' })
  await link(env, 'owner', { evidence_id: 102, target_type: 'task', target_id: 'task-sub' })
  const res = await call(env, 'tasks', 'DELETE', `${P}/tasks?task_id=task-1`, { who: 'owner', params: S })
  assert.equal(res.status, 200, await res.clone().text())
  assert.equal(count(db, 'cop_evidence_links'), 0)
})

// ── The public share ────────────────────────────────────────────────

function seedShares(db) {
  const future = new Date(Date.now() + 86_400_000).toISOString()
  db.prepare('INSERT INTO cop_shares (id, cop_session_id, share_token, visible_panels, expires_at) VALUES (?, ?, ?, ?, ?)')
    .run('share-ev', SESSION, SHARE, '["map","questions","rfi","evidence"]', future)
  db.prepare('INSERT INTO cop_shares (id, cop_session_id, share_token, visible_panels, expires_at) VALUES (?, ?, ?, ?, ?)')
    .run('share-noev', SESSION, SHARE_NO_EVIDENCE, '["map","questions"]', future)
}

const publicPayload = async (env, token) =>
  (await call(env, 'publicShare', 'GET', `/api/cop/public/${token}`, { who: 'anonymous', params: { token } })).json()

test('a share shows evidence counts; the filed items only with the evidence panel, tips masked', async () => {
  const { db, env } = await linksFixture()
  seedShares(db)
  const [keyRfi] = rfiIds(db)
  await link(env, 'owner', { evidence_id: 101, target_type: 'rfi', target_id: keyRfi, note: 'Internal note' })
  await link(env, 'owner', { evidence_id: 103, target_type: 'rfi', target_id: keyRfi, relation: 'contradicts' })
  await link(env, 'owner', { evidence_id: 102, target_type: 'rfi', target_id: 'rfi-plain' })

  const full = await publicPayload(env, SHARE)
  const key = full.key_rfis.find((r) => r.id === keyRfi)
  // The unreviewed tip is listed (masked) but not counted, and shows no relation.
  assert.equal(key.evidence_count, 1)
  assert.equal(key.unreviewed_count, 1)
  assert.equal(key.evidence.length, 2)
  const tip = key.evidence.find((e) => e.title === 'Unverified tip')
  assert.equal(tip.url, null)
  assert.equal(tip.relation, null)
  const notice = key.evidence.find((e) => e.relation === 'supports')
  assert.equal(notice.title, 'Police notice')
  assert.equal(notice.url, 'https://example.org/notice')
  assert.equal(full.rfis.find((r) => r.id === 'rfi-plain').evidence_count, 1)
  const text = JSON.stringify(full)
  for (const secret of ['555-0100', 'tipster.example', 'Internal note', 'contact me']) assert.ok(!text.includes(secret), secret)

  const lean = await publicPayload(env, SHARE_NO_EVIDENCE)
  const leanKey = lean.key_rfis.find((r) => r.id === keyRfi)
  assert.equal(leanKey.evidence_count, 1)
  assert.equal('evidence' in leanKey, false)
  assert.equal('unreviewed_count' in leanKey, false)
  assert.equal('rfis' in lean, false)
})

// ── "Which question is this about?" on the evidence form ───────────

function seedDrop(db, { picker = 1, createdBy = 1 } = {}) {
  db.prepare(`INSERT INTO survey_drops (id, title, form_schema, share_token, status, cop_session_id, workspace_id, created_by, intent, auto_ingest, question_picker)
    VALUES ('drop-links', 'Paris tips', ?, ?, 'active', ?, ?, ?, 'drop', 1, ?)`)
    .run(JSON.stringify([{ name: 'what', label: 'What did you see?', type: 'textarea' }]), DROP, SESSION, WS, createdBy, picker)
}

const formConfig = async (env) =>
  (await call(env, 'surveyPublic', 'GET', `/api/surveys/public/${DROP}`, { who: 'anonymous', params: { token: DROP } })).json()
const submitTip = async (env, formData) =>
  (await call(env, 'dropSubmit', 'POST', `/api/surveys/public/${DROP}/drop-submit`, {
    who: 'anonymous', params: { token: DROP }, body: { form_data: formData },
  })).json()

test('the form offers the COP\'s key questions only when its owner turned the picker on', async () => {
  const { db, env } = await linksFixture()
  seedDrop(db, { picker: 0 })
  assert.deepEqual((await formConfig(env)).question_choices, [])
  db.exec("UPDATE survey_drops SET question_picker = 1 WHERE id = 'drop-links'")
  const choices = (await formConfig(env)).question_choices
  assert.deepEqual(choices.map((c) => c.id), rfiIds(db))
  assert.ok(!choices.some((c) => c.id === 'rfi-plain' || c.id === 'rfi-other'))
  // A form made by someone who is no longer an editor offers nothing.
  db.exec("UPDATE survey_drops SET created_by = 3 WHERE id = 'drop-links'")
  assert.deepEqual((await formConfig(env)).question_choices, [])
})

test('a tip is filed under the key question its tipster chose, and never under another COP\'s', async () => {
  const { db, env } = await linksFixture()
  seedDrop(db)
  const [keyRfi, secondKey] = rfiIds(db)

  const chosen = await submitTip(env, { what: 'Crowd building at gate B', _question: keyRfi })
  assert.equal(chosen.ok, true, JSON.stringify(chosen))
  assert.ok(chosen.ingested?.evidence_id, JSON.stringify(chosen))
  const filed = db.prepare('SELECT target_id, relation FROM cop_evidence_links WHERE evidence_id = ?').all(String(chosen.ingested.evidence_id))
  assert.deepEqual(filed.map((r) => ({ ...r })), [{ target_id: keyRfi, relation: 'supports' }])

  const against = await submitTip(env, { what: 'Gate B is empty', _question: secondKey, _question_relation: 'contradicts' })
  assert.equal(db.prepare('SELECT relation FROM cop_evidence_links WHERE evidence_id = ?').get(String(against.ingested.evidence_id)).relation, 'contradicts')

  for (const bad of ['rfi-other', 'rfi-plain', 'rfi-nope', "x' OR 1=1 --"]) {
    const res = await submitTip(env, { what: `Tip naming ${bad}`, _question: bad })
    assert.ok(res.ingested?.evidence_id, bad)
    assert.equal(count(db, 'cop_evidence_links', 'evidence_id = ?', String(res.ingested.evidence_id)), 0, bad)
  }
  // The choice never shows as an answer in the evidence text.
  const description = db.prepare('SELECT description FROM evidence_items WHERE id = ?').get(Number(chosen.ingested.evidence_id)).description
  assert.ok(!description.includes(keyRfi), description)
})

test('a picker turned off ignores the choice; the owner sets it through the survey settings', async () => {
  const { db, env } = await linksFixture()
  seedDrop(db, { picker: 0 })
  const [keyRfi] = rfiIds(db)
  const tip = await submitTip(env, { what: 'Something', _question: keyRfi })
  assert.equal(count(db, 'cop_evidence_links', 'evidence_id = ?', String(tip.ingested.evidence_id)), 0)

  const put = await call(env, 'surveyItem', 'PUT', '/api/surveys/drop-links', { who: 'owner', params: { id: 'drop-links' }, body: { question_picker: true } })
  assert.equal(put.status, 200, await put.clone().text())
  const got = await (await call(env, 'surveyItem', 'GET', '/api/surveys/drop-links', { who: 'owner', params: { id: 'drop-links' } })).json()
  assert.equal(got.question_picker, true)
  assert.equal((await call(env, 'surveyItem', 'PUT', '/api/surveys/drop-links', { who: 'owner', params: { id: 'drop-links' }, body: { question_picker: 'yes' } })).status, 400)
})

// ── Before migration 0024 ────────────────────────────────────────────

test('before migration 0024: lists work with zero counts, writes answer 503 and create nothing', async () => {
  const { db, env } = await linksFixture({ links: false })
  const [keyRfi] = rfiIds(db)
  const evidenceBefore = count(db, 'evidence_items')

  const list = await call(env, 'evidenceLinks', 'GET', `${P}/evidence-links`, { who: 'viewer', params: S })
  assert.deepEqual(await list.json(), { links: [] })
  const post = await link(env, 'owner', { evidence_id: 101, target_type: 'rfi', target_id: keyRfi })
  assert.equal(post.status, 503)
  assert.equal((await post.json()).code, 'EVIDENCE_LINKS_UNAVAILABLE')
  const add = await call(env, 'rfiEvidence', 'POST', `${P}/rfis/${keyRfi}/evidence`, { who: 'owner', params: { ...S, rfiId: keyRfi }, body: { url: 'https://example.org/new' } })
  assert.equal(add.status, 503)
  assert.equal(count(db, 'evidence_items'), evidenceBefore)

  const rfis = (await (await call(env, 'rfis', 'GET', `${P}/rfis`, { who: 'owner', params: S })).json()).rfis
  assert.ok(rfis.every((r) => r.evidence_count === 0))
  assert.equal((await call(env, 'evidence', 'DELETE', `${P}/evidence?id=102`, { who: 'owner', params: S })).status, 200)
  seedShares(db)
  const payload = await publicPayload(env, SHARE)
  assert.ok(payload.key_rfis.every((r) => r.evidence_count === 0 && Array.isArray(r.evidence)))
})

// ── Security review follow-ups ─────────────────────────────────────

test('rejecting an auto-filed tip removes its filing: nothing orphaned, counted or listed', async () => {
  const { db, env } = await linksFixture()
  seedDrop(db)
  seedShares(db)
  const [keyRfi] = rfiIds(db)
  const sent = await submitTip(env, { what: 'spam spam', _question: keyRfi, _question_relation: 'contradicts' })
  const evId = String(sent.ingested.evidence_id)
  assert.equal(count(db, 'cop_evidence_links', 'evidence_id = ?', evId), 1)
  const sub = db.prepare('SELECT id FROM survey_responses WHERE ingested_evidence_id = ?').get(evId)

  const rej = await call(env, 'submissions', 'PUT', `${P}/submissions`, { who: 'owner', params: S, body: { id: sub.id, status: 'rejected' } })
  assert.equal(rej.status, 200, await rej.clone().text())
  assert.equal(count(db, 'evidence_items', 'id = ?', Number(evId)), 0)
  assert.equal(count(db, 'cop_evidence_links', 'evidence_id = ?', evId), 0)
  const links = (await (await call(env, 'evidenceLinks', 'GET', `${P}/evidence-links`, { who: 'owner', params: S })).json()).links
  assert.ok(!links.some((l) => l.evidence_id === evId))
  assert.equal((await publicPayload(env, SHARE)).key_rfis.find((r) => r.id === keyRfi).evidence_count, 0)
})

test('an orphaned or foreign link never counts or lists', async () => {
  const { db, env } = await linksFixture()
  seedShares(db)
  const [keyRfi] = rfiIds(db)
  await link(env, 'owner', { evidence_id: 101, target_type: 'rfi', target_id: keyRfi })
  // Rows the routes would never write: evidence that is gone, and another COP's evidence.
  db.exec(`
    INSERT INTO cop_evidence_links (id, cop_session_id, evidence_id, target_type, target_id, relation, created_by)
    VALUES ('evl-orphan', '${SESSION}', '999', 'rfi', '${keyRfi}', 'supports', 1),
           ('evl-foreign', '${SESSION}', '201', 'rfi', '${keyRfi}', 'supports', 1);
  `)
  const links = (await (await call(env, 'evidenceLinks', 'GET', `${P}/evidence-links`, { who: 'owner', params: S })).json()).links
  assert.deepEqual(links.map((l) => l.evidence_id), ['101'])
  const rfi = (await (await call(env, 'rfis', 'GET', `${P}/rfis`, { who: 'owner', params: S })).json()).rfis.find((r) => r.id === keyRfi)
  assert.equal(rfi.evidence_count, 1)
  const pub = (await publicPayload(env, SHARE)).key_rfis.find((r) => r.id === keyRfi)
  assert.equal(pub.evidence_count, 1)
  assert.equal(pub.evidence.length, 1)
})

test('deleting evidence from the library removes its filings', async () => {
  const { db, env } = await linksFixture()
  const [keyRfi] = rfiIds(db)
  await link(env, 'owner', { evidence_id: 102, target_type: 'rfi', target_id: keyRfi })
  db.exec('CREATE TABLE IF NOT EXISTS evidence_citations (id TEXT PRIMARY KEY, evidence_id INTEGER)') // as in production
  const request = new Request('https://researchtools.test/api/evidence-items?id=102', {
    method: 'DELETE',
    headers: { Authorization: 'Bearer session-owner', 'X-Workspace-ID': WS },
  })
  const res = await mod('evidenceItems').onRequest({ request, env, params: {}, data: {}, waitUntil() {} })
  assert.equal(res.status, 200, await res.clone().text())
  assert.equal(count(db, 'evidence_items', 'id = 102'), 0)
  assert.equal(count(db, 'cop_evidence_links', "evidence_id = '102'"), 0)
})

test('a share lists at most 20 items per question, newest first, and counts them all', async () => {
  const { db, env } = await linksFixture()
  seedShares(db)
  const [keyRfi] = rfiIds(db)
  const insert = db.prepare(`INSERT INTO evidence_items (id, title, description, source_url, evidence_type, credibility, reliability, workspace_id, created_by, cop_session_id, source_channel, created_at)
    VALUES (?, ?, 'x', NULL, 'observation', 'probable', 'unknown', ?, 1, ?, 'web', ?)`)
  for (let i = 0; i < 25; i++) {
    insert.run(500 + i, `Report ${i}`, WS, SESSION, new Date(Date.UTC(2026, 9, 1, 0, i)).toISOString())
    db.prepare("INSERT INTO cop_evidence_links (id, cop_session_id, evidence_id, target_type, target_id, relation, created_by) VALUES (?, ?, ?, 'rfi', ?, 'supports', 1)")
      .run(`evl-bulk-${i}`, SESSION, String(500 + i), keyRfi)
  }
  const key = (await publicPayload(env, SHARE)).key_rfis.find((r) => r.id === keyRfi)
  assert.equal(key.evidence_count, 25)
  assert.equal(key.evidence.length, 20)
  assert.equal(key.evidence[0].title, 'Report 24')
})

test('an evidence item can be filed under at most 50 questions and tasks', async () => {
  const { db, env } = await linksFixture()
  const insert = db.prepare('INSERT INTO cop_rfis (id, cop_session_id, question, created_by) VALUES (?, ?, ?, 1)')
  for (let i = 0; i < 51; i++) insert.run(`rfi-cap-${i}`, SESSION, `Question ${i}`)
  for (let i = 0; i < 50; i++) {
    const res = await link(env, 'owner', { evidence_id: 101, target_type: 'rfi', target_id: `rfi-cap-${i}` })
    assert.equal(res.status, 201, `link ${i}: ${await res.clone().text()}`)
  }
  const over = await link(env, 'owner', { evidence_id: 101, target_type: 'rfi', target_id: 'rfi-cap-50' })
  assert.equal(over.status, 409)
  assert.equal((await over.json()).code, 'LINK_LIMIT')
  assert.equal(count(db, 'cop_evidence_links', "evidence_id = '101'"), 50)
  // Updating an existing filing still works at the cap.
  assert.equal((await link(env, 'owner', { evidence_id: 101, target_type: 'rfi', target_id: 'rfi-cap-0', relation: 'context' })).status, 200)
})

test('an archived COP refuses filing and unfiling, and its form offers no questions', async () => {
  const { db, env } = await linksFixture()
  seedDrop(db)
  const [keyRfi] = rfiIds(db)
  const created = await (await link(env, 'owner', { evidence_id: 101, target_type: 'rfi', target_id: keyRfi })).json()
  db.exec(`UPDATE cop_sessions SET status = 'ARCHIVED' WHERE id = '${SESSION}'`)
  assert.equal((await link(env, 'owner', { evidence_id: 102, target_type: 'rfi', target_id: keyRfi })).status, 410)
  assert.equal((await call(env, 'evidenceLinks', 'DELETE', `${P}/evidence-links?id=${created.link.id}`, { who: 'owner', params: S })).status, 410)
  assert.equal(count(db, 'cop_evidence_links'), 1)
  assert.deepEqual((await formConfig(env)).question_choices, [])
})

test('the password route applies the form\'s country gate before handing out the form', async () => {
  const { db, env } = await linksFixture()
  seedDrop(db)
  db.exec(`UPDATE survey_drops SET access_level = 'password', password_hash = 'x', allowed_countries = '["FR"]' WHERE id = 'drop-links'`)
  const res = await call(env, 'verifyPassword', 'POST', `/api/surveys/public/${DROP}/verify-password`, {
    who: 'anonymous', params: { token: DROP }, body: { password: 'anything' }, headers: { 'CF-IPCountry': 'US' },
  })
  assert.equal(res.status, 403)
  const body = await res.json()
  assert.equal(body.country_blocked, true)
  assert.equal('question_choices' in body, false)
})
