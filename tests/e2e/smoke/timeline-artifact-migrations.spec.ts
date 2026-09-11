/**
 * Full managed-chain rehearsal against synthetic prerequisites in real local D1.
 * This is NOT a production-equivalent schema or an audited production prefix.
 * Prerequisite columns derive from checked-in schema/migrations/005, 041, 057,
 * 060, 066, 096 and the existing deception-eve-storage, d1-composite-indexes and
 * community-service-auth-migration fixtures. No historical migration is edited
 * or blindly replayed: that directory contains competing/legacy schema variants.
 */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import type { TestInfo } from '@playwright/test'
import type { D1Database } from '@cloudflare/workers-types'
import { Miniflare } from 'miniflare'

const migrationNames = [
  '0001_add_evidence_eve_assessment.sql',
  '0002_add_framework_sharing_counters.sql',
  '0003_add_evidence_link_metadata.sql',
  '0004_add_hot_path_composite_indexes.sql',
  '0005_drop_redundant_content_analysis_indexes.sql',
  '0006_scraping_auth_idempotency.sql',
  '0007_answer_packet_storage.sql',
  '0008_guest_conversion_idempotency.sql',
  '0009_community_service_auth.sql',
  '0010_service_principal_identity_compat.sql',
  '0011_timeline_foundation.sql',
] as const
const migrations = migrationNames.map(name => {
  const bytes = readFileSync(new URL(`../../../schema/managed-migrations/${name}`, import.meta.url))
  return { name, sql: bytes.toString('utf8'), bytes: bytes.byteLength, sha256: createHash('sha256').update(bytes).digest('hex') }
})

/** Preserve trigger BEGIN/CASE bodies and quoted/commented semicolons. */
function statements(sql: string): string[] {
  const result: string[] = []
  let start = 0
  let token = ''
  let tokens: string[] = []
  let trigger = false
  let depth = 0
  let quote = ''
  let lineComment = false
  let blockComment = false
  const flush = () => {
    if (!token) return
    const word = token.toUpperCase()
    tokens.push(word)
    if (tokens[0] === 'CREATE' && word === 'TRIGGER') trigger = true
    if (trigger && (word === 'BEGIN' || word === 'CASE')) depth += 1
    if (trigger && word === 'END') depth -= 1
    token = ''
  }
  for (let index = 0; index < sql.length; index += 1) {
    const character = sql[index]
    const next = sql[index + 1]
    if (lineComment) { if (character === '\n') lineComment = false; continue }
    if (blockComment) { if (character === '*' && next === '/') { blockComment = false; index += 1 }; continue }
    if (quote) {
      if (character === quote) {
        if (next === quote && quote !== ']') index += 1
        else quote = ''
      }
      continue
    }
    if (character === '-' && next === '-') { flush(); lineComment = true; index += 1; continue }
    if (character === '/' && next === '*') { flush(); blockComment = true; index += 1; continue }
    if (character === "'" || character === '"' || character === '`' || character === '[') { flush(); quote = character === '[' ? ']' : character; continue }
    if (/[A-Za-z_]/.test(character)) { token += character; continue }
    flush()
    if (character === ';' && (!trigger || depth === 0)) {
      if (tokens.length) result.push(sql.slice(start, index + 1).trim())
      start = index + 1
      tokens = []
      trigger = false
      depth = 0
    }
  }
  flush()
  if (quote || blockComment || depth !== 0) throw new Error('Unterminated SQL statement in migration rehearsal')
  if (tokens.length) result.push(sql.slice(start).trim())
  return result
}

