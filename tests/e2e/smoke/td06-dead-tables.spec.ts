/**
 * TD-06 dead-table migration source guard (pure-Node, no browser, no HTTP server).
 *
 * Verifies that schema/migrations/113-drop-dead-tables.sql:
 *   1. Contains DROP statements for all confirmed-dead tables.
 *   2. Does NOT contain DROP statements for explicitly protected tables
 *      (live tables, explicitly-documented dormant tables, and TS-referenced tables).
 *   3. Every DROPped table has a comment explaining why it is dead.
 *
 * These are source-guard assertions — they break CI if the migration file is
 * edited incorrectly, protecting against accidental drops of live data.
 */
import { test, expect } from '@playwright/test'
import { readFileSync } from 'fs'

function readProjectFile(rel: string): string {
  return readFileSync(
    new URL(`../../../${rel}`, import.meta.url).pathname,
    'utf-8'
  )
}

let migrationSql: string

test.beforeAll(() => {
  migrationSql = readProjectFile('schema/migrations/113-drop-dead-tables.sql')
})

// Helper: extract table names from DROP TABLE IF EXISTS statements
function droppedTables(sql: string): string[] {
  const matches = sql.matchAll(/DROP TABLE IF EXISTS\s+(\w+)\s*;/gi)
  return Array.from(matches, (m) => m[1])
}

test('td06: migration file exists and is non-empty', () => {
  expect(migrationSql.length).toBeGreaterThan(100)
})

test('td06: contains expected DROP for rate_limits', () => {
  expect(migrationSql).toContain('DROP TABLE IF EXISTS rate_limits')
})

test('td06: contains expected DROP for research_analysis', () => {
  expect(migrationSql).toContain('DROP TABLE IF EXISTS research_analysis')
})

test('td06: contains expected DROP for framework_analytics', () => {
  expect(migrationSql).toContain('DROP TABLE IF EXISTS framework_analytics')
})

test('td06: contains expected DROP for guest_sessions', () => {
  expect(migrationSql).toContain('DROP TABLE IF EXISTS guest_sessions')
})

test('td06: contains expected DROP for library_collections', () => {
  expect(migrationSql).toContain('DROP TABLE IF EXISTS library_collections')
})

// Protected tables: explicitly documented as dormant test data (do not drop)
test('td06: does NOT drop submission_forms (dormant test data, do not drop)', () => {
  expect(migrationSql).not.toContain('DROP TABLE IF EXISTS submission_forms')
})

test('td06: does NOT drop form_submissions (dormant test data, do not drop)', () => {
  expect(migrationSql).not.toContain('DROP TABLE IF EXISTS form_submissions')
})

// Protected tables: live tables with data
test('td06: does NOT drop evidence_items (live, 99 rows)', () => {
  expect(migrationSql).not.toContain('DROP TABLE IF EXISTS evidence_items')
})

test('td06: does NOT drop cop_sessions (live, 30 rows)', () => {
  expect(migrationSql).not.toContain('DROP TABLE IF EXISTS cop_sessions')
})

test('td06: does NOT drop users (live, 173 rows)', () => {
  expect(migrationSql).not.toContain('DROP TABLE IF EXISTS users')
})

test('td06: does NOT drop framework_sessions (live, 81 rows)', () => {
  expect(migrationSql).not.toContain('DROP TABLE IF EXISTS framework_sessions')
})

// Protected tables: 0 rows but TS-referenced (should NOT be dropped)
test('td06: does NOT drop comments (0 rows but TS-referenced)', () => {
  expect(migrationSql).not.toContain('DROP TABLE IF EXISTS comments')
})

test('td06: does NOT drop mom_assessments (0 rows but TS-referenced)', () => {
  expect(migrationSql).not.toContain('DROP TABLE IF EXISTS mom_assessments')
})

test('td06: does NOT drop cop_playbooks (0 rows but TS-referenced)', () => {
  expect(migrationSql).not.toContain('DROP TABLE IF EXISTS cop_playbooks')
})

test('td06: does NOT drop user_notifications (0 rows but TS-referenced)', () => {
  expect(migrationSql).not.toContain('DROP TABLE IF EXISTS user_notifications')
})

test('td06: does NOT drop workspace_invites (0 rows but TS-referenced)', () => {
  expect(migrationSql).not.toContain('DROP TABLE IF EXISTS workspace_invites')
})

test('td06: does NOT drop datasets (0 rows but TS-referenced)', () => {
  expect(migrationSql).not.toContain('DROP TABLE IF EXISTS datasets')
})

test('td06: does NOT drop data_exports (0 rows but TS-referenced)', () => {
  expect(migrationSql).not.toContain('DROP TABLE IF EXISTS data_exports')
})

test('td06: does NOT drop cop_assets (0 rows but TS-referenced)', () => {
  expect(migrationSql).not.toContain('DROP TABLE IF EXISTS cop_assets')
})

test('td06: does NOT drop investigation_packets (0 rows but TS-referenced)', () => {
  expect(migrationSql).not.toContain('DROP TABLE IF EXISTS investigation_packets')
})

test('td06: does NOT drop library_frameworks (0 rows but TS-referenced)', () => {
  expect(migrationSql).not.toContain('DROP TABLE IF EXISTS library_frameworks')
})

// Structural: every DROP statement must have a comment above it
test('td06: every dropped table has a comment explaining why it is dead', () => {
  const dropped = droppedTables(migrationSql)
  expect(dropped.length).toBeGreaterThan(0)

  for (const tbl of dropped) {
    // The comment should appear somewhere before the DROP
    const dropIdx = migrationSql.indexOf(`DROP TABLE IF EXISTS ${tbl}`)
    const beforeDrop = migrationSql.slice(0, dropIdx)
    // Find last comment block before this DROP
    const lastComment = beforeDrop.lastIndexOf('--')
    expect(lastComment).toBeGreaterThan(-1, `No comment found before DROP TABLE IF EXISTS ${tbl}`)
    // Comment must be within 500 chars of the DROP statement
    expect(dropIdx - lastComment).toBeLessThan(500, `Comment too far from DROP TABLE IF EXISTS ${tbl}`)
  }
})

// Count guard: exactly 25 tables dropped (verified count from inventory)
test('td06: exactly 25 tables dropped', () => {
  const dropped = droppedTables(migrationSql)
  expect(dropped.length).toBe(25)
})

// All confirmed-dead tables are present
test('td06: all 25 confirmed-dead tables are present in the DROP list', () => {
  const dropped = droppedTables(migrationSql)
  const confirmedDead = [
    'ach_collaborators',
    'api_keys',
    'cop_submissions',
    'entity_ratings',
    'entity_votes',
    'evidence_social_media',
    'framework_analytics',
    'framework_content_sources',
    'framework_exports',
    'framework_ratings',
    'framework_templates',
    'framework_views',
    'framework_votes',
    'guest_sessions',
    'library_collection_items',
    'library_collections',
    'library_framework_tags',
    'library_items',
    'library_tags',
    'rate_limits',
    'research_analysis',
    'research_tool_results',
    'social_media_analytics',
    'social_media_monitors',
    'suggestion_analytics',
  ]
  for (const tbl of confirmedDead) {
    expect(dropped).toContain(tbl)
  }
})
