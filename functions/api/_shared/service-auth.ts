import {
  isIntegrationScope,
  parseIntegrationScopes,
  type IntegrationErrorCode,
  type IntegrationScope,
  type IntegrationVisibility,
  type ServiceIntegrationPrincipal,
} from './integration-contract'

export const INTEGRATION_TOKEN_AUDIENCE = 'researchtools-community-api.v1' as const
export const INTEGRATION_TOKEN_HASH_VERSION = 'hmac-sha256.v1' as const
export const SERVICE_TOKEN_PATTERN = /^rt_svc_([a-z0-9][a-z0-9_-]{15,63})\.([A-Za-z0-9_-]{43})$/
export const MAX_INTEGRATION_AUTHORIZATION_LENGTH = 7 + 7 + 64 + 1 + 43

const HEX_DIGEST_PATTERN = /^[a-f0-9]{64}$/
const OPAQUE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/
const DUMMY_DIGEST = '0'.repeat(64)

export interface IntegrationAuthEnv {
  DB?: D1Database
  ENVIRONMENT?: string
  INTEGRATION_TOKEN_HASH_KEY?: string
}

export class IntegrationAuthError extends Error {
  constructor(
    readonly code: Extract<
      IntegrationErrorCode,
      'authentication_required' | 'invalid_service_token' | 'expired_service_token' |
      'workspace_denied' | 'auth_datastore_unavailable'
    >,
    readonly status: 401 | 403 | 503,
    readonly retryable: boolean,
    message: string,
  ) {
    super(message)
    this.name = 'IntegrationAuthError'
  }
}

interface PresentedServiceToken {
  clientId: string
  secret: string
}

interface IntegrationAuthRow {
  client_id: string
  community_id: string
  workspace_id: string
  intake_investigation_id: string
  principal_user_id: number
  client_environment: string
  audience: string
  maximum_visibility: string
  client_status: string
  token_id: string | null
  token_slot: string | null
  secret_hash: string | null
  hash_version: string | null
  token_created_at: number | null
  not_before: number | null
  expires_at: number | null
  revoked_at: number | null
  token_scope: string | null
  principal_row_id: number | null
  principal_role: string | null
  principal_active: number | null
  principal_user_hash: string | null
  principal_account_hash: string | null
  principal_email: string | null
  principal_oidc_sub: string | null
  principal_password: string | null
  bound_workspace_id: string | null
  workspace_owner_id: number | null
  workspace_type: string | null
  workspace_is_public: number | null
  bound_investigation_id: string | null
  investigation_workspace_id: string | null
  investigation_created_by: number | null
  investigation_status: string | null
  principal_memberships: number
}

interface TokenCandidate {
  id: string
  slot: 'current' | 'next'
  secretHash: string
  hashVersion: string
  createdAt: number
  notBefore: number
  expiresAt: number
  revokedAt: number | null
  scopes: unknown[]
}

/** Detect the reserved service namespace without normalizing the credential. */
export function isReservedIntegrationAuthorization(request: Request): boolean {
  const header = request.headers.get('Authorization')
  if (!header) return false
  const scheme = /^\s*Bearer(?=\s)/iu.exec(header)
  return Boolean(scheme && /^\s*rt_svc_/iu.test(header.slice(scheme[0].length)))
}

function readPresentedServiceToken(request: Request): PresentedServiceToken | null {
  const header = request.headers.get('Authorization')
  if (header === null) return null

  if (header.length > MAX_INTEGRATION_AUTHORIZATION_LENGTH) {
    throw invalidToken()
  }

  const bearer = /^Bearer ([^\s]+)$/i.exec(header)
  if (!bearer) {
    if (isReservedIntegrationAuthorization(request)) throw invalidToken()
    throw new IntegrationAuthError(
      'authentication_required',
      401,
      false,
      'A ResearchTools service credential is required.',
    )
  }

  const token = bearer[1]
  if (!token.startsWith('rt_svc_')) {
    if (isReservedIntegrationAuthorization(request)) throw invalidToken()
    throw new IntegrationAuthError(
      'authentication_required',
      401,
      false,
      'A ResearchTools service credential is required.',
    )
  }

  const parsed = SERVICE_TOKEN_PATTERN.exec(token)
  if (!parsed) throw invalidToken()
  return { clientId: parsed[1], secret: parsed[2] }
}

function invalidToken(): IntegrationAuthError {
  return new IntegrationAuthError(
    'invalid_service_token',
    401,
    false,
    'The service credential is invalid or inactive.',
  )
}

function authStoreUnavailable(): IntegrationAuthError {
  return new IntegrationAuthError(
    'auth_datastore_unavailable',
    503,
    true,
    'Service authentication is temporarily unavailable.',
  )
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), byte => byte.toString(16).padStart(2, '0')).join('')
}