// Intentionally explicit synthetic baseline. Production NOT NULL identity
// constraints are represented; this does not represent every production column,
// index, trigger, row, or applied migration receipt.
const prerequisiteSql = `
CREATE TABLE users (
  id INTEGER PRIMARY KEY, username TEXT NOT NULL UNIQUE, email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL, hashed_password TEXT NOT NULL, user_hash TEXT UNIQUE,
  account_hash TEXT UNIQUE, oidc_sub TEXT, oidc_provider TEXT, oidc_email TEXT,
  is_active INTEGER NOT NULL DEFAULT 1, role TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE workspaces (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, owner_id INTEGER NOT NULL REFERENCES users(id),
  type TEXT NOT NULL CHECK(type IN ('PERSONAL','TEAM','PUBLIC')), is_public INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE workspace_members (
  id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  user_id INTEGER NOT NULL REFERENCES users(id), role TEXT NOT NULL CHECK(role IN ('VIEWER','EDITOR','ADMIN')),
  UNIQUE(workspace_id,user_id)
);
CREATE TABLE investigations (
  id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  created_by INTEGER NOT NULL REFERENCES users(id), title TEXT NOT NULL, status TEXT NOT NULL
);
CREATE TABLE evidence_items (
  id INTEGER PRIMARY KEY, workspace_id TEXT REFERENCES workspaces(id), title TEXT NOT NULL,
  status TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE framework_sessions (
  id INTEGER PRIMARY KEY, workspace_id TEXT REFERENCES workspaces(id), title TEXT NOT NULL,
  framework_type TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE actors (id TEXT PRIMARY KEY, workspace_id TEXT REFERENCES workspaces(id), type TEXT, created_at TEXT);
CREATE TABLE evidence_actors (
  id TEXT PRIMARY KEY, evidence_id INTEGER REFERENCES evidence_items(id), actor_id TEXT REFERENCES actors(id)
);
CREATE TABLE evidence_citations (id INTEGER PRIMARY KEY, evidence_id INTEGER REFERENCES evidence_items(id), citation_format TEXT);
CREATE TABLE content_analysis (id INTEGER PRIMARY KEY, content_hash TEXT, user_id INTEGER REFERENCES users(id), workspace_id TEXT REFERENCES workspaces(id));
CREATE INDEX idx_content_analysis_hash ON content_analysis(content_hash);
CREATE INDEX idx_content_analysis_hash_workspace ON content_analysis(content_hash,workspace_id);
CREATE INDEX idx_content_analysis_user ON content_analysis(user_id);
CREATE INDEX idx_content_analysis_user_workspace ON content_analysis(user_id,workspace_id);
CREATE TABLE claim_evidence_links (id TEXT PRIMARY KEY, evidence_id INTEGER REFERENCES evidence_items(id));
CREATE TABLE guest_conversions (id INTEGER PRIMARY KEY, guest_session_id TEXT, user_id INTEGER NOT NULL REFERENCES users(id));
CREATE TABLE cop_sessions (
  id TEXT PRIMARY KEY, workspace_id TEXT REFERENCES workspaces(id), status TEXT,
  created_by INTEGER REFERENCES users(id), updated_at TEXT
);
CREATE TABLE cop_collaborators (cop_session_id TEXT REFERENCES cop_sessions(id), user_id INTEGER REFERENCES users(id));
CREATE TABLE sources (id TEXT PRIMARY KEY, workspace_id TEXT REFERENCES workspaces(id), type TEXT, created_at TEXT);
CREATE TABLE events (id TEXT PRIMARY KEY, workspace_id TEXT REFERENCES workspaces(id), event_type TEXT, date_start TEXT);
CREATE TABLE places (id TEXT PRIMARY KEY, workspace_id TEXT REFERENCES workspaces(id), place_type TEXT, created_at TEXT);
CREATE TABLE behaviors (id TEXT PRIMARY KEY, workspace_id TEXT REFERENCES workspaces(id), behavior_type TEXT, created_at TEXT);
CREATE TABLE relationships (id TEXT PRIMARY KEY, workspace_id TEXT REFERENCES workspaces(id), relationship_type TEXT, created_at TEXT);
CREATE TABLE cop_activity (id TEXT PRIMARY KEY, cop_session_id TEXT REFERENCES cop_sessions(id), created_at TEXT);
CREATE TABLE cop_tasks (id TEXT PRIMARY KEY, cop_session_id TEXT REFERENCES cop_sessions(id), status TEXT, assigned_to TEXT);
`

