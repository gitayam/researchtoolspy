/**
 * Policy-enforced outbound HTTP fetches for caller-controlled scraping URLs.
 *
 * The policy is deliberately strict: only public HTTP(S) destinations on their
 * default ports are accepted, DNS answers and every redirect hop are checked,
 * and response bodies are read through an explicit byte/content-type budget.
 *
 * DNS validation alone cannot pin the address used by the subsequent platform
 * fetch. Closing that DNS-resolution-to-connection TOCTOU requires an enforcing
 * egress proxy/boundary that resolves, connects, and validates in one place.
 */

export const SAFE_FETCH_ERROR_CODES = [
  'invalid_url',
  'unsafe_url',
  'dns_resolution_failed',
  'unsafe_method',
  'unsafe_headers',
  'invalid_options',
  'redirect_limit',
  'timeout',
  'aborted',
  'response_too_large',
  'unsupported_content_type',
  'network_error',
] as const

export type SafeFetchErrorCode = typeof SAFE_FETCH_ERROR_CODES[number]

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
  /** Exact normalized hostnames permitted for the initial URL and every redirect. */
  allowedHostnames?: readonly string[]
  fetchImpl?: typeof fetch
  resolveHostname?: HostnameResolver
}

export interface SafeFetchResult {
  response: Response
  finalUrl: string
  redirects: string[]
  bytesRead: number
  contentType: string
}

export interface SafeFetchTextResult extends SafeFetchResult {
  text: string
}

export interface SafeFetchBytesResult extends SafeFetchResult {
  bytes: Uint8Array
}

export type SafeFetchHeadResult = SafeFetchResult

const DEFAULT_TIMEOUT_MS = 15_000
const DEFAULT_MAX_REDIRECTS = 5
const DEFAULT_MAX_RESPONSE_BYTES = 2 * 1024 * 1024
const MAX_TIMEOUT_MS = 60_000
const MAX_REDIRECTS = 10
const MAX_RESPONSE_BYTES = 10 * 1024 * 1024
const DEFAULT_ALLOWED_CONTENT_TYPES = [
  'text/',
  'application/xhtml+xml',
  'application/xml',
  'application/json',
] as const
const DEFAULT_ALLOWED_BINARY_CONTENT_TYPES = ['application/octet-stream'] as const

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

const SENSITIVE_HEADERS = new Set([
  'authorization',
  'cookie',
  'cookie2',
  'proxy-authorization',
  'x-api-key',
])

const STRIPPED_HEADERS = new Set([
  'connection',
  'content-length',
  'host',
  'keep-alive',
  'proxy-connection',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
])

const CROSS_ORIGIN_HEADERS = new Set(['origin', 'referer'])

const SAFE_REQUEST_HEADERS = new Set([
  'accept',
  'accept-encoding',
  'accept-language',
  'cache-control',
  'dnt',
  'origin',
  'pragma',
  'referer',
  'sec-ch-ua',
  'sec-ch-ua-mobile',
  'sec-ch-ua-platform',
  'sec-fetch-dest',
  'sec-fetch-mode',
  'sec-fetch-site',
  'sec-fetch-user',
  'upgrade-insecure-requests',
  'user-agent',
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
    || (a === 192 && b === 31 && c === 196)
    || (a === 192 && b === 52 && c === 193)
    || (a === 192 && b === 88 && c === 99)
    || (a === 192 && b === 168)
    || (a === 192 && b === 175 && c === 48)
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
  // Fail closed: native public IPv6 destinations must be global unicast
  // (2000::/3), then known special-purpose subranges are removed below.
  const globalUnicast = (parts[0] & 0xe000) === 0x2000
  const ietfSpecial = parts[0] === 0x2001 && parts[1] <= 0x01ff
  const documentation = (parts[0] === 0x2001 && parts[1] === 0x0db8)
    || (parts[0] === 0x3fff && (parts[1] & 0xf000) === 0)
  const sixToFour = parts[0] === 0x2002

  // This also denies IPv4-compatible, IPv4-mapped/translated, NAT64, discard,
  // link/site-local, unique-local, and multicast forms because none are 2000::/3.
  return !globalUnicast
    || ietfSpecial
    || documentation
    || sixToFour
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

function validateIntegerLimit(name: string, value: number, minimum: number, maximum: number): void {
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < minimum || value > maximum) {
    throw new SafeFetchError(
      'invalid_options',
      `${name} must be an integer between ${minimum} and ${maximum}`,
    )
  }
}

function normalizedHostname(url: URL): string {
  return url.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '')
}

