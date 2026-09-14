import { test, expect } from '@playwright/test'
import { Miniflare } from 'miniflare'
import type { D1Database, D1PreparedStatement } from '@cloudflare/workers-types'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { onRequestPost as publishRoute, onRequestGet as listRoute } from '../../../functions/api/timeline-presentations'
import { onRequestGet as readRoute, onRequestDelete as revokeRoute } from '../../../functions/api/timeline-presentations/[token]'
import { decodeTimelinePresentation } from '../../../src/lib/timeline-presentation-contract'

const sql = readFileSync(new URL('../../../schema/managed-migrations/0014_timeline_presentations.sql', import.meta.url), 'utf8')
// This migration consists exclusively of five top-level CREATE declarations.
// Splitting their line starts preserves every trigger body and CASE semicolon.
const migration = sql.trim().split(/\n(?=CREATE (?:TABLE|INDEX|TRIGGER) )/)
const ownerHash = 'sharing-human-owner-0001', otherHash = 'sharing-human-other-0002'
const key = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const fixture = (headline = 'Frozen &lt;research&gt;') => ({
  schemaVersion: 'timeline-presentation.v1', timeline: {
    scale: 'human', title: { unique_id: 'narrative-title', autolink: false, text: { headline, text: '<p>Selected framing only.</p>' } },
    events: [{ unique_id: 'event-research%3Aone', autolink: false, start_date: { year: 2026, month: 9, day: 14, hour: 9, minute: 0 }, end_date: { year: 2026, month: 9, day: 14, hour: 10, minute: 30 }, display_date: '09:00 through 10:30', text: { headline: 'Event', text: '<p><strong>Assessment:</strong> Recorded assertion.</p>' } }],
  },
})
async function database(apply = true) {
  const mf = new Miniflare({ modules: true, script: 'export default { fetch() { return new Response("ok") } }', d1Databases: { DB: 'timeline-sharing-test' } })
  const db = await mf.getD1Database('DB')
  try {
    // Bounded auth-compatible prerequisite, not a full production-prefix rehearsal.
    await db.prepare('CREATE TABLE users(id INTEGER PRIMARY KEY,user_hash TEXT UNIQUE,role TEXT NOT NULL,is_active INTEGER NOT NULL)').run()
    await db.prepare("INSERT INTO users VALUES(1,?,'researcher',1),(2,?,'researcher',1)").bind(ownerHash, otherHash).run()
    if (apply) await db.batch(migration.map(statement => db.prepare(statement)))
    return { mf, db }
  } catch (error) { await mf.dispose(); throw error }
}
async function call(db: D1Database, method: string, options: { token?: string; body?: unknown; key?: string; hash?: string | null; headers?: Record<string, string>; raw?: string } = {}) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (options.hash !== null) headers['X-User-Hash'] = options.hash || ownerHash
  if (options.key) headers['Idempotency-Key'] = options.key
  Object.assign(headers, options.headers)
  const request = new Request(`https://researchtools.example/api/timeline-presentations${options.token === undefined ? '' : '/' + options.token}`, {
    method, headers, ...(method === 'POST' ? { body: options.raw ?? JSON.stringify(options.body ?? fixture()) } : {}),
  })
  const context = { request, env: { DB: db }, params: { token: options.token } } as never
  return await (method === 'POST' ? publishRoute : method === 'DELETE' ? revokeRoute : options.token === undefined ? listRoute : readRoute)(context)
}
async function publish(db: D1Database, n = 1, body = fixture()) {
  const result = await call(db, 'POST', { key: key(n), body })
  expect(result.status).toBe(201)
  const link = await result.json() as { schemaVersion: string; token: string; createdAt: string; revoked: boolean }
  expect(Object.keys(link).sort()).toEqual(['createdAt', 'revoked', 'schemaVersion', 'token'])
  expect(link.schemaVersion).toBe('timeline-presentation-link.v1')
  expect(link.token).toMatch(/^[0-9a-f]{64}$/)
  expect(link.revoked).toBe(false)
  return link
}
const state = (db: D1Database) => db.prepare('SELECT * FROM timeline_presentations ORDER BY token').all()
function intercepted(db: D1Database, run: (statements: D1PreparedStatement[]) => Promise<unknown>): D1Database {
  return { prepare: (statement: string) => db.prepare(statement), batch: run } as unknown as D1Database
}
function security(response: Response) {
  expect(response.headers.get('Cache-Control')).toBe('no-store')
  expect(response.headers.get('Referrer-Policy')).toBe('no-referrer')
  expect(response.headers.get('X-Robots-Tag')).toBe('noindex,nofollow')
  expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
  expect(response.headers.has('Access-Control-Allow-Origin')).toBe(false)
}

