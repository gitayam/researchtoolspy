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
 *     user. A service never reaches another caller's session.
 * The handler then acts as the principal user (copCallerUserId).
 *
 * Refusals are integration-error.v1 documents, like the other service routes.
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
import { COP_SERVICE_ROUTES, copSessionIdFromPath, type CopServiceCaller } from '../_shared/cop-caller'

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

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  if (!isReservedIntegrationAuthorization(request)) return context.next()

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
    try {
      const row = await env.DB.prepare('SELECT created_by FROM cop_sessions WHERE id = ?')
        .bind(sessionId)
        .first<{ created_by: number }>()
      createdBy = row ? Number(row.created_by) : null
    } catch {
      return refuse(request, 'auth_datastore_unavailable', 'COP session lookup failed.', 503, true)
    }
    if (createdBy !== principal.principalUserId) {
      return refuse(request, 'workspace_denied', 'That COP session is not available to this credential.', 403)
    }
  }

  const service: CopServiceCaller = {
    clientId: principal.clientId,
    principalUserId: principal.principalUserId,
    workspaceId: principal.workspaceId,
  }
  ;(context.data as Record<string, unknown>).copService = service
  return context.next()
}