function normalizeAllowedHostnames(values: readonly string[] | undefined): Set<string> | null {
  if (values === undefined) return null
  if (!Array.isArray(values) || values.length === 0) {
    throw new SafeFetchError('invalid_options', 'allowedHostnames must contain at least one exact hostname')
  }

  const normalized = new Set<string>()
  for (const value of values) {
    if (typeof value !== 'string' || !value.trim()) {
      throw new SafeFetchError('invalid_options', 'allowedHostnames must contain only exact hostnames')
    }
    try {
      const candidate = value.trim().replace(/\.$/, '')
      if (candidate.includes('*')) throw new Error('wildcards are not exact hostnames')
      const parsed = new URL(`https://${candidate}`)
      if (parsed.username || parsed.password || parsed.port || parsed.pathname !== '/'
        || parsed.search || parsed.hash || !parsed.hostname) {
        throw new Error('not an exact hostname')
      }
      normalized.add(normalizedHostname(parsed))
    } catch (error) {
      throw new SafeFetchError('invalid_options', `Invalid allowed hostname: ${value}`, { cause: error })
    }
  }
  return normalized
}

function assertAllowedHostname(url: URL, allowedHostnames: Set<string> | null): void {
  if (allowedHostnames && !allowedHostnames.has(normalizedHostname(url))) {
    throw new SafeFetchError('unsafe_url', 'Destination hostname is not allowed by this outbound policy')
  }
}

function sanitizeRequestInit(requestInit: RequestInit): { init: RequestInit; headers: Headers } {
  if (requestInit.method !== undefined && typeof requestInit.method !== 'string') {
    throw new SafeFetchError('unsafe_method', 'Outbound request method must be a string')
  }
  const method = (requestInit.method || 'GET').toUpperCase()
  if (method !== 'GET' && method !== 'HEAD') {
    throw new SafeFetchError('unsafe_method', 'Outbound scraping requests must use GET or HEAD')
  }
  if (requestInit.body != null) {
    throw new SafeFetchError('unsafe_method', 'Outbound GET and HEAD requests cannot include a body')
  }

  let headers: Headers
  try {
    headers = new Headers(requestInit.headers)
  } catch (error) {
    throw new SafeFetchError('unsafe_headers', 'Outbound request headers are invalid', { cause: error })
  }
  for (const name of SENSITIVE_HEADERS) {
    if (headers.has(name)) {
      throw new SafeFetchError('unsafe_headers', `Sensitive outbound header is not allowed: ${name}`)
    }
  }
  for (const name of STRIPPED_HEADERS) headers.delete(name)
  for (const [name] of [...headers]) {
    if (!SAFE_REQUEST_HEADERS.has(name)) headers.delete(name)
  }

  return {
    headers,
    init: {
      headers,
      method,
      redirect: 'manual',
    },
  }
}

function headersForRedirect(headers: Headers, previous: URL, next: URL): Headers {
  const redirectedHeaders = new Headers(headers)
  if (previous.origin !== next.origin) {
    for (const name of CROSS_ORIGIN_HEADERS) redirectedHeaders.delete(name)
  }
  return redirectedHeaders
}

async function cancelResponseBody(response: Response, reason: string): Promise<void> {
  if (!response.body) return
  try {
    await response.body.cancel(reason)
  } catch {
    // The policy rejection takes precedence over transport cleanup failures.
  }
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
  if (!response.ok) {
    await cancelResponseBody(response, 'DNS query rejected')
    throw new Error(`DNS query failed with HTTP ${response.status}`)
  }
  const data = await response.json() as {
    Status?: number
    Answer?: Array<{ type?: number; data?: string }>
  }
  if (data.Status !== 0) throw new Error(`DNS ${type} query returned status ${data.Status ?? 'unknown'}`)
  const expectedType = type === 'A' ? 1 : 28
  return (data.Answer || [])
    .filter(answer => answer.type === expectedType && typeof answer.data === 'string')
    .map(answer => answer.data as string)
}

export const resolvePublicHostname: HostnameResolver = async (hostname, signal) => {
  const results = await Promise.all([
    resolveDnsJson(hostname, 'A', signal),
    resolveDnsJson(hostname, 'AAAA', signal),
  ])
  const addresses = results.flat()
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
  return Boolean(mime) && allowed.some(value => {
    const entry = value.toLowerCase()
    return entry.endsWith('/') ? mime.startsWith(entry) : mime === entry
  })
}

async function readBoundedText(response: Response, maxBytes: number): Promise<{ text: string; bytesRead: number }> {
  const contentLength = response.headers.get('content-length')
  const declaredLength = contentLength === null ? null : Number(contentLength)
  if (declaredLength !== null && Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    await cancelResponseBody(response, 'declared response size limit exceeded')
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
  } catch (error) {
    try {
      await reader.cancel('response body read failed')
    } catch {
      // Preserve the read/policy failure after awaiting cleanup.
    }
    throw error
  } finally {
    reader.releaseLock()
  }
}

