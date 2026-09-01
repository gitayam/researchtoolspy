const APIFY_ORIGIN = 'https://api.apify.com'
const APIFY_API_PREFIX = '/v2/'
const APIFY_JSON_CONTENT_TYPES = new Set(['application/json', 'application/problem+json'])
const DEFAULT_MAX_RESPONSE_BYTES = 512 * 1024
const DEFAULT_TIMEOUT_MS = 15_000
const SAFE_IDENTIFIER = /^[A-Za-z0-9_~-]{1,128}$/

export interface ApifyJsonResponse {
  data: unknown
  ok: boolean
  status: number
}

interface ApifyJsonRequest {
  body?: unknown
  maxResponseBytes?: number
  method?: 'GET' | 'POST'
  path: readonly string[]
  searchParams?: Record<string, string | number | boolean | undefined>
  timeoutMs?: number
}

export function assertApifyIdentifier(value: string, label: string): string {
  if (!SAFE_IDENTIFIER.test(value)) throw new Error(`Invalid Apify ${label}`)
  return value
}

function apifyUrl(path: readonly string[], searchParams?: ApifyJsonRequest['searchParams']): URL {
  if (path.length === 0) throw new Error('Apify path is required')
  const encodedPath = path.map((segment) => encodeURIComponent(
    assertApifyIdentifier(segment, 'path segment'),
  )).join('/')
  const url = new URL(`${APIFY_API_PREFIX}${encodedPath}`, APIFY_ORIGIN)
  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value))
  }
  return url
}

async function readBoundedText(response: Response, maxBytes: number): Promise<string> {
  const contentLength = response.headers.get('Content-Length')
  if (contentLength && Number(contentLength) > maxBytes) {
    throw new Error('Apify response exceeds byte limit')
  }

  const reader = response.body?.getReader()
  if (!reader) return ''
  const chunks: Uint8Array[] = []
  let bytesRead = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value?.byteLength) continue
      bytesRead += value.byteLength
      if (bytesRead > maxBytes) throw new Error('Apify response exceeds byte limit')
      chunks.push(value)
    }
  } catch (error) {
    void reader.cancel().catch(() => undefined)
    throw error
  }

  const bytes = new Uint8Array(bytesRead)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder().decode(bytes)
}

/**
 * Fixed-origin Apify JSON boundary. Caller-controlled values are encoded as
 * validated path segments or query values; redirects, oversized bodies, wrong
 * MIME types, and timeouts are terminal before credentials can reach another host.
 */
export async function fetchApifyJson(
  apiKey: string,
  request: ApifyJsonRequest,
): Promise<ApifyJsonResponse> {
  const maxResponseBytes = request.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES
  const timeoutMs = request.timeoutMs ?? DEFAULT_TIMEOUT_MS
  if (!Number.isSafeInteger(maxResponseBytes) || maxResponseBytes <= 0) {
    throw new Error('Invalid Apify response byte limit')
  }
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new Error('Invalid Apify timeout')
  }

  const controller = new AbortController()
  const timeoutId = globalThis.setTimeout(
    () => controller.abort(new Error('Apify request timed out')),
    timeoutMs,
  )
  try {
    const response = await fetch(apifyUrl(request.path, request.searchParams).href, {
      method: request.method ?? 'GET',
      redirect: 'manual',
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        ...(request.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(request.body === undefined ? {} : { body: JSON.stringify(request.body) }),
    })

    if (response.status >= 300 && response.status < 400) {
      void response.body?.cancel().catch(() => undefined)
      throw new Error('Apify redirects are not allowed')
    }
    const contentType = response.headers.get('Content-Type')?.split(';', 1)[0].trim().toLowerCase()
    if (!contentType || !APIFY_JSON_CONTENT_TYPES.has(contentType)) {
      void response.body?.cancel().catch(() => undefined)
      throw new Error('Apify returned an unsupported content type')
    }

    const text = await readBoundedText(response, maxResponseBytes)
    let data: unknown = null
    if (text) {
      try {
        data = JSON.parse(text) as unknown
      } catch (error) {
        throw new Error('Apify returned invalid JSON', { cause: error })
      }
    }
    return { data, ok: response.ok, status: response.status }
  } finally {
    globalThis.clearTimeout(timeoutId)
  }
}
