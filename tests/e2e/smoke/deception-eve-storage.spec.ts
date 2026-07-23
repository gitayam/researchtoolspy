/**
 * Canonical EVE storage regression tests (browser + in-memory Miniflare D1).
 *
 * These execute managed migration 0001 and the real evidence/deception handlers. This
 * intentionally exercises the SQL contract that the earlier source-only guard
 * missed when production lacked evidence_items.eve_assessment.
 */
import { test, expect } from '@playwright/test'
import { Miniflare } from 'miniflare'
import type { D1Database } from '@cloudflare/workers-types'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { onRequest as handleEvidenceItems } from '../../../functions/api/evidence-items'
import { onRequest as handleEvidenceCitations } from '../../../functions/api/evidence-citations'
import { onRequestGet as handleDeceptionAggregate } from '../../../functions/api/deception/aggregate'

const USER_HASH = 'eve-storage-test-hash-0001'

const BASE_SCHEMA = `
  CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    user_hash TEXT UNIQUE
  );

  CREATE TABLE workspaces (
    id TEXT PRIMARY KEY,
    owner_id INTEGER,
    is_public INTEGER DEFAULT 0
  );

  CREATE TABLE workspace_members (
    workspace_id TEXT,
    user_id INTEGER,
    role TEXT
  );

  CREATE TABLE evidence_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    who TEXT,
    what TEXT,
    when_occurred TEXT,
    where_location TEXT,
    why_purpose TEXT,
    how_method TEXT,
    source_classification TEXT,
    source_name TEXT,
    source_url TEXT,
    source_id TEXT,
    evidence_type TEXT NOT NULL,
    evidence_level TEXT,
    category TEXT,
    credibility TEXT,
    reliability TEXT,
    confidence_level TEXT,
    tags TEXT,
    status TEXT,
    priority TEXT,
    workspace_id TEXT,
    created_by INTEGER,
    updated_by INTEGER,
    is_public INTEGER DEFAULT 0,
    shared_by_user_id INTEGER,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE actors (
    id TEXT PRIMARY KEY,
    name TEXT,
    deception_profile TEXT,
    workspace_id TEXT
  );

  CREATE TABLE sources (
    id TEXT PRIMARY KEY,
    name TEXT,
    moses_assessment TEXT,
    workspace_id TEXT
  );

  CREATE TABLE content_analysis (
    id INTEGER PRIMARY KEY,
    title TEXT,
    url TEXT,
    claim_analysis TEXT,
    workspace_id TEXT,
    user_id INTEGER,
    created_at TEXT
  );

  CREATE TABLE framework_sessions (
    id INTEGER PRIMARY KEY,
    title TEXT,
    data TEXT,
    framework_type TEXT,
    workspace_id TEXT,
    created_at TEXT,
    updated_at TEXT
  );

  CREATE TABLE evidence_actors (
    evidence_id INTEGER,
    actor_id TEXT,
    relevance TEXT,
    PRIMARY KEY (evidence_id, actor_id)
  );

  CREATE TABLE evidence_citations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    evidence_id INTEGER,
    dataset_id INTEGER,
    page_number TEXT,
    quote TEXT,
    context TEXT,
    citation_format TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE datasets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    description TEXT,
    type TEXT,
    source TEXT,
    created_by INTEGER,
    is_public INTEGER DEFAULT 0
  );

  INSERT INTO users (id, user_hash) VALUES (42, '${USER_HASH}');
  INSERT INTO workspaces (id, owner_id, is_public)
  VALUES ('workspace-alpha', 42, 0), ('workspace-bravo', 42, 0);
`

function evidenceBody(title: string, risk: number) {
  return {
    title,
    description: `${title} description`,
    evidence_type: 'document_excerpt',
    evidence_level: 'tactical',
    credibility: '3',
    reliability: 'C',
    confidence_level: 'medium',
    tags: ['eve'],
    status: 'verified',
    priority: 'normal',
    eve_assessment: {
      internal_consistency: risk,
      external_corroboration: risk,
      anomaly_detection: 0,
      notes: `${title} notes`,
    },
  }
}

