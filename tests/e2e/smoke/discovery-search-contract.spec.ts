/**
 * The command palette's "my content" half, exercised against in-memory D1.
 *
 * The palette already ranks the static catalogue of tools and frameworks. This endpoint is
 * the other half — the analyses and entities the caller actually made — and the thing most
 * worth pinning is not the ranking but the **scope**: a search that reaches into a workspace
 * the caller does not belong to is a data leak wearing a convenience feature.
 */
import { test, expect } from '@playwright/test'
import { Miniflare } from 'miniflare'
import type { D1Database } from '@cloudflare/workers-types'
import { onRequest as handleSearch } from '../../../functions/api/discovery/search'

const USER_HASH = 'discovery-search-test-hash'
const OTHER_HASH = 'discovery-search-other-hash'

const SCHEMA = `
  CREATE TABLE users (id INTEGER PRIMARY KEY, user_hash TEXT UNIQUE, is_active INTEGER DEFAULT 1);
  CREATE TABLE workspaces (id TEXT PRIMARY KEY, owner_id INTEGER, is_public INTEGER DEFAULT 0);
  CREATE TABLE workspace_members (workspace_id TEXT, user_id INTEGER, role TEXT);

  CREATE TABLE framework_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, workspace_id TEXT,
    title TEXT, description TEXT, framework_type TEXT, updated_at TEXT
  );
  CREATE TABLE cop_sessions (
    id TEXT PRIMARY KEY, workspace_id TEXT, created_by INTEGER,
    name TEXT, description TEXT, updated_at TEXT
  );
  CREATE TABLE actors (
    id TEXT PRIMARY KEY, workspace_id TEXT, created_by INTEGER,
    name TEXT, description TEXT, updated_at TEXT
  );
  CREATE TABLE investigations (
    id TEXT PRIMARY KEY, workspace_id TEXT, created_by INTEGER,
    title TEXT, description TEXT, updated_at TEXT
  );
  CREATE TABLE cross_tables (
    id TEXT PRIMARY KEY, workspace_id TEXT, user_id INTEGER,
    title TEXT, description TEXT, updated_at TEXT
  );

  INSERT INTO users (id, user_hash) VALUES (1, '${USER_HASH}'), (2, '${OTHER_HASH}');
  -- ws-own: owned outright. ws-member: someone else's, joined. ws-foreign: neither.
  INSERT INTO workspaces (id, owner_id) VALUES ('ws-own', 1), ('ws-member', 2), ('ws-foreign', 2);
  INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ('ws-member', 1, 'EDITOR');

  INSERT INTO framework_sessions (id, user_id, workspace_id, title, description, framework_type, updated_at) VALUES
    (10, 1, 'ws-own',     'Harbour access analysis', 'Routes into the port',  'starbursting', '2026-09-01'),
    (11, 2, 'ws-member',  'Harbour staffing',        'Shift patterns',        'swot',         '2026-09-02'),
    (12, 2, 'ws-foreign', 'Harbour secrets',         'Not for this caller',   'cog',          '2026-09-03');
  INSERT INTO cop_sessions (id, workspace_id, created_by, name, description, updated_at) VALUES
    ('cop-1', 'ws-own', 1, 'Harbour watch', 'Live picture', '2026-09-04');
  INSERT INTO actors (id, workspace_id, created_by, name, description, updated_at) VALUES
    ('actor-1', 'ws-own', 1, 'Port Authority', 'Operates the harbour', '2026-09-05');
  INSERT INTO investigations (id, workspace_id, created_by, title, description, updated_at) VALUES
    ('inv-1', 'ws-member', 2, 'Harbour incident', 'Follow-up', '2026-09-06');
  INSERT INTO cross_tables (id, workspace_id, user_id, title, description, updated_at) VALUES
    ('ct-1', 'ws-own', 1, 'Harbour options', 'Comparison', '2026-09-07');
  -- A literal wildcard in real data, so the escaping can be shown to find it rather than
  -- merely to match nothing.
  INSERT INTO actors (id, workspace_id, created_by, name, description, updated_at) VALUES
    ('actor-2', 'ws-own', 1, '100% owned subsidiary', 'Wildcard in the name', '2026-09-08');
`

