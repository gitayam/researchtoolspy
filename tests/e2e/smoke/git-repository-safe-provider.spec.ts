import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { onRequestGet, onRequestPost } from '../../../functions/api/content-intelligence/git-repository-extract'

interface ProviderCall { url: URL; headers: Headers; redirect: RequestRedirect | undefined }

class MemoryCache {
  readonly values = new Map<string, string>()
  readonly gets: string[] = []
  readonly puts: string[] = []
  async get(key: string): Promise<string | null> { this.gets.push(key); return this.values.get(key) ?? null }
  async put(key: string, value: string): Promise<void> { this.puts.push(key); this.values.set(key, value) }
}

const sessions = { get: async (token: string) => token === 'route-token' ? JSON.stringify({ user_id: 7 }) : null }

function request(body: Record<string, unknown>, authenticated = true): Request {
  return new Request('https://researchtools.example/api/content-intelligence/git-repository-extract', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authenticated ? {
        Authorization: 'Bearer route-token',
        Cookie: 'inbound-cookie-secret',
        'X-User-Hash': 'inbound-user-hash-secret',
        'X-Workspace-ID': 'inbound-workspace-secret',
      } : {}),
    },
    body: JSON.stringify(body),
  })
}

function invoke(body: Record<string, unknown>, options: { authenticated?: boolean; cache?: MemoryCache; githubToken?: string } = {}) {
  const cache = options.cache ?? new MemoryCache()
  return onRequestPost({
    request: request(body, options.authenticated ?? true),
    env: { SESSIONS: sessions, CACHE: cache, GITHUB_TOKEN: options.githubToken },
    params: {},
  } as never)
}

function dnsResponse(type: 'A' | 'AAAA', addresses?: string[]) {
  const defaults = type === 'A' ? ['93.184.216.34'] : ['2606:2800:220:1:248:1893:25c8:1946']
  return Response.json({
    Status: 0,
    Answer: (addresses ?? defaults).map(data => ({ type: type === 'A' ? 1 : 28, data })),
  })
}

function installNetwork(target: (call: ProviderCall) => Response | Promise<Response>, dns?: (hostname: string, type: 'A' | 'AAAA') => string[]) {
  const original = globalThis.fetch
  const calls: ProviderCall[] = []
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input))
    if (url.hostname === 'cloudflare-dns.com') {
      const type = url.searchParams.get('type') === 'AAAA' ? 'AAAA' : 'A'
      return dnsResponse(type, dns?.(url.searchParams.get('name') || '', type))
    }
    const call = { url, headers: new Headers(init?.headers), redirect: init?.redirect }
    calls.push(call)
    return target(call)
  }) as typeof fetch
  return { calls, restore: () => { globalThis.fetch = original } }
}

function githubPrimary(isPrivate = false) {
  return {
    private: isPrivate,
    name: 'demo', full_name: 'acme/demo', owner: { login: 'acme' },
    description: 'Public demo', homepage: 'https://demo.example', language: 'TypeScript',
    stargazers_count: 12, forks_count: 3, watchers_count: 4, open_issues_count: 2,
    license: { name: 'MIT' }, topics: ['research'], created_at: '2020-01-01', updated_at: '2026-01-01',
    pushed_at: '2026-08-31', size: 42, default_branch: 'main', archived: false, fork: false,
  }
}

