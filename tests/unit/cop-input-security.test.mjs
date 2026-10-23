/**
 * Regression tests from the security review of COP input (tags, uploads, evidence
 * forms). Each one failed on the code before its fix.
 *
 * - Only a COP's owner or editor can point a form at it (create, update, link),
 *   and auto-ingest only files tips for forms such a person created.
 * - The hourly auto-ingest cap holds under concurrent tips.
 * - The /api/surveys limiter counts by the client's address, not by headers the
 *   client chooses.
 * - Tag events carry the tag id, and target ids only for the public item types.
 * - The bot service removes only tags it applied.
 * - Images: a pixel ceiling; only JFIF APP0 (without its thumbnail) and Adobe APP14
 *   kept; reserved markers refused; animated WebP refused; PNG iCCP/sPLT and GIF
 *   plain text dropped.
 * - drop-submit checks the size before decoding any file.
 *
 * Run: npm run test:unit
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  b64, cop, DROP_TOKEN, ENTRIES, fakeKv, fixture, INTAKE_TOKEN, leaksMetadata, mod, publicCall, SESSION, setupInputSuite, SURVEY_TOKEN,
} from './cop-input-harness.mjs'
import { GIF_COMMENT, JPEG_PLAIN, PNG_META, WEBP_META } from './fixtures/images.mjs'

Object.assign(ENTRIES, {
  surveys: 'functions/api/surveys/index.ts',
  survey: 'functions/api/surveys/[id].ts',
  linkCop: 'functions/api/surveys/[id]/link-cop.ts',
  apiMiddleware: 'functions/api/_middleware.ts',
})
setupInputSuite([
  'serviceAuth', 'copCaller', 'middleware', 'sanitize', 'copIngest', 'itemTags', 'dropSubmit', 'surveys', 'survey', 'linkCop', 'apiMiddleware',
  'surveySubmit', 'intakeSubmit', 'submissions', 'evidenceTags',
])

const auth = (who) => ({ Authorization: `Bearer session-${who}` })
const DROP_FORM = {
  title: 'Paris evidence form', intent: 'drop', status: 'active', auto_tag_category: 'confirmed-strike',
  form_schema: [{ name: 'what', type: 'textarea', label: 'What' }, { name: 'where', type: 'geopoint', label: 'Where' }],
}

// ── 1. Forms pointing at someone else's COP ───────────────────────

test('only the COP owner or an editor can create a form linked to it', async () => {
  const { db, env } = await fixture()
  const create = (who, body) => publicCall(env, mod('surveys'), 'POST', '/api/surveys', { headers: auth(who), body })
  assert.equal((await create('attacker', { ...DROP_FORM, cop_session_id: SESSION })).status, 403)
  assert.equal((await create('viewer', { ...DROP_FORM, cop_session_id: SESSION })).status, 403)
  assert.equal((await create('attacker', { ...DROP_FORM, cop_session_id: ['x'] })).status, 403)
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM survey_drops WHERE created_by IN (3, 4)").get().n, 0)
  assert.equal((await create('editor', { ...DROP_FORM, cop_session_id: SESSION })).status, 201)
  assert.equal((await create('attacker', DROP_FORM)).status, 201, 'a form with no COP is anyone\'s')
})

test('only the COP owner or an editor can relink a form (update or link-cop); unlinking stays open', async () => {
  const { db, env } = await fixture()
  db.prepare("INSERT INTO survey_drops (id, title, share_token, status, intent, created_by) VALUES ('srv-mine', 'Mine', 'tok-mine', 'active', 'drop', 4), ('srv-viewer', 'V', 'tok-v', 'active', 'drop', 3)").run()
  const put = (who, id, body) => publicCall(env, mod('survey'), 'PUT', `/api/surveys/${id}`, { headers: auth(who), body, params: { id } })
  const link = (who, id, body) => publicCall(env, mod('linkCop'), 'POST', `/api/surveys/${id}/link-cop`, { headers: auth(who), body, params: { id } })
  assert.equal((await put('attacker', 'srv-mine', { cop_session_id: SESSION })).status, 403)
  assert.equal((await link('attacker', 'srv-mine', { cop_session_id: SESSION })).status, 403)
  assert.equal((await link('viewer', 'srv-viewer', { cop_session_id: SESSION })).status, 403, 'a viewer may not link')
  assert.equal((await put('viewer', 'srv-viewer', { cop_session_id: SESSION })).status, 403)
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM survey_drops WHERE id IN ('srv-mine','srv-viewer') AND cop_session_id IS NOT NULL").get().n, 0)
  assert.equal((await put('attacker', 'srv-mine', { cop_session_id: null, title: 'Renamed' })).status, 200)
})

test('auto-ingest files tips only for forms a current owner or editor of the COP created', async () => {
  const { db, env } = await fixture()
  const tip = (token) => publicCall(env, mod('dropSubmit'), 'POST', `/api/surveys/public/${token}/drop-submit`, {
    params: { token }, body: { form_data: { what: 'Strike confirmed at the north gate', where: '48.86,2.29' } },
  })
  // A form linked to the COP by someone with no access (rows written before the route checks, or by hand).
  db.prepare(`INSERT INTO survey_drops (id, title, form_schema, share_token, status, intent, cop_session_id, workspace_id, created_by)
    VALUES ('srv-foreign', 'Foreign', ?, 'tok-foreign', 'active', 'drop', ?, 'ws-attacker', 4)`).run(JSON.stringify(DROP_FORM.form_schema), SESSION)
  const foreign = await (await tip('tok-foreign')).json()
  assert.equal(foreign.ok, true, 'the tip itself is still accepted')
  assert.equal(foreign.ingested, null)
  // A form an editor created, after that editor lost access.
  db.prepare(`INSERT INTO survey_drops (id, title, form_schema, share_token, status, intent, cop_session_id, workspace_id, created_by)
    VALUES ('srv-former', 'Former', ?, 'tok-former', 'active', 'drop', ?, 'ws-owner', 2)`).run(JSON.stringify(DROP_FORM.form_schema), SESSION)
  assert.ok((await (await tip('tok-former')).json()).ingested, 'while the editor has access')
  db.prepare("UPDATE cop_collaborators SET role = 'viewer' WHERE user_id = 2").run()
  assert.equal((await (await tip('tok-former')).json()).ingested, null, 'not after')
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM evidence_items WHERE title LIKE 'Tip: Strike%'").get().n, 1)
  // The owner's own form still ingests.
  assert.ok((await (await tip(DROP_TOKEN)).json()).ingested)
})

// ── 2. The hourly cap and the limiter ─────────────────────────────

test('80 concurrent tips: auto-ingest stops exactly at the hourly cap', async () => {
  const { db, env: base } = await fixture({ channel: true })
  const { AUTO_INGEST_PER_HOUR } = mod('copIngest')
  // A D1 round trip takes milliseconds; without the delay the in-process shim serialises everything.
  const sleep = () => new Promise((r) => setTimeout(r, 1 + Math.random() * 3))
  const wrap = (st) => ({
    bind: (...a) => wrap(st.bind(...a)),
    all: async () => { await sleep(); return st.all() },
    first: async (c) => { await sleep(); return st.first(c) },
    run: async () => { await sleep(); return st.run() },
  })
  const env = { ...base, DB: { prepare: (sql) => wrap(base.DB.prepare(sql)) } }
  const send = (i) => publicCall(env, mod('dropSubmit'), 'POST', `/api/surveys/public/${DROP_TOKEN}/drop-submit`, {
    params: { token: DROP_TOKEN }, body: { form_data: { what: `flood ${i}`, where: '48.86,2.29' } },
  })
  const results = await Promise.all(Array.from({ length: 80 }, (_, i) => send(i).then((r) => r.json())))
  assert.equal(results.filter((r) => r.ok).length, 80, 'every tip is stored')
  assert.equal(results.filter((r) => r.ingested).length, AUTO_INGEST_PER_HOUR)
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM survey_responses WHERE survey_id = 'srv-paris' AND auto_ingested = 1").get().n, AUTO_INGEST_PER_HOUR)
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM cop_markers WHERE label LIKE 'Tip: flood%'").get().n, AUTO_INGEST_PER_HOUR)
})

test('the /api/surveys limiter counts by CF-Connecting-IP, not by headers the client picks', async () => {
  const cache = fakeKv()
  let reached = 0
  const call = (i) => {
    const request = new Request(`https://researchtools.test/api/surveys/public/${SURVEY_TOKEN}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.7', 'X-User-Hash': `rotating-${i}`, 'X-Guest-Session': `g-${i}` },
      body: '{}',
    })
    return mod('apiMiddleware').onRequest({
      request, env: { CACHE: cache }, params: {}, data: {}, waitUntil() {},
      next: async () => { reached++; return new Response('{}', { status: 201 }) },
    })
  }
  const statuses = []
  for (let i = 0; i < 45; i++) statuses.push((await call(i)).status)
  assert.equal(reached, 40)
  assert.deepEqual(statuses.slice(40), [429, 429, 429, 429, 429])
})

// ── 4 and 5. Tag events and service removals ──────────────────────

const itemTags = (env, method, who, body) =>
  cop(env, method, `/api/cop/${SESSION}/item-tags`, { who, body, handler: mod('itemTags'), params: { id: SESSION } })

test('tag events carry the tag id, never its name, and target ids only for public item types', async () => {
  const { db, env } = await fixture()
  await itemTags(env, 'POST', 'editor', { target_type: 'marker', target_id: 'mkr-paris', tags: ['Safe House'] })
  await itemTags(env, 'POST', 'editor', { target_type: 'submission', target_id: 'sub-paris', tags: ['Safe House'] })
  await itemTags(env, 'DELETE', 'editor', { target_type: 'marker', target_id: 'mkr-paris', tag: 'safe house' })
  const tagId = db.prepare("SELECT id FROM cop_tags WHERE name_key = 'safe house'").get().id
  const rows = db.prepare("SELECT event_type, entity_id, payload FROM cop_events WHERE entity_type = 'tag' ORDER BY rowid").all()
  assert.deepEqual(rows.map((r) => r.event_type), ['tag.created', 'tag.applied', 'tag.applied', 'tag.removed'])
  for (const row of rows) {
    assert.equal(row.entity_id, tagId, row.event_type)
    assert.doesNotMatch(row.payload, /safe house/i, row.event_type)
  }
  const [onMarker, onSubmission] = rows.filter((r) => r.event_type === 'tag.applied').map((r) => JSON.parse(r.payload))
  assert.equal(onMarker.target_id, 'mkr-paris')
  assert.equal(onSubmission.target_type, 'submission')
  assert.equal('target_id' in onSubmission, false, 'a submission id is not a public item id')
})

test('the bot service removes only tags it applied', async () => {
  const { db, env } = await fixture()
  await itemTags(env, 'POST', 'editor', { target_type: 'marker', target_id: 'mkr-paris', tags: ['by-person'] })
  await itemTags(env, 'POST', 'service', { target_type: 'marker', target_id: 'mkr-paris', tags: ['by-bot'] })
  const refused = await itemTags(env, 'DELETE', 'service', { target_type: 'marker', target_id: 'mkr-paris', tag: 'by-person' })
  assert.equal(refused.status, 403)
  assert.equal((await itemTags(env, 'DELETE', 'service', { target_type: 'marker', target_id: 'mkr-paris', tag: 'by-bot' })).status, 200)
  assert.deepEqual(db.prepare('SELECT t.name FROM cop_item_tags it JOIN cop_tags t ON t.id = it.tag_id').all().map((r) => r.name), ['by-person'])
  // People may remove anyone's tags.
  assert.equal((await itemTags(env, 'DELETE', 'editor', { target_type: 'marker', target_id: 'mkr-paris', tag: 'by-person' })).status, 200)
})

// ── 7. Crafted images ─────────────────────────────────────────────

const be16 = (v) => [(v >> 8) & 255, v & 255]
function jpegSegments(bytes) {
  const out = []
  for (let i = 2; i + 4 <= bytes.length && bytes[i] === 0xff;) {
    const code = bytes[i + 1]
    if (code === 0xda) break
    const len = (bytes[i + 2] << 8) | bytes[i + 3]
    out.push({ code, at: i, payload: bytes.subarray(i + 4, i + 2 + len) })
    i += 2 + len
  }
  return out
}
function insertAfterSoi(jpeg, ...segments) {
  return Uint8Array.from([...jpeg.subarray(0, 2), ...segments.flatMap((s) => [...s]), ...jpeg.subarray(2)])
}
const seg = (code, payload) => Uint8Array.from([0xff, code, ...be16(payload.length + 2), ...payload])
const ascii = (s) => [...Buffer.from(s, 'latin1')]

test('images above the pixel ceiling are refused (JPEG, PNG, WebP, GIF screen and frame)', () => {
  const { sanitizeImage } = mod('sanitize')
  const jpeg = new Uint8Array(b64(JPEG_PLAIN))
  const sof = jpegSegments(jpeg).find((s) => s.code === 0xc0)
  jpeg.set([...be16(10000), ...be16(6000)], sof.at + 5) // height, width → 60 MP
  assert.equal(sanitizeImage(jpeg, 'image/jpeg').ok, false, 'JPEG')

  const png = new Uint8Array(b64(PNG_META))
  png.set([0, 0, 0x1f, 0x40, 0, 0, 0x1f, 0x40], 16) // IHDR 8000 x 8000
  assert.equal(sanitizeImage(png, 'image/png').ok, false, 'PNG')

  const webp = new Uint8Array(b64(WEBP_META))
  webp.set([0x3f, 0x1f, 0x00, 0x3f, 0x1f, 0x00], 24) // VP8X canvas 8000 x 8000
  assert.equal(sanitizeImage(webp, 'image/webp').ok, false, 'WebP')

  const gifScreen = new Uint8Array(b64(GIF_COMMENT))
  gifScreen.set([0x40, 0x1f, 0x40, 0x1f], 6) // logical screen 8000 x 8000
  assert.equal(sanitizeImage(gifScreen, 'image/gif').ok, false, 'GIF screen')
  const gifFrame = new Uint8Array(b64(GIF_COMMENT))
  const descriptor = gifFrame.indexOf(0x2c, 13)
  gifFrame.set([0x40, 0x1f, 0x40, 0x1f], descriptor + 5) // first frame 8000 x 8000
  assert.equal(sanitizeImage(gifFrame, 'image/gif').ok, false, 'GIF frame')
})

test('JPEG: APP0 only as JFIF without its thumbnail; APP14 only as Adobe; reserved markers refused', () => {
  const { sanitizeImage } = mod('sanitize')
  const base = b64(JPEG_PLAIN)
  // A JFIF APP0 with a 2x2 thumbnail, a JFXX APP0, a non-Adobe APP14.
  const thumb = seg(0xe0, [...ascii('JFIF\0'), 1, 1, 0, 0, 1, 0, 1, 2, 2, ...ascii('SECRET-THUMB')])
  const jfxx = seg(0xe0, [...ascii('JFXX\0'), 0x10, ...ascii('Alice thumb')])
  const app14 = seg(0xee, ascii('NotAdobe Alice'))
  const out = sanitizeImage(insertAfterSoi(base, thumb, jfxx, app14), 'image/jpeg')
  assert.equal(out.ok, true)
  assert.equal(leaksMetadata(out.bytes), false)
  assert.equal(Buffer.from(out.bytes).includes(Buffer.from('SECRET-THUMB')), false, 'JFIF thumbnail dropped')
  for (const s of jpegSegments(out.bytes)) {
    if (s.code === 0xe0) {
      assert.equal(Buffer.from(s.payload.subarray(0, 5)).toString('latin1'), 'JFIF\0')
      assert.deepEqual([s.payload[12], s.payload[13]], [0, 0], 'no thumbnail dimensions')
      assert.equal(s.payload.length, 14)
    }
    if (s.code === 0xee) assert.equal(Buffer.from(s.payload.subarray(0, 5)).toString('latin1'), 'Adobe')
  }
  const adobe = sanitizeImage(insertAfterSoi(base, seg(0xee, [...ascii('Adobe'), 0, 100, 0, 0, 0, 0, 1])), 'image/jpeg')
  assert.ok(jpegSegments(adobe.bytes).some((s) => s.code === 0xee), 'a real Adobe APP14 stays')

  for (const code of [0xf5, 0xc8, 0x02, 0xde]) {
    assert.equal(sanitizeImage(insertAfterSoi(base, seg(code, ascii('Alice'))), 'image/jpeg').ok, false, `marker ${code.toString(16)}`)
  }
})

test('animated WebP is refused; PNG iCCP/sPLT and GIF plain text are dropped', () => {
  const { sanitizeImage } = mod('sanitize')
  const webp = new Uint8Array(b64(WEBP_META))
  webp[20] |= 0x02 // VP8X animation flag
  assert.equal(sanitizeImage(webp, 'image/webp').ok, false, 'animation flag')
  const anim = Uint8Array.from([...b64(WEBP_META), ...ascii('ANIM'), 6, 0, 0, 0, 0, 0, 0, 0, 0, 0])
  anim.set([(anim.length - 8) & 255, ((anim.length - 8) >> 8) & 255, 0, 0], 4)
  assert.equal(sanitizeImage(anim, 'image/webp').ok, false, 'ANIM chunk')

  const crc = () => [0, 0, 0, 0]
  const chunk = (type, data) => [0, 0, (data.length >> 8) & 255, data.length & 255, ...ascii(type), ...data, ...crc()]
  const png = b64(PNG_META)
  const withProfile = Uint8Array.from([
    ...png.subarray(0, 33),
    ...chunk('iCCP', [...ascii('Alice profile\0'), 0, 1, 2, 3]),
    ...chunk('sPLT', [...ascii('Alice palette\0'), 8]),
    ...png.subarray(33),
  ])
  const outPng = sanitizeImage(withProfile, 'image/png')
  assert.equal(outPng.ok, true)
  assert.equal(leaksMetadata(outPng.bytes), false)

  const gif = b64(GIF_COMMENT)
  const descriptor = gif.indexOf(0x2c, 13)
  const plainText = [0x21, 0x01, 12, ...new Array(12).fill(0), 5, ...ascii('Alice'), 0]
  const withText = Uint8Array.from([...gif.subarray(0, descriptor), ...plainText, ...gif.subarray(descriptor)])
  const outGif = sanitizeImage(withText, 'image/gif')
  assert.equal(outGif.ok, true)
  assert.equal(leaksMetadata(outGif.bytes), false)
})

// ── 8. Size before decoding ───────────────────────────────────────

test('drop-submit refuses an oversized body before decoding or checking any file', async () => {
  const { db, env } = await fixture()
  // A broken image: decoding it first would answer "not accepted"; a size check first answers "too large".
  const broken = `data:image/jpeg;base64,${Buffer.from(b64(JPEG_PLAIN).subarray(0, 200)).toString('base64')}`
  const padding = 'x'.repeat(80 * 1024)
  const res = await publicCall(env, mod('dropSubmit'), 'POST', `/api/surveys/public/${DROP_TOKEN}/drop-submit`, {
    params: { token: DROP_TOKEN }, body: { form_data: { what: padding, photo: broken } },
  })
  const body = await res.json()
  assert.equal(body.ok, false)
  assert.match(body.error, /too large/i)
  const declared = await publicCall(env, mod('dropSubmit'), 'POST', `/api/surveys/public/${DROP_TOKEN}/drop-submit`, {
    params: { token: DROP_TOKEN }, raw: JSON.stringify({ form_data: { what: 'small', photo: broken } }),
    headers: { 'Content-Type': 'application/json', 'Content-Length': String(10 * 1024 * 1024) },
  })
  assert.match((await declared.json()).error, /too large/i, 'a declared length over the cap is refused unread')
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM survey_responses WHERE survey_id = 'srv-paris'").get().n, 0)
})

test('survey and intake submit read no more than the cap: a declared length or an oversized body is refused before parsing', async () => {
  const { db, env } = await fixture()
  const routes = [
    ['survey', mod('surveySubmit'), `/api/surveys/public/${SURVEY_TOKEN}/submit`, SURVEY_TOKEN],
    ['intake', mod('intakeSubmit'), `/api/cop/public/intake/${INTAKE_TOKEN}/submit`, INTAKE_TOKEN],
  ]
  for (const [name, handler, path, token] of routes) {
    const declared = await publicCall(env, handler, 'POST', path, {
      params: { token }, raw: JSON.stringify({ form_data: { what: 'small' } }),
      headers: { 'Content-Type': 'application/json', 'Content-Length': String(10 * 1024 * 1024) },
    })
    assert.equal(declared.status, 413, `${name}: declared length`)
    // Small answers, but a 250 KB name: only a byte cap on the body catches it before parsing.
    const padded = await publicCall(env, handler, 'POST', path, {
      params: { token }, body: { form_data: { what: 'small' }, submitter_name: 'x'.repeat(250 * 1024) },
    })
    assert.equal(padded.status, 413, `${name}: oversized body`)
    // 100 KB of answers: over the routes' 64K-character limit.
    const answers = await publicCall(env, handler, 'POST', path, {
      params: { token }, body: { form_data: { what: 'y'.repeat(100 * 1024) } },
    })
    assert.equal(answers.status, 413, `${name}: form data over 64K characters`)
  }
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM survey_responses WHERE survey_id IN ('srv-survey', 'intake-paris')").get().n, 0)
  // Within the limits, including non-Latin text the character limit allows, both still accept.
  const ok = await publicCall(env, mod('surveySubmit'), 'POST', `/api/surveys/public/${SURVEY_TOKEN}/submit`, {
    params: { token: SURVEY_TOKEN }, body: { form_data: { what: '北'.repeat(60000) } },
  })
  assert.equal(ok.status, 201)
})

// ── Re-verification: submissions, evidence tags, limiter keys ─────

const triage = (env, who, body) =>
  cop(env, 'PUT', `/api/cop/${SESSION}/submissions`, { who, body, handler: mod('submissions'), params: { id: SESSION } })
const tip = (env, what) => publicCall(env, mod('dropSubmit'), 'POST', `/api/surveys/public/${DROP_TOKEN}/drop-submit`, {
  params: { token: DROP_TOKEN }, body: { form_data: { what, where: '48.86,2.29' } },
})

test('a submission links only to evidence of this COP, not to the workspace library', async () => {
  const { db, env } = await fixture()
  db.exec(`INSERT INTO evidence_items (id, title, description, evidence_type, credibility, reliability, workspace_id, created_by, cop_session_id)
    VALUES (10, 'Library item, in no COP', 'x', 'observation', 'confirmed', 'A', 'ws-owner', 1, NULL)`)
  db.prepare("UPDATE survey_drops SET auto_ingest = 0 WHERE id = 'srv-paris'").run()
  await tip(env, 'manual tip')
  const sub = db.prepare("SELECT id FROM survey_responses WHERE survey_id = 'srv-paris'").get().id
  assert.equal((await triage(env, 'editor', { id: sub, linked_evidence_id: '10' })).status, 400)
  assert.equal(db.prepare('SELECT linked_evidence_id FROM survey_responses WHERE id = ?').get(sub).linked_evidence_id, null)
  assert.equal((await triage(env, 'editor', { id: sub, linked_evidence_id: '1' })).status, 200, 'the COP\'s own evidence')
})

test('rejecting removes only what auto-ingest created for that submission', async () => {
  // The schema after migration 0022 (evidence carries its COP session).
  const { db, env } = await fixture({ channel: true })
  db.exec(`INSERT INTO evidence_items (id, title, description, evidence_type, credibility, reliability, workspace_id, created_by, cop_session_id)
    VALUES (10, 'Library item, in no COP', 'x', 'observation', 'confirmed', 'A', 'ws-owner', 1, NULL)`)
  const { ingested } = await (await tip(env, 'auto tip')).json()
  const sub = db.prepare('SELECT id FROM survey_responses WHERE linked_evidence_id = ?').get(ingested.evidence_id).id
  // Relinked to the COP's existing evidence 1, then rejected: evidence 1 stays.
  assert.equal((await triage(env, 'editor', { id: sub, linked_evidence_id: '1' })).status, 200)
  assert.equal((await triage(env, 'editor', { id: sub, status: 'rejected' })).status, 200)
  const left = (id) => db.prepare('SELECT COUNT(*) AS n FROM evidence_items WHERE CAST(id AS TEXT) = ?').get(String(id)).n
  assert.equal(left(1), 1, 'evidence the submission was relinked to')
  assert.equal(left(10), 1, 'the library item')
  assert.equal(left(ingested.evidence_id), 0, 'the item auto-ingest created')
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM cop_markers WHERE id = ?').get(ingested.marker_id).n, 0)
  // Forced at the database: a link to the library item still can't make reject delete it.
  const { ingested: second } = await (await tip(env, 'second tip')).json()
  const sub2 = db.prepare('SELECT id FROM survey_responses WHERE linked_evidence_id = ?').get(second.evidence_id).id
  db.prepare("UPDATE survey_responses SET linked_evidence_id = '10' WHERE id = ?").run(sub2)
  await triage(env, 'editor', { id: sub2, status: 'rejected' })
  assert.equal(left(10), 1)
  assert.equal(left(second.evidence_id), 0)
})

test('evidence-tags reach only evidence of this COP, not the rest of the workspace', async () => {
  const { db, env } = await fixture()
  db.exec(`INSERT INTO evidence_items (id, title, description, evidence_type, credibility, reliability, workspace_id, created_by, cop_session_id)
    VALUES (10, 'Library item, in no COP', 'x', 'observation', 'confirmed', 'A', 'ws-owner', 1, NULL)`)
  db.prepare("INSERT INTO cop_evidence_tags (id, evidence_id, tag_category, tag_value, created_by) VALUES ('etg-lib', '10', 'loc', 'library secret', 1)").run()
  const call = (method, { query = '', body } = {}) =>
    cop(env, method, `/api/cop/${SESSION}/evidence-tags${query}`, { who: 'editor', body, handler: mod('evidenceTags'), params: { id: SESSION } })
  const read = await call('GET', { query: '?evidence_id=10' })
  assert.equal(read.status, 404)
  assert.equal((await call('POST', { body: { evidence_id: '10', tag_category: 'x', tag_value: 'planted' } })).status, 404)
  await call('DELETE', { query: '?tag_id=etg-lib' })
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM cop_evidence_tags WHERE id = 'etg-lib'").get().n, 1)
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM cop_evidence_tags WHERE tag_value = 'planted'").get().n, 0)
  assert.equal((await call('POST', { body: { evidence_id: '1', tag_category: 'x', tag_value: 'ok' } })).status, 201)
})

test('the submission list is for collaborators: a signed-in stranger on a public COP gets 403', async () => {
  const { db, env } = await fixture()
  db.prepare("UPDATE survey_drops SET auto_ingest = 0 WHERE id = 'srv-paris'").run()
  await tip(env, 'Tip text Alice at 12 Rue X')
  db.prepare("UPDATE cop_sessions SET is_public = 1 WHERE id = ?").run(SESSION)
  const list = (who) => cop(env, 'GET', `/api/cop/${SESSION}/submissions`, { who, handler: mod('submissions'), params: { id: SESSION } })
  const stranger = await list('attacker')
  assert.equal(stranger.status, 403)
  assert.equal((await stranger.text()).includes('Alice'), false)
  const viewer = await list('viewer')
  assert.equal(viewer.status, 200)
  assert.equal((await viewer.json()).submissions[0].submitter_contact, null)
  assert.equal((await list('editor')).status, 200)
})

test('the anonymous evidence form is never counted by address: nothing about the tipster reaches KV', async () => {
  const cache = fakeKv()
  let reached = 0
  for (let i = 0; i < 45; i++) {
    const request = new Request(`https://researchtools.test/api/surveys/public/${DROP_TOKEN}/drop-submit`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.99' }, body: '{}',
    })
    const res = await mod('apiMiddleware').onRequest({
      request, env: { CACHE: cache }, params: {}, data: {}, waitUntil() {}, next: async () => { reached++; return new Response('{}', { status: 201 }) },
    })
    assert.notEqual(res.status, 429)
  }
  assert.equal(reached, 45)
  assert.equal(cache.store.size, 0, [...cache.store.keys()].join(','))
})

test('the /api/surveys limiter keeps no raw client address in its KV keys', async () => {
  const cache = fakeKv()
  const request = new Request(`https://researchtools.test/api/surveys/public/${SURVEY_TOKEN}/submit`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.77' }, body: '{}',
  })
  await mod('apiMiddleware').onRequest({
    request, env: { CACHE: cache }, params: {}, data: {}, waitUntil() {}, next: async () => new Response('{}', { status: 201 }),
  })
  const keys = [...cache.store.keys()]
  assert.ok(keys.length > 0, 'the limiter counted the request')
  for (const key of keys) assert.equal(key.includes('203.0.113.77'), false, key)
})