function request(path: string, init: RequestInit = {}) {
  return new Request(`https://researchtools.net${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-User-Hash': USER_HASH,
      ...init.headers,
    },
  })
}

async function executeSql(db: D1Database, sql: string) {
  const statements = sql
    .replace(/^--.*$/gm, '')
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean)

  for (const statement of statements) {
    await db.prepare(statement).run()
  }
}

test.describe('canonical evidence EVE persistence and aggregation @smoke', () => {
  test('@smoke network graph resolves a real workspace before requesting relationships', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.removeItem('omnicore_workspace_id')
      localStorage.removeItem('current_workspace_id')
    })

    await page.route('**/api/workspaces', async (route) => {
      await route.fulfill({
        json: {
          owned: [{
            id: 'workspace-real',
            name: 'Real workspace',
            type: 'PERSONAL',
            owner_id: 42,
            is_public: false,
          }],
          member: [],
        },
      })
    })
    await page.route('**/api/relationships?**', async (route) => {
      await route.fulfill({ json: { relationships: [] } })
    })

    const relationshipRequest = page.waitForRequest('**/api/relationships?**')
    await page.goto('/dashboard/network')
    const requestedUrl = new URL((await relationshipRequest).url())

    expect(requestedUrl.searchParams.get('workspace_id')).toBe('workspace-real')
    expect(await page.evaluate(() => localStorage.getItem('current_workspace_id'))).toBe('workspace-real')
  })

  test('@smoke deception dashboard waits for and requests the real workspace', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.removeItem('omnicore_workspace_id')
      localStorage.removeItem('current_workspace_id')
    })

    await page.route('**/api/workspaces', async (route) => {
      await route.fulfill({
        json: {
          owned: [{
            id: 'workspace-real',
            name: 'Real workspace',
            type: 'PERSONAL',
            owner_id: 42,
            is_public: false,
          }],
          member: [],
        },
      })
    })
    await page.route('**/api/deception/aggregate?**', async (route) => {
      await route.fulfill({
        json: {
          overall_risk_score: 0,
          risk_level: 'LOW',
          critical_alerts: [],
          high_alerts: [],
          all_alerts: [],
          risk_breakdown: {
            actors_mom: { high: 0, medium: 0, low: 0, avg_score: 0, total: 0 },
            actors_pop: { high: 0, medium: 0, low: 0, avg_score: 0, total: 0 },
            evidence_eve: { suspicious: 0, needs_review: 0, verified: 0, avg_score: 0, total: 0 },
            sources_moses: { compromised: 0, unreliable: 0, solid: 0, avg_score: 0, total: 0 },
            claims: { high: 0, medium: 0, low: 0, avg_score: 0, total: 0 },
          },
          recommended_actions: [],
          metadata: {
            workspace_id: 'workspace-real',
            generated_at: new Date().toISOString(),
            data_sources: {
              actors: 0,
              sources: 0,
              evidence: 0,
              content_analyses: 0,
              framework_analyses: 0,
            },
          },
        },
      })
    })

    const aggregateRequest = page.waitForRequest('**/api/deception/aggregate?**')
    await page.goto('/dashboard/deception-risk')
    const requestedUrl = new URL((await aggregateRequest).url())

    expect(requestedUrl.searchParams.get('workspace_id')).toBe('workspace-real')
    expect(await page.evaluate(() => localStorage.getItem('omnicore_workspace_id'))).toBe('workspace-real')
  })

  test('@smoke activity feed renders the canonical activity API fields', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.removeItem('omnicore_workspace_id')
      localStorage.removeItem('current_workspace_id')
    })
    await page.route('**/api/workspaces', async (route) => {
      await route.fulfill({
        json: {
          owned: [{
            id: 'workspace-real',
            name: 'Real workspace',
            type: 'PERSONAL',
            owner_id: 42,
            is_public: false,
          }],
          member: [],
        },
      })
    })
    await page.route('**/api/activity?**', async (route) => {
      await route.fulfill({
        json: {
          activities: [{
            id: 'activity-1',
            user_hash: 'analyst-hash',
            user_name: 'Alex Analyst',
            activity_type: 'create',
            entity_type: 'investigation',
            entity_id: 'investigation-1',
            entity_title: 'Operation Signal',
            action_summary: 'Alex Analyst created Operation Signal',
            created_at: new Date().toISOString(),
          }],
          summary: {
            total_activities: 1,
            active_users: 1,
            creates: 1,
            updates: 0,
            comments: 0,
          },
        },
      })
    })

    await page.goto('/dashboard/activity')
    await expect(page.getByText('Alex Analyst', { exact: true })).toBeVisible()
    await expect(page.getByText('Alex Analyst created Operation Signal', { exact: true })).toBeVisible()
    await expect(page.getByText('Operation Signal', { exact: true })).toBeVisible()
  })

  test('@smoke migration, POST, PUT, GET parsing, and workspace aggregate execute against D1', async () => {
    const mf = new Miniflare({
      modules: true,
      script: 'export default { fetch() { return new Response("ok") } }',
      d1Databases: { DB: 'deception-eve-storage-test' },
    })

    try {
      const db = await mf.getD1Database('DB')
      await executeSql(db, BASE_SCHEMA)

      for (const migrationName of [
        '0001_add_evidence_eve_assessment.sql',
        '0002_add_framework_sharing_counters.sql',
        '0003_add_evidence_link_metadata.sql',
      ]) {
        const migration = readFileSync(
          resolve(process.cwd(), `schema/managed-migrations/${migrationName}`),
          'utf8',
        )
        await executeSql(db, migration)
      }

      const columns = await db.prepare('PRAGMA table_info(evidence_items)').all()
      expect(columns.results.some((column) => column.name === 'eve_assessment')).toBe(true)
      const frameworkColumns = await db.prepare('PRAGMA table_info(framework_sessions)').all()
      expect(frameworkColumns.results.map((column) => column.name)).toEqual(
        expect.arrayContaining(['view_count', 'clone_count']),
      )
      const actorColumns = await db.prepare('PRAGMA table_info(evidence_actors)').all()
      expect(actorColumns.results.some((column) => column.name === 'auto_linked')).toBe(true)
      const citationColumns = await db.prepare('PRAGMA table_info(evidence_citations)').all()
      expect(citationColumns.results.map((column) => column.name)).toEqual(
        expect.arrayContaining(['citation_type', 'relevance_score', 'notes', 'created_by']),
      )

      const createAlpha = await handleEvidenceItems({
        request: request('/api/evidence-items', {
          method: 'POST',
          headers: { 'X-Workspace-ID': 'workspace-alpha' },
          body: JSON.stringify(evidenceBody('Alpha evidence', 1)),
        }),
        env: { DB: db },
      })
      expect(createAlpha.status).toBe(201)
      const alphaId = ((await createAlpha.json()) as { id: number }).id

      const createBravo = await handleEvidenceItems({
        request: request('/api/evidence-items', {
          method: 'POST',
          headers: { 'X-Workspace-ID': 'workspace-bravo' },
          body: JSON.stringify(evidenceBody('Bravo evidence', 4)),
        }),
        env: { DB: db },
      })
      expect(createBravo.status).toBe(201)

      const storedAlpha = await db.prepare(
        'SELECT workspace_id, eve_assessment FROM evidence_items WHERE id = ?',
      ).bind(alphaId).first<{ workspace_id: string; eve_assessment: string }>()
      expect(storedAlpha?.workspace_id).toBe('workspace-alpha')
      expect(JSON.parse(storedAlpha?.eve_assessment || '{}').notes).toBe('Alpha evidence notes')

      await db.prepare(`
        INSERT INTO actors (id, name, workspace_id)
        VALUES ('actor-alice', 'Alice Johnson', 'workspace-alpha')
      `).run()

      const updateAlpha = await handleEvidenceItems({
        request: request(`/api/evidence-items?id=${alphaId}`, {
          method: 'PUT',
          headers: { 'X-Workspace-ID': 'workspace-alpha' },
          body: JSON.stringify({
            ...evidenceBody('Alpha updated', 2),
            who: 'Alice Johnson',
            linked_actors: ['actor-alice'],
          }),
        }),
        env: { DB: db },
      })
      expect(updateAlpha.status).toBe(200)
      const linkedActors = await db.prepare(`
        SELECT actor_id, auto_linked FROM evidence_actors WHERE evidence_id = ?
      `).bind(alphaId).all()
      expect(linkedActors.results).toEqual([
        expect.objectContaining({ actor_id: 'actor-alice', auto_linked: 0 }),
      ])
      const evidenceDetail = await handleEvidenceItems({
        request: request(`/api/evidence-items?id=${alphaId}`, {
          headers: { 'X-Workspace-ID': 'workspace-alpha' },
        }),
        env: { DB: db },
      })
      expect(evidenceDetail.status).toBe(200)
      expect(await evidenceDetail.json()).toMatchObject({
        id: alphaId,
        linked_actors: ['actor-alice'],
      })

      const list = await handleEvidenceItems({
        request: request('/api/evidence-items', {
          headers: { 'X-Workspace-ID': 'workspace-alpha' },
        }),
        env: { DB: db },
      })
      expect(list.status).toBe(200)
      const listed = (await list.json()) as {
        evidence: Array<{ id: number; eve_assessment: Record<string, unknown> | null }>
      }
      const alpha = listed.evidence.find((item) => item.id === alphaId)
      expect(alpha?.eve_assessment).toMatchObject({
        internal_consistency: 2,
        notes: 'Alpha updated notes',
      })

      await db.prepare("UPDATE evidence_items SET eve_assessment = 'malformed' WHERE workspace_id = ?")
        .bind('workspace-bravo').run()
      const defensiveList = await handleEvidenceItems({
        request: request('/api/evidence-items', {
          headers: { 'X-Workspace-ID': 'workspace-bravo' },
        }),
        env: { DB: db },
      })
      const defensivelyParsed = (await defensiveList.json()) as {
        evidence: Array<{ workspace_id: string; eve_assessment: unknown }>
      }
      expect(defensivelyParsed.evidence.find((item) => item.workspace_id === 'workspace-bravo')?.eve_assessment).toBeNull()

      const aggregateContext = {
        request: request('/api/deception/aggregate?workspace_id=workspace-alpha'),
        env: { DB: db },
      } as unknown as Parameters<typeof handleDeceptionAggregate>[0]
      const aggregate = await handleDeceptionAggregate(aggregateContext)
      expect(aggregate.status).toBe(200)
      const aggregateBody = (await aggregate.json()) as {
        metadata: { workspace_id: string; data_sources: { evidence: number } }
        risk_breakdown: { evidence_eve: { total: number } }
      }
      expect(aggregateBody.metadata.workspace_id).toBe('workspace-alpha')
      expect(aggregateBody.metadata.data_sources.evidence).toBe(1)
      expect(aggregateBody.risk_breakdown.evidence_eve.total).toBe(1)

      await db.batch([
        db.prepare(`
          INSERT INTO datasets (title, description, type, source, created_by, is_public)
          VALUES ('Owned dataset', '', 'article', '{}', 42, 0)
        `),
        db.prepare(`
          INSERT INTO datasets (title, description, type, source, created_by, is_public)
          VALUES ('Other dataset', '', 'article', '{}', 99, 0)
        `),
      ])
      const ownedDataset = await db.prepare(
        "SELECT id FROM datasets WHERE title = 'Owned dataset'"
      ).first<{ id: number }>()
      const otherDataset = await db.prepare(
        "SELECT id FROM datasets WHERE title = 'Other dataset'"
      ).first<{ id: number }>()

      const forbiddenCitationBatch = await handleEvidenceCitations({
        request: request('/api/evidence-citations', {
          method: 'POST',
          headers: { 'X-Workspace-ID': 'workspace-alpha' },
          body: JSON.stringify({
            evidence_id: alphaId,
            dataset_ids: [ownedDataset?.id, otherDataset?.id],
          }),
        }),
        env: { DB: db },
      })
      expect(forbiddenCitationBatch.status).toBe(404)
      expect((await db.prepare(
        'SELECT COUNT(*) as count FROM evidence_citations WHERE evidence_id = ?'
      ).bind(alphaId).first<{ count: number }>())?.count).toBe(0)

      const createCitation = await handleEvidenceCitations({
        request: request('/api/evidence-citations', {
          method: 'POST',
          headers: { 'X-Workspace-ID': 'workspace-alpha' },
          body: JSON.stringify({
            evidence_id: alphaId,
            dataset_ids: [ownedDataset?.id],
            citation_style: 'chicago',
          }),
        }),
        env: { DB: db },
      })
      expect(createCitation.status).toBe(201)

      const missingWorkspace = await handleDeceptionAggregate({
        request: request('/api/deception/aggregate'),
        env: { DB: db },
      } as unknown as Parameters<typeof handleDeceptionAggregate>[0])
      expect(missingWorkspace.status).toBe(400)
    } finally {
      await mf.dispose()
    }
  })
})
