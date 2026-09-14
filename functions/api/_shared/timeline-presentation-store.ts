import { decodeTimelinePresentation, presentationPlainText, TIMELINE_PRESENTATION_MAX_BYTES } from '../../../src/lib/timeline-presentation-contract'
import { requireTimelineHuman, type TimelineArtifactEnv } from './timeline-artifact-auth'
import { ArtifactError } from './timeline-artifact-contract'

export type TimelinePresentationEnv = TimelineArtifactEnv
class PresentationError extends Error {
  constructor(readonly code: string, readonly status: number) { super(code) }
}
const headers = {
  'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex,nofollow',
  'X-Content-Type-Options': 'nosniff', 'Content-Type': 'application/json; charset=utf-8',
}
function response(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers })
}
function error(code: string, status: number): never { throw new PresentationError(code, status) }
/** No exception, token or payload is logged or returned. No cross-origin grants. */
export async function presentationRoute(action: () => Promise<Response>): Promise<Response> {
  try { return await action() } catch (failure) {
    if (failure instanceof PresentationError || failure instanceof ArtifactError) return response({ schemaVersion: 'timeline-presentation-error.v1', error: { code: failure.code } }, failure.status)
    return response({ schemaVersion: 'timeline-presentation-error.v1', error: { code: 'datastore_unavailable' } }, 503)
  }
}
// Match JavaScript String.trim in requireTimelineHuman, including tab/Unicode whitespace.
const human = `u.is_active=1 AND length(trim(u.role,char(9,10,11,12,13,32,160,5760,8192,8193,8194,8195,8196,8197,8198,8199,8200,8201,8202,8232,8233,8239,8287,12288,65279)))>0 AND lower(trim(u.role,char(9,10,11,12,13,32,160,5760,8192,8193,8194,8195,8196,8197,8198,8199,8200,8201,8202,8232,8233,8239,8287,12288,65279))) NOT IN ('guest','service')`
function assertion(env: TimelinePresentationEnv, userId: number) {
  return env.DB.prepare(`SELECT json(CASE WHEN EXISTS(SELECT 1 FROM users u WHERE u.id=? AND ${human}) THEN 'null' ELSE '' END)`).bind(userId)
}
async function reauthorize(env: TimelinePresentationEnv, userId: number) {
  if (!await env.DB.prepare(`SELECT 1 FROM users u WHERE u.id=? AND ${human}`).bind(userId).first()) error('human_identity_required', 403)
}
function query(request: Request) {
  if (new URL(request.url).search !== '') error('invalid_request', 400)
}
function token(value: unknown): string {
  if (typeof value !== 'string' || !/^[0-9a-f]{64}$/.test(value)) error('unavailable', 404)
  return value
}
async function hash(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}
function randomToken(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('')
}
function iso(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value
}
interface Stored { token: string; payload_hash: string; payload: string | null; created_at: string; revoked_at: string | null }
const columns = `p.token,p.payload_hash,CASE WHEN length(CAST(p.payload AS BLOB))<=524288 THEN p.payload ELSE NULL END AS payload,p.created_at,p.revoked_at`
async function saved(row: Stored) {
  if (!/^[0-9a-f]{64}$/.test(row.token) || !iso(row.created_at) || row.revoked_at !== null || typeof row.payload !== 'string' || !/^[0-9a-f]{64}$/.test(row.payload_hash) || await hash(row.payload) !== row.payload_hash) throw new Error('Invalid stored presentation')
  const value = decodeTimelinePresentation(JSON.parse(row.payload))
  // Only canonical accepted bytes are stored and replayed.
  if (JSON.stringify(value) !== row.payload) throw new Error('Invalid stored presentation')
  return value
}
async function body(request: Request) {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type') || '')) error('invalid_request', 400)
  const length = request.headers.get('Content-Length')
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > TIMELINE_PRESENTATION_MAX_BYTES)) error('payload_too_large', 413)
  if (!request.body) error('invalid_request', 400)
  const reader = request.body.getReader()
  const parts: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const next = await reader.read()
      if (next.done) break
      size += next.value.byteLength
      if (size > TIMELINE_PRESENTATION_MAX_BYTES) { await reader.cancel(); error('payload_too_large', 413) }
      parts.push(next.value)
    }
  } finally { reader.releaseLock() }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const part of parts) { bytes.set(part, offset); offset += part.byteLength }
  try {
    return decodeTimelinePresentation(JSON.parse(new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes)))
  } catch { error('invalid_request', 400) }
}
function link(row: Stored) {
  if (!/^[0-9a-f]{64}$/.test(row.token) || !iso(row.created_at) || row.revoked_at !== null) error('datastore_unavailable', 503)
  return { schemaVersion: 'timeline-presentation-link.v1', token: row.token, createdAt: row.created_at, revoked: false }
}
export async function createTimelinePresentation(request: Request, env: TimelinePresentationEnv): Promise<Response> {
  query(request)
  const principal = await requireTimelineHuman(request, env)
  const key = request.headers.get('Idempotency-Key')
  if (!key || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key)) error('invalid_request', 400)
  const payload = JSON.stringify(await body(request)), digest = await hash(payload)
  const issued = randomToken(), createdAt = new Date().toISOString()
  // D1 batch is one transaction: authorization, quota and key checks cannot race.
  let results: D1Result<Stored>[]
  try {
    results = await env.DB.batch<Stored>([
      assertion(env, principal.userId),
      env.DB.prepare(`INSERT INTO timeline_presentations(token,owner_id,request_key,payload_hash,payload,created_at)
        SELECT ?,u.id,?,?,?,? FROM users u WHERE u.id=? AND ${human}
        AND NOT EXISTS(SELECT 1 FROM timeline_presentations WHERE owner_id=u.id AND request_key=?)
        AND (SELECT count(*) FROM timeline_presentations WHERE owner_id=u.id AND revoked_at IS NULL)<20`)
        .bind(issued, key, digest, payload, createdAt, principal.userId, key),
      env.DB.prepare(`SELECT ${columns} FROM timeline_presentations p JOIN users u ON u.id=p.owner_id WHERE p.owner_id=? AND p.request_key=? AND ${human}`).bind(principal.userId, key),
    ])
  } catch {
    await reauthorize(env, principal.userId)
    error('datastore_unavailable', 503)
  }
  const row = results[2].results[0]
  if (!row) error('active_link_limit', 409)
  if (row.revoked_at !== null || row.payload_hash !== digest) error('idempotency_conflict', 409)
  await saved(row)
  return response(link(row), row.token === issued ? 201 : 200)
}
export async function listTimelinePresentations(request: Request, env: TimelinePresentationEnv): Promise<Response> {
  query(request)
  const principal = await requireTimelineHuman(request, env)
  let rows: Stored[]
  try {
    const results = await env.DB.batch<Stored>([
      assertion(env, principal.userId),
      env.DB.prepare(`SELECT ${columns} FROM timeline_presentations p JOIN users u ON u.id=p.owner_id WHERE p.owner_id=? AND p.revoked_at IS NULL AND ${human} ORDER BY p.created_at DESC,p.token ASC LIMIT 20`).bind(principal.userId),
    ])
    rows = results[1].results
  } catch { await reauthorize(env, principal.userId); error('datastore_unavailable', 503) }
  const links = []
  for (const row of rows) {
    const value = await saved(row)
    const title = Array.from(presentationPlainText(value.timeline.title.text.headline))
    links.push({ token: row.token, createdAt: row.created_at, title: title.length > 200 ? title.slice(0, 199).join('') + '…' : title.join('') })
  }
  return response({ schemaVersion: 'timeline-presentation-links.v1', links })
}
export async function readTimelinePresentation(request: Request, env: TimelinePresentationEnv, value: unknown): Promise<Response> {
  const id = token(value)
  if (new URL(request.url).search !== '') error('unavailable', 404)
  const row = await env.DB.prepare(`SELECT ${columns} FROM timeline_presentations p JOIN users u ON u.id=p.owner_id WHERE p.token=? AND p.revoked_at IS NULL AND ${human}`).bind(id).first<Stored>()
  if (!row) error('unavailable', 404)
  try { return response(await saved(row)) } catch { error('unavailable', 404) }
}
export async function revokeTimelinePresentation(request: Request, env: TimelinePresentationEnv, value: unknown): Promise<Response> {
  const id = token(value)
  query(request)
  const principal = await requireTimelineHuman(request, env)
  let rows: Stored[]
  try {
    const results = await env.DB.batch<Stored>([
      assertion(env, principal.userId),
      env.DB.prepare(`UPDATE timeline_presentations SET payload=NULL,revoked_at=? WHERE token=? AND owner_id=? AND revoked_at IS NULL AND EXISTS(SELECT 1 FROM users u WHERE u.id=owner_id AND ${human})`).bind(new Date().toISOString(), id, principal.userId),
      env.DB.prepare(`SELECT p.token FROM timeline_presentations p JOIN users u ON u.id=p.owner_id WHERE p.token=? AND p.owner_id=? AND ${human}`).bind(id, principal.userId),
    ])
    rows = results[2].results
  } catch { await reauthorize(env, principal.userId); error('datastore_unavailable', 503) }
  if (!rows.length) error('unavailable', 404)
  const emptyHeaders = { ...headers } as Record<string, string>
  delete emptyHeaders['Content-Type']
  return new Response(null, { status: 204, headers: emptyHeaders })
}
