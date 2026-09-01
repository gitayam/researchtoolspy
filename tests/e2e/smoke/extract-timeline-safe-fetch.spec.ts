import { expect, test } from '@playwright/test'
import { fetchTimelineSource, onRequestPost } from '../../../functions/api/tools/extract-timeline'

const sessions = {
  get: async (token: string) => token === 'route-token' ? JSON.stringify({ user_id: 7 }) : null,
}

function routeContext(url: string) {
  return {
    request: new Request('https://researchtools.example/api/tools/extract-timeline', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer route-token',
        Cookie: 'session=must-not-leak',
      },
      body: JSON.stringify({ url }),
    }),
    env: { SESSIONS: sessions as unknown as KVNamespace },
    params: {},
  }
}

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

test.describe('extract-timeline bounded static fetch @smoke', () => {
  test.describe.configure({ mode: 'serial' })

  test('@smoke private literals are rejected before transport', async () => {
    let networkCalls = 0
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async () => {
      networkCalls += 1
      return new Response('unexpected')
    }) as typeof fetch

    try {
      const response = await onRequestPost(routeContext('http://127.0.0.1/private') as never)
      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({ error: 'Invalid or unsafe URL format' })
      expect(networkCalls).toBe(0)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('@smoke mixed public/private DNS is denied before target transport', async () => {
    let targetCalls = 0
    const restore = installNetworkMock({
      addresses: { A: ['93.184.216.34'], AAAA: ['::1'] },
      target: () => {
        targetCalls += 1
        return new Response('must not be fetched')
      },
    })

    try {
      const response = await onRequestPost(routeContext('https://mixed.example/article') as never)
      expect(response.status).toBe(422)
      expect(await response.json()).toEqual({ error: 'Failed to fetch URL' })
      expect(targetCalls).toBe(0)
    } finally {
      restore()
    }
  })

  test('@smoke a private redirect is denied before its second hop', async () => {
    const targets: string[] = []
    const restore = installNetworkMock({
      target: url => {
        targets.push(url.href)
        return new Response(null, { status: 302, headers: { Location: 'http://169.254.169.254/latest' } })
      },
    })

    try {
      const response = await onRequestPost(routeContext('https://public.example/redirect') as never)
      expect(response.status).toBe(422)
      expect(targets).toEqual(['https://public.example/redirect'])
    } finally {
      restore()
    }
  })

  test('@smoke oversized and non-text responses are rejected', async () => {
    for (const createResponse of [
      () => new Response('short', {
          headers: { 'Content-Type': 'text/html', 'Content-Length': String(2 * 1024 * 1024 + 1) },
        }),
      () => new Response(new Uint8Array([1, 2, 3]), { headers: { 'Content-Type': 'image/png' } }),
    ]) {
      const restore = installNetworkMock({ target: createResponse })
      try {
        await expect(fetchTimelineSource('https://public.example/article')).rejects.toThrow()
      } finally {
        restore()
      }
    }
  })

  test('@smoke successful fetch preserves final URL and forwards no credentials', async () => {
    const headers: Headers[] = []
    const restore = installNetworkMock({
      target: (url, init) => {
        headers.push(new Headers(init?.headers))
        if (url.pathname === '/start') {
          return new Response(null, { status: 302, headers: { Location: '/article' } })
        }
        return new Response('<html><body>bounded timeline source</body></html>', {
          headers: { 'Content-Type': 'text/html' },
        })
      },
    })

    try {
      const result = await fetchTimelineSource('https://public.example/start')
      expect(result.finalUrl).toBe('https://public.example/article')
      expect(result.html).toContain('bounded timeline source')
      expect(headers).toHaveLength(2)
      for (const outbound of headers) {
        expect(outbound.has('authorization')).toBe(false)
        expect(outbound.has('cookie')).toBe(false)
      }
    } finally {
      restore()
    }
  })
})