async function readBoundedBytes(response: Response, maxBytes: number): Promise<{ bytes: Uint8Array; bytesRead: number }> {
  const contentLength = response.headers.get('content-length')
  const declaredLength = contentLength === null ? null : Number(contentLength)
  if (declaredLength !== null && Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    await cancelResponseBody(response, 'declared response size limit exceeded')
    throw new SafeFetchError('response_too_large', `Response exceeds the ${maxBytes}-byte limit`)
  }

  if (!response.body) return { bytes: new Uint8Array(), bytesRead: 0 }
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
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
      chunks.push(value)
    }

    const bytes = new Uint8Array(bytesRead)
    let offset = 0
    for (const chunk of chunks) {
      bytes.set(chunk, offset)
      offset += chunk.byteLength
    }
    return { bytes, bytesRead }
  } catch (error) {
    try {
      await reader.cancel('response body read failed')
    } catch {
      // Preserve the read/policy failure after awaiting cleanup.
    }
    throw error
  } finally {
    reader.releaseLock()
  }
}

interface BodyReadResult<T> {
  value: T
  bytesRead: number
}

interface SharedFetchPolicy<T> {
  method?: 'GET' | 'HEAD'
  defaultMaxResponseBytes: number
  defaultAllowedContentTypes: readonly string[]
  skipContentTypeCheck?: boolean
  read(response: Response, maxBytes: number): Promise<BodyReadResult<T>>
}

interface SharedFetchResult<T> extends SafeFetchResult {
  value: T
}

function validateAllowedContentTypes(values: readonly string[]): void {
  if (!Array.isArray(values)
    || values.length === 0
    || values.some(value => typeof value !== 'string' || value.trim() === '')) {
    throw new SafeFetchError('invalid_options', 'allowedContentTypes must contain at least one MIME type')
  }
}

