import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  checkArchivePh,
  checkWaybackMachine,
  extractUrlContent,
  onRequestPost,
} from '../../../functions/api/content-intelligence/analyze-url'

type DnsAnswers = Record<string, string[]>

interface NetworkMock {
  answers?: DnsAnswers
  target(url: URL, init?: RequestInit): Response | Promise<Response>
}

function installNetworkMock(mock: NetworkMock): () => void {
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    if (url.hostname === 'cloudflare-dns.com') {
      const type = url.searchParams.get('type') === 'AAAA' ? 'AAAA' : 'A'
      const addresses = mock.answers?.[url.searchParams.get('name') || '']
        ?? (type === 'AAAA' ? ['2606:2800:220:1:248:1893:25c8:1946'] : ['93.184.216.34'])
      return Response.json({
        Status: 0,
        Answer: addresses
          .filter(address => type === 'AAAA' ? address.includes(':') : !address.includes(':'))
          .map(data => ({ type: type === 'AAAA' ? 28 : 1, data })),
      })
    }
    return await mock.target(url, init)
  }) as typeof fetch
  return () => { globalThis.fetch = originalFetch }
}

const longArticle = `<!doctype html><html><head><title>Validated Final Article</title></head>
  <body><article><p>${'bounded extraction words '.repeat(60)}</p>
  <a href="/next-source">Next source</a></article></body></html>`

