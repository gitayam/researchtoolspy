/**
 * POST /api/cop/sessions takes the session's workspace (X-Workspace-ID or
 * ?workspace_id) and a team_workspace_id from the request. The session's
 * workspace is where its entities live and what verifyCopSessionAccess grants;
 * a team workspace lists the session. Naming a workspace the caller cannot edit
 * must be refused.
 *
 * The real handler is bundled with esbuild and runs on node:sqlite behind a small
 * D1 shim; the caller is resolved through the real auth helpers (a Bearer token in
 * a fake SESSIONS store).
 *
 * Run: npm run test:unit
 */
import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build } from 'esbuild'

const ROOT = new URL('../../', import.meta.url).pathname
let handler

before(async () => {
  const dir = mkdtempSync(join(tmpdir(), 'rt-cop-sessions-'))
  try {
    const outfile = join(dir, 'sessions.mjs')
    await build({
      entryPoints: [join(ROOT, 'functions/api/cop/sessions.ts')],
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
    CREATE TABLE workspaces (
      id TEXT PRIMARY KEY, name TEXT, description TEXT, type TEXT, owner_id INTEGER,
      is_public INTEGER DEFAULT 0, created_at TEXT, updated_at TEXT
    );
    CREATE TABLE workspace_members (workspace_id TEXT, user_id INTEGER, role TEXT);
    CREATE TABLE cop_collaborators (cop_session_id TEXT, user_id INTEGER);
    CREATE TABLE cop_sessions (
      id TEXT PRIMARY KEY, name TEXT, description TEXT, template_type TEXT, status TEXT,
      bbox_min_lat REAL, bbox_min_lon REAL, bbox_max_lat REAL, bbox_max_lon REAL,
      center_lat REAL, center_lon REAL, zoom_level INTEGER,
      time_window_start TEXT, time_window_end TEXT, rolling_hours INTEGER,
      active_layers TEXT, layer_config TEXT, linked_frameworks TEXT, key_questions TEXT,
      event_type TEXT, event_description TEXT, event_facts TEXT, content_analyses TEXT,
      workspace_id TEXT, created_by INTEGER, is_public INTEGER, team_workspace_id TEXT,
      created_at TEXT, updated_at TEXT
    );
    INSERT INTO workspaces (id, owner_id) VALUES ('ws-alice', 1), ('ws-bob', 2), ('ws-team', 2);
    INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ('ws-team', 1, 'VIEWER');
  `)
  const sessions = new Map([['session-alice', JSON.stringify({ user_id: 1 })]])
  return {
    db,
    env: { DB: d1(db), SESSIONS: { get: async (k) => sessions.get(k) ?? null } },
  }
}

function create(body, workspace) {
  return new Request('https://researchtools.test/api/cop/sessions', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer session-alice',
      'Content-Type': 'application/json',
      ...(workspace ? { 'X-Workspace-ID': workspace } : {}),
    },
    body: JSON.stringify({ name: 'Alice COP', ...body }),
  })
}

const call = (request, env) =>
  handler.onRequestPost({ request, env, params: {}, waitUntil() {}, next() {}, data: {} })

const sessionCount = (db) => db.prepare('SELECT COUNT(*) AS n FROM cop_sessions').get().n

test('refuses a session bound to a workspace the caller does not own or edit', async () => {
  const { db, env } = fixture()
  const res = await call(create({}, 'ws-bob'), env)
  assert.equal(res.status, 403)
  assert.equal(sessionCount(db), 0)
})

test('refuses a team workspace where the caller is only a viewer', async () => {
  const { db, env } = fixture()
  const res = await call(create({ team_workspace_id: 'ws-team' }), env)
  assert.equal(res.status, 403)
  assert.equal(sessionCount(db), 0)
})

test("creates a session in the caller's own workspace", async () => {
  const { db, env } = fixture()
  const res = await call(create({}, 'ws-alice'), env)
  assert.equal(res.status, 201)
  assert.equal((await res.json()).workspace_id, 'ws-alice')
  assert.equal(sessionCount(db), 1)
})

test('creates a session with its own new workspace when none is named', async () => {
  const { db, env } = fixture()
  const res = await call(create({}), env)
  assert.equal(res.status, 201)
  const { id, workspace_id } = await res.json()
  assert.equal(workspace_id, id)
  assert.equal(sessionCount(db), 1)
})
