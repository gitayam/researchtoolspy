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
 * The Signal bot's integration client, by exact id (never a pattern: any client whose
 * id merely contains "signal" is another integration). Only it reads the chat feed,
 * redeems room link codes, and writes items marked as coming from chat
 * (source_channel 'signal'). The unit tests use the same id.
 */
export const SIGNAL_BOT_CLIENT_IDS: ReadonlySet<string> = new Set(['irregularchat-signal-prod'])

export function isSignalBotClient(clientId: string | null | undefined): boolean {
  return typeof clientId === 'string' && SIGNAL_BOT_CLIENT_IDS.has(clientId)
}

/**
 * The operations a service may call — the Signal bot's COP calls, and nothing
 * else. Mirrors `OPERATION_ROUTE_RULES.cop` in the bot's
 * packages/shared-utils/src/bot-utils/researchtools-capabilities.ts.
 */
export const COP_SERVICE_ROUTES: readonly { method: string; path: RegExp }[] = [
  { method: 'POST', path: /^\/api\/cop\/sessions$/ },
  // !cop link <code>: a room link code the COP's owner or an editor made.
  { method: 'POST', path: /^\/api\/cop\/room-link-codes\/redeem$/ },
  {
    method: 'GET',
    path: /^\/api\/cop\/(?!public(?:\/|$)|sessions(?:\/|$)|room-link-codes(?:\/|$))[^/]+\/(?:claims|stats|webcams\/nearby|tags|item-tags|geocode|rfis)$/,
  },
  // What happened in the COP, for the linked rooms' digest ("From the COP"); never the bot's own.
  {
    method: 'GET',
    path: /^\/api\/cop\/(?!public(?:\/|$)|sessions(?:\/|$)|room-link-codes(?:\/|$))[^/]+\/chat-feed$/,
  },
  {
    method: 'POST',
    path: /^\/api\/cop\/(?!public(?:\/|$)|sessions(?:\/|$)|room-link-codes(?:\/|$))[^/]+\/(?:shares|rfis|evidence|markers|timeline|tasks|poo-estimates|personas|claims|hypotheses|webcams|tags|item-tags|suggest|uploads|evidence-links)$/,
  },
  // Filing evidence under a question in one call (the bot's !cop file).
  {
    method: 'POST',
    path: /^\/api\/cop\/(?!public(?:\/|$)|sessions(?:\/|$)|room-link-codes(?:\/|$))[^/]+\/rfis\/[^/]+\/evidence$/,
  },
  // Undo of the bot's own captures; each handler refuses items a service didn't create.
  {
    method: 'DELETE',
    path: /^\/api\/cop\/(?!public(?:\/|$)|sessions(?:\/|$)|room-link-codes(?:\/|$))[^/]+\/(?:item-tags|evidence|markers|tasks|timeline|rfis\/[^/]+|evidence-links)$/,
  },
  // Confirming a bot marker, starring a bot RFI, the bot's !done/!start/!priority/!assign on
  // its own tasks and updating its own evidence (archive reference, scan state); same
  // own-items rule in every handler.
  {
    method: 'PUT',
    path: /^\/api\/cop\/(?!public(?:\/|$)|sessions(?:\/|$)|room-link-codes(?:\/|$))[^/]+\/(?:claims|hypotheses|markers|tasks|evidence|rfis\/[^/]+)$/,
  },
  // The bot's !resolve answers an RFI it created.
  {
    method: 'POST',
    path: /^\/api\/cop\/(?!public(?:\/|$)|sessions(?:\/|$)|room-link-codes(?:\/|$))[^/]+\/rfis\/[^/]+\/answers$/,
  },
]

/** The session id in a COP session route, or null for /api/cop/sessions, public and room-link-codes routes. */
export function copSessionIdFromPath(pathname: string): string | null {
  const match = /^\/api\/cop\/([^/]+)\//.exec(pathname)
  if (!match || match[1] === 'sessions' || match[1] === 'public' || match[1] === 'room-link-codes') return null
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
