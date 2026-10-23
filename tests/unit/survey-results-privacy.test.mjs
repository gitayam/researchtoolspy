/**
 * Public survey results (GET /api/surveys/public/:token/results) never cover tips.
 *
 * - An anonymous tip form (intent 'drop') or any form linked to a COP answers exactly
 *   as an unknown token does — same status, body and headers — whether active or not:
 *   its token travels on every share link of the COP, and its submissions are the
 *   team's to review.
 * - An ordinary survey keeps its public results.
 * - The tip form's submitted screen offers no "View all responses"; a survey's does.
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

Object.assign(ENTRIES, { surveyResults: 'functions/api/surveys/public/[token]/results.ts' })
setupInputSuite(['serviceAuth', 'surveyResults'])

let ui
before(async () => {
  const dir = mkdtempSync(join(tmpdir(), 'rt-survey-results-ui-'))
  try {
    const outfile = join(dir, 'ui.mjs')
    await build({
      stdin: {
        contents: [
          "export { SubmittedScreen } from '@/components/cop/PublicIntakeForm'",
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

async function resultsFixture() {
  const f = await fixture()
  f.db.exec(`
    INSERT INTO survey_drops (id, title, form_schema, share_token, status, intent, cop_session_id, workspace_id, created_by) VALUES
      ('srv-plain', 'Town poll', '[{"name":"q","type":"select","label":"Q","options":["a","b"]}]', '${PLAIN}', 'active', 'survey', NULL, 'ws-owner', 1),
      ('srv-drop-unlinked', 'Tip line', '[]', '${PLAIN_DROP}', 'active', 'drop', NULL, 'ws-owner', 1);
    INSERT INTO survey_responses (id, survey_id, form_data, status) VALUES
      ('r-plain', 'srv-plain', '{"q":"a"}', 'pending'),
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

test('an ordinary survey keeps its public results', async () => {
  const { env } = await resultsFixture()
  const res = await results(env, PLAIN)
  assert.equal(res.status, 200)
  const body = JSON.parse(res.body)
  assert.equal(body.title, 'Town poll')
  assert.deepEqual(body.results.map((r) => r.id), ['r-plain'])
  assert.deepEqual(body.stats.distributions, { q: { a: 1 } })
})

test('the tip form\'s submitted screen offers no "View all responses"; a survey\'s does', () => {
  const screen = (isDropMode) => ui.renderToStaticMarkup(ui.createElement(ui.SubmittedScreen, {
    token: 't', successMessage: null, showResultsLink: ui.offersPublicResults(isDropMode), onSubmitAnother: () => {},
  }))
  const tip = screen(true)
  assert.match(tip, /Thank you/)
  assert.match(tip, /Submit another response/)
  assert.doesNotMatch(tip, /View all responses/)
  assert.match(screen(false), /View all responses/)
})
