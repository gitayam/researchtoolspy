/**
 * Shared fixture for the COP input-core suites (cop-core*.test.mjs).
 *
 * - The real route modules are bundled with esbuild; a module that does not build is
 *   reported by the tests that use it (mod()).
 * - node:sqlite behind a D1 shim (run/first/all/batch, meta.changes / last_row_id,
 *   booleans bound as 1/0 as D1 does), foreign keys on as in D1, with the production
 *   DDL of the COP tables (tests/unit/fixtures/cop-schema.sql) and the real managed
 *   migrations from 0020 on. `core: false` leaves migration 0022 out, to test that the
 *   routes still work before it is applied.
 * - Outbound fetch is refused.
 */
import { before, after } from 'node:test'
import { DatabaseSync } from 'node:sqlite'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build } from 'esbuild'

export const ROOT = new URL('../../', import.meta.url).pathname

const R = 'functions/api/cop/[id]/'
export const ENTRIES = {
  serviceAuth: 'functions/api/_shared/service-auth.ts',
  copEvents: 'functions/api/_shared/cop-events.ts',
  copInput: 'functions/api/_shared/cop-input.ts',
  copPublic: 'functions/api/_shared/cop-public.ts',
  middleware: 'functions/api/cop/_middleware.ts',
  activity: `${R}activity.ts`,
  alerts: `${R}alerts.ts`,
  assets: `${R}assets.ts`,
  assetCheckIn: `${R}assets/[assetId]/check-in.ts`,
  claims: `${R}claims.ts`,
  collaborators: `${R}collaborators.ts`,
  evidence: `${R}evidence.ts`,
  evidenceBatch: `${R}evidence/batch.ts`,
  export: `${R}export.ts`,
  hypotheses: `${R}hypotheses.ts`,
  intakeForms: `${R}intake-forms.ts`,
  intakeForm: `${R}intake-forms/[formId].ts`,
  markerChangelog: `${R}marker-changelog.ts`,
  markers: `${R}markers.ts`,
  personas: `${R}personas.ts`,
  playbooks: `${R}playbooks.ts`,
  playbook: `${R}playbooks/[pbId].ts`,
  playbookRules: `${R}playbooks/[pbId]/rules.ts`,
  playbookTest: `${R}playbooks/[pbId]/test.ts`,
  poo: `${R}poo-estimates.ts`,
  rfis: `${R}rfis.ts`,
  rfi: `${R}rfis/[rfiId].ts`,
  rfiAnswers: `${R}rfis/[rfiId]/answers.ts`,
  scrape: `${R}scrape.ts`,
  shares: `${R}shares.ts`,
  taskDependencies: `${R}task-dependencies.ts`,
  taskTemplates: `${R}task-templates.ts`,
  tasks: `${R}tasks.ts`,
  taskReassign: `${R}tasks/[taskId]/reassign.ts`,
  taskDeploy: `${R}tasks/deploy-template.ts`,
  timeline: `${R}timeline.ts`,
  webcams: `${R}webcams.ts`,
  webcam: `${R}webcams/[camId].ts`,
  changes: `${R}changes.ts`,
  events: `${R}events.ts`,
  sessions: 'functions/api/cop/sessions.ts',
  sessionItem: 'functions/api/cop/sessions/[id].ts',
  publicShare: 'functions/api/cop/public/[token].ts',
  publicChanges: 'functions/api/cop/public/[token]/changes.ts',
  publicAnswers: 'functions/api/cop/public/[token]/rfis/[rfiId]/answers.ts',
}

/**
 * Bundles that hold several modules together, as Pages bundles every route into one
 * worker: the COP middleware and the routes then share cop-events (and its event
 * tracker), which separate bundles cannot.
 */
export const COMBINED = {
  pipeline: `
    export { onRequest as middleware } from './functions/api/cop/_middleware.ts'
    export { onRequestPost as rfisPost } from './functions/api/cop/[id]/rfis.ts'
    export { emitCopEvent } from './functions/api/_shared/cop-events.ts'
  `,
}

const built = {}
const buildErrors = {}
const realFetch = globalThis.fetch

