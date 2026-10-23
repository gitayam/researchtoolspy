/**
 * Submitting evidence straight into a question, and the team's votes on it (migration 0026).
 *
 * - PUT /api/cop/:id/evidence-links/:linkId/vote: the owner and collaborators (viewers
 *   too) vote 1 / -1 / 0, one vote each per filing; strangers, signed-in readers of a
 *   public COP, share visitors and the bot service can't. The filing must be the
 *   session's. An event goes out with counts, never who voted.
 * - Lists (workspace and share) carry up/down (and the caller's my_vote) and come
 *   ranked: score, then newest. Share items stay masked for unreviewed tips.
 * - Unfiling takes the votes with it.
 * - The evidence form's question picker offers, by where it was opened: the standalone
 *   link (key questions, owner opt-in), a share link's Submit sheet (that share's
 *   questions), a collaborator's workspace (every open question, via a question ticket).
 *   drop-submit refuses a question outside that list; the checked choice is stored and
 *   filed at ingest, even when a reviewer ingests it later.
 *
 * Run: npm run test:unit
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  call, count, ENTRIES, events, fixture, migration, mod, OTHER_SESSION, OTHER_WS, SERVICE_USER, SESSION, setupCoreSuite, WS,
} from './cop-core-harness.mjs'

const R = 'functions/api/cop/[id]/'
Object.assign(ENTRIES, {
  surveyDrops: 'functions/api/_shared/survey-drops.ts',
  evidenceLinks: `${R}evidence-links.ts`,
  linkVote: `${R}evidence-links/[linkId]/vote.ts`,
  questionTicket: `${R}question-ticket.ts`,
  ticketModule: 'functions/api/_shared/cop-question-ticket.ts',
  copCaller: 'functions/api/_shared/cop-caller.ts',
  surveyPublic: 'functions/api/surveys/public/[token].ts',
  dropSubmit: 'functions/api/surveys/public/[token]/drop-submit.ts',
  submissions: `${R}submissions.ts`,
})
setupCoreSuite()

const P = `/api/cop/${SESSION}`
const S = { id: SESSION }
const DROP = 'drop-token-votes'
const SECRET = 'test-jwt-secret-for-question-tickets'
const FUTURE = () => new Date(Date.now() + 86_400_000).toISOString()
const PAST = () => new Date(Date.now() - 60_000).toISOString()
const SHARES = {
  rfi: '33333333-0000-4000-8000-000000000001',
  questions: '33333333-0000-4000-8000-000000000002',
  none: '33333333-0000-4000-8000-000000000003',
  other: '33333333-0000-4000-8000-000000000004',
  expired: '33333333-0000-4000-8000-000000000005',
  noEvidence: '33333333-0000-4000-8000-000000000006',
  full: '33333333-0000-4000-8000-000000000007',
}

async function votesFixture({ votes = true } = {}) {
  const f = await fixture()
  const { db, env } = f
  env.JWT_SECRET = SECRET
  db.exec(migration('0023_cop_tags_uploads.sql'))
  db.exec(migration('0024_cop_evidence_links.sql'))
  db.exec(migration('0025_cop_upload_documents.sql'))
  if (votes) db.exec(migration('0026_cop_evidence_link_votes.sql'))
  db.exec(`
    UPDATE cop_rfis SET is_key = 1 WHERE cop_session_id = '${SESSION}';
    INSERT INTO cop_rfis (id, cop_session_id, question, created_by, is_key, status) VALUES
      ('rfi-plain', '${SESSION}', 'Is the north gate open?', 1, 0, 'open'),
      ('rfi-closed-plain', '${SESSION}', 'Was the bridge closed on Monday?', 1, 0, 'closed'),
      ('rfi-closed-key', '${SESSION}', 'Who called the march?', 1, 1, 'closed'),
      ('rfi-other', '${OTHER_SESSION}', 'Somebody else''s question', 4, 1, 'open');
    INSERT INTO evidence_items (id, title, description, source_url, evidence_type, credibility, reliability, workspace_id, created_by, cop_session_id, source_channel, created_at) VALUES
      (101, 'Police notice', 'x', 'https://example.org/notice', 'observation', 'probable', 'unknown', '${WS}', 1, '${SESSION}', 'web', '2026-10-20T10:00:00Z'),
      (102, 'Second report', 'x', 'https://example.org/second', 'observation', 'possible', 'unknown', '${WS}', 1, '${SESSION}', 'web', '2026-10-20T11:00:00Z'),
      (103, 'Tip: crowd at the gate, call 555-0100', 'contact me', 'https://tipster.example/secret', 'observation', 'unverified', 'unknown', '${WS}', 1, '${SESSION}', 'drop', '2026-10-20T12:00:00Z'),
      (201, 'Someone else''s evidence', 'x', 'https://example.org/other', 'observation', 'probable', 'unknown', '${OTHER_WS}', 4, '${OTHER_SESSION}', 'web', '2026-10-20T10:00:00Z');
  `)
  const share = db.prepare('INSERT INTO cop_shares (id, cop_session_id, share_token, visible_panels, expires_at, allow_evidence) VALUES (?, ?, ?, ?, ?, ?)')
  share.run('sh-rfi', SESSION, SHARES.rfi, '["map","rfi"]', FUTURE(), 1)
  share.run('sh-q', SESSION, SHARES.questions, '["map","questions"]', FUTURE(), 1)
  share.run('sh-none', SESSION, SHARES.none, '["map","evidence"]', FUTURE(), 1)
  share.run('sh-other', OTHER_SESSION, SHARES.other, '["map","rfi"]', FUTURE(), 1)
  share.run('sh-expired', SESSION, SHARES.expired, '["map","rfi"]', PAST(), 1)
  share.run('sh-noev', SESSION, SHARES.noEvidence, '["map","rfi"]', FUTURE(), 0)
  share.run('sh-full', SESSION, SHARES.full, '["map","questions","rfi","evidence"]', FUTURE(), 1)
  return f
}

const keyIds = (db) => db.prepare("SELECT id FROM cop_rfis WHERE cop_session_id = ? AND is_key = 1 AND status <> 'closed' ORDER BY rowid").all(SESSION).map((r) => r.id)
const file = async (env, evidenceId, targetId) => {
  const res = await call(env, 'evidenceLinks', 'POST', `${P}/evidence-links`, { who: 'owner', params: S, body: { evidence_id: evidenceId, target_type: 'rfi', target_id: targetId } })
  assert.ok(res.status === 201 || res.status === 200, await res.clone().text())
  return (await res.json()).link
}
const vote = (env, who, linkId, value, { session = SESSION, through } = {}) =>
  call(env, 'linkVote', 'PUT', `/api/cop/${session}/evidence-links/${linkId}/vote`, { who, params: { id: session, linkId }, body: { value }, through })
const votesOn = (db, linkId) => count(db, 'cop_evidence_link_votes', 'link_id = ?', linkId)

// ── Voting ───────────────────────────────────────────────────────────

test('the team votes on a filing: owner, editor, admin and viewer, one vote each, changed and cleared', async () => {
  const { db, env } = await votesFixture()
  const [keyRfi] = keyIds(db)
  const link = await file(env, 101, keyRfi)

  for (const [i, who] of ['owner', 'editor', 'admin', 'viewer'].entries()) {
    const res = await vote(env, who, link.id, 1)
    assert.equal(res.status, 200, `${who}: ${await res.clone().text()}`)
    assert.deepEqual(await res.json(), { link_id: link.id, up: i + 1, down: 0, my_vote: 1 })
  }
  // Changing a vote keeps one row per person.
  assert.deepEqual(await (await vote(env, 'viewer', link.id, -1)).json(), { link_id: link.id, up: 3, down: 1, my_vote: -1 })
  assert.equal(votesOn(db, link.id), 4)
  // Clearing removes the row.
  assert.deepEqual(await (await vote(env, 'viewer', link.id, 0)).json(), { link_id: link.id, up: 3, down: 0, my_vote: 0 })
  assert.equal(votesOn(db, link.id), 3)
  assert.deepEqual(await (await vote(env, 'stranger', link.id, 0)).status, 403)

  // Every real change tells the question's watchers, with counts and no user id; a repeat says nothing.
  const voted = () => events(db).filter((e) => e.event_type === 'evidence.link_voted')
  assert.equal(voted().length, 6)
  await vote(env, 'owner', link.id, 1)
  assert.equal(voted().length, 6)
  const rows = db.prepare("SELECT entity_type, entity_id, payload, created_by FROM cop_events WHERE event_type = 'evidence.link_voted'").all()
  for (const e of rows) {
    assert.equal(e.entity_type, 'rfi')
    assert.equal(e.entity_id, keyRfi)
    assert.equal(Number(e.created_by), 0)
    assert.deepEqual(Object.keys(JSON.parse(e.payload)).sort(), ['down', 'link_id', 'up'])
  }

  for (const bad of [2, '1', null, true, -2]) {
    assert.equal((await vote(env, 'owner', link.id, bad)).status, 400, String(bad))
  }
})

test('strangers, readers of a public COP, anonymous callers, share visitors and the bot service cannot vote', async () => {
  const { db, env } = await votesFixture()
  const [keyRfi] = keyIds(db)
  const link = await file(env, 101, keyRfi)
  db.exec(`UPDATE cop_sessions SET is_public = 1 WHERE id = '${SESSION}'`)

  assert.equal((await vote(env, 'stranger', link.id, 1)).status, 403)
  assert.equal((await vote(env, 'anonymous', link.id, 1)).status, 401)
  const viaShare = await call(env, 'linkVote', 'PUT', `${P}/evidence-links/${link.id}/vote?share=${SHARES.full}`, {
    who: 'anonymous', params: { ...S, linkId: link.id }, body: { value: 1 }, headers: { 'X-Share-Token': SHARES.full },
  })
  assert.equal(viaShare.status, 401)
  // The bot is an editor collaborator of this COP, and still can't vote.
  const admitted = await vote(env, 'service-admitted', link.id, 1)
  assert.equal(admitted.status, 403)
  assert.equal((await admitted.json()).code, 'SERVICE_CANNOT_VOTE')
  const viaMiddleware = await vote(env, 'service', link.id, 1, { through: 'middleware' })
  assert.ok(viaMiddleware.status === 401 || viaMiddleware.status === 403, String(viaMiddleware.status))
  assert.equal(votesOn(db, link.id), 0)
  assert.equal(count(db, 'cop_evidence_link_votes', 'user_id = ?', SERVICE_USER), 0)

  const { COP_SERVICE_ROUTES } = mod('copCaller')
  const allowed = (method, path) => COP_SERVICE_ROUTES.some((r) => r.method === method && r.path.test(path))
  assert.equal(allowed('PUT', '/api/cop/cop-x/evidence-links/evl-1/vote'), false)
  assert.equal(allowed('GET', '/api/cop/cop-x/question-ticket'), false)
})

test('a vote is scoped to the session: another COP\'s filing, a foreign row or an unknown id is 404', async () => {
  const { db, env } = await votesFixture()
  const [keyRfi] = keyIds(db)
  db.exec(`
    INSERT INTO cop_evidence_links (id, cop_session_id, evidence_id, target_type, target_id, relation, created_by) VALUES
      ('evl-other', '${OTHER_SESSION}', '201', 'rfi', 'rfi-other', 'supports', 4),
      ('evl-foreign', '${SESSION}', '201', 'rfi', '${keyRfi}', 'supports', 1);
  `)
  for (const linkId of ['evl-other', 'evl-foreign', 'evl-nope']) {
    const res = await vote(env, 'owner', linkId, 1)
    assert.equal(res.status, 404, linkId)
    assert.equal((await res.json()).code, 'LINK_NOT_FOUND')
  }
  // The other COP's owner can't reach this COP's filing through their own session either.
  const ours = await file(env, 101, keyRfi)
  assert.equal((await vote(env, 'stranger', ours.id, 1, { session: OTHER_SESSION })).status, 404)
  assert.equal(count(db, 'cop_evidence_link_votes'), 0)
})

test('lists carry votes and the caller\'s own, ranked by score then newest; a share shows the counts only', async () => {
  const { db, env } = await votesFixture()
  const [keyRfi] = keyIds(db)
  const l101 = await file(env, 101, keyRfi)
  const l102 = await file(env, 102, keyRfi)
  const l103 = await file(env, 103, keyRfi)
  await vote(env, 'owner', l101.id, 1)
  await vote(env, 'editor', l101.id, 1)
  await vote(env, 'viewer', l102.id, -1)

  const listed = (await (await call(env, 'evidenceLinks', 'GET', `${P}/evidence-links?target_type=rfi&target_id=${keyRfi}`, { who: 'viewer', params: S })).json()).links
  assert.deepEqual(listed.map((l) => [l.evidence_id, l.up, l.down, l.my_vote]), [
    ['101', 2, 0, 0],
    ['103', 0, 0, 0], // newer than 102, same score as nothing
    ['102', 0, 1, -1],
  ])
  const asOwner = (await (await call(env, 'evidenceLinks', 'GET', `${P}/evidence-links`, { who: 'owner', params: S })).json()).links
  assert.equal(asOwner.find((l) => l.id === l101.id).my_vote, 1)

  const payload = await (await call(env, 'publicShare', 'GET', `/api/cop/public/${SHARES.full}`, { who: 'anonymous', params: { token: SHARES.full } })).json()
  const items = payload.key_rfis.find((r) => r.id === keyRfi).evidence
  assert.deepEqual(items.map((i) => [i.title, i.up, i.down]), [
    ['Police notice', 2, 0],
    ['Unverified tip', 0, 0],
    ['Second report', 0, 1],
  ])
  const tip = items[1]
  assert.equal(tip.url, null)
  assert.equal(tip.relation, null)
  for (const item of items) assert.deepEqual(Object.keys(item).sort(), ['created_at', 'credibility', 'down', 'relation', 'title', 'up', 'url'])
  assert.ok(!JSON.stringify(payload).includes('my_vote'))
  assert.ok(!JSON.stringify(payload).includes('555-0100'))
})

test('unfiling or deleting the evidence takes the filing\'s votes with it', async () => {
  const { db, env } = await votesFixture()
  db.exec('PRAGMA foreign_keys = ON') // as D1 enforces them
  const [keyRfi, secondKey] = keyIds(db)
  const a = await file(env, 101, keyRfi)
  const b = await file(env, 102, secondKey)
  await vote(env, 'owner', a.id, 1)
  await vote(env, 'viewer', a.id, -1)
  await vote(env, 'owner', b.id, 1)
  assert.equal(count(db, 'cop_evidence_link_votes'), 3)

  const del = await call(env, 'evidenceLinks', 'DELETE', `${P}/evidence-links?id=${a.id}`, { who: 'owner', params: S })
  assert.equal(del.status, 200, await del.clone().text())
  assert.equal(votesOn(db, a.id), 0)
  // Filed again: a new filing starts with no votes.
  const again = await file(env, 101, keyRfi)
  assert.equal((await (await call(env, 'evidenceLinks', 'GET', `${P}/evidence-links?target_id=${keyRfi}&target_type=rfi`, { who: 'owner', params: S })).json()).links.find((l) => l.id === again.id).up, 0)

  assert.equal((await call(env, 'evidence', 'DELETE', `${P}/evidence?id=102`, { who: 'owner', params: S })).status, 200)
  assert.equal(votesOn(db, b.id), 0)
  assert.equal(count(db, 'cop_evidence_link_votes'), 0)
})

test('before migration 0026: lists show no votes, voting answers 503, tips still go in under their key questions', async () => {
  const { db, env } = await votesFixture({ votes: false })
  const [keyRfi] = keyIds(db)
  const link = await file(env, 101, keyRfi)
  const listed = (await (await call(env, 'evidenceLinks', 'GET', `${P}/evidence-links`, { who: 'viewer', params: S })).json()).links
  assert.deepEqual(listed.map((l) => [l.up, l.down, l.my_vote]), [[0, 0, 0]])
  const res = await vote(env, 'owner', link.id, 1)
  assert.equal(res.status, 503)
  assert.equal((await res.json()).code, 'EVIDENCE_VOTES_UNAVAILABLE')
  const payload = await (await call(env, 'publicShare', 'GET', `/api/cop/public/${SHARES.full}`, { who: 'anonymous', params: { token: SHARES.full } })).json()
  assert.deepEqual(payload.key_rfis.find((r) => r.id === keyRfi).evidence.map((i) => [i.up, i.down]), [[0, 0]])

  // drop-submit stores the tip without the checked choice; a key question still files.
  seedDrop(db, { picker: 1 })
  const sent = await submit(env, { what: 'Gate B', _question: keyRfi })
  assert.equal(sent.ok, true, JSON.stringify(sent))
  assert.equal(count(db, 'cop_evidence_links', 'evidence_id = ? AND target_id = ?', String(sent.ingested.evidence_id), keyRfi), 1)
  const [, secondKey] = keyIds(db)
  const several = await submit(env, { what: 'Gate C', _questions: [{ id: keyRfi }, { id: secondKey, relation: 'context' }] })
  assert.equal(several.ok, true, JSON.stringify(several))
  assert.deepEqual(db.prepare('SELECT target_id, relation FROM cop_evidence_links WHERE evidence_id = ? ORDER BY target_id').all(String(several.ingested.evidence_id)).map((r) => [r.target_id, r.relation]),
    [[keyRfi, 'supports'], [secondKey, 'context']].sort())
})

// ── Which questions the form offers, by where it was opened ─────────

function seedDrop(db, { picker = 0, autoIngest = 1, createdBy = 1 } = {}) {
  db.prepare(`INSERT INTO survey_drops (id, title, form_schema, share_token, status, cop_session_id, workspace_id, created_by, intent, auto_ingest, question_picker)
    VALUES ('drop-votes', 'Paris tips', ?, ?, 'active', ?, ?, ?, 'drop', ?, ?)`)
    .run(JSON.stringify([{ name: 'what', label: 'What did you see?', type: 'textarea' }]), DROP, SESSION, WS, createdBy, autoIngest, picker)
}

const choices = async (env, query = '', ticket) =>
  (await (await call(env, 'surveyPublic', 'GET', `/api/surveys/public/${DROP}${query}`, {
    who: 'anonymous', params: { token: DROP }, headers: ticket === undefined ? {} : { 'X-Question-Ticket': ticket },
  })).json()).question_choices
const ids = (list) => list.map((c) => c.id)
const ticketFor = async (env, who, session = SESSION) => {
  const res = await call(env, 'questionTicket', 'GET', `/api/cop/${session}/question-ticket`, { who, params: { id: session } })
  assert.equal(res.status, 200, await res.clone().text())
  return (await res.json()).ticket
}
const submit = async (env, formData, context) =>
  (await call(env, 'dropSubmit', 'POST', `/api/surveys/public/${DROP}/drop-submit`, {
    who: 'anonymous', params: { token: DROP }, body: { form_data: formData, ...(context ? { question_context: context } : {}) },
  })).json()

test('a share\'s Submit sheet offers the open questions that share shows; nothing else widens the list', async () => {
  const { db, env } = await votesFixture()
  seedDrop(db, { picker: 0 })
  const keys = keyIds(db)
  const open = [...keys, 'rfi-plain']

  assert.deepEqual(await choices(env), [])
  const fromRfiPanel = await choices(env, `?share=${SHARES.rfi}`)
  assert.deepEqual(ids(fromRfiPanel), open)
  assert.deepEqual(fromRfiPanel.map((c) => c.key), [...keys.map(() => true), false])
  assert.deepEqual(ids(await choices(env, `?share=${SHARES.questions}`)), keys)
  for (const share of [SHARES.none, SHARES.other, SHARES.expired, SHARES.noEvidence, 'not-a-share-token', "x' OR 1=1 --"]) {
    assert.deepEqual(await choices(env, `?share=${encodeURIComponent(share)}`), [], share)
  }
  // With the owner's picker on, the standalone link's key questions are the floor everywhere.
  db.exec("UPDATE survey_drops SET question_picker = 1 WHERE id = 'drop-votes'")
  assert.deepEqual(ids(await choices(env)), keys)
  assert.deepEqual(ids(await choices(env, `?share=${SHARES.expired}`)), keys)
  assert.deepEqual(ids(await choices(env, `?share=${SHARES.other}`)), keys)
  // Closed questions are never offered; a form made by a non-editor offers nothing.
  assert.ok(!ids(await choices(env, `?share=${SHARES.rfi}`)).some((id) => id.startsWith('rfi-closed') || id === 'rfi-other'))
  db.exec("UPDATE survey_drops SET created_by = 3 WHERE id = 'drop-votes'")
  assert.deepEqual(await choices(env, `?share=${SHARES.rfi}`), [])
})

test('a collaborator\'s workspace gets every open question through a question ticket that names no one', async () => {
  const { db, env } = await votesFixture()
  seedDrop(db, { picker: 0 })
  const open = [...keyIds(db), 'rfi-plain']

  for (const who of ['owner', 'editor', 'admin', 'viewer']) {
    assert.deepEqual(ids(await choices(env, '', await ticketFor(env, who))), open, who)
  }
  const ticket = await ticketFor(env, 'viewer')
  const payload = JSON.parse(Buffer.from(ticket.split('.')[0], 'base64url').toString('utf8'))
  assert.deepEqual(Object.keys(payload).sort(), ['e', 's'])
  assert.equal(payload.s, SESSION)

  const refused = (who) => call(env, 'questionTicket', 'GET', `${P}/question-ticket`, { who, params: S })
  assert.equal((await refused('stranger')).status, 403)
  assert.equal((await refused('anonymous')).status, 401)
  assert.equal((await refused('service-admitted')).status, 403)

  // Another COP's ticket, a tampered or expired one, or a server without the secret: no widening.
  const otherTicket = await ticketFor(env, 'stranger', OTHER_SESSION)
  const { signQuestionTicket } = mod('ticketModule')
  const expired = (await signQuestionTicket(SECRET, SESSION, Date.now() - 13 * 3600_000)).ticket
  const forged = (await signQuestionTicket('some-other-secret', SESSION)).ticket
  const [body, sig] = ticket.split('.')
  const swapped = `${Buffer.from(JSON.stringify({ s: SESSION, e: 4102444800 })).toString('base64url')}.${sig}`
  for (const bad of [otherTicket, expired, forged, swapped, `${body}.${sig}.x`, 'garbage']) {
    assert.deepEqual(await choices(env, '', bad), [], bad.slice(0, 20))
  }
  delete env.JWT_SECRET
  assert.equal((await refused('owner')).status, 503)
  assert.deepEqual(await choices(env, '', ticket), [])
  // In the query string a ticket does nothing (it belongs in the header, out of logs).
  env.JWT_SECRET = SECRET
  assert.deepEqual(await choices(env, `?ticket=${encodeURIComponent(ticket)}`), [])
})

test('drop-submit (single legacy `_question`) files under a question the form offered, and refuses any other', async () => {
  const { db, env } = await votesFixture()
  seedDrop(db, { picker: 1 })
  const [keyRfi] = keyIds(db)
  const stored = () => count(db, 'survey_responses', "survey_id = 'drop-votes'")

  // From a share with the rfi panel: a plain question, as context.
  const viaShare = await submit(env, { what: 'Gate open at 09:10', _question: 'rfi-plain', _question_relation: 'context' }, { share: SHARES.rfi })
  assert.equal(viaShare.ok, true, JSON.stringify(viaShare))
  const filed = db.prepare('SELECT target_id, relation FROM cop_evidence_links WHERE evidence_id = ?').all(String(viaShare.ingested.evidence_id))
  assert.deepEqual(filed.map((r) => ({ ...r })), [{ target_id: 'rfi-plain', relation: 'context' }])

  // Standalone: a key question files; no question is fine too.
  const keyed = await submit(env, { what: 'Crowd at gate B', _question: keyRfi, _question_relation: 'contradicts' })
  assert.equal(db.prepare('SELECT relation FROM cop_evidence_links WHERE evidence_id = ?').get(String(keyed.ingested.evidence_id)).relation, 'contradicts')
  const plain = await submit(env, { what: 'Nothing about a question' })
  assert.equal(plain.ok, true)
  assert.equal(count(db, 'cop_evidence_links', 'evidence_id = ?', String(plain.ingested.evidence_id)), 0)

  // Anything the form didn't offer in that context is refused, and nothing is stored.
  const before = stored()
  const cases = [
    [{ _question: 'rfi-plain' }, undefined],
    [{ _question: 'rfi-plain' }, { share: SHARES.questions }],
    [{ _question: 'rfi-plain' }, { share: SHARES.expired }],
    [{ _question: 'rfi-plain' }, { share: SHARES.other }],
    [{ _question: 'rfi-closed-plain' }, { share: SHARES.rfi }],
    [{ _question: 'rfi-closed-key' }, undefined],
    [{ _question: 'rfi-other' }, { share: SHARES.other }],
    [{ _question: 'rfi-nope' }, { share: SHARES.rfi }],
    [{ _question: "x' OR 1=1 --" }, { share: SHARES.rfi }],
    [{ _question: 42 }, undefined],
    [{ _question: 'rfi-plain' }, { ticket: 'garbage' }],
  ]
  for (const [answer, context] of cases) {
    const res = await submit(env, { what: 'Tip', ...answer }, context)
    assert.equal(res.ok, false, JSON.stringify([answer, context]))
    assert.equal(res.code, 'QUESTION_NOT_OFFERED')
  }
  assert.equal(stored(), before)

  // From the workspace (a ticket): any open question.
  const ticket = await ticketFor(env, 'viewer')
  const viaTicket = await submit(env, { what: 'Seen from the office', _question: 'rfi-plain' }, { ticket })
  assert.equal(viaTicket.ok, true, JSON.stringify(viaTicket))
  assert.equal(count(db, 'cop_evidence_links', "evidence_id = ? AND target_id = 'rfi-plain'", String(viaTicket.ingested.evidence_id)), 1)
  // Still anonymous: the stored row names no one.
  const row = db.prepare('SELECT * FROM survey_responses WHERE ingested_evidence_id = ?').get(String(viaTicket.ingested.evidence_id))
  assert.deepEqual(JSON.parse(row.question_choices), [{ id: 'rfi-plain', relation: 'supports' }])
  assert.ok(!JSON.stringify(row).includes('"user_id"'))
})

test('one tip under several questions: each with its own relation, duplicates collapsed, at most 5, all or nothing', async () => {
  const { db, env } = await votesFixture()
  seedDrop(db, { picker: 1 })
  const keys = keyIds(db)
  db.exec(`
    INSERT INTO cop_rfis (id, cop_session_id, question, created_by, is_key, status) VALUES
      ('rfi-x1', '${SESSION}', 'Extra one?', 1, 0, 'open'),
      ('rfi-x2', '${SESSION}', 'Extra two?', 1, 0, 'open'),
      ('rfi-x3', '${SESSION}', 'Extra three?', 1, 0, 'open');
  `)
  const stored = () => count(db, 'survey_responses', "survey_id = 'drop-votes'")
  const filedUnder = (res) => db.prepare('SELECT target_id, relation FROM cop_evidence_links WHERE evidence_id = ? ORDER BY target_id')
    .all(String(res.ingested.evidence_id)).map((r) => [r.target_id, r.relation])

  // Happy path from a share: three questions, three relations; a repeat collapses (first wins).
  const multi = await submit(env, {
    what: 'Police turning fans away at gate B',
    _questions: [
      { id: keys[0], relation: 'supports' },
      { id: 'rfi-plain', relation: 'contradicts' },
      { id: 'rfi-x1', relation: 'context' },
      { id: 'rfi-plain', relation: 'supports' },
      { id: keys[0] },
    ],
  }, { share: SHARES.rfi })
  assert.equal(multi.ok, true, JSON.stringify(multi))
  assert.deepEqual(filedUnder(multi), [[keys[0], 'supports'], ['rfi-plain', 'contradicts'], ['rfi-x1', 'context']].sort())
  const row = db.prepare('SELECT question_choices FROM survey_responses WHERE ingested_evidence_id = ?').get(String(multi.ingested.evidence_id))
  assert.deepEqual(JSON.parse(row.question_choices).map((c) => c.id), [keys[0], 'rfi-plain', 'rfi-x1'])
  // The choices never show in the evidence text.
  const description = db.prepare('SELECT description FROM evidence_items WHERE id = ?').get(Number(multi.ingested.evidence_id)).description
  assert.ok(!description.includes('rfi-plain') && !description.includes('[object Object]'), description)

  // Five distinct questions is the limit; a legacy `_question` beside the list counts too.
  const five = await submit(env, { what: 'Five', _questions: ['rfi-plain', 'rfi-x1', 'rfi-x2', 'rfi-x3'].map((id) => ({ id })), _question: keys[0] }, { share: SHARES.rfi })
  assert.equal(five.ok, true, JSON.stringify(five))
  assert.equal(filedUnder(five).length, 5)

  const before = stored()
  const refused = [
    // Six distinct questions.
    [{ _questions: [...keys.slice(0, 2), 'rfi-plain', 'rfi-x1', 'rfi-x2', 'rfi-x3'].map((id) => ({ id })) }, { share: SHARES.rfi }],
    [{ _questions: ['rfi-plain', 'rfi-x1', 'rfi-x2', 'rfi-x3', keys[1]].map((id) => ({ id })), _question: keys[0] }, { share: SHARES.rfi }],
    // One closed, foreign or unoffered question among good ones refuses the lot.
    [{ _questions: [{ id: 'rfi-plain' }, { id: 'rfi-closed-plain' }] }, { share: SHARES.rfi }],
    [{ _questions: [{ id: keys[0] }, { id: 'rfi-other' }] }, { share: SHARES.rfi }],
    [{ _questions: [{ id: keys[0] }, { id: 'rfi-plain' }] }, { share: SHARES.questions }],
    [{ _questions: [{ id: keys[0] }, { id: 'rfi-plain' }] }, undefined],
    // Malformed.
    [{ _questions: 'rfi-plain' }, { share: SHARES.rfi }],
    [{ _questions: { id: 'rfi-plain' } }, { share: SHARES.rfi }],
    [{ _questions: ['rfi-plain'] }, { share: SHARES.rfi }],
    [{ _questions: [{ id: 'rfi-plain', relation: 'proves' }] }, { share: SHARES.rfi }],
    [{ _questions: [{ id: "x' OR 1=1 --" }] }, { share: SHARES.rfi }],
    [{ _questions: [{ relation: 'supports' }] }, { share: SHARES.rfi }],
  ]
  for (const [answer, context] of refused) {
    const res = await submit(env, { what: 'Tip', ...answer }, context)
    assert.equal(res.ok, false, JSON.stringify([answer, context]))
    assert.equal(res.code, 'QUESTION_NOT_OFFERED')
  }
  assert.equal(stored(), before)
  // None picked is fine.
  const none = await submit(env, { what: 'Not about a question', _questions: [] }, { share: SHARES.rfi })
  assert.equal(none.ok, true)
  assert.equal(filedUnder(none).length, 0)
})

test('a tip waiting for review keeps its checked questions and is filed when accepted, even after the share expired', async () => {
  const { db, env } = await votesFixture()
  seedDrop(db, { picker: 0, autoIngest: 0 })
  const [keyRfi] = keyIds(db)
  const sent = await submit(env, { what: 'Barricade on rue X', _questions: [{ id: 'rfi-plain' }, { id: keyRfi, relation: 'contradicts' }] }, { share: SHARES.rfi })
  assert.equal(sent.ok, true, JSON.stringify(sent))
  assert.equal(sent.ingested, null)
  const sub = db.prepare("SELECT id, question_choices FROM survey_responses WHERE survey_id = 'drop-votes'").get()
  assert.deepEqual(JSON.parse(sub.question_choices), [{ id: 'rfi-plain', relation: 'supports' }, { id: keyRfi, relation: 'contradicts' }])

  db.exec(`UPDATE cop_shares SET expires_at = '${PAST()}' WHERE id = 'sh-rfi'`)
  const accepted = await call(env, 'submissions', 'PUT', `${P}/submissions`, { who: 'owner', params: S, body: { id: sub.id, status: 'accepted' } })
  assert.equal(accepted.status, 200, await accepted.clone().text())
  const evidenceId = db.prepare('SELECT linked_evidence_id FROM survey_responses WHERE id = ?').get(sub.id).linked_evidence_id
  assert.equal(count(db, 'cop_evidence_links', "evidence_id = ? AND target_id = 'rfi-plain'", String(evidenceId)), 1)
  assert.equal(db.prepare('SELECT relation FROM cop_evidence_links WHERE evidence_id = ? AND target_id = ?').get(String(evidenceId), keyRfi).relation, 'contradicts')
})

test('a stored choice whose question was deleted since is skipped; the others still file', async () => {
  const { db, env } = await votesFixture()
  seedDrop(db, { picker: 0, autoIngest: 0 })
  const [keyRfi] = keyIds(db)
  await submit(env, { what: 'Two questions', _questions: [{ id: 'rfi-plain' }, { id: keyRfi }] }, { share: SHARES.rfi })
  const sub = db.prepare("SELECT id FROM survey_responses WHERE survey_id = 'drop-votes'").get()
  db.exec("DELETE FROM cop_rfis WHERE id = 'rfi-plain'")
  const accepted = await call(env, 'submissions', 'PUT', `${P}/submissions`, { who: 'owner', params: S, body: { id: sub.id, status: 'accepted' } })
  assert.equal(accepted.status, 200, await accepted.clone().text())
  const evidenceId = db.prepare('SELECT linked_evidence_id FROM survey_responses WHERE id = ?').get(sub.id).linked_evidence_id
  assert.deepEqual(db.prepare('SELECT target_id FROM cop_evidence_links WHERE evidence_id = ?').all(String(evidenceId)).map((r) => r.target_id), [keyRfi])
})

// ── Security review follow-ups ─────────────────────────────────────

test('a repeated or no-op vote stays silent: no event ever names the voter (through the COP middleware)', async () => {
  const { db, env } = await votesFixture()
  const [keyRfi] = keyIds(db)
  const link = await file(env, 101, keyRfi)
  for (const value of [1, 1, 0, 0]) {
    const res = await vote(env, 'viewer', link.id, value, { through: 'middleware' })
    assert.equal(res.status, 200, await res.clone().text())
  }
  const viewerId = 3
  assert.equal(count(db, 'cop_events', 'created_by = ?', viewerId), 0)
  // The two real changes went out, authored by nobody.
  assert.equal(count(db, 'cop_events', "event_type = 'evidence.link_voted' AND created_by = 0"), 2)
})

test('votes are limited per person per COP: over 30 a minute is 429, nothing written or announced', async () => {
  const { db, env } = await votesFixture()
  const [keyRfi] = keyIds(db)
  const link = await file(env, 101, keyRfi)
  for (let i = 0; i < 30; i++) {
    const res = await vote(env, 'editor', link.id, i % 2 === 0 ? 1 : -1)
    assert.equal(res.status, 200, `vote ${i}: ${await res.clone().text()}`)
  }
  const before = { votes: db.prepare('SELECT value FROM cop_evidence_link_votes WHERE link_id = ?').all(link.id).map((r) => r.value), events: count(db, 'cop_events') }
  const over = await vote(env, 'editor', link.id, 1)
  assert.equal(over.status, 429)
  assert.equal((await over.json()).code, 'VOTE_RATE_LIMITED')
  assert.deepEqual(db.prepare('SELECT value FROM cop_evidence_link_votes WHERE link_id = ?').all(link.id).map((r) => r.value), before.votes)
  assert.equal(count(db, 'cop_events'), before.events)
  // Someone else still votes; every limiter write used a TTL KV accepts (the fake refuses < 60).
  assert.equal((await vote(env, 'owner', link.id, 1)).status, 200)
  // Without KV the guard lets votes through (it is not access control).
  delete env.CACHE
  assert.equal((await vote(env, 'editor', link.id, 0)).status, 200)
})

test('a question ticket lasts an hour: one issued 61 minutes ago is refused, 30 minutes ago still works', async () => {
  const { db, env } = await votesFixture()
  seedDrop(db, { picker: 0 })
  const { signQuestionTicket } = mod('ticketModule')
  const stale = (await signQuestionTicket(SECRET, SESSION, Date.now() - 61 * 60_000)).ticket
  const fresh = (await signQuestionTicket(SECRET, SESSION, Date.now() - 30 * 60_000)).ticket
  assert.deepEqual(await choices(env, '', stale), [])
  assert.deepEqual(ids(await choices(env, '', fresh)), [...keyIds(db), 'rfi-plain'])
  const issued = await (await call(env, 'questionTicket', 'GET', `${P}/question-ticket`, { who: 'viewer', params: S })).json()
  const life = Date.parse(issued.expires_at) - Date.now()
  assert.ok(life > 59 * 60_000 && life <= 60 * 60_000, String(life))
})

test('a password drop form takes tips only with its password: none or wrong is 401, nothing stored or ingested', async () => {
  const { db, env } = await votesFixture()
  seedDrop(db, { picker: 1 })
  const hash = await mod('surveyDrops').hashPassword('correct horse battery')
  db.prepare("UPDATE survey_drops SET access_level = 'password', password_hash = ? WHERE id = 'drop-votes'").run(hash)
  const post = (body) => call(env, 'dropSubmit', 'POST', `/api/surveys/public/${DROP}/drop-submit`, { who: 'anonymous', params: { token: DROP }, body })
  const stored = () => count(db, 'survey_responses', "survey_id = 'drop-votes'")
  const evidenceBefore = count(db, 'evidence_items')

  for (const body of [{ form_data: { what: 'no password' } }, { form_data: { what: 'blank' }, password: '' }, { form_data: { what: 'odd' }, password: 42 }]) {
    const res = await post(body)
    assert.equal(res.status, 401, JSON.stringify(body))
    assert.deepEqual(await res.json(), { ok: false, error: 'Password is required' })
  }
  const wrong = await post({ form_data: { what: 'wrong' }, password: 'tr0ub4dor' })
  assert.equal(wrong.status, 401)
  assert.deepEqual(await wrong.json(), { ok: false, error: 'Incorrect password' })
  assert.equal(stored(), 0)
  assert.equal(count(db, 'evidence_items'), evidenceBefore)

  const right = await post({ form_data: { what: 'right', _questions: [{ id: keyIds(db)[0] }] }, password: 'correct horse battery' })
  assert.equal(right.status, 201, await right.clone().text())
  assert.ok((await right.json()).ingested?.evidence_id)
  assert.equal(stored(), 1)
})
