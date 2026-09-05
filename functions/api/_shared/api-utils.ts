/**
 * Shared API Utilities
 *
 * Common helpers used across all API endpoints: ID generation, CORS headers,
 * and JSON response helpers.
 */

import { parseSafeOutboundUrl } from './safe-fetch'

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
  'Access-Control-Allow-Origin': 'https://researchtools.net',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash, X-Guest-Session, X-Workspace-ID',
} as const

/** CORS headers with JSON Content-Type (most common response pattern) */
export const JSON_HEADERS = {
  ...CORS_HEADERS,
  'Content-Type': 'application/json',
  'X-Content-Type-Options': 'nosniff',
} as const

/** Safe JSON.parse — returns fallback on malformed data instead of throwing */
export function safeJsonParse(value: any, fallback: any = null): any {
  if (!value) return fallback
  try { return JSON.parse(value) } catch { return fallback }
}

/** Return a preflight (OPTIONS) response */
export function optionsResponse(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

/**
 * Synchronous URL policy check retained for callers that only need a guard.
 * Fetching code must use safeFetchText so DNS answers and redirects are checked.
 */
export function isPrivateUrl(urlString: string): boolean {
  try {
    parseSafeOutboundUrl(urlString)
    return false
  } catch {
    return true
  }
}
