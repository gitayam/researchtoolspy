/**
 * Shared API Utilities
 *
 * Common helpers used across all API endpoints: ID generation, CORS headers,
 * and JSON response helpers.
 */

/** Generate a UUID v4 identifier */
export function generateId(): string {
  return crypto.randomUUID()
}

/** Generate a prefixed short ID (e.g. "rfi-a1b2c3d4e5f6") used by COP entities */
export function generatePrefixedId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 12)}`
}

/** Standard CORS headers for all API endpoints */
export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash',
} as const

/** CORS headers with JSON Content-Type (most common response pattern) */
export const JSON_HEADERS = {
  ...CORS_HEADERS,
  'Content-Type': 'application/json',
} as const

/** Return a preflight (OPTIONS) response */
export function optionsResponse(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}
