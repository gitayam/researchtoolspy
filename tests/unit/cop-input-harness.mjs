/**
 * Shared fixture for the COP input suites (tags, uploads, suggest/geocode, evidence
 * form ingest): cop-tags, cop-uploads, cop-suggest-geocode, cop-ingest.
 *
 * - The real modules are bundled with esbuild; a module that does not build is
 *   reported by the tests that use it (mod()), so a run against an older tree shows
 *   which behaviour is missing rather than one bundling error.
 * - node:sqlite behind a D1 shim (meta.changes, meta.last_row_id), with the
 *   production column sets of the tables these routes touch and the real managed
 *   migrations 0020, 0021 and 0023 applied.
 * - A fake KV that refuses an expirationTtl below 60, a fake R2, and outbound
 *   fetch refused unless a test scripts it (every request logged).
 * - Service calls go through the real COP middleware with a real rt_svc_ token.
 */
import { before, after } from 'node:test'
import { DatabaseSync } from 'node:sqlite'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build } from 'esbuild'

export const ROOT = new URL('../../', import.meta.url).pathname

export const ENTRIES = {
  serviceAuth: 'functions/api/_shared/service-auth.ts',
  copCaller: 'functions/api/_shared/cop-caller.ts',
  middleware: 'functions/api/cop/_middleware.ts',
  sanitize: 'functions/api/_shared/image-sanitize.ts',
  copTags: 'functions/api/_shared/cop-tags.ts',
  copSuggest: 'functions/api/_shared/cop-suggest.ts',
  copIngest: 'functions/api/_shared/cop-ingest.ts',
  tags: 'functions/api/cop/[id]/tags.ts',
  itemTags: 'functions/api/cop/[id]/item-tags.ts',
  bulk: 'functions/api/cop/[id]/item-tags/bulk.ts',
  evidenceTags: 'functions/api/cop/[id]/evidence-tags.ts',
  submissions: 'functions/api/cop/[id]/submissions.ts',
  uploads: 'functions/api/cop/[id]/uploads.ts',
  upload: 'functions/api/cop/[id]/uploads/[uploadId].ts',
  publicUpload: 'functions/api/cop/public/[token]/uploads/[uploadId].ts',
  servePublic: 'functions/api/uploads/[[key]].ts',
  suggest: 'functions/api/cop/[id]/suggest.ts',
  geocode: 'functions/api/cop/[id]/geocode.ts',
  dropSubmit: 'functions/api/surveys/public/[token]/drop-submit.ts',
  surveySubmit: 'functions/api/surveys/public/[token]/submit.ts',
  surveyUpload: 'functions/api/surveys/public/[token]/upload.ts',
  pushToCop: 'functions/api/surveys/[id]/responses/[rid]/push-to-cop.ts',
  intakeSubmit: 'functions/api/cop/public/intake/[token]/submit.ts',
}

const built = {}
const buildErrors = {}
const realFetch = globalThis.fetch

