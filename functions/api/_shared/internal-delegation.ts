const FORWARDED_AUTH_HEADERS = ['Authorization', 'X-User-Hash', 'X-Guest-Session', 'X-Workspace-ID'] as const

/**
 * Build headers for a fixed, same-origin API delegation. Only the authentication
 * and workspace context understood by our Functions is forwarded.
 */
export function internalJsonHeaders(request: Request): Headers {
  const headers = new Headers({ 'Content-Type': 'application/json' })
  for (const name of FORWARDED_AUTH_HEADERS) {
    const value = request.headers.get(name)
    if (value !== null) headers.set(name, value)
  }
  return headers
}

/** Resolve a compile-time API path against the caller's own origin. */
export function internalApiUrl(request: Request, path: `/api/${string}`): string {
  const origin = new URL(request.url).origin
  return new URL(path, origin).href
}