test.describe('content-intelligence URL safe-fetch migration @smoke', () => {
  test.describe.configure({ mode: 'serial' })

  test('@smoke preserves unauthenticated, missing URL, and workspace denial shapes', async () => {
    const sessions = {
      get: async (token: string) => token === 'session-token' ? JSON.stringify({ user_id: 7 }) : null,
    }
    const deniedDb = {
      prepare: () => ({
        bind: () => ({
          first: async () => null,
          all: async () => ({ results: [] }),
        }),
      }),
    }
    const invoke = (body: Record<string, unknown>, authenticated = true, workspace?: string) => onRequestPost({
      request: new Request('https://researchtools.example/api/content-intelligence/analyze-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authenticated ? { Authorization: 'Bearer session-token' } : {}),
          ...(workspace ? { 'X-Workspace-ID': workspace } : {}),
        },
        body: JSON.stringify(body),
      }),
      env: { DB: deniedDb, SESSIONS: sessions },
      params: {},
    } as never)

    const unauthenticated = await invoke({}, false)
    expect(unauthenticated.status).toBe(401)
    expect(await unauthenticated.json()).toEqual({ error: 'Authentication required' })

    const missingWorkspace = await invoke({})
    expect(missingWorkspace.status).toBe(400)
    expect(await missingWorkspace.json()).toEqual({ error: 'Writable workspace context required' })

    const deniedWorkspace = await invoke({ url: 'https://public.example/article' }, true, 'workspace-7')
    expect(deniedWorkspace.status).toBe(403)
    expect(await deniedWorkspace.json()).toEqual({ error: 'Workspace write access denied' })
  })

  test('@smoke denies private, mixed-DNS, and private-redirect targets before transport', async () => {
    const targets: string[] = []
    const restore = installNetworkMock({
      answers: { 'mixed.example': ['93.184.216.34', '10.0.0.8'] },
      target: url => {
        targets.push(url.href)
        return new Response(null, { status: 302, headers: { Location: 'http://127.0.0.1/private' } })
      },
    })
    try {
      const literal = await extractUrlContent('http://127.0.0.1/private')
      expect(literal).toMatchObject({ success: false, errorCode: 'policy_denied' })
      const mixed = await extractUrlContent('https://mixed.example/article')
      expect(mixed).toMatchObject({ success: false, errorCode: 'policy_denied' })
      const redirected = await extractUrlContent('https://public.example/start')
      expect(redirected).toMatchObject({ success: false, errorCode: 'policy_denied' })
      expect(targets).toEqual(['https://public.example/start'])
    } finally {
      restore()
    }
  })

  test('@smoke enforces direct and archive text budgets and exact archive redirect hosts', async () => {
    const targets: string[] = []
    let mode: 'large' | 'archive-escape' | 'wayback-invalid' | 'wayback-valid' | 'wayback-large' = 'large'
    const restore = installNetworkMock({
      target: url => {
        targets.push(url.href)
        if (mode === 'archive-escape') {
          return new Response(null, {
            status: 302,
            headers: { Location: 'https://archive.ph.attacker.example/snapshot' },
          })
        }
        if (mode === 'wayback-invalid') {
          return new Response('key not-a-timestamp original text/html 200 digest 10', {
            headers: { 'Content-Type': 'text/plain' },
          })
        }
        if (mode === 'wayback-valid') {
          return new Response('key 20260831010203 original text/html 200 digest 10', {
            headers: { 'Content-Type': 'text/plain' },
          })
        }
        if (mode === 'wayback-large') {
          return new Response('small fixture', {
            headers: {
              'Content-Type': 'text/plain',
              'Content-Length': String(256 * 1024 + 1),
            },
          })
        }
        return new Response('small fixture', {
          headers: {
            'Content-Type': 'text/html',
            'Content-Length': String(2 * 1024 * 1024 + 1),
          },
        })
      },
    })
    try {
      const direct = await extractUrlContent('https://public.example/large')
      expect(direct).toMatchObject({ success: false, errorCode: 'response_too_large' })
      const archiveText = await extractUrlContent('https://archive.ph/snapshot', undefined, undefined, ['archive.ph'])
      expect(archiveText).toMatchObject({ success: false, errorCode: 'response_too_large' })

      mode = 'archive-escape'
      const archiveStart = targets.length
      await expect(checkArchivePh('https://public.example/article')).resolves.toBeNull()
      expect(targets.slice(archiveStart)).toHaveLength(1)
      expect(targets.at(-1)).toContain('https://archive.ph/newest/')

      mode = 'wayback-invalid'
      await expect(checkWaybackMachine('https://public.example/article')).resolves.toBeNull()
      mode = 'wayback-valid'
      await expect(checkWaybackMachine('https://public.example/article')).resolves.toBe(
        'https://web.archive.org/web/20260831010203/https://public.example/article',
      )
      mode = 'wayback-large'
      await expect(checkWaybackMachine('https://public.example/article')).resolves.toBeNull()
    } finally {
      restore()
    }
  })

  test('@smoke matches shorteners by exact host and restricts every short-link hop', async () => {
    const requests: Array<{ url: string; method: string }> = []
    const restore = installNetworkMock({
      target: (url, init) => {
        const method = String(init?.method || 'GET')
        requests.push({ url: url.href, method })
        if (url.hostname === 'spotify.link') {
          return new Response(null, { status: 302, headers: { Location: 'https://open.spotify.com/track/123' } })
        }
        if (url.hostname === 'open.spotify.com' && method === 'HEAD') return new Response(null)
        if (url.hostname === 'open.spotify.com') {
          return new Response('<html><head><meta property="og:title" content="Safe Track"><meta property="og:description" content="A safely resolved track description"></head></html>', {
            headers: { 'Content-Type': 'text/html' },
          })
        }
        if (url.hostname === 'fb.watch') {
          return new Response(null, { status: 302, headers: { Location: 'https://www.facebook.com/watch/456' } })
        }
        if (url.hostname === 'www.facebook.com' && method === 'HEAD') return new Response(null)
        if (url.hostname === 'www.facebook.com') {
          return new Response('<html><head><meta property="og:title" content="Safe Facebook Video"><meta property="og:description" content="A safely resolved Facebook description"></head></html>', {
            headers: { 'Content-Type': 'text/html' },
          })
        }
        return new Response(longArticle, { headers: { 'Content-Type': 'text/html' } })
      },
    })
    try {
      const impostor = await extractUrlContent('https://spotify.link.attacker.example/article')
      expect(impostor.success).toBe(true)
      expect(requests[0]).toEqual({ url: 'https://spotify.link.attacker.example/article', method: 'GET' })

      requests.length = 0
      const shortened = await extractUrlContent('https://spotify.link/abc')
      expect(shortened.success).toBe(true)
      expect(requests).toEqual([
        { url: 'https://spotify.link/abc', method: 'HEAD' },
        { url: 'https://open.spotify.com/track/123', method: 'HEAD' },
        { url: 'https://open.spotify.com/track/123', method: 'GET' },
      ])

      requests.length = 0
      const facebook = await extractUrlContent('https://fb.watch/abc')
      expect(facebook.success).toBe(true)
      expect(requests).toEqual([
        { url: 'https://fb.watch/abc', method: 'HEAD' },
        { url: 'https://www.facebook.com/watch/456', method: 'HEAD' },
        { url: 'https://www.facebook.com/watch/456', method: 'GET' },
      ])
    } finally {
      restore()
    }
  })

  test('@smoke uses the validated final URL for extraction and forwards no request credentials', async () => {
    const outboundHeaders: Headers[] = []
    const restore = installNetworkMock({
      target: (url, init) => {
        outboundHeaders.push(new Headers(init?.headers))
        if (url.hostname === 'start.example') {
          return new Response(null, { status: 302, headers: { Location: 'https://final.example/article' } })
        }
        return new Response(longArticle, { headers: { 'Content-Type': 'text/html' } })
      },
    })
    try {
      const result = await extractUrlContent('https://start.example/old-base')
      expect(result.success).toBe(true)
      expect(result.title).toBe('Validated Final Article')
      expect(result.links).toEqual(expect.arrayContaining([
        expect.objectContaining({ url: 'https://final.example/next-source' }),
      ]))
      for (const headers of outboundHeaders) {
        expect(headers.has('authorization')).toBe(false)
        expect(headers.has('cookie')).toBe(false)
        expect(headers.has('x-user-hash')).toBe(false)
        expect(headers.has('x-workspace-id')).toBe(false)
      }
    } finally {
      restore()
    }
  })

  test('@smoke analyze-url contains no dynamic renderer call or binding reference', () => {
    const source = readFileSync(resolve(process.cwd(), 'functions/api/content-intelligence/analyze-url.ts'), 'utf8')
    expect(source).not.toContain('BROWSER_RENDERER')
    expect(source).not.toContain('renderArticleFallback')
    expect(source).not.toContain('RendererBinding')
    expect(source).not.toMatch(/\bfetch\s*\(/)
    expect(source).toContain('telemetryKey: env.SCRAPE_TELEMETRY_KEY')
    expect(source).not.toMatch(/telemetryKey:\s*env\.JWT_SECRET/)
  })
})
