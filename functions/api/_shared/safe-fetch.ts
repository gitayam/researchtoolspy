/**
 * Policy-enforced outbound HTTP fetches for caller-controlled scraping URLs.
 *
 * The policy is deliberately strict: only public HTTP(S) destinations on their
 * default ports are accepted, DNS answers and every redirect hop are checked,
 * and response bodies are read through an explicit byte/content-type budget.
 */

export type SafeFetchErrorCode =
  | 'invalid_url'
  | 'unsafe_url'
  | 'dns_resolution_failed'
  | 'redirect_limit'
  | 'timeout'
  | 'response_too_large'
  | 'unsupported_content_type'
  | 'network_error'

export class SafeFetchError extends Error {
  constructor(
    public readonly code: SafeFetchErrorCode,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options)
    this.name = 'SafeFetchError'
  }
}

export type HostnameResolver = (hostname: string, signal: AbortSignal) => Promise<string[]>

export interface SafeFetchOptions {
  requestInit?: RequestInit
  timeoutMs?: number
  maxRedirects?: number
  maxResponseBytes?: number
  allowedContentTypes?: readonly string[]
  fetchImpl?: typeof fetch
  resolveHostname?: HostnameResolver
}

export interface SafeFetchTextResult {
  response: Response
  text: string
  finalUrl: string
  redirects: string[]
  bytesRead: number
  contentType: string
}

const DEFAULT_TIMEOUT_MS = 15_000
const DEFAULT_MAX_REDIRECTS = 5
const DEFAULT_MAX_RESPONSE_BYTES = 2 * 1024 * 1024
const DEFAULT_ALLOWED_CONTENT_TYPES = [
  'text/',
  'application/xhtml+xml',
  'application/xml',
  'application/json',
] as const

const BLOCKED_HOST_SUFFIXES = [
  '.internal',
  '.invalid',
  '.lan',
  '.local',
  '.localhost',
  '.test',
] as const

const BLOCKED_HOSTS = new Set([
  'localhost',
  'metadata.google.internal',
  'metadata.google.internal.',
])

function parseIpv4(value: string): number[] | null {
  const parts = value.split('.')
  if (parts.length !== 4) return null
  const octets = parts.map(part => Number(part))
  return octets.every(octet => Number.isInteger(octet) && octet >= 0 && octet <= 255)
    ? octets
    : null
}

function isUnsafeIpv4(octets: number[]): boolean {
  const [a, b, c] = octets
  return a === 0
    || a === 10
    || a === 127
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 0 && c === 0)
    || (a === 192 && b === 0 && c === 2)
    || (a === 192 && b === 88 && c === 99)
    || (a === 192 && b === 168)
    || (a === 198 && (b === 18 || b === 19))
    || (a === 198 && b === 51 && c === 100)
    || (a === 203 && b === 0 && c === 113)
    || a >= 224
}

function parseIpv6(value: string): number[] | null {
  const raw = value.startsWith('[') && value.endsWith(']') ? value.slice(1, -1) : value
  if (!raw.includes(':')) return null

  const halves = raw.split('::')
  if (halves.length > 2) return null
  const left = halves[0] ? halves[0].split(':') : []
  const right = halves.length === 2 && halves[1] ? halves[1].split(':') : []
  const omitted = 8 - left.length - right.length
  if ((halves.length === 1 && omitted !== 0) || omitted < 0) return null

  const parts = halves.length === 2
    ? [...left, ...Array(omitted).fill('0'), ...right]
    : left
  if (parts.length !== 8 || !parts.every(part => /^[0-9a-f]{1,4}$/i.test(part))) return null
  return parts.map(part => Number.parseInt(part, 16))
}

function isUnsafeIpv6(parts: number[]): boolean {
  const allZero = parts.every(part => part === 0)
  const loopback = parts.slice(0, 7).every(part => part === 0) && parts[7] === 1
  const uniqueLocal = (parts[0] & 0xfe00) === 0xfc00
  const linkLocal = (parts[0] & 0xffc0) === 0xfe80
  const multicast = (parts[0] & 0xff00) === 0xff00
  const documentation = parts[0] === 0x2001 && parts[1] === 0x0db8
  const ipv4Mapped = parts.slice(0, 5).every(part => part === 0) && parts[5] === 0xffff

  if (ipv4Mapped) {
    return isUnsafeIpv4([
      parts[6] >> 8,
      parts[6] & 0xff,
      parts[7] >> 8,
      parts[7] & 0xff,
    ])
  }
  return allZero || loopback || uniqueLocal || linkLocal || multicast || documentation
}