test.describe('direct presentation sharing actual D1 @smoke', () => {
  test('creates frozen intervals, anonymously reads only presentation, and lists plain bounded creator summaries', async () => {
    const { mf, db } = await database()
    try {
      const input = fixture(), link = await publish(db, 1, input)
      input.timeline.events[0].text.headline = 'Later working copy'
      const result = await call(db, 'GET', { token: link.token, hash: null })
      security(result)
      expect(result.status).toBe(200)
      const publicBody = await result.json()
      expect(publicBody).toEqual(decodeTimelinePresentation(fixture()))
      expect(JSON.stringify(publicBody)).not.toMatch(/owner_id|request_key|payload_hash|user_hash|Later working copy/)
      const list = await call(db, 'GET')
      security(list)
      expect(await list.json()).toEqual({ schemaVersion: 'timeline-presentation-links.v1', links: [{ token: link.token, createdAt: link.createdAt, title: 'Frozen <research>' }] })
      expect(await (await call(db, 'GET', { hash: otherHash })).json()).toEqual({ schemaVersion: 'timeline-presentation-links.v1', links: [] })
      await publish(db, 2, fixture('😀'.repeat(201)))
      const longList = await (await call(db, 'GET')).json() as any
      expect(longList.links.some((item: any) => item.title === '😀'.repeat(199) + '…')).toBe(true)
      const before = (await state(db)).results
      await call(db, 'GET', { token: link.token, hash: null })
      await call(db, 'GET')
      expect((await state(db)).results).toEqual(before)
    } finally { await mf.dispose() }
  })

  test('concurrent same-key retries create one link, conflict on change, and never republish a revoked key', async () => {
    const { mf, db } = await database()
    try {
      const responses = await Promise.all([call(db, 'POST', { key: key(1) }), call(db, 'POST', { key: key(1) })])
      expect(responses.map(item => item.status).sort()).toEqual([200, 201])
      const links = await Promise.all(responses.map(item => item.json())) as any[]
      expect(links[0]).toEqual(links[1])
      expect((await state(db)).results).toHaveLength(1)
      const retry = await call(db, 'POST', { key: key(1) })
      expect(retry.status).toBe(200)
      expect(await retry.json()).toEqual(links[0])
      expect((await call(db, 'POST', { key: key(1), body: fixture('Changed') })).status).toBe(409)
      expect((await call(db, 'DELETE', { token: links[0].token })).status).toBe(204)
      expect((await call(db, 'POST', { key: key(1) })).status).toBe(409)
      const stored = (await state(db)).results as any[]
      expect(stored).toHaveLength(1)
      expect(stored[0].payload).toBeNull()
      expect(stored[0].revoked_at).not.toBeNull()
    } finally { await mf.dispose() }
  })

  test('quota permits exactly twenty active links under contention, allows replay, and frees only revoked capacity', async () => {
    const { mf, db } = await database()
    try {
      const first = await publish(db)
      for (let n = 2; n <= 19; n++) await publish(db, n)
      const race = await Promise.all([call(db, 'POST', { key: key(20) }), call(db, 'POST', { key: key(21) })])
      expect(race.map(item => item.status).sort()).toEqual([201, 409])
      expect((await state(db)).results).toHaveLength(20)
      expect((await call(db, 'POST', { key: key(1) })).status).toBe(200)
      expect((await call(db, 'POST', { key: key(22) })).status).toBe(409)
      expect((await (await call(db, 'GET')).json() as any).links).toHaveLength(20)
      expect((await call(db, 'DELETE', { token: first.token })).status).toBe(204)
      await publish(db, 22)
      expect((await state(db)).results).toHaveLength(21)
      expect((await (await call(db, 'GET')).json() as any).links).toHaveLength(20)
    } finally { await mf.dispose() }
  })

  test('only owner revokes, repeated revoke is204, and unavailable reads share one generic response', async () => {
    const { mf, db } = await database()
    try {
      const link = await publish(db)
      expect((await call(db, 'DELETE', { token: link.token, hash: otherHash })).status).toBe(404)
      expect((await call(db, 'GET', { token: link.token, hash: null })).status).toBe(200)
      expect((await call(db, 'DELETE', { token: link.token, hash: null })).status).toBe(401)
      for (let n = 0; n < 2; n++) {
        const revoked = await call(db, 'DELETE', { token: link.token })
        expect(revoked.status).toBe(204)
        security(revoked)
        expect(await revoked.text()).toBe('')
      }
      for (const token of [link.token, 'f'.repeat(64), 'malformed-token']) {
        const result = await call(db, 'GET', { token, hash: null })
        expect(result.status).toBe(404)
        security(result)
        expect(await result.json()).toEqual({ schemaVersion: 'timeline-presentation-error.v1', error: { code: 'unavailable' } })
      }
    } finally { await mf.dispose() }
  })

  test('guest, service, inactive and whitespace roles cannot publish/list/revoke or keep public reads available', async () => {
    const { mf, db } = await database()
    try {
      const link = await publish(db)
      const baseline = (await state(db)).results
      for (const [role, active] of [['guest', 1], ['service', 1], ['researcher', 0], ['', 1], ['\t', 1], ['\tguest\t', 1], ['\u00a0service\u00a0', 1]] as const) {
        await db.prepare('UPDATE users SET role=?,is_active=? WHERE id=1').bind(role, active).run()
        expect((await call(db, 'POST', { key: key(2) })).status).toBe(403)
        expect((await call(db, 'GET')).status).toBe(403)
        expect((await call(db, 'DELETE', { token: link.token })).status).toBe(403)
        expect((await call(db, 'GET', { token: link.token, hash: null })).status).toBe(404)
      }
      await db.prepare("UPDATE users SET role='researcher',is_active=1 WHERE id=1").run()
      expect((await call(db, 'POST', { key: key(2), headers: { Authorization: 'Bearer rt_svc_fixture.invalid' } })).status).toBe(403)
      expect((await call(db, 'POST', { key: key(2), headers: { 'X-Guest-Session': 'fixture' } })).status).toBe(403)
      expect((await state(db)).results).toEqual(baseline)
    } finally { await mf.dispose() }
  })

  test('transaction authorization revocation blocks fresh publication, replay and revoke with no residual changes', async () => {
    const { mf, db } = await database()
    try {
      const link = await publish(db), baseline = (await state(db)).results
      for (const [role, active] of [['guest', 1], ['\tservice\t', 1], ['\t', 1], ['researcher', 0]] as const) {
        for (const operation of ['create', 'replay', 'revoke']) {
          await db.prepare("UPDATE users SET role='researcher',is_active=1 WHERE id=1").run()
          const revoked = intercepted(db, async statements => {
            await db.prepare('UPDATE users SET role=?,is_active=? WHERE id=1').bind(role, active).run()
            return await db.batch(statements)
          })
          const result = operation === 'revoke'
            ? await call(revoked, 'DELETE', { token: link.token })
            : await call(revoked, 'POST', { key: key(operation === 'create' ? 2 : 1) })
          expect(result.status).toBe(403)
          expect((await state(db)).results).toEqual(baseline)
        }
      }
    } finally { await mf.dispose() }
  })

  test('immutable guards defeat payload changes, replacement, deletion and resurrection independently of recursive triggers', async () => {
    const { mf, db } = await database()
    try {
      const link = await publish(db), baseline = (await state(db)).results
      await db.prepare('PRAGMA recursive_triggers=OFF').run()
      for (const statement of [
        "UPDATE timeline_presentations SET payload='{}'",
        "UPDATE timeline_presentations SET owner_id=2",
        "UPDATE timeline_presentations SET revoked_at='2026-09-14T00:00:00.000Z'",
        'DELETE FROM timeline_presentations',
        'INSERT OR REPLACE INTO timeline_presentations SELECT * FROM timeline_presentations',
        "INSERT OR REPLACE INTO timeline_presentations SELECT ?,owner_id,request_key,payload_hash,payload,created_at,revoked_at FROM timeline_presentations",
      ]) {
        const prepared = db.prepare(statement)
        await expect((statement.includes('?') ? prepared.bind('e'.repeat(64)) : prepared).run()).rejects.toThrow()
        expect((await state(db)).results).toEqual(baseline)
      }
      expect((await call(db, 'DELETE', { token: link.token })).status).toBe(204)
      const revoked = (await state(db)).results
      await expect(db.prepare('UPDATE timeline_presentations SET revoked_at=NULL,payload=?').bind(JSON.stringify(decodeTimelinePresentation(fixture()))).run()).rejects.toThrow()
      expect((await state(db)).results).toEqual(revoked)
    } finally { await mf.dispose() }
  })

  test('actual migration and publication batches roll back on injected middle failures', async () => {
    const { mf, db } = await database(false)
    try {
      expect(migration).toHaveLength(5)
      const before = (await db.prepare('SELECT type,name,tbl_name,sql FROM sqlite_master ORDER BY name').all()).results
      const failure = db.prepare("INSERT INTO users VALUES(1,'duplicate','researcher',1)")
      await expect(db.batch([...migration.slice(0, 3).map(item => db.prepare(item)), failure, ...migration.slice(3).map(item => db.prepare(item))])).rejects.toThrow()
      expect((await db.prepare('SELECT type,name,tbl_name,sql FROM sqlite_master ORDER BY name').all()).results).toEqual(before)
      await db.batch(migration.map(item => db.prepare(item)))
      for (const position of [1, 2, 3]) {
        const faulty = intercepted(db, async statements => await db.batch([...statements.slice(0, position), failure, ...statements.slice(position)]))
        const result = await call(faulty, 'POST', { key: key(1) })
        expect(result.status).toBe(503)
        expect(await result.text()).not.toMatch(/SQL|INSERT|duplicate|payload|token/)
        expect((await state(db)).results).toEqual([])
      }
      await publish(db)
    } finally { await mf.dispose() }
  })

  test('malformed/oversized requests never mutate and corrupt stored projections fail closed without content leakage', async () => {
    const { mf, db } = await database()
    try {
      for (const body of [{ ...fixture(), privateBackup: 'must-not-publish' }, { ...fixture(), timeline: { ...fixture().timeline, media: 'https://private.invalid' } }, { ...fixture(), timeline: { ...fixture().timeline, events: [] } }]) {
        const result = await call(db, 'POST', { key: key(1), body })
        expect(result.status).toBe(400)
        security(result)
        expect(await result.text()).not.toMatch(/private|media|https/)
      }
      expect((await call(db, 'POST', { key: 'invalid' })).status).toBe(400)
      expect((await call(db, 'POST', { key: key(1), raw: '{' })).status).toBe(400)
      expect((await call(db, 'POST', { key: key(1), raw: ' '.repeat(524289) })).status).toBe(413)
      expect((await state(db)).results).toEqual([])
      const payload = JSON.stringify({ ...fixture(), privateBackup: 'private-corruption-marker' })
      const digest = createHash('sha256').update(payload).digest('hex')
      await db.prepare('INSERT INTO timeline_presentations VALUES(?,1,?,?,?,?,NULL)').bind('d'.repeat(64), key(3), digest, payload, '2026-09-14T00:00:00.000Z').run()
      const unavailable = await call(db, 'GET', { token: 'd'.repeat(64), hash: null })
      expect(unavailable.status).toBe(404)
      expect(await unavailable.text()).not.toContain('private-corruption-marker')
      expect((await call(db, 'GET')).status).toBe(503)
    } finally { await mf.dispose() }
  })
})