async function executeSql(db: D1Database, sql: string) {
  const cleaned = sql.replace(/^\s*--.*$/gm, '')
  for (const statement of cleaned.split(';').map(v => v.trim()).filter(Boolean)) {
    await db.prepare(statement).run()
  }
}

function request(query: string, headers: Record<string, string> = { 'X-User-Hash': USER_HASH }) {
  return new Request(`https://researchtools.net/api/discovery/search?q=${encodeURIComponent(query)}`, { headers })
}

interface Hit { kind: string; id: string; title: string; href: string }

async function search(db: D1Database, query: string, headers?: Record<string, string>) {
  const response = await handleSearch({ request: request(query, headers), env: { DB: db } as never })
  expect(response.status).toBe(200)
  return ((await response.json()) as { results: Hit[] }).results
}

async function withDb(run: (db: D1Database) => Promise<void>) {
  const mf = new Miniflare({
    modules: true,
    script: 'export default { fetch() { return new Response("ok") } }',
    d1Databases: { DB: 'discovery-search-test' },
  })
  try {
    const db = await mf.getD1Database('DB')
    await executeSql(db, SCHEMA)
    await run(db)
  } finally {
    await mf.dispose()
  }
}

test.describe('discovery content search @smoke', () => {
  test('@smoke reaches owned and joined workspaces, and no further', async () => {
    await withDb(async (db) => {
      const results = await search(db, 'harbour')
      const titles = results.map(hit => hit.title)

      expect(titles).toContain('Harbour access analysis') // owned workspace
      expect(titles).toContain('Harbour staffing')        // joined as a member
      // Ownership of a workspace does not require a workspace_members row, so scoping on
      // membership alone would have hidden the caller's own workspaces from them.
      expect(titles).toContain('Harbour incident')

      // The one that matters: same word, a workspace the caller neither owns nor joined.
      expect(titles).not.toContain('Harbour secrets')
    })
  })

  test('@smoke every kind carries a link that opens that one thing', async () => {
    await withDb(async (db) => {
      const byKind = new Map((await search(db, 'harbour')).map(hit => [hit.kind, hit.href]))
      expect(byKind.get('cop')).toBe('/dashboard/cop/cop-1')
      expect(byKind.get('actor')).toBe('/dashboard/entities/actors/actor-1')
      expect(byKind.get('investigation')).toBe('/dashboard/investigations/inv-1')
      expect(byKind.get('cross-table')).toBe('/dashboard/tools/cross-table/ct-1')
      // starbursting is routed `:id/:action`, so a bare id would be read as a verb.
      expect(byKind.get('framework')).toBe('/dashboard/analysis-frameworks/starbursting/10/view')
    })
  })

  test('@smoke a signed-out caller gets an empty list, not a 401', async () => {
    // The palette asks on every keystroke. An error there renders as a broken feature for
    // someone who is only browsing the static catalogue.
    await withDb(async (db) => {
      expect(await search(db, 'harbour', {})).toEqual([])
    })
  })

  test('@smoke one character searches nothing', async () => {
    await withDb(async (db) => {
      expect(await search(db, 'h')).toEqual([])
      expect(await search(db, '   ')).toEqual([])
    })
  })

  test('@smoke a LIKE wildcard in the query is matched literally, not expanded', async () => {
    await withDb(async (db) => {
      // Unescaped, `%` matches every row and turns the palette into a data dump.
      expect(await search(db, '%%')).toEqual([])
      expect(await search(db, 'harb%our')).toEqual([])

      // And the other half, which the first version of this test missed: escaping without
      // an ESCAPE clause on the LIKE makes `%` match *nothing*, which looks like a pass.
      // A title that really contains a percent sign has to be findable.
      const found = await search(db, '100%')
      expect(found.map(hit => hit.title)).toContain('100% owned subsidiary')
    })
  })

  test('@smoke an exact title outranks a description match', async () => {
    await withDb(async (db) => {
      const results = await search(db, 'harbour options')
      expect(results[0]?.title).toBe('Harbour options')
    })
  })
})
