/**
 * POST /api/research/generate-plan.
 *
 * - A plan the model cut off at the token limit used to reach JSON.parse and come
 *   back as a bare 500. It is now a 502 that says what happened.
 * - The optional researchQuestionId from the request body used to be written to
 *   whatever row it named. The plan is now saved only into a question whose
 *   workspace the caller may edit.
 *
 * The real handler is bundled with esbuild and runs on node:sqlite behind a small
 * D1 shim; the caller is resolved through the real requireAuth (a Bearer token in
 * a fake SESSIONS store). OpenAI is a stubbed fetch: nothing leaves the machine.
 *
 * Run: npm run test:unit
 */
import { test, before, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build } from 'esbuild'

const ROOT = new URL('../../', import.meta.url).pathname
let handler
const realFetch = globalThis.fetch

before(async () => {
  const dir = mkdtempSync(join(tmpdir(), 'rt-generate-plan-'))
  try {
    const outfile = join(dir, 'generate-plan.mjs')
    await build({
      entryPoints: [join(ROOT, 'functions/api/research/generate-plan.ts')],
      bundle: true,
      format: 'esm',
      platform: 'node',
      target: 'es2022',
      outfile,
      logLevel: 'silent',
    })
    handler = await import(outfile)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

afterEach(() => {
  globalThis.fetch = realFetch
})

function d1(db) {
  const statement = (sql, args = []) => ({
    bind: (...next) => statement(sql, next),
    async all() {
      return { results: db.prepare(sql).all(...args), success: true }
    },
    async first(column) {
      const row = db.prepare(sql).get(...args) ?? null
      return column && row ? row[column] : row
    },
    async run() {
      const r = db.prepare(sql).run(...args)
      return { success: true, meta: { changes: Number(r.changes) } }
    },
  })
  return { prepare: (sql) => statement(sql) }
}

function fixture() {
  const db = new DatabaseSync(':memory:')
  db.exec(`
    CREATE TABLE workspaces (id TEXT PRIMARY KEY, owner_id INTEGER, is_public INTEGER DEFAULT 0);
    CREATE TABLE workspace_members (workspace_id TEXT, user_id INTEGER, role TEXT);
    CREATE TABLE research_questions (
      id TEXT PRIMARY KEY, user_id INTEGER, workspace_id TEXT, custom_edits TEXT, updated_at TEXT
    );
    INSERT INTO workspaces (id, owner_id) VALUES ('ws-alice', 1), ('ws-bob', 2);
    INSERT INTO research_questions (id, user_id, workspace_id, custom_edits)
      VALUES ('rq-alice', 1, 'ws-alice', NULL), ('rq-bob', 2, 'ws-bob', 'bob original');
  `)
  const sessions = new Map([['session-alice', JSON.stringify({ user_id: 1 })]])
  const env = {
    DB: d1(db),
    SESSIONS: { get: async (k) => sessions.get(k) ?? null },
    OPENAI_API_KEY: 'test-key-not-real',
  }
  return { db, env }
}

/** Answer every OpenAI call with this completion. */
function stubOpenAI(choice) {
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ id: 'x', choices: [choice], usage: {} }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
}

const PLAN = JSON.stringify({ methodology: { approach: 'Qualitative', design: 'Case study' } })
const fiveWs = {
  who: { population: 'operators' },
  what: { variables: 'latency' },
  where: { location: 'field' },
  when: { timePeriod: '2026' },
  why: { importance: 'safety' },
}

function post(body) {
  return new Request('https://researchtools.test/api/research/generate-plan', {
    method: 'POST',
    headers: { Authorization: 'Bearer session-alice', 'Content-Type': 'application/json' },
    body: JSON.stringify({ researchQuestion: 'Does X reduce Y?', fiveWs, ...body }),
  })
}

const call = (request, env) =>
  handler.onRequestPost({ request, env, params: {}, waitUntil() {}, next() {}, data: {} })

test('a plan cut off at the token limit is a clear 502, not a bare 500', async () => {
  const { env } = fixture()
  stubOpenAI({ finish_reason: 'length', message: { role: 'assistant', content: '{"methodology": {"appro' } })
  const res = await call(post({}), env)
  assert.equal(res.status, 502)
  assert.match((await res.json()).error, /too long/)
})

test('a complete plan is returned', async () => {
  const { env } = fixture()
  stubOpenAI({ finish_reason: 'stop', message: { role: 'assistant', content: PLAN } })
  const res = await call(post({}), env)
  assert.equal(res.status, 200)
  assert.equal((await res.json()).plan.methodology.approach, 'Qualitative')
})

test('the plan is not saved into another user’s research question', async () => {
  const { db, env } = fixture()
  stubOpenAI({ finish_reason: 'stop', message: { role: 'assistant', content: PLAN } })
  const res = await call(post({ researchQuestionId: 'rq-bob' }), env)
  assert.equal(res.status, 200, 'the caller still gets their plan')
  const row = db.prepare("SELECT custom_edits FROM research_questions WHERE id = 'rq-bob'").get()
  assert.equal(row.custom_edits, 'bob original')
})

test('the plan is saved into the caller’s own research question', async () => {
  const { db, env } = fixture()
  stubOpenAI({ finish_reason: 'stop', message: { role: 'assistant', content: PLAN } })
  await call(post({ researchQuestionId: 'rq-alice' }), env)
  const row = db.prepare("SELECT custom_edits FROM research_questions WHERE id = 'rq-alice'").get()
  assert.match(row.custom_edits, /generatedPlan/)
})
