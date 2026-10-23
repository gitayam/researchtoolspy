/**
 * Room link codes (migration 0027): a Signal room links to a COP only with the COP
 * side's consent.
 * - POST /api/cop/:id/room-link-codes: the owner or an admin collaborator (granting
 *   access is the owner's call); never an editor, a viewer, a stranger, a share link or a
 *   service. The code is shown once; only its SHA-256 is stored; 24 hours; at most 10
 *   open per COP.
 * - DELETE /api/cop/:id/room-link-codes: the owner or an admin revokes every open code
 *   (answers how many); a revoked code is never redeemed; used codes stay as they were.
 * - POST /api/cop/room-link-codes/redeem: the Signal bot only. Single use (two redeems at
 *   once: one wins), unknown/used/revoked/expired/malformed codes are one refusal, the
 *   issuer must still be the owner or an admin. One db.batch(): the code is spent only
 *   with its collaborator write (a failing write leaves it unspent), and two codes for
 *   one COP redeemed at once leave one collaborator row. An existing collaborator row is
 *   never changed: a viewer bot gets 409 and the code stays unspent; an editor bot links
 *   with no write. 300 tries an hour per bot client.
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
const revokeAll = (env, who, session = SESSION, { headers = {}, through } = {}) =>
  call(env, 'linkCodes', 'DELETE', `/api/cop/${session}/room-link-codes`, { who, params: { id: session }, headers, through })
const redeem = (env, code, { who = 'service', through = 'middleware' } = {}) =>
  call(env, 'redeem', 'POST', '/api/cop/room-link-codes/redeem', { who, through, body: { code } })
const codeFor = async (env, who = 'owner', session = SESSION) => {
  const res = await make(env, who, session)
  assert.equal(res.status, 201, await res.clone().text())
  return res.json()
}
const feedStatus = async (env, session) =>
  (await call(env, 'chatFeed', 'GET', `/api/cop/${session}/chat-feed?since=`, { who: 'service', through: 'middleware', params: { id: session } })).status
const hashOf = (code) => createHash('sha256').update(code).digest('hex')
const usedAt = (db, code) => db.prepare('SELECT used_at FROM cop_room_link_codes WHERE code_hash = ?').get(hashOf(code)).used_at
const botRows = (db, session) =>
  db.prepare('SELECT id, role, invited_by FROM cop_collaborators WHERE cop_session_id = ? AND user_id = ? ORDER BY id').all(session, SERVICE_USER)
/** The bot is not yet a collaborator of the main session. */
const dropBot = (db) => db.prepare("DELETE FROM cop_collaborators WHERE id = 'col-service'").run()

test('the owner or an admin makes a code; it is shown once and only its hash is stored', async () => {
  const { db, env } = await codesFixture()
  for (const who of ['owner', 'admin']) {
    const made = await codeFor(env, who)
    assert.match(made.code, /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{10}$/)
    assert.equal(made.command, `!cop link ${made.code}`)
    const ttl = Date.parse(made.expires_at) - Date.now()
    assert.ok(ttl > 23.9 * 3600_000 && ttl <= 24 * 3600_000, String(ttl))
    const row = db.prepare('SELECT * FROM cop_room_link_codes WHERE code_hash = ?').get(hashOf(made.code))
    assert.equal(row.cop_session_id, SESSION)
    assert.ok(!JSON.stringify(db.prepare('SELECT * FROM cop_room_link_codes').all()).includes(made.code))
    assert.ok(!JSON.stringify(db.prepare('SELECT payload FROM cop_events').all()).includes(made.code))
  }
  const res = await make(env, 'owner')
  assert.equal(res.headers.get('Cache-Control'), 'no-store')
})

