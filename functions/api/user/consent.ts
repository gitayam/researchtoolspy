/**
 * User consent record/status.
 *   GET  /api/user/consent              -> { consents: [{consent_type, version, accepted_at}] }
 *   POST /api/user/consent {consent_type} -> records (upserts) the acceptance for the user
 *
 * Requires an authenticated user (same auth as the gated features).
 */

import { getUserFromRequest } from '../_shared/auth-helpers'
import { JSON_HEADERS } from '../_shared/api-utils'
import { ALLOWED_CONSENT_TYPES, SENSITIVE_AI_CONSENT_VERSION } from '../_shared/consent'

interface Env {
  DB: any
  SESSIONS?: any
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const userId = await getUserFromRequest(context.request, context.env)
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401, headers: JSON_HEADERS })
  }
  try {
    const rows = await context.env.DB.prepare(
      `SELECT consent_type, version, accepted_at FROM user_consents WHERE user_id = ?`
    ).bind(userId).all()
    return new Response(JSON.stringify({ consents: rows.results || [] }), { status: 200, headers: JSON_HEADERS })
  } catch {
    return new Response(JSON.stringify({ error: 'Failed to read consents' }), { status: 500, headers: JSON_HEADERS })
  }
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const userId = await getUserFromRequest(context.request, context.env)
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401, headers: JSON_HEADERS })
  }
  let body: any = {}
  try { body = await context.request.json() } catch { /* empty body */ }
  const consentType = String(body?.consent_type || '')
  if (!ALLOWED_CONSENT_TYPES.includes(consentType)) {
    return new Response(JSON.stringify({ error: 'Unknown consent_type' }), { status: 400, headers: JSON_HEADERS })
  }
  try {
    await context.env.DB.prepare(
      `INSERT INTO user_consents (user_id, consent_type, version, accepted_at)
       VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(user_id, consent_type) DO UPDATE SET version = excluded.version, accepted_at = datetime('now')`
    ).bind(userId, consentType, SENSITIVE_AI_CONSENT_VERSION).run()
    return new Response(JSON.stringify({ success: true, consent_type: consentType, version: SENSITIVE_AI_CONSENT_VERSION }), {
      status: 200, headers: JSON_HEADERS,
    })
  } catch {
    return new Response(JSON.stringify({ error: 'Failed to record consent' }), { status: 500, headers: JSON_HEADERS })
  }
}
