/**
 * Anonymous input in the COP → chat feed (second security review of feat/cop-chat-feed):
 * - A tip's title comes only from the form's summary field or a long-text answer, never a
 *   short field (whatever its label says, in any language); ingest records `title_safe`,
 *   and any drop-form row without it (every tip ingested before) has title null and no
 *   domain in the feed, its marker and filings too. Built-in templates still title tips.
 * - Hosts in any script and IPv4 hosts lose their paths; unreviewed anonymous text has its
 *   hosts defanged ("signal-help[.]example") and no domain.
 * - An answer is "from chat" only from the Signal bot; another integration's is
 *   "automated", actor system.
 * - At most CHAT_ANONYMOUS_PER_HOUR anonymous tips and answers per COP per rolling hour
 *   carry text, however the feed is paged; the rest are counted in summary items.
 *
 * Run: npm run test:unit
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  call, ENTRIES, fixture, migration, mod, SESSION, setupCoreSuite, WS,
} from './cop-core-harness.mjs'

Object.assign(ENTRIES, {
  chatFeed: 'functions/api/cop/[id]/chat-feed.ts',
  chatFeedLib: 'functions/api/_shared/cop-chat-feed.ts',
  copIngest: 'functions/api/_shared/cop-ingest.ts',
  dropSubmit: 'functions/api/surveys/public/[token]/drop-submit.ts',
  surveyTemplates: 'src/lib/survey-templates.ts',
  formBuilder: 'src/lib/research-form-builder.ts',
})
setupCoreSuite()

const P = `/api/cop/${SESSION}`
const S = { id: SESSION }
const SHARE = '77777777-0000-4000-8000-000000000001'
const SHARE_2 = '77777777-0000-4000-8000-000000000002'
const DROP = 'drop-anonymous'
const OTHER_SERVICE_USER = 74

async function anonFixture() {
  const f = await fixture()
  const { db } = f
  db.exec(migration('0023_cop_tags_uploads.sql'))
  db.exec(migration('0024_cop_evidence_links.sql'))
  db.exec(migration('0025_cop_upload_documents.sql'))
  db.exec(migration('0026_cop_evidence_link_votes.sql'))
  db.exec(migration('0028_cop_share_answer_slots.sql'))
  db.exec(`UPDATE cop_rfis SET is_key = 1 WHERE cop_session_id = '${SESSION}'`)
  const share = db.prepare('INSERT INTO cop_shares (id, cop_session_id, share_token, visible_panels, allow_rfi_answers) VALUES (?, ?, ?, ?, 1)')
  share.run('sh-a1', SESSION, SHARE, '["map","rfi"]')
  share.run('sh-a2', SESSION, SHARE_2, '["map","rfi"]')
  return f
}

const feed = async (env, since, { limit } = {}) => {
  const query = new URLSearchParams({ since: since ?? '', ...(limit ? { limit: String(limit) } : {}) })
  const res = await call(env, 'chatFeed', 'GET', `${P}/chat-feed?${query}`, { who: 'service', through: 'middleware', params: S })
  const text = await res.text()
  assert.equal(res.status, 200, text)
  return { ...JSON.parse(text), text }
}
const start = async (env) => (await feed(env, '')).cursor
/** Every page from `cursor` on, `limit` items a page. */
async function readAll(env, cursor, limit) {
  const items = []
  let text = ''
  for (let i = 0; i < 100; i += 1) {
    const page = await feed(env, cursor, { limit })
    items.push(...page.items)
    text += page.text
    cursor = page.cursor
    if (!page.has_more) return { items, text, cursor }
  }
  throw new Error('the feed never ended')
}
const publicAnswer = (env, text, { share = SHARE, ip = '203.0.113.7', rfi = 'rfi-existing' } = {}) =>
  call(env, 'publicAnswers', 'POST', `/api/cop/public/${share}/rfis/${rfi}/answers`, {
    who: 'anonymous', params: { token: share, rfiId: rfi }, body: { answer_text: text }, headers: { 'CF-Connecting-IP': ip },
  })
