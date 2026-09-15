import { test, expect } from '@playwright/test'
import { Miniflare } from 'miniflare'
import { readFileSync } from 'node:fs'
import type { D1Database } from '@cloudflare/workers-types'
import { onRequestPost as mint } from '../../../functions/api/timeline-handoffs'
import { onRequestDelete as revoke } from '../../../functions/api/timeline-handoffs/[token]/index'
import { onRequestPost as redeem } from '../../../functions/api/timeline-handoffs/[token]/redeem'
import { deriveIntegrationTokenHash } from '../../../functions/api/_shared/service-auth'

// Copied verbatim from tests/e2e/smoke/timeline-service-d1.spec.ts — trigger-aware statement
// splitter so managed-migration files (with BEGIN...END trigger bodies) rehearse correctly.
function statements(sql: string): string[] {
  const result: string[] = []
  let start = 0
  let token = ''
  let tokens: string[] = []
  let trigger = false
  let depth = 0
  let quote = ''
  let lineComment = false
  let blockComment = false
  const flush = () => {
    if (!token) return
    const word = token.toUpperCase()
    tokens.push(word)
    if (tokens[0] === 'CREATE' && word === 'TRIGGER') trigger = true
    if (trigger && (word === 'BEGIN' || word === 'CASE')) depth += 1
    if (trigger && word === 'END') depth -= 1
    token = ''
  }
  for (let index = 0; index < sql.length; index += 1) {
    const character = sql[index]
    const next = sql[index + 1]
    if (lineComment) { if (character === '\n') lineComment = false; continue }
    if (blockComment) { if (character === '*' && next === '/') { blockComment = false; index += 1 }; continue }
    if (quote) {
      if (character === quote) {
        if (next === quote && quote !== ']') index += 1
        else quote = ''
      }
      continue
    }
    if (character === '-' && next === '-') { flush(); lineComment = true; index += 1; continue }
    if (character === '/' && next === '*') { flush(); blockComment = true; index += 1; continue }
    if (character === "'" || character === '"' || character === '`' || character === '[') { flush(); quote = character === '[' ? ']' : character; continue }
    if (/[A-Za-z_]/.test(character)) { token += character; continue }
    flush()
    if (character === ';' && (!trigger || depth === 0)) {
      if (tokens.length) result.push(sql.slice(start, index + 1).trim())
      start = index + 1
      tokens = []
      trigger = false
      depth = 0
    }
  }
  flush()
  if (quote || blockComment || depth !== 0) throw new Error('Unterminated SQL statement in migration rehearsal')
  if (tokens.length) result.push(sql.slice(start).trim())
  return result
}
const migration = (name: string) => statements(readFileSync(new URL(`../../../schema/managed-migrations/${name}`, import.meta.url), 'utf8'))

const key = 'handoff-test-key-material-00000000000000000'
const client = 'handoff_client_0001', otherClient = 'handoff_client_0002'
const tokenId = 'handoff_token_current_01'
const secret = 'A'.repeat(43)
const bearer = (value = secret, id = client) => `Bearer rt_svc_${id}.${value}`
const userOneHash = 'handoff-human-hash-0000001', userOneSub = 'authentik-sub-aaaaaa1111'
const userTwoHash = 'handoff-human-hash-0000002', userTwoSub = 'authentik-sub-bbbbbb2222'

