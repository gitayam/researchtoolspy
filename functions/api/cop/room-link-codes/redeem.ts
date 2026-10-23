/**
 * POST /api/cop/room-link-codes/redeem { code } → 200 { session_id }
 *
 * The Signal bot redeems a room link code an organizer typed ("!cop link <code>"). The
 * Signal bot's service credential only (COP_SERVICE_ROUTES; SIGNAL_BOT_CLIENT_IDS): never
 * a person or another integration. The code is used once, in one transaction with the
 * collaborator write (functions/api/_shared/cop-room-link-codes.ts): its issuer must still
 * be the COP's owner or an admin, and the bot's principal becomes an editor collaborator
 * when it isn't one yet (rooms write their captures there). An existing collaborator row
 * is never changed: a bot that is a viewer gets 409 BOT_ROLE_TOO_LOW and the code stays
 * unspent. Unknown, used, revoked and expired codes all answer 404 LINK_CODE_INVALID.
 * LINK_CODE_REDEEMS_PER_HOUR attempts per client per hour (429; the bot also limits each
 * sender). 503 while migration 0027 is pending.
 */
import type { PagesFunction } from '@cloudflare/workers-types'
import { JSON_HEADERS } from '../../_shared/api-utils'
import { logEvent } from '../../_shared/event-log'
import { copServiceCaller, isSignalBotClient } from '../../_shared/cop-caller'
import { emitCopEvent } from '../../_shared/cop-events'
import { ACTIVITY_LOGGED, COLLABORATOR_ADDED } from '../../_shared/cop-event-types'
import { linkCodesTableMissing, normalizeLinkCode, redeemLinkCode, takeRedeemSlot } from '../../_shared/cop-room-link-codes'

interface Env {
  DB: D1Database
}

const headers = { ...JSON_HEADERS, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers })
const INVALID = { error: 'That link code is unknown, already used or expired', code: 'LINK_CODE_INVALID' }

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  const service = copServiceCaller(context.data)
  if (!service || !isSignalBotClient(service.clientId)) {
    return reply({ error: 'Only the Signal bot redeems room link codes', code: 'SERVICE_ONLY' }, 403)
  }
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return reply({ error: 'Expected a JSON object' }, 400)
  }
  try {
    if (!(await takeRedeemSlot(env.DB, service.clientId))) {
      return reply({ error: 'Too many link codes tried; try again later', code: 'RATE_LIMITED' }, 429)
    }
    const code = normalizeLinkCode((body as { code?: unknown } | null)?.code)
    if (!code) return reply(INVALID, 404)
    const result = await redeemLinkCode(env.DB, { code, clientId: service.clientId, principalUserId: service.principalUserId })
    if (result.ok === false) {
      return result.status === 409 ? reply({ error: result.error, code: result.code }, 409) : reply(INVALID, 404)
    }
    // The issuer's consent, recorded as theirs; the code itself is in no event.
    await emitCopEvent(env.DB, result.added
      ? {
          copSessionId: result.sessionId, eventType: COLLABORATOR_ADDED, entityType: 'collaborator',
          entityId: result.collaboratorId, payload: { via: 'room_link_code' }, createdBy: result.issuer,
        }
      : {
          copSessionId: result.sessionId, eventType: ACTIVITY_LOGGED, entityType: 'activity',
          entityId: result.codeId, payload: { action: 'room_link_code_used' }, createdBy: result.issuer,
        })
    return reply({ session_id: result.sessionId })
  } catch (error) {
    if (linkCodesTableMissing(error)) return reply({ error: 'Room link codes are not available on this server yet', code: 'NOT_READY' }, 503)
    await logEvent(env, {
      level: 'error',
      source: 'cop/room-link-codes/redeem',
      message: String(error instanceof Error ? error.message : error).slice(0, 500),
    })
    return reply({ error: 'Failed to redeem the link code' }, 500)
  }
}

export const onRequestOptions: PagesFunction = async () => new Response(null, { status: 204, headers: JSON_HEADERS })
