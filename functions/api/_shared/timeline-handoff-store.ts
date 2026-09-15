import { requireTimelineHuman, type TimelineArtifactEnv } from './timeline-artifact-auth'
import { getIntegrationPrincipalFromRequest, IntegrationAuthError, type IntegrationAuthEnv } from './service-auth'
import { boundedBody, canonicalJson, hashContent, idempotencyKey } from './timeline-artifact-contract'
import {
  HANDOFF_LIMITS, HandoffError, buildHandoffDocument, handoffResponse, handoffToken, validHandoffDocument, validHandoffMintRequest,
  type HandoffDocument,
} from './timeline-handoff-contract'

export type TimelineHandoffEnv = TimelineArtifactEnv & IntegrationAuthEnv

// Match JavaScript String.trim in requireTimelineHuman, including tab/Unicode whitespace.
const human = `u.is_active=1 AND length(trim(u.role,char(9,10,11,12,13,32,160,5760,8192,8193,8194,8195,8196,8197,8198,8199,8200,8201,8202,8232,8233,8239,8287,12288,65279)))>0 AND lower(trim(u.role,char(9,10,11,12,13,32,160,5760,8192,8193,8194,8195,8196,8197,8198,8199,8200,8201,8202,8232,8233,8239,8287,12288,65279))) NOT IN ('guest','service')`
function liveHumanAssertion(env: TimelineHandoffEnv, userId: number) {
  return env.DB.prepare(`SELECT json(CASE WHEN EXISTS(SELECT 1 FROM users u WHERE u.id=? AND ${human}) THEN 'null' ELSE '' END)`).bind(userId)
}

interface StoredHandoffRow {
  token: string
  payload: string | null
  payload_hash: string
  created_at: number
  expires_at: number
  audience: string
  audience_subject: string | null
  origin_return_url: string
}

/** Validates the round trip like `saved()` in timeline-presentation-store.ts: only
 * canonical accepted bytes, whose hash matches the stored digest, are ever replayed. */
async function decodeStoredPayload(payload: string | null, payloadHash: string): Promise<HandoffDocument> {
  if (payload === null) throw new HandoffError('datastore_unavailable', 503)
  let decoded: unknown
  try { decoded = JSON.parse(payload) } catch { throw new HandoffError('datastore_unavailable', 503) }
  if (!validHandoffDocument(decoded)) throw new HandoffError('datastore_unavailable', 503)
  if (canonicalJson(decoded) !== payload) throw new HandoffError('datastore_unavailable', 503)
  if (await hashContent(decoded) !== payloadHash) throw new HandoffError('datastore_unavailable', 503)
  return decoded
}

async function requireServicePrincipal(request: Request, env: TimelineHandoffEnv): Promise<{ clientId: string; userId: number }> {
  if (env.COMMUNITY_INTEGRATIONS_ENABLED !== 'true') throw new HandoffError('access_denied', 403)
  let service
  try {
    service = await getIntegrationPrincipalFromRequest(request, env)
  } catch (error) {
    if (error instanceof IntegrationAuthError) {
      throw new HandoffError(error.status === 401 ? 'authentication_required' : error.status === 503 ? 'datastore_unavailable' : 'access_denied', error.status)
    }
    throw new HandoffError('datastore_unavailable', 503)
  }
  if (!service) throw new HandoffError('authentication_required', 401)
  if (!service.scopes.includes('timeline.write')) throw new HandoffError('access_denied', 403)
  return { clientId: service.clientId, userId: service.principalUserId }
}

function mintLink(row: { token: string; created_at: number; expires_at: number }) {
  return {
    schemaVersion: 'timeline-handoff-link.v1' as const,
    token: row.token,
    createdAt: new Date(row.created_at * 1000).toISOString(),
    expiresAt: new Date(row.expires_at * 1000).toISOString(),
  }
}

export async function mintTimelineHandoff(request: Request, env: TimelineHandoffEnv): Promise<Response> {
  const { clientId, userId } = await requireServicePrincipal(request, env)
  const key = idempotencyKey(request)
  const body = await boundedBody(request)
  if (!validHandoffMintRequest(body)) throw new HandoffError('invalid_request', 400)
  const mintedAt = new Date().toISOString()
  const document = buildHandoffDocument(body, mintedAt)
  const payload = canonicalJson(document)
  const payloadHash = await hashContent(document)
  const issued = Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('')
  let results: D1Result<StoredHandoffRow>[]
  try {
    results = await env.DB.batch<StoredHandoffRow>([
      env.DB.prepare(`INSERT INTO timeline_handoffs(token,client_id,minted_by,request_key,audience,audience_subject,origin_return_url,payload_hash,payload,created_at,expires_at)
        SELECT ?,?,?,?,?,?,?,?,?,unixepoch(),unixepoch()+?
        WHERE NOT EXISTS(SELECT 1 FROM timeline_handoffs WHERE client_id=? AND request_key=?)
          AND (SELECT count(*) FROM timeline_handoffs WHERE client_id=? AND redeemed_at IS NULL AND revoked_at IS NULL AND expires_at>unixepoch())<?`)
        .bind(issued, clientId, userId, key, body.audience, body.audienceSubject ?? null, body.origin.returnUrl, payloadHash, payload, HANDOFF_LIMITS.ttlSeconds, clientId, key, clientId, HANDOFF_LIMITS.clientQuota),
      env.DB.prepare(`SELECT token,payload,payload_hash,created_at,expires_at,audience,audience_subject,origin_return_url FROM timeline_handoffs WHERE client_id=? AND request_key=?`).bind(clientId, key),
    ])
  } catch {
    throw new HandoffError('datastore_unavailable', 503)
  }
  const row = results[1].results[0]
  if (!row) throw new HandoffError('handoff_quota', 409)
  // Round-trip the replayed row through the same strict codec before ever trusting it again.
  const stored = await decodeStoredPayload(row.payload, row.payload_hash)
  // A replay is stamped with a fresh mintedAt, so hashing THIS request's document could
  // never match the stored one and every idempotent retry answered 409. Compare against
  // the document this request would have produced at the stored mint time instead, so
  // only a genuinely different body is a conflict.
  const expected = row.token === issued ? payloadHash : await hashContent(buildHandoffDocument(body, stored.mintedAt))
  if (row.payload_hash !== expected) throw new HandoffError('idempotency_conflict', 409)
  return handoffResponse(mintLink(row), row.token === issued ? 201 : 200)
}

