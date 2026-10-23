/**
 * Shared fixture for the COP webcam suites (cop-webcams*.test.mjs).
 *
 * - The real modules are bundled with esbuild; a module that does not build is
 *   reported by the tests that use it (mod()), so a run against an older tree shows
 *   which behaviour is missing rather than one bundling error.
 * - node:sqlite behind a small D1 shim, with the real managed migrations applied.
 * - A fake KV that, like Cloudflare's, refuses an expirationTtl below 60.
 * - Outbound fetch is refused unless a test scripts it (scriptFetch), and every
 *   request a test makes is logged, so a test can say which hosts were contacted.
 */
import { before, after } from 'node:test'
import { DatabaseSync } from 'node:sqlite'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build } from 'esbuild'

export const ROOT = new URL('../../', import.meta.url).pathname

export const ENTRIES = {
  webcamUrl: 'functions/api/_shared/webcam-url.ts',
  copShare: 'functions/api/_shared/cop-share.ts',
  copCaller: 'functions/api/_shared/cop-caller.ts',
  serviceAuth: 'functions/api/_shared/service-auth.ts',
  middleware: 'functions/api/cop/_middleware.ts',
  webcams: 'functions/api/cop/[id]/webcams.ts',
  webcam: 'functions/api/cop/[id]/webcams/[camId].ts',
  nearby: 'functions/api/cop/[id]/webcams/nearby.ts',
  estimate: 'functions/api/cop/[id]/webcams/[camId]/estimate-bearing.ts',
  layer: 'functions/api/cop/[id]/layers/webcams.ts',
  shares: 'functions/api/cop/[id]/shares.ts',
  publicShare: 'functions/api/cop/public/[token].ts',
  outbound: 'functions/api/_shared/outbound-json.ts',
  geocoder: 'functions/api/_shared/geocoder.ts',
  discovery: 'functions/api/_shared/webcam-discovery.ts',
  webcamAi: 'functions/api/_shared/webcam-ai.ts',
  windy: 'functions/api/_shared/windy-webcams.ts',
  kvJson: 'functions/api/_shared/kv-json.ts',
  pageAddress: 'src/components/cop/cams/page-address.ts',
}

const built = {}
const buildErrors = {}
const realFetch = globalThis.fetch

/** Call once at the top of a suite: bundles every entry and guards outbound fetch. */
export function setupWebcamSuite() {
  before(async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rt-cop-webcams-'))
    try {
      for (const [name, entry] of Object.entries(ENTRIES)) {
        const outfile = join(dir, `${name}.mjs`)
        try {
          await build({
            entryPoints: [join(ROOT, entry)],
            bundle: true,
            format: 'esm',
            platform: 'node',
            target: 'es2022',
            outfile,
            logLevel: 'silent',
          })
          built[name] = await import(outfile)
        } catch (error) {
          buildErrors[name] = error
        }
      }
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
    globalThis.fetch = refusedFetch
  })
  after(() => {
    globalThis.fetch = realFetch
  })
}

export function mod(name) {
  if (!built[name]) throw new Error(`${ENTRIES[name]} did not build: ${buildErrors[name]?.message ?? 'missing'}`)
  return built[name]
}

// ── Outbound fetch ─────────────────────────────────────────────────

async function refusedFetch(input) {
  throw new Error(`unexpected outbound fetch: ${typeof input === 'string' ? input : input?.url}`)
}

/**
 * Serve outbound requests from `handler(url: URL, init, call)` until `restore()`.
 * Returns the log: [{ url, host, method, headers, body }].
 */
export function scriptFetch(handler) {
  const log = []
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url)
    const headers = Object.fromEntries(new Headers(init.headers ?? {}).entries())
    const entry = { url: url.href, host: url.hostname, method: init.method ?? 'GET', headers, body: init.body ?? null, redirect: init.redirect }
    log.push(entry)
    return handler(url, init, entry)
  }
  log.restore = () => {
    globalThis.fetch = refusedFetch
  }
  return log
}

export const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

// ── KV ─────────────────────────────────────────────────────────────

/** A KV namespace in memory. Records each put's TTL; refuses TTL < 60 as Cloudflare does. */
export function fakeKv() {
  const store = new Map()
  const ttls = new Map()
  return {
    store,
    ttls,
    async get(key) {
      return store.has(key) ? store.get(key) : null
    },
    async put(key, value, options = {}) {
      if (options.expirationTtl !== undefined && options.expirationTtl < 60) {
        throw new Error(`KV put failed: expirationTtl ${options.expirationTtl} is below 60`)
      }
      store.set(key, String(value))
      ttls.set(key, options.expirationTtl)
    },
    async delete(key) {
      store.delete(key)
    },
  }
}

