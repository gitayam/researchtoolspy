/**
 * D1 composite/covering-index regression tests.
 *
 * Executes managed migrations 0004 and 0005 against in-memory Miniflare D1,
 * then checks the real SQLite query planner rather than only matching
 * migration text.
 */
import { test, expect } from '@playwright/test'
import { Miniflare } from 'miniflare'
import type { D1Database } from '@cloudflare/workers-types'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const BASE_SCHEMA = `
  CREATE TABLE content_analysis (
    id TEXT,
    content_hash TEXT,
    user_id INTEGER,
    workspace_id TEXT
  );

  CREATE INDEX idx_content_analysis_hash
    ON content_analysis(content_hash);
  CREATE INDEX idx_content_analysis_hash_workspace
    ON content_analysis(content_hash, workspace_id);
  CREATE INDEX idx_content_analysis_user
    ON content_analysis(user_id);
  CREATE INDEX idx_content_analysis_user_workspace
    ON content_analysis(user_id, workspace_id);

  CREATE TABLE cop_collaborators (
    cop_session_id TEXT NOT NULL,
    user_id INTEGER
  );

  CREATE TABLE workspace_members (
    workspace_id TEXT NOT NULL,
    user_id INTEGER NOT NULL
  );

  CREATE TABLE cop_sessions (
    workspace_id TEXT,
    status TEXT,
    created_by INTEGER,
    updated_at TEXT
  );

  CREATE TABLE workspaces (
    id TEXT,
    owner_id INTEGER,
    created_at TEXT
  );

  CREATE TABLE framework_sessions (
    id TEXT,
    title TEXT,
    framework_type TEXT,
    status TEXT,
    workspace_id TEXT,
    created_at TEXT,
    updated_at TEXT
  );

  CREATE TABLE evidence_items (
    workspace_id TEXT,
    status TEXT,
    created_at TEXT
  );

  CREATE TABLE actors (
    workspace_id TEXT,
    type TEXT,
    created_at TEXT
  );

  CREATE TABLE sources (
    workspace_id TEXT,
    type TEXT,
    created_at TEXT
  );

  CREATE TABLE events (
    workspace_id TEXT,
    event_type TEXT,
    date_start TEXT
  );

  CREATE TABLE places (
    workspace_id TEXT,
    place_type TEXT,
    created_at TEXT
  );

  CREATE TABLE behaviors (
    workspace_id TEXT,
    behavior_type TEXT,
    created_at TEXT
  );

  CREATE TABLE relationships (
    workspace_id TEXT,
    relationship_type TEXT,
    created_at TEXT
  );

  CREATE TABLE cop_activity (
    cop_session_id TEXT,
    created_at TEXT
  );

  CREATE TABLE cop_tasks (
    cop_session_id TEXT,
    status TEXT,
    assigned_to TEXT,
    priority TEXT,
    created_at TEXT
  );
`

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

async function plan(db: D1Database, sql: string): Promise<string[]> {
  const result = await db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all<{ detail: string }>()
  return result.results.map((row) => row.detail)
}

