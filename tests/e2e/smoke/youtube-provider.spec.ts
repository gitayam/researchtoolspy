import { expect, test } from '@playwright/test'
import { parseCanonicalYouTubeUrl } from '../../../functions/api/_shared/social-url'
import {
  createYouTubeProviderDeadline,
  fetchYouTubeProvider,
  type YouTubeProviderOptions,
} from '../../../functions/api/_shared/youtube-provider'

const VIDEO_ID = 'AbC_dEf-123'
const TARGET = parseCanonicalYouTubeUrl(`https://youtu.be/${VIDEO_ID}`)!
const PUBLIC_IP = ['93.184.216.34']

interface ProviderCall {
  url: URL
  method: string
  headers: Headers
  body?: string
  redirect?: RequestInit['redirect']
  signal?: AbortSignal | null
}

function oembed(overrides: Record<string, unknown> = {}) {
  return {
    title: 'Bounded title',
    author_name: 'Bounded author',
    author_url: 'https://www.youtube.com/@bounded',
    thumbnail_url: 'https://i.ytimg.com/vi/test/default.jpg',
    thumbnail_width: 480,
    thumbnail_height: 360,
    ...overrides,
  }
}

function innertube(baseUrl = 'https://www.youtube.com/api/timedtext?v=AbC_dEf-123&lang=en') {
  return {
    captions: {
      playerCaptionsTracklistRenderer: {
        captionTracks: [{ baseUrl, languageCode: 'en' }],
      },
    },
  }
}

function jsonResponse(value: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers)
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  return new Response(JSON.stringify(value), { ...init, headers })
}

function installProvider(
  target: (call: ProviderCall) => Response | Promise<Response>,
  resolveHostname: NonNullable<YouTubeProviderOptions['resolveHostname']> = async () => PUBLIC_IP,
) {
  const calls: ProviderCall[] = []
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const call: ProviderCall = {
      url: new URL(input instanceof Request ? input.url : String(input)),
      method: String(init?.method ?? 'GET').toUpperCase(),
      headers: new Headers(init?.headers),
      body: typeof init?.body === 'string' ? init.body : undefined,
      redirect: init?.redirect,
      signal: init?.signal,
    }
    calls.push(call)
    return target(call)
  }) as typeof fetch
  return { calls, options: { fetchImpl, resolveHostname } satisfies YouTubeProviderOptions }
}

function ordinaryProvider(call: ProviderCall): Response {
  if (call.url.pathname === '/oembed') return jsonResponse(oembed())
  if (call.url.pathname === '/youtubei/v1/player') return jsonResponse(innertube())
  if (call.url.pathname === '/api/timedtext') {
    return new Response('<transcript><text>Hello &amp; goodbye</text><text>second line</text></transcript>', {
      headers: { 'Content-Type': 'application/xml' },
    })
  }
  throw new Error(`Unexpected transport: ${call.url.href}`)
}

function cancellableResponse(options: {
  status?: number
  headers?: HeadersInit
  firstChunk?: Uint8Array
  hang?: boolean
}) {
  let cancelled = false
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      if (options.firstChunk) controller.enqueue(options.firstChunk)
      if (!options.hang) controller.close()
    },
    cancel() { cancelled = true },
  })
  return {
    response: new Response(stream, { status: options.status, headers: options.headers }),
    wasCancelled: () => cancelled,
  }
}

