import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { SAFE_IMAGE_MAX_BYTES } from '../../../functions/api/_shared/safe-content'
import {
  onRequestGet,
  parseTwitterImageUrl,
} from '../../../functions/api/content-intelligence/twitter-image-proxy'

interface CacheState {
  matchCalls: string[]
  putCalls: Array<{ key: string; response: Response }>
  hit?: Response
}

function installCache(state: CacheState): () => void {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'caches')
  Object.defineProperty(globalThis, 'caches', {
    configurable: true,
    value: {
      default: {
        async match(request: Request) {
          state.matchCalls.push(request.url)
          return state.hit?.clone()
        },
        async put(request: Request, response: Response) {
          state.putCalls.push({ key: request.url, response: response.clone() })
        },
      },
    },
  })
  return () => {
    if (original) Object.defineProperty(globalThis, 'caches', original)
    else delete (globalThis as { caches?: unknown }).caches
  }
}

function dnsResponse(query: URL, addresses: string[]): Response {
  const recordType = query.searchParams.get('type')
  const records = addresses
    .filter(address => recordType === 'AAAA' ? address.includes(':') : !address.includes(':'))
    .map(address => ({ type: recordType === 'AAAA' ? 28 : 1, data: address }))
  return Response.json({ Status: 0, Answer: records })
}

function contextFor(
  imageUrl: string,
  env: Record<string, unknown> = {},
): { context: Record<string, unknown>; waits: Promise<unknown>[] } {
  const waits: Promise<unknown>[] = []
  return {
    waits,
    context: {
      request: new Request(`https://researchtools.net/api/content-intelligence/twitter-image-proxy?url=${encodeURIComponent(imageUrl)}`),
      env,
      params: {},
      data: {},
      functionPath: '/api/content-intelligence/twitter-image-proxy',
      next: async () => new Response(null),
      waitUntil(promise: Promise<unknown>) {
        waits.push(promise)
      },
    },
  }
}

const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3])
const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 1, 2, 3])

