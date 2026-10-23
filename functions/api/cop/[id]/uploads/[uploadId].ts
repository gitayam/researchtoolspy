/**
 * GET /api/cop/:id/uploads/:uploadId - A COP upload's bytes (collaborators)
 *
 * Served inert: the stored (sniffed) type, nosniff, `default-src 'none'; sandbox`,
 * inline for images and a download for PDFs. Another session's upload is 404.
 */
import type { PagesFunction } from '@cloudflare/workers-types'
import { copReader, json } from '../../../_shared/cop-route-auth'
import { getSessionUpload, serveUpload, type R2Like } from '../../../_shared/cop-uploads'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
  UPLOADS?: R2Like
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const sessionId = context.params.id as string
  const uploadId = context.params.uploadId as string
  const access = await copReader(context, sessionId)
  if (access.ok === false) return access.response
  const row = await getSessionUpload(context.env.DB, sessionId, uploadId)
  if (!row) return json({ error: 'Not found' }, 404)
  return serveUpload(context.env, row, 'private, max-age=3600')
}
