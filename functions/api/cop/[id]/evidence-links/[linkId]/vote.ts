/**
 * The team's vote on one filing: is this evidence helpful for this question?
 *
 * PUT /api/cop/:id/evidence-links/:linkId/vote { value: 1 | -1 | 0 }
 *   → { link_id, up, down, my_vote }   (0 clears the caller's vote)
 *
 * The COP's owner and collaborators (any role, viewers included) vote, one vote each
 * per filing. Never a service credential (the route is not in COP_SERVICE_ROUTES and
 * the handler refuses one), never a share link, never a signed-in reader who is not a
 * collaborator. The filing must be this session's (checked in SQL). The change goes
 * out as an `evidence.link_voted` event on the question, with counts and no user id.
 * 503 EVIDENCE_VOTES_UNAVAILABLE until migration 0026 is applied.
 */
import type { PagesFunction } from '@cloudflare/workers-types'
import { verifyCopSessionAccess } from '../../../../_shared/auth-helpers'
import { JSON_HEADERS } from '../../../../_shared/api-utils'
import { logEvent } from '../../../../_shared/event-log'
import { copCallerUserId, copServiceCaller } from '../../../../_shared/cop-caller'
import { cleanTargetId, cleanVote, linksTableMissing, setLinkVote, votesTableMissing } from '../../../../_shared/cop-evidence-links'

interface Env {
  DB: D1Database
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: JSON_HEADERS })

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { env, params, request } = context
  const sessionId = params.id as string
  if (copServiceCaller(context.data)) return json({ error: 'Only the COP’s team can vote', code: 'SERVICE_CANNOT_VOTE' }, 403)
  const userId = await copCallerUserId(context)
  if (!userId) return json({ error: 'Authentication required' }, 401)
  const workspaceId = await verifyCopSessionAccess(env.DB, sessionId, userId)
  if (!workspaceId) return json({ error: 'Only the COP’s team can vote' }, 403)

  const linkId = cleanTargetId(params.linkId)
  if (!linkId) return json({ error: 'linkId is not valid' }, 400)
  let body: { value?: unknown }
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }
  const value = cleanVote(body?.value)
  if (value === null) return json({ error: 'value must be 1, -1 or 0' }, 400)

  try {
    const session = await env.DB.prepare('SELECT status FROM cop_sessions WHERE id = ?').bind(sessionId).first<{ status: string | null }>()
    if (String(session?.status ?? '').toUpperCase() === 'ARCHIVED') return json({ error: 'This COP session is archived' }, 410)

    const result = await setLinkVote(env.DB, { scope: { sessionId, workspaceId }, linkId, userId, value })
    if (result.ok === false) return json({ error: result.error, code: result.code }, result.status)
    return json(result.tally)
  } catch (error) {
    if (votesTableMissing(error) || linksTableMissing(error)) {
      return json({ error: 'Voting on evidence is not available on this server yet.', code: 'EVIDENCE_VOTES_UNAVAILABLE' }, 503)
    }
    await logEvent(env, {
      level: 'error',
      source: 'cop/evidence-links/vote',
      message: String(error instanceof Error ? error.message : error).slice(0, 500),
      context: { error: String(error) },
    })
    return json({ error: 'Failed to save the vote' }, 500)
  }
}

export const onRequestOptions: PagesFunction = async () => new Response(null, { status: 204, headers: JSON_HEADERS })
