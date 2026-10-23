/**
 * A JSON GET to one of a few named third-party hosts.
 *
 * Used by the webcam discovery code (Windy, Nominatim). The URL is built by our
 * code, never taken from a caller, and is still checked:
 *   - https on the default port, with an exact hostname from the caller's allow-list;
 *   - `redirect: 'manual'`: any 3xx is an error, never followed;
 *   - a timeout, and a byte cap enforced while reading the body.
 */

export type OutboundFailure = 'host' | 'timeout' | 'redirect' | 'http' | 'too_large' | 'bad_json' | 'network'

export type OutboundResult<T = unknown> =
  | { ok: true; status: number; data: T; reason?: undefined }
  | { ok: false; status: number | null; reason: OutboundFailure; data?: undefined }

export interface OutboundOptions {
  allowedHosts: ReadonlySet<string>
  headers?: Record<string, string>
  timeoutMs?: number
  maxBytes?: number
}

const DEFAULT_TIMEOUT_MS = 8_000
const DEFAULT_MAX_BYTES = 512 * 1024

async function readCapped(response: Response, maxBytes: number): Promise<string | null> {
  const body = response.body
  if (!body) return ''
  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > maxBytes) {
      await reader.cancel().catch(() => {})
      return null
    }
    chunks.push(value)
  }
  const all = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    all.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder().decode(all)
}

export async function getOutboundJson<T = unknown>(rawUrl: string, options: OutboundOptions): Promise<OutboundResult<T>> {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return { ok: false, status: null, reason: 'host' }
  }
  if (url.protocol !== 'https:' || url.port || url.username || url.password || !options.allowedHosts.has(url.hostname)) {
    return { ok: false, status: null, reason: 'host' }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS)
  try {
    const response = await fetch(url.href, {
      method: 'GET',
      headers: { Accept: 'application/json', ...(options.headers ?? {}) },
      redirect: 'manual',
      signal: controller.signal,
    })
    // A manual redirect surfaces as a 3xx (Workers) or an opaque status-0 response (browsers).
    if ((response.type as string) === 'opaqueredirect' || (response.status >= 300 && response.status < 400)) {
      await response.body?.cancel().catch(() => {})
      return { ok: false, status: response.status || null, reason: 'redirect' }
    }
    if (!response.ok) {
      await response.body?.cancel().catch(() => {})
      return { ok: false, status: response.status, reason: 'http' }
    }
    const text = await readCapped(response, options.maxBytes ?? DEFAULT_MAX_BYTES)
    if (text === null) return { ok: false, status: response.status, reason: 'too_large' }
    try {
      return { ok: true, status: response.status, data: JSON.parse(text) as T }
    } catch {
      return { ok: false, status: response.status, reason: 'bad_json' }
    }
  } catch (error) {
    const aborted = controller.signal.aborted || (error instanceof Error && error.name === 'AbortError')
    return { ok: false, status: null, reason: aborted ? 'timeout' : 'network' }
  } finally {
    clearTimeout(timer)
  }
}
