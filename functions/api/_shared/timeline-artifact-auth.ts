import { verifyToken } from '../../utils/jwt'
import { getIntegrationPrincipalFromRequest, deriveIntegrationTokenHash, SERVICE_TOKEN_PATTERN, IntegrationAuthError, isReservedIntegrationAuthorization } from './service-auth'
import { ArtifactError } from './timeline-artifact-contract'

export interface TimelineArtifactEnv { DB: D1Database; SESSIONS?: KVNamespace; JWT_SECRET?: string; ENVIRONMENT?: string; INTEGRATION_TOKEN_HASH_KEY?: string; COMMUNITY_INTEGRATIONS_ENABLED?: string }
export interface HumanPrincipal { userId: number }
/** Resolves existing identities only. Never calls guest-provisioning auth helpers. */
export async function requireTimelineHuman(request: Request, env: TimelineArtifactEnv): Promise<HumanPrincipal> {
  if (isReservedIntegrationAuthorization(request) || request.headers.has('X-Guest-Session')) throw new ArtifactError('human_identity_required', 403)
  const authorization = request.headers.get('Authorization')
  let userId: number | undefined
  let hash: string | undefined
  if (authorization !== null) {
    const bearer = /^Bearer ([^\s]+)$/i.exec(authorization)
    if (!bearer || bearer[1].length > 4096) throw new ArtifactError('authentication_required', 401)
    const token = bearer[1]
    if (token.split('.').length === 3 && env.JWT_SECRET) {
      const payload = await verifyToken(token, env.JWT_SECRET)
      if (!payload || ['guest', 'service'].includes(String(payload.role).toLowerCase())) throw new ArtifactError('authentication_required', 401)
      userId = Number(payload.sub)
    } else if (env.SESSIONS) {
      const session = await env.SESSIONS.get(token)
      if (session !== null) {
        try { userId = Number(JSON.parse(session).user_id) } catch { throw new ArtifactError('authentication_required', 401) }
      }
    }
    if (userId === undefined) hash = token
  } else hash = request.headers.get('X-User-Hash') ?? undefined
  if (userId === undefined) {
    if (!hash || hash.length < 16 || hash.length > 256 || hash.startsWith('guest-session:')) throw new ArtifactError('authentication_required', 401)
    const existing = await env.DB.prepare('SELECT id FROM users WHERE user_hash=?').bind(hash).first<{ id: number }>()
    userId = existing?.id
  }
  if (!Number.isSafeInteger(userId) || Number(userId) <= 0) throw new ArtifactError('authentication_required', 401)
  const user = await env.DB.prepare('SELECT id,role,is_active FROM users WHERE id=?').bind(userId).first<{ id: number; role: string; is_active: number }>()
  if (!user || user.is_active !== 1 || !user.role?.trim() || ['guest', 'service'].includes(user.role.trim().toLowerCase())) throw new ArtifactError('human_identity_required', 403)
  return { userId: user.id }
}
/** Used on every request/replay; writes repeat this predicate in the revision trigger. */
export async function requireTimelineWorkspace(env: TimelineArtifactEnv, principal: HumanPrincipal, workspaceId: string, write: boolean): Promise<void> {
  const proof=serviceProofs.get(principal)
  if (proof) {
    if (env.COMMUNITY_INTEGRATIONS_ENABLED!=='true' || proof.workspaceId!==workspaceId) throw new ArtifactError('access_denied',403)
    if (!await serviceStatement(env,principal,write,false).first()) throw new ArtifactError('access_denied',403)
    return
  }
  const access = await env.DB.prepare(`SELECT 1 FROM users u JOIN workspaces w ON w.id=?
    WHERE u.id=? AND u.is_active=1 AND length(trim(u.role))>0 AND lower(trim(u.role)) NOT IN ('guest','service')
      AND w.id<>'1' AND w.is_public=0 AND (w.owner_id=u.id OR EXISTS (
        SELECT 1 FROM workspace_members m WHERE m.workspace_id=w.id AND m.user_id=u.id AND m.role IN (${write ? "'EDITOR','ADMIN'" : "'VIEWER','EDITOR','ADMIN'"})
      ))`).bind(workspaceId, principal.userId).first()
  if (!access) throw new ArtifactError('access_denied', 403)
}

