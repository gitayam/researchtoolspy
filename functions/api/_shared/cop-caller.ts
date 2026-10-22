/**
 * Who is calling a COP route.
 *
 * Users sign in as before (session, JWT or hash) and reach COP through
 * getUserFromRequest. A scoped service — the Signal bot's `rt_svc_` credential —
 * is admitted by functions/api/cop/_middleware.ts, which stores the result in
 * `context.data.copService`; the handler then acts as the service's principal
 * user, so the existing owner/collaborator checks apply unchanged.
 */
import { getUserFromRequest } from './auth-helpers'

export interface CopServiceCaller {
  clientId: string
  principalUserId: number
  workspaceId: string
}

/**
 * The operations a service may call — the Signal bot's COP calls, and nothing
 * else. Mirrors `OPERATION_ROUTE_RULES.cop` in the bot's
 * packages/shared-utils/src/bot-utils/researchtools-capabilities.ts.
 */
export const COP_SERVICE_ROUTES: readonly { method: string; path: RegExp }[] = [
  { method: 'POST', path: /^\/api\/cop\/sessions$/ },
  {
    method: 'GET',
    path: /^\/api\/cop\/(?!public(?:\/|$)|sessions(?:\/|$))[^/]+\/(?:claims|stats)$/,
  },
  {
    method: 'POST',
    path: /^\/api\/cop\/(?!public(?:\/|$)|sessions(?:\/|$))[^/]+\/(?:shares|rfis|evidence|markers|timeline|tasks|poo-estimates|personas|claims|hypotheses)$/,
  },
  {
    method: 'PUT',
    path: /^\/api\/cop\/(?!public(?:\/|$)|sessions(?:\/|$))[^/]+\/(?:claims|hypotheses)$/,
  },
]

/** The session id in a COP session route, or null for /api/cop/sessions. */
export function copSessionIdFromPath(pathname: string): string | null {
  const match = /^\/api\/cop\/([^/]+)\//.exec(pathname)
  if (!match || match[1] === 'sessions' || match[1] === 'public') return null
  try {
    return decodeURIComponent(match[1])
  } catch {
    return null
  }
}

export function copServiceCaller(data: unknown): CopServiceCaller | null {
  const service = (data as { copService?: CopServiceCaller } | undefined)?.copService
  return service && Number.isSafeInteger(service.principalUserId) ? service : null
}

/**
 * The user id a COP handler acts as: the service's principal user when the
 * middleware admitted a service caller, otherwise the signed-in user (or null).
 */
export async function copCallerUserId(context: {
  request: Request
  env: unknown
  data?: unknown
}): Promise<number | null> {
  const service = copServiceCaller(context.data)
  if (service) return service.principalUserId
  return getUserFromRequest(context.request, context.env as Parameters<typeof getUserFromRequest>[1])
}
