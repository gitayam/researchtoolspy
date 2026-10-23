/**
 * Room link codes (migration 0027): a Signal room links to a COP only with the COP
 * side's consent.
 * - POST /api/cop/:id/room-link-codes: the owner, an editor or an admin; never a viewer,
 *   a stranger, a share link or a service. The code is shown once; only its SHA-256 is
 *   kept; 24 hours; at most 10 open per COP.
 * - POST /api/cop/room-link-codes/redeem: the Signal bot only. Single use (two redeems at
 *   once: one wins), unknown/used/expired/malformed codes are one refusal, the issuer must
 *   still be an editor, the bot becomes an editor collaborator, 30 tries an hour.
 *
 * Run: npm run test:unit
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import {
  call, CLIENT_ID, ENTRIES, fixture, migration, mod, OTHER_SESSION, SERVICE_USER, SESSION, setupCoreSuite,
} from './cop-core-harness.mjs'

Object.assign(ENTRIES, {
  linkCodes: 'functions/api/cop/[id]/room-link-codes.ts',
  redeem: 'functions/api/cop/room-link-codes/redeem.ts',
  linkCodeLib: 'functions/api/_shared/cop-room-link-codes.ts',
  copCaller: 'functions/api/_shared/cop-caller.ts',
  chatFeed: 'functions/api/cop/[id]/chat-feed.ts',
})
setupCoreSuite()

async function codesFixture({ migrated = true } = {}) {
  const f = await fixture()
  if (migrated) f.db.exec(migration('0027_cop_room_link_codes.sql'))
  return f
}

const make = (env, who, session = SESSION, { headers = {}, query = '' } = {}) =>
  call(env, 'linkCodes', 'POST', `/api/cop/${session}/room-link-codes${query}`, { who, params: { id: session }, headers })
const redeem = (env, code, { who = 'service', through = 'middleware' } = {}) =>
  call(env, 'redeem', 'POST', '/api/cop/room-link-codes/redeem', { who, through, body: { code } })
const codeFor = async (env, who = 'owner', session = SESSION) => {
  const res = await make(env, who, session)
  assert.equal(res.status, 201, await res.clone().text())
  return res.json()
}
const feedStatus = async (env, session) =>
  (await call(env, 'chatFeed', 'GET', `/api/cop/${session}/chat-feed?since=`, { who: 'service', through: 'middleware', params: { id: session } })).status

test('the owner, an editor or an admin makes a code; it is shown once and only its hash is stored', async () => {
  const { db, env } = await codesFixture()
  for (const who of ['owner', 'editor', 'admin']) {
    const made = await codeFor(env, who)
    assert.match(made.code, /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{10}$/)
    assert.equal(made.command, `!cop link ${made.code}`)
    const ttl = Date.parse(made.expires_at) - Date.now()
    assert.ok(ttl > 23.9 * 3600_000 && ttl <= 24 * 3600_000, String(ttl))
    const row = db.prepare('SELECT * FROM cop_room_link_codes WHERE code_hash = ?').get(createHash('sha256').update(made.code).digest('hex'))
    assert.equal(row.cop_session_id, SESSION)
    assert.ok(!JSON.stringify(db.prepare('SELECT * FROM cop_room_link_codes').all()).includes(made.code))
    assert.ok(!JSON.stringify(db.prepare('SELECT payload FROM cop_events').all()).includes(made.code))
  }
  const res = await make(env, 'owner')
  assert.equal(res.headers.get('Cache-Control'), 'no-store')
})

test('viewers, strangers, anonymous callers, share links and services cannot make codes', async () => {
  const { db, env } = await codesFixture()
  db.prepare('INSERT INTO cop_shares (id, cop_session_id, share_token, visible_panels) VALUES (?, ?, ?, ?)')
    .run('sh-1', SESSION, '66666666-0000-4000-8000-000000000001', '["map"]')
  assert.equal((await make(env, 'viewer')).status, 403)
  assert.equal((await make(env, 'stranger')).status, 403)
  assert.equal((await make(env, 'anonymous')).status, 401)
  assert.equal((await make(env, 'owner', SESSION, { headers: { 'X-Share-Token': '66666666-0000-4000-8000-000000000001' } })).status, 403)
  assert.equal((await make(env, 'owner', SESSION, { query: '?share=x' })).status, 403)
  assert.equal((await make(env, 'service-admitted')).status, 403)
  const viaMiddleware = await call(env, 'linkCodes', 'POST', `/api/cop/${SESSION}/room-link-codes`, { who: 'service', through: 'middleware', params: { id: SESSION } })
  assert.equal(viaMiddleware.status, 403)
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM cop_room_link_codes').get().n, 0)

  const { COP_SERVICE_ROUTES } = mod('copCaller')
  const allowed = (method, path) => COP_SERVICE_ROUTES.some((r) => r.method === method && r.path.test(path))
  assert.equal(allowed('POST', '/api/cop/room-link-codes/redeem'), true)
  assert.equal(allowed('GET', '/api/cop/room-link-codes/redeem'), false)
  assert.equal(allowed('POST', '/api/cop/cop-x/room-link-codes'), false)
  // "room-link-codes" is never taken for a session id.
  assert.equal(allowed('GET', '/api/cop/room-link-codes/rfis'), false)
  assert.equal(mod('copCaller').copSessionIdFromPath('/api/cop/room-link-codes/redeem'), null)
})

test('the bot redeems a code once: it becomes an editor of that COP and can read its feed', async () => {
  const { db, env } = await codesFixture()
  // A COP the bot has never seen, owned by someone else (user 4).
  assert.equal(await feedStatus(env, OTHER_SESSION), 403)
  const { code } = await codeFor(env, 'stranger', OTHER_SESSION)

  const ok = await redeem(env, code.toLowerCase().replace(/(.{5})/, '$1-'))
  assert.equal(ok.status, 200, await ok.clone().text())
  assert.deepEqual(await ok.json(), { session_id: OTHER_SESSION })
  const collab = db.prepare('SELECT role, invited_by FROM cop_collaborators WHERE cop_session_id = ? AND user_id = ?').get(OTHER_SESSION, SERVICE_USER)
  assert.deepEqual({ role: collab.role, invited_by: Number(collab.invited_by) }, { role: 'editor', invited_by: 4 })
  const row = db.prepare('SELECT used_at, used_by_service FROM cop_room_link_codes').get()
  assert.ok(row.used_at)
  assert.equal(row.used_by_service, CLIENT_ID)
  assert.equal(await feedStatus(env, OTHER_SESSION), 200)

  const again = await redeem(env, code)
  assert.equal(again.status, 404)
  assert.equal((await again.json()).code, 'LINK_CODE_INVALID')
})

test('two redeems of one code at once: exactly one wins', async () => {
  const { env } = await codesFixture()
  const { code } = await codeFor(env, 'owner')
  const results = await Promise.all([redeem(env, code), redeem(env, code)])
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 404])
})

test('unknown, expired, malformed and orphaned codes are refused alike; a viewer bot is raised to editor', async () => {
  const { db, env } = await codesFixture()
  const { code: expired } = await codeFor(env, 'owner')
  db.exec(`UPDATE cop_room_link_codes SET expires_at = '2020-01-01T00:00:00.000Z'`)
  const { code: issuerGone } = await codeFor(env, 'editor')
  db.exec("UPDATE cop_collaborators SET role = 'viewer' WHERE id = 'col-editor'") // the issuer lost edit rights
  for (const bad of [expired, issuerGone, 'ABCDEFGHJK', 'short', '', 'IIIIIIIIII', `${expired}X`]) {
    const res = await redeem(env, bad)
    assert.equal(res.status, 404, bad)
    assert.equal((await res.json()).code, 'LINK_CODE_INVALID')
  }
  // The bot as a viewer collaborator: redeeming makes it an editor (rooms write captures).
  db.exec(`UPDATE cop_collaborators SET role = 'viewer' WHERE id = 'col-service'`)
  const { code } = await codeFor(env, 'owner')
  assert.equal((await redeem(env, code)).status, 200)
  assert.equal(db.prepare("SELECT role FROM cop_collaborators WHERE id = 'col-service'").get().role, 'editor')
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM cop_collaborators WHERE cop_session_id = ? AND user_id = ?').get(SESSION, SERVICE_USER).n, 1)
})

test('people and other integrations cannot redeem; the bot gets 30 tries an hour', async () => {
  const { db, env } = await codesFixture()
  const { code } = await codeFor(env, 'owner')
  assert.equal((await redeem(env, code, { who: 'owner', through: undefined })).status, 403)
  const request = new Request('https://researchtools.test/api/cop/room-link-codes/redeem', { method: 'POST', body: JSON.stringify({ code }) })
  const other = await mod('redeem').onRequestPost({
    request, env, params: {}, data: { copService: { clientId: 'osint-importer', principalUserId: SERVICE_USER, workspaceId: 'workspace-test' } },
  })
  assert.equal(other.status, 403)
  assert.equal(db.prepare('SELECT used_at FROM cop_room_link_codes').get().used_at, null)

  for (let i = 0; i < 29; i += 1) assert.equal((await redeem(env, 'ZZZZZZZZZZ')).status, 404)
  assert.equal((await redeem(env, code)).status, 200) // the 30th try still counts
  const limited = await redeem(env, 'ZZZZZZZZZZ')
  assert.equal(limited.status, 429)
})

test('at most 10 open codes per COP; 503 before migration 0027', async () => {
  const { env } = await codesFixture()
  for (let i = 0; i < 10; i += 1) await codeFor(env, 'owner')
  const eleventh = await make(env, 'owner')
  assert.equal(eleventh.status, 429)
  assert.equal((await eleventh.json()).code, 'TOO_MANY_CODES')

  const pending = await codesFixture({ migrated: false })
  assert.equal((await make(pending.env, 'owner')).status, 503)
  assert.equal((await redeem(pending.env, 'ABCDEFGHJK')).status, 503)
})

test('codes are 10 characters from the unambiguous alphabet, drawn without bias', () => {
  const { newLinkCode, normalizeLinkCode, LINK_CODE_ALPHABET } = mod('linkCodeLib')
  assert.equal(LINK_CODE_ALPHABET.length, 32)
  const seen = new Set()
  const counts = new Map()
  for (let i = 0; i < 2000; i += 1) {
    const code = newLinkCode()
    assert.equal(normalizeLinkCode(code), code)
    seen.add(code)
    for (const ch of code) counts.set(ch, (counts.get(ch) ?? 0) + 1)
  }
  assert.equal(seen.size, 2000)
  assert.equal(counts.size, 32) // every symbol used, none outside the alphabet
  assert.equal(normalizeLinkCode('abcde-fghjk'), 'ABCDEFGHJK')
  assert.equal(normalizeLinkCode('ABCDEFGHJ1'), null) // 1 is not in the alphabet
})
