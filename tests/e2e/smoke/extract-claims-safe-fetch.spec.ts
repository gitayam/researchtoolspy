import { expect, test } from '@playwright/test'
import { fetchWithFallback, onRequestPost } from '../../../functions/api/tools/extract-claims'

interface NetworkMockOptions {
  addresses?: { A?: string[]; AAAA?: string[] }
  target: (url: URL, init?: RequestInit) => Promise<Response> | Response
}

function installNetworkMock(options: NetworkMockOptions): () => void {
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    if (url.hostname === 'cloudflare-dns.com') {
      const type = url.searchParams.get('type') === 'AAAA' ? 'AAAA' : 'A'
      const recordType = type === 'AAAA' ? 28 : 1
      const defaults = type === 'AAAA' ? ['2606:2800:220:1:248:1893:25c8:1946'] : ['93.184.216.34']
      const addresses = options.addresses?.[type] ?? defaults
      return Response.json({
        Status: 0,
        Answer: addresses.map(data => ({ type: recordType, data })),
      })
    }
    return await options.target(url, init)
  }) as typeof fetch
  return () => { globalThis.fetch = originalFetch }
}

test.describe('extract-claims bounded fetch chain @smoke', () => {
  test.describe.configure({ mode: 'serial' })

  test('@smoke private literals are rejected before provider disclosure', async () => {
    let networkCalls = 0
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async () => {
      networkCalls += 1
      return new Response('unexpected')
    }) as typeof fetch

    try {
      const response = await onRequestPost({
        request: new Request('https://researchtools.example/api/tools/extract-claims', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer route-token' },
          body: JSON.stringify({ url: 'http://127.0.0.1/private' }),
        }),
        env: {
          SESSIONS: { get: async () => JSON.stringify({ user_id: 7 }) },
          CACHE: { get: async () => null, put: async () => undefined },
        },
        params: {},
      } as never)
      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({ error: 'Invalid or unsafe URL format' })
      expect(networkCalls).toBe(0)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('@smoke mixed DNS is terminal and never discloses the URL to a fallback', async () => {
    let targetCalls = 0
    const restore = installNetworkMock({
      addresses: { A: ['93.184.216.34'], AAAA: ['::1'] },
      target: () => {
        targetCalls += 1
        return new Response('must not be fetched')
      },
    })

    try {
      const result = await fetchWithFallback('https://mixed.example/article')
      expect(result).toMatchObject({ source: 'failed', policyDenied: true })
      expect(targetCalls).toBe(0)
    } finally {
      restore()
    }
  })

  test('@smoke a private redirect is terminal before fallback disclosure', async () => {
    const targets: string[] = []
    const restore = installNetworkMock({
      target: url => {
        targets.push(url.href)
        return new Response(null, { status: 302, headers: { Location: 'http://169.254.169.254/latest' } })
      },
    })

    try {
      const result = await fetchWithFallback('https://public.example/redirect')
      expect(result).toMatchObject({ source: 'failed', policyDenied: true })
      expect(targets).toEqual(['https://public.example/redirect'])
    } finally {
      restore()
    }
  })

  test('@smoke successful direct extraction is bounded and forwards no caller credentials', async () => {
    const headers: Headers[] = []
    const restore = installNetworkMock({
      target: (_url, init) => {
        headers.push(new Headers(init?.headers))
        return new Response(`<html><head><title>Bounded claims source</title></head><body>${'article words '.repeat(80)}</body></html>`, {
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        })
      },
    })

    try {
      const result = await fetchWithFallback('https://public.example/article')
      expect(result).toMatchObject({ source: 'original', paywalled: false })
      expect(result.text).toContain('article words')
      expect(headers).toHaveLength(1)
      expect(headers[0].has('authorization')).toBe(false)
      expect(headers[0].has('cookie')).toBe(false)
    } finally {
      restore()
    }
  })

  test('@smoke every fallback body is size-bounded', async () => {
    const targets: string[] = []
    const restore = installNetworkMock({
      target: url => {
        targets.push(url.hostname)
        const max = url.hostname === 'archive.org' ? 256 * 1024 : 2 * 1024 * 1024
        return new Response('oversized', {
          headers: {
            'Content-Type': url.hostname === 'archive.org' ? 'application/json' : 'text/html',
            'Content-Length': String(max + 1),
          },
        })
      },
    })

    try {
      const result = await fetchWithFallback('https://public.example/large')
      expect(result).toMatchObject({ source: 'failed', error: 'All fetch methods failed' })
      expect(targets).toEqual([
        'public.example',
        'cdn.ampproject.org',
        'webcache.googleusercontent.com',
        'archive.ph',
        'archive.org',
      ])
    } finally {
      restore()
    }
  })

  test('@smoke a provider-returned non-Wayback snapshot URL is never fetched', async () => {
    const targets: string[] = []
    const restore = installNetworkMock({
      target: url => {
        targets.push(url.hostname)
        if (url.hostname === 'archive.org') {
          return Response.json({
            archived_snapshots: {
              closest: { timestamp: '20260101000000', url: 'https://evil.example/private-copy' },
            },
          })
        }
        return new Response('not available', { status: 404, headers: { 'Content-Type': 'text/html' } })
      },
    })

    try {
      const result = await fetchWithFallback('https://public.example/article')
      expect(result.source).toBe('failed')
      expect(targets).not.toContain('evil.example')
      expect(targets.at(-1)).toBe('archive.org')
    } finally {
      restore()
    }
  })
})