function seedForm(db, schema) {
  db.prepare(`INSERT INTO survey_drops (id, title, form_schema, share_token, status, cop_session_id, workspace_id, created_by, intent, auto_ingest)
    VALUES ('drop-a', 'Tips', ?, ?, 'active', ?, ?, 1, 'drop', 1)`).run(JSON.stringify(schema), DROP, SESSION, WS)
}
const submit = async (env, formData) => {
  const res = await call(env, 'dropSubmit', 'POST', `/api/surveys/public/${DROP}/drop-submit`, {
    who: 'anonymous', params: { token: DROP }, body: { form_data: formData },
  })
  const body = await res.json()
  assert.equal(body.ok, true, JSON.stringify(body))
  return body
}
const metadataOf = (db, id) => JSON.parse(db.prepare('SELECT metadata FROM evidence_items WHERE id = ?').get(Number(id)).metadata)

// ── 1. Tip titles: an allow-list of fields ───────────────────────

test('a form of two short fields: the tip is "Anonymous tip" and has no title in the feed', async () => {
  const { db, env } = await anonFixture()
  // "latest" contains "lat", so the old word list skipped the real question and titled the
  // tip with the tipster's handle.
  seedForm(db, [
    { name: 'incident', label: 'Describe the latest incident', type: 'text' },
    { name: 'handle', label: 'Your handle (optional)', type: 'text' },
  ])
  const cursor = await start(env)
  const tip = await submit(env, { incident: 'Vans at gate B', handle: '@jo_bloggs' })
  const id = tip.ingested.evidence_id
  assert.equal(db.prepare('SELECT title FROM evidence_items WHERE id = ?').get(Number(id)).title, 'Anonymous tip')
  assert.equal(metadataOf(db, id).title_safe, false)
  const page = await feed(env, cursor)
  assert.deepEqual(page.items.map((i) => [i.kind, i.title, i.labels, i.domain]), [['evidence', null, ['anonymous tip', 'unverified'], undefined]])
  assert.ok(!page.text.includes('jo_bloggs'))
})

test('no short field names a tip, whatever its label; the summary field or a long-text answer does', () => {
  const { tipTitle, parseFormSchema } = mod('copIngest')
  const labels = ['Callsign', 'Reach me at', 'Who are you?', 'Discord or Matrix', 'Your unit', 'MGRS grid', 'Nombre', 'Teléfono', 'Kontakt', 'Ім\'я', 'Describe the latest incident']
  const schema = parseFormSchema(JSON.stringify(labels.map((label, i) => ({ name: `f${i}`, label, type: 'text' }))))
  const answers = Object.fromEntries(labels.map((label, i) => [`f${i}`, `answer to ${label}`]))
  assert.deepEqual(tipTitle(answers, schema), { title: 'Anonymous tip', safe: false })

  // A long-text answer names it, wherever it is in the form.
  const withLong = parseFormSchema([...schema, { name: 'story', label: 'Describe the latest incident', type: 'textarea' }])
  assert.deepEqual(tipTitle({ ...answers, story: 'Two vans\nat gate B' }, withLong), { title: 'Tip: Two vans at gate B', safe: true })
  assert.deepEqual(tipTitle({ ...answers, story: '   ' }, withLong), { title: 'Anonymous tip', safe: false })

  // A field the form marks as its summary comes first (text or long text only).
  const marked = parseFormSchema(JSON.stringify([
    { name: 'mail', label: 'Email', type: 'email', summary: true },
    { name: 'story', label: 'Details', type: 'textarea' },
    { name: 'headline', label: 'Headline', type: 'text', summary: true },
  ]))
  assert.deepEqual(marked.map((f) => f.summary === true), [true, false, true])
  assert.deepEqual(tipTitle({ mail: 'jo@example.test', story: 'Long story', headline: 'Bridge closed' }, marked), { title: 'Tip: Bridge closed', safe: true })
  assert.deepEqual(tipTitle({ mail: 'jo@example.test', story: 'Long story' }, marked), { title: 'Tip: Long story', safe: true })
  assert.equal(parseFormSchema([{ name: 'x', type: 'text', summary: 'yes' }])[0].summary, undefined)
})

