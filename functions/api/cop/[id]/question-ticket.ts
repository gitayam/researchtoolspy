/**
 * A question ticket for the workspace's evidence form.
 *
 * GET /api/cop/:id/question-ticket → { ticket, expires_at }
 *
 * The COP's owner and collaborators (any role) only; never a service credential or a
 * share link. The form passes the ticket to GET /api/surveys/public/:token (header
 * X-Question-Ticket, never the URL) and drop-submit (`question_context.ticket`), which
 * then offer and accept every open question of this COP. The ticket names the session,
 * not the person (functions/api/_shared/cop-question-ticket.ts).
 * 503 QUESTION_TICKET_UNAVAILABLE when the server has no signing secret.
 */
import type { PagesFunction } from '@cloudflare/workers-types'
import { verifyCopSessionAccess } from '../../_shared/auth-helpers'
import { JSON_HEADERS } from '../../_shared/api-utils'
import { copCallerUserId, copServiceCaller } from '../../_shared/cop-caller'
import { signQuestionTicket } from '../../_shared/cop-question-ticket'

interface Env {
  DB: D1Database
  JWT_SECRET?: string
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...JSON_HEADERS, 'Cache-Control': 'no-store' } })

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params } = context
  const sessionId = params.id as string
  if (copServiceCaller(context.data)) return json({ error: 'Access denied' }, 403)
  const userId = await copCallerUserId(context)
  if (!userId) return json({ error: 'Authentication required' }, 401)
  if (!(await verifyCopSessionAccess(env.DB, sessionId, userId))) return json({ error: 'Access denied' }, 403)

  const signed = await signQuestionTicket(env.JWT_SECRET, sessionId)
  if (!signed) {
    console.error('[cop/question-ticket] JWT_SECRET is not set; the workspace form offers key questions only')
    return json({ error: 'Not available on this server', code: 'QUESTION_TICKET_UNAVAILABLE' }, 503)
  }
  return json({ ticket: signed.ticket, expires_at: signed.expiresAt })
}

export const onRequestOptions: PagesFunction = async () => new Response(null, { status: 204, headers: JSON_HEADERS })
