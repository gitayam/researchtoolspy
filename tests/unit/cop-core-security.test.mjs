/**
 * Security review fixes for the COP input core (2026-10-23):
 *   1. the evidence form offered for a session is a drop made by someone who manages it;
 *   3. "the COP's evidence" is evidence_items.cop_session_id, not the whole workspace;
 *   4. a share's public change feed never names tags or shows team activity or assets;
 *   5. a service edits only the claims and hypotheses it created;
 *   9. answers through a share link: http(s) links, length caps, a per-address limit;
 *   and drop-form tips nobody has reviewed show as "Unverified tip" on public views.
 *
 * Run: npm run test:unit
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { call, count, events, fixture, migration, mod, OTHER_SESSION, SERVICE_USER, SESSION, setupCoreSuite, WS } from './cop-core-harness.mjs'

setupCoreSuite()

const P = `/api/cop/${SESSION}`
const S = { id: SESSION }
const T0 = '2026-10-23T00:00:00.000Z'
const TOKEN = '33333333-3333-4333-8333-333333333333'
const json = (res) => res.json()
const SIBLING = 'cop-sibling' // another COP in the same (shared) workspace
const DEDICATED = 'cop-dedicated' // a COP whose workspace is its own (workspace_id = session id)

function seedShare(db, panels, { allowEvidence = 0, allowAnswers = 0 } = {}) {
  db.prepare(`INSERT INTO cop_shares (id, cop_session_id, share_token, visible_panels, allow_rfi_answers, created_by) VALUES ('cops-sec', ?, ?, ?, ?, 1)`)
    .run(SESSION, TOKEN, JSON.stringify(panels), allowAnswers)
  if (allowEvidence) db.prepare('UPDATE cop_shares SET allow_evidence = 1 WHERE share_token = ?').run(TOKEN)
}

// ── 1. Evidence form ───────────────────────────────────────────────

const drop = (db, id, createdBy, createdAt, session = SESSION) => db.prepare(`
  INSERT INTO survey_drops (id, title, share_token, status, access_level, intent, cop_session_id, created_by, created_at)
  VALUES (?, ?, ?, 'active', 'public', 'drop', ?, ?, ?)`).run(id, `Form by ${createdBy}`, `tok-${id}`, session, createdBy, createdAt)

test('1: a drop made by someone who does not manage the session is never its evidence form', async () => {
  const { db, env } = await fixture()
  seedShare(db, ['map'], { allowEvidence: 1 })
  drop(db, 'd-owner', 1, '2026-10-20T00:00:00Z')
  drop(db, 'd-stranger', 4, '2026-10-23T03:00:00Z')
  drop(db, 'd-viewer', 3, '2026-10-23T02:00:00Z')
  const publicForm = async () => (await json(await call(env, 'publicShare', 'GET', `/api/cop/public/${TOKEN}`, { who: 'anonymous', params: { token: TOKEN } }))).evidence_form
  const workspaceForm = async () => (await json(await call(env, 'sessionItem', 'GET', `/api/cop/sessions/${SESSION}`, { params: S }))).evidence_form
  assert.equal((await publicForm()).token, 'tok-d-owner')
  assert.equal((await workspaceForm()).token, 'tok-d-owner')
  // An editor's drop is the session's; when an editor is removed, their drop no longer is.
  drop(db, 'd-editor', 2, '2026-10-23T01:00:00Z')
  assert.equal((await publicForm()).token, 'tok-d-editor')
  db.prepare("DELETE FROM cop_collaborators WHERE id = 'col-editor'").run()
  assert.equal((await publicForm()).token, 'tok-d-owner')
  db.prepare("UPDATE survey_drops SET status = 'closed' WHERE id = 'd-owner'").run()
  assert.equal(await publicForm(), null)
  assert.equal(await workspaceForm(), null)
})

// ── 3. The COP's evidence ──────────────────────────────────────────

function seedEvidence(db) {
  db.exec(`
    INSERT INTO cop_sessions (id, name, template_type, status, workspace_id, created_by) VALUES
      ('${SIBLING}', 'Same workspace', 'custom', 'ACTIVE', '${WS}', 1);
    INSERT INTO workspaces (id, type, owner_id) VALUES ('${DEDICATED}', 'PERSONAL', 1);
    INSERT INTO cop_sessions (id, name, template_type, status, workspace_id, created_by) VALUES
      ('${DEDICATED}', 'Own workspace', 'custom', 'ACTIVE', '${DEDICATED}', 1);
    INSERT INTO evidence_items (id, title, description, evidence_type, credibility, reliability, workspace_id, created_by, source_url) VALUES
      (11, 'Mine', 'x', 'observation', 'unverified', 'unknown', '${WS}', 1, 'https://a.example/mine'),
      (12, 'Sibling COP', 'x', 'observation', 'unverified', 'unknown', '${WS}', 1, 'https://a.example/sibling'),
      (13, 'Main workspace, no COP', 'x', 'observation', 'unverified', 'unknown', '${WS}', 1, 'https://a.example/legacy'),
      (14, 'Dedicated legacy', 'x', 'observation', 'unverified', 'unknown', '${DEDICATED}', 1, NULL);
    INSERT INTO cop_collaborators (id, cop_session_id, user_id, role) VALUES ('c-ded', '${DEDICATED}', 2, 'editor');
  `)
}
const tagSession = (db) => db.exec(`
  UPDATE evidence_items SET cop_session_id = '${SESSION}' WHERE id = 11;
  UPDATE evidence_items SET cop_session_id = '${SIBLING}' WHERE id = 12;
`)

test('3: the COP evidence list, delete, public list, tagging, export and stats see only this COP’s evidence', async () => {
  const { db, env } = await fixture({ seed: seedEvidence })
  tagSession(db)
  seedShare(db, ['map', 'evidence'])
  const listed = (await json(await call(env, 'evidence', 'GET', `${P}/evidence`, { who: 'viewer', params: S }))).evidence
  assert.deepEqual(listed.map((e) => e.id), [11])
  const pub = (await json(await call(env, 'publicShare', 'GET', `/api/cop/public/${TOKEN}`, { who: 'anonymous', params: { token: TOKEN } }))).evidence
  assert.deepEqual(pub.map((e) => e.id), [11])
  const { targetInSession } = mod('copTags')
  assert.equal(await targetInSession(env.DB, { sessionId: SESSION, workspaceId: WS }, 'evidence', '11'), true)
  assert.equal(await targetInSession(env.DB, { sessionId: SESSION, workspaceId: WS }, 'evidence', '12'), false)
  assert.equal(await targetInSession(env.DB, { sessionId: SESSION, workspaceId: WS }, 'evidence', '13'), false)
  const stats = await json(await call(env, 'stats', 'GET', `${P}/stats`, { params: S }))
  assert.equal(stats.evidence_count ?? stats.stats?.evidence_count, 1)
  for (const id of [12, 13]) assert.equal((await call(env, 'evidence', 'DELETE', `${P}/evidence?id=${id}`, { params: S })).status, 404)
  assert.equal((await call(env, 'evidence', 'DELETE', `${P}/evidence?id=11`, { params: S })).status, 200)
  assert.equal(count(db, 'evidence_items', 'id IN (12, 13)'), 2)

  // A COP with a workspace of its own still sees its evidence saved before the column.
  const ded = (await json(await call(env, 'evidence', 'GET', `/api/cop/${DEDICATED}/evidence`, { params: { id: DEDICATED } }))).evidence
  assert.deepEqual(ded.map((e) => e.id), [14])
  assert.equal(await targetInSession(env.DB, { sessionId: DEDICATED, workspaceId: DEDICATED }, 'evidence', '14'), true)
})

test('3: every COP evidence write records its session, and a link saved by a sibling COP is not a duplicate here', async () => {
  const { db, env } = await fixture({ seed: (d) => {
    seedEvidence(d)
    d.exec(`INSERT INTO cop_claims (id, cop_session_id, workspace_id, claim_text, url, created_by, created_at, updated_at)
      VALUES ('clm-p', '${SESSION}', '${WS}', 'The gate closes at nine', 'https://claims.example/1', '1', '${T0}', '${T0}')`)
  } })
  tagSession(db)
  const sessionOf = (id) => db.prepare('SELECT cop_session_id FROM evidence_items WHERE id = ?').get(Number(id)).cop_session_id
  const single = await call(env, 'evidence', 'POST', `${P}/evidence`, { params: S, body: { title: 'Same link as the sibling', url: 'https://a.example/sibling' } })
  assert.equal(single.status, 201)
  assert.equal(sessionOf((await single.json()).id), SESSION)
  const batch = await json(await call(env, 'evidenceBatch', 'POST', `${P}/evidence/batch`, { params: S, body: { items: [{ title: 'b', url: 'https://a.example/legacy' }] } }))
  assert.equal(batch.created, 1)
  assert.equal(sessionOf(batch.items[0].id), SESSION)
  const promoted = await json(await call(env, 'claims', 'PUT', `${P}/claims`, { params: S, body: { claim_id: 'clm-p', status: 'verified', promote_to_evidence: true } }))
  assert.equal(sessionOf(promoted.evidence_item_id), SESSION)
  await call(env, 'rfiAnswers', 'POST', `${P}/rfis/rfi-existing/answers`, { params: { ...S, rfiId: 'rfi-existing' }, body: { answer_text: 'Two guards' } })
  const seeded = db.prepare("SELECT cop_session_id FROM evidence_items WHERE evidence_type = 'rfi_answer'").all()
  assert.deepEqual(seeded.map((r) => r.cop_session_id), [SESSION])
  await call(env, 'rfis', 'PUT', `${P}/rfis`, { params: S, body: { id: 'rfi-existing', answer: 'Three guards' } })
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM evidence_items WHERE evidence_type = 'rfi_answer' AND cop_session_id = ?").get(SESSION).n, 2)
  // The same link in the sibling COP's evidence is not a duplicate in this one.
  assert.equal(count(db, 'evidence_items', "source_url = 'https://a.example/sibling'"), 2)
})

test('3: before migration 0022 a shared-workspace COP shows no workspace evidence; a dedicated one shows its own', async () => {
  const { env } = await fixture({ core: false, seed: seedEvidence })
  const list = async (session) => (await json(await call(env, 'evidence', 'GET', `/api/cop/${session}/evidence`, { params: { id: session } }))).evidence
  assert.deepEqual(await list(SESSION), [])
  assert.deepEqual((await list(DEDICATED)).map((e) => e.id), [14])
  assert.equal((await call(env, 'evidence', 'DELETE', `${P}/evidence?id=13`, { params: S })).status, 404)
  assert.equal((await call(env, 'evidence', 'POST', `${P}/evidence`, { params: S, body: { title: 'still works', url: 'https://b.example/1' } })).status, 201)
})

test('3: migration 0022 gives existing COP evidence its session from the session’s own records only', async () => {
  const { db } = await fixture({ seed: (d) => {
    seedEvidence(d)
    d.exec(`
      INSERT INTO cop_events (id, cop_session_id, event_type, entity_type, entity_id, created_by) VALUES
        ('evt-e11', '${SESSION}', 'evidence.created', 'evidence', '11', 1),
        ('evt-foreign', '${OTHER_SESSION}', 'evidence.created', 'evidence', '13', 4);
      INSERT INTO cop_timeline_entries (id, cop_session_id, workspace_id, event_date, title, source_type, entity_type, entity_id, action, created_by)
        VALUES ('tle-e12', '${SIBLING}', '${WS}', '2026-10-01', 'Evidence added', 'system', 'evidence', '12', 'created', 1);
    `)
  } })
  const sessionOf = (id) => db.prepare('SELECT cop_session_id FROM evidence_items WHERE id = ?').get(id).cop_session_id
  assert.equal(sessionOf(11), SESSION)
  assert.equal(sessionOf(12), SIBLING)
  // Another workspace's session can't claim this workspace's evidence.
  assert.equal(sessionOf(13), null)
  assert.ok(migration('0022_cop_input_core.sql').includes('ADD COLUMN cop_session_id'))
})

// ── 4. Public change feed ──────────────────────────────────────────

test('4: the public feed hides tag ids, team activity and assets, and shows tags only with the evidence panel', async () => {
  const run = async (panels) => {
    const { db, env } = await fixture()
    seedShare(db, panels)
    for (const [id, type, entity, entityId] of [
      ['evt-tag', 'tag.applied', 'tag', 'tag-confirmed-strike'],
      ['evt-sub', 'submission.received', 'submission', 'resp-1'],
      ['evt-asset', 'asset.created', 'asset', 'ast-1'],
      ['evt-collab-legacy', 'collaborator.added', 'collaborator', 'col-1'],
      ['evt-export', 'export.requested', 'activity', 'exp-1'],
      ['evt-marker', 'marker.created', 'marker', 'mkr-1'],
    ]) {
      db.prepare('INSERT INTO cop_events (id, cop_session_id, event_type, entity_type, entity_id, created_by) VALUES (?, ?, ?, ?, ?, 1)').run(id, SESSION, type, entity, entityId)
    }
    // A collaborator change through the real route is team activity too.
    await call(env, 'collaborators', 'POST', `${P}/collaborators`, { params: S, body: { user_id: 4, role: 'viewer' } })
    const res = await call(env, 'publicChanges', 'GET', `/api/cop/public/${TOKEN}/changes?since=0`, { who: 'anonymous', params: { token: TOKEN } })
    return (await res.json()).events
  }
  const mapOnly = await run(['map'])
  assert.deepEqual(mapOnly.map((e) => e.id), ['evt-marker'])
  const withEvidence = await run(['map', 'evidence'])
  assert.deepEqual(withEvidence.map((e) => [e.id, e.entity_type, e.entity_id]), [
    ['evt-tag', 'tag', null], ['evt-sub', 'submission', null], ['evt-marker', 'marker', 'mkr-1'],
  ])
})

// ── 5. A service edits only its own claims and hypotheses ──────────

test('5: a service credential cannot edit claims or hypotheses it did not create', async () => {
  const { db, env } = await fixture({ seed: (d) => d.exec(`
    INSERT INTO cop_claims (id, cop_session_id, workspace_id, claim_text, created_by, created_at, updated_at) VALUES
      ('clm-person', '${SESSION}', '${WS}', 'A person''s claim', '1', '${T0}', '${T0}'),
      ('clm-bot', '${SESSION}', '${WS}', 'The bot''s claim', '${SERVICE_USER}', '${T0}', '${T0}');
    INSERT INTO cop_hypotheses (id, cop_session_id, statement, created_by, workspace_id, updated_at) VALUES
      ('hyp-person', '${SESSION}', 'A person''s hypothesis', 1, '${WS}', '${T0}'),
      ('hyp-bot', '${SESSION}', 'The bot''s hypothesis', ${SERVICE_USER}, '${WS}', '${T0}');
  `) })
  const put = (handler, body) => call(env, handler, 'PUT', `${P}/${handler}`, { who: 'service-admitted', params: S, body })
  assert.equal((await put('claims', { claim_id: 'clm-person', status: 'false' })).status, 403)
  assert.equal((await put('hypotheses', { id: 'hyp-person', confidence: 1 })).status, 403)
  assert.equal(db.prepare("SELECT status FROM cop_claims WHERE id = 'clm-person'").get().status, 'unverified')
  assert.equal((await put('claims', { claim_id: 'clm-bot', status: 'disputed' })).status, 200)
  assert.equal((await put('hypotheses', { id: 'hyp-bot', confidence: 60 })).status, 200)
  // A person with write access edits anyone's.
  assert.equal((await call(env, 'claims', 'PUT', `${P}/claims`, { who: 'editor', params: S, body: { claim_id: 'clm-person', status: 'disputed' } })).status, 200)
})

// ── 9. Answers through a share link ────────────────────────────────

test('9: share-link answers take http(s) links only, cap lengths, and are limited per address', async () => {
  const { db, env, kv } = await fixture()
  seedShare(db, ['map', 'rfi'], { allowAnswers: 1 })
  const answer = (body, ip = '203.0.113.20', e = env) => call(e, 'publicAnswers', 'POST', `/api/cop/public/${TOKEN}/rfis/rfi-existing/answers`, {
    who: 'anonymous', params: { token: TOKEN, rfiId: 'rfi-existing' }, body, headers: { 'CF-Connecting-IP': ip },
  })
  assert.equal((await answer({ answer_text: 'x', source_url: 'javascript:alert(1)' })).status, 400)
  assert.equal((await answer({ answer_text: 'x', source_url: `https://a.example/${'p'.repeat(2000)}` })).status, 400)
  assert.equal((await answer({ answer_text: 'y'.repeat(4001) })).status, 400)
  const ok = await answer({ answer_text: 'Near the gate', source_url: 'https://news.example/a', responder_name: 'n'.repeat(500) })
  assert.equal(ok.status, 201)
  const row = db.prepare("SELECT source_url, responder_name FROM cop_rfi_answers WHERE answer_text = 'Near the gate'").get()
  assert.equal(row.source_url, 'https://news.example/a')
  assert.equal(row.responder_name.length, 100)

  for (let i = 0; i < 6; i++) assert.equal((await answer({ answer_text: `a${i}` })).status, 201)
  const limited = await answer({ answer_text: 'one too many' })
  assert.equal(limited.status, 429)
  assert.equal((await answer({ answer_text: 'other address' }, '198.51.100.20')).status, 201)
  assert.ok(![...kv.store.keys()].some((k) => k.includes('203.0.113.20')))
  kv.failPuts = true
  assert.equal((await answer({ answer_text: 'uncounted' }, '198.51.100.21')).status, 503)
  const noKv = await fixture({ kv: false })
  seedShare(noKv.db, ['map', 'rfi'], { allowAnswers: 1 })
  assert.equal((await answer({ answer_text: 'no kv' }, '198.51.100.22', noKv.env)).status, 503)
})

// ── Unreviewed drop-form tips on public views ──────────────────────

test('drop-form tips nobody has reviewed show as "Unverified tip" on public views; collaborators see everything', async () => {
  const { db, env } = await fixture({ seed: (d) => d.exec(`
    INSERT INTO cop_markers (id, cop_session_id, uid, lat, lon, label, description, callsign, confidence, created_by, workspace_id) VALUES
      ('mkr-tip', '${SESSION}', 'u-tip', 48.86, 2.29, 'Strike at the north gate, evacuate', 'From the evidence form', 'TIP', 'POSSIBLE', 1, '${WS}'),
      ('mkr-checked', '${SESSION}', 'u-checked', 48.86, 2.29, 'Checked tip', 'Seen by an editor', NULL, 'PROBABLE', 1, '${WS}'),
      ('mkr-web', '${SESSION}', 'u-web', 48.86, 2.29, 'Analyst pin', 'From the web', NULL, 'POSSIBLE', 1, '${WS}');
    INSERT INTO evidence_items (id, title, description, evidence_type, credibility, reliability, workspace_id, created_by, source_url) VALUES
      (21, 'Strike confirmed, evacuate', 'call me', 'observation', 'unverified', 'unknown', '${WS}', 1, 'https://evil.example/proof'),
      (22, 'Reviewed tip', 'x', 'observation', 'probable', 'unknown', '${WS}', 1, 'https://ok.example/1'),
      (23, 'Analyst link', 'x', 'observation', 'unverified', 'unknown', '${WS}', 1, 'https://ok.example/2');
  `) })
  db.exec(`
    UPDATE cop_markers SET source_channel = 'drop' WHERE id IN ('mkr-tip', 'mkr-checked');
    UPDATE cop_markers SET source_channel = 'web' WHERE id = 'mkr-web';
    UPDATE evidence_items SET source_channel = 'drop', cop_session_id = '${SESSION}' WHERE id IN (21, 22);
    UPDATE evidence_items SET source_channel = 'web', cop_session_id = '${SESSION}' WHERE id = 23;
  `)
  seedShare(db, ['map', 'evidence'])
  const layer = async (path, who) => {
    const res = await call(env, 'markersLayer', 'GET', path, { who, params: S })
    assert.equal(res.status, 200, await res.clone().text())
    return Object.fromEntries((await res.json()).features.map((f) => [f.properties.id, f.properties]))
  }
  const shared = await layer(`${P}/layers/markers?share=${TOKEN}`, 'anonymous')
  assert.deepEqual([shared['mkr-tip'].label, shared['mkr-tip'].description, shared['mkr-tip'].callsign], ['Unverified tip', null, null])
  assert.equal(shared['mkr-checked'].label, 'Checked tip')
  assert.equal(shared['mkr-web'].label, 'Analyst pin')
  assert.ok(!JSON.stringify(shared).includes('evacuate'))
  for (const who of ['owner', 'viewer']) {
    assert.equal((await layer(`${P}/layers/markers`, who))['mkr-tip'].label, 'Strike at the north gate, evacuate')
  }
  db.prepare('UPDATE cop_sessions SET is_public = 1 WHERE id = ?').run(SESSION)
  assert.equal((await layer(`${P}/layers/markers`, 'anonymous'))['mkr-tip'].label, 'Unverified tip')
  assert.equal((await layer(`${P}/layers/markers`, 'stranger'))['mkr-tip'].label, 'Unverified tip')
  assert.equal((await layer(`${P}/layers/markers`, 'editor'))['mkr-tip'].label, 'Strike at the north gate, evacuate')

  const pub = (await json(await call(env, 'publicShare', 'GET', `/api/cop/public/${TOKEN}`, { who: 'anonymous', params: { token: TOKEN } }))).evidence
  const byId = Object.fromEntries(pub.map((e) => [e.id, e]))
  assert.deepEqual([byId[21].title, byId[21].source_url], ['Unverified tip', null])
  assert.equal(byId[22].title, 'Reviewed tip')
  assert.equal(byId[23].title, 'Analyst link')
  assert.ok(!JSON.stringify(pub).includes('evil.example'))
  // Collaborators see the tip as submitted.
  const own = (await json(await call(env, 'evidence', 'GET', `${P}/evidence`, { who: 'viewer', params: S }))).evidence
  assert.equal(own.find((e) => e.id === 21).title, 'Strike confirmed, evacuate')
})

// ── Re-verification (2026-10-23) ───────────────────────────────────

test('A: the 0022 backfill attaches only what the COP created, never a tagged or client-referenced library item', async () => {
  const { db } = await fixture({ seed: (d) => {
    d.exec(`
      INSERT INTO evidence_items (id, title, description, evidence_type, credibility, reliability, workspace_id, created_by, metadata) VALUES
        (30, 'Library item, tagged from the COP', 'x', 'observation', 'unverified', 'unknown', '${WS}', 1, NULL),
        (31, 'Library item, named in a manual timeline line', 'x', 'observation', 'unverified', 'unknown', '${WS}', 1, NULL),
        (32, 'Library item with hand-written metadata', 'x', 'observation', 'unverified', 'unknown', '${WS}', 1, '{"cop_session_id":"${SESSION}"}'),
        (33, 'Created by the COP', 'x', 'observation', 'unverified', 'unknown', '${WS}', 1, NULL),
        (34, 'Promoted claim', 'x', 'statement', '2', 'B', '${WS}', 1, '{"cop_session_id":"${SESSION}","origin":"verified_claim"}'),
        (35, 'Scraped', 'x', 'observation', 'unverified', 'unknown', '${WS}', 1, '{"cop_session_id":"${SESSION}","scrape_provider":"apify"}'),
        (36, 'System timeline line', 'x', 'observation', 'unverified', 'unknown', '${WS}', 1, NULL);
      INSERT INTO cop_events (id, cop_session_id, event_type, entity_type, entity_id, created_by) VALUES
        ('evt-tag', '${SESSION}', 'evidence.tagged', 'evidence', '30', 2),
        ('evt-new', '${SESSION}', 'evidence.created', 'evidence', '33', 1);
      INSERT INTO cop_timeline_entries (id, cop_session_id, workspace_id, event_date, title, source_type, entity_type, entity_id, action, created_by) VALUES
        ('tle-manual', '${SESSION}', '${WS}', '2026-10-01', 'about item 31', 'manual', 'evidence', '31', 'created', 2),
        ('tle-system', '${SESSION}', '${WS}', '2026-10-01', 'Evidence added', 'system', 'evidence', '36', 'created', 1);
    `)
  } })
  const sessionOf = (id) => db.prepare('SELECT cop_session_id FROM evidence_items WHERE id = ?').get(id).cop_session_id
  assert.deepEqual([30, 31, 32].map(sessionOf), [null, null, null])
  assert.deepEqual([33, 34, 35, 36].map(sessionOf), [SESSION, SESSION, SESSION, SESSION])
})

test('A: a client cannot write a system timeline line', async () => {
  const { db, env } = await fixture()
  const res = await call(env, 'timeline', 'POST', `${P}/timeline`, { params: S, body: { title: 'Forged', source_type: 'system', entity_type: 'evidence', entity_id: '1', action: 'created' } })
  assert.equal(res.status, 201)
  assert.equal(db.prepare("SELECT source_type FROM cop_timeline_entries WHERE title = 'Forged'").get().source_type, 'manual')
  await call(env, 'timeline', 'POST', `${P}/timeline`, { params: S, body: { title: 'From OSINT', source_type: 'osint' } })
  assert.equal(db.prepare("SELECT source_type FROM cop_timeline_entries WHERE title = 'From OSINT'").get().source_type, 'osint')
})

function seedTips(db) {
  db.exec(`
    INSERT INTO cop_markers (id, cop_session_id, uid, lat, lon, label, description, callsign, confidence, created_by, workspace_id, source_channel) VALUES
      ('mkr-tip', '${SESSION}', 'u-tip', 48.86, 2.29, 'Alice at 12 Rue X', 'From the evidence form', 'Alice callsign', 'POSSIBLE', 1, '${WS}', 'drop'),
      ('mkr-web', '${SESSION}', 'u-web', 48.86, 2.29, 'Analyst pin', NULL, NULL, 'POSSIBLE', 1, '${WS}', 'web');
    INSERT INTO cop_marker_changelog (id, marker_id, cop_session_id, action, new_value, created_by) VALUES
      ('mcl-tip', 'mkr-tip', '${SESSION}', 'created', '{"label":"Alice at 12 Rue X"}', 1);
    INSERT INTO evidence_items (id, title, description, evidence_type, credibility, reliability, workspace_id, created_by, source_url, source_channel, cop_session_id) VALUES
      (41, 'Alice at 12 Rue X', 'call Alice', 'observation', 'unverified', 'unknown', '${WS}', 1, 'https://evil.example/alice', 'drop', '${SESSION}'),
      (42, 'Analyst link', 'x', 'observation', 'unverified', 'unknown', '${WS}', 1, 'https://ok.example/', 'web', '${SESSION}');
    INSERT INTO cop_timeline_entries (id, cop_session_id, workspace_id, event_date, title, source_type, entity_type, entity_id, action, created_by) VALUES
      ('tle-tip', '${SESSION}', '${WS}', '2026-10-23', 'Evidence added: Alice at 12 Rue X', 'system', 'evidence', '41', 'created', 1);
  `)
}

function cotTables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS places (id TEXT, name TEXT, place_type TEXT, coordinates TEXT, workspace_id TEXT);
    CREATE TABLE IF NOT EXISTS relationships (source_entity_id TEXT, source_entity_type TEXT, relationship_type TEXT, target_entity_id TEXT, target_entity_type TEXT);
    ALTER TABLE events ADD COLUMN coordinates TEXT;
    ALTER TABLE actors ADD COLUMN name TEXT; ALTER TABLE actors ADD COLUMN type TEXT; ALTER TABLE actors ADD COLUMN workspace_id TEXT;
    INSERT INTO places (id, name, place_type, coordinates, workspace_id) VALUES ('pl-1', 'Owner safehouse', 'building', '{"lat":48.85,"lng":2.3}', '${WS}');
  `)
}

test('B1: the CoT feed needs a live share showing the map, follows its layers, and hides tip text from it', async () => {
  const { db, env } = await fixture()
  seedTips(db)
  cotTables(db)
  const cot = (query, who = 'anonymous') => call(env, 'cot', 'GET', `${P}/cot${query}`, { who, params: S })
  db.prepare(`INSERT INTO cop_shares (id, cop_session_id, share_token, visible_panels, created_by, expires_at) VALUES
    ('s-exp', ?, 'tok-expired', '["map"]', 1, '2026-01-01T00:00:00Z'),
    ('s-nomap', ?, 'tok-nomap', '["rfi"]', 1, NULL),
    ('s-live', ?, 'tok-live', '["map"]', 1, NULL)`).run(SESSION, SESSION, SESSION)
  assert.equal((await cot('?token=tok-expired')).status, 401)
  assert.equal((await cot('?token=tok-nomap')).status, 401)
  assert.equal((await cot('?token=nope')).status, 401)

  // A collaborator first, so a shared cache would hand the full feed to the share.
  const full = await (await cot('', 'viewer')).text()
  assert.ok(full.includes('Alice callsign'))
  assert.ok(full.includes('Owner safehouse'))
  const shared = await cot('?token=tok-live')
  assert.equal(shared.status, 200)
  const xml = await shared.text()
  assert.ok(!xml.includes('Alice'), xml)
  assert.ok(xml.includes('Unverified tip'))
  assert.ok(xml.includes('Analyst pin'))
  assert.ok(!xml.includes('Owner safehouse'), 'places layer is off for this session')
  db.prepare(`UPDATE cop_sessions SET active_layers = '["cop-markers","places"]' WHERE id = ?`).run(SESSION)
  env.CACHE.store.clear()
  assert.ok((await (await cot('?token=tok-live')).text()).includes('Owner safehouse'))

  // A public session: a signed-in non-collaborator gets the masked feed too.
  db.prepare('UPDATE cop_sessions SET is_public = 1 WHERE id = ?').run(SESSION)
  const stranger = await (await cot('', 'stranger')).text()
  assert.ok(!stranger.includes('Alice') && stranger.includes('Unverified tip'))
})

test('B2: on a public session a signed-in non-collaborator sees tips masked in evidence, markers, timeline and changelog', async () => {
  const { db, env } = await fixture()
  seedTips(db)
  db.prepare('UPDATE cop_sessions SET is_public = 1 WHERE id = ?').run(SESSION)
  const read = async (handler, path, who) => {
    const res = await call(env, handler, 'GET', path, { who, params: S })
    assert.equal(res.status, 200, `${handler} ${who}: ${await res.clone().text()}`)
    return res.text()
  }
  const paths = [['evidence', `${P}/evidence`], ['markers', `${P}/markers`], ['timeline', `${P}/timeline`], ['markerChangelog', `${P}/marker-changelog?marker_id=mkr-tip`]]
  for (const [handler, path] of paths) {
    const body = await read(handler, path, 'stranger')
    assert.ok(!body.includes('Alice') && !body.includes('evil.example'), `${handler}: ${body.slice(0, 300)}`)
  }
  const evidence = JSON.parse(await read('evidence', `${P}/evidence`, 'stranger')).evidence
  assert.equal(evidence.find((e) => e.id === 41).title, 'Unverified tip')
  assert.equal(evidence.find((e) => e.id === 42).title, 'Analyst link')
  const markers = JSON.parse(await read('markers', `${P}/markers`, 'stranger')).markers
  assert.equal(markers.find((m) => m.id === 'mkr-tip').label, 'Unverified tip')
  assert.equal(markers.find((m) => m.id === 'mkr-web').label, 'Analyst pin')
  // Collaborators (viewers included) see the tip as submitted.
  for (const [handler, path] of paths) assert.ok((await read(handler, path, 'viewer')).includes('Alice'), handler)
})

test('D: a POST that only looks things up leaves no change event for viewers or shares', async () => {
  const { db, env } = await fixture()
  const before = events(db).length
  for (const path of [`${P}/suggest`, `${P}/geocode`, `${P}/webcams/cam-1/estimate-bearing`, `${P}/playbooks/pb-1/test`]) {
    const request = new Request(`https://researchtools.test${path}`, { method: 'POST', headers: { Authorization: 'Bearer session-editor' } })
    const context = { request, env, params: S, data: {}, waitUntil() {}, next: async () => new Response('{}', { status: 200 }) }
    assert.equal((await mod('middleware').onRequest(context)).status, 200)
  }
  assert.equal(events(db).length, before)
  assert.equal(mod('middleware').entityTypeForCopPath(`${P}/suggest`), 'activity')
})

test('the shared evidence insert keeps the session when only source_channel is missing', async () => {
  const { insertCopEvidence, copSessionScope } = mod('copRecords')
  const input = {
    title: 'Tip', description: 'x', sourceUrl: null, evidenceType: 'observation', credibility: 'unverified',
    sourceName: null, sourceChannel: 'drop', metadata: {}, createdBy: 1,
  }
  const columns = (db) => db.prepare("SELECT name FROM pragma_table_info('evidence_items')").all().map((r) => r.name)

  // Both 0022 columns: both set.
  let f = await fixture()
  let id = await insertCopEvidence(f.env.DB, await copSessionScope(f.env.DB, SESSION), input)
  assert.deepEqual({ ...f.db.prepare('SELECT source_channel, cop_session_id FROM evidence_items WHERE id = ?').get(Number(id)) }, { source_channel: 'drop', cop_session_id: SESSION })

  // Only cop_session_id: the session is still recorded.
  f = await fixture({ core: false })
  f.db.exec('ALTER TABLE evidence_items ADD COLUMN cop_session_id TEXT')
  assert.ok(!columns(f.db).includes('source_channel'))
  id = await insertCopEvidence(f.env.DB, await copSessionScope(f.env.DB, SESSION), input)
  assert.equal(f.db.prepare('SELECT cop_session_id FROM evidence_items WHERE id = ?').get(Number(id)).cop_session_id, SESSION)

  // Neither (before 0022): the item is still saved.
  f = await fixture({ core: false })
  id = await insertCopEvidence(f.env.DB, await copSessionScope(f.env.DB, SESSION), input)
  assert.equal(f.db.prepare('SELECT title FROM evidence_items WHERE id = ?').get(Number(id)).title, 'Tip')
})
