import { test, expect } from '@playwright/test'
import { Miniflare } from 'miniflare'
import type { D1Database, D1PreparedStatement } from '@cloudflare/workers-types'
import { readFileSync } from 'node:fs'
import { onRequestPost } from '../../../functions/api/timelines'
import { onRequestPatch } from '../../../functions/api/timelines/[id]'
import { onRequestGet } from '../../../functions/api/timelines/[id]/objects'
import { canonicalJson, hashContent, WORKSPACE_SNAPSHOT_MAX_BYTES } from '../../../functions/api/_shared/timeline-artifact-contract'

const read = (name: string) => readFileSync(new URL(`../../../schema/managed-migrations/${name}`, import.meta.url), 'utf8')
const statements = (name: string) => read(name).split('-- statement\n').slice(1).map(sql => sql.trim())
const migration = statements('0015_timeline_workspace_intervals.sql')
async function setup() {
  const mf = new Miniflare({ modules: true, script: 'export default {fetch(){return new Response("ok")}}', d1Databases: { DB: 'durable-interval-test' } })
  const db = await mf.getD1Database('DB')
  try {
    // Bounded human-route prerequisites, not a full managed/production-prefix rehearsal.
    await db.batch([
      db.prepare('CREATE TABLE users(id INTEGER PRIMARY KEY,user_hash TEXT UNIQUE,role TEXT NOT NULL,is_active INTEGER NOT NULL)'),
      db.prepare('CREATE TABLE workspaces(id TEXT PRIMARY KEY,owner_id INTEGER REFERENCES users(id),is_public INTEGER NOT NULL)'),
      db.prepare('CREATE TABLE workspace_members(id TEXT PRIMARY KEY,workspace_id TEXT REFERENCES workspaces(id),user_id INTEGER REFERENCES users(id),role TEXT NOT NULL)'),
      db.prepare("INSERT INTO users VALUES(1,'interval-owner-hash-0001','researcher',1)"),
      db.prepare("INSERT INTO workspaces VALUES('interval-private',1,0)"),
    ])
    await db.batch(statements('0011_timeline_foundation.sql').map(sql => db.prepare(sql)))
    await db.batch(statements('0012_timeline_workspace_snapshots.sql').map(sql => db.prepare(sql)))
    // Preserve the independently deployed presentation table and guards too.
    await db.batch(read('0014_timeline_presentations.sql').trim().split(/\n(?=CREATE (?:TABLE|INDEX|TRIGGER) )/).map(sql => db.prepare(sql)))
    await db.prepare('CREATE TABLE interval_migration_tracker(name TEXT PRIMARY KEY)').run()
    return { mf, db }
  } catch (error) { await mf.dispose(); throw error }
}
function snapshot(interval = false) {
  return {
    schemaVersion: interval ? 'timeline-workspace.v2' : 'timeline-workspace.v1', exportedAt: '2026-09-14T00:00:00.000Z',
    source: { schemaVersion: 'timeline-manual.v1', title: 'Original source unchanged' },
    analystWorkspace: { mode: 'basic', questions: [], hypotheses: [], events: [{
      id: 'event:stable', title: 'Recorded event', description: 'Original claim', eventDate: '2026-09-14', datePrecision: 'day',
      category: 'event', importance: 'normal', origin: 'analyst', assessment: 'unreviewed', analystNote: '', modified: false,
      ...(interval ? { recordedEnd: { date: '2026-09', precision: 'month' } } : {}),
    }], narrative: { title: 'History', framing: '', question: '', intendedUse: '', scope: '', timezone: '', dataThrough: '', chapters: [] } },
  }
}
const put = (payload = snapshot(), objectId = 'browser-workspace', kind = payload.schemaVersion) => ({ op: 'put', objectId, kind, payload })
const candidate = (objectId = 'candidate') => ({ op: 'put', objectId, kind: 'event-candidate.v1', payload: { title: 'Candidate', description: null } })
const commit = (...changes: unknown[]) => ({ schemaVersion: 'timeline-artifact-commit.v1', changes })
async function call(db: D1Database, method: string, id = '', body?: unknown, key = 'interval-request-key01', etag?: string, revision?: string) {
  const request = new Request(`https://example.test/api/timelines${id ? '/' + id : ''}${method === 'GET' ? '/objects' : ''}${revision ? '?revisionId=' + revision : ''}`, {
    method, headers: { 'X-User-Hash': 'interval-owner-hash-0001', 'Content-Type': 'application/json', 'Idempotency-Key': key, ...(etag ? { 'If-Match': etag } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  return await (method === 'POST' ? onRequestPost : method === 'PATCH' ? onRequestPatch : onRequestGet)({ request, env: { DB: db }, params: { id } } as never)
}
async function create(db: D1Database) {
  const response = await call(db, 'POST', '', { schemaVersion: 'timeline-artifact-create.v1', workspaceId: 'interval-private', title: 'History' })
  expect(response.status).toBe(201)
  return { body: await response.json() as any, etag: response.headers.get('etag')! }
}
async function write(db: D1Database, id: string, etag: string, payload: ReturnType<typeof snapshot>, key: string) {
  const response = await call(db, 'PATCH', id, commit(put(payload)), key, etag)
  expect(response.status).toBe(200)
  return { body: await response.json() as any, etag: response.headers.get('etag')! }
}
async function rows(db: D1Database) {
  const names = (await db.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND (name LIKE 'timeline_%' OR name='interval_migration_tracker') ORDER BY name").all<{ name: string }>()).results
  const result: Record<string, unknown> = {}
  for (const { name } of names) result[name] = (await db.prepare(`SELECT * FROM ${name} ORDER BY rowid`).all()).results
  return result
}
const catalog = async (db: D1Database) => (await db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY name").all()).results
function wrapped(db: D1Database, run: (statements: D1PreparedStatement[]) => Promise<unknown>): D1Database {
  return { prepare: (sql: string) => db.prepare(sql), batch: run } as unknown as D1Database
}

test.describe('durable workspace intervals actual D1 @smoke', () => {
  test('populated migration failure rolls back DDL and tracker, retry preserves all rows and unaffected catalogs', async () => {
    const { mf, db } = await setup()
    try {
      const created = await create(db), id = created.body.artifactId
      const saved = await write(db, id, created.etag, snapshot(), 'interval-v1-before-upgrade')
      const pinned = await (await call(db, 'GET', id, undefined, undefined, undefined, saved.body.revisionId)).text()
      const before = await rows(db), originalCatalog = await catalog(db)
      const tracked = () => [...migration.map(sql => db.prepare(sql)), db.prepare("INSERT INTO interval_migration_tracker VALUES('0015')")]
      for (const position of [5, 9, migration.length + 1]) {
        const batch = tracked()
        await expect(db.batch([...batch.slice(0, position), db.prepare("SELECT json('injected failure')"), ...batch.slice(position)])).rejects.toThrow()
        expect(await rows(db)).toEqual(before)
        expect(await catalog(db)).toEqual(originalCatalog)
      }
      await db.batch(tracked())
      const after = await rows(db)
      expect({ ...after, interval_migration_tracker: [] }).toEqual(before)
      const allowed = new Set(['timeline_objects', 'timeline_object_versions', 'timeline_version_kind'])
      expect((await catalog(db)).filter(row => !allowed.has(String(row.name)))).toEqual(originalCatalog.filter(row => !allowed.has(String(row.name))))
      expect((await db.prepare('PRAGMA foreign_key_check').all()).results).toEqual([])
      expect(await (await call(db, 'GET', id, undefined, undefined, undefined, saved.body.revisionId)).text()).toBe(pinned)
      await write(db, id, saved.etag, snapshot(true), 'interval-v2-after-upgrade')
    } finally { await mf.dispose() }
  })

  test('v1 to v2 to v1 preserves creation kind, exact historical bytes, manifest hashes and original source', async () => {
    const { mf, db } = await setup()
    try {
      await db.batch(migration.map(sql => db.prepare(sql)))
      const created = await create(db), id = created.body.artifactId
      let etag = created.etag
      const revisions: Array<{ id: string; raw: string }> = []
      for (const [index, payload] of [snapshot(), snapshot(true), snapshot()].entries()) {
        const saved = await write(db, id, etag, payload, `interval-transition-key${index}`)
        etag = saved.etag
        expect(saved.body.sequence).toBe(index + 1)
        const response = await call(db, 'GET', id)
        expect(response.status).toBe(200)
        expect(response.headers.get('etag')).toBe(etag)
        const raw = await response.text(), page = JSON.parse(raw), object = page.objects[0]
        expect(page.objects).toHaveLength(1)
        expect(object.objectId).toBe('browser-workspace')
        expect(object.kind).toBe(payload.schemaVersion)
        expect(object.payload).toEqual(payload)
        expect(object.contentHash).toBe(await hashContent({ schemaVersion: payload.schemaVersion, tombstone: false, payload }))
        const { payload: omitted, ...entry } = object
        expect(saved.body.contentHash).toBe(await hashContent([entry]))
        revisions.push({ id: saved.body.revisionId, raw })
      }
      for (const revision of revisions) expect(await (await call(db, 'GET', id, undefined, undefined, undefined, revision.id)).text()).toBe(revision.raw)
      expect(await db.prepare("SELECT kind FROM timeline_objects WHERE id='browser-workspace'").first()).toEqual({ kind: 'timeline-workspace.v1' })
      expect((await db.prepare('SELECT schema_version FROM timeline_object_versions ORDER BY rowid').all()).results.map(row => row.schema_version)).toEqual(['timeline-workspace.v1', 'timeline-workspace.v2', 'timeline-workspace.v1'])
    } finally { await mf.dispose() }
  })

  test('objects created as v2 can become v1 while neither workspace version crosses the candidate family', async () => {
    const { mf, db } = await setup()
    try {
      await db.batch(migration.map(sql => db.prepare(sql)))
      const created = await create(db), id = created.body.artifactId
      const first = await write(db, id, created.etag, snapshot(true), 'interval-new-v2-first')
      const second = await write(db, id, first.etag, snapshot(), 'interval-new-v2-to-v1')
      expect(await db.prepare("SELECT kind FROM timeline_objects WHERE id='browser-workspace'").first()).toEqual({ kind: 'timeline-workspace.v2' })
      const add = await call(db, 'PATCH', id, commit(candidate()), 'interval-add-candidate', second.etag)
      expect(add.status).toBe(200)
      const baseline = await rows(db), etag = add.headers.get('etag')!
      for (const change of [candidate('browser-workspace'), put(snapshot(), 'candidate'), put(snapshot(true), 'candidate')]) {
        expect((await call(db, 'PATCH', id, commit(change), 'interval-cross-family', etag)).status).toBe(409)
        expect(await rows(db)).toEqual(baseline)
      }
    } finally { await mf.dispose() }
  })

  test('invalid intervals, mismatched and future kinds, and canonical/wire limits fail without writes', async () => {
    const { mf, db } = await setup()
    try {
      await db.batch(migration.map(sql => db.prepare(sql)))
      const created = await create(db), id = created.body.artifactId, before = await rows(db)
      const reversed = snapshot(true); reversed.analystWorkspace.events[0].recordedEnd = { date: '2025', precision: 'year' }
      const malformed = snapshot(true); (malformed.analystWorkspace.events[0].recordedEnd as any).unknown = true
      for (const change of [put(reversed), put(malformed), put(snapshot(true), 'browser-workspace', 'timeline-workspace.v1'), put(snapshot(), 'browser-workspace', 'timeline-workspace.v2'), put(snapshot(true), 'browser-workspace', 'timeline-workspace.v3')]) {
        expect((await call(db, 'PATCH', id, commit(change), 'interval-invalid-input', created.etag)).status).toBe(400)
        expect(await rows(db)).toEqual(before)
      }
      const large = snapshot(true)
      for (const field of ['title', 'framing', 'question', 'scope', 'intendedUse'] as const) large.analystWorkspace.narrative[field] = 'x'.repeat(10000)
      large.analystWorkspace.events[0].description = 'x'.repeat(10000)
      large.analystWorkspace.events[0].analystNote = 'x'.repeat(WORKSPACE_SNAPSHOT_MAX_BYTES + 1 - new TextEncoder().encode(canonicalJson(large)).length)
      expect(new TextEncoder().encode(canonicalJson(large)).length).toBe(WORKSPACE_SNAPSHOT_MAX_BYTES + 1)
      expect((await call(db, 'PATCH', id, commit(put(large)), 'interval-canonical-limit', created.etag)).status).toBe(400)
      large.analystWorkspace.events[0].analystNote = 'x'.repeat(65536)
      expect((await call(db, 'PATCH', id, commit(put(large)), 'interval-wire-limit', created.etag)).status).toBe(413)
      expect(await rows(db)).toEqual(before)
    } finally { await mf.dispose() }
  })

  test('concurrent v2 retry is exact after later v1, changed retry conflicts and stale new writes fail', async () => {
    const { mf, db } = await setup()
    try {
      await db.batch(migration.map(sql => db.prepare(sql)))
      const created = await create(db), id = created.body.artifactId
      const first = await write(db, id, created.etag, snapshot(), 'interval-retry-first')
      const input = commit(put(snapshot(true))), key = 'interval-concurrent-retry'
      const responses = await Promise.all([call(db, 'PATCH', id, input, key, first.etag), call(db, 'PATCH', id, input, key, first.etag)])
      expect(responses.map(response => response.status)).toEqual([200, 200])
      const original = await responses[0].text()
      expect(await responses[1].text()).toBe(original)
      const next = await write(db, id, responses[0].headers.get('etag')!, snapshot(), 'interval-retry-later-v1')
      const replay = await call(db, 'PATCH', id, input, key, first.etag)
      expect(replay.status).toBe(200); expect(await replay.text()).toBe(original)
      expect(replay.headers.get('etag')).toBe(responses[0].headers.get('etag'))
      const before = await rows(db)
      expect((await call(db, 'PATCH', id, commit(put(snapshot())), key, first.etag)).status).toBe(409)
      expect((await call(db, 'PATCH', id, input, 'interval-stale-new-key', first.etag)).status).toBe(412)
      expect(await rows(db)).toEqual(before)
      expect(next.body.sequence).toBe(3)
    } finally { await mf.dispose() }
  })

  test('SQL family, immutability and tombstone guards survive reconstruction and failed v2 batches roll back', async () => {
    const { mf, db } = await setup()
    try {
      await db.batch(migration.map(sql => db.prepare(sql)))
      const created = await create(db), id = created.body.artifactId
      const saved = await write(db, id, created.etag, snapshot(true), 'interval-guards-initial')
      const before = await rows(db)
      await expect(db.prepare("INSERT INTO timeline_object_versions SELECT workspace_id,artifact_id,object_id,'invalid-family','event-candidate.v1',tombstone,payload_json,content_hash,created_by,created_at FROM timeline_object_versions").run()).rejects.toThrow(/timeline_kind_mismatch/)
      await expect(db.prepare("UPDATE timeline_objects SET kind='timeline-workspace.v1'").run()).rejects.toThrow(/timeline_immutable/)
      await expect(db.prepare('INSERT OR REPLACE INTO timeline_object_versions SELECT * FROM timeline_object_versions').run()).rejects.toThrow(/timeline_immutable/)
      expect(await rows(db)).toEqual(before)
      const failing = wrapped(db, async statements => await db.batch([...statements, db.prepare("SELECT json('injected failure')")]))
      expect((await call(failing, 'PATCH', id, commit(put(snapshot())), 'interval-failed-write', saved.etag)).status).toBe(503)
      expect(await rows(db)).toEqual(before)
      const revoked = wrapped(db, async statements => {
        await db.prepare('UPDATE users SET is_active=0 WHERE id=1').run()
        return await db.batch(statements)
      })
      expect((await call(revoked, 'PATCH', id, commit(put(snapshot())), 'interval-revoked-write', saved.etag)).status).toBe(403)
      expect(await rows(db)).toEqual(before)
      await db.prepare('UPDATE users SET is_active=1 WHERE id=1').run()
      const deleted = await call(db, 'PATCH', id, commit({ op: 'delete', objectId: 'browser-workspace' }), 'interval-delete-object', saved.etag)
      expect(deleted.status).toBe(200)
      expect((await call(db, 'PATCH', id, commit(put(snapshot())), 'interval-resurrect-write', deleted.headers.get('etag')!)).status).toBe(409)
      await expect(db.prepare("INSERT INTO timeline_object_versions SELECT workspace_id,artifact_id,object_id,'resurrection','timeline-workspace.v1',0,?,content_hash,created_by,created_at FROM timeline_object_versions LIMIT 1").bind(canonicalJson(snapshot())).run()).rejects.toThrow(/timeline_object_deleted/)
      expect((await db.prepare('PRAGMA foreign_key_check').all()).results).toEqual([])
    } finally { await mf.dispose() }
  })
})
