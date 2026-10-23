/**
 * The COP change feed client (src/lib/cop-changes.ts): how one `/changes` answer
 * is read and where the poller goes next.
 *
 * - A server without the feed (404/405, or Pages' HTML fallback with 200) is "no
 *   feed": every panel refreshes on a slow timer instead.
 * - The first answer is a starting point and announces nothing.
 * - Later answers announce the known entity types once each; `has_more` polls
 *   again at once; a missing cursor keeps the old one.
 * - Errors back off, capped at a minute.
 *
 * The real module is bundled with esbuild (with the app's `@/` path alias).
 *
 * Run: npm run test:unit
 */
import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build } from 'esbuild'

const ROOT = new URL('../../', import.meta.url).pathname
let m

before(async () => {
  const dir = mkdtempSync(join(tmpdir(), 'rt-cop-changes-'))
  try {
    const outfile = join(dir, 'changes.mjs')
    await build({
      entryPoints: [join(ROOT, 'src/lib/cop-changes.ts')],
      bundle: true,
      format: 'esm',
      platform: 'node',
      target: 'es2022',
      outfile,
      tsconfig: join(ROOT, 'tsconfig.app.json'),
      logLevel: 'silent',
    })
    m = await import(outfile)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

const JSON_TYPE = 'application/json; charset=utf-8'
const ev = (id, entity_type) => ({ id: String(id), entity_type, entity_id: null, event_type: `${entity_type}.updated`, created_at: '2026-10-23T00:00:00Z' })

test('no feed: 404, 405 and the HTML fallback with 200', () => {
  assert.deepEqual(m.interpretChangesResponse(404, JSON_TYPE, { error: 'x' }), { kind: 'no-feed' })
  assert.deepEqual(m.interpretChangesResponse(405, null, null), { kind: 'no-feed' })
  assert.deepEqual(m.interpretChangesResponse(200, 'text/html; charset=utf-8', null), { kind: 'no-feed' })
  assert.deepEqual(m.interpretChangesResponse(200, null, null), { kind: 'no-feed' })
})

test('errors: other statuses and malformed bodies', () => {
  assert.equal(m.interpretChangesResponse(500, JSON_TYPE, { error: 'x' }).kind, 'error')
  assert.equal(m.interpretChangesResponse(429, JSON_TYPE, { error: 'x' }).kind, 'error')
  assert.equal(m.interpretChangesResponse(401, JSON_TYPE, null).kind, 'error')
  assert.equal(m.interpretChangesResponse(200, JSON_TYPE, null).kind, 'error')
  assert.equal(m.interpretChangesResponse(200, JSON_TYPE, []).kind, 'error')
  assert.equal(m.interpretChangesResponse(200, JSON_TYPE, { events: 'no' }).kind, 'error')
})

test('a page of events: malformed entries dropped, cursor and has_more read', () => {
  const out = m.interpretChangesResponse(200, JSON_TYPE, {
    events: [ev(1, 'evidence'), { nope: true }, ev(2, 'marker'), { id: 3 }],
    cursor: '42',
    has_more: true,
  })
  assert.equal(out.kind, 'events')
  assert.deepEqual(out.events.map(e => e.entity_type), ['evidence', 'marker'])
  assert.equal(out.cursor, '42')
  assert.equal(out.hasMore, true)
  const noCursor = m.interpretChangesResponse(200, JSON_TYPE, { events: [] })
  assert.equal(noCursor.cursor, null)
  assert.equal(noCursor.hasMore, false)
})

test('changed types: known ones once each, unknown ones ignored', () => {
  const types = m.changedEntityTypes([ev(1, 'marker'), ev(2, 'evidence'), ev(3, 'marker'), ev(4, 'mystery'), ev(5, 'tag')])
  assert.deepEqual(types, ['evidence', 'marker', 'tag'])
})

test('the first answer is a starting point: nothing announced, cursor kept', () => {
  const start = { cursor: null, delay: m.CHANGES_LIVE_MS, started: false }
  const first = m.planNextPoll(start, { kind: 'events', events: [ev(9, 'evidence')], cursor: '9', hasMore: false })
  assert.deepEqual(first.notify, [])
  assert.equal(first.cursor, '9')
  assert.equal(first.started, true)
  assert.equal(first.mode, 'live')
  assert.equal(first.delay, m.CHANGES_LIVE_MS)

  const next = m.planNextPoll(first, { kind: 'events', events: [ev(10, 'rfi'), ev(11, 'task')], cursor: '11', hasMore: false })
  assert.deepEqual(next.notify, ['rfi', 'task'])
  assert.equal(next.cursor, '11')
})

test('has_more polls again at once; a missing cursor keeps the old one', () => {
  const state = { cursor: '20', delay: m.CHANGES_LIVE_MS, started: true }
  const more = m.planNextPoll(state, { kind: 'events', events: [ev(21, 'marker')], cursor: '21', hasMore: true })
  assert.equal(more.delay, m.CHANGES_MORE_MS)
  assert.ok(m.CHANGES_MORE_MS < m.CHANGES_LIVE_MS)
  const kept = m.planNextPoll(state, { kind: 'events', events: [], cursor: null, hasMore: false })
  assert.equal(kept.cursor, '20')
  assert.deepEqual(kept.notify, [])
})

test('no feed: every type announced on the slow timer; errors back off to a minute', () => {
  const state = { cursor: '5', delay: m.CHANGES_LIVE_MS, started: true }
  const fallback = m.planNextPoll(state, { kind: 'no-feed' })
  assert.equal(fallback.mode, 'fallback')
  assert.equal(fallback.delay, m.CHANGES_NO_FEED_MS)
  assert.deepEqual([...fallback.notify].sort(), [...m.COP_ENTITY_TYPES].sort())
  assert.equal(fallback.cursor, '5')

  let s = state
  const delays = []
  for (let i = 0; i < 6; i++) {
    s = m.planNextPoll(s, { kind: 'error' })
    delays.push(s.delay)
    assert.equal(s.mode, 'retry')
    assert.deepEqual(s.notify, [])
  }
  assert.deepEqual(delays.slice(0, 3), [10_000, 20_000, 40_000])
  assert.ok(delays.every(d => d <= m.CHANGES_MAX_BACKOFF_MS))
  assert.equal(delays.at(-1), m.CHANGES_MAX_BACKOFF_MS)
  // Recovery returns to the live interval.
  const back = m.planNextPoll(s, { kind: 'events', events: [], cursor: '6', hasMore: false })
  assert.equal(back.delay, m.CHANGES_LIVE_MS)
})

test('concerns: a listener hears only its types; "*" hears everything', () => {
  assert.equal(m.concerns(['evidence'], ['evidence', 'upload']), true)
  assert.equal(m.concerns(['marker'], ['evidence']), false)
  assert.equal(m.concerns(['marker'], '*'), true)
  assert.equal(m.concerns([], '*'), false)
})
