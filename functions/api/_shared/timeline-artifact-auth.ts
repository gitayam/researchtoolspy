import { verifyToken } from '../../utils/jwt'
import { isReservedIntegrationAuthorization } from './service-auth'
import { ArtifactError } from './timeline-artifact-contract'

export interface TimelineArtifactEnv { DB: D1Database; SESSIONS?: KVNamespace; JWT_SECRET?: string }
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
  const access = await env.DB.prepare(`SELECT 1 FROM users u JOIN workspaces w ON w.id=?
    WHERE u.id=? AND u.is_active=1 AND length(trim(u.role))>0 AND lower(trim(u.role)) NOT IN ('guest','service')
      AND w.id<>'1' AND w.is_public=0 AND (w.owner_id=u.id OR EXISTS (
        SELECT 1 FROM workspace_members m WHERE m.workspace_id=w.id AND m.user_id=u.id AND m.role IN (${write ? "'EDITOR','ADMIN'" : "'VIEWER','EDITOR','ADMIN'"})
      ))`).bind(workspaceId, principal.userId).first()
  if (!access) throw new ArtifactError('access_denied', 403)
}
