/**
 * Twitter Image Proxy
 * Proxies Twitter media URLs with CORS headers and caching
 */

import type { PagesFunction } from '@cloudflare/workers-types'
import { CORS_HEADERS, optionsResponse } from '../_shared/api-utils'
import {
  SAFE_IMAGE_MAX_BYTES,
  safeFetchImage,
  type SafeImageMimeType,
} from '../_shared/safe-content'

interface Env {
  CACHE?: KVNamespace
  UPLOADS?: R2Bucket
}

const CACHE_CONTROL = 'public, max-age=604800'
const CACHE_HIT_READ_TIMEOUT_MS = 1_000
const CACHE_POLICY_VERSION = 'safe-image-v1'
const TWITTER_IMAGE_HOST = 'pbs.twimg.com'
export const TWITTER_IMAGE_REQUESTS_PER_HOUR = 240
export const TWITTER_IMAGE_ARCHIVE_WRITES_PER_HOUR = 20
export const TWITTER_IMAGE_ARCHIVE_WRITES_PER_DAY = 1_000
const ALLOWED_IMAGE_MIME_TYPES = new Set<SafeImageMimeType>([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
])

interface CachedImageMetadata {
  contentLength: number
  mimeType: SafeImageMimeType
}

type BudgetResult = 'allowed' | 'limited' | 'unavailable'

async function opaqueClientId(request: Request): Promise<string> {
  const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown'
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(clientIp))
  return [...new Uint8Array(digest)].slice(0, 12)
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('')
}

async function consumeBudget(
  store: KVNamespace | undefined,
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<BudgetResult> {
  if (!store) return 'unavailable'
  const bucket = Math.floor(Date.now() / (windowSeconds * 1000))
  const budgetKey = `twitter-image:${key}:${bucket}`
  try {
    const current = Number.parseInt(await store.get(budgetKey) || '0', 10)
    if (!Number.isSafeInteger(current) || current < 0) return 'unavailable'
    if (current >= limit) return 'limited'
    await store.put(budgetKey, String(current + 1), { expirationTtl: windowSeconds * 2 })
    return 'allowed'
  } catch {
    return 'unavailable'
  }
}

async function reserveArchiveWrite(store: KVNamespace | undefined, clientId: string): Promise<boolean> {
  const clientBudget = await consumeBudget(
    store,
    `archive-client:${clientId}`,
    TWITTER_IMAGE_ARCHIVE_WRITES_PER_HOUR,
    60 * 60,
  )
  if (clientBudget !== 'allowed') return false
  const globalBudget = await consumeBudget(
    store,
    'archive-global',
    TWITTER_IMAGE_ARCHIVE_WRITES_PER_DAY,
    24 * 60 * 60,
  )
  return globalBudget === 'allowed'
}

export function parseTwitterImageUrl(value: string): URL {
  let url: URL
  try {
    url = new URL(value)
  } catch (error) {
    throw new Error('Invalid Twitter media URL', { cause: error })
  }
  if (url.protocol !== 'https:'
    || url.hostname !== TWITTER_IMAGE_HOST
    || url.username
    || url.password
    || url.port) {
    throw new Error('Invalid Twitter media URL')
  }
  return url
}

function extensionForMimeType(mimeType: SafeImageMimeType): string {
  switch (mimeType) {
    case 'image/jpeg': return 'jpg'
    case 'image/png': return 'png'
    case 'image/gif': return 'gif'
    case 'image/webp': return 'webp'
    case 'image/avif': return 'avif'
    default: {
      const exhaustive: never = mimeType
      return exhaustive
    }
  }
}

async function contentBytesHash(bytes: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(hashBuffer)]
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('')
}

function createCacheKey(requestUrl: string, imageUrl: URL): Request {
  const cacheUrl = new URL(requestUrl)
  cacheUrl.search = ''
  cacheUrl.hash = ''
  cacheUrl.searchParams.set('policy', CACHE_POLICY_VERSION)
  cacheUrl.searchParams.set('url', imageUrl.href)
  return new Request(cacheUrl, { method: 'GET' })
}