export async function deriveIntegrationTokenHash(
  key: string,
  clientId: string,
  secret: string,
): Promise<string> {
  if (key.length < 32 || !SERVICE_TOKEN_PATTERN.test(`rt_svc_${clientId}.${secret}`)) {
    throw new Error('Invalid integration token hashing input')
  }
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const message = new TextEncoder().encode(`rt-service-token.v1\0${clientId}\0${secret}`)
  return toHex(await crypto.subtle.sign('HMAC', cryptoKey, message))
}

function constantTimeDigestEqual(actual: string, expected: string): boolean {
  let difference = expected.length ^ 64
  for (let index = 0; index < 64; index += 1) {
    difference |= actual.charCodeAt(index) ^ (expected.charCodeAt(index) || 0)
  }
  return difference === 0
}

function asEpoch(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null
}

function asEnvironment(value: string | undefined): ServiceIntegrationPrincipal['environment'] | null {
  return value === 'development' || value === 'staging' || value === 'production' ? value : null
}

function asVisibility(value: string): IntegrationVisibility | null {
  return value === 'private' || value === 'community' || value === 'public' ? value : null
}

function rowsToTokenCandidates(rows: IntegrationAuthRow[]): TokenCandidate[] {
  const tokens = new Map<string, TokenCandidate>()
  for (const row of rows) {
    if (row.token_id === null) continue
    if (row.token_slot !== 'current' && row.token_slot !== 'next') throw authStoreUnavailable()
    if (!OPAQUE_ID_PATTERN.test(row.token_id) || row.token_id.length < 22 || row.token_id.length > 64) {
      throw authStoreUnavailable()
    }
    const createdAt = asEpoch(row.token_created_at)
    const notBefore = asEpoch(row.not_before)
    const expiresAt = asEpoch(row.expires_at)
    if (
      !HEX_DIGEST_PATTERN.test(row.secret_hash ?? '') ||
      row.hash_version !== INTEGRATION_TOKEN_HASH_VERSION ||
      createdAt === null || notBefore === null || expiresAt === null
    ) throw authStoreUnavailable()

    const existing = tokens.get(row.token_id)
    if (existing) {
      if (existing.slot !== row.token_slot || existing.secretHash !== row.secret_hash) {
        throw authStoreUnavailable()
      }
      if (row.token_scope !== null) existing.scopes.push(row.token_scope)
      continue
    }
    const revokedAt = row.revoked_at === null ? null : asEpoch(row.revoked_at)
    if (row.revoked_at !== null && revokedAt === null) throw authStoreUnavailable()
    tokens.set(row.token_id, {
      id: row.token_id,
      slot: row.token_slot,
      secretHash: row.secret_hash as string,
      hashVersion: row.hash_version,
      createdAt,
      notBefore,
      expiresAt,
      revokedAt,
      scopes: row.token_scope === null ? [] : [row.token_scope],
    })
  }

  const candidates = [...tokens.values()]
  if (candidates.length > 2 || new Set(candidates.map(token => token.slot)).size !== candidates.length) {
    throw authStoreUnavailable()
  }
  return candidates
}

function validateBinding(row: IntegrationAuthRow): IntegrationVisibility {
  const visibility = asVisibility(row.maximum_visibility)
  const validOpaqueIds = [row.client_id, row.community_id, row.workspace_id, row.intake_investigation_id]
    .every(value => OPAQUE_ID_PATTERN.test(value))
  if (
    !validOpaqueIds || row.workspace_id === '1' || !visibility ||
    row.principal_row_id !== row.principal_user_id || row.principal_role !== 'service' ||
    Number(row.principal_active) !== 1 || row.principal_user_hash !== null ||
    row.principal_account_hash !== null || row.principal_email !== null ||
    row.principal_oidc_sub !== null || row.principal_password !== 'SERVICE_AUTH_DISABLED' ||
    row.bound_workspace_id !== row.workspace_id || row.workspace_owner_id !== row.principal_user_id ||
    row.workspace_type !== 'TEAM' || Number(row.workspace_is_public) !== 0 ||
    row.bound_investigation_id !== row.intake_investigation_id ||
    row.investigation_workspace_id !== row.workspace_id ||
    row.investigation_created_by !== row.principal_user_id ||
    row.investigation_status !== 'active' || Number(row.principal_memberships) !== 0
  ) throw authStoreUnavailable()
  return visibility
}

