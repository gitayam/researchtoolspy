/**
 * Sensitive-use consent gate (Tier-1 endpoints).
 *
 * Person/entity profiling, relationship inference, and arbitrary generation require
 * an affirmative, recorded acknowledgement of lawful/authorized use before running.
 * This is the enforceable backstop; the frontend shows a one-time dialog on the
 * `consent_required` response and POSTs /api/user/consent to record acceptance.
 *
 * Fail-open on DB error (never break a feature because the consent lookup glitched);
 * gate only fires on a clean "no consent on record".
 */

import { JSON_HEADERS } from './api-utils'

export const SENSITIVE_AI_CONSENT = 'sensitive_ai'
export const SENSITIVE_AI_CONSENT_VERSION = 1
export const ALLOWED_CONSENT_TYPES = [SENSITIVE_AI_CONSENT]

interface ConsentEnv {
  DB: any // D1Database
}

/**
 * Returns null when the user has the required consent on record (proceed), or a
 * 403 Response with `code: 'consent_required'` when they don't. Pass the userId the
 * handler already resolved for auth — a null userId returns null (the handler's own
 * auth, e.g. 401, is the gate for that case).
 */
export async function requireConsent(
  env: ConsentEnv,
  userId: number | null | undefined,
  consentType: string = SENSITIVE_AI_CONSENT,
  version: number = SENSITIVE_AI_CONSENT_VERSION
): Promise<Response | null> {
  if (!userId) return null
  try {
    const row = await env.DB.prepare(
      `SELECT version FROM user_consents WHERE user_id = ? AND consent_type = ?`
    ).bind(userId, consentType).first<{ version: number }>()
    if (row && Number(row.version) >= version) return null // consented
  } catch {
    return null // fail-open on DB error — don't break the feature
  }
  return new Response(JSON.stringify({
    error: 'This feature requires acknowledging the authorized-use terms.',
    code: 'consent_required',
    consent_type: consentType,
    version,
  }), { status: 403, headers: JSON_HEADERS })
}
