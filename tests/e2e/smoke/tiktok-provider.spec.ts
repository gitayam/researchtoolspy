import { expect, test } from '@playwright/test'
import { parseCanonicalTikTokUrl } from '../../../functions/api/_shared/social-url'
import { fetchTikTokProvider, type TikTokProviderOptions } from '../../../functions/api/_shared/tiktok-provider'

const TARGET = parseCanonicalTikTokUrl('https://tiktok.com/@Scout2015/video/6718335390845095173')!
const PUBLIC_IP = ['93.184.216.34']

function jsonResponse(value: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers)
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  return new Response(JSON.stringify(value), { ...init, headers })
}

function installProvider(response: Response | ((url: URL, init?: RequestInit) => Response)) {
  const calls: Array<{ url: URL; init?: RequestInit }> = []
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input))
    calls.push({ url, init })
    return typeof response === 'function' ? response(url, init) : response
  }) as typeof fetch
  const options = { fetchImpl, resolveHostname: async () => PUBLIC_IP } satisfies TikTokProviderOptions
  return { calls, options }
}

test.describe('bounded TikTok provider @smoke', () => {
  test('@smoke sends only canonical identity and ignores provider HTML and URLs', async () => {
    const provider = installProvider(jsonResponse({
      title: 'Bounded description',
      author_name: 'Scout',
      author_url: 'https://attacker.example/unsafe',
      thumbnail_url: 'https://attacker.example/image',
      html: '<script src="https://attacker.example/script"></script>',
    }))
    const result = await fetchTikTokProvider(TARGET, provider.options)
    expect(result).toEqual({
      success: true,
      metadata: {
        description: 'Bounded description',
        authorName: 'Scout',
        authorHandle: '@scout2015',
        authorUrl: 'https://www.tiktok.com/@scout2015',
      },
    })
    expect(provider.calls).toHaveLength(1)
    expect(provider.calls[0].url.href).toBe(`https://www.tiktok.com/oembed?url=${encodeURIComponent(TARGET.canonicalUrl)}`)
    expect(provider.calls[0].init?.redirect).toBe('manual')
    expect(JSON.stringify(result)).not.toContain('attacker.example')
  })

  test('@smoke rejects forged target before DNS and transport', async () => {
    let resolutions = 0
    const provider = installProvider(() => { throw new Error('must not fetch') })
    const result = await fetchTikTokProvider({ ...TARGET, canonicalUrl: 'https://attacker.example/video' }, {
      ...provider.options,
      resolveHostname: async () => { resolutions += 1; return PUBLIC_IP },
    })
    expect(result).toEqual({ success: false, failure: { stage: 'target', code: 'invalid_target' } })
    expect(provider.calls).toEqual([])
    expect(resolutions).toBe(0)
  })

  test('@smoke snapshots canonical identity before DNS work', async () => {
    const mutable = { ...TARGET }
    const provider = installProvider(jsonResponse({ title: 'Description', author_name: 'Scout' }))
    const result = await fetchTikTokProvider(mutable, {
      ...provider.options,
      resolveHostname: async () => {
        mutable.username = 'attacker'
        mutable.canonicalUrl = 'https://www.tiktok.com/@attacker/video/1'
        return PUBLIC_IP
      },
    })
    expect(result.success).toBe(true)
    expect(provider.calls[0].url.searchParams.get('url')).toBe(TARGET.canonicalUrl)
    expect(result.metadata?.authorHandle).toBe('@scout2015')
  })

  test('@smoke rejects redirects, wrong MIME, malformed JSON, and oversized fields', async () => {
    const cases: Array<[Response, string]> = [
      [new Response(null, { status: 302, headers: { Location: 'https://attacker.example' } }), 'policy'],
      [new Response('{}', { headers: { 'Content-Type': 'text/html' } }), 'invalid_response'],
      [new Response('{broken', { headers: { 'Content-Type': 'application/json' } }), 'invalid_response'],
      [jsonResponse({ title: 'x'.repeat(4_097), author_name: 'Scout' }), 'invalid_response'],
      [jsonResponse({ title: 'Description', author_name: 'x'.repeat(257) }), 'invalid_response'],
    ]
    for (const [response, code] of cases) {
      const provider = installProvider(response)
      expect(await fetchTikTokProvider(TARGET, provider.options))
        .toEqual({ success: false, failure: { stage: 'oembed', code } })
    }
  })

  test('@smoke pre-aborted caller performs no DNS or transport work', async () => {
    const controller = new AbortController()
    controller.abort(new Error('caller stopped'))
    let resolutions = 0
    const provider = installProvider(() => { throw new Error('must not fetch') })
    const result = await fetchTikTokProvider(TARGET, {
      ...provider.options,
      signal: controller.signal,
      resolveHostname: async () => { resolutions += 1; return PUBLIC_IP },
    })
    expect(result).toEqual({ success: false, failure: { stage: 'target', code: 'aborted' } })
    expect(provider.calls).toEqual([])
    expect(resolutions).toBe(0)
  })
})
