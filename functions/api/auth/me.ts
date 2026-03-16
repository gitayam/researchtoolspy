/**
 * GET /api/auth/me
 *
 * Returns the current authenticated user's profile from D1.
 * Used by the frontend checkAuth() to restore session state on page refresh.
 */

import { getUserFromRequest } from '../_shared/auth-helpers'
import { JSON_HEADERS, optionsResponse } from '../_shared/api-utils'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
  JWT_SECRET?: string
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  const userId = await getUserFromRequest(request, env)
  if (!userId) {
    return Response.json(
      { error: 'Not authenticated' },
      { status: 401, headers: JSON_HEADERS }
    )
  }

  const user = await env.DB.prepare(
    'SELECT id, username, email, full_name, role, is_active, is_verified, created_at, updated_at FROM users WHERE id = ?'
  ).bind(userId).first()

  if (!user) {
    return Response.json(
      { error: 'User not found' },
      { status: 404, headers: JSON_HEADERS }
    )
  }

  return Response.json(user, { headers: JSON_HEADERS })
}

/** OPTIONS /api/auth/me -- CORS preflight */
export const onRequestOptions: PagesFunction<Env> = async () => {
  return optionsResponse()
}
