/**
 * Shared error response utility
 *
 * Returns a generic error message to the client while logging the real error server-side.
 * Prevents leaking internal details (table names, query syntax, stack traces) to clients.
 */

const DEFAULT_CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash, X-Workspace-ID',
}

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
    { status, headers: headers || DEFAULT_CORS },
  )
}
