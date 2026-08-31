import { expect, test } from '@playwright/test'
import { onRequestPost } from '../../../functions/api/tools/analyze-url'

type DnsRecordType = 'A' | 'AAAA'

interface NetworkMock {
  dns?: (hostname: string, type: DnsRecordType) => string[]
  target: (url: URL, init?: RequestInit) => Response | Promise<Response>
}

const sessions = {
  get: async (token: string) => token === 'route-token' ? JSON.stringify({ user_id: 7 }) : null,
}

function installNetworkMock(mock: NetworkMock): () => void {
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    if (url.hostname === 'cloudflare-dns.com') {
      const type: DnsRecordType = url.searchParams.get('type') === 'AAAA' ? 'AAAA' : 'A'
      const hostname = url.searchParams.get('name') || ''
      const addresses = mock.dns?.(hostname, type)
        ?? (type === 'A' ? ['93.184.216.34'] : ['2606:2800:220:1:248:1893:25c8:1946'])
      return Response.json({
        Status: 0,
        Answer: addresses.map(data => ({ type: type === 'A' ? 1 : 28, data })),
      })
    }
    return await mock.target(url, init)
  }) as typeof fetch
  return () => { globalThis.fetch = originalFetch }
}

function acceleratePolicyDeadline(): () => void {
  const originalSetTimeout = globalThis.setTimeout
  globalThis.setTimeout = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
    return originalSetTimeout(handler, timeout === 15_000 ? 10 : timeout, ...args)
  }) as typeof setTimeout
  return () => { globalThis.setTimeout = originalSetTimeout }
}

function stalledResponse(signal: AbortSignal, onAbort: () => void): Response {
  return new Response(new ReadableStream<Uint8Array>({
    start(controller) {
      signal.addEventListener('abort', () => {
        onAbort()
        controller.error(signal.reason)
      }, { once: true })
    },
  }), { headers: { 'Content-Type': 'text/html' } })
}

function routeRequest(body: Record<string, unknown>, authenticated = true): Request {
  return new Request('https://researchtools.example/api/tools/analyze-url', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authenticated ? {
        Authorization: 'Bearer route-token',
        Cookie: 'session=must-not-leak',
        'X-User-Hash': '0123456789abcdef',
        'X-Workspace-ID': 'workspace-secret',
      } : {}),
    },
    body: JSON.stringify(body),
  })
}

function invoke(body: Record<string, unknown>, authenticated = true): Promise<Response> {
  return onRequestPost({
    request: routeRequest(body, authenticated),
    env: { SESSIONS: sessions as unknown as KVNamespace },
    params: {},
  } as never)
}

