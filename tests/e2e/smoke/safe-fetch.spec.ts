import { expect, test } from '@playwright/test'
import {
  SAFE_FETCH_ERROR_CODES,
  SafeFetchError,
  isUnsafeAddress,
  parseSafeOutboundUrl,
  safeFetchText,
  type HostnameResolver,
  type SafeFetchErrorCode,
} from '../../../functions/api/_shared/safe-fetch'
import { safeFetchFailureResponse } from '../../../functions/api/web-scraper'

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

  test('@smoke denies IPv4-embedded and non-global special IPv6 forms', () => {
    const blocked = [
      '::7f00:1', // IPv4-compatible
      '::ffff:0:7f00:1', // IPv4-translated
      '64:ff9b::7f00:1', // well-known NAT64
      '64:ff9b:1::1', // local-use NAT64
      '100::1', // discard-only
      '2001:0:4136:e378:8000:63bf:3fff:fdd2', // Teredo
      '2002:7f00:1::', // 6to4
      '2001:2::1', // benchmarking
      '2001:10::1', // ORCHID
      '3fff::1', // documentation
      '5f00::1', // segment-routing special range
      'fec0::1', // deprecated site-local
    ]
    for (const address of blocked) expect(isUnsafeAddress(address), address).toBe(true)
  })

  test('@smoke fails DNS closed when either A or AAAA lookup errors', async () => {
    const originalFetch = globalThis.fetch
    let outboundCalls = 0
    let failedDnsBodyCancelled = false
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const query = new URL(String(input))
      if (query.searchParams.get('type') === 'AAAA') {
        return new Response(new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('resolver failure'))
          },
          async cancel() {
            await Promise.resolve()
            failedDnsBodyCancelled = true
          },
        }), { status: 503 })
      }
      return new Response(JSON.stringify({
        Status: 0,
        Answer: [{ type: 1, data: '93.184.216.34' }],
      }), { headers: { 'Content-Type': 'application/json' } })
    }) as typeof fetch

    try {
      await expect(safeFetchText('https://public.example.com/', {
        fetchImpl: (async () => {
          outboundCalls += 1
          return new Response('unexpected')
        }) as typeof fetch,
      })).rejects.toMatchObject({ code: 'dns_resolution_failed' })
      expect(outboundCalls).toBe(0)
      expect(failedDnsBodyCancelled).toBe(true)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('@smoke permits only bodyless GET/HEAD requests', async () => {
    let fetchCalls = 0
    const fetchImpl = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      fetchCalls += 1
      expect(init?.method).toBe('HEAD')
      return new Response(null, { status: 200 })
    }) as typeof fetch

    await expect(safeFetchText('https://public.example.com/', {
      fetchImpl,
      resolveHostname: publicResolver,
      requestInit: { method: 'POST' },
    })).rejects.toMatchObject({ code: 'unsafe_method' })
    await expect(safeFetchText('https://public.example.com/', {
      fetchImpl,
      resolveHostname: publicResolver,
      requestInit: { method: 'GET', body: 'secret' },
    })).rejects.toMatchObject({ code: 'unsafe_method' })

    const head = await safeFetchText('https://public.example.com/', {
      fetchImpl,
      resolveHostname: publicResolver,
      requestInit: { method: 'HEAD' },
    })
    expect(head.text).toBe('')
    expect(fetchCalls).toBe(1)
  })

  test('@smoke rejects credentials and strips transport identity headers', async () => {
    let fetchCalls = 0
    await expect(safeFetchText('https://public.example.com/', {
      fetchImpl: (async () => {
        fetchCalls += 1
        return new Response('unexpected')
      }) as typeof fetch,
      resolveHostname: publicResolver,
      requestInit: { headers: { Authorization: 'Bearer secret' } },
    })).rejects.toMatchObject({ code: 'unsafe_headers' })
    expect(fetchCalls).toBe(0)
    await expect(safeFetchText('https://public.example.com/', {
      fetchImpl: (async () => new Response('unexpected')) as typeof fetch,
      resolveHostname: publicResolver,
      requestInit: { headers: { 'Bad Header': 'value' } },
    })).rejects.toMatchObject({ code: 'unsafe_headers' })

    const fetchImpl = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers)
      expect(headers.has('connection')).toBe(false)
      expect(headers.has('host')).toBe(false)
      expect(headers.has('x-forwarded-for')).toBe(false)
      expect(headers.has('x-auth-token')).toBe(false)
      return new Response('ok', { headers: { 'Content-Type': 'text/plain' } })
    }) as typeof fetch
    await safeFetchText('https://public.example.com/', {
      fetchImpl,
      resolveHostname: publicResolver,
      requestInit: {
        headers: {
          Connection: 'keep-alive',
          Host: 'internal.example',
          'X-Forwarded-For': '127.0.0.1',
          'X-Auth-Token': 'custom-secret',
        },
      },
    })
  })

  test('@smoke preserves GET across redirects and drops origin headers cross-origin', async () => {
    const requests: Array<{ url: string; method?: string; headers: Headers }> = []
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push({ url: String(input), method: init?.method, headers: new Headers(init?.headers) })
      if (String(input).includes('first.example.com')) {
        return new Response('redirect', {
          status: 302,
          headers: { Location: 'https://second.example.com/article' },
        })
      }
      return new Response('done', { headers: { 'Content-Type': 'text/plain' } })
    }) as typeof fetch

    await safeFetchText('https://first.example.com/start', {
      fetchImpl,
      resolveHostname: publicResolver,
      requestInit: {
        method: 'GET',
        headers: { Origin: 'https://first.example.com', Referer: 'https://first.example.com/start' },
      },
    })
    expect(requests.map(request => request.method)).toEqual(['GET', 'GET'])
    expect(requests[0].headers.has('origin')).toBe(true)
    expect(requests[1].headers.has('origin')).toBe(false)
    expect(requests[1].headers.has('referer')).toBe(false)
  })

  test('@smoke rejects non-finite, fractional, and excessive policy limits', async () => {
    const invalidOptions = [
      { timeoutMs: Number.NaN },
      { timeoutMs: Number.POSITIVE_INFINITY },
      { timeoutMs: 1.5 },
      { timeoutMs: 60_001 },
      { maxRedirects: -1 },
      { maxRedirects: 1.5 },
      { maxRedirects: 11 },
      { maxResponseBytes: 0 },
      { maxResponseBytes: 10 * 1024 * 1024 + 1 },
    ]
    for (const options of invalidOptions) {
      await expect(safeFetchText('https://public.example.com/', {
        ...options,
        fetchImpl: (async () => new Response('unexpected')) as typeof fetch,
        resolveHostname: publicResolver,
      })).rejects.toMatchObject({ code: 'invalid_options' })
    }
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

  test('@smoke awaits body cancellation on every response rejection path', async () => {
    const cancellationState = () => {
      const state = { completed: false }
      const body = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('response body'))
        },
        async cancel() {
          await Promise.resolve()
          state.completed = true
        },
      })
      return { state, body }
    }

    const redirectLimit = cancellationState()
    await expect(safeFetchText('https://public.example.com/', {
      fetchImpl: (async () => new Response(redirectLimit.body, {
        status: 302,
        headers: { Location: '/again' },
      })) as typeof fetch,
      resolveHostname: publicResolver,
      maxRedirects: 0,
    })).rejects.toMatchObject({ code: 'redirect_limit' })
    expect(redirectLimit.state.completed).toBe(true)

    const invalidRedirect = cancellationState()
    await expect(safeFetchText('https://public.example.com/', {
      fetchImpl: (async () => new Response(invalidRedirect.body, {
        status: 302,
        headers: { Location: 'http://[invalid' },
      })) as typeof fetch,
      resolveHostname: publicResolver,
    })).rejects.toMatchObject({ code: 'invalid_url' })
    expect(invalidRedirect.state.completed).toBe(true)

    const unsupported = cancellationState()
    await expect(safeFetchText('https://public.example.com/', {
      fetchImpl: (async () => new Response(unsupported.body, {
        headers: { 'Content-Type': 'application/octet-stream' },
      })) as typeof fetch,
      resolveHostname: publicResolver,
    })).rejects.toMatchObject({ code: 'unsupported_content_type' })
    expect(unsupported.state.completed).toBe(true)

    const declaredTooLarge = cancellationState()
    await expect(safeFetchText('https://public.example.com/', {
      fetchImpl: (async () => new Response(declaredTooLarge.body, {
        headers: { 'Content-Type': 'text/plain', 'Content-Length': '100' },
      })) as typeof fetch,
      resolveHostname: publicResolver,
      maxResponseBytes: 10,
    })).rejects.toMatchObject({ code: 'response_too_large' })
    expect(declaredTooLarge.state.completed).toBe(true)
  })

  test('@smoke applies content type and byte contracts to non-2xx responses', async () => {
    await expect(safeFetchText('https://public.example.com/not-found', {
      fetchImpl: (async () => new Response('binary error', {
        status: 404,
        headers: { 'Content-Type': 'application/octet-stream' },
      })) as typeof fetch,
      resolveHostname: publicResolver,
    })).rejects.toMatchObject({ code: 'unsupported_content_type' })

    await expect(safeFetchText('https://public.example.com/server-error', {
      fetchImpl: (async () => new Response('error body exceeds limit', {
        status: 500,
        headers: { 'Content-Type': 'text/plain' },
      })) as typeof fetch,
      resolveHostname: publicResolver,
      maxResponseBytes: 5,
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

  test('@smoke distinguishes caller cancellation from the total deadline', async () => {
    const caller = new AbortController()
    caller.abort(new Error('caller stopped request'))
    const fetchImpl = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.signal?.aborted) throw init.signal.reason
      return new Response('unexpected')
    }) as typeof fetch

    await expect(safeFetchText('https://public.example.com/cancelled', {
      fetchImpl,
      resolveHostname: publicResolver,
      requestInit: { signal: caller.signal },
    })).rejects.toMatchObject({ code: 'aborted' })
  })

  test('@smoke web scraper explicitly maps every safe-fetch error code', async () => {
    const expectedStatus: Record<SafeFetchErrorCode, number> = {
      invalid_url: 400,
      unsafe_url: 400,
      dns_resolution_failed: 400,
      unsafe_method: 500,
      unsafe_headers: 500,
      invalid_options: 500,
      redirect_limit: 400,
      timeout: 504,
      aborted: 408,
      response_too_large: 400,
      unsupported_content_type: 400,
      network_error: 502,
    }

    for (const code of SAFE_FETCH_ERROR_CODES) {
      const response = safeFetchFailureResponse(new SafeFetchError(code, 'test'))
      expect(response.status, code).toBe(expectedStatus[code])
      const body = await response.json() as { success?: boolean; errorType?: string }
      expect(body.success, code).toBe(false)
      expect(body.errorType, code).toBeTruthy()
    }
  })
})