async function setup() {
  const mf = new Miniflare({ modules: true, script: 'export default {fetch(){return new Response("ok")}}', d1Databases: { DB: 'timeline-handoff' } })
  const db = await mf.getD1Database('DB')
  try {
    for (const statement of statements(`
    CREATE TABLE users(id INTEGER PRIMARY KEY,username TEXT NOT NULL UNIQUE,email TEXT NOT NULL UNIQUE,full_name TEXT NOT NULL,hashed_password TEXT NOT NULL,user_hash TEXT,account_hash TEXT,oidc_sub TEXT,oidc_provider TEXT,oidc_email TEXT,is_active INTEGER NOT NULL,role TEXT NOT NULL);
    CREATE TABLE workspaces(id TEXT PRIMARY KEY,owner_id INTEGER REFERENCES users(id),type TEXT NOT NULL,is_public INTEGER NOT NULL);
    CREATE TABLE workspace_members(id TEXT PRIMARY KEY,workspace_id TEXT REFERENCES workspaces(id),user_id INTEGER REFERENCES users(id),role TEXT NOT NULL);
    CREATE TABLE investigations(id TEXT PRIMARY KEY,workspace_id TEXT REFERENCES workspaces(id),created_by INTEGER REFERENCES users(id),status TEXT NOT NULL);
    `)) await db.prepare(statement).run()
    await db.prepare("INSERT INTO users VALUES(10,'redeemer-one','redeemer-one@example.test','Redeemer One','disabled',?,NULL,?,'irregulars-io',NULL,1,'researcher')").bind(userOneHash, userOneSub).run()
    await db.prepare("INSERT INTO users VALUES(11,'redeemer-two','redeemer-two@example.test','Redeemer Two','disabled',?,NULL,?,'irregulars-io',NULL,1,'researcher')").bind(userTwoHash, userTwoSub).run()

    for (const name of ['0009_community_service_auth.sql', '0010_service_principal_identity_compat.sql', '0011_timeline_foundation.sql', '0012_timeline_workspace_snapshots.sql']) {
      await db.batch(migration(name).map(s => db.prepare(s)))
    }
    await db.batch(migration('0013_timeline_service_scopes.sql').map(s => db.prepare(s)))
    await db.batch(migration('0014_timeline_presentations.sql').map(s => db.prepare(s)))
    await db.batch(migration('0015_timeline_workspace_intervals.sql').map(s => db.prepare(s)))
    await db.batch(migration('0016_timeline_workspace_circa.sql').map(s => db.prepare(s)))
    await db.batch(migration('0017_timeline_handoffs.sql').map(s => db.prepare(s)))

    for (const [id, n] of [[client, 2], [otherClient, 3]] as const) {
      await db.prepare("INSERT INTO users VALUES(?, ?, ?, 'Service','SERVICE_AUTH_DISABLED',NULL,NULL,NULL,NULL,NULL,1,'service')").bind(n, `service_${id}`, `service+${id}@service.invalid`).run()
      await db.prepare("INSERT INTO workspaces VALUES(?,?,'TEAM',0)").bind(`workspace-${n}`, n).run()
      await db.prepare("INSERT INTO investigations VALUES(?,?,?,'active')").bind(`intake-${n}`, `workspace-${n}`, n).run()
      await db.prepare("INSERT INTO integration_clients(id,community_id,workspace_id,intake_investigation_id,principal_user_id,environment,maximum_visibility,status) VALUES(?,?,?,?,?,'production','private','active')").bind(id, `community-${n}`, `workspace-${n}`, `intake-${n}`, n).run()
    }
    const digest = await deriveIntegrationTokenHash(key, client, secret)
    await db.prepare("INSERT INTO integration_client_tokens(id,client_id,slot,secret_hash,created_at,not_before,expires_at) VALUES(?,?,'current',?,unixepoch()-60,unixepoch()-60,unixepoch()+3600)").bind(tokenId, client, digest).run()
    await db.prepare("INSERT INTO integration_client_token_scopes VALUES(?,'timeline.write')").bind(tokenId).run()
    // A second, equally valid client — used to prove revoke is scoped to the minting client,
    // not just to "any presented rt_svc_ credential".
    const otherTokenId = 'handoff_token_other_client_01'
    const otherDigest = await deriveIntegrationTokenHash(key, otherClient, secret)
    await db.prepare("INSERT INTO integration_client_tokens(id,client_id,slot,secret_hash,created_at,not_before,expires_at) VALUES(?,?,'current',?,unixepoch()-60,unixepoch()-60,unixepoch()+3600)").bind(otherTokenId, otherClient, otherDigest).run()
    await db.prepare("INSERT INTO integration_client_token_scopes VALUES(?,'timeline.write')").bind(otherTokenId).run()
    return { mf, db }
  } catch (e) { await mf.dispose(); throw e }
}