function htmlResponse(title = 'Bounded Article'): Response {
  return new Response(`<!doctype html><html><head>
    <title>${title}</title>
    <meta name="description" content="Bounded metadata">
    <meta property="og:site_name" content="Example Publisher">
    <meta property="og:image" content="/images/preview.jpg">
    </head><body>article</body></html>`, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

function fetchFailureShape(body: Record<string, unknown>, normalizedUrl: string): void {
  expect(body).toMatchObject({
    error: 'Failed to fetch URL',
    normalizedUrl,
    status: {
      code: 0,
      ok: false,
      redirects: [],
      finalUrl: normalizedUrl,
      error: 'Request failed',
    },
  })
  expect((body.status as Record<string, unknown>).responseTime).toEqual(expect.any(Number))
  expect(JSON.stringify(body)).not.toContain('SafeFetchError')
  expect(JSON.stringify(body)).not.toContain('response_too_large')
}

test.describe('tools analyze-url bounded outbound policy @smoke', () => {
  test.describe.configure({ mode: 'serial' })

  test('@smoke rejects unauthenticated, missing, and invalid requests before DNS or transport', async () => {
    let networkCalls = 0
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async () => {
      networkCalls += 1
      throw new Error('network must not run')
    }) as typeof fetch
    try {
      const unauthenticated = await invoke({ url: 'https://public.example/article' }, false)
      expect(unauthenticated.status).toBe(401)
      expect(await unauthenticated.json()).toEqual({ error: 'Authentication required' })

      const missing = await invoke({})
      expect(missing.status).toBe(400)
      expect(await missing.json()).toEqual({ error: 'URL is required' })

      const invalid = await invoke({ url: 'http://[invalid' })
      expect(invalid.status).toBe(400)
      expect(await invalid.json()).toEqual({ error: 'Invalid URL format' })
      expect(networkCalls).toBe(0)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('@smoke preserves success metadata and SEO shape with validated redirect provenance and no credentials', async () => {
    const targets: string[] = []
    const outboundHeaders: Headers[] = []
    const restore = installNetworkMock({
      target: (url, init) => {
        targets.push(url.href)
        outboundHeaders.push(new Headers(init?.headers))
        expect(init?.redirect).toBe('manual')
        if (url.hostname === 'public.example') {
          return new Response(null, {
            status: 302,
            headers: { Location: 'https://final.example/article' },
          })
        }
        return htmlResponse('Redirected &amp; Article')
      },
    })
    try {
      const response = await invoke({ url: 'public.example/start', checkSEO: true })
      const body = await response.json() as Record<string, unknown>
      expect(response.status).toBe(200)
      expect(body).toMatchObject({
        url: 'public.example/start',
        normalizedUrl: 'https://public.example/start',
        metadata: {
          title: 'Redirected & Article',
          description: 'Bounded metadata',
          siteName: 'Example Publisher',
          image: '/images/preview.jpg',
        },
        domain: {
          name: 'public.example',
          protocol: 'https',
          path: '/start',
          ssl: true,
        },
        status: {
          code: 200,
          ok: true,
          redirects: ['https://final.example/article'],
          finalUrl: 'https://final.example/article',
        },
        seo: {
          openGraph: { site_name: 'Example Publisher', image: '/images/preview.jpg' },
        },
      })
      const seo = body.seo as { metaTags: Record<string, string> }
      expect(seo.metaTags).toEqual({
        description: 'Bounded metadata',
        'og:site_name': 'Example Publisher',
        'og:image': '/images/preview.jpg',
      })
      expect((body.metadata as Record<string, unknown>).image)
        .not.toBe('https://final.example/images/preview.jpg')
      expect(body.reliability).toMatchObject({ rating: expect.any(String), score: expect.any(Number) })
      expect(body.analyzedAt).toEqual(expect.any(String))
      expect(targets).toEqual([
        'https://public.example/start',
        'https://final.example/article',
      ])
      for (const headers of outboundHeaders) {
        for (const name of ['authorization', 'cookie', 'x-user-hash', 'x-workspace-id']) {
          expect(headers.has(name)).toBe(false)
        }
      }
    } finally {
      restore()
    }
  })

  test('@smoke rejects private literals, mixed DNS, and private redirects before target transport', async () => {
    const targets: string[] = []
    const restore = installNetworkMock({
      dns: (hostname, type) => {
        if (hostname === 'mixed.example') {
          return type === 'A' ? ['93.184.216.34', '10.0.0.8'] : []
        }
        return type === 'A' ? ['93.184.216.34'] : []
      },
      target: url => {
        targets.push(url.href)
        return new Response(null, {
          status: 302,
          headers: { Location: 'http://127.0.0.1/private' },
        })
      },
    })
    try {
      const literal = await invoke({ url: 'http://127.0.0.1/private', checkWayback: true })
      expect(literal.status).toBe(200)
      fetchFailureShape(await literal.json() as Record<string, unknown>, 'http://127.0.0.1/private')

      const mixed = await invoke({ url: 'https://mixed.example/article', checkWayback: true })
      expect(mixed.status).toBe(200)
      fetchFailureShape(await mixed.json() as Record<string, unknown>, 'https://mixed.example/article')

      const redirected = await invoke({ url: 'https://public.example/start', checkWayback: true })
      expect(redirected.status).toBe(200)
      fetchFailureShape(await redirected.json() as Record<string, unknown>, 'https://public.example/start')
      expect(targets).toEqual(['https://public.example/start'])
    } finally {
      restore()
    }
  })

  test('@smoke rejects wrong MIME, declared oversize, and headerless streaming overrun', async () => {
    let mode: 'mime' | 'declared' | 'stream' = 'mime'
    const restore = installNetworkMock({
      target: () => {
        if (mode === 'mime') {
          return new Response('not HTML', { headers: { 'Content-Type': 'image/png' } })
        }
        if (mode === 'declared') {
          return new Response('<html>small fixture</html>', {
            headers: {
              'Content-Type': 'text/html',
              'Content-Length': String(2 * 1024 * 1024 + 1),
            },
          })
        }
        let chunks = 0
        return new Response(new ReadableStream<Uint8Array>({
          pull(controller) {
            chunks += 1
            controller.enqueue(new Uint8Array(1024 * 1024))
            if (chunks === 3) controller.close()
          },
        }), { headers: { 'Content-Type': 'text/html' } })
      },
    })
    try {
      for (const nextMode of ['mime', 'declared', 'stream'] as const) {
        mode = nextMode
        const url = `https://public.example/${mode}`
        const response = await invoke({ url })
        expect(response.status).toBe(200)
        fetchFailureShape(await response.json() as Record<string, unknown>, url)
      }
    } finally {
      restore()
    }
  })

  test('@smoke enforces the primary 15s total deadline through propagated body abort', async () => {
    let primaryAbortObserved = false
    const targets: string[] = []
    const restoreTimer = acceleratePolicyDeadline()
    const restoreFetch = installNetworkMock({
      target: (url, init) => {
        targets.push(url.href)
        return stalledResponse(init?.signal as AbortSignal, () => { primaryAbortObserved = true })
      },
    })
    try {
      const url = 'https://public.example/stalled'
      const response = await invoke({ url, checkWayback: true })
      expect(response.status).toBe(200)
      fetchFailureShape(await response.json() as Record<string, unknown>, url)
      expect(primaryAbortObserved).toBe(true)
      expect(targets).toEqual([url])
      expect(targets.every(target => !target.includes('/save/') && !target.includes('archive.org'))).toBe(true)
    } finally {
      restoreFetch()
      restoreTimer()
    }
  })

  test('@smoke preserves transport-failure and textual 404 analysis envelopes', async () => {
    let mode: 'transport' | 'not-found' = 'transport'
    const restore = installNetworkMock({
      target: () => {
        if (mode === 'transport') throw new Error('sensitive upstream transport details')
        return new Response('<html><head><title>Missing Article</title></head><body>missing</body></html>', {
          status: 404,
          headers: { 'Content-Type': 'text/html' },
        })
      },
    })
    try {
      const url = 'https://public.example/article'
      const failed = await invoke({ url })
      expect(failed.status).toBe(200)
      const failureBody = await failed.json() as Record<string, unknown>
      fetchFailureShape(failureBody, url)
      expect(JSON.stringify(failureBody)).not.toContain('sensitive upstream transport details')

      mode = 'not-found'
      const missing = await invoke({ url, checkSEO: true })
      expect(missing.status).toBe(200)
      expect(await missing.json()).toMatchObject({
        normalizedUrl: url,
        metadata: { title: 'Missing Article' },
        status: { code: 404, ok: false, finalUrl: url, redirects: [] },
        seo: { metaTags: {}, openGraph: {}, twitterCard: {} },
        reliability: { score: expect.any(Number), rating: expect.any(String) },
      })
    } finally {
      restore()
    }
  })

  test('@smoke accepts exact-HTTPS Wayback redirects and valid archived/CDX shapes without save transport', async () => {
    const targets: string[] = []
    const archiveHeaders: Headers[] = []
    const restore = installNetworkMock({
      target: (url, init) => {
        targets.push(url.href)
        if (url.hostname === 'public.example') return htmlResponse()
        archiveHeaders.push(new Headers(init?.headers))
        expect(url.protocol).toBe('https:')
        expect(init?.redirect).toBe('manual')
        if (url.hostname === 'archive.org' && url.pathname === '/wayback/available') {
          return new Response(null, {
            status: 302,
            headers: { Location: '/wayback/available-final' },
          })
        }
        if (url.hostname === 'archive.org') {
          return Response.json({
            archived_snapshots: {
              closest: {
                timestamp: '20260831010203',
                url: 'https://web.archive.org/web/20260831010203id_/https://public.example/article',
              },
            },
          })
        }
        expect(url.hostname).toBe('web.archive.org')
        expect(url.pathname).toBe('/cdx/search/cdx')
        expect(url.searchParams.get('url')).toBe('https://public.example/article')
        return Response.json([
          ['urlkey', 'timestamp', 'original'],
          ['key', '20250101000000', 'https://public.example/article'],
          ['key', '20260831010203', 'https://public.example/article'],
          ['key', 'not-a-timestamp', 'https://public.example/article'],
        ])
      },
    })
    try {
      const response = await invoke({ url: 'https://public.example/article', checkWayback: true })
      const body = await response.json() as Record<string, unknown>
      expect(response.status).toBe(200)
      expect(body.wayback).toEqual({
        isArchived: true,
        lastSnapshot: '20260831010203',
        archiveUrl: 'https://web.archive.org/web/20260831010203id_/https://public.example/article',
        totalSnapshots: 2,
        firstSnapshot: '20250101000000',
      })
      expect(targets).toEqual([
        'https://public.example/article',
        'https://archive.org/wayback/available?url=https%3A%2F%2Fpublic.example%2Farticle',
        'https://archive.org/wayback/available-final',
        'https://web.archive.org/cdx/search/cdx?url=https%3A%2F%2Fpublic.example%2Farticle&output=json&limit=100',
      ])
      expect(targets.every(url => !url.includes('/save/'))).toBe(true)
      for (const headers of archiveHeaders) {
        for (const name of ['authorization', 'cookie', 'x-user-hash', 'x-workspace-id']) {
          expect(headers.has(name)).toBe(false)
        }
      }
    } finally {
      restore()
    }
  })

  test('@smoke returns the ordinary not-archived shape and performs zero save transport', async () => {
    const targets: string[] = []
    const restore = installNetworkMock({
      target: url => {
        targets.push(url.href)
        if (url.hostname === 'public.example') return htmlResponse()
        return Response.json({ archived_snapshots: {} })
      },
    })
    try {
      const response = await invoke({ url: 'https://public.example/article', checkWayback: true })
      const body = await response.json() as Record<string, unknown>
      expect(response.status).toBe(200)
      expect(body.wayback).toEqual({ isArchived: false, saveRequested: false })
      expect(targets).toHaveLength(2)
      expect(targets.every(url => !url.includes('/save/'))).toBe(true)
    } finally {
      restore()
    }
  })

  test('@smoke rejects malicious snapshots and malformed timestamps without CDX or save transport', async () => {
    let snapshot: Record<string, unknown> = {
      timestamp: '20260831010203',
      url: 'https://web.archive.org.attacker.example/web/20260831010203/https://public.example/article',
    }
    const targets: string[] = []
    const restore = installNetworkMock({
      target: url => {
        targets.push(url.href)
        if (url.hostname === 'public.example') return htmlResponse()
        return Response.json({ archived_snapshots: { closest: snapshot } })
      },
    })
    try {
      for (const invalidSnapshot of [
        snapshot,
        { timestamp: 20260831010203, url: 'https://web.archive.org/web/20260831010203/https://public.example/article' },
        { timestamp: 'not-a-timestamp', url: 'https://web.archive.org/web/valid-looking' },
        { timestamp: '20260831010203', url: 'https://web.archive.org/not-web/20260831010203/https://public.example/article' },
        { timestamp: '20260831010203', url: 'https://web.archive.org/web/20260831010203evil_/https://public.example/article' },
        { timestamp: '20260831010203', url: 'https://web.archive.org/web/20260831010204/https://public.example/article' },
      ]) {
        snapshot = invalidSnapshot
        const response = await invoke({ url: 'https://public.example/article', checkWayback: true })
        const body = await response.json() as Record<string, unknown>
        expect(response.status).toBe(200)
        expect(body.wayback).toEqual({ isArchived: false, saveRequested: false })
      }
      expect(targets.filter(url => url.includes('/cdx/'))).toEqual([])
      expect(targets.filter(url => url.includes('/save/'))).toEqual([])
    } finally {
      restore()
    }
  })

  test('@smoke contains archive redirects and rejects mixed DNS, wrong MIME, and both provider oversize forms', async () => {
    let mode: 'cross-host' | 'downgrade' | 'mixed-dns' | 'oversize' | 'stream' | 'mime' = 'cross-host'
    const targets: string[] = []
    const restore = installNetworkMock({
      dns: (hostname, type) => {
        if (mode === 'mixed-dns' && hostname === 'archive.org') {
          return type === 'A' ? ['93.184.216.34', '10.0.0.8'] : []
        }
        return type === 'A' ? ['93.184.216.34'] : []
      },
      target: url => {
        targets.push(url.href)
        if (url.hostname === 'public.example') return htmlResponse()
        if (mode === 'cross-host') {
          return new Response(null, {
            status: 302,
            headers: { Location: 'https://archive.org.attacker.example/escape' },
          })
        }
        if (mode === 'downgrade') {
          return new Response(null, {
            status: 302,
            headers: { Location: 'http://archive.org/insecure' },
          })
        }
        if (mode === 'stream') {
          let chunks = 0
          return new Response(new ReadableStream<Uint8Array>({
            pull(controller) {
              chunks += 1
              controller.enqueue(new Uint8Array(128 * 1024))
              if (chunks === 3) controller.close()
            },
          }), { headers: { 'Content-Type': 'application/json' } })
        }
        if (mode === 'mime') {
          return new Response('{}', { headers: { 'Content-Type': 'image/png' } })
        }
        return new Response('{}', {
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': String(256 * 1024 + 1),
          },
        })
      },
    })
    try {
      for (const nextMode of ['cross-host', 'downgrade', 'mixed-dns', 'oversize', 'stream', 'mime'] as const) {
        mode = nextMode
        const before = targets.length
        const response = await invoke({ url: 'https://public.example/article', checkWayback: true })
        const body = await response.json() as Record<string, unknown>
        expect(response.status).toBe(200)
        expect(body.wayback).toEqual({ isArchived: false })
        const attemptTargets = targets.slice(before)
        expect(attemptTargets).toHaveLength(mode === 'mixed-dns' ? 1 : 2)
        expect(attemptTargets[0]).toBe('https://public.example/article')
        if (mode !== 'mixed-dns') {
          expect(attemptTargets[1]).toContain('https://archive.org/wayback/available?')
        }
        expect(attemptTargets.every(url => !url.includes('attacker.example') && !url.startsWith('http://'))).toBe(true)
      }
      expect(targets.every(url => !url.includes('/save/'))).toBe(true)
    } finally {
      restore()
    }
  })

  test('@smoke rejects a malicious CDX redirect before transport and preserves the validated snapshot', async () => {
    const targets: string[] = []
    const restore = installNetworkMock({
      target: url => {
        targets.push(url.href)
        if (url.hostname === 'public.example') return htmlResponse()
        if (url.hostname === 'archive.org') {
          return Response.json({
            archived_snapshots: {
              closest: {
                timestamp: '20260831010203',
                url: 'https://web.archive.org/web/20260831010203/https://public.example/article',
              },
            },
          })
        }
        return new Response(null, {
          status: 302,
          headers: { Location: 'https://web.archive.org.attacker.example/cdx-escape' },
        })
      },
    })
    try {
      const response = await invoke({ url: 'https://public.example/article', checkWayback: true })
      const body = await response.json() as Record<string, unknown>
      expect(response.status).toBe(200)
      expect(body.wayback).toEqual({
        isArchived: true,
        lastSnapshot: '20260831010203',
        archiveUrl: 'https://web.archive.org/web/20260831010203/https://public.example/article',
        totalSnapshots: 1,
      })
      expect(targets).toHaveLength(3)
      expect(targets.every(url => !url.includes('attacker.example') && !url.includes('/save/'))).toBe(true)
    } finally {
      restore()
    }
  })

  test('@smoke enforces the archive 15s total deadline through propagated body abort', async () => {
    let archiveAbortObserved = false
    const targets: string[] = []
    const restoreTimer = acceleratePolicyDeadline()
    const restoreFetch = installNetworkMock({
      target: (url, init) => {
        targets.push(url.href)
        if (url.hostname === 'public.example') return htmlResponse()
        return stalledResponse(init?.signal as AbortSignal, () => { archiveAbortObserved = true })
      },
    })
    try {
      const response = await invoke({ url: 'https://public.example/article', checkWayback: true })
      const body = await response.json() as Record<string, unknown>
      expect(response.status).toBe(200)
      expect(body).toMatchObject({
        metadata: { title: 'Bounded Article' },
        status: { code: 200, ok: true },
        wayback: { isArchived: false },
      })
      expect(archiveAbortObserved).toBe(true)
      expect(targets).toHaveLength(2)
      expect(targets[1]).toContain('https://archive.org/wayback/available?')
      expect(targets.every(url => !url.includes('/cdx/') && !url.includes('/save/'))).toBe(true)
    } finally {
      restoreFetch()
      restoreTimer()
    }
  })
})