async function safeFetchWithPolicy<T>(
  input: string | URL,
  options: SafeFetchOptions,
  policy: SharedFetchPolicy<T>,
): Promise<SharedFetchResult<T>> {
  const {
    requestInit = {},
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxRedirects = DEFAULT_MAX_REDIRECTS,
    maxResponseBytes = policy.defaultMaxResponseBytes,
    allowedContentTypes = policy.defaultAllowedContentTypes,
    allowedHostnames,
    fetchImpl = fetch,
    resolveHostname = resolvePublicHostname,
  } = options
  validateIntegerLimit('timeoutMs', timeoutMs, 1, MAX_TIMEOUT_MS)
  validateIntegerLimit('maxRedirects', maxRedirects, 0, MAX_REDIRECTS)
  validateIntegerLimit('maxResponseBytes', maxResponseBytes, 1, MAX_RESPONSE_BYTES)
  if (!policy.skipContentTypeCheck) validateAllowedContentTypes(allowedContentTypes)
  const normalizedAllowedHostnames = normalizeAllowedHostnames(allowedHostnames)

  const requestedMethod = typeof requestInit.method === 'string'
    ? requestInit.method.toUpperCase()
    : requestInit.method
  if (policy.method && requestedMethod && requestedMethod !== policy.method) {
    throw new SafeFetchError('unsafe_method', `This outbound adapter requires ${policy.method}`)
  }
  const callerSignal = requestInit.signal
  const sanitized = sanitizeRequestInit({ ...requestInit, method: policy.method || requestInit.method })
  const controller = new AbortController()
  let abortSource: 'caller' | 'timeout' | null = null
  const abortFromCaller = () => {
    if (abortSource) return
    abortSource = 'caller'
    controller.abort(callerSignal?.reason)
  }
  if (callerSignal?.aborted) abortFromCaller()
  else callerSignal?.addEventListener('abort', abortFromCaller, { once: true })
  const timeoutId = setTimeout(() => {
    if (abortSource) return
    abortSource = 'timeout'
    controller.abort(new Error('safe fetch timeout'))
  }, timeoutMs)

  const abortError = (cause: unknown): SafeFetchError => abortSource === 'caller'
    ? new SafeFetchError('aborted', 'Outbound request was aborted by the caller', { cause })
    : new SafeFetchError('timeout', 'Outbound request timed out', { cause })

  const redirects: string[] = []
  let current: string | URL = input
  let outboundHeaders = sanitized.headers
  try {
    for (let redirectCount = 0; ; redirectCount += 1) {
      let url: URL
      try {
        const parsed = parseSafeOutboundUrl(current)
        assertAllowedHostname(parsed, normalizedAllowedHostnames)
        url = await assertSafeOutboundUrl(parsed, controller.signal, resolveHostname)
      } catch (error) {
        if (controller.signal.aborted) throw abortError(error)
        throw error
      }

      let response: Response
      try {
        response = await fetchImpl(url, {
          ...sanitized.init,
          headers: outboundHeaders,
          signal: controller.signal,
        })
      } catch (error) {
        if (controller.signal.aborted) throw abortError(error)
        throw new SafeFetchError('network_error', 'Outbound request failed', { cause: error })
      }

      if (isRedirectStatus(response.status)) {
        const location = response.headers.get('location')
        if (location) {
          if (redirectCount >= maxRedirects) {
            await cancelResponseBody(response, 'redirect limit exceeded')
            throw new SafeFetchError('redirect_limit', `Redirect limit of ${maxRedirects} exceeded`)
          }
          let nextUrl: URL
          try {
            nextUrl = new URL(location, url)
            const parsedNext = parseSafeOutboundUrl(nextUrl)
            assertAllowedHostname(parsedNext, normalizedAllowedHostnames)
          } catch (error) {
            await cancelResponseBody(response, 'invalid or disallowed redirect destination')
            if (error instanceof SafeFetchError) throw error
            throw new SafeFetchError('invalid_url', 'Redirect destination is not a valid URL', { cause: error })
          }
          redirects.push(nextUrl.href)
          await cancelResponseBody(response, 'following validated redirect')
          outboundHeaders = headersForRedirect(outboundHeaders, url, nextUrl)
          current = nextUrl
          continue
        }
      }

      const contentType = response.headers.get('content-type') || ''
      if (!policy.skipContentTypeCheck && response.body
        && !isAllowedContentType(contentType, allowedContentTypes)) {
        await cancelResponseBody(response, 'unsupported content type')
        throw new SafeFetchError('unsupported_content_type', 'Destination returned an unsupported content type')
      }

      try {
        const body = await policy.read(response, maxResponseBytes)
        return {
          response,
          value: body.value,
          finalUrl: url.href,
          redirects,
          bytesRead: body.bytesRead,
          contentType,
        }
      } catch (error) {
        if (error instanceof SafeFetchError) throw error
        if (controller.signal.aborted) throw abortError(error)
        throw new SafeFetchError('network_error', 'Outbound response body could not be read', { cause: error })
      }
    }
  } catch (error) {
    if (error instanceof SafeFetchError) throw error
    if (controller.signal.aborted) throw abortError(error)
    throw error
  } finally {
    clearTimeout(timeoutId)
    if (!controller.signal.aborted) controller.abort(new Error('safe fetch completed'))
    callerSignal?.removeEventListener('abort', abortFromCaller)
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
  const result = await safeFetchWithPolicy(input, options, {
    defaultMaxResponseBytes: DEFAULT_MAX_RESPONSE_BYTES,
    defaultAllowedContentTypes: DEFAULT_ALLOWED_CONTENT_TYPES,
    async read(response, maxBytes) {
      const body = await readBoundedText(response, maxBytes)
      return { value: body.text, bytesRead: body.bytesRead }
    },
  })
  const { value: text, ...shared } = result
  return { ...shared, text }
}

/** Fetch bounded binary content under the same outbound policy as safeFetchText. */
export async function safeFetchBytes(
  input: string | URL,
  options: SafeFetchOptions = {},
): Promise<SafeFetchBytesResult> {
  const result = await safeFetchWithPolicy(input, options, {
    defaultMaxResponseBytes: DEFAULT_MAX_RESPONSE_BYTES,
    defaultAllowedContentTypes: DEFAULT_ALLOWED_BINARY_CONTENT_TYPES,
    async read(response, maxBytes) {
      const body = await readBoundedBytes(response, maxBytes)
      return { value: body.bytes, bytesRead: body.bytesRead }
    },
  })
  const { value: bytes, ...shared } = result
  return { ...shared, bytes }
}

/** Resolve and perform a bodyless HEAD request with per-hop policy validation. */
export async function safeFetchHead(
  input: string | URL,
  options: SafeFetchOptions = {},
): Promise<SafeFetchHeadResult> {
  const result = await safeFetchWithPolicy(input, options, {
    method: 'HEAD',
    defaultMaxResponseBytes: 1,
    defaultAllowedContentTypes: DEFAULT_ALLOWED_CONTENT_TYPES,
    skipContentTypeCheck: true,
    async read(response) {
      await cancelResponseBody(response, 'HEAD response body discarded')
      return { value: undefined, bytesRead: 0 }
    },
  })
  return {
    response: result.response,
    finalUrl: result.finalUrl,
    redirects: result.redirects,
    bytesRead: result.bytesRead,
    contentType: result.contentType,
  }
}
