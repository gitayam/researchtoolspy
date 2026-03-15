/**
 * Shared error response utility
 *
 * Returns a generic error message to the client while logging the real error server-side.
 * Prevents leaking internal details (table names, query syntax, stack traces) to clients.
 */

import { JSON_HEADERS } from './api-utils'

export function errorResponse(
  context: string,
  error: unknown,
  status = 500,
  publicMessage?: string,
  headers?: Record<string, string>,
): Response {
  console.error(`[${context}]`, error)
  return new Response(
    JSON.stringify({ error: publicMessage || 'Internal server error' }),
    { status, headers: headers || JSON_HEADERS },
  )
}
