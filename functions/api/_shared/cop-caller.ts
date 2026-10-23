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
    path: /^\/api\/cop\/(?!public(?:\/|$)|sessions(?:\/|$))[^/]+\/(?:claims|stats|webcams\/nearby|tags|item-tags|geocode)$/,
  },
  {
    method: 'POST',
    path: /^\/api\/cop\/(?!public(?:\/|$)|sessions(?:\/|$))[^/]+\/(?:shares|rfis|evidence|markers|timeline|tasks|poo-estimates|personas|claims|hypotheses|webcams|tags|item-tags|suggest|uploads)$/,
  },
  // Undo of the bot's own captures; each handler refuses items a service didn't create.
  {
    method: 'DELETE',
    path: /^\/api\/cop\/(?!public(?:\/|$)|sessions(?:\/|$))[^/]+\/(?:item-tags|evidence|markers|tasks|timeline|rfis\/[^/]+)$/,
  },
  // Confirming a bot marker and starring a bot RFI; same own-items rule.
  {
    method: 'PUT',
    path: /^\/api\/cop\/(?!public(?:\/|$)|sessions(?:\/|$))[^/]+\/(?:claims|hypotheses|markers|rfis\/[^/]+)$/,
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

/**
 * A service may use a session its principal user created, or one a person shared
 * with that user as a collaborator: an editor or admin for any allowed operation,
 * a viewer only for reads. Anything else, including an unknown session, is refused.
 */
export function serviceMayUseSession(
  createdBy: number | null,
  collaboratorRole: string | null,
  principalUserId: number,
  method: string,
): boolean {
  if (createdBy === null) return false
  if (createdBy === principalUserId) return true
  if (collaboratorRole === 'editor' || collaboratorRole === 'admin') return true
  return collaboratorRole === 'viewer' && method === 'GET'
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
