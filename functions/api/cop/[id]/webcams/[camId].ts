/**
 * DELETE /api/cop/:id/webcams/:camId - Remove a webcam (owner, editor or admin collaborator)
 *
 * The row is archived (archived_at), scoped to the session in the UPDATE itself.
 */
import type { PagesFunction } from '@cloudflare/workers-types'
import { JSON_HEADERS } from '../../../_shared/api-utils'
import { logEvent } from '../../../_shared/event-log'
import { copCallerUserId } from '../../../_shared/cop-caller'
import { mayEditCopSession, webcamsTableMissing, webcamsUnavailable } from '../../../_shared/cop-webcams'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: JSON_HEADERS })

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { env, params } = context
  const sessionId = params.id as string
  const camId = params.camId as string

  const userId = await copCallerUserId(context)
  if (!userId) return json({ error: 'Authentication required' }, 401)
  if (!(await mayEditCopSession(env.DB, sessionId, userId))) {
    return json({ error: 'Only the session owner or an editor can remove webcams' }, 403)
  }

  try {
    const result = await env.DB.prepare(
      'UPDATE cop_webcams SET archived_at = ? WHERE id = ? AND cop_session_id = ? AND archived_at IS NULL'
    ).bind(new Date().toISOString(), camId, sessionId).run()
    if (!result.meta?.changes) return json({ error: 'Webcam not found' }, 404)
    return json({ ok: true })
  } catch (error) {
    if (webcamsTableMissing(error)) return webcamsUnavailable()
    await logEvent(env, {
      level: 'error',
      source: 'cop/webcams',
      message: String(error instanceof Error ? error.message : error).slice(0, 500),
      context: { error: String(error) },
    })
    return json({ error: 'Failed to remove webcam' }, 500)
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: JSON_HEADERS })
}