function base64Utf8(value: string): string {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function githubTarget(call: ProviderCall, primary = githubPrimary()): Response {
  const path = call.url.pathname
  if (path === '/repos/acme/demo') return Response.json(primary)
  if (path.endsWith('/readme')) return Response.json({ encoding: 'base64', content: base64Utf8(`héllo ${'x'.repeat(5100)}`) })
  if (path.endsWith('/languages')) return Response.json({ TypeScript: 100, CSS: 20 })
  if (path.endsWith('/commits')) return Response.json([{
    sha: 'abcdef123456', commit: { message: 'Bounded commit\nbody', author: { name: 'Alice', date: '2026-08-31' } },
    html_url: 'https://attacker.example/output-only-commit',
  }])
  if (path.endsWith('/releases/latest')) return Response.json({
    name: 'Release', tag_name: 'v1', published_at: '2026-08-30',
    html_url: 'https://attacker.example/output-only-release', body: 'Notes',
  })
  if (path.endsWith('/contributors')) return Response.json([{}], { headers: { Link: '<https://api.github.com/x?page=9>; rel="last"' } })
  return new Response('unexpected', { status: 500, headers: { 'Content-Type': 'text/plain' } })
}

test.describe('git repository fixed-provider route @smoke', () => {
  test.describe.configure({ mode: 'serial' })

  test('@smoke authenticates and rejects spoofed or non-canonical targets before cache, DNS, or provider', async () => {
    const cache = new MemoryCache()
    let networkCalls = 0
    const original = globalThis.fetch
    globalThis.fetch = (async () => { networkCalls += 1; throw new Error('must not run') }) as typeof fetch
    try {
      const unauthenticated = await invoke({ url: 'https://github.com/acme/demo' }, { authenticated: false, cache })
      expect(unauthenticated.status).toBe(401)
      expect(await unauthenticated.json()).toEqual({ error: 'Authentication required' })
      const missing = await invoke({}, { cache })
      expect(missing.status).toBe(400)
      expect(await missing.json()).toEqual({ success: false, error: 'URL is required' })

      const rejected = [
        { url: 'http://github.com/acme/demo' },
        { url: 'https://github.com:443/acme/demo' },
        { url: 'https://user:pass@github.com/acme/demo' },
        { url: 'https://github.com/acme/demo?token=raw-secret' },
        { url: 'https://github.com/acme/demo#fragment' },
        { url: 'https://evil.example/path/github.com/acme/demo' },
        { url: 'https://github.com/acme/demo/issues' },
        { url: 'https://github.com/acme/./demo' },
        { url: 'https://gitlab.com/group/-/issues' },
        { url: 'https://gitlab.com/group/%64emo' },
        { url: 'https://bitbucket.org/workspace/demo', platform: 'github' },
      ]
      for (const body of rejected) expect((await invoke(body, { cache })).status).toBeGreaterThanOrEqual(400)
      expect(networkCalls).toBe(0)
      expect(cache.gets).toEqual([])
      expect(cache.puts).toEqual([])
    } finally { globalThis.fetch = original }
  })

  test('@smoke preserves GitHub response shape, scopes headers, decodes README, and uses opaque canonical cache identity', async () => {
    const cache = new MemoryCache()
    const network = installNetwork(call => githubTarget(call))
    try {
      const response = await invoke({ url: 'https://github.com/acme/demo.git/', platform: 'github' }, {
        cache, githubToken: 'github-provider-secret',
      })
      const body = await response.json() as Record<string, unknown>
      expect(response.status).toBe(200)
      expect(body).toMatchObject({
        success: true, platform: 'github',
        repository: { name: 'demo', fullName: 'acme/demo', owner: 'acme', stars: 12, languages: { TypeScript: 100, CSS: 20 } },
        readme: { content: expect.stringContaining('héllo'), truncated: true },
        latestCommit: { sha: 'abcdef1', message: 'Bounded commit', url: 'https://attacker.example/output-only-commit' },
        latestRelease: { tag: 'v1', url: 'https://attacker.example/output-only-release' },
        contributors: 9,
      })
      expect((body.readme as { content: string }).content).toHaveLength(5000)
      expect(network.calls).toHaveLength(6)
      for (const call of network.calls) {
        expect(call.url.origin).toBe('https://api.github.com')
        expect(call.redirect).toBe('manual')
        expect(call.headers.get('authorization')).toBe('token github-provider-secret')
        expect(call.headers.get('accept')).toBe('application/vnd.github.v3+json')
        expect(call.headers.get('user-agent')).toBe('ResearchTools-ContentIntelligence')
        expect(call.headers.has('cookie')).toBe(false)
        expect(call.headers.has('x-user-hash')).toBe(false)
        expect(call.headers.has('x-workspace-id')).toBe(false)
      }
      expect(network.calls.some(call => call.url.hostname === 'attacker.example')).toBe(false)
      expect(cache.puts).toHaveLength(1)
      expect(cache.puts[0]).toMatch(/^git-repository:v2:[a-f0-9]{64}$/)
      expect(cache.puts[0]).not.toContain('acme')
      expect(cache.puts[0]).not.toContain('demo')

      const second = await invoke({ url: 'https://github.com/acme/demo' }, { cache, githubToken: 'github-provider-secret' })
      expect(second.status).toBe(200)
      expect(network.calls).toHaveLength(6)
      expect(cache.gets.at(-1)).toBe(cache.puts[0])
    } finally { network.restore() }
  })

  test('@smoke treats non-public GitHub payloads as not-found before optional calls and never caches them', async () => {
    const cache = new MemoryCache()
    const network = installNetwork(call => githubTarget(call, githubPrimary(true)))
    try {
      const response = await invoke({ url: 'https://github.com/acme/demo' }, { cache, githubToken: 'github-provider-secret' })
      expect(response.status).toBe(422)
      expect(await response.json()).toEqual({
        success: false, platform: 'github', error: 'Repository not found. It may be private or the URL is incorrect.',
      })
      expect(network.calls).toHaveLength(1)
      expect(network.calls[0].headers.get('authorization')).toBe('token github-provider-secret')
      expect(cache.puts).toEqual([])
    } finally { network.restore() }
  })

  test('@smoke constructs encoded GitLab and Bitbucket API calls and preserves their ordinary envelopes', async () => {
    const network = installNetwork(call => {
      if (call.url.hostname === 'gitlab.com') {
        if (call.url.pathname === '/api/v4/projects/group%2Fsub%2Fdemo') return Response.json({
          name: 'demo', path_with_namespace: 'group/sub/demo', namespace: { name: 'Group' }, default_branch: 'feature/readme',
          description: 'GitLab project', web_url: 'https://gitlab.com/group/sub/demo', star_count: 2, forks_count: 1,
          open_issues_count: 0, topics: ['intel'], created_at: '2020', last_activity_at: '2026', archived: false,
        })
        if (call.url.pathname.endsWith('/repository/files/README.md/raw')) return new Response('GitLab README', { headers: { 'Content-Type': 'text/markdown' } })
        if (call.url.pathname.endsWith('/repository/commits')) return Response.json([{
          short_id: '1234567', title: 'GitLab commit', author_name: 'Bob', created_at: '2026', web_url: 'https://gitlab.com/output',
        }])
        if (call.url.pathname.endsWith('/releases')) return Response.json([{ name: 'GL release', tag_name: 'v2', released_at: '2026', _links: { self: 'https://gitlab.com/release' } }])
      }
      if (call.url.hostname === 'api.bitbucket.org') {
        if (call.url.pathname === '/2.0/repositories/team/demo') return Response.json({
          name: 'demo', full_name: 'team/demo', owner: { display_name: 'Team' }, description: 'Bitbucket repo', website: null,
          language: 'Python', size: 10, created_on: '2020', updated_on: '2026', mainbranch: { name: 'feature/readme' },
        })
        if (call.url.pathname.endsWith('/README.md')) return new Response('Bitbucket README', { headers: { 'Content-Type': 'text/plain' } })
        if (call.url.pathname.endsWith('/commits')) return Response.json({ values: [{
          hash: '7654321abcdef', message: 'Bitbucket commit\nbody', author: { raw: 'Carol' }, date: '2026', links: { html: { href: 'https://bitbucket.org/output' } },
        }] })
      }
      return new Response('unexpected', { status: 500, headers: { 'Content-Type': 'text/plain' } })
    })
    try {
      const gitlab = await invoke({ url: 'https://gitlab.com/group/sub/demo.git/' })
      expect(gitlab.status).toBe(200)
      expect(await gitlab.json()).toMatchObject({
        success: true, platform: 'gitlab', repository: { fullName: 'group/sub/demo', owner: 'Group' },
        readme: { content: 'GitLab README', truncated: false }, latestCommit: { message: 'GitLab commit' }, latestRelease: { tag: 'v2' },
      })
      const gitlabCalls = network.calls.filter(call => call.url.hostname === 'gitlab.com')
      expect(gitlabCalls).toHaveLength(4)
      expect(gitlabCalls[0].url.pathname).toBe('/api/v4/projects/group%2Fsub%2Fdemo')
      expect(gitlabCalls.find(call => call.url.pathname.endsWith('/raw'))?.url.searchParams.get('ref')).toBe('feature/readme')

      const bitbucket = await invoke({ url: 'https://bitbucket.org/team/demo.git/' })
      expect(bitbucket.status).toBe(200)
      expect(await bitbucket.json()).toMatchObject({
        success: true, platform: 'bitbucket', repository: { fullName: 'team/demo', owner: 'Team' },
        readme: { content: 'Bitbucket README', truncated: false }, latestCommit: { message: 'Bitbucket commit' },
      })
      const bitbucketCalls = network.calls.filter(call => call.url.hostname === 'api.bitbucket.org')
      expect(bitbucketCalls).toHaveLength(3)
      expect(bitbucketCalls.some(call => call.url.pathname.includes('/src/feature%2Freadme/README.md'))).toBe(true)
      for (const call of [...gitlabCalls, ...bitbucketCalls]) {
        expect(call.redirect).toBe('manual')
        expect(call.headers.has('authorization')).toBe(false)
      }
    } finally { network.restore() }
  })

  test('@smoke fails primary redirect, mixed DNS, MIME, size, and malformed JSON closed with compatible envelope', async () => {
    const cases: Array<{ name: string; response?: () => Response; mixedDns?: boolean }> = [
      { name: 'redirect', response: () => new Response(null, { status: 302, headers: { Location: 'https://attacker.example/escape' } }) },
      { name: 'mime', response: () => new Response('<html>login</html>', { headers: { 'Content-Type': 'text/html' } }) },
      { name: 'size', response: () => new Response('{}', { headers: { 'Content-Type': 'application/json', 'Content-Length': String(512 * 1024 + 1) } }) },
      {
        name: 'stream-size',
        response: () => new Response(new ReadableStream({
          start(controller) {
            const chunk = new Uint8Array(256 * 1024)
            controller.enqueue(chunk)
            controller.enqueue(chunk)
            controller.enqueue(chunk)
            controller.close()
          },
        }), { headers: { 'Content-Type': 'application/json' } }),
      },
      { name: 'malformed', response: () => new Response('{broken', { headers: { 'Content-Type': 'application/json' } }) },
      { name: 'mixed-dns', mixedDns: true },
    ]
    for (const scenario of cases) {
      const network = installNetwork(
        () => scenario.response?.() ?? Response.json(githubPrimary()),
        (hostname, type) => scenario.mixedDns && hostname === 'api.github.com'
          ? type === 'A' ? ['93.184.216.34', '10.0.0.8'] : []
          : type === 'A' ? ['93.184.216.34'] : [],
      )
      try {
        const response = await invoke({ url: 'https://github.com/acme/demo' })
        expect(response.status, scenario.name).toBe(422)
        expect(await response.json()).toEqual({ success: false, platform: 'github', error: 'GitHub extraction failed' })
        expect(network.calls.some(call => call.url.hostname === 'attacker.example')).toBe(false)
        expect(network.calls).toHaveLength(scenario.mixedDns ? 0 : 1)
      } finally { network.restore() }
    }
  })

  test('@smoke optional failures degrade to successful primary metadata and failures are not cached', async () => {
    const cache = new MemoryCache()
    const network = installNetwork(call => {
      if (call.url.pathname === '/repos/acme/demo') return Response.json(githubPrimary())
      if (call.url.pathname.endsWith('/readme')) {
        return Response.json({ encoding: 'base64', content: '***' })
      }
      return new Response(null, { status: 302, headers: { Location: 'https://attacker.example/optional' } })
    })
    try {
      const response = await invoke({ url: 'https://github.com/acme/demo' }, { cache })
      expect(response.status).toBe(200)
      const body = await response.json() as Record<string, unknown>
      expect(body).toMatchObject({ success: true, platform: 'github', repository: { fullName: 'acme/demo' } })
      expect(body.readme).toBeUndefined()
      expect(body.latestCommit).toBeUndefined()
      expect(body.latestRelease).toBeUndefined()
      expect(network.calls).toHaveLength(6)
      expect(network.calls.some(call => call.url.hostname === 'attacker.example')).toBe(false)
      expect(cache.puts).toHaveLength(1)

      const failureCache = new MemoryCache()
      const failedNetwork = installNetwork(() => new Response('missing', { status: 404, headers: { 'Content-Type': 'application/json' } }))
      try {
        const failed = await invoke({ url: 'https://github.com/acme/missing' }, { cache: failureCache })
        expect(failed.status).toBe(422)
        expect(await failed.json()).toEqual({ success: false, platform: 'github', error: 'Repository not found. It may be private or the URL is incorrect.' })
        expect(failureCache.puts).toEqual([])
      } finally { failedNetwork.restore() }
    } finally { network.restore() }
  })

  test('@smoke source is Worker-native and contains no raw transport or identity logging seam', async () => {
    const source = readFileSync(resolve(process.cwd(), 'functions/api/content-intelligence/git-repository-extract.ts'), 'utf8')
    expect(source).not.toMatch(/\bfetch\s*\(/)
    expect(source).not.toContain('Buffer')
    expect(source).not.toContain('createLogger')
    expect(source).not.toMatch(/console\.(?:log|info|warn|error)\([^\n]*(?:body\.url|repository\.identity|cacheKey)/)
    const getResponse = await onRequestGet({} as never)
    expect(getResponse.status).toBe(405)
    expect(await getResponse.json()).toEqual({ error: 'Method not allowed. Use POST.' })
  })
})