// ── D1 ─────────────────────────────────────────────────────────────

export function d1(db) {
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

// ── Fixture ────────────────────────────────────────────────────────

export const WINDY_ID = '1706619137'
export const YT_ID = 'dQw4w9WgXcQ'
export const CLIENT_ID = 'community_client_01'
const SECRET = 'A'.repeat(43)
const HASH_KEY = 'integration-test-key-material-0000000000000000'
export const SERVICE_USER = 73
export const SESSION = 'cop-cams'
export const OTHER_SESSION = 'cop-other'
export const NO_CENTER_SESSION = 'cop-no-center'
export const SERVICE_SESSION = 'cop-service-own'
export const migration = (name) => readFileSync(join(ROOT, 'schema/managed-migrations', name), 'utf8')

/**
 * webcamsTable: apply 0020; sources: also apply 0021; windyKey / ai: set the secrets;
 * kv: bind CACHE.
 */
export async function fixture({ webcamsTable = true, sources = true, windyKey = false, ai = false, kv = true } = {}) {
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
    CREATE TABLE cop_collaborators (cop_session_id TEXT, user_id INTEGER, role TEXT NOT NULL DEFAULT 'viewer');
    CREATE TABLE cop_shares (
      id TEXT PRIMARY KEY, cop_session_id TEXT NOT NULL, share_token TEXT NOT NULL UNIQUE,
      visible_panels TEXT NOT NULL DEFAULT '["map","event"]', allow_rfi_answers INTEGER NOT NULL DEFAULT 0,
      created_by INTEGER NOT NULL DEFAULT 1, created_at TEXT, view_count INTEGER NOT NULL DEFAULT 0, expires_at TEXT
    );
    CREATE TABLE cop_rfis (id TEXT PRIMARY KEY, cop_session_id TEXT, question TEXT, priority TEXT, status TEXT, created_at TEXT, updated_at TEXT);
    CREATE TABLE cop_events (id TEXT, cop_session_id TEXT, event_type TEXT, entity_type TEXT, entity_id TEXT, payload TEXT, created_by INTEGER);
    CREATE TABLE event_logs (level TEXT, source TEXT, message TEXT, context TEXT, user_id INTEGER);

    INSERT INTO users (id, username, email, full_name, hashed_password, is_active, role) VALUES
      (1, 'owner', 'owner@example.test', 'Owner', 'x', 1, 'user'),
      (2, 'editor', 'editor@example.test', 'Editor', 'x', 1, 'user'),
      (3, 'viewer', 'viewer@example.test', 'Viewer', 'x', 1, 'user'),
      (4, 'stranger', 'stranger@example.test', 'Stranger', 'x', 1, 'user');
    INSERT INTO users (id, username, email, full_name, hashed_password, is_active, role)
      VALUES (${SERVICE_USER}, 'service_${CLIENT_ID}', 'service+${CLIENT_ID}@service.invalid',
        'Integration Service', 'SERVICE_AUTH_DISABLED', 1, 'service');
    INSERT INTO workspaces (id, type, owner_id, is_public) VALUES
      ('workspace-test', 'TEAM', ${SERVICE_USER}, 0), ('ws-owner', 'PERSONAL', 1, 0);
    INSERT INTO investigations (id, workspace_id, created_by, status)
      VALUES ('investigation-test', 'workspace-test', ${SERVICE_USER}, 'active');
    INSERT INTO integration_clients
      (id, community_id, workspace_id, intake_investigation_id, principal_user_id, environment, maximum_visibility, status)
      VALUES ('${CLIENT_ID}', 'community-test', 'workspace-test', 'investigation-test', ${SERVICE_USER}, 'production', 'community', 'active');

    INSERT INTO cop_sessions (id, name, description, template_type, status, center_lat, center_lon, zoom_level,
      active_layers, layer_config, key_questions, event_facts, content_analyses, workspace_id, created_by, is_public)
    VALUES
      ('${SESSION}', 'Paris overwatch', 'Research overwatch practice in Paris', 'custom', 'ACTIVE', 48.86, 2.29, 11,
       '["webcams"]', '{}', '[]', '[]', '[]', 'ws-owner', 1, 0),
      ('${OTHER_SESSION}', 'Another COP', NULL, 'custom', 'ACTIVE', 1, 2, 5,
       '["webcams"]', '{}', '[]', '[]', '[]', 'ws-owner', 1, 0),
      ('${NO_CENTER_SESSION}', 'No center yet', NULL, 'custom', 'ACTIVE', NULL, NULL, NULL,
       '["webcams"]', '{}', '[]', '[]', '[]', 'ws-owner', 1, 0),
      ('${SERVICE_SESSION}', 'Bot breakout', NULL, 'custom', 'ACTIVE', 48.86, 2.29, 5,
       '[]', '{}', '[]', '[]', '[]', 'workspace-test', ${SERVICE_USER}, 0);
    INSERT INTO cop_collaborators (cop_session_id, user_id, role) VALUES
      ('${SESSION}', 2, 'Editor'),
      ('${SESSION}', 3, 'viewer');
  `)
  if (webcamsTable) db.exec(migration('0020_cop_webcams.sql'))
  if (webcamsTable && sources) db.exec(migration('0021_cop_webcam_sources.sql'))

  const now = Math.floor(Date.now() / 1000)
  const hash = await mod('serviceAuth').deriveIntegrationTokenHash(HASH_KEY, CLIENT_ID, SECRET)
  db.prepare(`INSERT INTO integration_client_tokens (id, client_id, slot, secret_hash, created_at, not_before, expires_at)
    VALUES ('token_identifier_00000001', ?, 'current', ?, ?, ?, ?)`).run(CLIENT_ID, hash, now - 100, now - 100, now + 3600)
  db.prepare(`INSERT INTO integration_client_token_scopes (token_id, scope) VALUES ('token_identifier_00000001', 'community.cop.write')`).run()

  const sessions = new Map([
    ['session-owner', JSON.stringify({ user_id: 1 })],
    ['session-editor', JSON.stringify({ user_id: 2 })],
    ['session-viewer', JSON.stringify({ user_id: 3 })],
    ['session-stranger', JSON.stringify({ user_id: 4 })],
  ])
  const cache = kv ? fakeKv() : undefined
  const env = {
    DB: d1(db),
    SESSIONS: { get: async (k) => sessions.get(k) ?? null },
    ENVIRONMENT: 'production',
    INTEGRATION_TOKEN_HASH_KEY: HASH_KEY,
    COMMUNITY_INTEGRATIONS_ENABLED: 'true',
    COP_SERVICE_ENABLED: 'true',
    ...(cache ? { CACHE: cache } : {}),
    ...(windyKey ? { WINDY_WEBCAMS_API_KEY: 'test-windy-key' } : {}),
    ...(ai ? { OPENAI_API_KEY: 'test-openai-key', AI_GATEWAY_ACCOUNT_ID: 'test-account' } : {}),
  }
  return { db, env, kv: cache }
}

export const as = (who) => ({ Authorization: `Bearer session-${who}` })
export const SERVICE_AUTH = { Authorization: `Bearer rt_svc_${CLIENT_ID}.${SECRET}` }
export const PARIS_CAM = { url: `https://www.windy.com/webcams/${WINDY_ID}`, label: 'CESE, facing the Eiffel Tower', lat: 48.8656, lon: 2.2969, bearing_deg: 200 }

/**
 * Run a request through the COP middleware into the handler, as Pages does.
 * Returns the response; `context.waits` collects waitUntil promises.
 */
export async function cop(env, method, path, { headers = {}, body, handler, params = {}, waits } = {}) {
  const request = new Request(`https://researchtools.test${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const context = { request, env, params, data: {}, waitUntil: (p) => waits?.push(p) }
  context.next = () => handler[`onRequest${method[0]}${method.slice(1).toLowerCase()}`](context)
  return mod('middleware').onRequest(context)
}

export const addCam = (env, who, body = PARIS_CAM, session = SESSION) =>
  cop(env, 'POST', `/api/cop/${session}/webcams`, { headers: as(who), body, handler: mod('webcams'), params: { id: session } })
export const removeCam = (env, who, camId, session = SESSION) =>
  cop(env, 'DELETE', `/api/cop/${session}/webcams/${camId}`, { headers: as(who), handler: mod('webcam'), params: { id: session, camId } })
export const countCams = (db) => db.prepare('SELECT COUNT(*) AS n FROM cop_webcams WHERE archived_at IS NULL').get().n
