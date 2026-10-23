/**
 * Evidence-form submissions → COP (functions/api/_shared/cop-ingest.ts).
 *
 * - drop-submit / submit on a form linked to a COP with auto_ingest on: one
 *   unverified evidence item (form fields only; never the submitter's name, contact
 *   or IP-derived location), source_url from the URL field, a POSSIBLE marker only
 *   from an explicit location field, the form's tag, events; the response says
 *   `ingested: { evidence_id, marker_id }` and nothing else about the COP.
 * - Inline images are typed and stripped before the row is stored; an unreadable
 *   one refuses the submission.
 * - Idempotent (a retry or a second reviewer makes no second item); capped per hour.
 * - Triage: editors only; a linked_evidence_id from the caller must be in the
 *   workspace; accept files the submission; reject takes auto-ingested items back.
 * - push-to-cop: a double push makes one evidence item.
 *
 * Run: npm run test:unit
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  b64, cop, dataUrl, DROP_TOKEN, events, fixture, jpegWithMetadata, leaksMetadata, mod, publicCall, SESSION,
  setupInputSuite, SURVEY_TOKEN,
} from './cop-input-harness.mjs'
import { JPEG_PLAIN } from './fixtures/images.mjs'

setupInputSuite(['serviceAuth', 'copCaller', 'middleware', 'copIngest', 'submissions', 'dropSubmit', 'surveySubmit', 'pushToCop'])

const TIP = {
  what: 'Two vans unloading barriers at the north gate',
  link: 'https://example.org/video/123?utm_source=x',
  where: '48.9245,2.3601',
  where_lat: '48.9245',
  where_lon: '2.3601',
}

const drop = (env, formData) =>
  publicCall(env, mod('dropSubmit'), 'POST', `/api/surveys/public/${DROP_TOKEN}/drop-submit`, {
    body: { form_data: formData }, params: { token: DROP_TOKEN },
  })

const count = (db, table) => db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n

test('drop-submit: a tip becomes unverified evidence, a marker and the form\'s tag at once', async () => {
  const { db, env } = await fixture({ channel: true })
  const res = await drop(env, TIP)
  assert.equal(res.status, 201)
  const body = await res.json()
  assert.deepEqual(Object.keys(body).sort(), ['ingested', 'message', 'ok'])
  assert.deepEqual(Object.keys(body.ingested).sort(), ['evidence_id', 'marker_id'])

  const ev = db.prepare('SELECT * FROM evidence_items WHERE CAST(id AS TEXT) = ?').get(body.ingested.evidence_id)
  assert.equal(ev.workspace_id, 'ws-owner')
  assert.equal(ev.credibility, 'unverified')
  assert.equal(ev.source_url, 'https://example.org/video/123?utm_source=x')
  assert.equal(ev.source_channel, 'drop')
  assert.match(ev.title, /^Tip: Two vans unloading barriers/)
  assert.match(ev.description, /What did you see\?: Two vans/)
  assert.doesNotMatch(ev.description, /where_lat|_lon/)

  const marker = db.prepare('SELECT * FROM cop_markers WHERE id = ?').get(body.ingested.marker_id)
  assert.equal(marker.cop_session_id, SESSION)
  assert.equal(marker.confidence, 'POSSIBLE')
  assert.equal(marker.lat, 48.9245)
  assert.equal(marker.stale_time, null, 'stays until removed')
  assert.equal(marker.source_id, body.ingested.evidence_id)
  assert.equal(marker.source_channel, 'drop')

  const tags = db.prepare('SELECT it.target_type, t.name, it.source FROM cop_item_tags it JOIN cop_tags t ON t.id = it.tag_id ORDER BY it.target_type').all()
  assert.deepEqual(tags.map((t) => [t.target_type, t.name, t.source]), [['evidence', 'tip', 'drop'], ['marker', 'tip', 'drop']])

  const row = db.prepare("SELECT status, linked_evidence_id, linked_marker_id, auto_ingested FROM survey_responses WHERE survey_id = 'srv-paris'").get()
  assert.deepEqual({ ...row }, { status: 'accepted', linked_evidence_id: body.ingested.evidence_id, linked_marker_id: body.ingested.marker_id, auto_ingested: 1 })
  assert.ok(events(db, 'evidence').length >= 1)
  assert.ok(events(db, 'marker').length >= 1)
  assert.ok(events(db, 'submission').some((e) => e.event_type === 'ingest.submission_triaged'))
})

test('no explicit location field, no marker; a COP-less or auto_ingest-off form ingests nothing', async () => {
  const { db, env } = await fixture()
  const noPlace = await (await drop(env, { what: 'just words' })).json()
  assert.equal(noPlace.ingested.marker_id, null)
  assert.equal(count(db, 'cop_markers'), 2, 'only the seeded markers')

  db.prepare("UPDATE survey_drops SET auto_ingest = 0 WHERE id = 'srv-paris'").run()
  const off = await (await drop(env, { what: 'second tip' })).json()
  assert.equal(off.ingested, null)
  assert.equal(db.prepare("SELECT status FROM survey_responses WHERE survey_id = 'srv-paris' ORDER BY rowid DESC").get().status, 'pending')
})

test('survey submit: never maps the submitter\'s location or copies their name into the COP', async () => {
  const { db, env } = await fixture()
  const res = await publicCall(env, mod('surveySubmit'), 'POST', `/api/surveys/public/${SURVEY_TOKEN}/submit`, {
    body: {
      form_data: { what: 'Barricade on rue X', link: 'not a url' },
      submitter_name: 'Alice Example', submitter_contact: 'alice@example.org', lat: 48.1, lon: 2.1,
    },
    params: { token: SURVEY_TOKEN },
  })
  assert.equal(res.status, 201)
  const body = await res.json()
  assert.equal(body.ingested.marker_id, null, 'the submitter\'s own position is not a tip location')
  const ev = db.prepare('SELECT title, description, source_url FROM evidence_items WHERE CAST(id AS TEXT) = ?').get(body.ingested.evidence_id)
  assert.equal(ev.source_url, null)
  for (const text of [ev.title, ev.description]) {
    assert.doesNotMatch(text, /Alice|alice@example/)
  }
  const payloads = db.prepare('SELECT payload FROM cop_events').all().map((r) => r.payload).join('\n')
  assert.doesNotMatch(payloads, /Alice/)
})

test('inline images are stripped before the row is stored and become a COP upload; unreadable ones refuse the tip', async () => {
  const { db, env, r2 } = await fixture()
  const photo = dataUrl('image/png', jpegWithMetadata(b64(JPEG_PLAIN)))
  const res = await drop(env, { what: 'photo of the gate', photo, photo_name: 'IMG.jpg', photo_type: 'image/png' })
  const body = await res.json()
  assert.equal(body.ok, true)
  const stored = JSON.parse(db.prepare("SELECT form_data FROM survey_responses WHERE survey_id = 'srv-paris'").get().form_data)
  assert.match(stored.photo, /^data:image\/jpeg;base64,/)
  assert.equal(stored.photo_type, 'image/jpeg')
  assert.equal(leaksMetadata(Buffer.from(stored.photo.split(',')[1], 'base64')), false)

  const ev = db.prepare('SELECT evidence_type, source_url, description FROM evidence_items WHERE CAST(id AS TEXT) = ?').get(body.ingested.evidence_id)
  assert.equal(ev.evidence_type, 'image')
  assert.match(ev.source_url, new RegExp(`^/api/cop/${SESSION}/uploads/upl-`))
  assert.doesNotMatch(ev.description, /base64/)
  const upload = db.prepare('SELECT r2_key, evidence_id FROM cop_uploads WHERE evidence_id IS NOT NULL').get()
  assert.equal(upload.evidence_id, body.ingested.evidence_id)
  assert.equal(leaksMetadata(r2.objects.get(upload.r2_key).bytes), false)

  const broken = await (await drop(env, { what: 'x', photo: dataUrl('image/jpeg', b64(JPEG_PLAIN).subarray(0, 200)) })).json()
  assert.equal(broken.ok, false)
  assert.match(broken.error, /Photo/)
  const svg = await (await drop(env, { what: 'x', photo: dataUrl('image/svg+xml', new TextEncoder().encode('<svg onload="alert(1)"/>')) })).json()
  assert.equal(svg.ok, false)
})

test('ingest is once: a retry, a second reviewer or a double push make no second item', async () => {
  const { db, env } = await fixture()
  const { ingested } = await (await drop(env, TIP)).json()
  const responseId = db.prepare("SELECT id FROM survey_responses WHERE survey_id = 'srv-paris'").get().id
  const { ingestSubmission } = mod('copIngest')
  const again = await Promise.all([1, 2, 3].map(() => ingestSubmission(env, { responseId, sessionId: SESSION, actorUserId: 2, auto: false })))
  for (const r of again) assert.deepEqual([r.ok, r.created, r.evidenceId], [true, false, ingested.evidence_id])
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM evidence_items WHERE title LIKE 'Tip:%'").get().n, 1)
})

test('push-to-cop: two pushes at once make one evidence item; the second is 409', async () => {
  const { db, env } = await fixture()
  db.prepare("UPDATE survey_drops SET auto_ingest = 0 WHERE id = 'srv-paris'").run()
  await drop(env, TIP)
  const responseId = db.prepare("SELECT id FROM survey_responses WHERE survey_id = 'srv-paris'").get().id
  const push = () => publicCall(env, mod('pushToCop'), 'POST', `/api/surveys/srv-paris/responses/${responseId}/push-to-cop`, {
    headers: { Authorization: 'Bearer session-owner' }, body: {}, params: { id: 'srv-paris', rid: responseId },
  })
  const [a, b] = await Promise.all([push(), push()])
  assert.deepEqual([a.status, b.status].sort(), [201, 409])
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM evidence_items WHERE title LIKE 'Tip:%'").get().n, 1)
})

test('auto-ingest is capped per form per hour; the rest wait in the inbox', async () => {
  const { db, env } = await fixture()
  const { AUTO_INGEST_PER_HOUR } = mod('copIngest')
  const recent = new Date().toISOString()
  for (let i = 0; i < AUTO_INGEST_PER_HOUR; i++) {
    db.prepare("INSERT INTO survey_responses (id, survey_id, cop_session_id, auto_ingested, status, updated_at) VALUES (?, 'srv-paris', ?, 1, 'accepted', ?)")
      .run(`old-${i}`, SESSION, recent)
  }
  const body = await (await drop(env, { what: 'one more' })).json()
  assert.equal(body.ok, true)
  assert.equal(body.ingested, null)
})

test('without migration 0023 the tip is stored and nothing is ingested', async () => {
  const { db, env } = await fixture({ tags: false })
  const body = await (await drop(env, TIP)).json()
  assert.equal(body.ok, true)
  assert.equal(body.ingested, null)
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM survey_responses WHERE survey_id = 'srv-paris'").get().n, 1)
})

// ── Triage ────────────────────────────────────────────────────────

const triage = (env, who, body) =>
  cop(env, 'PUT', `/api/cop/${SESSION}/submissions`, { who, body, handler: mod('submissions'), params: { id: SESSION } })

test('triage: editors only; a caller-chosen linked_evidence_id must be in this workspace', async () => {
  const { db, env } = await fixture()
  db.prepare("UPDATE survey_drops SET auto_ingest = 0 WHERE id = 'srv-paris'").run()
  await drop(env, TIP)
  const id = db.prepare("SELECT id FROM survey_responses WHERE survey_id = 'srv-paris'").get().id
  assert.equal((await triage(env, 'viewer', { id, status: 'triaged' })).status, 403)
  assert.equal((await triage(env, 'attacker', { id, status: 'triaged' })).status, 403)
  const foreign = await triage(env, 'editor', { id, status: 'triaged', linked_evidence_id: '2' })
  assert.equal(foreign.status, 400)
  assert.equal(db.prepare('SELECT linked_evidence_id FROM survey_responses WHERE id = ?').get(id).linked_evidence_id, null)
  assert.equal((await triage(env, 'editor', { id, status: 'triaged', linked_evidence_id: '1' })).status, 200)
})

test('triage: accept files the submission once; reject takes auto-ingested items back off the COP', async () => {
  const { db, env } = await fixture()
  db.prepare("UPDATE survey_drops SET auto_ingest = 0 WHERE id = 'srv-paris'").run()
  await drop(env, TIP)
  const manual = db.prepare("SELECT id FROM survey_responses WHERE survey_id = 'srv-paris'").get().id
  const accepted = await (await triage(env, 'editor', { id: manual, status: 'accepted' })).json()
  assert.ok(accepted.linked_evidence_id)
  assert.ok(accepted.linked_marker_id)
  const before = count(db, 'evidence_items')
  await triage(env, 'editor', { id: manual, status: 'accepted' })
  assert.equal(count(db, 'evidence_items'), before, 'a second accept adds nothing')
  // A person accepted it: reject later leaves the evidence.
  await triage(env, 'editor', { id: manual, status: 'rejected' })
  assert.equal(count(db, 'evidence_items'), before)

  db.prepare("UPDATE survey_drops SET auto_ingest = 1 WHERE id = 'srv-paris'").run()
  const { ingested } = await (await drop(env, { ...TIP, what: 'auto one' })).json()
  const auto = db.prepare('SELECT id FROM survey_responses WHERE linked_evidence_id = ?').get(ingested.evidence_id).id
  const rejected = await triage(env, 'editor', { id: auto, status: 'rejected', rejection_reason: 'spam' })
  assert.equal(rejected.status, 200)
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM evidence_items WHERE CAST(id AS TEXT) = ?').get(ingested.evidence_id).n, 0)
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM cop_markers WHERE id = ?').get(ingested.marker_id).n, 0)
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM cop_item_tags WHERE target_id IN (?, ?)').get(ingested.evidence_id, ingested.marker_id).n, 0)
  const row = db.prepare('SELECT status, linked_evidence_id, auto_ingested FROM survey_responses WHERE id = ?').get(auto)
  assert.deepEqual({ ...row }, { status: 'rejected', linked_evidence_id: null, auto_ingested: 0 })
  assert.ok(events(db, 'evidence').some((e) => e.event_type === 'evidence.deleted'))
})
