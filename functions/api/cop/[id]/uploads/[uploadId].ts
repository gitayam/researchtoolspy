/**
 * GET /api/cop/:id/uploads/:uploadId - A COP upload's bytes (the owner and collaborators;
 * not other signed-in readers of a public session)
 *
 * Served inert: nosniff, `default-src 'none'; sandbox`, images inline with their own
 * type, everything else a download. Another session's upload is 404; a file whose
 * evidence is held pending a virus scan is 409 FILE_HELD.
 */
import type { PagesFunction } from '@cloudflare/workers-types'
import { copCollaborator, json } from '../../../_shared/cop-route-auth'
import { getSessionUpload, heldResponse, serveUpload, uploadHeld, type R2Like } from '../../../_shared/cop-uploads'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
  UPLOADS?: R2Like
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const sessionId = context.params.id as string
  const uploadId = context.params.uploadId as string
  const access = await copCollaborator(context, sessionId)
  if (access.ok === false) return access.response
  const row = await getSessionUpload(context.env.DB, sessionId, uploadId)
  if (!row) return json({ error: 'Not found' }, 404)
  if (await uploadHeld(context.env.DB, row)) return heldResponse()
  return serveUpload(context.env, row, 'private, max-age=3600')
}
