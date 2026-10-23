/**
 * Public COP change feed for a share link.
 *
 * GET /api/cop/public/:token/changes?since=<cursor>&limit=200
 *   → { events: [{ id, entity_type, entity_id, event_type, created_at }], cursor, has_more }
 *
 * Same shape and cursor rules as GET /api/cop/:id/changes, limited to the entity types
 * the share's panels show (publicFeedTypes). 404 for an unknown or expired link, 410 for
 * an archived session. Limited per client address (PUBLIC_CHANGES_PER_MINUTE): 429 over
 * it, 503 when the limit can't be counted.
 */
import type { PagesFunction } from '@cloudflare/workers-types'
import { JSON_HEADERS } from '../../../_shared/api-utils'
import { logEvent } from '../../../_shared/event-log'
import { changesLimit, listCopChanges } from '../../../_shared/cop-events'
import { loadPublicShare, publicFeedTypes, takePublicChangesSlot } from '../../../_shared/cop-public'
import type { KvLike } from '../../../_shared/kv-json'

interface Env {
  DB: D1Database
  CACHE?: KvLike
}

const headers = { ...JSON_HEADERS, 'Cache-Control': 'no-store' }

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const token = params.token as string

  try {
    const slot = await takePublicChangesSlot(env.CACHE, request)
    if (slot === 'unavailable') {
      return new Response(JSON.stringify({ error: 'Live updates are unavailable right now', code: 'RATE_LIMIT_UNAVAILABLE' }), {
        status: 503, headers: { ...headers, 'Retry-After': '30' },
      })
    }
    if (slot === 'over') {
      return new Response(JSON.stringify({ error: 'Too many requests; slow down', code: 'RATE_LIMITED' }), {
        status: 429, headers: { ...headers, 'Retry-After': '30' },
      })
    }

    const found = await loadPublicShare(env.DB, token)
    if (found.ok === false) return found.response

    const url = new URL(request.url)
    const result = await listCopChanges(
      env.DB,
      found.share.cop_session_id,
      url.searchParams.get('since'),
      changesLimit(url.searchParams.get('limit')),
      publicFeedTypes(found.panels),
    )
    if (result.ok === false) return new Response(JSON.stringify({ error: result.error }), { status: result.status, headers })
    return new Response(JSON.stringify({ events: result.events, cursor: result.cursor, has_more: result.has_more }), { headers })
  } catch (error) {
    await logEvent(env as never, {
      level: 'error',
      source: 'cop/public/changes',
      message: String(error instanceof Error ? error.message : error).slice(0, 500),
      context: { error: String(error) },
    })
    return new Response(JSON.stringify({ error: 'Failed to list changes' }), { status: 500, headers })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: JSON_HEADERS })
}