test('a tip ingested before title_safe (titled "Tip: John Smith") has no title or domain, its marker and filing neither', async () => {
  const { db, env } = await anonFixture()
  db.exec(`
    INSERT INTO evidence_items (id, title, description, source_url, evidence_type, credibility, reliability, workspace_id, created_by, cop_session_id, source_channel, metadata)
      VALUES (9001, 'Tip: John Smith', 'Your name: John Smith', 'https://john-smith.example/profile', 'observation', 'unverified', 'unknown', '${WS}', 1, '${SESSION}', 'drop', '{"survey_id":"drop-old","response_id":"r-old"}');
    INSERT INTO cop_markers (id, cop_session_id, uid, lat, lon, label, workspace_id, created_by, confidence, source_type, source_id, source_channel)
      VALUES ('mk-old', '${SESSION}', 'uid-old', 48.85, 2.35, 'Tip: John Smith', '${WS}', 1, 'POSSIBLE', 'EVIDENCE', '9001', 'drop');
    INSERT INTO cop_evidence_links (id, cop_session_id, evidence_id, target_type, target_id, relation, created_by)
      VALUES ('evl-old', '${SESSION}', '9001', 'rfi', 'rfi-existing', 'supports', 1);
  `)
  const cursor = await start(env)
  const event = db.prepare('INSERT INTO cop_events (id, cop_session_id, event_type, entity_type, entity_id, payload, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)')
  event.run('evt-old-1', SESSION, 'evidence.linked', 'evidence', '9001', '{"link_id":"evl-old","target_type":"rfi","via":"tip"}', 0)
  event.run('evt-old-2', SESSION, 'evidence.linked', 'rfi', 'rfi-existing', '{"link_id":"evl-old","target_type":"rfi","via":"tip"}', 0)
  event.run('evt-old-3', SESSION, 'marker.updated', 'marker', 'mk-old', '{}', 2)
  let page = await feed(env, cursor)
  assert.deepEqual(page.items.map((i) => [i.kind, i.title, i.domain]), [['evidence_link', null, undefined], ['marker', null, undefined]])
  assert.ok(!/john/i.test(page.text), page.text)

  // Reviewed later, still no mark: still no title or domain.
  db.exec("UPDATE evidence_items SET credibility = 'probable' WHERE id = 9001")
  event.run('evt-old-4', SESSION, 'evidence.updated', 'evidence', '9001', '{}', 2)
  page = await feed(env, page.cursor)
  assert.deepEqual(page.items.map((i) => [i.kind, i.title, i.domain, i.labels]), [['evidence', null, undefined, ['anonymous tip', 'reviewed']]])
  assert.ok(!/john/i.test(page.text), page.text)
})

test('every built-in template still titles a tip, and from the field that describes it', async () => {
  const { tipTitle, parseFormSchema } = mod('copIngest')
  const { SURVEY_TEMPLATES } = mod('surveyTemplates')
  const { FORM_TEMPLATES, buildSurveyPayload } = mod('formBuilder')
  const schemas = [
    ...SURVEY_TEMPLATES.map((t) => [t.id, t.fields]),
    ...FORM_TEMPLATES.map((t) => [t.id, buildSurveyPayload({ title: t.name, description: '', access_level: 'public', password: '', fields: t.fields }).form_schema]),
  ]
  assert.ok(schemas.length >= 13)
  for (const [id, fields] of schemas) {
    const schema = parseFormSchema(JSON.stringify(fields))
    const answers = Object.fromEntries(schema.map((f) => [f.name, `${f.type} answer for ${f.label}`]))
    const tip = tipTitle(answers, schema)
    assert.equal(tip.safe, true, id)
    assert.match(tip.title, /^Tip: textarea answer for /, id)
  }

  // End to end: the Tip Line template, as a tipster fills it.
  const { db, env } = await anonFixture()
  seedForm(db, SURVEY_TEMPLATES.find((t) => t.id === 'tip-line').fields)
  const cursor = await start(env)
  const tip = await submit(env, { report: 'Convoy of six trucks heading north', source_url: 'https://news.example/convoy/1' })
  assert.equal(metadataOf(db, tip.ingested.evidence_id).title_safe, true)
  const page = await feed(env, cursor)
  assert.deepEqual(page.items.map((i) => [i.kind, i.title, i.domain]), [['evidence', 'Convoy of six trucks heading north', undefined]])
})

// ── 4. Hosts in any script; defanged while unreviewed ────────────

