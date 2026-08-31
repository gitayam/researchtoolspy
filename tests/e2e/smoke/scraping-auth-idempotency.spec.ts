import { test, expect } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { DatabaseSync, type SQLInputValue } from 'node:sqlite'
import { onRequestGet, onRequestPost } from '../../../functions/api/cop/[id]/scrape'
import { onRequestPost as analyzeUrlPost } from '../../../functions/api/content-intelligence/analyze-url'
import { buildScrapeItemIdentity } from '../../../functions/api/cop/[id]/_scrape-idempotency'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const migration = fs.readFileSync(
  path.join(root, 'schema/managed-migrations/0006_scraping_auth_idempotency.sql'),
  'utf8',
)

class SqliteD1Statement {
  constructor(
    private readonly database: DatabaseSync,
    private readonly sql: string,
    private readonly bindings: SQLInputValue[] = [],
  ) {}

  bind(...bindings: SQLInputValue[]) {
    return new SqliteD1Statement(this.database, this.sql, bindings)
  }

  first<T>() {
    return (this.database.prepare(this.sql).get(...this.bindings) as T | undefined) ?? null
  }

  all<T>() {
    return { results: this.database.prepare(this.sql).all(...this.bindings) as T[] }
  }

  run() {
    const result = this.database.prepare(this.sql).run(...this.bindings)
    return {
      success: true,
      meta: {
        changes: Number(result.changes),
        last_row_id: Number(result.lastInsertRowid),
      },
    }
  }
}

class SqliteD1 {
  readonly sqlite = new DatabaseSync(':memory:')