// Request-specific proof never becomes an enumerable principal field or history data.
interface ServiceProof { clientId: string; tokenId: string; digest: string; environment: string; workspaceId: string; investigationId: string; communityId: string }
const serviceProofs = new WeakMap<HumanPrincipal, ServiceProof>()
const serviceBinding = `FROM integration_clients c
 JOIN users u ON u.id=c.principal_user_id
 JOIN workspaces w ON w.id=c.workspace_id
 JOIN investigations i ON i.id=c.intake_investigation_id
 JOIN integration_client_tokens t ON t.client_id=c.id
 WHERE c.id=? AND t.id=? AND t.secret_hash=? AND c.environment=?
 AND c.workspace_id=? AND c.intake_investigation_id=? AND c.community_id=? AND u.id=?
 AND c.status='active' AND c.audience='researchtools-community-api.v1'
 AND c.maximum_visibility IN ('private','community','public')
 AND t.slot IN ('current','next') AND t.hash_version='hmac-sha256.v1'
 AND typeof(t.created_at)='integer' AND t.created_at BETWEEN 0 AND 9007199254740991
 AND typeof(t.not_before)='integer' AND t.not_before BETWEEN 0 AND 9007199254740991
 AND typeof(t.expires_at)='integer' AND t.expires_at BETWEEN 0 AND 9007199254740991
 AND t.created_at<=unixepoch() AND t.not_before<=unixepoch() AND t.expires_at>unixepoch() AND t.revoked_at IS NULL
 AND EXISTS (SELECT 1 FROM integration_client_token_scopes s WHERE s.token_id=t.id AND s.scope=?)
 AND u.role='service' AND u.is_active=1 AND u.username='service_'||c.id
 AND u.email='service+'||c.id||'@service.invalid' AND u.user_hash IS NULL AND u.account_hash IS NULL
 AND u.oidc_sub IS NULL AND u.oidc_provider IS NULL AND u.oidc_email IS NULL AND u.hashed_password='SERVICE_AUTH_DISABLED'
 AND w.id<>'1' AND w.owner_id=u.id AND w.type='TEAM' AND w.is_public=0
 AND i.workspace_id=w.id AND i.created_by=u.id AND i.status='active'
 AND NOT EXISTS (SELECT 1 FROM workspace_members m WHERE m.user_id=u.id)`
function serviceStatement(env: TimelineArtifactEnv, principal: HumanPrincipal, write: boolean, assertion: boolean) {
  const proof=serviceProofs.get(principal)!
  return env.DB.prepare(assertion
    ? `SELECT json(CASE WHEN EXISTS (SELECT 1 ${serviceBinding}) THEN 'null' ELSE '' END)`
    : `SELECT 1 ${serviceBinding}`)
    .bind(proof.clientId,proof.tokenId,proof.digest,proof.environment,proof.workspaceId,proof.investigationId,proof.communityId,principal.userId,write?'timeline.write':'timeline.read')
}
/** First statement of every service mutation, even create and no-op/replay races. */
export function timelineWriteAssertions(env: TimelineArtifactEnv, principal: HumanPrincipal): D1PreparedStatement[] {
  if (!serviceProofs.has(principal)) return []
  if (env.COMMUNITY_INTEGRATIONS_ENABLED!=='true') throw new ArtifactError('access_denied',403)
  return [serviceStatement(env,principal,true,true)]
}
export async function requireTimelinePrincipal(request: Request, env: TimelineArtifactEnv, write: boolean): Promise<HumanPrincipal> {
  if (!isReservedIntegrationAuthorization(request)) return requireTimelineHuman(request,env)
  if (env.COMMUNITY_INTEGRATIONS_ENABLED!=='true') throw new ArtifactError('access_denied',403)
  try {
    const service=await getIntegrationPrincipalFromRequest(request,env)
    if (!service) throw new ArtifactError('authentication_required',401)
    if (!service.scopes.includes(write?'timeline.write':'timeline.read')) throw new ArtifactError('access_denied',403)
    const parsed=SERVICE_TOKEN_PATTERN.exec(request.headers.get('Authorization')!.slice(7))!
    const principal={userId:service.principalUserId}
    serviceProofs.set(principal,{clientId:service.clientId,tokenId:service.tokenId,digest:await deriveIntegrationTokenHash(env.INTEGRATION_TOKEN_HASH_KEY!,parsed[1],parsed[2]),environment:service.environment,workspaceId:service.workspaceId,investigationId:service.investigationId,communityId:service.communityId})
    await requireTimelineWorkspace(env,principal,service.workspaceId,write)
    return principal
  } catch(error) {
    if (error instanceof ArtifactError) throw error
    if (error instanceof IntegrationAuthError) throw new ArtifactError(error.status===503?'datastore_unavailable':error.status===403?'access_denied':'authentication_required',error.status)
    throw new ArtifactError('datastore_unavailable',503)
  }
}