async function scopes(db: D1Database, values: string[], id = tokenId) {
  await db.prepare('DELETE FROM integration_client_token_scopes WHERE token_id=?').bind(id).run()
  for (const scope of values) await db.prepare('INSERT INTO integration_client_token_scopes VALUES(?,?)').bind(id, scope).run()
}

function mintBody(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 'timeline-handoff-request.v1',
    audience: 'researchtools-community.v1',
    kind: 'article',
    title: 'Content update deployed',
    origin: { product: 'irregulars-rss', returnUrl: 'https://rss.irregulars.io/link/abc123', returnLabel: 'IrregularChat Links — story' },
    items: [{ url: 'https://publisher.example/story', title: 'Story title', publisher: 'publisher.example', publishedAt: '2024-07-19' }],
    events: [{ eventDate: '2024-07-19', datePrecision: 'day', title: 'Something happened', description: null, category: 'event', importance: 'normal', sourceUrls: ['https://publisher.example/story'] }],
    ...overrides,
  }
}

async function callMint(db: D1Database, opts: { auth?: string; key?: string; enabled?: string; body?: unknown } = {}) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Idempotency-Key': opts.key ?? 'handoff-mint-request-key-01' }
  if (opts.auth !== undefined) { if (opts.auth !== '') headers.Authorization = opts.auth } else headers.Authorization = bearer()
  const request = new Request('https://example.test/api/timeline-handoffs', { method: 'POST', headers, body: JSON.stringify(opts.body ?? mintBody()) })
  return mint({ request, env: { DB: db, ENVIRONMENT: 'production', INTEGRATION_TOKEN_HASH_KEY: key, COMMUNITY_INTEGRATIONS_ENABLED: opts.enabled ?? 'true' } } as never)
}

async function callRevoke(db: D1Database, tokenValue: string, opts: { auth?: string; enabled?: string } = {}) {
  const headers: Record<string, string> = {}
  if (opts.auth !== undefined) { if (opts.auth !== '') headers.Authorization = opts.auth } else headers.Authorization = bearer()
  const request = new Request(`https://example.test/api/timeline-handoffs/${tokenValue}`, { method: 'DELETE', headers })
  return revoke({ request, env: { DB: db, ENVIRONMENT: 'production', INTEGRATION_TOKEN_HASH_KEY: key, COMMUNITY_INTEGRATIONS_ENABLED: opts.enabled ?? 'true' }, params: { token: tokenValue } } as never)
}

async function callRedeem(db: D1Database, tokenValue: string, opts: { human?: string; guest?: boolean; auth?: string } = {}) {
  const headers: Record<string, string> = {}
  if (opts.guest) headers['X-Guest-Session'] = 'guest-session-token'
  if (opts.auth !== undefined) headers.Authorization = opts.auth
  if (opts.human !== undefined) headers['X-User-Hash'] = opts.human
  const request = new Request(`https://example.test/api/timeline-handoffs/${tokenValue}/redeem`, { method: 'POST', headers })
  return redeem({ request, env: { DB: db, ENVIRONMENT: 'production', INTEGRATION_TOKEN_HASH_KEY: key, COMMUNITY_INTEGRATIONS_ENABLED: 'true' }, params: { token: tokenValue } } as never)
}

async function mintedToken(db: D1Database, opts: Parameters<typeof callMint>[1] = {}): Promise<string> {
  const response = await callMint(db, opts)
  expect(response.status).toBe(201)
  const body = await response.json() as { token: string }
  return body.token
}

