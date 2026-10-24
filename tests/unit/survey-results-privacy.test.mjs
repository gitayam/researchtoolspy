/**
 * Public survey results (GET /api/surveys/public/:token/results) never cover tips.
 *
 * - An anonymous tip form (intent 'drop') or any form linked to a COP answers exactly
 *   as an unknown token does — same status, body and headers — whether active or not:
 *   its token travels on every share link of the COP, and its submissions are the
 *   team's to review.
 * - An ordinary survey's public results are totals only (decision 2026-10-23: "Totals
 *   public, responses owner-only"): the count and per-option counts of choice and rating
 *   fields — no individual responses, free text, lat/lon, country or tags. Only values
 *   the form offers are counted. The form's own gates apply: internal → 404 like an
 *   unknown token, a password form needs X-Form-Password, an expired one is refused.
 * - The tip form's submitted screen offers no results; a survey's offers its totals,
 *   and its results view shows totals only (and doesn't break without responses).
 *
 * Run: npm run test:unit
 */
import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build } from 'esbuild'
import { DROP_TOKEN, ENTRIES, fixture, mod, publicCall, ROOT, setupInputSuite, SURVEY_TOKEN } from './cop-input-harness.mjs'

Object.assign(ENTRIES, {
  surveyResults: 'functions/api/surveys/public/[token]/results.ts',
  surveyDrops: 'functions/api/_shared/survey-drops.ts',
})
setupInputSuite(['serviceAuth', 'surveyResults', 'surveyDrops'])

