/**
 * COP change feed — what changed in a session since a cursor, oldest first.
 *
 * GET /api/cop/:id/changes?since=<cursor>&limit=200
 *   → { events: [{ id, entity_type, entity_id, event_type, created_at }], cursor, has_more }
 *
 * Any reader of the session (owner, collaborators including viewers, any signed-in user
 * on a public session). Start with `since=` empty: no events, the current cursor. Then
 * poll with the cursor from each answer; while `has_more` is true, poll again at once.
 * entity_type is one of COP_FEED_ENTITY_TYPES; clients refetch the panels for the types
 * they see. No payloads and no user ids leave.
 */
import type { PagesFunction } from '@cloudflare/workers-types'
import { verifyCopSessionAccess } from '../../_shared/auth-helpers'
import { JSON_HEADERS } from '../../_shared/api-utils'
import { logEvent } from '../../_shared/event-log'
import { copCallerUserId } from '../../_shared/cop-caller'
import { changesLimit, listCopChanges } from '../../_shared/cop-events'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
}

const headers = { ...JSON_HEADERS, 'Cache-Control': 'no-store' }

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const sessionId = params.id as string

  const userId = await copCallerUserId(context)
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401, headers })
  }
  if (!(await verifyCopSessionAccess(env.DB, sessionId, userId, { readOnly: true }))) {
    return new Response(JSON.stringify({ error: 'Access denied' }), { status: 403, headers })
  }

  try {
    const url = new URL(request.url)
    const result = await listCopChanges(env.DB, sessionId, url.searchParams.get('since'), changesLimit(url.searchParams.get('limit')))
    if (result.ok === false) return new Response(JSON.stringify({ error: result.error }), { status: result.status, headers })
    return new Response(JSON.stringify({ events: result.events, cursor: result.cursor, has_more: result.has_more }), { headers })
  } catch (error) {
    await logEvent(env, {
      level: 'error',
      source: 'cop/changes',
      message: String(error instanceof Error ? error.message : error).slice(0, 500),
      context: { error: String(error) },
    })
    return new Response(JSON.stringify({ error: 'Failed to list changes' }), { status: 500, headers })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: JSON_HEADERS })
}