test.describe('timeline handoff store: mint, redeem and revoke against real D1 @smoke', () => {
  test('RETURNING inside DB.batch() populates results[] on the redeem UPDATE (open question 4)', async () => {
    const { mf, db } = await setup()
    try {
      await db.prepare(`INSERT INTO timeline_handoffs(token,client_id,minted_by,request_key,audience,audience_subject,origin_return_url,payload_hash,payload,created_at,expires_at)
        VALUES(?,?,?,?,?,?,?,?,?,unixepoch(),unixepoch()+1800)`)
        .bind('b'.repeat(64), client, 2, 'raw-returning-probe', 'researchtools-community.v1', null, 'https://rss.irregulars.io/link/abc123', 'c'.repeat(64), '{"probe":true}')
        .run()
      const results = await db.batch([
        db.prepare('SELECT 1'),
        db.prepare(`UPDATE timeline_handoffs SET redeemed_at=unixepoch(),redeemed_by=? WHERE token=? AND redeemed_at IS NULL RETURNING payload,payload_hash,origin_return_url`).bind(10, 'b'.repeat(64)),
        db.prepare(`UPDATE timeline_handoffs SET payload=NULL WHERE token=? AND redeemed_by=?`).bind('b'.repeat(64), 10),
      ])
      // This is the direct proof: results[1].results is not empty and carries the pre-null payload.
      expect(results[1].results).toHaveLength(1)
      expect((results[1].results[0] as { payload: string }).payload).toBe('{"probe":true}')
      const after = await db.prepare('SELECT payload FROM timeline_handoffs WHERE token=?').bind('b'.repeat(64)).first<{ payload: string | null }>()
      expect(after?.payload).toBeNull()
    } finally { await mf.dispose() }
  })

  test('mint requires an active rt_svc_ credential with timeline.write, and is idempotent on the key', async () => {
    const { mf, db } = await setup()
    try {
      expect((await callMint(db, { auth: '' })).status).toBe(401)
      expect((await callMint(db, { auth: 'Bearer not-a-service-token' })).status).toBe(401)
      await scopes(db, [])
      expect((await callMint(db)).status).toBe(403)
      await scopes(db, ['timeline.write'])
      expect((await callMint(db, { enabled: 'false' })).status).toBe(403)

      const first = await callMint(db, { key: 'handoff-idem-key-0001' })
      expect(first.status).toBe(201)
      const firstBody = await first.json() as { token: string }
      const replay = await callMint(db, { key: 'handoff-idem-key-0001' })
      expect(replay.status).toBe(200)
      expect((await replay.json() as { token: string }).token).toBe(firstBody.token)

      const conflict = await callMint(db, { key: 'handoff-idem-key-0001', body: mintBody({ title: 'A completely different title' }) })
      expect(conflict.status).toBe(409)
      expect((await conflict.json() as { error: { code: string } }).error.code).toBe('idempotency_conflict')
    } finally { await mf.dispose() }
  })

  test('mint stores the canonical redeemed document, truncating beyond bounds and flagging it', async () => {
    const { mf, db } = await setup()
    try {
      const items = Array.from({ length: 137 }, (_, i) => ({ url: `https://publisher.example/story-${i}`, title: `Item ${i}`, publisher: 'publisher.example' }))
      const response = await callMint(db, { key: 'handoff-truncate-01', body: mintBody({ items }) })
      expect(response.status).toBe(201)
      const { token } = await response.json() as { token: string }
      const row = await db.prepare('SELECT payload FROM timeline_handoffs WHERE token=?').bind(token).first<{ payload: string }>()
      const document = JSON.parse(row!.payload)
      expect(document.items).toHaveLength(100)
      expect(document.truncated).toBe(true)
    } finally { await mf.dispose() }
  })

  test('a per-client quota of outstanding handoffs is enforced by both the guarded insert and the trigger', async () => {
    const { mf, db } = await setup()
    try {
      for (let i = 0; i < 200; i += 1) {
        await db.prepare(`INSERT INTO timeline_handoffs(token,client_id,minted_by,request_key,audience,audience_subject,origin_return_url,payload_hash,payload,created_at,expires_at)
          VALUES(?,?,?,?,?,?,?,?,?,unixepoch(),unixepoch()+1800)`)
          .bind(i.toString(16).padStart(64, '0'), client, 2, `quota-seed-${i}`, 'researchtools-community.v1', null, 'https://rss.irregulars.io/link/abc123', 'd'.repeat(64), '{"seed":true}')
          .run()
      }
      const response = await callMint(db, { key: 'handoff-quota-overflow' })
      expect(response.status).toBe(409)
      expect((await response.json() as { error: { code: string } }).error.code).toBe('handoff_quota')
      // The trigger itself independently refuses a raw insert past quota, not just the store's guard.
      await expect(db.prepare(`INSERT INTO timeline_handoffs(token,client_id,minted_by,request_key,audience,audience_subject,origin_return_url,payload_hash,payload,created_at,expires_at)
        VALUES(?,?,?,?,?,?,?,?,?,unixepoch(),unixepoch()+1800)`)
        .bind('f'.repeat(64), client, 2, 'quota-seed-200', 'researchtools-community.v1', null, 'https://rss.irregulars.io/link/abc123', 'd'.repeat(64), '{"seed":true}')
        .run()).rejects.toThrow()
    } finally { await mf.dispose() }
  })

  test('a community-audience token redeems once for any human, and a second redemption never touches the already-cleared payload', async () => {
    const { mf, db } = await setup()
    try {
      const token = await mintedToken(db, { key: 'handoff-single-use-01' })
      const first = await callRedeem(db, token, { human: userOneHash })
      expect(first.status).toBe(200)
      const document = await first.json() as { schemaVersion: string; title: string }
      expect(document.schemaVersion).toBe('timeline-handoff.v1')
      expect(document.title).toBe('Content update deployed')

      const replay = await callRedeem(db, token, { human: userTwoHash })
      expect(replay.status).toBe(409)
      expect((await replay.json() as { error: { code: string } }).error.code).toBe('handoff_already_redeemed')

      const row = await db.prepare('SELECT payload FROM timeline_handoffs WHERE token=?').bind(token).first<{ payload: string | null }>()
      expect(row?.payload).toBeNull()
    } finally { await mf.dispose() }
  })

  test('two concurrent redemptions of the same token: exactly one payload, the other 409', async () => {
    const { mf, db } = await setup()
    try {
      const token = await mintedToken(db, { key: 'handoff-race-key-0001' })
      const [a, b] = await Promise.all([
        callRedeem(db, token, { human: userOneHash }),
        callRedeem(db, token, { human: userTwoHash }),
      ])
      const statuses = [a.status, b.status].sort()
      expect(statuses).toEqual([200, 409])
      const winner = a.status === 200 ? a : b
      const loser = a.status === 200 ? b : a
      expect((await winner.json() as { schemaVersion: string }).schemaVersion).toBe('timeline-handoff.v1')
      expect((await loser.json() as { error: { code: string } }).error.code).toBe('handoff_already_redeemed')
    } finally { await mf.dispose() }
  })

  test('subject-bound audience: only the matching oidc_sub redeems; a mismatch is 403 and never consumes the token', async () => {
    const { mf, db } = await setup()
    try {
      const token = await mintedToken(db, { key: 'handoff-subject-01', body: mintBody({ audience: 'researchtools-oidc-subject.v1', audienceSubject: userTwoSub }) })
      const wrong = await callRedeem(db, token, { human: userOneHash })
      expect(wrong.status).toBe(403)
      expect((await wrong.json() as { error: { code: string } }).error.code).toBe('handoff_audience_denied')
      const stillLive = await db.prepare('SELECT redeemed_at,payload FROM timeline_handoffs WHERE token=?').bind(token).first<{ redeemed_at: number | null; payload: string | null }>()
      expect(stillLive?.redeemed_at).toBeNull()
      expect(stillLive?.payload).not.toBeNull()

      const right = await callRedeem(db, token, { human: userTwoHash })
      expect(right.status).toBe(200)
    } finally { await mf.dispose() }
  })

  test('redeem after expiry is 410 and consumes nothing', async () => {
    const { mf, db } = await setup()
    try {
      // expires_at is immutable once inserted (assigned only by the mint statement, checked by
      // the update guard), so an expired row is built directly rather than mutated after mint.
      const token = 'a'.repeat(64)
      await db.prepare(`INSERT INTO timeline_handoffs(token,client_id,minted_by,request_key,audience,audience_subject,origin_return_url,payload_hash,payload,created_at,expires_at)
        VALUES(?,?,?,?,?,?,?,?,?,unixepoch()-3600,unixepoch()-1800)`)
        .bind(token, client, 2, 'handoff-expiry-seed-0001', 'researchtools-community.v1', null, 'https://rss.irregulars.io/link/abc123', 'd'.repeat(64), '{"schemaVersion":"timeline-handoff.v1"}')
        .run()
      const response = await callRedeem(db, token, { human: userOneHash })
      expect(response.status).toBe(410)
      expect((await response.json() as { error: { code: string } }).error.code).toBe('handoff_expired')
      const row = await db.prepare('SELECT redeemed_at,payload FROM timeline_handoffs WHERE token=?').bind(token).first<{ redeemed_at: number | null; payload: string | null }>()
      expect(row?.redeemed_at).toBeNull()
      expect(row?.payload).not.toBeNull()
    } finally { await mf.dispose() }
  })

  test('redeem rejects a guest, a service credential and an unauthenticated caller, never a workspace read/write path', async () => {
    const { mf, db } = await setup()
    try {
      const token = await mintedToken(db, { key: 'handoff-identity-01' })
      const guest = await callRedeem(db, token, { guest: true })
      expect(guest.status).toBe(403)
      const service = await callRedeem(db, token, { auth: bearer() })
      expect(service.status).toBe(403)
      const anonymous = await callRedeem(db, token, {})
      expect(anonymous.status).toBe(401)
      // None of the rejected attempts touched the row.
      const row = await db.prepare('SELECT redeemed_at FROM timeline_handoffs WHERE token=?').bind(token).first<{ redeemed_at: number | null }>()
      expect(row?.redeemed_at).toBeNull()
    } finally { await mf.dispose() }
  })

  test('revoke requires the minting client and stops redemption with 403; revoking twice is 404 the second time', async () => {
    const { mf, db } = await setup()
    try {
      const token = await mintedToken(db, { key: 'handoff-revoke-01' })
      const wrongClient = await callRevoke(db, token, { auth: bearer(secret, otherClient) })
      expect(wrongClient.status).toBe(404)
      const revoked = await callRevoke(db, token)
      expect(revoked.status).toBe(204)
      const again = await callRevoke(db, token)
      expect(again.status).toBe(404)

      const afterRevoke = await callRedeem(db, token, { human: userOneHash })
      expect(afterRevoke.status).toBe(403)
      expect((await afterRevoke.json() as { error: { code: string } }).error.code).toBe('handoff_revoked')
      const row = await db.prepare('SELECT redeemed_at FROM timeline_handoffs WHERE token=?').bind(token).first<{ redeemed_at: number | null }>()
      expect(row?.redeemed_at).toBeNull()
    } finally { await mf.dispose() }
  })

  test('a tampered or unknown token is 404, identically for redeem and revoke, before any query executes', async () => {
    const { mf, db } = await setup()
    try {
      for (const bad of ['not-hex-at-all', 'A'.repeat(64), 'a'.repeat(63)]) {
        const redeemed = await callRedeem(db, bad, { human: userOneHash })
        expect(redeemed.status).toBe(404)
        expect((await redeemed.json() as { error: { code: string } }).error.code).toBe('handoff_not_found')
      }
      const neverMinted = 'e'.repeat(64)
      expect((await callRedeem(db, neverMinted, { human: userOneHash })).status).toBe(404)
      expect((await callRevoke(db, neverMinted)).status).toBe(404)
    } finally { await mf.dispose() }
  })
})