function cachedImageMetadata(response: Response): CachedImageMetadata | null {
  const mimeType = response.headers.get('Content-Type')?.split(';', 1)[0].trim().toLowerCase()
  const contentLengthHeader = response.headers.get('Content-Length')
  if (!mimeType
    || !ALLOWED_IMAGE_MIME_TYPES.has(mimeType as SafeImageMimeType)
    || !contentLengthHeader
    || !/^(0|[1-9]\d*)$/.test(contentLengthHeader)) {
    return null
  }

  const contentLength = Number(contentLengthHeader)
  if (!Number.isSafeInteger(contentLength) || contentLength > SAFE_IMAGE_MAX_BYTES) return null
  return { contentLength, mimeType: mimeType as SafeImageMimeType }
}

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  return bytes.length >= signature.length && signature.every((byte, index) => bytes[index] === byte)
}

function asciiAt(bytes: Uint8Array, offset: number, expected: string): boolean {
  if (bytes.length < offset + expected.length) return false
  for (let index = 0; index < expected.length; index += 1) {
    if (bytes[offset + index] !== expected.charCodeAt(index)) return false
  }
  return true
}

function hasCachedImageSignature(bytes: Uint8Array, mimeType: SafeImageMimeType): boolean {
  switch (mimeType) {
    case 'image/jpeg':
      return startsWith(bytes, [0xff, 0xd8, 0xff])
    case 'image/png':
      return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    case 'image/gif':
      return asciiAt(bytes, 0, 'GIF87a') || asciiAt(bytes, 0, 'GIF89a')
    case 'image/webp':
      return asciiAt(bytes, 0, 'RIFF') && asciiAt(bytes, 8, 'WEBP')
    case 'image/avif': {
      if (!asciiAt(bytes, 4, 'ftyp')) return false
      const scanLimit = Math.min(bytes.length - 3, 32)
      for (let offset = 8; offset < scanLimit; offset += 4) {
        if (asciiAt(bytes, offset, 'avif') || asciiAt(bytes, offset, 'avis')) return true
      }
      return false
    }
    default: {
      const exhaustive: never = mimeType
      return exhaustive
    }
  }
}

async function readValidatedCachedImage(
  response: Response,
  metadata: CachedImageMetadata,
): Promise<Uint8Array | null> {
  const reader = response.body?.getReader()
  if (!reader) return null

  let accepted = false
  let timeoutId: number | undefined
  const deadline = new Promise<never>((_resolve, reject) => {
    timeoutId = globalThis.setTimeout(
      () => reject(new Error('Cached image body read timed out')),
      CACHE_HIT_READ_TIMEOUT_MS,
    ) as unknown as number
  })

  try {
    const chunks: Uint8Array[] = []
    let bytesRead = 0
    while (true) {
      const { done, value } = await Promise.race([reader.read(), deadline])
      if (done) break
      if (!value?.byteLength) continue
      bytesRead += value.byteLength
      if (bytesRead > SAFE_IMAGE_MAX_BYTES || bytesRead > metadata.contentLength) return null
      chunks.push(value)
    }
    if (bytesRead !== metadata.contentLength) return null

    const bytes = new Uint8Array(bytesRead)
    let offset = 0
    for (const chunk of chunks) {
      bytes.set(chunk, offset)
      offset += chunk.byteLength
    }
    if (!hasCachedImageSignature(bytes, metadata.mimeType)) return null
    accepted = true
    return bytes
  } catch {
    return null
  } finally {
    if (timeoutId !== undefined) globalThis.clearTimeout(timeoutId)
    if (!accepted) void reader.cancel().catch(() => undefined)
  }
}

function imageResponseHeaders(mimeType: SafeImageMimeType, contentLength: number): Headers {
  return new Headers({
    'Content-Type': mimeType,
    'Content-Length': String(contentLength),
    'X-Content-Type-Options': 'nosniff',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': CACHE_CONTROL,
  })
}