/** Call once at the top of a suite: bundles every entry and guards outbound fetch. */
export function setupInputSuite(names = Object.keys(ENTRIES)) {
  before(async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rt-cop-input-'))
    try {
      for (const name of names) {
        const outfile = join(dir, `${name}.mjs`)
        try {
          await build({
            entryPoints: [join(ROOT, ENTRIES[name])],
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

export function scriptFetch(handler) {
  const log = []
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url)
    const headers = Object.fromEntries(new Headers(init.headers ?? {}).entries())
    const entry = { url: url.href, host: url.hostname, method: init.method ?? 'GET', headers, body: init.body ?? null }
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

// ── KV and R2 ──────────────────────────────────────────────────────

export function fakeKv() {
  const store = new Map()
  return {
    store,
    async get(key) {
      return store.has(key) ? store.get(key) : null
    },
    async put(key, value, options = {}) {
      if (options.expirationTtl !== undefined && options.expirationTtl < 60) {
        throw new Error(`KV put failed: expirationTtl ${options.expirationTtl} is below 60`)
      }
      store.set(key, String(value))
    },
    async delete(key) {
      store.delete(key)
    },
  }
}

export function fakeR2() {
  const objects = new Map()
  return {
    objects,
    async put(key, value, options = {}) {
      const bytes = value instanceof Uint8Array ? new Uint8Array(value) : new Uint8Array(value)
      objects.set(key, { bytes, httpMetadata: options.httpMetadata ?? {}, customMetadata: options.customMetadata ?? {} })
    },
    async get(key) {
      const o = objects.get(key)
      if (!o) return null
      return {
        size: o.bytes.length,
        httpMetadata: o.httpMetadata,
        httpEtag: '"etag"',
        body: new Blob([o.bytes]).stream(),
        arrayBuffer: async () => o.bytes.buffer.slice(o.bytes.byteOffset, o.bytes.byteOffset + o.bytes.byteLength),
      }
    },
    async delete(key) {
      objects.delete(key)
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
      return { success: true, meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } }
    },
  })
  return { prepare: (sql) => statement(sql) }
}

// ── Fixture ────────────────────────────────────────────────────────

export const CLIENT_ID = 'community_client_01'
const SECRET = 'A'.repeat(43)
const HASH_KEY = 'integration-test-key-material-0000000000000000'
export const SERVICE_USER = 73
export const SESSION = 'cop-paris'
export const ATTACKER_SESSION = 'cop-attacker'
export const SHARE_TOKEN = '11111111-2222-4333-8444-555555555555'
export const SHARE_NO_FEED = '11111111-2222-4333-8444-666666666666'
export const SHARE_EXPIRED = '11111111-2222-4333-8444-777777777777'
export const DROP_TOKEN = 'drop-token-paris'
export const SURVEY_TOKEN = 'survey-token-paris'
export const INTAKE_TOKEN = 'intake-token-paris'
export const migration = (name) => readFileSync(join(ROOT, 'schema/managed-migrations', name), 'utf8')

const PROD_TABLES = `
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
  CREATE TABLE cop_sessions (
    id TEXT PRIMARY KEY, name TEXT, description TEXT, template_type TEXT, status TEXT,
    center_lat REAL, center_lon REAL, zoom_level INTEGER, active_layers TEXT, key_questions TEXT,
    workspace_id TEXT, created_by INTEGER, is_public INTEGER, created_at TEXT, updated_at TEXT
  );
  CREATE TABLE cop_collaborators (cop_session_id TEXT, user_id INTEGER, role TEXT NOT NULL DEFAULT 'viewer');
  CREATE TABLE cop_shares (
    id TEXT PRIMARY KEY, cop_session_id TEXT NOT NULL, share_token TEXT NOT NULL UNIQUE,
    visible_panels TEXT NOT NULL DEFAULT '["map","event"]', allow_rfi_answers INTEGER NOT NULL DEFAULT 0,
    created_by INTEGER NOT NULL DEFAULT 1, created_at TEXT, view_count INTEGER NOT NULL DEFAULT 0, expires_at TEXT
  );
  CREATE TABLE cop_events (
    id TEXT PRIMARY KEY, cop_session_id TEXT NOT NULL, event_type TEXT NOT NULL, entity_type TEXT NOT NULL,
    entity_id TEXT, payload TEXT DEFAULT '{}', created_by INTEGER NOT NULL, created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE event_logs (level TEXT, source TEXT, message TEXT, context TEXT, user_id INTEGER);
  CREATE TABLE evidence_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, description TEXT NOT NULL, summary TEXT,
    evidence_type TEXT NOT NULL, credibility TEXT NOT NULL, reliability TEXT NOT NULL, confidence_level TEXT,
    tags TEXT, status TEXT DEFAULT 'draft', created_by INTEGER DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    source_name TEXT, source_url TEXT, workspace_id TEXT, metadata TEXT
  );
  CREATE TABLE cop_markers (
    id TEXT PRIMARY KEY, cop_session_id TEXT NOT NULL, uid TEXT NOT NULL, cot_type TEXT DEFAULT 'a-u-G', callsign TEXT,
    lat REAL NOT NULL, lon REAL NOT NULL, hae REAL DEFAULT 0, label TEXT, description TEXT, icon TEXT, color TEXT,
    detail TEXT DEFAULT '{}', event_time TEXT DEFAULT (datetime('now')), stale_time TEXT,
    source_type TEXT DEFAULT 'MANUAL', source_id TEXT, workspace_id TEXT NOT NULL DEFAULT '1', created_by INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')), confidence TEXT DEFAULT 'POSSIBLE', rationale TEXT
  );
  CREATE TABLE cop_marker_changelog (
    id TEXT PRIMARY KEY, marker_id TEXT NOT NULL, cop_session_id TEXT NOT NULL, action TEXT NOT NULL, old_value TEXT,
    new_value TEXT, rationale TEXT, created_by INTEGER NOT NULL, created_by_name TEXT, created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE cop_timeline_entries (
    id TEXT PRIMARY KEY, cop_session_id TEXT NOT NULL, workspace_id TEXT, event_date TEXT NOT NULL, title TEXT NOT NULL,
    description TEXT, category TEXT DEFAULT 'event', source_type TEXT DEFAULT 'manual', source_url TEXT, source_title TEXT,
    importance TEXT DEFAULT 'normal', created_by INTEGER NOT NULL DEFAULT 1, created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')), entity_type TEXT, entity_id TEXT, action TEXT
  );
  CREATE TABLE cop_rfis (
    id TEXT PRIMARY KEY, cop_session_id TEXT NOT NULL, question TEXT NOT NULL, priority TEXT NOT NULL DEFAULT 'medium',
    status TEXT NOT NULL DEFAULT 'open', created_by INTEGER NOT NULL DEFAULT 1, created_at TEXT, updated_at TEXT
  );
  CREATE TABLE cop_tasks (id TEXT PRIMARY KEY, cop_session_id TEXT NOT NULL, title TEXT NOT NULL, created_by INTEGER NOT NULL);
  CREATE TABLE cop_claims (id TEXT PRIMARY KEY, cop_session_id TEXT NOT NULL, claim_text TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
  CREATE TABLE cop_hypotheses (id TEXT PRIMARY KEY, cop_session_id TEXT NOT NULL, statement TEXT NOT NULL, created_by INTEGER NOT NULL);
  CREATE TABLE cop_personas (id TEXT PRIMARY KEY, cop_session_id TEXT NOT NULL, display_name TEXT NOT NULL, platform TEXT NOT NULL, created_by INTEGER NOT NULL, workspace_id TEXT NOT NULL);
  CREATE TABLE cop_assets (id TEXT PRIMARY KEY, cop_session_id TEXT NOT NULL, asset_type TEXT NOT NULL, name TEXT NOT NULL, created_by INTEGER NOT NULL);
  CREATE TABLE cop_evidence_tags (
    id TEXT PRIMARY KEY, evidence_id TEXT NOT NULL, tag_category TEXT NOT NULL, tag_value TEXT NOT NULL,
    confidence INTEGER DEFAULT 100, created_by INTEGER NOT NULL, created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE survey_drops (
    id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT, form_schema TEXT DEFAULT '[]', share_token TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'draft', access_level TEXT DEFAULT 'public', password_hash TEXT, allowed_countries TEXT DEFAULT '[]',
    rate_limit_per_hour INTEGER DEFAULT 0, custom_slug TEXT, expires_at TEXT, theme_color TEXT, logo_url TEXT,
    success_message TEXT, redirect_url TEXT, auto_tag_category TEXT, require_location INTEGER DEFAULT 0,
    require_contact INTEGER DEFAULT 0, submission_count INTEGER DEFAULT 0, cop_session_id TEXT,
    workspace_id TEXT NOT NULL DEFAULT '1', created_by INTEGER NOT NULL, created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')), facts TEXT DEFAULT '[]', changelog TEXT DEFAULT '[]',
    intent TEXT NOT NULL DEFAULT 'survey' CHECK(intent IN ('survey', 'drop'))
  );
  CREATE TABLE cop_intake_forms (
    id TEXT PRIMARY KEY, cop_session_id TEXT NOT NULL, title TEXT NOT NULL, description TEXT, form_schema TEXT DEFAULT '[]',
    share_token TEXT UNIQUE NOT NULL, status TEXT DEFAULT 'draft', auto_tag_category TEXT, require_location INTEGER DEFAULT 0,
    require_contact INTEGER DEFAULT 0, submission_count INTEGER DEFAULT 0, created_by INTEGER NOT NULL,
    workspace_id TEXT NOT NULL DEFAULT '1', created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')),
    access_level TEXT DEFAULT 'public', password_hash TEXT, allowed_countries TEXT DEFAULT '[]', rate_limit_per_hour INTEGER DEFAULT 0,
    custom_slug TEXT, expires_at TEXT, theme_color TEXT, logo_url TEXT, success_message TEXT, redirect_url TEXT
  );
  CREATE TABLE survey_responses (
    id TEXT PRIMARY KEY, survey_id TEXT NOT NULL, form_data TEXT DEFAULT '{}', submitter_name TEXT, submitter_contact TEXT,
    lat REAL, lon REAL, submitter_country TEXT, submitter_city TEXT, submitter_ip_hash TEXT, content_hash TEXT,
    status TEXT DEFAULT 'pending', triaged_by INTEGER, rejection_reason TEXT, cop_session_id TEXT,
    linked_evidence_id TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT
  );
`

export const DROP_SCHEMA = [
  { name: 'what', type: 'textarea', label: 'What did you see?', required: true },
  { name: 'link', type: 'url', label: 'Link' },
  { name: 'where', type: 'geopoint', label: 'Where' },
  { name: 'photo', type: 'file', label: 'Photo' },
]

/**
 * tags: apply 0023 (tags, uploads, auto_ingest); channel: add 0022's source_channel
 * columns; kv / r2 / ai: bind CACHE / UPLOADS / the model secrets.
 */
export async function fixture({ tags = true, channel = false, kv = true, r2 = true, ai = false } = {}) {
  const db = new DatabaseSync(':memory:')
  db.exec(PROD_TABLES)
  db.exec(migration('0009_community_service_auth.sql'))
  db.exec(migration('0010_service_principal_identity_compat.sql'))
  db.exec(migration('0020_cop_webcams.sql'))
  db.exec(migration('0021_cop_webcam_sources.sql'))
  if (tags) db.exec(migration('0023_cop_tags_uploads.sql'))
  if (channel) {
    db.exec("ALTER TABLE evidence_items ADD COLUMN source_channel TEXT; ALTER TABLE cop_markers ADD COLUMN source_channel TEXT;")
  }
  const future = new Date(Date.now() + 7 * 864e5).toISOString()
  const past = new Date(Date.now() - 864e5).toISOString()
  db.exec(`
    INSERT INTO users (id, username, email, full_name, hashed_password, is_active, role) VALUES
      (1, 'owner', 'owner@example.test', 'Owner', 'x', 1, 'user'),
      (2, 'editor', 'editor@example.test', 'Editor', 'x', 1, 'user'),
      (3, 'viewer', 'viewer@example.test', 'Viewer', 'x', 1, 'user'),
      (4, 'attacker', 'attacker@example.test', 'Attacker', 'x', 1, 'user'),
      (${SERVICE_USER}, 'service_${CLIENT_ID}', 'service+${CLIENT_ID}@service.invalid', 'Integration Service', 'SERVICE_AUTH_DISABLED', 1, 'service');
    INSERT INTO workspaces (id, type, owner_id, is_public) VALUES
      ('ws-owner', 'PERSONAL', 1, 0), ('ws-attacker', 'PERSONAL', 4, 0), ('workspace-test', 'TEAM', ${SERVICE_USER}, 0);
    INSERT INTO investigations (id, workspace_id, created_by, status) VALUES ('investigation-test', 'workspace-test', ${SERVICE_USER}, 'active');
    INSERT INTO integration_clients
      (id, community_id, workspace_id, intake_investigation_id, principal_user_id, environment, maximum_visibility, status)
      VALUES ('${CLIENT_ID}', 'community-test', 'workspace-test', 'investigation-test', ${SERVICE_USER}, 'production', 'community', 'active');
    INSERT INTO cop_sessions (id, name, description, status, center_lat, center_lon, workspace_id, created_by, is_public) VALUES
      ('${SESSION}', 'Paris overwatch', 'Research overwatch practice in Paris', 'ACTIVE', 48.86, 2.29, 'ws-owner', 1, 0),
      ('${ATTACKER_SESSION}', 'Attacker COP', NULL, 'ACTIVE', 1, 2, 'ws-attacker', 4, 0);
    INSERT INTO cop_collaborators (cop_session_id, user_id, role) VALUES
      ('${SESSION}', 2, 'Editor'), ('${SESSION}', 3, 'viewer'), ('${SESSION}', ${SERVICE_USER}, 'editor');
    INSERT INTO cop_shares (id, cop_session_id, share_token, visible_panels, created_at, expires_at) VALUES
      ('share-1', '${SESSION}', '${SHARE_TOKEN}', '["map","event"]', '${past}', '${future}'),
      ('share-2', '${SESSION}', '${SHARE_NO_FEED}', '["map","cams"]', '${past}', '${future}'),
      ('share-3', '${SESSION}', '${SHARE_EXPIRED}', '["map","event"]', '${past}', '${past}');
    INSERT INTO evidence_items (id, title, description, evidence_type, credibility, reliability, workspace_id, created_by) VALUES
      (1, 'Paris evidence', 'x', 'observation', 'unverified', 'unknown', 'ws-owner', 1),
      (2, 'Attacker evidence', 'x', 'observation', 'unverified', 'unknown', 'ws-attacker', 4);
  `)
  // One item of every taggable type in each session.
  for (const [session, suffix, ws] of [[SESSION, 'paris', 'ws-owner'], [ATTACKER_SESSION, 'attacker', 'ws-attacker']]) {
    db.exec(`
      INSERT INTO cop_markers (id, cop_session_id, uid, lat, lon, workspace_id, created_by) VALUES ('mkr-${suffix}', '${session}', 'uid-${suffix}', 1, 2, '${ws}', 1);
      INSERT INTO cop_rfis (id, cop_session_id, question) VALUES ('rfi-${suffix}', '${session}', 'Q?');
      INSERT INTO cop_tasks (id, cop_session_id, title, created_by) VALUES ('tsk-${suffix}', '${session}', 'T', 1);
      INSERT INTO cop_timeline_entries (id, cop_session_id, event_date, title) VALUES ('tle-${suffix}', '${session}', '2026-10-23', 'E');
      INSERT INTO cop_claims (id, cop_session_id, claim_text, created_at, updated_at) VALUES ('clm-${suffix}', '${session}', 'C', 'x', 'x');
      INSERT INTO cop_hypotheses (id, cop_session_id, statement, created_by) VALUES ('hyp-${suffix}', '${session}', 'H', 1);
      INSERT INTO cop_personas (id, cop_session_id, display_name, platform, created_by, workspace_id) VALUES ('per-${suffix}', '${session}', 'P', 'x', 1, '${ws}');
      INSERT INTO cop_assets (id, cop_session_id, asset_type, name, created_by) VALUES ('ast-${suffix}', '${session}', 'source', 'A', 1);
      INSERT INTO cop_webcams (id, cop_session_id, provider, provider_ref, label, delivery) VALUES ('cam-${suffix}', '${session}', 'windy', '17066191${suffix === 'paris' ? '37' : '38'}', 'Cam', 'timelapse');
      INSERT INTO survey_responses (id, survey_id, cop_session_id) VALUES ('sub-${suffix}', 'srv-seed-${suffix}', '${session}');
    `)
    if (tags) {
      db.exec(`INSERT INTO cop_uploads (id, cop_session_id, r2_key, content_type, bytes) VALUES ('upl-${suffix}', '${session}', 'cop/${session}/k-${suffix}', 'image/png', 1)`)
    }
  }
  db.exec(`
    INSERT INTO survey_drops (id, title, form_schema, share_token, status, intent, auto_tag_category, cop_session_id, workspace_id, created_by) VALUES
      ('srv-paris', 'Paris evidence form', '${JSON.stringify(DROP_SCHEMA).replace(/'/g, "''")}', '${DROP_TOKEN}', 'active', 'drop', 'tip', '${SESSION}', 'ws-owner', 1),
      ('srv-survey', 'Paris survey', '${JSON.stringify(DROP_SCHEMA).replace(/'/g, "''")}', '${SURVEY_TOKEN}', 'active', 'survey', NULL, '${SESSION}', 'ws-owner', 1);
  `)

  db.exec(`INSERT INTO cop_intake_forms (id, cop_session_id, title, form_schema, share_token, status, created_by, workspace_id)
    VALUES ('intake-paris', '${SESSION}', 'Paris intake', '[]', '${INTAKE_TOKEN}', 'active', 1, 'ws-owner')`)

  const now = Math.floor(Date.now() / 1000)
  const hash = await mod('serviceAuth').deriveIntegrationTokenHash(HASH_KEY, CLIENT_ID, SECRET)
  db.prepare(`INSERT INTO integration_client_tokens (id, client_id, slot, secret_hash, created_at, not_before, expires_at)
    VALUES ('token_identifier_00000001', ?, 'current', ?, ?, ?, ?)`).run(CLIENT_ID, hash, now - 100, now - 100, now + 3600)
  db.prepare(`INSERT INTO integration_client_token_scopes (token_id, scope) VALUES ('token_identifier_00000001', 'community.cop.write')`).run()

  const sessions = new Map([
    ['session-owner', JSON.stringify({ user_id: 1 })],
    ['session-editor', JSON.stringify({ user_id: 2 })],
    ['session-viewer', JSON.stringify({ user_id: 3 })],
    ['session-attacker', JSON.stringify({ user_id: 4 })],
  ])
  const cache = kv ? fakeKv() : undefined
  const bucket = r2 ? fakeR2() : undefined
  const env = {
    DB: d1(db),
    SESSIONS: { get: async (k) => sessions.get(k) ?? null },
    ENVIRONMENT: 'production',
    INTEGRATION_TOKEN_HASH_KEY: HASH_KEY,
    COMMUNITY_INTEGRATIONS_ENABLED: 'true',
    COP_SERVICE_ENABLED: 'true',
    ...(cache ? { CACHE: cache } : {}),
    ...(bucket ? { UPLOADS: bucket } : {}),
    ...(ai ? { OPENAI_API_KEY: 'test-openai-key', AI_GATEWAY_ACCOUNT_ID: 'test-account' } : {}),
  }
  return { db, env, kv: cache, r2: bucket }
}

export const as = (who) => (who === 'service' ? { Authorization: `Bearer rt_svc_${CLIENT_ID}.${SECRET}` } : who ? { Authorization: `Bearer session-${who}` } : {})

/**
 * A COP route through the real middleware into the handler, as Pages does.
 * `body`: JSON value; `raw`: bytes/FormData sent as-is.
 */
export async function cop(env, method, path, { who, body, raw, headers = {}, handler, params = {}, data = {} } = {}) {
  const init = { method, headers: { ...as(who), ...headers } }
  if (raw !== undefined) init.body = raw
  else if (body !== undefined) {
    init.body = JSON.stringify(body)
    init.headers['Content-Type'] = 'application/json'
  }
  const request = new Request(`https://researchtools.test${path}`, init)
  const waits = []
  const context = { request, env, params, data, waitUntil: (p) => waits.push(p) }
  context.next = () => handler[`onRequest${method[0]}${method.slice(1).toLowerCase()}`](context)
  return mod('middleware').onRequest(context)
}

/** A public (non-COP) route: the handler directly. */
export async function publicCall(env, handler, method, path, { body, raw, headers = {}, params = {} } = {}) {
  const init = { method, headers: { ...headers } }
  if (raw !== undefined) init.body = raw
  else if (body !== undefined) {
    init.body = JSON.stringify(body)
    init.headers['Content-Type'] = 'application/json'
  }
  const request = new Request(`https://researchtools.test${path}`, init)
  const waits = []
  const context = { request, env, params, data: {}, waitUntil: (p) => waits.push(p.catch?.(() => {})) }
  return handler[`onRequest${method[0]}${method.slice(1).toLowerCase()}`](context)
}

export const events = (db, entityType) =>
  db.prepare('SELECT event_type, entity_type, entity_id FROM cop_events WHERE entity_type = ? ORDER BY rowid').all(entityType)

// ── Images ─────────────────────────────────────────────────────────

export const b64 = (s) => new Uint8Array(Buffer.from(s, 'base64'))

/** An Exif APP1 segment: Orientation and a GPS IFD (latitude 48°51′30″ N). */
export function exifApp1({ orientation = 6 } = {}) {
  const t = []
  const u16 = (v) => t.push((v >> 8) & 255, v & 255)
  const u32 = (v) => t.push((v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255)
  t.push(0x4d, 0x4d); u16(42); u32(8)
  u16(2)
  u16(0x0112); u16(3); u32(1); u16(orientation); u16(0)
  u16(0x8825); u16(4); u32(1); u32(38)
  u32(0)
  u16(2)
  u16(0x0001); u16(2); u32(2); t.push(0x4e, 0, 0, 0)
  u16(0x0002); u16(5); u32(3); u32(68)
  u32(0)
  for (const [n, d] of [[48, 1], [51, 1], [30, 1]]) { u32(n); u32(d) }
  const payload = [...Buffer.from('Exif\0\0', 'binary'), ...t]
  const len = payload.length + 2
  return Uint8Array.from([0xff, 0xe1, len >> 8, len & 255, ...payload])
}

const segment = (code, text) => {
  const p = Buffer.from(text)
  const len = p.length + 2
  return Uint8Array.from([0xff, code, len >> 8, len & 255, ...p])
}

/** A real JPEG with GPS EXIF, XMP, IPTC, a comment and data after the end marker spliced in. */
export function jpegWithMetadata(base, options) {
  return Uint8Array.from(Buffer.concat([
    base.subarray(0, 2),
    exifApp1(options),
    segment(0xe1, 'http://ns.adobe.com/xap/1.0/\0<x:xmpmeta>Alice Example</x:xmpmeta>'),
    segment(0xed, 'Photoshop 3.0\0IPTC Alice Example'),
    segment(0xfe, 'shot by Alice Example at home'),
    base.subarray(2),
    Buffer.from('TRAILING-SECRET'),
  ].map((p) => Buffer.from(p))))
}

/** True when any of the planted metadata strings survived. */
export function leaksMetadata(bytes) {
  const raw = Buffer.from(bytes)
  return ['Alice', 'TRAILING', 'secret comment', 'TestCam'].some((s) => raw.includes(Buffer.from(s)))
}

/** The IFD0 entry tags of every Exif APP1 block in a JPEG's header (before the first scan). */
export function jpegExifTags(bytes) {
  const out = []
  let i = 2
  while (i + 4 <= bytes.length && bytes[i] === 0xff) {
    const code = bytes[i + 1]
    if (code === 0xda || code === 0xd9) break
    const len = (bytes[i + 2] << 8) | bytes[i + 3]
    const payload = bytes.subarray(i + 4, i + 2 + len)
    if (code === 0xe1 && Buffer.from(payload.subarray(0, 6)).toString('binary') === 'Exif\0\0') {
      const t = 6
      const le = payload[t] === 0x49
      const r16 = (p) => (le ? payload[p] | (payload[p + 1] << 8) : (payload[p] << 8) | payload[p + 1])
      const r32 = (p) => (le ? (payload[p] | (payload[p + 1] << 8) | (payload[p + 2] << 16)) + payload[p + 3] * 2 ** 24 : payload[p] * 2 ** 24 + ((payload[p + 1] << 16) | (payload[p + 2] << 8) | payload[p + 3]))
      const ifd = t + r32(t + 4)
      const tags = []
      for (let n = 0; n < r16(ifd); n++) tags.push(r16(ifd + 2 + n * 12))
      out.push(tags)
    }
    i += 2 + len
  }
  return out
}

export const dataUrl = (type, bytes) => `data:${type};base64,${Buffer.from(bytes).toString('base64')}`
