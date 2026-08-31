import { expect, test } from '@playwright/test'
import {
  SafeFetchError,
  isUnsafeAddress,
  parseSafeOutboundUrl,
  safeFetchText,
  type HostnameResolver,
} from '../../../functions/api/_shared/safe-fetch'

const publicResolver: HostnameResolver = async () => ['93.184.216.34', '2606:2800:220:1:248:1893:25c8:1946']

test.describe('safe outbound fetch policy @smoke', () => {
  test('@smoke rejects protocols, credentials, ports, and private or reserved literal addresses', () => {
    const blocked = [
      'file:///etc/passwd',
      'ftp://example.com/file',
      'https://user:password@example.com/',
      'https://example.com:8443/',
      'http://localhost/',
      'http://localhost./',
      'http://127.0.0.1/',
      'http://2130706433/',
      'http://169.254.169.254/latest/meta-data/',
      'http://[::1]/',
      'http://[::ffff:127.0.0.1]/',
      'http://[fe80::1]/',
      'http://[fc00::1]/',
    ]

    for (const url of blocked) {
      expect(() => parseSafeOutboundUrl(url), url).toThrow(SafeFetchError)
    }
    expect(parseSafeOutboundUrl('https://example.com/path').href).toBe('https://example.com/path')
  })

  test('@smoke classifies private, reserved, and public DNS answers', () => {
    expect(isUnsafeAddress('10.0.0.1')).toBe(true)
    expect(isUnsafeAddress('100.64.0.1')).toBe(true)
    expect(isUnsafeAddress('192.0.2.10')).toBe(true)
    expect(isUnsafeAddress('2001:db8::1')).toBe(true)
    expect(isUnsafeAddress('93.184.216.34')).toBe(false)
    expect(isUnsafeAddress('2606:2800:220:1:248:1893:25c8:1946')).toBe(false)
    expect(isUnsafeAddress('not-an-address')).toBe(true)
  })

  test('@smoke rejects a hostname if any DNS answer is non-public before fetching', async () => {
    let fetchCalls = 0
    const fetchImpl = (async () => {
      fetchCalls += 1
      return new Response('unexpected')
    }) as typeof fetch

    await expect(safeFetchText('https://mixed.example.com/', {
      fetchImpl,
      resolveHostname: async () => ['93.184.216.34', '10.0.0.2'],
    })).rejects.toMatchObject({ code: 'unsafe_url' })
    expect(fetchCalls).toBe(0)
  })

  test('@smoke uses manual redirects and revalidates every redirect destination', async () => {
    const fetchedUrls: string[] = []
    const resolvedHosts: string[] = []
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      fetchedUrls.push(String(input))
      expect(init?.redirect).toBe('manual')
      return new Response(null, {
        status: 302,
        headers: { Location: 'http://private.example.com/admin' },
      })
    }) as typeof fetch
    const resolver: HostnameResolver = async hostname => {
      resolvedHosts.push(hostname)
      return hostname === 'private.example.com' ? ['127.0.0.1'] : ['93.184.216.34']
    }

    await expect(safeFetchText('https://public.example.com/start', {
      fetchImpl,
      resolveHostname: resolver,
    })).rejects.toMatchObject({ code: 'unsafe_url' })
    expect(fetchedUrls).toEqual(['https://public.example.com/start'])
    expect(resolvedHosts).toEqual(['public.example.com', 'private.example.com'])
  })

  test('@smoke returns bounded text after safe relative redirects', async () => {
    const fetchedUrls: string[] = []
    const fetchImpl = (async (input: RequestInfo | URL) => {
      const url = String(input)
      fetchedUrls.push(url)
      if (url.endsWith('/start')) {
        return new Response(null, { status: 301, headers: { Location: '/article' } })
      }
      return new Response('<html><title>Safe</title></html>', {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      })
    }) as typeof fetch

    const result = await safeFetchText('https://public.example.com/start', {
      fetchImpl,
      resolveHostname: publicResolver,
      maxResponseBytes: 1_024,
    })
    expect(result.text).toContain('<title>Safe</title>')
    expect(result.finalUrl).toBe('https://public.example.com/article')
    expect(result.redirects).toEqual(['https://public.example.com/article'])
    expect(fetchedUrls).toEqual([
      'https://public.example.com/start',
      'https://public.example.com/article',
    ])
  })

  test('@smoke rejects unsupported content types and oversized streamed bodies', async () => {
    const binaryFetch = (async () => new Response('binary', {
      headers: { 'Content-Type': 'application/octet-stream' },
    })) as typeof fetch
    await expect(safeFetchText('https://public.example.com/file', {
      fetchImpl: binaryFetch,
      resolveHostname: publicResolver,
    })).rejects.toMatchObject({ code: 'unsupported_content_type' })

    const oversizedFetch = (async () => new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(6))
        controller.enqueue(new Uint8Array(6))
        controller.close()
      },
    }), { headers: { 'Content-Type': 'text/plain' } })) as typeof fetch
    await expect(safeFetchText('https://public.example.com/large', {
      fetchImpl: oversizedFetch,
      resolveHostname: publicResolver,
      maxResponseBytes: 10,
    })).rejects.toMatchObject({ code: 'response_too_large' })
  })

  test('@smoke applies one total deadline across resolution and fetch', async () => {
    const hangingFetch = (async (_input: RequestInfo | URL, init?: RequestInit) => (
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true })
      })
    )) as typeof fetch

    await expect(safeFetchText('https://public.example.com/slow', {
      fetchImpl: hangingFetch,
      resolveHostname: publicResolver,
      timeoutMs: 5,
    })).rejects.toMatchObject({ code: 'timeout' })
  })
})