export const onRequestOptions: PagesFunction = async () => {
  return optionsResponse()
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  const url = new URL(request.url)
  const imageUrl = url.searchParams.get('url')

  if (!imageUrl) {
    return new Response('Missing "url" parameter', {
      status: 400,
      headers: CORS_HEADERS
    })
  }

  // Validate before creating or consulting a Cache API key.
  let validatedImageUrl: URL
  try {
    validatedImageUrl = parseTwitterImageUrl(imageUrl)
  } catch {
    return new Response('Invalid Twitter media URL', {
      status: 400,
      headers: CORS_HEADERS
    })
  }

  const clientId = await opaqueClientId(request)
  const requestBudget = await consumeBudget(
    env.CACHE,
    `request:${clientId}`,
    TWITTER_IMAGE_REQUESTS_PER_HOUR,
    60 * 60,
  )
  if (requestBudget === 'limited') {
    return new Response('Twitter image proxy rate limit exceeded', {
      status: 429,
      headers: { ...CORS_HEADERS, 'Retry-After': '3600' },
    })
  }

  // Check Cloudflare Cache API first
  const cache = caches.default
  // Version the key so responses cached before byte/MIME validation are not reused.
  const cacheKey = createCacheKey(request.url, validatedImageUrl)
  const cachedResponse = await cache.match(cacheKey)
  let invalidCacheCleanup: Promise<boolean> | undefined

  const cachedMetadata = cachedResponse ? cachedImageMetadata(cachedResponse) : null
  if (cachedResponse && cachedMetadata) {
    const cachedBytes = await readValidatedCachedImage(cachedResponse, cachedMetadata)
    if (cachedBytes) {
      return new Response(cachedBytes, {
        status: cachedResponse.status,
        headers: imageResponseHeaders(cachedMetadata.mimeType, cachedBytes.byteLength),
      })
    }
  }
  if (cachedResponse?.body) {
    void cachedResponse.body.cancel().catch(() => undefined)
  }
  if (cachedResponse) {
    invalidCacheCleanup = cache.delete(cacheKey).catch(() => false)
    context.waitUntil(invalidCacheCleanup)
  }

  // Fetch from Twitter CDN
  try {
    const fetched = await safeFetchImage(validatedImageUrl, {
      allowedHostnames: [TWITTER_IMAGE_HOST],
      timeoutMs: 15_000,
      requestInit: {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ResearchToolsBot/1.0)',
          'Referer': 'https://twitter.com/'
        },
      },
    })

    if (!fetched.response.ok) {
      console.error('[Twitter Proxy] Twitter CDN returned', fetched.response.status)
      return new Response(`Failed to fetch image: ${fetched.response.status}`, {
        status: fetched.response.status,
        headers: CORS_HEADERS
      })
    }

    const responseBytes = fetched.bytes.slice()

    const proxiedResponse = new Response(responseBytes, {
      status: fetched.response.status,
      headers: imageResponseHeaders(fetched.mimeType, responseBytes.byteLength),
    })

    // Store in Cloudflare Cache API (async, don't wait)
    const cacheResponse = proxiedResponse.clone()
    const cacheWrite = invalidCacheCleanup
      ? invalidCacheCleanup.then(() => cache.put(cacheKey, cacheResponse))
      : cache.put(cacheKey, cacheResponse)
    context.waitUntil(cacheWrite)

    // Optional: Upload to R2 for permanent backup
    if (env.UPLOADS) {
      const uploads = env.UPLOADS
      const imageHash = await contentBytesHash(responseBytes)
      const r2Key = `twitter-media/${imageHash}.${extensionForMimeType(fetched.mimeType)}`
      const uploadBytes = responseBytes.slice()

      context.waitUntil(
        (async () => {
          try {
            if (!await reserveArchiveWrite(env.CACHE, clientId)) return
            // Check if already exists in R2
            const existing = await uploads.head(r2Key)
            if (!existing) {
              await uploads.put(r2Key, uploadBytes, {
                httpMetadata: {
                  contentType: fetched.mimeType
                }
              })
            }
          } catch (r2Error) {
            console.warn('[Twitter Proxy] R2 upload failed:', r2Error)
          }
        })()
      )
    }

    return proxiedResponse

  } catch (error) {
    console.error('[Twitter Proxy] Error:', error)
    return new Response('Failed to proxy Twitter image', {
      status: 502,
      headers: CORS_HEADERS
    })
  }
}
