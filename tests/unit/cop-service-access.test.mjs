/**
 * COP for scoped service callers (the Signal bot's rt_svc_ credential), and the
 * exposure of shared sessions.
 *
 * - functions/api/cop/_middleware.ts admits a service only with COP_SERVICE_ENABLED,
 *   community.cop.write, an allow-listed operation, and (on a session route) a
 *   session its principal user created. Users pass through unchanged.
 * - Sessions get full-UUID ids; services cannot create public sessions.
 * - GET /api/cop/public/:token returns only the fields the share's panels allow,
 *   and refuses an expired share. Shares accept an optional expires_at.
 * - A share token for the session may read its map layers (verifyCopLayerAccess).
 *
 * The real modules are bundled with esbuild and run on node:sqlite behind a small
 * D1 shim. The service principal is resolved by the real
 * getIntegrationPrincipalFromRequest against the managed migrations 0009/0010.
 *
 * Run: npm run test:unit
 */
import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build } from 'esbuild'

const ROOT = new URL('../../', import.meta.url).pathname
const ENTRIES = {
  middleware: 'functions/api/cop/_middleware.ts',
  sessions: 'functions/api/cop/sessions.ts',
  shares: 'functions/api/cop/[id]/shares.ts',
  claims: 'functions/api/cop/[id]/claims.ts',
  timeline: 'functions/api/cop/[id]/timeline.ts',
  publicShare: 'functions/api/cop/public/[token].ts',
  authHelpers: 'functions/api/_shared/auth-helpers.ts',
  serviceAuth: 'functions/api/_shared/service-auth.ts',
  places: 'functions/api/cop/[id]/layers/places.ts',
  rfiAnswers: 'functions/api/cop/public/[token]/rfis/[rfiId]/answers.ts',
}
const mods = {}

