/**
 * GET /api/cop/public/:token/uploads/:uploadId - A COP upload through a share link
 *
 * Only for a live share (not expired, session not archived) that shows the evidence
 * feed panel ('event'), and only uploads of that share's session. Served inert, like
 * the authenticated route (functions/api/_shared/cop-uploads.ts).
 */
import type { PagesFunction } from '@cloudflare/workers-types'
import { JSON_HEADERS } from '../../../../_shared/api-utils'
import { sessionArchived, shareExpired, sharePanels } from '../../../../_shared/cop-share'
import { getSessionUpload, serveUpload, type R2Like } from '../../../../_shared/cop-uploads'

interface Env {
  DB: D1Database
  UPLOADS?: R2Like
}

const notFound = () => new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: JSON_HEADERS })

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params } = context
  const token = String(params.token ?? '')
  const uploadId = String(params.uploadId ?? '')
  if (!/^[0-9a-f-]{36}$/i.test(token)) return notFound()

  const share = await env.DB.prepare(
    'SELECT cop_session_id, visible_panels, expires_at FROM cop_shares WHERE share_token = ?'
  ).bind(token).first<{ cop_session_id: string; visible_panels: string | null; expires_at?: string | null }>()
  if (!share || shareExpired(share) || !sharePanels(share).includes('event')) return notFound()
  const session = await env.DB.prepare('SELECT status FROM cop_sessions WHERE id = ?')
    .bind(share.cop_session_id).first<{ status: string | null }>()
  if (!session || sessionArchived(session)) return notFound()

  const row = await getSessionUpload(env.DB, share.cop_session_id, uploadId)
  if (!row) return notFound()
  return serveUpload(env, row, 'private, max-age=300')
}
