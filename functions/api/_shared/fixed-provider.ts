import {
  SafeFetchError,
  safeFetchBytes,
  safeFetchText,
  type HostnameResolver,
  type SafeFetchResult,
} from './safe-fetch'

const JSON_CONTENT_TYPES = [
  'application/json',
  'application/problem+json',
  'text/plain',
  'text/html',
] as const

export interface FixedProviderOptions {
  searchParams?: Readonly<Record<string, string | number | boolean | undefined>>
  timeoutMs?: number
  maxResponseBytes?: number
  credentialHeaders?: Readonly<Record<string, string | undefined>>
  fetchImpl?: typeof fetch
  resolveHostname?: HostnameResolver
  /** Caller cancellation or an enclosing total-deadline signal. */
  signal?: AbortSignal
}

export interface FixedProviderJsonResult<T> extends SafeFetchResult {
  data: T | null
  text: string
}

export interface FixedProviderBytesOptions extends Omit<FixedProviderOptions, 'credentialHeaders'> {
  allowedContentTypes: readonly string[]
}

export interface FixedProviderBytesResult extends SafeFetchResult {
  bytes: Uint8Array
}

function fixedOrigin(origin: string): URL {
  const parsed = new URL(origin)
  if (parsed.protocol !== 'https:'
    || parsed.username
    || parsed.password
    || parsed.port
    || parsed.pathname !== '/'
    || parsed.search
    || parsed.hash) {
    throw new SafeFetchError('invalid_options', 'Fixed provider origin must be a bare HTTPS origin')
  }
  return parsed
}

function providerUrl(
  origin: URL,
  path: readonly string[],
  searchParams: FixedProviderOptions['searchParams'],
): URL {
  if (path.length === 0 || path.some(segment => !segment || segment.length > 512)) {
    throw new SafeFetchError('invalid_options', 'Fixed provider path segments are required and bounded')
  }
  const url = new URL(origin.origin)
  url.pathname = path.map(segment => encodeURIComponent(segment)).join('/')
  for (const [name, value] of Object.entries(searchParams ?? {})) {
    if (value !== undefined) url.searchParams.set(name, String(value))
  }
  return url
}

function scopedTransport(
  origin: URL,
  credentialHeaders: FixedProviderOptions['credentialHeaders'],
  transport: typeof fetch,
): typeof fetch {
  return async (input, init) => {
    const destination = new URL(input instanceof Request ? input.url : String(input))
    if (destination.origin !== origin.origin) {
      throw new SafeFetchError('unsafe_url', 'Provider credentials cannot leave their fixed origin')
    }
    const headers = new Headers(init?.headers)
    for (const [name, value] of Object.entries(credentialHeaders ?? {})) {
      if (value) headers.set(name, value)
    }
    return transport(destination, { ...init, headers, redirect: 'manual' })
  }
}

function jsonMime(contentType: string): boolean {
  const mime = contentType.split(';', 1)[0].trim().toLowerCase()
  return mime === 'application/json' || mime === 'application/problem+json'
}

/** Bounded GET for a server-selected HTTPS provider with origin-scoped credentials. */
export async function fetchFixedProviderJson<T>(
  originValue: string,
  path: readonly string[],
  options: FixedProviderOptions = {},
): Promise<FixedProviderJsonResult<T>> {
  const origin = fixedOrigin(originValue)
  const url = providerUrl(origin, path, options.searchParams)
  const result = await safeFetchText(url, {
    allowedHostnames: [origin.hostname],
    allowedContentTypes: JSON_CONTENT_TYPES,
    maxRedirects: 0,
    timeoutMs: options.timeoutMs ?? 15_000,
    maxResponseBytes: options.maxResponseBytes ?? 1024 * 1024,
    resolveHostname: options.resolveHostname,
    fetchImpl: scopedTransport(origin, options.credentialHeaders, options.fetchImpl ?? fetch),
    requestInit: { headers: { Accept: 'application/json' }, signal: options.signal },
  })

  let data: T | null = null
  if (result.response.ok) {
    if (!jsonMime(result.contentType)) {
      throw new SafeFetchError('unsupported_content_type', 'Provider success response must be JSON')
    }
    try {
      data = JSON.parse(result.text) as T
    } catch (error) {
      throw new SafeFetchError('unsupported_content_type', 'Provider returned invalid JSON', { cause: error })
    }
  }
  return { ...result, data }
}

/** Bounded binary GET for a server-selected HTTPS provider without credentials. */
export async function fetchFixedProviderBytes(
  originValue: string,
  path: readonly string[],
  options: FixedProviderBytesOptions,
): Promise<FixedProviderBytesResult> {
  const origin = fixedOrigin(originValue)
  const url = providerUrl(origin, path, options.searchParams)
  return safeFetchBytes(url, {
    allowedHostnames: [origin.hostname],
    allowedContentTypes: options.allowedContentTypes,
    maxRedirects: 0,
    timeoutMs: options.timeoutMs ?? 30_000,
    maxResponseBytes: options.maxResponseBytes ?? 8 * 1024 * 1024,
    resolveHostname: options.resolveHostname,
    fetchImpl: scopedTransport(origin, undefined, options.fetchImpl ?? fetch),
    requestInit: { headers: { Accept: options.allowedContentTypes.join(', ') }, signal: options.signal },
  })
}
