/**
 * POST   /api/cop/:id/room-link-codes → 201 { code, expires_at, command }
 * DELETE /api/cop/:id/room-link-codes → 200 { revoked }
 *
 * A one-time code that links one Signal room to this COP ("!cop link <code>" in the
 * room; functions/api/_shared/cop-room-link-codes.ts), and revoking every open code at
 * once. The COP's owner or an admin collaborator only (linking a room grants the bot
 * access, and granting access is the owner's call): never an editor, a viewer, a share
 * link or a service (the bot must not mint its own consent). The code is shown once and
 * only its hash is kept; it lasts 24 hours. 503 while migration 0027 is pending.
 */
import type { PagesFunction } from '@cloudflare/workers-types'
import { JSON_HEADERS } from '../../_shared/api-utils'
import { logEvent } from '../../_shared/event-log'
import { copCallerUserId, copServiceCaller } from '../../_shared/cop-caller'
import { emitCopEvent } from '../../_shared/cop-events'
import { ACTIVITY_LOGGED } from '../../_shared/cop-event-types'
import { createLinkCode, linkCodesTableMissing, mayLinkRooms, revokeOpenLinkCodes } from '../../_shared/cop-room-link-codes'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
  JWT_SECRET?: string
}

const headers = { ...JSON_HEADERS, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers })
const NOT_READY = { error: 'Room link codes are not available on this server yet', code: 'NOT_READY' }

/** The caller, when they may link rooms to this COP; otherwise the refusal. */
async function ownerOrAdmin(context: Parameters<PagesFunction<Env>>[0]): Promise<{ userId: number } | Response> {
  const { request, env, params } = context
  if (request.headers.get('X-Share-Token') || new URL(request.url).searchParams.has('share')) {
    return reply({ error: 'Not available through a share link', code: 'SHARE_NOT_ALLOWED' }, 403)
  }
  if (copServiceCaller(context.data)) {
    return reply({ error: 'A service cannot manage room link codes', code: 'SERVICE_NOT_ALLOWED' }, 403)
  }
  const userId = await copCallerUserId(context)
  if (!userId) return reply({ error: 'Authentication required' }, 401)
  if (!(await mayLinkRooms(env.DB, params.id as string, userId))) {
    return reply({ error: 'Only the COP owner or an admin can link a Signal room', code: 'NOT_OWNER_OR_ADMIN' }, 403)
  }
  return { userId }
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, params } = context
  const sessionId = params.id as string
  const caller = await ownerOrAdmin(context)
  if (caller instanceof Response) return caller

  try {
    const made = await createLinkCode(env.DB, sessionId, caller.userId)
    if (made.ok === false) return reply({ error: made.error, code: made.code }, made.status)
    // Team activity (never on a share link's feed); the code itself is in no event.
    await emitCopEvent(env.DB, {
      copSessionId: sessionId, eventType: ACTIVITY_LOGGED, entityType: 'activity', entityId: made.id,
      payload: { action: 'room_link_code_created' }, createdBy: caller.userId,
    })
    return reply({ code: made.code, expires_at: made.expires_at, command: `!cop link ${made.code}` }, 201)
  } catch (error) {
    if (linkCodesTableMissing(error)) return reply(NOT_READY, 503)
    await logEvent(env, {
      level: 'error',
      source: 'cop/room-link-codes',
      message: String(error instanceof Error ? error.message : error).slice(0, 500),
    })
    return reply({ error: 'Failed to make a link code' }, 500)
  }
}

/** Revoke every open (unused, unexpired) code of this COP; answers how many. */
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { env, params } = context
  const sessionId = params.id as string
  const caller = await ownerOrAdmin(context)
  if (caller instanceof Response) return caller

  try {
    const revoked = await revokeOpenLinkCodes(env.DB, sessionId, caller.userId)
    await emitCopEvent(env.DB, {
      copSessionId: sessionId, eventType: ACTIVITY_LOGGED, entityType: 'activity', entityId: `rlr-${crypto.randomUUID()}`,
      payload: { action: 'room_link_codes_revoked', count: revoked }, createdBy: caller.userId,
    })
    return reply({ revoked })
  } catch (error) {
    if (linkCodesTableMissing(error)) return reply(NOT_READY, 503)
    await logEvent(env, {
      level: 'error',
      source: 'cop/room-link-codes',
      message: String(error instanceof Error ? error.message : error).slice(0, 500),
    })
    return reply({ error: 'Failed to revoke the link codes' }, 500)
  }
}

export const onRequestOptions: PagesFunction = async () => new Response(null, { status: 204, headers: JSON_HEADERS })