/** True for private, reserved, link-local, metadata, or syntactically invalid addresses. */
export function isUnsafeAddress(address: string): boolean {
  const ipv4 = parseIpv4(address)
  if (ipv4) return isUnsafeIpv4(ipv4)
  const ipv6 = parseIpv6(address)
  if (ipv6) return isUnsafeIpv6(ipv6)
  return true
}

/**
 * Parse and perform the synchronous portion of outbound URL policy validation.
 * DNS-backed host validation is performed by assertSafeOutboundUrl.
 */
export function parseSafeOutboundUrl(input: string | URL): URL {
  let url: URL
  try {
    url = input instanceof URL ? new URL(input.href) : new URL(input)
  } catch (error) {
    throw new SafeFetchError('invalid_url', 'Invalid URL', { cause: error })
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new SafeFetchError('unsafe_url', 'Only HTTP and HTTPS URLs are allowed')
  }
  if (url.username || url.password) {
    throw new SafeFetchError('unsafe_url', 'URLs containing credentials are not allowed')
  }
  if ((url.protocol === 'http:' && url.port && url.port !== '80')
    || (url.protocol === 'https:' && url.port && url.port !== '443')) {
    throw new SafeFetchError('unsafe_url', 'Only default HTTP and HTTPS ports are allowed')
  }

  const hostname = url.hostname.toLowerCase().replace(/\.$/, '')
  if (!hostname
    || BLOCKED_HOSTS.has(hostname)
    || BLOCKED_HOST_SUFFIXES.some(suffix => hostname.endsWith(suffix))) {
    throw new SafeFetchError('unsafe_url', 'Private or internal hostnames are not allowed')
  }

  const addressCandidate = hostname.startsWith('[') ? hostname.slice(1, -1) : hostname
  if ((parseIpv4(addressCandidate) || parseIpv6(addressCandidate)) && isUnsafeAddress(addressCandidate)) {
    throw new SafeFetchError('unsafe_url', 'Private or reserved addresses are not allowed')
  }
  return url
}

async function resolveDnsJson(hostname: string, type: 'A' | 'AAAA', signal: AbortSignal): Promise<string[]> {
  const endpoint = new URL('https://cloudflare-dns.com/dns-query')
  endpoint.searchParams.set('name', hostname)
  endpoint.searchParams.set('type', type)
  const response = await fetch(endpoint, {
    headers: { Accept: 'application/dns-json' },
    redirect: 'error',
    signal,
  })
  if (!response.ok) throw new Error(`DNS query failed with HTTP ${response.status}`)
  const data = await response.json() as {
    Status?: number
    Answer?: Array<{ type?: number; data?: string }>
  }
  if (data.Status !== 0) return []
  const expectedType = type === 'A' ? 1 : 28
  return (data.Answer || [])
    .filter(answer => answer.type === expectedType && typeof answer.data === 'string')
    .map(answer => answer.data as string)
}

export const resolvePublicHostname: HostnameResolver = async (hostname, signal) => {
  const results = await Promise.allSettled([
    resolveDnsJson(hostname, 'A', signal),
    resolveDnsJson(hostname, 'AAAA', signal),
  ])
  const addresses = results.flatMap(result => result.status === 'fulfilled' ? result.value : [])
  if (addresses.length === 0) throw new Error('Hostname did not resolve to an address')
  return [...new Set(addresses)]
}

/** Validate URL syntax, hostname policy, and all resolved addresses. */
export async function assertSafeOutboundUrl(
  input: string | URL,
  signal: AbortSignal,
  resolver: HostnameResolver = resolvePublicHostname,
): Promise<URL> {
  const url = parseSafeOutboundUrl(input)
  const normalizedHostname = url.hostname.toLowerCase().replace(/\.$/, '')
  const hostname = normalizedHostname.startsWith('[') && normalizedHostname.endsWith(']')
    ? normalizedHostname.slice(1, -1)
    : normalizedHostname
  if (parseIpv4(hostname) || parseIpv6(hostname)) return url

  let addresses: string[]
  try {
    addresses = await resolver(hostname, signal)
  } catch (error) {
    if (signal.aborted) throw error
    throw new SafeFetchError('dns_resolution_failed', 'Unable to safely resolve the destination hostname', { cause: error })
  }
  if (addresses.length === 0 || addresses.some(isUnsafeAddress)) {
    throw new SafeFetchError('unsafe_url', 'Destination resolves to a private or reserved address')
  }
  return url
}

function isRedirectStatus(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308
}

