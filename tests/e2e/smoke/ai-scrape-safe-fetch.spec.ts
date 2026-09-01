import { expect, test } from '@playwright/test'
import { isApifySupportedUrl } from '../../../functions/api/_shared/apify-social'
import { onRequestPost } from '../../../functions/api/ai/scrape-url'

const sessions = {
  get: async (token: string) => token === 'route-token' ? JSON.stringify({ user_id: 7 }) : null,
}

const cache = {
  get: async () => null,
  put: async () => undefined,
}

function routeContext(url: string, apifyApiKey?: string) {
  return {
    request: new Request('https://researchtools.example/api/ai/scrape-url', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer route-token',
        Cookie: 'session=must-not-leak',
      },
      body: JSON.stringify({ url, framework: 'starbursting' }),
    }),
    env: {
      SESSIONS: sessions as unknown as KVNamespace,
      CACHE: cache as unknown as KVNamespace,
      APIFY_API_KEY: apifyApiKey,
    },
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

test.describe('AI scrape bounded outbound adapter @smoke', () => {
  test.describe.configure({ mode: 'serial' })

  test('@smoke social provider classification requires an exact platform hostname', () => {
    expect(isApifySupportedUrl('https://x.com/research/status/12345')).toBe('twitter')
    expect(isApifySupportedUrl('https://www.tiktok.com/@research/video/12345')).toBe('tiktok')
    expect(isApifySupportedUrl('https://evil.example/x.com/status/12345')).toBeNull()
    expect(isApifySupportedUrl('https://x.com.evil.example/research/status/12345')).toBeNull()
  })

  test('@smoke mixed public/private DNS is denied before the caller target is fetched', async () => {
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
      expect(response.status).toBe(400)
      expect(await response.json()).toMatchObject({ errorType: 'invalid_url' })
      expect(targetCalls).toBe(0)
    } finally {
      restore()
    }
  })

  test('@smoke a redirect to a private address is denied before the second hop', async () => {
    const targets: string[] = []
    const restore = installNetworkMock({
      target: url => {
        targets.push(url.href)
        return new Response(null, { status: 302, headers: { Location: 'http://127.0.0.1/private' } })
      },
    })

    try {
      const response = await onRequestPost(routeContext('https://public.example/redirect') as never)
      expect(response.status).toBe(400)
      expect(await response.json()).toMatchObject({ errorType: 'invalid_url' })
      expect(targets).toEqual(['https://public.example/redirect'])
    } finally {
      restore()
    }
  })

  test('@smoke oversized HTML is rejected and credentials are not forwarded', async () => {
    const outboundHeaders: Headers[] = []
    const restore = installNetworkMock({
      target: (_url, init) => {
        outboundHeaders.push(new Headers(init?.headers))
        return new Response('<html>short fixture</html>', {
          headers: {
            'Content-Type': 'text/html',
            'Content-Length': String(2 * 1024 * 1024 + 1),
          },
        })
      },
    })

    try {
      const response = await onRequestPost(routeContext('https://public.example/large') as never)
      expect(response.status).toBe(400)
      expect(await response.json()).toMatchObject({ errorType: 'invalid_url' })
      expect(outboundHeaders).toHaveLength(1)
      expect(outboundHeaders[0].has('authorization')).toBe(false)
      expect(outboundHeaders[0].has('cookie')).toBe(false)
    } finally {
      restore()
    }
  })

  test('@smoke a crafted non-social URL is never disclosed to Apify', async () => {
    const targets: string[] = []
    const restore = installNetworkMock({
      target: url => {
        targets.push(url.hostname)
        return new Response('<html>short fixture</html>', {
          headers: {
            'Content-Type': 'text/html',
            'Content-Length': String(2 * 1024 * 1024 + 1),
          },
        })
      },
    })

    try {
      const response = await onRequestPost(routeContext(
        'https://evil.example/x.com/status/12345',
        'apify-secret',
      ) as never)
      expect(response.status).toBe(400)
      expect(targets).toEqual(['evil.example'])
    } finally {
      restore()
    }
  })
})
