/**
 * SWOT auto-populate, starbursting and starbursting question generation read
 * content_analysis rows by id. Each must return only the caller's own rows, as
 * ach/from-content-intelligence and dime-analyze already do: an analysis holds
 * the full extracted text of whatever its owner submitted.
 *
 * The real handlers are bundled with esbuild and run against node:sqlite behind
 * a minimal D1 shim. The caller is resolved through the real requireAuth (a
 * Bearer token found in a fake SESSIONS store).
 *
 * Run: node --test tests/unit/
 */
import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build } from 'esbuild'

const ROOT = new URL('../../', import.meta.url).pathname
const HANDLERS = {
  swot: 'functions/api/frameworks/swot-auto-populate.ts',
  starbursting: 'functions/api/content-intelligence/starbursting.ts',
  generateQuestions: 'functions/api/content-intelligence/starbursting/[id]/generate-questions.ts',
}
const mods = {}

before(async () => {
  const dir = mkdtempSync(join(tmpdir(), 'rt-owner-scope-'))
  try {
    for (const [name, entry] of Object.entries(HANDLERS)) {
      const outfile = join(dir, `${name}.mjs`)
      await build({
        entryPoints: [join(ROOT, entry)],
        bundle: true,
        format: 'esm',
        platform: 'node',
        target: 'es2022',
        outfile,
        logLevel: 'silent',
      })
      mods[name] = await import(outfile)
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

/** The D1 surface these handlers use: prepare().bind().all()/first()/run(). */
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
      return { success: true, meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } }
    },
  })
  return { prepare: (sql) => statement(sql) }
}

const LONG_TEXT = Array.from({ length: 200 }, (_, i) => `word${i}`).join(' ')

function fixture() {
  const db = new DatabaseSync(':memory:')
  db.exec(`
    CREATE TABLE users (id INTEGER PRIMARY KEY, user_hash TEXT);
    CREATE TABLE content_analysis (
      id INTEGER PRIMARY KEY, user_id INTEGER, url TEXT, title TEXT, summary TEXT,
      extracted_text TEXT, entities TEXT, keyphrases TEXT, top_phrases TEXT,
      publish_date TEXT, author TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE framework_sessions (
      id INTEGER PRIMARY KEY, user_id INTEGER, title TEXT, data TEXT, framework_type TEXT,
      updated_at TEXT
    );
    INSERT INTO users (id, user_hash) VALUES (1, 'hash-alice-0000000000'), (2, 'hash-bob-00000000000');
  `)
  const analysis = db.prepare(
    `INSERT INTO content_analysis (id, user_id, url, title, summary, extracted_text, entities)
     VALUES (?, ?, ?, ?, ?, ?, '{}')`,
  )
  analysis.run(10, 1, 'https://a.example/1', 'Alice article', 'alice summary', LONG_TEXT)
  analysis.run(20, 2, 'https://b.example/1', 'Bob private article', 'bob summary', LONG_TEXT)
  db.prepare(
    `INSERT INTO framework_sessions (id, user_id, title, data, framework_type) VALUES (?, ?, ?, ?, 'starbursting')`,
  ).run(5, 1, 'Alice session', JSON.stringify({ content_analysis_id: 20 }))

  const sessions = new Map([['session-alice', JSON.stringify({ user_id: 1 })]])
  const env = { DB: d1(db), SESSIONS: { get: async (k) => sessions.get(k) ?? null } }
  return { env }
}

function post(path, body) {
  return new Request(`https://researchtools.test${path}`, {
    method: 'POST',
    headers: { Authorization: 'Bearer session-alice', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const call = (mod, request, env, params = {}) =>
  mod.onRequestPost({ request, env, params, waitUntil() {}, next() {}, data: {} })

test('SWOT auto-populate refuses another user’s analysis', async () => {
  const { env } = fixture()
  const res = await call(mods.swot, post('/api/frameworks/swot-auto-populate', { contentIds: [20] }), env)
  assert.equal(res.status, 404)
  assert.doesNotMatch(await res.text(), /Bob private article|bob summary/)
})

test('SWOT auto-populate still reads the caller’s own analysis', async () => {
  const { env } = fixture()
  const res = await call(mods.swot, post('/api/frameworks/swot-auto-populate', { contentIds: [10] }), env)
  assert.notEqual(res.status, 404, 'own analysis is found (later steps may fail without an AI key)')
})

test('starbursting refuses another user’s analysis, even mixed with the caller’s own', async () => {
  const { env } = fixture()
  const foreign = await call(mods.starbursting, post('/api/content-intelligence/starbursting', { analysis_ids: [20] }), env)
  assert.equal(foreign.status, 404)
  assert.doesNotMatch(await foreign.text(), /Bob private article|bob summary/)

  const mixed = await call(mods.starbursting, post('/api/content-intelligence/starbursting', { analysis_ids: [10, 20] }), env)
  assert.doesNotMatch(await mixed.text(), /Bob private article|bob summary|b\.example/)
})

test('starbursting question generation won’t read another user’s analysis through session data', async () => {
  const { env } = fixture()
  const res = await call(
    mods.generateQuestions,
    post('/api/content-intelligence/starbursting/5/generate-questions', {}),
    env,
    { id: '5' },
  )
  assert.equal(res.status, 404)
  assert.doesNotMatch(await res.text(), /Bob private article|bob summary/)
})