test.describe('bounded YouTube provider foundation @smoke', () => {
  test('@smoke uses exact methods, URLs, bodies, and headers without raw caller credentials', async () => {
    const provider = installProvider(ordinaryProvider)
    const result = await fetchYouTubeProvider(TARGET, {
      ...provider.options,
      includeTranscript: true,
      includeMedia: true,
      deadline: createYouTubeProviderDeadline(30_000),
    })

    expect(result).toMatchObject({
      success: true,
      metadata: { title: 'Bounded title', authorName: 'Bounded author', thumbnailWidth: 480 },
      transcript: 'Hello & goodbye second line',
      mediaFallback: 'watch_on_youtube',
    })
    expect(provider.calls).toHaveLength(3)
    const oembedCall = provider.calls.find(call => call.url.pathname === '/oembed')!
    expect(oembedCall.url.href).toBe(`https://www.youtube.com/oembed?url=${encodeURIComponent(TARGET.canonicalUrl)}&format=json`)
    expect(oembedCall.method).toBe('GET')
    expect(oembedCall.redirect).toBe('manual')

    const innerCall = provider.calls.find(call => call.url.pathname === '/youtubei/v1/player')!
    expect(innerCall.url.href).toBe('https://www.youtube.com/youtubei/v1/player?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8')
    expect(innerCall.method).toBe('POST')
    expect([...innerCall.headers]).toEqual([['accept', 'application/json'], ['content-type', 'application/json']])
    expect(JSON.parse(innerCall.body!)).toEqual({
      context: { client: { clientName: 'ANDROID', clientVersion: '17.31.35', androidSdkVersion: 30, hl: 'en', gl: 'US' } },
      videoId: VIDEO_ID,
    })

    expect(provider.calls.find(call => call.url.pathname === '/api/timedtext')?.method).toBe('GET')
    for (const call of provider.calls) {
      expect(call.redirect).toBe('manual')
      expect(call.headers.has('authorization')).toBe(false)
      expect(call.headers.has('cookie')).toBe(false)
      expect(call.headers.has('x-user-hash')).toBe(false)
      expect(call.headers.has('x-workspace-id')).toBe(false)
    }
    expect(provider.calls.some(call => call.url.hostname === 'co.wuk.sh' || call.url.hostname === 'media.example')).toBe(false)
  })

  test('@smoke rejects forged canonical targets before DNS or transport', async () => {
    let resolutions = 0
    const provider = installProvider(() => { throw new Error('must not fetch') }, async () => { resolutions += 1; return PUBLIC_IP })
    const result = await fetchYouTubeProvider({
      platform: 'youtube', videoId: VIDEO_ID, canonicalUrl: `https://attacker.example/watch?v=${VIDEO_ID}`,
    }, provider.options)
    expect(result).toEqual({ success: false, failure: { stage: 'target', code: 'invalid_target' } })
    expect(provider.calls).toEqual([])
    expect(resolutions).toBe(0)
  })

  test('@smoke snapshots canonical target identity before any provider await', async () => {
    const mutable = { ...TARGET }
    let mutated = false
    const provider = installProvider(ordinaryProvider, async hostname => {
      if (!mutated) {
        mutated = true
        mutable.videoId = 'ZyX_wVu-987'
        mutable.canonicalUrl = 'https://www.youtube.com/watch?v=ZyX_wVu-987'
      }
      expect(hostname).toBe('www.youtube.com')
      return PUBLIC_IP
    })
    const result = await fetchYouTubeProvider(mutable, { ...provider.options, includeTranscript: true })
    expect(result.success).toBe(true)
    const oembedCall = provider.calls.find(call => call.url.pathname === '/oembed')!
    expect(oembedCall.url.searchParams.get('url')).toBe(TARGET.canonicalUrl)
    const innerCall = provider.calls.find(call => call.url.pathname === '/youtubei/v1/player')!
    expect(JSON.parse(innerCall.body!).videoId).toBe(VIDEO_ID)
  })

  test('@smoke rejects oEmbed redirect without contacting its target and awaits cancellation', async () => {
    const redirect = cancellableResponse({
      status: 302,
      headers: { Location: 'https://attacker.example/escape', 'Content-Type': 'application/json' },
      hang: true,
    })
    const provider = installProvider(() => redirect.response)
    const result = await fetchYouTubeProvider(TARGET, provider.options)
    expect(result).toEqual({ success: false, failure: { stage: 'oembed', code: 'policy' } })
    expect(provider.calls).toHaveLength(1)
    expect(provider.calls.some(call => call.url.hostname === 'attacker.example')).toBe(false)
    expect(redirect.wasCancelled()).toBe(true)
  })

  test('@smoke rejects wrong or missing oEmbed MIME and cancels both bodies', async () => {
    const headerCases: HeadersInit[] = [{ 'Content-Type': 'text/html' }, {}]
    for (const headers of headerCases) {
      const body = cancellableResponse({ headers, firstChunk: new TextEncoder().encode('{}'), hang: true })
      const provider = installProvider(() => body.response)
      const result = await fetchYouTubeProvider(TARGET, provider.options)
      expect(result).toEqual({ success: false, failure: { stage: 'oembed', code: 'invalid_response' } })
      expect(body.wasCancelled()).toBe(true)
    }
  })

  test('@smoke rejects declared and streamed oEmbed overruns with cancellation', async () => {
    const cases = [
      cancellableResponse({ headers: { 'Content-Type': 'application/json', 'Content-Length': String(128 * 1024 + 1) }, hang: true }),
      cancellableResponse({ headers: { 'Content-Type': 'application/json' }, firstChunk: new Uint8Array(128 * 1024 + 1), hang: true }),
    ]
    for (const body of cases) {
      const provider = installProvider(() => body.response)
      const result = await fetchYouTubeProvider(TARGET, provider.options)
      expect(result).toEqual({ success: false, failure: { stage: 'oembed', code: 'policy' } })
      expect(body.wasCancelled()).toBe(true)
    }
  })

  test('@smoke rejects malformed and oversized typed oEmbed payloads', async () => {
    for (const response of [
      new Response('{broken', { headers: { 'Content-Type': 'application/json' } }),
      jsonResponse(oembed({ title: 'x'.repeat(513) })),
    ]) {
      const provider = installProvider(() => response)
      const result = await fetchYouTubeProvider(TARGET, provider.options)
      expect(result).toEqual({ success: false, failure: { stage: 'oembed', code: 'invalid_response' } })
    }
  })

  test('@smoke origin-contains browser-facing oEmbed URLs and omits unsafe optional fields', async () => {
    const unsafeUrls = [
      'https://127.0.0.1/output',
      'https://localhost/output',
      'https://metadata.google.internal/output',
      'https://attacker.example/output',
      'https://www.youtube.com.evil.test/output',
      'https://user@www.youtube.com/output',
      'https://www.youtube.com:443/output',
      'https://www%2eyoutube.com/output',
      'https://www.youtube。com/output',
      'https://www.youtube.com/output#fragment',
      'https://www.youtube.com/\\escape',
      'https://www.youtube.com/output\n',
      'https://www.youtube.com/output%ZZ',
    ]
    for (const value of unsafeUrls) {
      const provider = installProvider(() => jsonResponse(oembed({ author_url: value, thumbnail_url: value })))
      const result = await fetchYouTubeProvider(TARGET, provider.options)
      expect(result.success, value).toBe(true)
      expect(result.metadata?.authorUrl, value).toBeUndefined()
      expect(result.metadata?.thumbnailUrl, value).toBeUndefined()
    }

    const validProvider = installProvider(() => jsonResponse(oembed({
      author_url: 'https://www.youtube.com/@bounded',
      thumbnail_url: 'https://img.youtube.com/vi/test/default.jpg',
      thumbnail_width: 0,
      thumbnail_height: 10_001,
    })))
    const valid = await fetchYouTubeProvider(TARGET, validProvider.options)
    expect(valid.metadata).toMatchObject({
      authorUrl: 'https://www.youtube.com/@bounded',
      thumbnailUrl: 'https://img.youtube.com/vi/test/default.jpg',
      thumbnailWidth: 0,
    })
    expect(valid.metadata?.thumbnailHeight).toBeUndefined()

    for (const dimensions of [
      { thumbnail_width: -1, thumbnail_height: 1 },
      { thumbnail_width: 1.5, thumbnail_height: 1 },
      { thumbnail_width: 10_001, thumbnail_height: 1 },
    ]) {
      const provider = installProvider(() => jsonResponse(oembed(dimensions)))
      const result = await fetchYouTubeProvider(TARGET, provider.options)
      expect(result.metadata?.thumbnailWidth).toBeUndefined()
      expect(result.metadata?.thumbnailHeight).toBe(1)
    }
  })

  test('@smoke treats an already-aborted caller as terminal before DNS or transport', async () => {
    const controller = new AbortController()
    controller.abort(new Error('already stopped'))
    let resolutions = 0
    const provider = installProvider(() => { throw new Error('must not fetch') }, async () => { resolutions += 1; return PUBLIC_IP })
    const result = await fetchYouTubeProvider(TARGET, { ...provider.options, signal: controller.signal })
    expect(result).toEqual({ success: false, failure: { stage: 'target', code: 'aborted' } })
    expect(provider.calls).toEqual([])
    expect(resolutions).toBe(0)
  })

  test('@smoke treats caller abort during oEmbed as terminal and starts no optional work', async () => {
    const controller = new AbortController()
    let bodyCancelled = false
    const provider = installProvider(call => {
      const stream = new ReadableStream<Uint8Array>({
        start(streamController) {
          streamController.enqueue(new TextEncoder().encode('{'))
          call.signal?.addEventListener('abort', () => {
            streamController.enqueue(new Uint8Array(129 * 1024))
          }, { once: true })
          setTimeout(() => controller.abort(new Error('caller stopped')), 5)
        },
        cancel() { bodyCancelled = true },
      })
      return new Response(stream, { headers: { 'Content-Type': 'application/json' } })
    })
    const result = await fetchYouTubeProvider(TARGET, {
      ...provider.options,
      includeTranscript: true,
      includeMedia: true,
      deadline: createYouTubeProviderDeadline(1_000),
      signal: controller.signal,
    })
    expect(result.success).toBe(false)
    expect(result.failure).toEqual({ stage: 'oembed', code: 'aborted' })
    expect(provider.calls).toHaveLength(1)
    expect(bodyCancelled).toBe(true)
  })

  test('@smoke treats caller abort during optional transcript work as terminal and cancels without later work', async () => {
    const controller = new AbortController()
    let hanging: ReturnType<typeof cancellableResponse> | undefined
    const provider = installProvider(call => {
      if (call.url.pathname === '/oembed') return jsonResponse(oembed())
      hanging = cancellableResponse({ headers: { 'Content-Type': 'application/json' }, hang: true })
      setTimeout(() => controller.abort(new Error('caller stopped')), 5)
      return hanging.response
    })
    const result = await fetchYouTubeProvider(TARGET, {
      ...provider.options,
      includeTranscript: true,
      includeMedia: true,
      deadline: createYouTubeProviderDeadline(1_000),
      signal: controller.signal,
    })
    expect(result).toEqual({ success: false, failure: { stage: 'target', code: 'aborted' } })
    expect(provider.calls).toHaveLength(2)
    expect(provider.calls.some(call => call.url.pathname === '/api/timedtext' || call.url.hostname === 'co.wuk.sh')).toBe(false)
    expect(hanging?.wasCancelled()).toBe(true)
  })

  test('@smoke allows optional provider timeout to degrade to bounded metadata success', async () => {
    let deadlineBody: ReturnType<typeof cancellableResponse> | undefined
    const provider = installProvider(call => {
      if (call.url.pathname === '/oembed') return jsonResponse(oembed())
      deadlineBody = cancellableResponse({ headers: { 'Content-Type': 'application/json' }, hang: true })
      return deadlineBody.response
    })
    const timedOut = await fetchYouTubeProvider(TARGET, {
      ...provider.options,
      includeTranscript: true,
      includeMedia: true,
      deadline: createYouTubeProviderDeadline(100),
    })
    expect(timedOut).toMatchObject({
      success: true,
      metadata: { title: 'Bounded title' },
      transcriptFailure: { stage: 'innertube', code: 'deadline' },
      mediaFallback: 'watch_on_youtube',
    })
    expect(deadlineBody?.wasCancelled()).toBe(true)

    const expiredProvider = installProvider(() => { throw new Error('must not fetch') })
    const expired = await fetchYouTubeProvider(TARGET, { ...expiredProvider.options, deadline: { expiresAt: Date.now() - 1 } })
    expect(expired).toEqual({ success: false, failure: { stage: 'target', code: 'deadline' } })
    expect(expiredProvider.calls).toEqual([])
  })

  test('@smoke rejects caption host, path, userinfo, and explicit port before caption transport', async () => {
    const invalid = [
      'https://attacker.example/api/timedtext?v=x',
      'https://www.youtube.com/not-timedtext?v=x',
      'https://user@www.youtube.com/api/timedtext?v=x',
      'https://www.youtube.com:443/api/timedtext?v=x',
      'https://www%2eyoutube.com/api/timedtext?v=x',
      'https://www.youtube。com/api/timedtext?v=x',
      'https://www.youtube.com/api/timedtext?v=bad\\path',
      'https://www.youtube.com/api/timedtext?v=bad%ZZ',
      'https://www.youtube.com/api/timedtext?v=x\n',
    ]
    for (const baseUrl of invalid) {
      const provider = installProvider(call => {
        if (call.url.pathname === '/oembed') return jsonResponse(oembed())
        if (call.url.pathname === '/youtubei/v1/player') return jsonResponse(innertube(baseUrl))
        throw new Error('caption transport must not run')
      })
      const result = await fetchYouTubeProvider(TARGET, { ...provider.options, includeTranscript: true })
      expect(result.transcript).toBeUndefined()
      expect(result.transcriptFailure).toEqual({ stage: 'caption', code: 'policy' })
      expect(provider.calls).toHaveLength(2)
    }
  })

  test('@smoke bounds the InnerTube caption array and its provider strings', async () => {
    const ordinaryTrack = { baseUrl: 'https://www.youtube.com/api/timedtext?v=x', languageCode: 'en' }
    const payloads = [
      { captions: { playerCaptionsTracklistRenderer: { captionTracks: Array.from({ length: 101 }, () => ordinaryTrack) } } },
      innertube(`https://www.youtube.com/api/timedtext?${'x'.repeat(4096)}`),
      { captions: { playerCaptionsTracklistRenderer: { captionTracks: [{ ...ordinaryTrack, languageCode: 'x'.repeat(33) }] } } },
    ]
    for (const payload of payloads) {
      const provider = installProvider(call => call.url.pathname === '/oembed' ? jsonResponse(oembed()) : jsonResponse(payload))
      const result = await fetchYouTubeProvider(TARGET, { ...provider.options, includeTranscript: true })
      expect(result.transcriptFailure).toEqual({ stage: 'innertube', code: 'unavailable' })
      expect(provider.calls).toHaveLength(2)
    }

    const boundaryProvider = installProvider(call => {
      if (call.url.pathname === '/oembed') return jsonResponse(oembed())
      if (call.url.pathname === '/youtubei/v1/player') {
        return jsonResponse({
          captions: { playerCaptionsTracklistRenderer: { captionTracks: Array.from({ length: 100 }, () => ordinaryTrack) } },
        })
      }
      return new Response('<text>boundary accepted</text>', { headers: { 'Content-Type': 'application/xml' } })
    })
    const boundary = await fetchYouTubeProvider(TARGET, { ...boundaryProvider.options, includeTranscript: true })
    expect(boundary.transcript).toBe('boundary accepted')
    expect(boundaryProvider.calls).toHaveLength(3)
  })

  test('@smoke denies private and mixed caption DNS before caption transport', async () => {
    for (const denied of [['10.0.0.8'], ['93.184.216.34', '10.0.0.8']]) {
      const resolvedHosts: string[] = []
      const provider = installProvider(call => {
        if (call.url.pathname === '/oembed') return jsonResponse(oembed())
        if (call.url.pathname === '/youtubei/v1/player') return jsonResponse(innertube())
        throw new Error('caption transport must not run')
      }, async hostname => {
        resolvedHosts.push(hostname)
        return resolvedHosts.length === 3 ? denied : PUBLIC_IP
      })
      const result = await fetchYouTubeProvider(TARGET, { ...provider.options, includeTranscript: true })
      expect(result.transcriptFailure).toEqual({ stage: 'caption', code: 'policy' })
      expect(provider.calls).toHaveLength(2)
      expect(resolvedHosts).toEqual(['www.youtube.com', 'www.youtube.com', 'www.youtube.com'])
    }
  })

  test('@smoke denies private, mixed, and failing InnerTube DNS before POST transport', async () => {
    const deniedResolvers = [
      async () => ['10.0.0.8'],
      async () => ['93.184.216.34', '10.0.0.8'],
      async () => { throw new Error('resolver unavailable') },
    ]
    for (const deniedResolver of deniedResolvers) {
      const resolvedHosts: string[] = []
      const provider = installProvider(call => {
        if (call.url.pathname === '/oembed') return jsonResponse(oembed())
        throw new Error('InnerTube POST transport must not run')
      }, async hostname => {
        resolvedHosts.push(hostname)
        return resolvedHosts.length === 1 ? PUBLIC_IP : deniedResolver()
      })
      const result = await fetchYouTubeProvider(TARGET, { ...provider.options, includeTranscript: true })
      expect(result.success).toBe(true)
      expect(result.transcriptFailure).toEqual({ stage: 'innertube', code: 'policy' })
      expect(provider.calls).toHaveLength(1)
      expect(resolvedHosts).toEqual(['www.youtube.com', 'www.youtube.com'])
    }
  })

  test('@smoke treats caption redirects as terminal and parses valid bounded XML', async () => {
    const redirectProvider = installProvider(call => {
      if (call.url.pathname === '/oembed') return jsonResponse(oembed())
      if (call.url.pathname === '/youtubei/v1/player') return jsonResponse(innertube())
      return new Response(null, { status: 302, headers: { Location: 'https://attacker.example/transcript' } })
    })
    const redirected = await fetchYouTubeProvider(TARGET, { ...redirectProvider.options, includeTranscript: true })
    expect(redirected.transcriptFailure).toEqual({ stage: 'caption', code: 'policy' })
    expect(redirectProvider.calls).toHaveLength(3)
    expect(redirectProvider.calls.some(call => call.url.hostname === 'attacker.example')).toBe(false)

    const validProvider = installProvider(ordinaryProvider)
    const valid = await fetchYouTubeProvider(TARGET, { ...validProvider.options, includeTranscript: true })
    expect(valid.transcript).toBe('Hello & goodbye second line')

    const cappedProvider = installProvider(call => {
      if (call.url.pathname === '/oembed') return jsonResponse(oembed())
      if (call.url.pathname === '/youtubei/v1/player') return jsonResponse(innertube())
      return new Response(`<text>${'x'.repeat(200_001)}</text>`, { headers: { 'Content-Type': 'text/xml' } })
    })
    const capped = await fetchYouTubeProvider(TARGET, { ...cappedProvider.options, includeTranscript: true })
    expect(capped.transcript).toHaveLength(200_000)
  })

  test('@smoke enforces InnerTube and caption byte ceilings with awaited cancellation', async () => {
    const innerBody = cancellableResponse({
      headers: { 'Content-Type': 'application/json', 'Content-Length': String(512 * 1024 + 1) },
      hang: true,
    })
    const innerProvider = installProvider(call => call.url.pathname === '/oembed' ? jsonResponse(oembed()) : innerBody.response)
    const innerResult = await fetchYouTubeProvider(TARGET, { ...innerProvider.options, includeTranscript: true })
    expect(innerResult.transcriptFailure).toEqual({ stage: 'innertube', code: 'policy' })
    expect(innerBody.wasCancelled()).toBe(true)

    let captionBody: ReturnType<typeof cancellableResponse> | undefined
    const captionProvider = installProvider(call => {
      if (call.url.pathname === '/oembed') return jsonResponse(oembed())
      if (call.url.pathname === '/youtubei/v1/player') return jsonResponse(innertube())
      captionBody = cancellableResponse({
        headers: { 'Content-Type': 'application/xml' },
        firstChunk: new Uint8Array(512 * 1024 + 1),
        hang: true,
      })
      return captionBody.response
    })
    const captionResult = await fetchYouTubeProvider(TARGET, { ...captionProvider.options, includeTranscript: true })
    expect(captionResult.transcriptFailure).toEqual({ stage: 'caption', code: 'policy' })
    expect(captionBody?.wasCancelled()).toBe(true)
  })

  test('@smoke makes InnerTube MIME failure optional with awaited cleanup', async () => {
    const rejected = cancellableResponse({ headers: {}, firstChunk: new TextEncoder().encode('{}'), hang: true })
    const provider = installProvider(call => call.url.pathname === '/oembed' ? jsonResponse(oembed()) : rejected.response)
    const result = await fetchYouTubeProvider(TARGET, { ...provider.options, includeTranscript: true })
    expect(result.success).toBe(true)
    expect(result.transcriptFailure).toEqual({ stage: 'innertube', code: 'invalid_response' })
    expect(rejected.wasCancelled()).toBe(true)
  })

  test('@smoke treats InnerTube redirect as terminal and never contacts its target', async () => {
    const redirect = cancellableResponse({
      status: 302,
      headers: { Location: 'https://attacker.example/provider-escape', 'Content-Type': 'application/json' },
      hang: true,
    })
    const provider = installProvider(call => call.url.pathname === '/oembed' ? jsonResponse(oembed()) : redirect.response)
    const result = await fetchYouTubeProvider(TARGET, { ...provider.options, includeTranscript: true })
    expect(result.transcriptFailure).toEqual({ stage: 'innertube', code: 'policy' })
    expect(provider.calls).toHaveLength(2)
    expect(provider.calls.some(call => call.url.hostname === 'attacker.example')).toBe(false)
    expect(redirect.wasCancelled()).toBe(true)
  })

  test('@smoke emits only a typed watch fallback for media/full mode with zero media provider or DNS work', async () => {
    for (const includeTranscript of [false, true]) {
      const resolvedHosts: string[] = []
      const provider = installProvider(ordinaryProvider, async hostname => {
        resolvedHosts.push(hostname)
        return PUBLIC_IP
      })
      const result = await fetchYouTubeProvider(TARGET, {
        ...provider.options,
        includeMedia: true,
        includeTranscript,
      })
      expect(result.success).toBe(true)
      expect(result.mediaFallback).toBe('watch_on_youtube')
      expect(provider.calls.every(call => call.url.hostname === 'www.youtube.com')).toBe(true)
      expect(resolvedHosts.every(hostname => hostname === 'www.youtube.com')).toBe(true)
      expect(provider.calls).toHaveLength(includeTranscript ? 3 : 1)
      expect(resolvedHosts).toHaveLength(includeTranscript ? 3 : 1)
    }
  })
})
