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
    private readonly onExecute: () => void = () => {},
  ) {}

  bind(...bindings: SQLInputValue[]) {
    return new SqliteD1Statement(this.database, this.sql, bindings, this.onExecute)
  }

  first<T>() {
    this.onExecute()
    return (this.database.prepare(this.sql).get(...this.bindings) as T | undefined) ?? null
  }

  all<T>() {
    this.onExecute()
    return { results: this.database.prepare(this.sql).all(...this.bindings) as T[] }
  }

  run() {
    this.onExecute()
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
  maxBatchStatements = 0
  statementExecutions = 0

  constructor() {
    this.sqlite.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE users (
        id INTEGER PRIMARY KEY,
        username TEXT UNIQUE,
        email TEXT UNIQUE,
        user_hash TEXT UNIQUE,
        full_name TEXT,
        hashed_password TEXT,
        created_at TEXT,
        is_active INTEGER,
        is_verified INTEGER,
        role TEXT
      );
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
    return new SqliteD1Statement(this.sqlite, sql, [], () => { this.statementExecutions += 1 })
  }

  batch(statements: SqliteD1Statement[]) {
    this.maxBatchStatements = Math.max(this.maxBatchStatements, statements.length)
    if (statements.length > 50) throw new Error(`D1 statement budget exceeded: ${statements.length}`)
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

    const numericProviderId = await buildScrapeItemIdentity('twitter', {
      title: 'Numeric JSON ID',
      content: 'Must use the exact URL ID',
      url: 'https://x.com/example/status/9007199254740993123',
      providerItemId: Number('9007199254740993123') as unknown as string,
    })
    expect(numericProviderId.providerItemId).toBe('9007199254740993123')
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

  test('@smoke rejects unapproved provider URLs and oversized paid requests before disclosure', async () => {
    const db = new SqliteD1()
    seedOwner(db)
    const originalFetch = globalThis.fetch
    let fetchCalls = 0
    globalThis.fetch = (async () => {
      fetchCalls += 1
      return Response.json({ data: { id: 'unexpected', status: 'RUNNING' } })
    }) as typeof fetch

    const post = (body: Record<string, unknown>) => onRequestPost(context(db, new Request(
      'https://test/api/cop/cop-1/scrape',
      {
        method: 'POST',
        headers: { Authorization: 'Bearer session-token', 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    )) as never)

    try {
      const wrongHost = await post({ type: 'twitter', urls: ['https://evil.example/x.com/status/123'] })
      expect(wrongHost.status).toBe(400)
      expect(await wrongHost.json()).toMatchObject({ error: expect.stringContaining('approved platform hostname') })

      const wrongPlatform = await post({ type: 'twitter', urls: ['https://www.tiktok.com/@a/video/123'] })
      expect(wrongPlatform.status).toBe(400)

      const tooMany = await post({
        type: 'twitter',
        urls: Array.from({ length: 26 }, (_, index) => `https://x.com/a/status/${index + 1}`),
      })
      expect(tooMany.status).toBe(400)
      expect(await tooMany.json()).toEqual({ error: 'urls must contain at most 25 entries' })

      const longQuery = await post({ type: 'twitter', query: 'q'.repeat(501) })
      expect(longQuery.status).toBe(400)
      expect(fetchCalls).toBe(0)
      expect(db.sqlite.prepare('SELECT COUNT(*) AS count FROM cop_scrape_requests').get().count).toBe(0)
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

  test('@smoke raw-hash accepted collaborator sync POST stays within D1 budget', async () => {
    const db = new SqliteD1()
    const rawHash = '0123456789abcdef0123456789abcdef'
    db.sqlite.exec(`
      INSERT INTO users(id, username, email, user_hash) VALUES(99, 'owner', 'owner@test', 'owner-hash');
      INSERT INTO workspaces(id, owner_id, created_at) VALUES('ws-1', 99, datetime('now'));
      INSERT INTO cop_sessions(id, workspace_id, created_by) VALUES('cop-1', 'ws-1', 99);
      INSERT INTO cop_collaborators(id, cop_session_id, user_id, role, accepted_at)
      VALUES('c-hash', 'cop-1', 100, 'editor', datetime('now'));
    `)

    const originalFetch = globalThis.fetch
    let actorCalls = 0
    globalThis.fetch = async (input) => {
      const url = String(input)
      if (url.includes('/acts/')) {
        actorCalls += 1
        return Response.json({
          data: {
            id: `run-hash-${actorCalls}`,
            status: 'SUCCEEDED',
            defaultDatasetId: `dataset-hash-${actorCalls}`,
          },
        })
      }
      if (url.includes('/datasets/')) {
        return Response.json(Array.from({ length: 100 }, (_, index) => ({
          id: `hash-item-${index}`,
          text: `hash evidence ${index}`,
          url: `https://x.com/hash/status/${2000 + index}`,
        })))
      }
      throw new Error(`Unexpected fetch: ${url}`)
    }

    const post = (idempotencyKey = '') => onRequestPost(context(db, new Request(
      'https://test/api/cop/cop-1/scrape',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${rawHash}`,
          'Content-Type': 'application/json',
          ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
        },
        body: JSON.stringify({ type: 'twitter', query: 'hash budget', limit: 50 }),
      },
    )) as never)

    try {
      db.statementExecutions = 0
      const firstUse = await post()
      const firstUseStatements = db.statementExecutions
      expect(firstUse.status).toBe(200)
      expect((await firstUse.json()).items_found).toBe(14)
      expect(firstUseStatements).toBe(49)
      expect(db.sqlite.prepare('SELECT id FROM users WHERE user_hash = ?').get(rawHash)?.id).toBe(100)

      db.statementExecutions = 0
      const existingHash = await post('intentional-second-run')
      const existingHashStatements = db.statementExecutions
      expect(existingHash.status).toBe(200)
      expect((await existingHash.json()).items_found).toBe(14)
      expect(existingHashStatements).toBe(48)
      expect(actorCalls).toBe(2)
      expect(db.maxBatchStatements).toBeLessThanOrEqual(50)
    } finally {
      globalThis.fetch = originalFetch
      db.sqlite.close()
    }
  })

  test('@smoke concurrent and retried identical paid POSTs call Apify once', async () => {
    const db = new SqliteD1()
    seedOwner(db)
    const originalFetch = globalThis.fetch
    let fetchCalls = 0
    let releaseProvider!: () => void
    let signalProviderStarted!: () => void
    const providerStarted = new Promise<void>((resolve) => { signalProviderStarted = resolve })
    const providerRelease = new Promise<void>((resolve) => { releaseProvider = resolve })
    globalThis.fetch = async () => {
      const callNumber = ++fetchCalls
      signalProviderStarted()
      await providerRelease
      return Response.json({
        data: {
          id: callNumber === 1 ? 'run-concurrent' : `run-intentional-${callNumber}`,
          status: 'RUNNING',
          defaultDatasetId: 'dataset-concurrent',
        },
      })
    }

    const post = (variant = false, idempotencyKey = '') => onRequestPost(context(db, new Request('https://test/api/cop/cop-1/scrape', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer session-token',
        'Content-Type': 'application/json',
        ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
      },
      body: JSON.stringify({
        type: 'twitter',
        query: variant ? 'same query' : '  same   query  ',
        urls: variant
          ? ['https://mobile.twitter.com/a/status/1?utm_source=test', 'https://x.com/b/status/2']
          : ['https://x.com/b/status/2', 'https://x.com/a/status/1'],
      }),
    })) as never)

    try {
      const firstPromise = post()
      await providerStarted
      const concurrent = await post(true)
      expect(concurrent.status).toBe(202)
      expect((await concurrent.json()).status).toBe('initiating')
      expect(fetchCalls).toBe(1)

      releaseProvider()
      const first = await firstPromise
      expect(first.status).toBe(202)

      const retry = await post(true)
      const retryBody = await retry.json()
      expect(retry.status).toBe(202)
      expect(retryBody).toMatchObject({ run_id: 'run-concurrent', deduplicated: true })
      expect(fetchCalls).toBe(1)

      const intentional = await post(true, 'intentional-rerun-1')
      expect(intentional.status).toBe(202)
      expect(fetchCalls).toBe(2)
      expect(db.sqlite.prepare('SELECT COUNT(*) AS count FROM cop_scrape_requests').get().count).toBe(2)
    } finally {
      releaseProvider?.()
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

  test('@smoke ingestion enforces the conservative D1 statement budget', async () => {
    const db = new SqliteD1()
    seedOwner(db)
    db.sqlite.exec(`
      INSERT INTO cop_scrape_runs(
        run_id, cop_session_id, workspace_id, requested_by, scraper_type, actor_id, dataset_id, status
      ) VALUES('run-bulk', 'cop-1', 'ws-1', 7, 'twitter', 'actor', 'dataset-bulk', 'SUCCEEDED');
    `)
    const originalFetch = globalThis.fetch
    globalThis.fetch = async (input) => {
      const url = String(input)
      if (url.includes('/actor-runs/')) {
        return Response.json({ data: { id: 'run-bulk', status: 'SUCCEEDED', defaultDatasetId: 'dataset-bulk' } })
      }
      if (url.includes('/datasets/')) {
        return Response.json(Array.from({ length: 100 }, (_, index) => ({
          id: `item-${index}`,
          text: `evidence ${index}`,
          url: `https://x.com/a/status/${1000 + index}`,
        })))
      }
      throw new Error(`Unexpected fetch: ${url}`)
    }
    try {
      db.statementExecutions = 0
      const response = await onRequestGet(context(db, new Request(
        'https://test/api/cop/cop-1/scrape?run_id=run-bulk',
        { headers: { Authorization: 'Bearer session-token' } },
      )) as never)
      expect(response.status).toBe(200)
      expect((await response.json()).items_found).toBe(14)
      expect(db.maxBatchStatements).toBeLessThanOrEqual(50)
      expect(db.statementExecutions).toBeLessThanOrEqual(50)
      expect(db.sqlite.prepare('SELECT COUNT(*) AS count FROM evidence_items').get().count).toBe(14)
    } finally {
      globalThis.fetch = originalFetch
      db.sqlite.close()
    }
  })

  test('@smoke migration has explicit rollback and no JSON index', () => {
    expect(migration).toContain('Rollback')
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS cop_scrape_imports')
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS cop_scrape_requests')
    expect(migration).not.toContain('json_extract')
  })

  test('@smoke analysis read is owner-only and ignores caller-controlled workspace', async () => {
    const db = new SqliteD1()
    db.sqlite.exec(`
      INSERT INTO users(id) VALUES(7);
      INSERT INTO workspaces(id, owner_id, created_at) VALUES('ws-1', 7, '2026-01-01');
      INSERT INTO workspaces(id, owner_id, created_at) VALUES('ws-2', 99, '2026-01-01');
      INSERT INTO workspace_members(id, workspace_id, user_id, role, joined_at)
      VALUES('wm-1', 'ws-1', 7, 'EDITOR', '2026-01-01');
      INSERT INTO content_analysis(id, user_id, workspace_id) VALUES(11, 7, 'ws-2');
      INSERT INTO content_analysis(id, user_id, workspace_id) VALUES(12, 99, 'ws-1');
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
    const anotherUsers = await analyzeUrlPost({
      ...context(db, new Request('https://test/api/content-intelligence/analyze-url', {
        method: 'POST',
        headers: { Authorization: 'Bearer session-token', 'Content-Type': 'application/json' },
        body: JSON.stringify({ load_existing: true, analysis_id: 12 }),
      })),
      params: {},
    } as never)

    expect(foreign.status).toBe(200)
    expect(derived.status).toBe(200)
    expect(anotherUsers.status).toBe(404)
    db.sqlite.close()
  })

  test('@smoke viewer analysis remains ephemeral for explicit and derived workspace context', async () => {
    const db = new SqliteD1()
    db.sqlite.exec(`
      INSERT INTO users(id) VALUES(7);
      INSERT INTO workspaces(id, owner_id, created_at) VALUES('ws-view', 99, '2026-01-01');
      INSERT INTO workspace_members(id, workspace_id, user_id, role, joined_at)
      VALUES('wm-view', 'ws-view', 7, 'VIEWER', '2026-01-01');
      CREATE TABLE saved_links (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER, workspace_id TEXT, bookmark_hash TEXT, url TEXT,
        title TEXT, note TEXT, tags TEXT, domain TEXT, is_social_media INTEGER,
        social_platform TEXT, is_processed INTEGER, analysis_id INTEGER
      );
    `)
    const makeRequest = (explicit: boolean) => analyzeUrlPost({
      ...context(db, new Request('https://test/api/content-intelligence/analyze-url', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer session-token',
          'Content-Type': 'application/json',
          ...(explicit ? { 'X-Workspace-ID': 'ws-view' } : {}),
        },
        body: JSON.stringify({
          url: 'https://example.com/article',
          mode: 'quick',
          save_link: true,
          content_text: 'authenticated viewer supplied article text with evidence '.repeat(35),
          content_title: 'Viewer analysis',
          content_source: 'bot-scrape',
        }),
      })),
      params: {},
    } as never)

    const originalFetch = globalThis.fetch
    globalThis.fetch = (async () => Response.json({
      choices: [{ message: { content: 'Ephemeral viewer summary' } }],
    })) as typeof fetch
    try {
      const explicit = await makeRequest(true)
      const derived = await makeRequest(false)
      expect(explicit.status).toBe(200)
      expect(derived.status).toBe(200)
      expect(await explicit.json()).toMatchObject({
        is_persisted: false,
        persistence_notice: expect.stringContaining('no writable workspace'),
      })
      expect(await derived.json()).toMatchObject({
        is_persisted: false,
        persistence_notice: expect.stringContaining('no writable workspace'),
      })
      expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM saved_links').get()).toEqual({ n: 0 })
    } finally {
      globalThis.fetch = originalFetch
      db.sqlite.close()
    }
  })
})
