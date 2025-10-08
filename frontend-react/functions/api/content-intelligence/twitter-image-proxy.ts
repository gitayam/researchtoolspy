/**
 * Twitter Image Proxy
 * Proxies Twitter media URLs with CORS headers and caching
 */

import type { PagesFunction } from '@cloudflare/workers-types'

interface Env {
  UPLOADS: R2Bucket
  CACHE: KVNamespace
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    headers: {
      ...corsHeaders,
      'Access-Control-Max-Age': '86400'
    }
  })
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  const url = new URL(request.url)
  const imageUrl = url.searchParams.get('url')

  if (!imageUrl) {
    return new Response('Missing "url" parameter', {
      status: 400,
      headers: corsHeaders
    })
  }

  // Validate that it's a Twitter media URL
  if (!imageUrl.includes('twimg.com') && !imageUrl.includes('pbs.twimg.com')) {
    return new Response('Invalid Twitter media URL', {
      status: 400,
      headers: corsHeaders
    })
  }

  console.log('[Twitter Proxy] Proxying image:', imageUrl)

  // Check Cloudflare Cache API first
  const cache = caches.default
  const cacheKey = new Request(imageUrl, request)
  let cachedResponse = await cache.match(cacheKey)

  if (cachedResponse) {
    console.log('[Twitter Proxy] Cache hit')
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
    console.log('[Twitter Proxy] Fetching from Twitter CDN...')
    const twitterResponse = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ResearchToolsBot/1.0)',
        'Referer': 'https://twitter.com/'
      },
      cf: {
        cacheTtl: 604800, // 7 days
        cacheEverything: true
      }
    })

    if (!twitterResponse.ok) {
      console.error('[Twitter Proxy] Twitter CDN returned', twitterResponse.status)
      return new Response(`Failed to fetch image: ${twitterResponse.status}`, {
        status: twitterResponse.status,
        headers: corsHeaders
      })
    }

    // Add CORS headers to response
    const headers = new Headers(twitterResponse.headers)
    headers.set('Access-Control-Allow-Origin', '*')
    headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS')
    headers.set('Cache-Control', 'public, max-age=604800') // 7 days

    const proxiedResponse = new Response(twitterResponse.body, {
      status: twitterResponse.status,
      headers
    })

    // Store in Cloudflare Cache API (async, don't wait)
    context.waitUntil(cache.put(cacheKey, proxiedResponse.clone()))

    // Optional: Upload to R2 for permanent backup
    if (env.UPLOADS && twitterResponse.body) {
      const imageHash = await calculateImageHash(imageUrl)
      const ext = imageUrl.match(/\.(jpg|jpeg|png|webp|gif)(\?|$)/)?.[1] || 'jpg'
      const r2Key = `twitter-media/${imageHash}.${ext}`

      // Clone the body for R2 upload (don't block response)
      context.waitUntil(
        (async () => {
          try {
            // Check if already exists in R2
            const existing = await env.UPLOADS.head(r2Key)
            if (!existing) {
              await env.UPLOADS.put(r2Key, twitterResponse.clone().body, {
                httpMetadata: {
                  contentType: twitterResponse.headers.get('content-type') || 'image/jpeg'
                }
              })
              console.log('[Twitter Proxy] Uploaded to R2:', r2Key)
            }
          } catch (r2Error) {
            console.warn('[Twitter Proxy] R2 upload failed:', r2Error)
          }
        })()
      )
    }

    console.log('[Twitter Proxy] Successfully proxied image')
    return proxiedResponse

  } catch (error) {
    console.error('[Twitter Proxy] Error:', error)
    return new Response('Failed to proxy Twitter image', {
      status: 502,
      headers: corsHeaders
    })
  }
}

async function calculateImageHash(url: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(url)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16)
}