let ui
before(async () => {
  const dir = mkdtempSync(join(tmpdir(), 'rt-survey-results-ui-'))
  try {
    const outfile = join(dir, 'ui.mjs')
    await build({
      stdin: {
        contents: [
          "export { SubmittedScreen, SurveyResultsSummary } from '@/components/cop/PublicIntakeForm'",
          "export { offersPublicResults } from '@/lib/tip-privacy'",
          "export { createElement } from 'react'",
          "export { renderToStaticMarkup } from 'react-dom/server'",
        ].join('\n'),
        resolveDir: ROOT,
        loader: 'ts',
      },
      bundle: true, format: 'esm', platform: 'node', target: 'es2022', outfile,
      tsconfig: join(ROOT, 'tsconfig.app.json'), jsx: 'automatic', logLevel: 'silent',
      loader: { '.css': 'empty' },
      // react-dom/server is CommonJS and requires Node built-ins.
      banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
    })
    ui = await import(outfile)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

const PLAIN = 'survey-token-plain'
const PLAIN_DROP = 'drop-token-unlinked'

const POLL_SCHEMA = JSON.stringify([
  { name: 'q', type: 'select', label: 'Q', options: ['a', 'b'] },
  { name: 'many', type: 'multiselect', label: 'Many', options: ['x', 'y', 'z'] },
  { name: 'stars', type: 'rating', label: 'Stars', min: 1, max: 5 },
  { name: 'why', type: 'textarea', label: 'Why?' },
]).replace(/'/g, "''")

async function resultsFixture() {
  const f = await fixture()
  f.db.exec(`
    INSERT INTO survey_drops (id, title, form_schema, share_token, status, intent, cop_session_id, workspace_id, created_by, submission_count) VALUES
      ('srv-plain', 'Town poll', '${POLL_SCHEMA}', '${PLAIN}', 'active', 'survey', NULL, 'ws-owner', 1, 3),
      ('srv-drop-unlinked', 'Tip line', '[]', '${PLAIN_DROP}', 'active', 'drop', NULL, 'ws-owner', 1, 0);
    INSERT INTO survey_responses (id, survey_id, form_data, status, lat, lon, submitter_country) VALUES
      ('r-plain', 'srv-plain', '{"q":"a","many":"x,y","stars":"4","why":"Because of Alice Example at 12 Main St","_tags":["alice-tag"]}', 'pending', 35.1234, -79.5678, 'US'),
      ('r-plain-2', 'srv-plain', '{"q":"a","many":"y","stars":"5","why":"secret free text"}', 'accepted', NULL, NULL, 'FR'),
      ('r-plain-3', 'srv-plain', '{"q":"I typed this myself","many":"y,not-an-option","stars":"11"}', 'accepted', NULL, NULL, 'DE'),
      ('r-plain-rej', 'srv-plain', '{"q":"b"}', 'rejected', NULL, NULL, NULL);
    INSERT INTO survey_responses (id, survey_id, form_data, status) VALUES
      ('r-tip', 'srv-paris', '{"what":"Crowd at the gate"}', 'pending'),
      ('r-tip2', 'srv-drop-unlinked', '{"what":"Unlinked tip"}', 'pending'),
      ('r-cop-survey', 'srv-survey', '{"what":"COP survey answer"}', 'pending');
  `)
  return f
}

const results = async (env, token) => {
  const res = await publicCall(env, mod('surveyResults'), 'GET', `/api/surveys/public/${token}/results`, { params: { token } })
  return { status: res.status, body: await res.text(), headers: [...res.headers.entries()].sort() }
}

test('a tip form or a COP-linked form answers exactly like an unknown token, active or not', async () => {
  const { db, env } = await resultsFixture()
  const unknown = await results(env, 'no-such-token')
  assert.equal(unknown.status, 404)
  // srv-paris: drop + COP-linked; srv-survey: a survey linked to the COP; srv-drop-unlinked: a tip line on its own.
  for (const token of [DROP_TOKEN, SURVEY_TOKEN, PLAIN_DROP]) {
    assert.deepEqual(await results(env, token), unknown, token)
  }
  db.exec("UPDATE survey_drops SET status = 'closed' WHERE id IN ('srv-paris', 'srv-drop-unlinked')")
  for (const token of [DROP_TOKEN, PLAIN_DROP]) {
    assert.deepEqual(await results(env, token), unknown, `${token} (inactive)`)
  }
})

test('an ordinary survey\'s public results are totals only: no responses, free text, lat/lon, country or tags', async () => {
  const { env } = await resultsFixture()
  const res = await results(env, PLAIN)
  assert.equal(res.status, 200, res.body)
  const body = JSON.parse(res.body)
  assert.equal(body.title, 'Town poll')
  assert.equal(body.total, 3)
  assert.equal(body.counted, 3, 'the non-rejected responses counted')
  assert.equal('results' in body, false, 'no individual responses')
  assert.deepEqual(Object.keys(body.stats).sort(), ['distributions'])
  for (const leak of ['Alice', 'Main St', 'secret free text', 'I typed this myself', 'not-an-option', 'alice-tag', '35.12', '79.56', '"US"', '"FR"', 'lat', 'lon', 'country']) {
    assert.equal(res.body.includes(leak), false, `public results carry ${leak}`)
  }
  // Only values the form offers are counted (a select's free text and a rating of 11 are not).
  assert.deepEqual(body.stats.distributions, { q: { a: 2 }, many: { x: 1, y: 3 }, stars: { 4: 1, 5: 1 } })
  assert.deepEqual(body.fields.map((f) => f.name), ['q', 'many', 'stars'], 'only the counted fields are described')
})

test('the form\'s own gates apply: internal is unknown, a password is required, expired is refused', async () => {
  const { db, env } = await resultsFixture()
  const unknown = await results(env, 'no-such-token')
  db.prepare("UPDATE survey_drops SET access_level = 'internal' WHERE id = 'srv-plain'").run()
  assert.deepEqual(await results(env, PLAIN), unknown, 'internal: like an unknown token')

  const hash = await mod('surveyDrops').hashPassword('open sesame')
  db.prepare("UPDATE survey_drops SET access_level = 'password', password_hash = ? WHERE id = 'srv-plain'").run(hash)
  const withPassword = async (password) => {
    const res = await publicCall(env, mod('surveyResults'), 'GET', `/api/surveys/public/${PLAIN}/results`, {
      params: { token: PLAIN }, headers: password ? { 'X-Form-Password': password } : {},
    })
    return { status: res.status, body: await res.text(), cache: res.headers.get('Cache-Control') }
  }
  const none = await withPassword(null)
  assert.equal(none.status, 401)
  assert.doesNotMatch(none.body, /distributions/)
  assert.equal((await withPassword('wrong')).status, 401)
  const ok = await withPassword('open sesame')
  assert.equal(ok.status, 200)
  assert.deepEqual(JSON.parse(ok.body).stats.distributions.q, { a: 2 })
  assert.equal(ok.cache, 'no-store', 'a password form\'s totals are not cached')

  db.prepare("UPDATE survey_drops SET access_level = 'public', expires_at = ? WHERE id = 'srv-plain'").run(new Date(Date.now() - 60_000).toISOString())
  const expired = await results(env, PLAIN)
  assert.equal(expired.status, 403)
  assert.doesNotMatch(expired.body, /distributions/)
})

test('the tip form\'s submitted screen offers no results; a survey\'s offers its totals', () => {
  const screen = (isDropMode) => ui.renderToStaticMarkup(ui.createElement(ui.SubmittedScreen, {
    token: 't', successMessage: null, showResultsLink: ui.offersPublicResults(isDropMode), onSubmitAnother: () => {},
  }))
  const tip = screen(true)
  assert.match(tip, /Thank you/)
  assert.match(tip, /Submit another response/)
  assert.doesNotMatch(tip, /See the totals|View all responses/)
  assert.match(screen(false), /See the totals so far/)
})

test('the results view shows totals only, and doesn\'t break without individual responses', () => {
  const view = (results) => ui.renderToStaticMarkup(ui.createElement(ui.SurveyResultsSummary, { results, onSubmitAnother: () => {} }))
  const html = view({
    title: 'Town poll', total: 3, counted: 3,
    fields: [{ name: 'q', label: 'Q', type: 'select' }],
    stats: { distributions: { q: { a: 2, b: 1 } } },
  })
  assert.match(html, /Town poll/)
  assert.match(html, /3 responses/)
  assert.match(html, />Q</)
  assert.match(html, />a</)
  // A payload with nothing but the title still renders.
  assert.match(view({ title: 'Empty poll' }), /Empty poll/)
  // Even an older server's payload with responses and countries shows none of them.
  const old = view({ title: 'Old', total: 1, results: [{ id: 'r1', data: { q: 'Alice Example' }, country: 'US', created_at: '2026-10-23T10:00:00Z' }], fields: [{ name: 'q', label: 'Q', type: 'text' }], stats: { by_country: { US: 1 } } })
  assert.doesNotMatch(old, /Alice Example|By country|>US</)
})