  constructor() {
    this.sqlite.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE users (id INTEGER PRIMARY KEY, user_hash TEXT);
      CREATE TABLE workspaces (id TEXT PRIMARY KEY, owner_id INTEGER, created_at TEXT);
      CREATE TABLE workspace_members (
        id TEXT PRIMARY KEY, workspace_id TEXT, user_id INTEGER, role TEXT, joined_at TEXT
      );
      CREATE TABLE cop_sessions (
        id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, created_by INTEGER NOT NULL
      );
      CREATE TABLE cop_collaborators (
        id TEXT PRIMARY KEY, cop_session_id TEXT, user_id INTEGER, role TEXT, accepted_at TEXT
      );
      CREATE TABLE evidence_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        source_url TEXT,
        evidence_type TEXT NOT NULL,
        credibility TEXT NOT NULL,
        reliability TEXT NOT NULL,
        confidence_level TEXT,
        workspace_id TEXT,
        created_by INTEGER,
        status TEXT,
        metadata TEXT,
        created_at TEXT,
        updated_at TEXT
      );
      CREATE TABLE content_analysis (
        id INTEGER PRIMARY KEY,
        user_id INTEGER NOT NULL,
        workspace_id TEXT NOT NULL
      );
    `)
    this.sqlite.exec(migration)
  }

  prepare(sql: string) {
    return new SqliteD1Statement(this.sqlite, sql)
  }

  batch(statements: SqliteD1Statement[]) {
    this.sqlite.exec('BEGIN')
    try {
      const results = statements.map((statement) => statement.run())
      this.sqlite.exec('COMMIT')
      return results
    } catch (error) {
      this.sqlite.exec('ROLLBACK')
      throw error
    }
  }
}

const sessions = {
  get: async (token: string) => token === 'session-token' ? JSON.stringify({ user_id: 7 }) : null,
}

function context(db: SqliteD1, request: Request) {
  return {
    request,
    env: {
      DB: db as unknown as D1Database,
      SESSIONS: sessions as unknown as KVNamespace,
      APIFY_API_KEY: 'test-key',
    },
    params: { id: 'cop-1' },
  }
}

function seedOwner(db: SqliteD1) {
  db.sqlite.exec(`
    INSERT INTO users(id) VALUES(7);
    INSERT INTO workspaces(id, owner_id, created_at) VALUES('ws-1', 7, datetime('now'));
    INSERT INTO cop_sessions(id, workspace_id, created_by) VALUES('cop-1', 'ws-1', 7);
  `)
}

test.describe('scraping authorization and idempotency contracts @smoke', () => {
  test('@smoke prefers immutable IDs and canonicalizes platform URL variants', async () => {
    const byId = await buildScrapeItemIdentity('twitter', {
      title: 'A', content: 'B', url: 'https://example.test/ignored', providerItemId: '42',
    })
    const fromTwitter = await buildScrapeItemIdentity('twitter', {
      title: 'Changed', content: 'Changed', url: 'https://mobile.twitter.com/alice/status/42?utm_source=x#thread',
    })
    const fromX = await buildScrapeItemIdentity('twitter', {
      title: 'Again', content: 'Again', url: 'https://x.com/i/status/42',
    })

    expect(byId.itemKey).toBe(fromTwitter.itemKey)
    expect(fromTwitter.itemKey).toBe(fromX.itemKey)
    expect(fromTwitter.providerItemId).toBe('42')
    expect(fromTwitter.canonicalUrl).toBe('https://x.com/i/status/42')
  })

  test('@smoke denies unaccepted or viewer collaborators before calling Apify', async () => {
    const db = new SqliteD1()
    db.sqlite.exec(`
      INSERT INTO users(id) VALUES(7);
      INSERT INTO workspaces(id, owner_id, created_at) VALUES('ws-1', 99, datetime('now'));
      INSERT INTO cop_sessions(id, workspace_id, created_by) VALUES('cop-1', 'ws-1', 99);
      INSERT INTO cop_collaborators(id, cop_session_id, user_id, role, accepted_at)
      VALUES('c-1', 'cop-1', 7, 'viewer', datetime('now'));
      INSERT INTO cop_collaborators(id, cop_session_id, user_id, role, accepted_at)
      VALUES('c-2', 'cop-1', 7, 'editor', NULL);
    `)

    const originalFetch = globalThis.fetch
    let fetchCalls = 0
    globalThis.fetch = async () => {
      fetchCalls += 1
      return new Response('{}')
    }
    try {
      const response = await onRequestPost(context(db, new Request('https://test/api/cop/cop-1/scrape', {
        method: 'POST',
        headers: { Authorization: 'Bearer session-token', 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'twitter', query: 'test' }),
      })) as never)
      expect(response.status).toBe(403)
      expect(fetchCalls).toBe(0)
    } finally {
      globalThis.fetch = originalFetch
      db.sqlite.close()
    }
  })

  test('@smoke accepted editor starts a paid run with authenticated requester identity', async () => {
    const db = new SqliteD1()
    db.sqlite.exec(`
      INSERT INTO users(id) VALUES(7);
      INSERT INTO workspaces(id, owner_id, created_at) VALUES('ws-1', 99, datetime('now'));
      INSERT INTO cop_sessions(id, workspace_id, created_by) VALUES('cop-1', 'ws-1', 99);
      INSERT INTO cop_collaborators(id, cop_session_id, user_id, role, accepted_at)
      VALUES('c-1', 'cop-1', 7, 'editor', datetime('now'));
    `)

    const originalFetch = globalThis.fetch
    globalThis.fetch = async () => Response.json({
      data: { id: 'run-1', status: 'RUNNING', defaultDatasetId: 'dataset-1' },
    })
    try {
      const response = await onRequestPost(context(db, new Request('https://test/api/cop/cop-1/scrape', {
        method: 'POST',
        headers: { Authorization: 'Bearer session-token', 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'twitter', query: 'test', user_id: 999 }),
      })) as never)
      const run = db.sqlite.prepare(
        'SELECT requested_by, cop_session_id, workspace_id FROM cop_scrape_runs WHERE run_id = ?'
      ).get('run-1')
      expect(response.status).toBe(202)
      expect(run).toEqual({ requested_by: 7, cop_session_id: 'cop-1', workspace_id: 'ws-1' })
    } finally {
      globalThis.fetch = originalFetch
      db.sqlite.close()
    }
  })

  test('@smoke repeat route ingestion creates one evidence row and one trusted identity', async () => {
    const db = new SqliteD1()
    seedOwner(db)
    db.sqlite.exec(`
      INSERT INTO cop_scrape_runs(
        run_id, cop_session_id, workspace_id, requested_by, scraper_type, actor_id, dataset_id, status
      ) VALUES('run-1', 'cop-1', 'ws-1', 7, 'twitter', 'actor', 'dataset-1', 'SUCCEEDED');
    `)

    const originalFetch = globalThis.fetch
    globalThis.fetch = async (input) => {
      const url = String(input)
      if (url.includes('/actor-runs/')) {
        return Response.json({ data: { id: 'run-1', status: 'SUCCEEDED', defaultDatasetId: 'dataset-1' } })
      }
      if (url.includes('/datasets/')) {
        return Response.json([{ id: '42', text: 'evidence', url: 'https://twitter.com/a/status/42' }])
      }
      throw new Error(`Unexpected fetch: ${url}`)
    }

    const request = () => new Request('https://test/api/cop/cop-1/scrape?run_id=run-1', {
      headers: { Authorization: 'Bearer session-token' },
    })

    try {
      const first = await onRequestGet(context(db, request()) as never)
      const second = await onRequestGet(context(db, request()) as never)
      expect(first.status).toBe(200)
      expect(second.status).toBe(200)
      expect((await first.json()).evidence_created).toBe(1)
      expect((await second.json()).evidence_created).toBe(0)
      expect(db.sqlite.prepare('SELECT COUNT(*) AS count FROM evidence_items').get().count).toBe(1)
      expect(db.sqlite.prepare('SELECT COUNT(*) AS count FROM cop_scrape_imports').get().count).toBe(1)
    } finally {
      globalThis.fetch = originalFetch
      db.sqlite.close()
    }
  })

  test('@smoke migration has explicit rollback and no JSON index', () => {
    expect(migration).toContain('Rollback')
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS cop_scrape_imports')
    expect(migration).not.toContain('json_extract')
  })

  test('@smoke analysis route rejects foreign workspace and scopes derived workspace', async () => {
    const db = new SqliteD1()
    db.sqlite.exec(`
      INSERT INTO users(id) VALUES(7);
      INSERT INTO workspaces(id, owner_id, created_at) VALUES('ws-1', 7, '2026-01-01');
      INSERT INTO workspaces(id, owner_id, created_at) VALUES('ws-2', 99, '2026-01-01');
      INSERT INTO workspace_members(id, workspace_id, user_id, role, joined_at)
      VALUES('wm-1', 'ws-1', 7, 'EDITOR', '2026-01-01');
      INSERT INTO content_analysis(id, user_id, workspace_id) VALUES(11, 7, 'ws-2');
    `)
    const body = JSON.stringify({ load_existing: true, analysis_id: 11 })

    const foreign = await analyzeUrlPost({
      ...context(db, new Request('https://test/api/content-intelligence/analyze-url', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer session-token',
          'Content-Type': 'application/json',
          'X-Workspace-ID': 'ws-2',
        },
        body,
      })),
      params: {},
    } as never)
    const derived = await analyzeUrlPost({
      ...context(db, new Request('https://test/api/content-intelligence/analyze-url', {
        method: 'POST',
        headers: { Authorization: 'Bearer session-token', 'Content-Type': 'application/json' },
        body,
      })),
      params: {},
    } as never)

    expect(foreign.status).toBe(403)
    expect(derived.status).toBe(404)
    db.sqlite.close()
  })
})