test('editors, viewers, strangers, anonymous callers, share links and services cannot make codes', async () => {
  const { db, env } = await codesFixture()
  db.prepare('INSERT INTO cop_shares (id, cop_session_id, share_token, visible_panels) VALUES (?, ?, ?, ?)')
    .run('sh-1', SESSION, '66666666-0000-4000-8000-000000000001', '["map"]')
  const editor = await make(env, 'editor')
  assert.equal(editor.status, 403)
  assert.equal((await editor.json()).code, 'NOT_OWNER_OR_ADMIN')
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
  assert.equal(allowed('DELETE', '/api/cop/cop-x/room-link-codes'), false)
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
  const added = db.prepare("SELECT created_by, payload FROM cop_events WHERE cop_session_id = ? AND event_type = 'collaborator.added'").all(OTHER_SESSION)
  assert.deepEqual(added.map((e) => [e.created_by, JSON.parse(e.payload).via]), [[4, 'room_link_code']])

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

/**
 * The worst interleaving, made certain: the first `parties` reads whose SQL matches
 * `pattern` wait for each other, so every request has read before any of them writes.
 * (Released after 2 s regardless, so a code path that never gets there fails, not hangs.)
 */
function readBarrier(env, pattern, parties = 2) {
  const real = env.DB
  let left = parties
  const waiting = []
  const release = () => waiting.splice(0).forEach((resolve) => resolve())
  const pass = async () => {
    if (left <= 0) return
    left -= 1
    await new Promise((resolve) => {
      waiting.push(resolve)
      if (waiting.length === parties) release()
      else setTimeout(release, 2000)
    })
  }
  const wrap = (st) => ({
    ...st,
    bind: (...args) => wrap(st.bind(...args)),
    first: async (column) => { await pass(); return st.first(column) },
    all: async () => { await pass(); return st.all() },
    run: async () => { await pass(); return st.run() },
  })
  env.DB = { ...real, prepare: (sql) => (pattern.test(sql) ? wrap(real.prepare(sql)) : real.prepare(sql)), batch: (list) => real.batch(list) }
}

test('two codes for one COP redeemed at once: both link, and the bot gets exactly one collaborator row', async () => {
  const { db, env } = await codesFixture()
  const first = await codeFor(env, 'stranger', OTHER_SESSION)
  const second = await codeFor(env, 'stranger', OTHER_SESSION)
  // Both redeems read the bot's collaborator rows (none yet) before either writes.
  readBarrier(env, /SELECT id, role FROM cop_collaborators WHERE cop_session_id = \? AND user_id = \?/)
  const results = await Promise.all([redeem(env, first.code), redeem(env, second.code)])
  assert.deepEqual(results.map((r) => r.status), [200, 200])
  assert.equal(botRows(db, OTHER_SESSION).length, 1)
  assert.equal(botRows(db, OTHER_SESSION)[0].role, 'editor')
  assert.ok(usedAt(db, first.code) && usedAt(db, second.code))
})

test('a code is never spent without its collaborator write: a failing write leaves it unspent', async () => {
  const { db, env } = await codesFixture()
  const { code } = await codeFor(env, 'stranger', OTHER_SESSION)
  db.exec(`CREATE TRIGGER no_collaborators BEFORE INSERT ON cop_collaborators BEGIN SELECT RAISE(ABORT, 'collaborator write failed'); END`)
  const res = await redeem(env, code)
  assert.equal(res.status, 500)
  assert.equal(usedAt(db, code), null)
  assert.equal(botRows(db, OTHER_SESSION).length, 0)
  // Once the write can happen, the same code works.
  db.exec('DROP TRIGGER no_collaborators')
  assert.equal((await redeem(env, code)).status, 200)
  assert.equal(botRows(db, OTHER_SESSION).length, 1)
})

test('a viewer bot is never raised: 409, the code unspent, the role unchanged; an editor bot links with no write', async () => {
  const { db, env } = await codesFixture()
  db.exec("UPDATE cop_collaborators SET role = 'viewer' WHERE id = 'col-service'")
  const { code } = await codeFor(env, 'owner')
  const refused = await redeem(env, code)
  assert.equal(refused.status, 409)
  assert.deepEqual(await refused.json(), {
    error: 'The bot is a viewer on this COP; the owner can change that in ResearchTools', code: 'BOT_ROLE_TOO_LOW',
  })
  assert.equal(usedAt(db, code), null)
  assert.deepEqual(botRows(db, SESSION).map((r) => r.role), ['viewer'])

  // The owner makes the bot an editor in ResearchTools: the same code now links, with no write.
  db.exec("UPDATE cop_collaborators SET role = 'Editor' WHERE id = 'col-service'")
  const before = JSON.stringify(botRows(db, SESSION))
  const events = db.prepare('SELECT COUNT(*) AS n FROM cop_events WHERE event_type = ?')
  assert.equal((await redeem(env, code)).status, 200)
  assert.ok(usedAt(db, code))
  assert.equal(JSON.stringify(botRows(db, SESSION)), before)
  assert.equal(events.get('collaborator.added').n, 0)
  assert.equal(events.get('activity.logged').n >= 2, true) // code made, code used

  // The bot's own COP: linked, and no collaborator row for its owner.
  db.prepare(`INSERT INTO cop_sessions (id, name, template_type, status, workspace_id, created_by) VALUES ('cop-bot', 'Bot COP', 'custom', 'ACTIVE', 'workspace-test', ?)`).run(SERVICE_USER)
  db.prepare(`INSERT INTO cop_collaborators (id, cop_session_id, user_id, role) VALUES ('col-bot-admin', 'cop-bot', 1, 'admin')`).run()
  const own = await codeFor(env, 'owner', 'cop-bot')
  assert.equal((await redeem(env, own.code)).status, 200)
  assert.equal(botRows(db, 'cop-bot').length, 0)
})

test('the batch re-checks what changed after the first reads: a bot made a viewer, or an issuer demoted, in between', async () => {
  const { db, env } = await codesFixture()
  dropBot(db)
  const { code } = await codeFor(env, 'admin')
  const realBatch = env.DB.batch.bind(env.DB)
  // Someone adds the bot as a viewer just before the redeem's transaction.
  env.DB.batch = async (statements) => {
    db.exec(`INSERT INTO cop_collaborators (id, cop_session_id, user_id, role) VALUES ('col-late', '${SESSION}', ${SERVICE_USER}, 'viewer')`)
    env.DB.batch = realBatch
    return realBatch(statements)
  }
  const late = await redeem(env, code)
  assert.equal(late.status, 409)
  assert.equal(usedAt(db, code), null)
  assert.deepEqual(botRows(db, SESSION).map((r) => r.role), ['viewer'])

  // The issuer (an admin) is demoted to editor just before the transaction: refused, unspent.
  dropBot(db)
  db.exec("DELETE FROM cop_collaborators WHERE id = 'col-late'")
  env.DB.batch = async (statements) => {
    db.exec("UPDATE cop_collaborators SET role = 'editor' WHERE id = 'col-admin'")
    env.DB.batch = realBatch
    return realBatch(statements)
  }
  const demoted = await redeem(env, code)
  assert.equal(demoted.status, 404)
  assert.equal(usedAt(db, code), null)
  assert.equal(botRows(db, SESSION).length, 0)
})

test('unknown, expired, revoked, malformed and orphaned codes are refused alike', async () => {
  const { db, env } = await codesFixture()
  dropBot(db)
  const { code: expired } = await codeFor(env, 'owner')
  db.exec(`UPDATE cop_room_link_codes SET expires_at = '2020-01-01T00:00:00.000Z'`)
  const { code: issuerGone } = await codeFor(env, 'admin')
  db.exec("UPDATE cop_collaborators SET role = 'editor' WHERE id = 'col-admin'") // the issuer is no longer an admin
  for (const bad of [expired, issuerGone, 'ABCDEFGHJK', 'short', '', 'IIIIIIIIII', `${expired}X`]) {
    const res = await redeem(env, bad)
    assert.equal(res.status, 404, bad)
    assert.equal((await res.json()).code, 'LINK_CODE_INVALID')
  }
  assert.equal(usedAt(db, issuerGone), null)
  assert.equal(botRows(db, SESSION).length, 0)
})

test('the owner or an admin revokes every open code at once; revoked codes never redeem', async () => {
  const { db, env } = await codesFixture()
  dropBot(db)
  const used = await codeFor(env, 'owner')
  assert.equal((await redeem(env, used.code)).status, 200)
  const a = await codeFor(env, 'owner')
  const b = await codeFor(env, 'admin')
  const other = await codeFor(env, 'stranger', OTHER_SESSION)
  db.exec(`UPDATE cop_room_link_codes SET expires_at = '2020-01-01T00:00:00.000Z' WHERE code_hash = '${hashOf(b.code)}'`)
  const c = await codeFor(env, 'admin')

  for (const who of ['editor', 'viewer', 'stranger']) assert.equal((await revokeAll(env, who)).status, 403, who)
  assert.equal((await revokeAll(env, 'anonymous')).status, 401)
  assert.equal((await revokeAll(env, 'service-admitted')).status, 403)
  assert.equal((await revokeAll(env, 'service', SESSION, { through: 'middleware' })).status, 403)
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM cop_room_link_codes WHERE revoked_at IS NOT NULL').get().n, 0)

  const res = await revokeAll(env, 'admin')
  assert.equal(res.status, 200)
  assert.equal(res.headers.get('Cache-Control'), 'no-store')
  assert.deepEqual(await res.json(), { revoked: 2 }) // a and c; not the used one, not the expired one
  const state = Object.fromEntries(db.prepare('SELECT code_hash, used_at, revoked_at, revoked_by FROM cop_room_link_codes').all()
    .map((r) => [r.code_hash, [Boolean(r.used_at), Boolean(r.revoked_at), r.revoked_by]]))
  assert.deepEqual(state[hashOf(a.code)], [false, true, 5])
  assert.deepEqual(state[hashOf(c.code)], [false, true, 5])
  assert.deepEqual(state[hashOf(used.code)], [true, false, null])
  assert.deepEqual(state[hashOf(b.code)], [false, false, null])
  assert.deepEqual(state[hashOf(other.code)], [false, false, null]) // another COP's code stays

  for (const code of [a.code, c.code]) assert.equal((await redeem(env, code)).status, 404)
  assert.deepEqual(await (await revokeAll(env, 'owner')).json(), { revoked: 0 })
  // Revoked codes no longer count against the 10 open per COP.
  for (let i = 0; i < 10; i += 1) await codeFor(env, 'owner')
  assert.equal((await make(env, 'owner')).status, 429)
  assert.deepEqual(await (await revokeAll(env, 'owner')).json(), { revoked: 10 })
  assert.equal((await make(env, 'owner')).status, 201)
})

test('people and other integrations cannot redeem; the bot gets 300 tries an hour', async () => {
  const { db, env } = await codesFixture()
  const { LINK_CODE_REDEEMS_PER_HOUR } = mod('linkCodeLib')
  assert.equal(LINK_CODE_REDEEMS_PER_HOUR, 300)
  const { code } = await codeFor(env, 'owner')
  assert.equal((await redeem(env, code, { who: 'owner', through: undefined })).status, 403)
  const request = new Request('https://researchtools.test/api/cop/room-link-codes/redeem', { method: 'POST', body: JSON.stringify({ code }) })
  const other = await mod('redeem').onRequestPost({
    request, env, params: {}, data: { copService: { clientId: 'osint-importer', principalUserId: SERVICE_USER, workspaceId: 'workspace-test' } },
  })
  assert.equal(other.status, 403)
  assert.equal(db.prepare('SELECT used_at FROM cop_room_link_codes').get().used_at, null)

  for (let i = 0; i < 299; i += 1) assert.equal((await redeem(env, 'ZZZZZZZZZZ')).status, 404)
  assert.equal((await redeem(env, code)).status, 200) // the 300th try still counts
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
  assert.equal((await revokeAll(pending.env, 'owner')).status, 503)
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