async function execute(db: D1Database, sql: string) {
  for (const statement of statements(sql)) await db.prepare(statement).run()
}
async function apply(db: D1Database, start: number, end: number) {
  for (const migration of migrations.slice(start, end)) {
    try { await execute(db, migration.sql) }
    catch (error) { throw new Error(`Managed migration ${migration.name} failed: ${error instanceof Error ? error.message : String(error)}`) }
  }
}
async function prepare() {
  const mf = new Miniflare({ modules: true, script: 'export default { fetch() { return new Response("ok") } }', d1Databases: { DB: 'synthetic-managed-chain' } })
  try {
    const db = await mf.getD1Database('DB')
    await execute(db, prerequisiteSql)
    await db.prepare("INSERT INTO users(id,username,email,full_name,hashed_password,user_hash,role) VALUES (1,'owner','owner@example.test','Owner','NO_LOGIN','fixture-owner-hash','researcher'),(2,'viewer','viewer@example.test','Viewer','NO_LOGIN','fixture-viewer-hash','researcher')").run()
    await db.prepare("INSERT INTO workspaces(id,name,owner_id,type) VALUES ('human-workspace','Private fixture',1,'PERSONAL')").run()
    await db.prepare("INSERT INTO workspace_members VALUES ('viewer-membership','human-workspace',2,'VIEWER')").run()
    await db.prepare("INSERT INTO investigations VALUES ('human-investigation','human-workspace',1,'Synthetic investigation','active')").run()
    await db.prepare("INSERT INTO evidence_items(id,workspace_id,title,status) VALUES (11,'human-workspace','Original evidence','active')").run()
    await db.prepare("INSERT INTO framework_sessions VALUES (12,'human-workspace','Original framework','ach','2026-09-11T00:00:00Z')").run()
    await db.prepare("INSERT INTO actors VALUES ('actor-one','human-workspace','PERSON','2026-09-11T00:00:00Z')").run()
    await db.prepare("INSERT INTO evidence_actors VALUES ('evidence-actor',11,'actor-one')").run()
    await db.prepare("INSERT INTO evidence_citations VALUES (13,11,'APA')").run()
    await db.prepare("INSERT INTO content_analysis VALUES (14,'fixture-content-hash',1,'human-workspace')").run()
    await db.prepare("INSERT INTO claim_evidence_links VALUES ('claim-link',11)").run()
    await db.prepare("INSERT INTO guest_conversions VALUES (21,'guest-one',1),(22,'guest-one',1),(23,'guest-two',1)").run()
    return { mf, db }
  } catch (error) { await mf.dispose(); throw error }
}
async function attachReceipt(testInfo: TestInfo, lane: string) {
  await testInfo.attach('synthetic-managed-migration-receipt', {
    contentType: 'application/json', body: Buffer.from(JSON.stringify({
      lane, prerequisiteClass: 'synthetic; not production-equivalent',
      prerequisiteSha256: createHash('sha256').update(prerequisiteSql).digest('hex'),
      migrations: migrations.map(({ name, bytes, sha256 }) => ({ name, bytes, sha256 })),
    }, null, 2)),
  })
async function legacySnapshot(db: D1Database) {
  const tables = ['users','workspaces','workspace_members','investigations','evidence_items','framework_sessions','actors','evidence_actors','evidence_citations','content_analysis','claim_evidence_links','guest_conversions','integration_clients','integration_client_tokens','integration_client_token_scopes']
  const snapshot: Record<string, unknown> = {}
  for (const table of tables) snapshot[table] = (await db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()).results
  return snapshot
}

test.describe('timeline full managed-chain migration rehearsal @smoke', () => {
  test('SQL parser retains trigger bodies, CASE expressions and quoted semicolons', () => {
    const sql = `-- ignored ; END\nCREATE TRIGGER sample BEFORE INSERT ON t BEGIN
      SELECT (CASE WHEN NEW.value='quoted;END' THEN RAISE(ABORT,'no; value') END);
      /* ; END; */ SELECT 'it''s retained;'; END;
      SELECT 1;`
    const parsed = statements(sql)
    expect(parsed).toHaveLength(2)
    expect(parsed[0]).toContain("SELECT 'it''s retained;'; END;")
    expect(parsed[1]).toBe('SELECT 1;')
    expect(statements(migrations[8].sql).filter(sql => /CREATE TRIGGER/i.test(sql))).toHaveLength(8)
  })

  test('fresh synthetic prerequisites accept every actual managed migration and preserve intended legacy values', async ({}, testInfo) => {
    const { mf, db } = await prepare()
    try {
      expect((await db.prepare("SELECT name FROM sqlite_schema WHERE type='index' AND name IN ('idx_content_analysis_hash','idx_content_analysis_user')").all()).results).toHaveLength(2)
      await apply(db, 0, migrations.length)
      expect(await db.prepare('SELECT title,eve_assessment,source_artifact_id FROM evidence_items WHERE id=11').first()).toEqual({ title: 'Original evidence', eve_assessment: null, source_artifact_id: null })
      expect(await db.prepare('SELECT title,view_count,clone_count FROM framework_sessions WHERE id=12').first()).toEqual({ title: 'Original framework', view_count: 0, clone_count: 0 })
      expect(await db.prepare("SELECT auto_linked FROM evidence_actors WHERE id='evidence-actor'").first()).toEqual({ auto_linked: 0 })
      expect(await db.prepare('SELECT citation_format,citation_type,relevance_score,notes,created_by FROM evidence_citations WHERE id=13').first()).toEqual({ citation_format: 'APA', citation_type: 'primary', relevance_score: 5, notes: null, created_by: null })
      expect((await db.prepare('SELECT id FROM guest_conversions ORDER BY id').all()).results).toEqual([{ id: 21 }, { id: 23 }])
      await expect(db.prepare("INSERT INTO guest_conversions VALUES (24,'guest-one',1)").run()).rejects.toThrow(/UNIQUE/)
      const indexes = (await db.prepare("SELECT name FROM sqlite_schema WHERE type='index'").all<{ name: string }>()).results.map(row => row.name)
      expect(indexes).not.toContain('idx_content_analysis_hash')
      expect(indexes).not.toContain('idx_content_analysis_user')
      expect(indexes).toEqual(expect.arrayContaining(['idx_content_analysis_hash_workspace','idx_content_analysis_user_workspace','idx_cop_collaborators_session_user','idx_workspace_members_user_workspace','idx_guest_conversions_identity']))
      expect((await db.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name LIKE 'timeline_%'").all()).results.length).toBeGreaterThanOrEqual(8)
      expect((await db.prepare('PRAGMA foreign_key_check').all()).results).toEqual([])
      await attachReceipt(testInfo, 'fresh-synthetic-prerequisites-through-0011')
    } finally { await mf.dispose() }
  })

  test('synthetic 0010 prefix upgrades with human and service sentinels unchanged', async ({}, testInfo) => {
    const { mf, db } = await prepare()
    try {
      await apply(db, 0, 10)
      await db.prepare("INSERT INTO users(id,username,email,full_name,hashed_password,role) VALUES (73,'service_community_client_01','service+community_client_01@service.invalid','Integration fixture','SERVICE_AUTH_DISABLED','service')").run()
      await db.prepare("INSERT INTO workspaces(id,name,owner_id,type) VALUES ('service-workspace','Service fixture',73,'TEAM')").run()
      await db.prepare("INSERT INTO investigations VALUES ('service-investigation','service-workspace',73,'System intake','active')").run()
      await db.prepare("INSERT INTO integration_clients(id,community_id,workspace_id,intake_investigation_id,principal_user_id,environment,maximum_visibility,status) VALUES ('community_client_01','community-fixture','service-workspace','service-investigation',73,'development','private','active')").run()
      await db.prepare("UPDATE evidence_items SET eve_assessment='preserved-fixture-json' WHERE id=11").run()
      await db.prepare('UPDATE framework_sessions SET view_count=9,clone_count=3 WHERE id=12').run()
      const before = await legacySnapshot(db)
      await apply(db, 10, 11)
      expect(await legacySnapshot(db)).toEqual(before)
      expect((await db.prepare('PRAGMA foreign_key_check').all()).results).toEqual([])
      await expect(db.prepare("UPDATE users SET email='changed@example.test' WHERE id=73").run()).rejects.toThrow(/invalid integration service principal update/)
      await expect(db.prepare("INSERT INTO workspace_members VALUES ('invalid-service-member','human-workspace',73,'VIEWER')").run()).rejects.toThrow(/cannot be a workspace member/)
      await attachReceipt(testInfo, 'seeded-synthetic-0010-prefix-to-0011')
    } finally { await mf.dispose() }
  })
})
