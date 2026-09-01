import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { scrapeUrl } from '../../../functions/api/_shared/scraper-utils'
import { onRequestPost } from '../../../functions/api/tools/rage-check'

const sessions = {
  get: async (token: string) => token === 'route-token' ? JSON.stringify({ user_id: 7 }) : null,
}

function routeContext(url: string, apifyApiKey?: string) {
  return {
    request: new Request('https://researchtools.example/api/tools/rage-check', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer route-token',
        Cookie: 'session=must-not-leak',
      },
      body: JSON.stringify({ url }),
    }),
    env: {
      SESSIONS: sessions as unknown as KVNamespace,
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

test.describe('RageCheck shared bounded scraper @smoke', () => {
  test.describe.configure({ mode: 'serial' })

  test('@smoke shared scraper cannot silently restore Browser Rendering', () => {
    const source = readFileSync(resolve(process.cwd(), 'functions/api/_shared/scraper-utils.ts'), 'utf8')
    expect(source).not.toContain('BROWSER_RENDERER')
    expect(source).not.toContain('renderArticleFallback')
    expect(source).not.toMatch(/await\s+fetch\(url/)
  })

  test('@smoke private literals fail before transport', async () => {
    let networkCalls = 0
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async () => {
      networkCalls += 1
      return new Response('unexpected')
    }) as typeof fetch

    try {
      const response = await onRequestPost(routeContext('http://127.0.0.1/private') as never)
      expect(response.status).toBe(422)
      expect(await response.json()).toEqual({ error: 'Failed to scrape URL content' })
      expect(networkCalls).toBe(0)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('@smoke mixed DNS and private redirects fail without a second hop', async () => {
    let targetCalls = 0
    let restore = installNetworkMock({
      addresses: { A: ['93.184.216.34'], AAAA: ['::1'] },
      target: () => {
        targetCalls += 1
        return new Response('must not be fetched')
      },
    })
    try {
      expect((await scrapeUrl('https://mixed.example/article')).error).toBe('Scraping failed')
      expect(targetCalls).toBe(0)
    } finally {
      restore()
    }

    const targets: string[] = []
    restore = installNetworkMock({
      target: url => {
        targets.push(url.href)
        return new Response(null, { status: 302, headers: { Location: 'http://169.254.169.254/latest' } })
      },
    })
    try {
      expect((await scrapeUrl('https://public.example/redirect')).error).toBe('Scraping failed')
      expect(targets).toEqual(['https://public.example/redirect'])
    } finally {
      restore()
    }
  })

  test('@smoke oversized and non-text direct responses are rejected', async () => {
    for (const createResponse of [
      () => new Response('short', {
        headers: { 'Content-Type': 'text/html', 'Content-Length': String(2 * 1024 * 1024 + 1) },
      }),
      () => new Response(new Uint8Array([1, 2, 3]), { headers: { 'Content-Type': 'image/png' } }),
    ]) {
      const restore = installNetworkMock({ target: createResponse })
      try {
        expect((await scrapeUrl('https://public.example/article')).error).toBe('Scraping failed')
      } finally {
        restore()
      }
    }
  })

  test('@smoke static success preserves article provenance and leaks no credentials', async () => {
    const headers: Headers[] = []
    const restore = installNetworkMock({
      target: (_url, init) => {
        headers.push(new Headers(init?.headers))
        return new Response(`<html><head><title>Bounded RageCheck source</title></head><body><main><p>${'bounded article text '.repeat(80)}</p></main></body></html>`, {
          headers: { 'Content-Type': 'text/html' },
        })
      },
    })
    try {
      const result = await scrapeUrl('https://public.example/article')
      expect(result.error).toBeUndefined()
      expect(result.content).toContain('bounded article text')
      expect(result.extraction?.method).not.toBe('cloudflare-browser-run')
      expect(headers).toHaveLength(1)
      expect(headers[0].has('authorization')).toBe(false)
      expect(headers[0].has('cookie')).toBe(false)
    } finally {
      restore()
    }
  })

  test('@smoke impostor social hosts are never disclosed to oEmbed or Apify', async () => {
    const targets: string[] = []
    const restore = installNetworkMock({
      target: url => {
        targets.push(url.hostname)
        return new Response('<html>short</html>', { headers: { 'Content-Type': 'text/html' } })
      },
    })
    try {
      await scrapeUrl('https://evil.example/x.com/status/12345', 'apify-secret')
      expect(targets).toEqual(['evil.example'])
      expect(targets).not.toContain('publish.twitter.com')
      expect(targets).not.toContain('api.apify.com')
    } finally {
      restore()
    }
  })
})
