import { expect, test } from '@playwright/test'
import { parseCanonicalTwitterUrl } from '../../../functions/api/_shared/social-url'
import {
  fetchTwitterProvider,
  type TwitterProviderOptions,
} from '../../../functions/api/_shared/twitter-provider'

const TARGET = parseCanonicalTwitterUrl('https://twitter.com/OpenAI/status/1973141012345678901')!
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
  const options = {
    fetchImpl,
    resolveHostname: async () => PUBLIC_IP,
  } satisfies TwitterProviderOptions
  return { calls, options }
}

test.describe('bounded Twitter/X provider @smoke', () => {
  test('@smoke uses only the canonical identity and emits bounded text, not provider HTML', async () => {
    const provider = installProvider(jsonResponse({
      html: '<blockquote><p>Hello &amp; goodbye<br>second line <a href="https://attacker.example">link</a></p></blockquote>',
      author_name: 'OpenAI',
      author_url: 'https://attacker.example/credential-leak',
    }))
    const result = await fetchTwitterProvider(TARGET, provider.options)
    expect(result).toEqual({
      success: true,
      metadata: {
        text: 'Hello & goodbye\nsecond line link',
        authorName: 'OpenAI',
        authorHandle: '@openai',
        authorUrl: 'https://x.com/openai',
      },
    })
    expect(provider.calls).toHaveLength(1)
    const call = provider.calls[0]
    expect(call.url.origin + call.url.pathname).toBe('https://publish.x.com/oembed')
    expect(call.url.searchParams.get('url')).toBe(TARGET.canonicalUrl)
    expect(call.url.searchParams.get('omit_script')).toBe('true')
    expect(call.url.searchParams.get('dnt')).toBe('true')
    expect(call.url.searchParams.get('hide_thread')).toBe('true')
    expect(call.init?.redirect).toBe('manual')
    expect(new Headers(call.init?.headers).get('authorization')).toBeNull()
    expect(JSON.stringify(result)).not.toContain('<blockquote')
    expect(JSON.stringify(result)).not.toContain('attacker.example')
  })

  test('@smoke rejects forged targets before DNS or transport', async () => {
    let resolutions = 0
    const provider = installProvider(() => { throw new Error('must not fetch') })
    const result = await fetchTwitterProvider({
      ...TARGET,
      canonicalUrl: 'https://attacker.example/openai/status/1973141012345678901',
    }, { ...provider.options, resolveHostname: async () => { resolutions += 1; return PUBLIC_IP } })
    expect(result).toEqual({ success: false, failure: { stage: 'target', code: 'invalid_target' } })
    expect(provider.calls).toEqual([])
    expect(resolutions).toBe(0)
  })

  test('@smoke snapshots target identity before provider DNS work', async () => {
    const mutable = { ...TARGET }
    const provider = installProvider(jsonResponse({ html: '<p>bounded text</p>', author_name: 'OpenAI' }))
    const result = await fetchTwitterProvider(mutable, {
      ...provider.options,
      resolveHostname: async () => {
        mutable.username = 'attacker'
        mutable.tweetId = '1'
        mutable.canonicalUrl = 'https://x.com/attacker/status/1'
        return PUBLIC_IP
      },
    })
    expect(result.success).toBe(true)
    expect(provider.calls[0].url.searchParams.get('url')).toBe(TARGET.canonicalUrl)
    expect(result.metadata?.authorHandle).toBe('@openai')
  })

  test('@smoke rejects redirects, wrong MIME, malformed JSON, and oversized typed fields', async () => {
    const cases: Array<[Response, string]> = [
      [new Response(null, { status: 302, headers: { Location: 'https://attacker.example' } }), 'policy'],
      [new Response('{}', { headers: { 'Content-Type': 'text/html' } }), 'invalid_response'],
      [new Response('{broken', { headers: { 'Content-Type': 'application/json' } }), 'invalid_response'],
      [jsonResponse({ html: `<p>${'x'.repeat(10_001)}</p>`, author_name: 'OpenAI' }), 'invalid_response'],
      [jsonResponse({ html: '<p>valid</p>', author_name: 'x'.repeat(257) }), 'invalid_response'],
    ]
    for (const [response, code] of cases) {
      const provider = installProvider(response)
      const result = await fetchTwitterProvider(TARGET, provider.options)
      expect(result).toEqual({ success: false, failure: { stage: 'oembed', code } })
    }
  })

  test('@smoke treats an already-aborted caller as terminal before DNS or transport', async () => {
    const controller = new AbortController()
    controller.abort(new Error('caller stopped'))
    let resolutions = 0
    const provider = installProvider(() => { throw new Error('must not fetch') })
    const result = await fetchTwitterProvider(TARGET, {
      ...provider.options,
      signal: controller.signal,
      resolveHostname: async () => { resolutions += 1; return PUBLIC_IP },
    })
    expect(result).toEqual({ success: false, failure: { stage: 'target', code: 'aborted' } })
    expect(provider.calls).toEqual([])
    expect(resolutions).toBe(0)
  })
})