export async function getIntegrationPrincipalFromRequest(
  request: Request,
  env: IntegrationAuthEnv,
  options: { nowEpochSeconds?: number } = {},
): Promise<ServiceIntegrationPrincipal | null> {
  const presented = readPresentedServiceToken(request)
  if (!presented) return null

  const environment = asEnvironment(env.ENVIRONMENT)
  const hashKey = env.INTEGRATION_TOKEN_HASH_KEY
  if (!env.DB || !environment || !hashKey || hashKey.length < 32) throw authStoreUnavailable()

  let rows: IntegrationAuthRow[]
  try {
    const result = await env.DB.prepare(`
      SELECT
        c.id AS client_id,
        c.community_id,
        c.workspace_id,
        c.intake_investigation_id,
        c.principal_user_id,
        c.environment AS client_environment,
        c.audience,
        c.maximum_visibility,
        c.status AS client_status,
        t.id AS token_id,
        t.slot AS token_slot,
        t.secret_hash,
        t.hash_version,
        t.created_at AS token_created_at,
        t.not_before,
        t.expires_at,
        t.revoked_at,
        ts.scope AS token_scope,
        u.id AS principal_row_id,
        u.role AS principal_role,
        u.is_active AS principal_active,
        u.user_hash AS principal_user_hash,
        u.account_hash AS principal_account_hash,
        u.email AS principal_email,
        u.oidc_sub AS principal_oidc_sub,
        u.hashed_password AS principal_password,
        w.id AS bound_workspace_id,
        w.owner_id AS workspace_owner_id,
        w.type AS workspace_type,
        w.is_public AS workspace_is_public,
        i.id AS bound_investigation_id,
        i.workspace_id AS investigation_workspace_id,
        i.created_by AS investigation_created_by,
        i.status AS investigation_status,
        (SELECT COUNT(*) FROM workspace_members wm WHERE wm.user_id = c.principal_user_id) AS principal_memberships
      FROM integration_clients c
      LEFT JOIN integration_client_tokens t ON t.client_id = c.id
      LEFT JOIN integration_client_token_scopes ts ON ts.token_id = t.id
      LEFT JOIN users u ON u.id = c.principal_user_id
      LEFT JOIN workspaces w ON w.id = c.workspace_id
      LEFT JOIN investigations i ON i.id = c.intake_investigation_id
      WHERE c.id = ?
      ORDER BY t.slot, ts.scope
    `).bind(presented.clientId).all<IntegrationAuthRow>()
    if (result.success !== true || !Array.isArray(result.results)) throw authStoreUnavailable()
    rows = result.results
  } catch {
    throw authStoreUnavailable()
  }

  const digest = await deriveIntegrationTokenHash(hashKey, presented.clientId, presented.secret)
  if (rows.length === 0) {
    constantTimeDigestEqual(digest, DUMMY_DIGEST)
    constantTimeDigestEqual(digest, DUMMY_DIGEST)
    throw invalidToken()
  }

  const candidates = rowsToTokenCandidates(rows)
  const bySlot = new Map(candidates.map(candidate => [candidate.slot, candidate]))
  const current = bySlot.get('current')
  const next = bySlot.get('next')
  const currentMatches = constantTimeDigestEqual(digest, current?.secretHash ?? DUMMY_DIGEST)
  const nextMatches = constantTimeDigestEqual(digest, next?.secretHash ?? DUMMY_DIGEST)
  if (currentMatches === nextMatches) throw invalidToken()
  const matched = currentMatches ? current : next
  if (!matched) throw invalidToken()

  const root = rows[0]
  if (root.client_status !== 'active') throw invalidToken()
  if (root.audience !== INTEGRATION_TOKEN_AUDIENCE || root.client_environment !== environment) {
    throw invalidToken()
  }
  const now = options.nowEpochSeconds ?? Math.floor(Date.now() / 1000)
  if (!Number.isSafeInteger(now) || now < 0 || matched.createdAt > now || matched.notBefore > now) {
    throw invalidToken()
  }
  if (matched.revokedAt !== null) throw invalidToken()
  if (matched.expiresAt <= now) {
    throw new IntegrationAuthError(
      'expired_service_token',
      401,
      false,
      'The service credential has expired.',
    )
  }

  const scopes = parseIntegrationScopes(matched.scopes)
  if (!scopes || matched.scopes.some(scope => !isIntegrationScope(scope))) throw authStoreUnavailable()
  const maximumVisibility = validateBinding(root)

  const requestedWorkspace = request.headers.get('X-Workspace-ID')
  if (requestedWorkspace !== null && requestedWorkspace !== root.workspace_id) {
    throw new IntegrationAuthError(
      'workspace_denied',
      403,
      false,
      'The requested workspace is not available to this credential.',
    )
  }

  try {
    await env.DB.prepare(`
      UPDATE integration_client_tokens
      SET last_used_at = ?
      WHERE id = ? AND (last_used_at IS NULL OR last_used_at < ?)
    `).bind(now, matched.id, now - 300).run()
  } catch {
    // Usage telemetry is deliberately non-authoritative for authentication.
  }

  return {
    identityType: 'service',
    clientId: root.client_id,
    tokenId: matched.id,
    principalUserId: Number(root.principal_user_id),
    communityId: root.community_id,
    workspaceId: root.workspace_id,
    investigationId: root.intake_investigation_id,
    environment,
    maximumVisibility,
    scopes: scopes as IntegrationScope[],
  }
}
