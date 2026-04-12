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
  'Access-Control-Allow-Origin': 'https://researchtools.net',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash, X-Workspace-ID',
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

/** Block requests to private/internal IP ranges (SSRF protection) */
export function isPrivateUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString)
    const hostname = url.hostname

    // Block private IP ranges
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') return true
    if (hostname.startsWith('10.')) return true
    if (hostname.startsWith('192.168.')) return true
    if (hostname.startsWith('169.254.')) return true
    if (hostname === '0.0.0.0') return true

    // Block 172.16.0.0 - 172.31.255.255
    const parts = hostname.split('.')
    if (parts[0] === '172') {
      const second = parseInt(parts[1], 10)
      if (second >= 16 && second <= 31) return true
    }

    // Block metadata endpoints
    if (hostname === 'metadata.google.internal') return true
    if (hostname === '169.254.169.254') return true

    return false
  } catch {
    return true // Invalid URL = block
  }
}
