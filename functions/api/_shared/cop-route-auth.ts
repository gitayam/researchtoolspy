/**
 * The auth steps every S2 COP route repeats: who is calling, and may they read or
 * edit this session. Editors are the owner or an editor/admin collaborator; the
 * bot's service credential reaches a handler only through the COP middleware and
 * then acts as its principal user (functions/api/_shared/cop-caller.ts).
 */
import { verifyCopSessionAccess } from './auth-helpers'
import { copCallerUserId, copServiceCaller } from './cop-caller'
import { mayEditCopSession } from './cop-webcams'
import { JSON_HEADERS } from './api-utils'

export const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: JSON_HEADERS })

export function coded(status: number, code: string, error: string): Response {
  return json({ error, code }, status)
}

export type CopAccess =
  | { ok: true; userId: number; workspaceId: string; service: boolean; response?: undefined }
  | { ok: false; response: Response; userId?: undefined; workspaceId?: undefined; service?: undefined }

/** A collaborator (or, for a public session, any signed-in user) may read. */
export async function copReader(context: { request: Request; env: { DB: D1Database }; data?: unknown }, sessionId: string): Promise<CopAccess> {
  const userId = await copCallerUserId(context)
  if (!userId) return { ok: false, response: json({ error: 'Authentication required' }, 401) }
  const workspaceId = await verifyCopSessionAccess(context.env.DB, sessionId, userId, { readOnly: true })
  if (!workspaceId) return { ok: false, response: json({ error: 'Access denied' }, 403) }
  return { ok: true, userId, workspaceId, service: Boolean(copServiceCaller(context.data)) }
}

/** The owner or an editor/admin collaborator may write. */
export async function copEditor(
  context: { request: Request; env: { DB: D1Database }; data?: unknown },
  sessionId: string,
  what: string,
): Promise<CopAccess> {
  const userId = await copCallerUserId(context)
  if (!userId) return { ok: false, response: json({ error: 'Authentication required' }, 401) }
  const workspaceId = await verifyCopSessionAccess(context.env.DB, sessionId, userId)
  if (!workspaceId || !(await mayEditCopSession(context.env.DB, sessionId, userId))) {
    return { ok: false, response: json({ error: `Only the session owner or an editor can ${what}` }, 403) }
  }
  return { ok: true, userId, workspaceId, service: Boolean(copServiceCaller(context.data)) }
}

export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json()
    return body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : null
  } catch {
    return null
  }
}