/** Call once at the top of a suite: bundles every entry and refuses outbound fetch. */
export function setupCoreSuite() {
  before(async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rt-cop-core-'))
    try {
      await Promise.all(Object.entries(COMBINED).map(async ([name, contents]) => {
        const outfile = join(dir, `${name}.mjs`)
        try {
          await build({
            stdin: { contents, resolveDir: ROOT, loader: 'ts', sourcefile: `${name}.ts` },
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
      }))
      await Promise.all(Object.entries(ENTRIES).map(async ([name, entry]) => {
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
      }))
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
    globalThis.fetch = async (input) => {
      throw new Error(`unexpected outbound fetch: ${typeof input === 'string' ? input : input?.url}`)
    }
  })
  after(() => {
    globalThis.fetch = realFetch
  })
}

export function mod(name) {
  if (!built[name]) throw new Error(`${ENTRIES[name] ?? name} did not build: ${buildErrors[name]?.message ?? 'missing'}`)
  return built[name]
}

// ── KV ─────────────────────────────────────────────────────────────

export function fakeKv() {
  const store = new Map()
  return {
    store,
    failPuts: false,
    failGets: false,
    async get(key) {
      if (this.failGets) throw new Error('KV get failed')
      return store.has(key) ? store.get(key) : null
    },
    async put(key, value, options = {}) {
      if (options.expirationTtl !== undefined && options.expirationTtl < 60) {
        throw new Error(`KV put failed: expirationTtl ${options.expirationTtl} is below 60`)
      }
      if (this.failPuts) throw new Error('KV put failed: write rate limited')
      store.set(key, String(value))
    },
    async delete(key) {
      store.delete(key)
    },
  }
}

// ── D1 ─────────────────────────────────────────────────────────────

const d1Value = (v) => (typeof v === 'boolean' ? (v ? 1 : 0) : v)

export function d1(db) {
  const statement = (sql, args = []) => ({
    sql,
    args,
    bind: (...next) => statement(sql, next.map(d1Value)),
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
  return {
    prepare: (sql) => statement(sql),
    // D1 runs a batch as one transaction.
    async batch(statements) {
      db.exec('BEGIN')
      try {
        const out = statements.map((s) => {
          const r = db.prepare(s.sql).run(...s.args)
          return { success: true, meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } }
        })
        db.exec('COMMIT')
        return out
      } catch (error) {
        db.exec('ROLLBACK')
        throw error
      }
    },
  }
}

// ── Fixture ────────────────────────────────────────────────────────

export const CLIENT_ID = 'irregularchat-signal-test'
const SECRET = 'A'.repeat(43)
const HASH_KEY = 'integration-test-key-material-0000000000000000'
export const SERVICE_USER = 73
export const SESSION = 'cop-core'
export const OTHER_SESSION = 'cop-other'
export const WS = 'ws-owner'
export const OTHER_WS = 'ws-other'
export const migration = (name) => readFileSync(join(ROOT, 'schema/managed-migrations', name), 'utf8')

/**
 * core: apply migration 0022 (after seeding, so its backfill runs on the seed);
 * keyQuestions: the main session's key_questions before 0022; kv: bind CACHE.
 */
export async function fixture({ core = true, keyQuestions = ['Who is at the gate?', 'When does it start?'], kv = true, seed } = {}) {
  const db = new DatabaseSync(':memory:')
  db.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY, username TEXT NOT NULL UNIQUE, email TEXT NOT NULL UNIQUE,
      full_name TEXT NOT NULL, hashed_password TEXT NOT NULL, user_hash TEXT, account_hash TEXT,
      oidc_sub TEXT, oidc_provider TEXT, oidc_email TEXT, is_active INTEGER NOT NULL DEFAULT 1,
      is_verified INTEGER DEFAULT 0, role TEXT NOT NULL DEFAULT 'user', created_at TEXT
    );
    CREATE TABLE workspaces (
      id TEXT PRIMARY KEY, name TEXT, description TEXT, type TEXT NOT NULL DEFAULT 'PERSONAL',
      owner_id INTEGER NOT NULL, is_public INTEGER NOT NULL DEFAULT 0, created_at TEXT, updated_at TEXT
    );
    CREATE TABLE workspace_members (id TEXT, workspace_id TEXT NOT NULL, user_id INTEGER NOT NULL, role TEXT NOT NULL);
    CREATE TABLE investigations (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, created_by INTEGER NOT NULL, status TEXT NOT NULL);
    CREATE TABLE actors (id TEXT PRIMARY KEY);
    CREATE TABLE claim_adjustments (id TEXT PRIMARY KEY);
    CREATE TABLE source_artifacts (id TEXT PRIMARY KEY);
    CREATE TABLE source_passages (id TEXT PRIMARY KEY);
    CREATE TABLE events (id TEXT PRIMARY KEY, name TEXT, description TEXT, event_type TEXT, date_start TEXT,
      workspace_id TEXT, created_by INTEGER, created_at TEXT, updated_at TEXT);
    CREATE TABLE event_logs (level TEXT, source TEXT, message TEXT, context TEXT, user_id INTEGER);
  `)
  db.exec(migration('0009_community_service_auth.sql'))
  db.exec(migration('0010_service_principal_identity_compat.sql'))
  db.exec(readFileSync(join(ROOT, 'tests/unit/fixtures/cop-schema.sql'), 'utf8'))
  db.exec(migration('0020_cop_webcams.sql'))
  db.exec(migration('0021_cop_webcam_sources.sql'))

  db.exec(`
    INSERT INTO users (id, username, email, full_name, hashed_password, role) VALUES
      (1, 'owner', 'owner@example.test', 'Owner', 'x', 'user'),
      (2, 'editor', 'editor@example.test', 'Editor', 'x', 'user'),
      (3, 'viewer', 'viewer@example.test', 'Viewer', 'x', 'user'),
      (4, 'stranger', 'stranger@example.test', 'Stranger', 'x', 'user'),
      (5, 'admin', 'admin@example.test', 'Admin collaborator', 'x', 'user');
    INSERT INTO users (id, username, email, full_name, hashed_password, role)
      VALUES (${SERVICE_USER}, 'service_${CLIENT_ID}', 'service+${CLIENT_ID}@service.invalid',
        'Integration Service', 'SERVICE_AUTH_DISABLED', 'service');
    INSERT INTO workspaces (id, type, owner_id, is_public) VALUES
      ('1', 'PUBLIC', 1, 1), ('workspace-test', 'TEAM', ${SERVICE_USER}, 0),
      ('${WS}', 'PERSONAL', 1, 0), ('${OTHER_WS}', 'PERSONAL', 4, 0);
    INSERT INTO investigations (id, workspace_id, created_by, status)
      VALUES ('investigation-test', 'workspace-test', ${SERVICE_USER}, 'active');
    INSERT INTO integration_clients
      (id, community_id, workspace_id, intake_investigation_id, principal_user_id, environment, maximum_visibility, status)
      VALUES ('${CLIENT_ID}', 'community-test', 'workspace-test', 'investigation-test', ${SERVICE_USER}, 'production', 'community', 'active');
  `)
  const insertSession = db.prepare(`INSERT INTO cop_sessions (id, name, description, template_type, status, center_lat, center_lon,
    active_layers, key_questions, workspace_id, created_by) VALUES (?, ?, ?, 'custom', 'ACTIVE', 48.86, 2.29, ?, ?, ?, ?)`)
  insertSession.run(SESSION, 'Paris overwatch', 'Research overwatch practice', '["cop-markers"]', JSON.stringify(keyQuestions), WS, 1)
  insertSession.run(OTHER_SESSION, 'Somebody else', null, '[]', '[]', OTHER_WS, 4)
  db.exec(`
    INSERT INTO cop_collaborators (id, cop_session_id, user_id, role) VALUES
      ('col-editor', '${SESSION}', 2, 'Editor'),
      ('col-viewer', '${SESSION}', 3, 'viewer'),
      ('col-admin', '${SESSION}', 5, 'admin'),
      ('col-service', '${SESSION}', ${SERVICE_USER}, 'editor');
    INSERT INTO cop_rfis (id, cop_session_id, question, created_by) VALUES ('rfi-existing', '${SESSION}', 'who is at the gate', 1);
  `)
  seed?.(db)
  if (core) db.exec(migration('0022_cop_input_core.sql'))

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
    ['session-admin', JSON.stringify({ user_id: 5 })],
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
  }
  return { db, env, kv: cache }
}

export const as = (who) => (who === 'anonymous' ? {} : { Authorization: `Bearer session-${who}` })
export const SERVICE_AUTH = { Authorization: `Bearer rt_svc_${CLIENT_ID}.${SECRET}` }

/**
 * Call a handler. `through: 'middleware'` runs the COP middleware first (as Pages does);
 * otherwise the handler is called directly, so a test sees only what the handler does.
 */
export async function call(env, handlerName, method, path, { who = 'owner', headers = {}, body, params = {}, through, waits } = {}) {
  // 'service': the bot's credential, checked by the middleware. 'service-admitted': what the
  // middleware leaves for a service it admitted, for routes the allow-list doesn't open yet.
  const auth = who === 'service' ? SERVICE_AUTH : who === 'service-admitted' ? {} : as(who)
  const request = new Request(`https://researchtools.test${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...auth, ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = who === 'service-admitted'
    ? { copService: { clientId: CLIENT_ID, principalUserId: SERVICE_USER, workspaceId: 'workspace-test' } }
    : {}
  const context = { request, env, params, data, waitUntil: (p) => waits?.push(p) }
  const handler = mod(handlerName)
  const fn = handler[`onRequest${method[0]}${method.slice(1).toLowerCase()}`]
  if (!fn) throw new Error(`${handlerName} has no ${method} handler`)
  if (through === 'middleware') {
    context.next = () => fn(context)
    return mod('middleware').onRequest(context)
  }
  return fn(context)
}

export const count = (db, table, where = '1 = 1', ...args) => db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${where}`).get(...args).n
export const events = (db, session = SESSION) =>
  db.prepare('SELECT rowid AS seq, id, event_type, entity_type, entity_id FROM cop_events WHERE cop_session_id = ? ORDER BY rowid').all(session)