function isAllowedContentType(value: string, allowed: readonly string[]): boolean {
  const mime = value.split(';', 1)[0].trim().toLowerCase()
  return Boolean(mime) && allowed.some(entry => entry.endsWith('/') ? mime.startsWith(entry) : mime === entry)
}

async function readBoundedText(response: Response, maxBytes: number): Promise<{ text: string; bytesRead: number }> {
  const declaredLength = Number(response.headers.get('content-length'))
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new SafeFetchError('response_too_large', `Response exceeds the ${maxBytes}-byte limit`)
  }

  if (!response.body) return { text: '', bytesRead: 0 }
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let text = ''
  let bytesRead = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      bytesRead += value.byteLength
      if (bytesRead > maxBytes) {
        await reader.cancel('response size limit exceeded')
        throw new SafeFetchError('response_too_large', `Response exceeds the ${maxBytes}-byte limit`)
      }
      text += decoder.decode(value, { stream: true })
    }
    text += decoder.decode()
    return { text, bytesRead }
  } finally {
    reader.releaseLock()
  }
}

/**
 * Fetch and read text under the shared outbound policy.
 * Redirects are never delegated to the runtime; every Location is resolved and
 * revalidated before the next request.
 */
export async function safeFetchText(
  input: string | URL,
  options: SafeFetchOptions = {},
): Promise<SafeFetchTextResult> {
  const {
    requestInit = {},
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxRedirects = DEFAULT_MAX_REDIRECTS,
    maxResponseBytes = DEFAULT_MAX_RESPONSE_BYTES,
    allowedContentTypes = DEFAULT_ALLOWED_CONTENT_TYPES,
    fetchImpl = fetch,
    resolveHostname = resolvePublicHostname,
  } = options
  if (timeoutMs <= 0 || maxRedirects < 0 || maxResponseBytes <= 0) {
    throw new SafeFetchError('invalid_url', 'Safe fetch limits must be positive')
  }

  const controller = new AbortController()
  const callerSignal = requestInit.signal
  const abortFromCaller = () => controller.abort(callerSignal?.reason)
  if (callerSignal?.aborted) abortFromCaller()
  else callerSignal?.addEventListener('abort', abortFromCaller, { once: true })
  const timeoutId = setTimeout(() => controller.abort(new Error('safe fetch timeout')), timeoutMs)

  const redirects: string[] = []
  let current: string | URL = input
  try {
    for (let redirectCount = 0; ; redirectCount += 1) {
      let url: URL
      try {
        url = await assertSafeOutboundUrl(current, controller.signal, resolveHostname)
      } catch (error) {
        if (controller.signal.aborted) {
          throw new SafeFetchError('timeout', 'Outbound request timed out', { cause: error })
        }
        throw error
      }

      let response: Response
      try {
        response = await fetchImpl(url, {
          ...requestInit,
          redirect: 'manual',
          signal: controller.signal,
        })
      } catch (error) {
        if (controller.signal.aborted) {
          throw new SafeFetchError('timeout', 'Outbound request timed out', { cause: error })
        }
        throw new SafeFetchError('network_error', 'Outbound request failed', { cause: error })
      }

      if (isRedirectStatus(response.status)) {
        if (redirectCount >= maxRedirects) {
          response.body?.cancel().catch(() => undefined)
          throw new SafeFetchError('redirect_limit', `Redirect limit of ${maxRedirects} exceeded`)
        }
        const location = response.headers.get('location')
        if (!location) return {
          response,
          text: '',
          finalUrl: url.href,
          redirects,
          bytesRead: 0,
          contentType: '',
        }
        let nextUrl: URL
        try {
          nextUrl = new URL(location, url)
        } catch (error) {
          throw new SafeFetchError('invalid_url', 'Redirect destination is not a valid URL', { cause: error })
        }
        redirects.push(nextUrl.href)
        response.body?.cancel().catch(() => undefined)
        current = nextUrl
        continue
      }

      const contentType = response.headers.get('content-type') || ''
      if (response.ok && !isAllowedContentType(contentType, allowedContentTypes)) {
        response.body?.cancel().catch(() => undefined)
        throw new SafeFetchError('unsupported_content_type', 'Destination returned an unsupported content type')
      }
      const { text, bytesRead } = await readBoundedText(response, maxResponseBytes)
      return { response, text, finalUrl: url.href, redirects, bytesRead, contentType }
    }
  } catch (error) {
    if (error instanceof SafeFetchError) throw error
    if (controller.signal.aborted) {
      throw new SafeFetchError('timeout', 'Outbound request timed out', { cause: error })
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
    callerSignal?.removeEventListener('abort', abortFromCaller)
  }
}
