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
  if (call.url.hostname === 'co.wuk.sh') return jsonResponse({ status: 'stream', url: 'https://media.example/video.mp4' })
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
      mediaUrl: 'https://media.example/video.mp4',
    })
    expect(provider.calls).toHaveLength(4)
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

    const cobaltCall = provider.calls.find(call => call.url.hostname === 'co.wuk.sh')!
    expect(cobaltCall.url.href).toBe('https://co.wuk.sh/api/json')
    expect(cobaltCall.method).toBe('POST')
    expect([...cobaltCall.headers]).toEqual([['accept', 'application/json'], ['content-type', 'application/json']])
    expect(JSON.parse(cobaltCall.body!)).toEqual({
      url: TARGET.canonicalUrl,
      vCodec: 'h264', vQuality: '1080', aFormat: 'mp3', isAudioOnly: false, isTTFullAudio: false,
    })
    expect(provider.calls.find(call => call.url.pathname === '/api/timedtext')?.method).toBe('GET')
    for (const call of provider.calls) {
      expect(call.redirect).toBe('manual')
      expect(call.headers.has('authorization')).toBe(false)
      expect(call.headers.has('cookie')).toBe(false)
      expect(call.headers.has('x-user-hash')).toBe(false)
      expect(call.headers.has('x-workspace-id')).toBe(false)
    }
    expect(provider.calls.some(call => call.url.hostname === 'media.example')).toBe(false)
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
    for (const headers of [{ 'Content-Type': 'text/html' }, {}]) {
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

  test('@smoke applies caller abort and absolute deadline while awaiting and cancels the POST body', async () => {
    const controller = new AbortController()
    let hanging: ReturnType<typeof cancellableResponse> | undefined
    const provider = installProvider(call => {
      if (call.url.pathname === '/oembed') return jsonResponse(oembed())
      if (call.url.pathname === '/youtubei/v1/player') return jsonResponse({})
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
    expect(result.success).toBe(true)
    expect(result.mediaFailure).toEqual({ stage: 'cobalt', code: 'aborted' })
    expect(hanging?.wasCancelled()).toBe(true)

    let deadlineBody: ReturnType<typeof cancellableResponse> | undefined
    const deadlineProvider = installProvider(call => {
      if (call.url.pathname === '/oembed') return jsonResponse(oembed())
      deadlineBody = cancellableResponse({ headers: { 'Content-Type': 'application/json' }, hang: true })
      return deadlineBody.response
    })
    const timedOut = await fetchYouTubeProvider(TARGET, {
      ...deadlineProvider.options,
      includeMedia: true,
      deadline: createYouTubeProviderDeadline(100),
    })
    expect(timedOut.mediaFailure).toEqual({ stage: 'cobalt', code: 'deadline' })
    expect(deadlineBody?.wasCancelled()).toBe(true)

    const expiredProvider = installProvider(() => { throw new Error('must not fetch') })
    const expired = await fetchYouTubeProvider(TARGET, {
      ...expiredProvider.options,
      deadline: { expiresAt: Date.now() - 1 },
    })
    expect(expired).toEqual({ success: false, failure: { stage: 'target', code: 'deadline' } })
    expect(expiredProvider.calls).toEqual([])
  })

  test('@smoke rejects caption host, path, userinfo, and explicit port before caption transport', async () => {
    const invalid = [
      'https://attacker.example/api/timedtext?v=x',
      'https://www.youtube.com/not-timedtext?v=x',
      'https://user@www.youtube.com/api/timedtext?v=x',
      'https://www.youtube.com:443/api/timedtext?v=x',
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
  })

  test('@smoke denies private and mixed caption DNS before caption transport', async () => {
    for (const denied of [['10.0.0.8'], ['93.184.216.34', '10.0.0.8']]) {
      let resolutions = 0
      const provider = installProvider(call => {
        if (call.url.pathname === '/oembed') return jsonResponse(oembed())
        if (call.url.pathname === '/youtubei/v1/player') return jsonResponse(innertube())
        throw new Error('caption transport must not run')
      }, async () => (++resolutions === 3 ? denied : PUBLIC_IP))
      const result = await fetchYouTubeProvider(TARGET, { ...provider.options, includeTranscript: true })
      expect(result.transcriptFailure).toEqual({ stage: 'caption', code: 'policy' })
      expect(provider.calls).toHaveLength(2)
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

  test('@smoke makes InnerTube MIME and Cobalt stream failures optional with cleanup', async () => {
    for (const stage of ['innertube', 'cobalt'] as const) {
      let rejected: ReturnType<typeof cancellableResponse> | undefined
      const provider = installProvider(call => {
        if (call.url.pathname === '/oembed') return jsonResponse(oembed())
        const isTarget = stage === 'innertube' ? call.url.pathname === '/youtubei/v1/player' : call.url.hostname === 'co.wuk.sh'
        if (isTarget) {
          rejected = stage === 'innertube'
            ? cancellableResponse({ headers: {}, firstChunk: new TextEncoder().encode('{}'), hang: true })
            : cancellableResponse({ headers: { 'Content-Type': 'application/json' }, firstChunk: new Uint8Array(256 * 1024 + 1), hang: true })
          return rejected.response
        }
        throw new Error('unexpected optional transport')
      })
      const result = await fetchYouTubeProvider(TARGET, {
        ...provider.options,
        includeTranscript: stage === 'innertube',
        includeMedia: stage === 'cobalt',
      })
      expect(result.success).toBe(true)
      expect(stage === 'innertube' ? result.transcriptFailure : result.mediaFailure).toMatchObject({ stage })
      expect(rejected?.wasCancelled()).toBe(true)
    }
  })

  test('@smoke treats InnerTube and Cobalt redirects as terminal and never contacts their target', async () => {
    for (const stage of ['innertube', 'cobalt'] as const) {
      let redirect: ReturnType<typeof cancellableResponse> | undefined
      const provider = installProvider(call => {
        if (call.url.pathname === '/oembed') return jsonResponse(oembed())
        const isTarget = stage === 'innertube' ? call.url.pathname === '/youtubei/v1/player' : call.url.hostname === 'co.wuk.sh'
        if (isTarget) {
          redirect = cancellableResponse({
            status: 302,
            headers: { Location: 'https://attacker.example/provider-escape', 'Content-Type': 'application/json' },
            hang: true,
          })
          return redirect.response
        }
        throw new Error('redirect target must not run')
      })
      const result = await fetchYouTubeProvider(TARGET, {
        ...provider.options,
        includeTranscript: stage === 'innertube',
        includeMedia: stage === 'cobalt',
      })
      expect(stage === 'innertube' ? result.transcriptFailure : result.mediaFailure).toEqual({ stage, code: 'policy' })
      expect(provider.calls).toHaveLength(2)
      expect(provider.calls.some(call => call.url.hostname === 'attacker.example')).toBe(false)
      expect(redirect?.wasCancelled()).toBe(true)
    }
  })

  test('@smoke treats malformed Cobalt JSON as an optional closed failure', async () => {
    const provider = installProvider(call => call.url.pathname === '/oembed'
      ? jsonResponse(oembed())
      : new Response('{broken', { headers: { 'Content-Type': 'application/json' } }))
    const result = await fetchYouTubeProvider(TARGET, { ...provider.options, includeMedia: true })
    expect(result.success).toBe(true)
    expect(result.mediaUrl).toBeUndefined()
    expect(result.mediaFailure).toEqual({ stage: 'cobalt', code: 'invalid_response' })
  })

  test('@smoke accepts only closed Cobalt statuses and public validated output without fetching it', async () => {
    const outputs: Array<{ payload: unknown; expected: 'policy' | 'unavailable' }> = [
      { payload: { status: 'picker', url: 'https://media.example/video.mp4' }, expected: 'unavailable' },
      { payload: { status: 'stream', url: 'http://media.example/video.mp4' }, expected: 'policy' },
      { payload: { status: 'stream', url: 'https://127.0.0.1/video.mp4' }, expected: 'policy' },
      { payload: { status: 'stream', url: 'https://media.internal/video.mp4' }, expected: 'policy' },
      { payload: { status: 'stream', url: 'https://user@media.example/video.mp4' }, expected: 'policy' },
      { payload: { status: 'stream', url: 'https://media.example:443/video.mp4' }, expected: 'policy' },
      { payload: { status: 'stream', url: 'https://media.example/video.mp4#fragment' }, expected: 'policy' },
      { payload: { status: 'stream', url: `https://media.example/${'x'.repeat(2049)}` }, expected: 'policy' },
      { payload: { status: 'stream', url: 'https://media.example/video.mp4' }, expected: 'policy' },
    ]
    for (const scenario of outputs) {
      const provider = installProvider(call => call.url.pathname === '/oembed'
        ? jsonResponse(oembed())
        : jsonResponse(scenario.payload), async hostname => hostname === 'media.example' ? ['10.0.0.8'] : PUBLIC_IP)
      const result = await fetchYouTubeProvider(TARGET, { ...provider.options, includeMedia: true })
      expect(result.mediaUrl).toBeUndefined()
      expect(result.mediaFailure).toEqual({ stage: 'cobalt', code: scenario.expected })
      expect(provider.calls).toHaveLength(2)
      expect(provider.calls.every(call => call.url.hostname !== 'media.example')).toBe(true)
    }
  })
})
