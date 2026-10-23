/**
 * COP routes for scoped service callers (`Bearer rt_svc_…`, e.g. the Signal bot).
 *
 * Every request without a service credential passes straight through: users
 * reach COP exactly as before. A service caller is admitted only when
 *   - COMMUNITY_INTEGRATIONS_ENABLED and COP_SERVICE_ENABLED are both "true"
 *     (COP_SERVICE_ENABLED is off by default; capabilities.ts reports the same flag),
 *   - its credential holds `community.cop.write`,
 *   - the method and path are one of the bot's COP operations (COP_SERVICE_ROUTES),
 *   - and, on a session route, the session was created by the service's principal
 *     user, or that user is a collaborator on it (editor/admin: any allowed operation;
 *     viewer: reads only). A service never reaches a session not shared with it.
 * The handler then acts as the principal user (copCallerUserId).
 *
 * Refusals are integration-error.v1 documents, like the other service routes.
 *
 * For every caller, a successful write to a session route that emitted no cop_events
 * row gets a generic `entity.changed` event here, so the change feed
 * (GET /api/cop/:id/changes) never misses a write, even from a route that forgot to emit.
 */
import { JSON_HEADERS } from '../_shared/api-utils'
import {
  buildIntegrationErrorDocument,
  readIntegrationCorrelationId,
  type IntegrationErrorCode,
} from '../_shared/integration-contract'
import {
  getIntegrationPrincipalFromRequest,
  IntegrationAuthError,
  isReservedIntegrationAuthorization,
  type IntegrationAuthEnv,
} from '../_shared/service-auth'
import {
  COP_SERVICE_ROUTES,
  copSessionIdFromPath,
  serviceMayUseSession,
  type CopServiceCaller,
} from '../_shared/cop-caller'
import { getUserFromRequest } from '../_shared/auth-helpers'
import { emitCopEvent, trackCopEvents } from '../_shared/cop-events'
import { ENTITY_CHANGED, type CopFeedEntityType } from '../_shared/cop-event-types'

interface Env extends IntegrationAuthEnv {
  DB: D1Database
  COMMUNITY_INTEGRATIONS_ENABLED?: string
  COP_SERVICE_ENABLED?: string
}

const COP_SCOPE = 'community.cop.write'

function refuse(
  request: Request,
  code: IntegrationErrorCode,
  message: string,
  status: number,
  retryable = false,
): Response {
  const body = buildIntegrationErrorDocument({
    requestId: `req-${crypto.randomUUID()}`,
    correlationId: readIntegrationCorrelationId(request),
    code,
    message,
    retryable,
  })
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...JSON_HEADERS,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...(status === 503 ? { 'Retry-After': '2' } : {}),
    },
  })
}

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

/** The change-feed entity type of a COP session route, from its first path segment. */
export function entityTypeForCopPath(pathname: string): CopFeedEntityType {
  const segment = /^\/api\/cop\/[^/]+\/([^/?]+)/.exec(pathname)?.[1] ?? ''
  switch (segment) {
    case 'evidence': case 'scrape': return 'evidence'
    case 'markers': case 'marker-changelog': case 'cot': return 'marker'
    case 'rfis': return 'rfi'
    case 'tasks': case 'task-templates': case 'task-dependencies': return 'task'
    case 'timeline': return 'timeline'
    case 'claims': return 'claim'
    case 'hypotheses': return 'hypothesis'
    case 'personas': return 'persona'
    case 'poo-estimates': return 'poo'
    case 'assets': return 'asset'
    case 'webcams': return 'webcam'
    case 'evidence-tags': case 'tags': case 'item-tags': return 'tag'
    case 'uploads': return 'upload'
    case 'submissions': case 'intake-forms': return 'submission'
    case 'shares': return 'share'
    case 'playbooks': return 'playbook'
    case 'activity': case 'alerts': return 'activity'
    default: return 'session'
  }
}

/**
 * Run the handler; for a successful write to a session route that emitted no event,
 * emit a generic one. Reads and non-session routes pass straight through.
 */
async function withChangeFallback(
  context: Parameters<PagesFunction<Env>>[0],
  service: CopServiceCaller | null,
): Promise<Response> {
  const { request, env } = context
  if (!WRITE_METHODS.has(request.method)) return context.next()
  const { pathname } = new URL(request.url)
  const sessionId = copSessionIdFromPath(pathname)
  if (sessionId === null) return context.next()

  const { result: response, emitted } = await trackCopEvents(() => context.next())
  if (emitted === 0 && response.status >= 200 && response.status < 300) {
    let userId: number | null = service?.principalUserId ?? null
    if (userId === null) {
      try {
        userId = await getUserFromRequest(request, env as never)
      } catch {
        userId = null
      }
    }
    if (userId !== null) {
      await emitCopEvent(env.DB, {
        copSessionId: sessionId,
        eventType: ENTITY_CHANGED,
        entityType: entityTypeForCopPath(pathname),
        payload: { method: request.method },
        createdBy: userId,
      })
    }
  }
  return response
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  if (!isReservedIntegrationAuthorization(request)) return withChangeFallback(context, null)

  let principal
  try {
    principal = await getIntegrationPrincipalFromRequest(request, env)
  } catch (error) {
    if (error instanceof IntegrationAuthError) {
      return refuse(request, error.code, error.message, error.status, error.retryable)
    }
    return refuse(request, 'internal_error', 'COP service authentication failed.', 500, true)
  }
  if (!principal) {
    return refuse(request, 'authentication_required', 'A ResearchTools service credential is required.', 401)
  }

  if (
    env.COMMUNITY_INTEGRATIONS_ENABLED !== 'true' ||
    env.COP_SERVICE_ENABLED !== 'true' ||
    !principal.scopes.includes(COP_SCOPE)
  ) {
    return refuse(request, 'scope_denied', 'COP is not enabled for this service credential.', 403)
  }

  const { pathname } = new URL(request.url)
  const allowed = COP_SERVICE_ROUTES.some(
    (route) => route.method === request.method && route.path.test(pathname),
  )
  if (!allowed) {
    return refuse(request, 'scope_denied', 'This COP operation is not available to service credentials.', 403)
  }

  const sessionId = copSessionIdFromPath(pathname)
  if (sessionId !== null) {
    let createdBy: number | null
    let collaboratorRole: string | null = null
    try {
      const row = await env.DB.prepare('SELECT created_by FROM cop_sessions WHERE id = ?')
        .bind(sessionId)
        .first<{ created_by: number }>()
      createdBy = row ? Number(row.created_by) : null
      if (createdBy !== null && createdBy !== principal.principalUserId) {
        const collab = await env.DB.prepare(
          'SELECT role FROM cop_collaborators WHERE cop_session_id = ? AND user_id = ?'
        ).bind(sessionId, principal.principalUserId).first<{ role?: string | null }>()
        collaboratorRole = collab ? String(collab.role ?? 'viewer').toLowerCase() : null
      }
    } catch {
      return refuse(request, 'auth_datastore_unavailable', 'COP session lookup failed.', 503, true)
    }
    if (!serviceMayUseSession(createdBy, collaboratorRole, principal.principalUserId, request.method)) {
      return refuse(request, 'workspace_denied', 'That COP session is not available to this credential.', 403)
    }
  }

  const service: CopServiceCaller = {
    clientId: principal.clientId,
    principalUserId: principal.principalUserId,
    workspaceId: principal.workspaceId,
  }
  ;(context.data as Record<string, unknown>).copService = service
  return withChangeFallback(context, service)
}