test.describe('Twitter image proxy safe fetch @smoke', () => {
  test.describe.configure({ mode: 'serial' })

  test('@smoke accepts only exact HTTPS pbs.twimg.com syntax before cache lookup', async () => {
    expect(parseTwitterImageUrl('https://pbs.twimg.com/media/image.jpg').hostname).toBe('pbs.twimg.com')
    for (const value of [
      'http://pbs.twimg.com/media/image.jpg',
      'https://user:secret@pbs.twimg.com/media/image.jpg',
      'https://pbs.twimg.com:8443/media/image.jpg',
      'https://sub.pbs.twimg.com/media/image.jpg',
      'https://pbs.twimg.com.attacker.example/media/image.jpg',
      'https://attacker.example/?next=pbs.twimg.com',
      'https://pbs.twimg.com./media/image.jpg',
    ]) {
      expect(() => parseTwitterImageUrl(value), value).toThrow('Invalid Twitter media URL')
    }

    const cacheState: CacheState = { matchCalls: [], putCalls: [] }
    const restoreCache = installCache(cacheState)
    try {
      const { context } = contextFor('https://pbs.twimg.com.attacker.example/image.jpg')
      const response = await onRequestGet(context as never)
      expect(response.status).toBe(400)
      expect(await response.text()).toBe('Invalid Twitter media URL')
      expect(cacheState.matchCalls).toEqual([])
    } finally {
      restoreCache()
    }
  })

  test('@smoke denies private or mixed DNS before target transport', async () => {
    const originalFetch = globalThis.fetch
    const cacheState: CacheState = { matchCalls: [], putCalls: [] }
    const restoreCache = installCache(cacheState)
    let addresses = ['10.0.0.1']
    let targetCalls = 0
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = new URL(String(input))
      if (url.hostname === 'cloudflare-dns.com') return dnsResponse(url, addresses)
      targetCalls += 1
      return new Response(jpegBytes, { headers: { 'Content-Type': 'image/jpeg' } })
    }) as typeof fetch

    try {
      let request = contextFor('https://pbs.twimg.com/private.jpg')
      expect((await onRequestGet(request.context as never)).status).toBe(502)
      addresses = ['93.184.216.34', '10.0.0.2']
      request = contextFor('https://pbs.twimg.com/mixed.jpg')
      expect((await onRequestGet(request.context as never)).status).toBe(502)
      expect(targetCalls).toBe(0)
    } finally {
      globalThis.fetch = originalFetch
      restoreCache()
    }
  })

  test('@smoke denies cross-host, private, and mixed-DNS redirect targets', async () => {
    const originalFetch = globalThis.fetch
    const cacheState: CacheState = { matchCalls: [], putCalls: [] }
    const restoreCache = installCache(cacheState)
    let scenario: 'cross-host' | 'private' | 'mixed-dns' = 'cross-host'
    let aLookups = 0
    const targetUrls: string[] = []
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = new URL(String(input))
      if (url.hostname === 'cloudflare-dns.com') {
        if (url.searchParams.get('type') === 'A') aLookups += 1
        const rebinding = scenario === 'mixed-dns' && aLookups > 1
        return dnsResponse(url, rebinding ? ['93.184.216.34', '10.0.0.3'] : ['93.184.216.34'])
      }
      targetUrls.push(url.href)
      const location = scenario === 'cross-host'
        ? 'https://images.attacker.example/payload.jpg'
        : scenario === 'private' ? 'https://127.0.0.1/private.jpg' : '/rebound.jpg'
      return new Response(null, { status: 302, headers: { Location: location } })
    }) as typeof fetch

    try {
      for (const nextScenario of ['cross-host', 'private', 'mixed-dns'] as const) {
        scenario = nextScenario
        aLookups = 0
        const before = targetUrls.length
        const { context } = contextFor(`https://pbs.twimg.com/${nextScenario}.jpg`)
        expect((await onRequestGet(context as never)).status).toBe(502)
        expect(targetUrls.slice(before)).toEqual([`https://pbs.twimg.com/${nextScenario}.jpg`])
      }
    } finally {
      globalThis.fetch = originalFetch
      restoreCache()
    }
  })

  test('@smoke rejects oversized, wrong-MIME, and signature-mismatched images', async () => {
    const originalFetch = globalThis.fetch
    const cacheState: CacheState = { matchCalls: [], putCalls: [] }
    const restoreCache = installCache(cacheState)
    let scenario: 'oversized' | 'mime' | 'signature' = 'oversized'
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = new URL(String(input))
      if (url.hostname === 'cloudflare-dns.com') return dnsResponse(url, ['93.184.216.34'])
      if (scenario === 'oversized') {
        return new Response(jpegBytes, {
          headers: {
            'Content-Type': 'image/jpeg',
            'Content-Length': String(SAFE_IMAGE_MAX_BYTES + 1),
          },
        })
      }
      if (scenario === 'mime') {
        return new Response(jpegBytes, { headers: { 'Content-Type': 'application/octet-stream' } })
      }
      return new Response(new TextEncoder().encode('GIF89a'), { headers: { 'Content-Type': 'image/png' } })
    }) as typeof fetch

    try {
      for (const nextScenario of ['oversized', 'mime', 'signature'] as const) {
        scenario = nextScenario
        const { context } = contextFor(`https://pbs.twimg.com/${nextScenario}.jpg`)
        const response = await onRequestGet(context as never)
        expect(response.status).toBe(502)
        expect(await response.text()).toBe('Failed to proxy Twitter image')
      }
      expect(cacheState.putCalls).toEqual([])
    } finally {
      globalThis.fetch = originalFetch
      restoreCache()
    }
  })

  test('@smoke returns, caches, and R2-stores only validated bounded bytes', async () => {
    const originalFetch = globalThis.fetch
    const cacheState: CacheState = { matchCalls: [], putCalls: [] }
    const restoreCache = installCache(cacheState)
    const r2 = {
      headCalls: [] as string[],
      putCalls: [] as Array<{ key: string; bytes: Uint8Array; contentType?: string }>,
      async head(key: string) {
        this.headCalls.push(key)
        return null
      },
      async put(key: string, value: ArrayBuffer | ArrayBufferView, options?: { httpMetadata?: { contentType?: string } }) {
        const bytes = value instanceof ArrayBuffer
          ? new Uint8Array(value)
          : new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
        this.putCalls.push({ key, bytes: bytes.slice(), contentType: options?.httpMetadata?.contentType })
        return {}
      },
    }
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = new URL(String(input))
      if (url.hostname === 'cloudflare-dns.com') return dnsResponse(url, ['93.184.216.34'])
      return new Response(pngBytes, {
        status: 200,
        headers: { 'Content-Type': 'image/png', 'Set-Cookie': 'must-not-proxy=yes' },
      })
    }) as typeof fetch

    try {
      const sourceUrl = 'https://pbs.twimg.com/media/caller-says-jpeg.jpg?format=png'
      const { context, waits } = contextFor(sourceUrl, { UPLOADS: r2 })
      const response = await onRequestGet(context as never)
      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toBe('image/png')
      expect(response.headers.get('cache-control')).toBe('public, max-age=604800')
      expect(response.headers.get('access-control-allow-origin')).toBe('*')
      expect(response.headers.has('set-cookie')).toBe(false)
      expect(new Uint8Array(await response.arrayBuffer())).toEqual(pngBytes)

      await Promise.all(waits)
      const expectedCacheKey = new URL('https://researchtools.net/api/content-intelligence/twitter-image-proxy')
      expectedCacheKey.searchParams.set('policy', 'safe-image-v1')
      expectedCacheKey.searchParams.set('url', sourceUrl)
      expect(cacheState.matchCalls).toEqual([expectedCacheKey.href])
      expect(cacheState.putCalls).toHaveLength(1)
      expect(cacheState.putCalls[0].key).toBe(expectedCacheKey.href)
      expect(new Uint8Array(await cacheState.putCalls[0].response.arrayBuffer())).toEqual(pngBytes)

      const expectedHash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', pngBytes))]
        .map(byte => byte.toString(16).padStart(2, '0')).join('')
      expect(r2.headCalls).toEqual([`twitter-media/${expectedHash}.png`])
      expect(r2.putCalls).toEqual([{
        key: `twitter-media/${expectedHash}.png`,
        bytes: pngBytes,
        contentType: 'image/png',
      }])
    } finally {
      globalThis.fetch = originalFetch
      restoreCache()
    }
  })

  test('@smoke preserves validated cache hits and ordinary upstream status behavior', async () => {
    const originalFetch = globalThis.fetch
    const cacheState: CacheState = {
      matchCalls: [],
      putCalls: [],
      hit: new Response(jpegBytes, { headers: { 'Content-Type': 'image/jpeg' } }),
    }
    const restoreCache = installCache(cacheState)
    let fetchCalls = 0
    globalThis.fetch = (async () => {
      fetchCalls += 1
      return new Response(jpegBytes, { status: 404, headers: { 'Content-Type': 'image/jpeg' } })
    }) as typeof fetch
    try {
      let request = contextFor('https://pbs.twimg.com/cached.jpg')
      const cached = await onRequestGet(request.context as never)
      expect(cached.status).toBe(200)
      expect(cached.headers.get('access-control-allow-origin')).toBe('*')
      expect(new Uint8Array(await cached.arrayBuffer())).toEqual(jpegBytes)
      expect(fetchCalls).toBe(0)

      cacheState.hit = undefined
      globalThis.fetch = (async (input: RequestInfo | URL) => {
        const url = new URL(String(input))
        if (url.hostname === 'cloudflare-dns.com') return dnsResponse(url, ['93.184.216.34'])
        return new Response(jpegBytes, { status: 404, headers: { 'Content-Type': 'image/jpeg' } })
      }) as typeof fetch
      request = contextFor('https://pbs.twimg.com/missing.jpg')
      const missing = await onRequestGet(request.context as never)
      expect(missing.status).toBe(404)
      expect(await missing.text()).toBe('Failed to fetch image: 404')
    } finally {
      globalThis.fetch = originalFetch
      restoreCache()
    }
  })

  test('@smoke route source has no caller-controlled raw fetch or upstream body streaming', () => {
    const source = readFileSync(resolve(
      process.cwd(),
      'functions/api/content-intelligence/twitter-image-proxy.ts',
    ), 'utf8')
    expect(source).toContain('safeFetchImage(validatedImageUrl')
    expect(source).not.toMatch(/\bfetch\s*\(/)
    expect(source).not.toContain('twitterResponse.body')
    expect(source).not.toContain('response.arrayBuffer()')
    expect(source).not.toContain("imageUrl.includes('twimg.com')")
  })
})
