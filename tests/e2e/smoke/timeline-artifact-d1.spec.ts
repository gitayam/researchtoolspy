import { test, expect } from '@playwright/test'
import { Miniflare } from 'miniflare'
import type { D1Database } from '@cloudflare/workers-types'
import { readFileSync } from 'node:fs'

const migration = readFileSync(new URL('../../../schema/managed-migrations/0011_timeline_foundation.sql', import.meta.url), 'utf8')
// Deliberately bounded schema-compatible prerequisites, not a full production migration rehearsal.
const prerequisites = [
  'CREATE TABLE users(id INTEGER PRIMARY KEY,user_hash TEXT UNIQUE,role TEXT NOT NULL,is_active INTEGER NOT NULL)',
  'CREATE TABLE workspaces(id TEXT PRIMARY KEY,owner_id INTEGER NOT NULL,is_public INTEGER NOT NULL,FOREIGN KEY(owner_id) REFERENCES users(id))',
  'CREATE TABLE workspace_members(id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,user_id INTEGER NOT NULL,role TEXT NOT NULL,FOREIGN KEY(workspace_id) REFERENCES workspaces(id),FOREIGN KEY(user_id) REFERENCES users(id))',
]
async function database() {
  const mf = new Miniflare({ modules: true, script: 'export default { fetch() { return new Response("ok") } }', d1Databases: { DB: 'timeline-artifact-test' } })
  const db = await mf.getD1Database('DB')
  try {
    for (const sql of prerequisites) await db.prepare(sql).run()
    await db.prepare("INSERT INTO users VALUES (1,'human-owner-hash-0001','researcher',1),(2,'human-editor-hash-002','researcher',1),(3,'human-viewer-hash-003','researcher',1),(4,'human-other-hash-0004','researcher',1),(5,'guest-fixture-hash-05','guest',1),(6,'service-fixture-hash6','service',1),(7,'inactive-fixture-hash','researcher',0)").run()
    await db.prepare("INSERT INTO workspaces VALUES ('workspace-a',1,0),('workspace-b',4,0),('1',1,0),('workspace-public',1,1)").run()
    await db.prepare("INSERT INTO workspace_members VALUES ('editor','workspace-a',2,'EDITOR'),('viewer','workspace-a',3,'VIEWER')").run()
    for (const statement of migration.split('-- statement\n').slice(1)) await db.prepare(statement.trim()).run()
    return { mf, db }
  } catch (error) { await mf.dispose(); throw error }
}
async function root(db: D1Database, id = 'artifact-a', workspace = 'workspace-a', user = 1) {
  await db.batch([
    db.prepare('INSERT INTO timeline_artifacts VALUES (?,?,?,?,?)').bind(workspace,id,'Fixture',user,'2026-09-11T00:00:00Z'),
    db.prepare('INSERT INTO timeline_revisions VALUES (?,?,?,0,NULL,0,0,?,?,?)').bind(workspace,id,'revision-root','0'.repeat(64),user,'2026-09-11T00:00:00Z'),
    db.prepare("INSERT INTO timeline_lineage_branches VALUES (?,?,'main','revision-root')").bind(workspace,id),
  ])
}

test.describe('durable timeline actual D1 @smoke', () => {
  test('migration preserves prerequisites and enforces root, transaction authorization and immutable publication', async () => {
    const { mf, db } = await database()
    try {
      expect((await db.prepare('SELECT count(*) AS n FROM users').first<{ n: number }>())?.n).toBe(7)
      await root(db)
      await expect(db.prepare("UPDATE timeline_revisions SET content_hash=? WHERE id='revision-root'").bind('1'.repeat(64)).run()).rejects.toThrow(/timeline_immutable/)
      await expect(db.prepare("INSERT OR REPLACE INTO timeline_revisions SELECT workspace_id,artifact_id,id,sequence,expected_head,object_count,change_count,?,created_by,created_at FROM timeline_revisions").bind('1'.repeat(64)).run()).rejects.toThrow(/timeline_immutable/)
      await expect(db.prepare("INSERT INTO timeline_revision_parents VALUES ('workspace-a','artifact-a','revision-root','revision-root',0)").run()).rejects.toThrow()
      for (const [workspace,user] of [['workspace-a',3],['workspace-b',1],['workspace-public',1],['1',1]] as const) {
        await expect(root(db,`denied-${workspace}-${user}`,workspace,user)).rejects.toThrow(/timeline_authorization_denied/)
        expect((await db.prepare('SELECT count(*) AS n FROM timeline_artifacts WHERE id=?').bind(`denied-${workspace}-${user}`).first<{ n: number }>())?.n).toBe(0)
      }
    } finally { await mf.dispose() }
  })
})