test.describe('D1 hot-path composite indexes @smoke', () => {
  test('@smoke migration creates the audited indexes and planner selects them', async () => {
    const mf = new Miniflare({
      modules: true,
      script: 'export default { fetch() { return new Response("ok") } }',
      d1Databases: { DB: 'composite-index-test' },
    })

    try {
      const db = await mf.getD1Database('DB')
      await executeSql(db, BASE_SCHEMA)

      const migration = readFileSync(
        resolve(process.cwd(), 'schema/managed-migrations/0004_add_hot_path_composite_indexes.sql'),
        'utf8',
      )
      await executeSql(db, migration)

      const indexes = await db.prepare(`
        SELECT name
        FROM sqlite_schema
        WHERE type = 'index'
        ORDER BY name
      `).all<{ name: string }>()

      expect(indexes.results.map((row) => row.name)).toEqual(expect.arrayContaining([
        'idx_cop_collaborators_session_user',
        'idx_workspace_members_user_workspace',
        'idx_cop_sessions_owner_status_updated',
        'idx_cop_sessions_workspace_status_owner_updated',
        'idx_framework_sessions_workspace_updated',
        'idx_framework_sessions_workspace_type_updated',
        'idx_evidence_items_workspace_created',
        'idx_evidence_items_workspace_status_created',
        'idx_actors_workspace_created',
        'idx_actors_workspace_type_created',
        'idx_sources_workspace_created',
        'idx_sources_workspace_type_created',
        'idx_events_workspace_date',
        'idx_events_workspace_type_date',
        'idx_places_workspace_created',
        'idx_places_workspace_type_created',
        'idx_behaviors_workspace_created',
        'idx_behaviors_workspace_type_created',
        'idx_relationships_workspace_created',
        'idx_relationships_workspace_type_created',
        'idx_cop_activity_session_created',
        'idx_cop_tasks_session_status',
        'idx_cop_tasks_session_assigned',
        'idx_workspaces_owner_created',
      ]))

      const collaboratorPlan = await plan(db, `
        SELECT 1
        FROM cop_collaborators
        WHERE cop_session_id = 'cop-a' AND user_id = 42
      `)
      expect(collaboratorPlan.join(' ')).toContain(
        'COVERING INDEX idx_cop_collaborators_session_user',
      )

      const sessionPlan = await plan(db, `
        SELECT *
        FROM cop_sessions
        WHERE workspace_id = 'workspace-a'
          AND status = 'ACTIVE'
          AND created_by = 42
        ORDER BY updated_at DESC
        LIMIT 200
      `)
      expect(sessionPlan.join(' ')).toContain(
        'INDEX idx_cop_sessions_workspace_status_owner_updated',
      )
      expect(sessionPlan.join(' ')).not.toContain('TEMP B-TREE')

      const frameworkPlan = await plan(db, `
        SELECT id, title, framework_type, status, created_at, updated_at
        FROM framework_sessions
        WHERE workspace_id = 'workspace-a'
          AND framework_type = 'deception'
        ORDER BY updated_at DESC
        LIMIT 50
      `)
      expect(frameworkPlan.join(' ')).toContain(
        'INDEX idx_framework_sessions_workspace_type_updated',
      )
      expect(frameworkPlan.join(' ')).not.toContain('TEMP B-TREE')

      const evidencePlan = await plan(db, `
        SELECT *
        FROM evidence_items
        WHERE workspace_id = 'workspace-a'
          AND status = 'pending'
        ORDER BY created_at DESC
        LIMIT 100
      `)
      expect(evidencePlan.join(' ')).toContain(
        'INDEX idx_evidence_items_workspace_status_created',
      )
      expect(evidencePlan.join(' ')).not.toContain('TEMP B-TREE')

      const actorPlan = await plan(db, `
        SELECT *
        FROM actors
        WHERE workspace_id = 'workspace-a'
          AND type = 'PERSON'
        ORDER BY created_at DESC
        LIMIT 500
      `)
      expect(actorPlan.join(' ')).toContain('INDEX idx_actors_workspace_type_created')
      expect(actorPlan.join(' ')).not.toContain('TEMP B-TREE')

      const activityPlan = await plan(db, `
        SELECT *
        FROM cop_activity
        WHERE cop_session_id = 'cop-a'
        ORDER BY created_at DESC
        LIMIT 50
      `)
      expect(activityPlan.join(' ')).toContain('INDEX idx_cop_activity_session_created')
      expect(activityPlan.join(' ')).not.toContain('TEMP B-TREE')

      // The status predicate is indexed, but the custom priority CASE remains a
      // deliberate sort. Removing this TEMP B-TREE needs a query/data-model
      // change (for example, a stored priority_rank), not another ordinary index.
      const taskPlan = await plan(db, `
        SELECT *
        FROM cop_tasks
        WHERE cop_session_id = 'cop-a'
          AND status = 'todo'
        ORDER BY
          CASE priority
            WHEN 'critical' THEN 0
            WHEN 'high' THEN 1
            WHEN 'medium' THEN 2
            WHEN 'low' THEN 3
          END,
          created_at DESC
        LIMIT 500
      `)
      expect(taskPlan.join(' ')).toContain('INDEX idx_cop_tasks_session_status')
      expect(taskPlan.join(' ')).toContain('TEMP B-TREE')
    } finally {
      await mf.dispose()
    }
  })

  test('@smoke migration removes only redundant content indexes and preserves plans', async () => {
    const mf = new Miniflare({
      modules: true,
      script: 'export default { fetch() { return new Response("ok") } }',
      d1Databases: { DB: 'content-index-cleanup-test' },
    })

    try {
      const db = await mf.getD1Database('DB')
      await executeSql(db, BASE_SCHEMA)

      const migration = readFileSync(
        resolve(
          process.cwd(),
          'schema/managed-migrations/0005_drop_redundant_content_analysis_indexes.sql',
        ),
        'utf8',
      )
      await executeSql(db, migration)
      await executeSql(db, migration)

      const indexes = await db.prepare(`
        SELECT name
        FROM sqlite_schema
        WHERE type = 'index'
          AND tbl_name = 'content_analysis'
        ORDER BY name
      `).all<{ name: string }>()
      const indexNames = indexes.results.map((row) => row.name)

      expect(indexNames).not.toContain('idx_content_analysis_hash')
      expect(indexNames).not.toContain('idx_content_analysis_user')
      expect(indexNames).toContain('idx_content_analysis_hash_workspace')
      expect(indexNames).toContain('idx_content_analysis_user_workspace')

      const hashPlan = await plan(db, `
        SELECT id
        FROM content_analysis
        WHERE content_hash = 'hash-a'
      `)
      expect(hashPlan.join(' ')).toContain(
        'INDEX idx_content_analysis_hash_workspace (content_hash=?)',
      )

      const userPlan = await plan(db, `
        SELECT id
        FROM content_analysis
        WHERE user_id = 42
      `)
      expect(userPlan.join(' ')).toContain(
        'INDEX idx_content_analysis_user_workspace (user_id=?)',
      )
    } finally {
      await mf.dispose()
    }
  })
})