test('hosts in any script and IPv4 hosts lose their paths; defanging marks every host', () => {
  const { chatLine } = mod('chatFeedLib')
  const cases = [
    ['see пример.рф/secret-path now', 'see пример.рф now'],
    ['пример.com/secret-path', 'пример.com'],
    ['example.xn--p1ai/secret-path', 'example.xn--p1ai'],
    ['i❤.ws/secret-path', 'i❤.ws'],
    ['i❤️.ws/secret-path', 'i❤.ws'],
    ['10.0.0.1:8080/x', '10.0.0.1'],
    ['go to 192.0.2.44/admin?k=1', 'go to 192.0.2.44'],
    ['evil.example\\secret', 'evil.example'],
    ['evil.example／secret', 'evil.example'],
    ['rated 3.5/5, e.g./i.e. fine', 'rated 3.5/5, e.g./i.e. fine'],
    ['https://пример.рф/secret-path', 'xn--e1afmkfd.xn--p1ai'],
  ]
  for (const [input, expected] of cases) assert.equal(chatLine(input), expected, JSON.stringify(input))
  assert.equal(chatLine('Help at signal-help.example and 10.0.0.1, rated 3.5', { defang: true }), 'Help at signal-help[.]example and 10[.]0[.]0[.]1, rated 3.5')
  assert.equal(chatLine('see пример.рф/secret-path', { defang: true }), 'see пример[.]рф')
})

test('an unreviewed anonymous answer has its hosts defanged; once accepted they read plainly', async () => {
  const { env } = await anonFixture()
  const cursor = await start(env)
  const res = await publicAnswer(env, 'Verify your account at signal-help.example/verify or пример.рф/x')
  assert.equal(res.status, 201)
  const answerId = (await res.json()).id
  const page = await feed(env, cursor)
  assert.deepEqual(page.items.map((i) => [i.kind, i.title, i.domain]), [
    ['answer', 'Verify your account at signal-help[.]example or пример[.]рф', undefined],
  ])
  assert.ok(!page.text.includes('signal-help.example'))
  const accepted = await call(env, 'rfiAnswers', 'PUT', `${P}/rfis/rfi-existing/answers`, {
    who: 'owner', params: { ...S, rfiId: 'rfi-existing' }, body: { answer_id: answerId, is_accepted: true },
  })
  assert.equal(accepted.status, 200)
  const after = await feed(env, page.cursor)
  assert.equal(after.items.find((i) => i.kind === 'answer').title, 'Verify your account at signal-help.example or пример.рф')
})

// ── 6. "from chat" is the Signal bot only ────────────────────────

test('an answer from another integration is "automated", actor system; never "from chat"', async () => {
  const { db, env } = await anonFixture()
  db.exec(`
    INSERT INTO users (id, username, email, full_name, hashed_password, role)
      VALUES (${OTHER_SERVICE_USER}, 'service_osint-importer-prod', 'service+osint-importer-prod@service.invalid', 'Integration Service', 'SERVICE_AUTH_DISABLED', 'service');
    INSERT INTO workspaces (id, type, owner_id, is_public) VALUES ('workspace-osint', 'TEAM', ${OTHER_SERVICE_USER}, 0);
    INSERT INTO investigations (id, workspace_id, created_by, status) VALUES ('investigation-osint', 'workspace-osint', ${OTHER_SERVICE_USER}, 'active');
    INSERT INTO integration_clients (id, community_id, workspace_id, intake_investigation_id, principal_user_id, environment, maximum_visibility, status)
      VALUES ('osint-importer-prod', 'community-test', 'workspace-osint', 'investigation-osint', ${OTHER_SERVICE_USER}, 'production', 'community', 'active');
    INSERT INTO cop_rfi_answers (id, rfi_id, answer_text, is_accepted, created_by) VALUES ('rfa-osint', 'rfi-existing', 'Imported: gate B closed', 0, ${OTHER_SERVICE_USER});
  `)
  const cursor = await start(env)
  db.prepare("INSERT INTO cop_events (id, cop_session_id, event_type, entity_type, entity_id, payload, created_by) VALUES ('evt-osint', ?, 'rfi.answered', 'rfi', 'rfi-existing', '{\"answer_id\":\"rfa-osint\"}', ?)")
    .run(SESSION, OTHER_SERVICE_USER)
  for (const who of ['service', 'owner']) {
    const res = await call(env, 'chatFeed', 'GET', `${P}/chat-feed?since=${cursor}`, { who, params: S, through: who === 'service' ? 'middleware' : undefined })
    const page = await res.json()
    assert.deepEqual(page.items.map((i) => [i.kind, i.title, i.labels, i.actor]), [
      ['answer', 'Imported: gate B closed', ['automated', 'key question'], 'system'],
    ], who)
  }
})