before(async () => {
  const dir = mkdtempSync(join(tmpdir(), 'rt-cop-service-'))
  try {
    for (const [name, entry] of Object.entries(ENTRIES)) {
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

const CLIENT_ID = 'community_client_01'
const SECRET = 'A'.repeat(43)
const HASH_KEY = 'integration-test-key-material-0000000000000000'
const SERVICE_USER = 73
const migration = (name) => readFileSync(join(ROOT, 'schema/managed-migrations', name), 'utf8')

async function fixture({ scopes = ['community.cop.write'], shareExpiryColumn = true } = {}) {
  const db = new DatabaseSync(':memory:')
  db.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY, username TEXT NOT NULL UNIQUE, email TEXT NOT NULL UNIQUE,
      full_name TEXT NOT NULL, hashed_password TEXT NOT NULL, user_hash TEXT, account_hash TEXT,
      oidc_sub TEXT, oidc_provider TEXT, oidc_email TEXT, is_active INTEGER NOT NULL, role TEXT NOT NULL
    );
    CREATE TABLE workspaces (
      id TEXT PRIMARY KEY, name TEXT, description TEXT, type TEXT NOT NULL DEFAULT 'PERSONAL',
      owner_id INTEGER NOT NULL, is_public INTEGER NOT NULL DEFAULT 0, created_at TEXT, updated_at TEXT
    );
    CREATE TABLE workspace_members (id TEXT, workspace_id TEXT NOT NULL, user_id INTEGER NOT NULL, role TEXT NOT NULL);
    CREATE TABLE investigations (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, created_by INTEGER NOT NULL, status TEXT NOT NULL);
  `)
  db.exec(migration('0009_community_service_auth.sql'))
  db.exec(migration('0010_service_principal_identity_compat.sql'))
  db.exec(`
    CREATE TABLE cop_collaborators (cop_session_id TEXT, user_id INTEGER, role TEXT NOT NULL DEFAULT 'viewer');
    CREATE TABLE places (
      id TEXT, name TEXT, place_type TEXT, country TEXT, region TEXT, strategic_importance TEXT,
      controlled_by TEXT, description TEXT, coordinates TEXT, workspace_id TEXT
    );
    CREATE TABLE cop_rfis (
      id TEXT PRIMARY KEY, cop_session_id TEXT NOT NULL, question TEXT NOT NULL, priority TEXT NOT NULL DEFAULT 'medium',
      status TEXT NOT NULL DEFAULT 'open', created_by INTEGER NOT NULL DEFAULT 1, assigned_to INTEGER,
      requester_name TEXT, created_at TEXT, updated_at TEXT
    );
    CREATE TABLE cop_rfi_answers (
      id TEXT PRIMARY KEY, rfi_id TEXT NOT NULL, answer_text TEXT NOT NULL, source_url TEXT, source_description TEXT,
      is_accepted INTEGER NOT NULL DEFAULT 0, created_by INTEGER, responder_name TEXT, created_at TEXT
    );
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
    CREATE TABLE cop_shares (
      id TEXT PRIMARY KEY, cop_session_id TEXT NOT NULL, share_token TEXT NOT NULL UNIQUE,
      visible_panels TEXT NOT NULL DEFAULT '["map","event"]', allow_rfi_answers INTEGER NOT NULL DEFAULT 0,
      created_by INTEGER NOT NULL DEFAULT 1, created_at TEXT, view_count INTEGER NOT NULL DEFAULT 0
      ${shareExpiryColumn ? ', expires_at TEXT' : ''}
    );
    CREATE TABLE cop_claims (id TEXT PRIMARY KEY, cop_session_id TEXT, claim_text TEXT, created_at TEXT);
    CREATE TABLE cop_events (id TEXT, cop_session_id TEXT, event_type TEXT, entity_type TEXT, entity_id TEXT, payload TEXT, created_by INTEGER);
    CREATE TABLE event_logs (level TEXT, source TEXT, message TEXT, context TEXT, user_id INTEGER);

    INSERT INTO users (id, username, email, full_name, hashed_password, is_active, role) VALUES
      (1, 'alice', 'alice@example.test', 'Alice', 'x', 1, 'user'),
      (2, 'bob', 'bob@example.test', 'Bob', 'x', 1, 'user');
    INSERT INTO users (id, username, email, full_name, hashed_password, is_active, role)
      VALUES (${SERVICE_USER}, 'service_${CLIENT_ID}', 'service+${CLIENT_ID}@service.invalid',
        'Integration Service', 'SERVICE_AUTH_DISABLED', 1, 'service');
    INSERT INTO workspaces (id, type, owner_id, is_public) VALUES
      ('workspace-test', 'TEAM', ${SERVICE_USER}, 0), ('ws-bob', 'PERSONAL', 2, 0);
    INSERT INTO investigations (id, workspace_id, created_by, status)
      VALUES ('investigation-test', 'workspace-test', ${SERVICE_USER}, 'active');
    INSERT INTO integration_clients
      (id, community_id, workspace_id, intake_investigation_id, principal_user_id, environment, maximum_visibility, status)
      VALUES ('${CLIENT_ID}', 'community-test', 'workspace-test', 'investigation-test', ${SERVICE_USER}, 'production', 'community', 'active');

    INSERT INTO cop_sessions (id, name, description, template_type, status, center_lat, center_lon, zoom_level,
      active_layers, layer_config, key_questions, event_type, event_description, event_facts, content_analyses,
      workspace_id, created_by, is_public)
    VALUES
      ('cop-bobs-private', 'Bob private', 'bob internal notes', 'custom', 'ACTIVE', 35.1, -79.0, 7,
       '["markers"]', '{}', '["q1"]', 'protest', 'what happened', '[{"time":"1","text":"fact"}]', '["ca-secret"]',
       'ws-bob', 2, 0),
      ('cop-service-own', 'Bot breakout', 'internal', 'custom', 'ACTIVE', 1, 2, 5,
       '[]', '{}', '[]', NULL, NULL, '[]', '[]', 'cop-service-own', ${SERVICE_USER}, 0),
      ('cop-shared-editor', 'Shared with the bot as editor', NULL, 'custom', 'ACTIVE', 1, 2, 5,
       '[]', '{}', '[]', NULL, NULL, '[]', '[]', 'ws-bob', 2, 0),
      ('cop-shared-viewer', 'Shared with the bot as viewer', NULL, 'custom', 'ACTIVE', 1, 2, 5,
       '[]', '{}', '[]', NULL, NULL, '[]', '[]', 'ws-bob', 2, 0);
    INSERT INTO cop_collaborators (cop_session_id, user_id, role) VALUES
      ('cop-shared-editor', ${SERVICE_USER}, 'editor'),
      ('cop-shared-viewer', ${SERVICE_USER}, 'viewer');
  `)
  const now = Math.floor(Date.now() / 1000)
  const hash = await mods.serviceAuth.deriveIntegrationTokenHash(HASH_KEY, CLIENT_ID, SECRET)
  db.prepare(`INSERT INTO integration_client_tokens (id, client_id, slot, secret_hash, created_at, not_before, expires_at)
    VALUES ('token_identifier_00000001', ?, 'current', ?, ?, ?, ?)`).run(CLIENT_ID, hash, now - 100, now - 100, now + 3600)
  for (const scope of scopes) {
    db.prepare(`INSERT INTO integration_client_token_scopes (token_id, scope) VALUES ('token_identifier_00000001', ?)`).run(scope)
  }
  const sessions = new Map([['session-alice', JSON.stringify({ user_id: 1 })]])
  const env = {
    DB: d1(db),
    SESSIONS: { get: async (k) => sessions.get(k) ?? null },
    ENVIRONMENT: 'production',
    INTEGRATION_TOKEN_HASH_KEY: HASH_KEY,
    COMMUNITY_INTEGRATIONS_ENABLED: 'true',
    COP_SERVICE_ENABLED: 'true',
  }
  return { db, env }
}

const SERVICE_AUTH = { Authorization: `Bearer rt_svc_${CLIENT_ID}.${SECRET}` }
const USER_AUTH = { Authorization: 'Bearer session-alice' }

/** Run a request through the COP middleware into the handler, as Pages does. */
async function cop(env, method, path, { headers = {}, body, handler, params = {} } = {}) {
  const request = new Request(`https://researchtools.test${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const context = { request, env, params, data: {}, waitUntil() {} }
  context.next = () => handler[`onRequest${method[0]}${method.slice(1).toLowerCase()}`](context)
  return mods.middleware.onRequest(context)
}

const errorCode = async (res) => (await res.json())?.error?.code

test('a service without community.cop.write is refused', async () => {
  const { env } = await fixture({ scopes: ['community.research.execute'] })
  const res = await cop(env, 'POST', '/api/cop/sessions', { headers: SERVICE_AUTH, body: { name: 'x' }, handler: mods.sessions })
  assert.equal(res.status, 403)
  assert.equal(await errorCode(res), 'scope_denied')
})

test('a service is refused while COP_SERVICE_ENABLED is off', async () => {
  const { env } = await fixture()
  delete env.COP_SERVICE_ENABLED
  const res = await cop(env, 'POST', '/api/cop/sessions', { headers: SERVICE_AUTH, body: { name: 'x' }, handler: mods.sessions })
  assert.equal(res.status, 403)
  assert.equal(await errorCode(res), 'scope_denied')
})

test('a scoped service creates a private session as its principal user, with a UUID id', async () => {
  const { db, env } = await fixture()
  const res = await cop(env, 'POST', '/api/cop/sessions', { headers: SERVICE_AUTH, body: { name: 'Breakout COP' }, handler: mods.sessions })
  assert.equal(res.status, 201)
  const { id, workspace_id } = await res.json()
  assert.match(id, /^cop-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  const row = db.prepare('SELECT created_by, is_public FROM cop_sessions WHERE id = ?').get(id)
  assert.equal(row.created_by, SERVICE_USER)
  assert.equal(row.is_public, 0)
  assert.equal(db.prepare('SELECT owner_id FROM workspaces WHERE id = ?').get(workspace_id).owner_id, SERVICE_USER)
})

test('a service cannot create a public session', async () => {
  const { db, env } = await fixture()
  const res = await cop(env, 'POST', '/api/cop/sessions', { headers: SERVICE_AUTH, body: { name: 'x', is_public: true }, handler: mods.sessions })
  assert.equal(res.status, 400)
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM cop_sessions WHERE created_by = ?").get(SERVICE_USER).n, 1)
})

test('a service cannot name another workspace', async () => {
  const { env } = await fixture()
  const res = await cop(env, 'POST', '/api/cop/sessions', {
    headers: { ...SERVICE_AUTH, 'X-Workspace-ID': 'ws-bob' }, body: { name: 'x' }, handler: mods.sessions,
  })
  assert.equal(res.status, 403)
  assert.equal(await errorCode(res), 'workspace_denied')
})

test("a service cannot touch another caller's session", async () => {
  const { db, env } = await fixture()
  const share = await cop(env, 'POST', '/api/cop/cop-bobs-private/shares', {
    headers: SERVICE_AUTH, body: {}, handler: mods.shares, params: { id: 'cop-bobs-private' },
  })
  assert.equal(share.status, 403)
  assert.equal(await errorCode(share), 'workspace_denied')
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM cop_shares').get().n, 0)
  const read = await cop(env, 'GET', '/api/cop/cop-bobs-private/claims', {
    headers: SERVICE_AUTH, handler: mods.claims, params: { id: 'cop-bobs-private' },
  })
  assert.equal(read.status, 403)
})

test('a service works on its own session, and only through allow-listed operations', async () => {
  const { env } = await fixture()
  const share = await cop(env, 'POST', '/api/cop/cop-service-own/shares', {
    headers: SERVICE_AUTH, body: { visible_panels: ['map', 'event'] }, handler: mods.shares, params: { id: 'cop-service-own' },
  })
  assert.equal(share.status, 201)
  assert.match((await share.json()).url, /^\/public\/cop\/[0-9a-f-]{36}$/)
  const claims = await cop(env, 'GET', '/api/cop/cop-service-own/claims', {
    headers: SERVICE_AUTH, handler: mods.claims, params: { id: 'cop-service-own' },
  })
  assert.equal(claims.status, 200)
  // Deleting a share is not on the service allow-list. (Undo of the bot's own items
  // is, and each handler refuses items a service didn't create: cop-core-access.)
  const del = await cop(env, 'DELETE', '/api/cop/cop-service-own/shares?token=x', {
    headers: SERVICE_AUTH, handler: mods.shares, params: { id: 'cop-service-own' },
  })
  assert.equal(del.status, 403)
  assert.equal(await errorCode(del), 'scope_denied')
})

test('users are unchanged: create a session and share it', async () => {
  const { db, env } = await fixture()
  const created = await cop(env, 'POST', '/api/cop/sessions', { headers: USER_AUTH, body: { name: 'Alice COP' }, handler: mods.sessions })
  assert.equal(created.status, 201)
  const { id } = await created.json()
  assert.equal(db.prepare('SELECT created_by FROM cop_sessions WHERE id = ?').get(id).created_by, 1)
  const share = await cop(env, 'POST', `/api/cop/${id}/shares`, { headers: USER_AUTH, body: {}, handler: mods.shares, params: { id } })
  assert.equal(share.status, 201)
  const anonymous = await cop(env, 'POST', '/api/cop/sessions', { body: { name: 'x' }, handler: mods.sessions })
  assert.equal(anonymous.status, 401)
})

async function seedShare(db, token, panels, expiresAt) {
  db.prepare(`INSERT INTO cop_shares (id, cop_session_id, share_token, visible_panels, created_by${expiresAt === undefined ? '' : ', expires_at'})
    VALUES (?, 'cop-bobs-private', ?, ?, 2${expiresAt === undefined ? '' : ', ?'})`)
    .run(...[`share-${token}`, token, JSON.stringify(panels), ...(expiresAt === undefined ? [] : [expiresAt])])
}

const publicGet = (env, token) =>
  mods.publicShare.onRequestGet({
    request: new Request(`https://researchtools.test/api/cop/public/${token}`), env, params: { token }, data: {},
  })

test('a share link returns only the fields its panels allow', async () => {
  const { db, env } = await fixture()
  await seedShare(db, 'tok-map', ['map'])
  await seedShare(db, 'tok-event', ['map', 'event'])
  const mapOnly = (await (await publicGet(env, 'tok-map')).json()).session
  assert.equal(mapOnly.center_lat, 35.1)
  for (const hidden of ['created_by', 'workspace_id', 'is_public', 'description', 'content_analyses', 'event_description', 'key_questions']) {
    assert.ok(!(hidden in mapOnly), `${hidden} must not be shared`)
  }
  const withEvent = (await (await publicGet(env, 'tok-event')).json()).session
  assert.equal(withEvent.event_description, 'what happened')
  assert.ok(!('created_by' in withEvent))
})

test('an expired share link is refused; a link without an expiry still works', async () => {
  const { db, env } = await fixture()
  await seedShare(db, 'tok-old', ['map'], new Date(Date.now() - 60_000).toISOString())
  await seedShare(db, 'tok-new', ['map'], null)
  assert.equal((await publicGet(env, 'tok-old')).status, 404)
  assert.equal((await publicGet(env, 'tok-new')).status, 200)
})

test('share expiry: validated, stored, and refused cleanly before managed migration 0019', async () => {
  const { env } = await fixture()
  const body = (expires_at) => ({ headers: USER_AUTH, body: { expires_at }, handler: mods.shares, params: { id: 'cop-bobs-private' } })
  const bob = { ...env, SESSIONS: { get: async () => JSON.stringify({ user_id: 2 }) } }
  assert.equal((await cop(bob, 'POST', '/api/cop/cop-bobs-private/shares', body('2000-01-01T00:00:00Z'))).status, 400)
  const ok = await cop(bob, 'POST', '/api/cop/cop-bobs-private/shares', body(new Date(Date.now() + 3_600_000).toISOString()))
  assert.equal(ok.status, 201)
  assert.ok((await ok.json()).expires_at)

  const { env: noColumn } = await fixture({ shareExpiryColumn: false })
  const bobNoColumn = { ...noColumn, SESSIONS: { get: async () => JSON.stringify({ user_id: 2 }) } }
  const refused = await cop(bobNoColumn, 'POST', '/api/cop/cop-bobs-private/shares', body(new Date(Date.now() + 3_600_000).toISOString()))
  assert.equal(refused.status, 503)
  const plain = await cop(bobNoColumn, 'POST', '/api/cop/cop-bobs-private/shares', { headers: USER_AUTH, body: {}, handler: mods.shares, params: { id: 'cop-bobs-private' } })
  assert.equal(plain.status, 201)
})

test("a share token reads its session's map layers; a wrong or expired token does not", async () => {
  const { db, env } = await fixture()
  await seedShare(db, 'tok-layers', ['map'], null)
  await seedShare(db, 'tok-expired', ['map'], new Date(Date.now() - 60_000).toISOString())
  const accessLayer = (query) =>
    mods.authHelpers.verifyCopLayerAccess(env.DB, 'cop-bobs-private',
      new Request(`https://researchtools.test/api/cop/cop-bobs-private/layers/markers${query}`), env, 'markers')
  const access = accessLayer
  const granted = await accessLayer('?share=tok-layers')
  assert.equal(granted.workspace_id, 'ws-bob')
  assert.equal((await access('?share=tok-expired')).status, 401)
  assert.equal((await access('?share=not-a-token')).status, 401)
  assert.equal((await access('')).status, 401)
})

// ── Security-review fixes and collaborator access ─────────────────────────────

const layerAccess = (env, layer, query) =>
  mods.authHelpers.verifyCopLayerAccess(env.DB, 'cop-bobs-private',
    new Request(`https://researchtools.test/api/cop/cop-bobs-private/layers/${layer}${query}`), env, layer)

test('a map-only share cannot read the assets layer, even when the session shows assets', async () => {
  const { db, env } = await fixture()
  db.prepare(`UPDATE cop_sessions SET active_layers = '["markers","assets"]' WHERE id = 'cop-bobs-private'`).run()
  await seedShare(db, 'tok-map', ['map'], null)
  assert.equal((await layerAccess(env, 'assets', '?share=tok-map')).status, 401)
  assert.equal((await layerAccess(env, 'markers', '?share=tok-map')).viaShare, true)
})

test("a share cannot read a layer the session hasn't switched on", async () => {
  const { db, env } = await fixture()
  await seedShare(db, 'tok-map', ['map'], null)
  for (const layer of ['actors', 'places', 'events', 'relationships']) {
    assert.equal((await layerAccess(env, layer, '?share=tok-map')).status, 401, layer)
  }
})

test('a share cannot read the layers of an archived session', async () => {
  const { db, env } = await fixture()
  await seedShare(db, 'tok-map', ['map'], null)
  db.prepare(`UPDATE cop_sessions SET status = 'ARCHIVED' WHERE id = 'cop-bobs-private'`).run()
  assert.equal((await layerAccess(env, 'markers', '?share=tok-map')).status, 401)
})

test("a share sees the session's own area, not a wider bbox it asks for", async () => {
  const { db, env } = await fixture()
  db.prepare(`UPDATE cop_sessions SET active_layers = '["places"]', bbox_min_lat = 48, bbox_min_lon = 2,
    bbox_max_lat = 49, bbox_max_lon = 3 WHERE id = 'cop-bobs-private'`).run()
  db.prepare(`INSERT INTO places (id, name, coordinates, workspace_id) VALUES
    ('p-paris', 'Paris', '{"lat":48.85,"lng":2.35}', 'ws-bob'),
    ('p-nyc', 'New York', '{"lat":40.7,"lng":-74.0}', 'ws-bob')`).run()
  await seedShare(db, 'tok-map', ['map'], null)
  const get = (headers, query) => mods.places.onRequestGet({
    request: new Request(`https://researchtools.test/api/cop/cop-bobs-private/layers/places${query}`, { headers }),
    env, params: { id: 'cop-bobs-private' }, data: {}, waitUntil() {},
  })
  const names = async (res) => (await res.json()).features.map((f) => f.properties.name).sort()
  assert.deepEqual(await names(await get({}, '?share=tok-map&bbox=-180,-90,180,90')), ['Paris'])
  const bob = { ...env, SESSIONS: { get: async () => JSON.stringify({ user_id: 2 }) } }
  const owner = await mods.places.onRequestGet({
    request: new Request('https://researchtools.test/api/cop/cop-bobs-private/layers/places?bbox=-180,-90,180,90', { headers: USER_AUTH }),
    env: bob, params: { id: 'cop-bobs-private' }, data: {}, waitUntil() {},
  })
  assert.deepEqual(await names(owner), ['New York', 'Paris'])
})

test('a service cannot put a session in workspace "1", by query string or team workspace', async () => {
  const { db, env } = await fixture()
  const byQuery = await cop(env, 'POST', '/api/cop/sessions?workspace_id=1', {
    headers: SERVICE_AUTH, body: { name: 'x' }, handler: mods.sessions,
  })
  assert.equal(byQuery.status, 403)
  const byTeam = await cop(env, 'POST', '/api/cop/sessions', {
    headers: SERVICE_AUTH, body: { name: 'x', team_workspace_id: '1' }, handler: mods.sessions,
  })
  assert.equal(byTeam.status, 403)
  assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM cop_sessions WHERE workspace_id = '1' OR team_workspace_id = '1'`).get().n, 0)
})

async function seedRfiShare(db, token, panels, { expiresAt = null, allowAnswers = 1 } = {}) {
  db.prepare(`INSERT INTO cop_shares (id, cop_session_id, share_token, visible_panels, allow_rfi_answers, created_by, expires_at)
    VALUES (?, 'cop-bobs-private', ?, ?, ?, 2, ?)`).run(`share-${token}`, token, JSON.stringify(panels), allowAnswers, expiresAt)
}

const answer = (env, token) =>
  mods.rfiAnswers.onRequestPost({
    request: new Request(`https://researchtools.test/api/cop/public/${token}/rfis/rfi-1/answers`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answer_text: 'seen it' }),
    }),
    env, params: { token, rfiId: 'rfi-1' }, data: {}, waitUntil() {},
  })

test('public RFI answers: refused when the link expired, lacks the RFI panel, or the session is archived', async () => {
  const { db, env } = await fixture()
  db.prepare(`INSERT INTO cop_rfis (id, cop_session_id, question, created_by, requester_name) VALUES ('rfi-1', 'cop-bobs-private', 'Who?', 2, 'Bob B')`).run()
  await seedRfiShare(db, 'tok-expired', ['map', 'rfi'], { expiresAt: '2000-01-01T00:00:00Z' })
  await seedRfiShare(db, 'tok-no-rfi', ['map'])
  await seedRfiShare(db, 'tok-ok', ['map', 'rfi'])
  assert.equal((await answer(env, 'tok-expired')).status, 403)
  assert.equal((await answer(env, 'tok-no-rfi')).status, 403)
  assert.equal(db.prepare(`SELECT status FROM cop_rfis WHERE id = 'rfi-1'`).get().status, 'open')
  assert.equal((await answer(env, 'tok-ok')).status, 201)
  db.prepare(`UPDATE cop_sessions SET status = 'ARCHIVED' WHERE id = 'cop-bobs-private'`).run()
  assert.equal((await answer(env, 'tok-ok')).status, 410)
})

test('the public page sends RFIs and answers without author ids or requester names', async () => {
  const { db, env } = await fixture()
  db.prepare(`INSERT INTO cop_rfis (id, cop_session_id, question, created_by, requester_name) VALUES ('rfi-1', 'cop-bobs-private', 'Who?', 2, 'Bob B')`).run()
  db.prepare(`INSERT INTO cop_rfi_answers (id, rfi_id, answer_text, created_by, responder_name) VALUES ('a-1', 'rfi-1', 'them', 2, 'Anon')`).run()
  await seedRfiShare(db, 'tok-ok', ['map', 'rfi'])
  const { rfis } = await (await publicGet(env, 'tok-ok')).json()
  assert.equal(rfis[0].question, 'Who?')
  assert.ok(!('created_by' in rfis[0]) && !('requester_name' in rfis[0]))
  assert.equal(rfis[0].answers[0].answer_text, 'them')
  assert.ok(!('created_by' in rfis[0].answers[0]))
})

test('a service works on a session shared with it as an editor, but cannot publish it', async () => {
  const { db, env } = await fixture()
  const read = await cop(env, 'GET', '/api/cop/cop-shared-editor/claims', {
    headers: SERVICE_AUTH, handler: mods.claims, params: { id: 'cop-shared-editor' },
  })
  assert.equal(read.status, 200)
  // A share link publishes someone else's session: a service may only share its own.
  const share = await cop(env, 'POST', '/api/cop/cop-shared-editor/shares', {
    headers: SERVICE_AUTH, body: { visible_panels: ['map'] }, handler: mods.shares, params: { id: 'cop-shared-editor' },
  })
  assert.equal(share.status, 403)
  assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM cop_shares WHERE cop_session_id = 'cop-shared-editor'`).get().n, 0)
  const own = await cop(env, 'POST', '/api/cop/cop-service-own/shares', {
    headers: SERVICE_AUTH, body: { visible_panels: ['map'] }, handler: mods.shares, params: { id: 'cop-service-own' },
  })
  assert.equal(own.status, 201)
})

test('a viewer collaborator cannot create a share link; an editor can', async () => {
  const { db, env } = await fixture()
  const post = () => cop(env, 'POST', '/api/cop/cop-bobs-private/shares', {
    headers: USER_AUTH, body: { visible_panels: ['map'] }, handler: mods.shares, params: { id: 'cop-bobs-private' },
  })
  db.prepare(`INSERT INTO cop_collaborators (cop_session_id, user_id, role) VALUES ('cop-bobs-private', 1, 'viewer')`).run()
  assert.equal((await post()).status, 403)
  db.prepare(`UPDATE cop_collaborators SET role = 'Editor' WHERE cop_session_id = 'cop-bobs-private' AND user_id = 1`).run()
  assert.equal((await post()).status, 201)
})

test('the analysis layer with no type is checked as the deception layer it serves', async () => {
  const { db, env } = await fixture()
  db.prepare(`UPDATE cop_sessions SET active_layers = '["framework-overlay"]' WHERE id = 'cop-bobs-private'`).run()
  await seedShare(db, 'tok-map', ['map'], null)
  assert.equal((await layerAccess(env, 'analysis', '?share=tok-map')).status, 401)
  assert.equal((await layerAccess(env, 'analysis', '?share=tok-map&type=deception')).status, 401)
  assert.equal((await layerAccess(env, 'analysis', '?share=tok-map&type=other')).status, 401)
  assert.equal((await layerAccess(env, 'analysis', '?share=tok-map&type=framework')).viaShare, true)
})

test('a service shared as a viewer may read but not write', async () => {
  const { db, env } = await fixture()
  const read = await cop(env, 'GET', '/api/cop/cop-shared-viewer/claims', {
    headers: SERVICE_AUTH, handler: mods.claims, params: { id: 'cop-shared-viewer' },
  })
  assert.equal(read.status, 200)
  const write = await cop(env, 'POST', '/api/cop/cop-shared-viewer/shares', {
    headers: SERVICE_AUTH, body: {}, handler: mods.shares, params: { id: 'cop-shared-viewer' },
  })
  assert.equal(write.status, 403)
  assert.equal(await errorCode(write), 'workspace_denied')
  assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM cop_shares WHERE cop_session_id = 'cop-shared-viewer'`).get().n, 0)
})
