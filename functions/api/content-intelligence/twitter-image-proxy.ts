/**
 * Twitter Image Proxy
 * Proxies Twitter media URLs with CORS headers and caching
 */

import type { PagesFunction } from '@cloudflare/workers-types'
import { CORS_HEADERS, optionsResponse } from '../_shared/api-utils'
import { safeFetchImage, type SafeImageMimeType } from '../_shared/safe-content'

interface Env {
  UPLOADS?: R2Bucket
}

const CACHE_CONTROL = 'public, max-age=604800'
const CACHE_POLICY_VERSION = 'safe-image-v1'
const TWITTER_IMAGE_HOST = 'pbs.twimg.com'

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

  // Check Cloudflare Cache API first
  const cache = caches.default
  // Version the key so responses cached before byte/MIME validation are not reused.
  const cacheKey = createCacheKey(request.url, validatedImageUrl)
  const cachedResponse = await cache.match(cacheKey)

  if (cachedResponse) {
    // Clone and add CORS headers
    const headers = new Headers(cachedResponse.headers)
    headers.set('Access-Control-Allow-Origin', '*')
    headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS')

    return new Response(cachedResponse.body, {
      status: cachedResponse.status,
      headers
    })
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
    const headers = new Headers()
    headers.set('Content-Type', fetched.mimeType)
    headers.set('Content-Length', String(responseBytes.byteLength))
    headers.set('X-Content-Type-Options', 'nosniff')
    headers.set('Access-Control-Allow-Origin', '*')
    headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS')
    headers.set('Cache-Control', CACHE_CONTROL)

    const proxiedResponse = new Response(responseBytes, {
      status: fetched.response.status,
      headers
    })

    // Store in Cloudflare Cache API (async, don't wait)
    context.waitUntil(cache.put(cacheKey, proxiedResponse.clone()))

    // Optional: Upload to R2 for permanent backup
    if (env.UPLOADS) {
      const uploads = env.UPLOADS
      const imageHash = await contentBytesHash(responseBytes)
      const r2Key = `twitter-media/${imageHash}.${extensionForMimeType(fetched.mimeType)}`
      const uploadBytes = responseBytes.slice()

      context.waitUntil(
        (async () => {
          try {
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