// ── 7. At most 20 anonymous items with text per COP per hour ─────

test('at most 20 anonymous answers an hour carry text, however the feed is paged; the hour rolls', async () => {
  const { db, env } = await anonFixture()
  const { CHAT_ANONYMOUS_PER_HOUR } = mod('chatFeedLib')
  assert.equal(CHAT_ANONYMOUS_PER_HOUR, 20)
  const cursor = await start(env)
  for (let i = 1; i <= 25; i += 1) {
    const res = await publicAnswer(env, `Answer ${i}`, { share: i <= 13 ? SHARE : SHARE_2, ip: `198.51.100.${i}` })
    assert.equal(res.status, 201, await res.clone().text())
  }
  // Three items a page: never more than 3 anonymous in a page, so only the hourly cap applies.
  let all = await readAll(env, cursor, 3)
  const shown = all.items.filter((i) => i.kind === 'answer').map((i) => i.title)
  assert.deepEqual(shown, Array.from({ length: 20 }, (_, i) => `Answer ${i + 1}`))
  const summaries = all.items.filter((i) => i.kind === 'summary')
  assert.equal(summaries.reduce((n, s) => n + s.count, 0), 5)
  for (const n of [21, 22, 23, 24, 25]) assert.ok(!all.text.includes(`Answer ${n}"`), `Answer ${n}`)

  // The first ten arrived two hours ago: then no hour holds more than 15, and all carry text.
  const first10 = db.prepare("SELECT rowid AS seq FROM cop_events WHERE cop_session_id = ? AND event_type = 'rfi.answered' ORDER BY rowid LIMIT 10").all(SESSION)
  for (const { seq } of first10) db.prepare("UPDATE cop_events SET created_at = datetime('now', '-2 hours') WHERE rowid = ?").run(seq)
  all = await readAll(env, cursor, 3)
  assert.equal(all.items.filter((i) => i.kind === 'answer' && i.title).length, 25)
  assert.equal(all.items.filter((i) => i.kind === 'summary').length, 0)
})

test('past 20 tips in an hour, a tip carries no text: not its evidence, marker or filing', async () => {
  const { db, env } = await anonFixture()
  db.prepare(`INSERT INTO survey_drops (id, title, form_schema, share_token, status, cop_session_id, workspace_id, created_by, intent, auto_ingest, question_picker)
    VALUES ('drop-cap', 'Tips', ?, ?, 'active', ?, ?, 1, 'drop', 1, 1)`)
    .run(JSON.stringify([{ name: 'what', label: 'What did you see?', type: 'textarea' }, { name: 'spot', label: 'Spot', type: 'geopoint' }]), DROP, SESSION, WS)
  const cursor = await start(env)
  for (let i = 1; i <= 22; i += 1) {
    await submit(env, { what: `Tip number ${i}`, spot: `48.8${i % 10},2.3${i % 10}`, _questions: [{ id: 'rfi-existing' }] })
  }
  // Each tip is three items (evidence, marker, filing): three a page keeps one tip a page.
  const all = await readAll(env, cursor, 3)
  const titled = (kind) => all.items.filter((i) => i.kind === kind && i.title).map((i) => i.title)
  const expected = Array.from({ length: 20 }, (_, i) => `Tip number ${i + 1}`)
  assert.deepEqual(titled('evidence'), expected)
  assert.deepEqual(titled('marker'), expected)
  assert.deepEqual(titled('evidence_link'), expected)
  assert.equal(all.items.filter((i) => i.kind === 'summary').reduce((n, s) => n + s.count, 0), 2)
  assert.ok(!all.text.includes('Tip number 21') && !all.text.includes('Tip number 22'))
})