export async function revokeTimelineHandoff(request: Request, env: TimelineHandoffEnv, tokenValue: unknown): Promise<Response> {
  const id = handoffToken(tokenValue)
  const { clientId } = await requireServicePrincipal(request, env)
  let rows: { token: string }[]
  try {
    const results = await env.DB.batch<{ token: string }>([
      // RETURNING reports what this statement actually changed, so an already-revoked
      // token answers 404 like an unknown one. The previous SELECT had no revoked_at
      // filter, so it still found the row and a second revoke wrongly answered 204.
      // Collapsing both cases also avoids confirming a token's existence to a caller
      // that does not own it.
      env.DB.prepare(`UPDATE timeline_handoffs SET payload=NULL,revoked_at=unixepoch()
        WHERE token=? AND client_id=? AND revoked_at IS NULL
        RETURNING token`).bind(id, clientId),
    ])
    rows = results[0].results
  } catch { throw new HandoffError('datastore_unavailable', 503) }
  if (!rows.length) throw new HandoffError('handoff_not_found', 404)
  // handoffResponse() serialises its body, and a 204 may not carry one — constructing
  // it throws, which handoffRoute then reports as datastore_unavailable, so revoke
  // could never succeed. Harvest the standard header set from a status that may.
  const headers = new Headers(handoffResponse(null, 200).headers)
  headers.delete('Content-Type')
  return new Response(null, { status: 204, headers })
}

interface RedeemedRow { payload: string | null; payload_hash: string; origin_return_url: string }
interface RedeemStatusRow { redeemed_at: number | null; redeemed_by: number | null; revoked_at: number | null; expires_at: number; origin_return_url: string; now: number }

function handoffErrorResponse(code: 'handoff_not_found' | 'handoff_revoked' | 'handoff_already_redeemed' | 'handoff_expired' | 'handoff_audience_denied', status: number, originReturnUrl?: string): Response {
  return handoffResponse({ schemaVersion: 'timeline-handoff-error.v1', error: { code }, ...(originReturnUrl !== undefined ? { originReturnUrl } : {}) }, status)
}

export async function redeemTimelineHandoff(request: Request, env: TimelineHandoffEnv, tokenValue: unknown): Promise<Response> {
  const id = handoffToken(tokenValue)
  const principal = await requireTimelineHuman(request, env)
  let claimed: RedeemedRow[]
  let status: RedeemStatusRow[]
  try {
    const results = await env.DB.batch<RedeemedRow & RedeemStatusRow>([
      liveHumanAssertion(env, principal.userId),
      env.DB.prepare(`UPDATE timeline_handoffs SET redeemed_at=unixepoch(),redeemed_by=?
        WHERE token=? AND redeemed_at IS NULL AND revoked_at IS NULL AND expires_at>unixepoch()
          AND (audience='researchtools-community.v1' OR EXISTS (SELECT 1 FROM users u WHERE u.id=? AND u.oidc_sub=audience_subject))
        RETURNING payload,payload_hash,origin_return_url`).bind(principal.userId, id, principal.userId),
      env.DB.prepare(`UPDATE timeline_handoffs SET payload=NULL WHERE token=? AND redeemed_by=?`).bind(id, principal.userId),
      env.DB.prepare(`SELECT redeemed_at,redeemed_by,revoked_at,expires_at,origin_return_url,unixepoch() AS now FROM timeline_handoffs WHERE token=?`).bind(id),
    ])
    claimed = results[1].results
    status = results[3].results
  } catch {
    // Re-authorize independently of the failed batch, matching the presentation store's
    // race-defense idiom, before reporting a generic datastore failure.
    if (!await env.DB.prepare(`SELECT 1 FROM users u WHERE u.id=? AND ${human}`).bind(principal.userId).first()) {
      throw new HandoffError('human_identity_required', 403)
    }
    throw new HandoffError('datastore_unavailable', 503)
  }
  const claim = claimed[0]
  if (claim) {
    const document = await decodeStoredPayload(claim.payload, claim.payload_hash)
    return handoffResponse(document)
  }
  const row = status[0]
  if (!row) throw new HandoffError('handoff_not_found', 404)
  if (row.revoked_at !== null) return handoffErrorResponse('handoff_revoked', 403, row.origin_return_url)
  if (row.redeemed_at !== null) return handoffErrorResponse('handoff_already_redeemed', 409, row.origin_return_url)
  if (row.expires_at <= row.now) return handoffErrorResponse('handoff_expired', 410, row.origin_return_url)
  return handoffErrorResponse('handoff_audience_denied', 403, row.origin_return_url)
}
