import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { createTimelineClient, isTimelineResult, TIMELINE_LIMITS, TimelineClientError, type TimelineInput } from '../../../examples/timeline-client/client'

const corpus = JSON.parse(readFileSync(new URL('../../../benchmarks/timeline/corpus-v1/fixtures.json', import.meta.url), 'utf8'))
const token = `rt_svc_fixture-client-01.${'a'.repeat(43)}`
const capabilities = {
  schemaVersion: 'integration-capabilities.v1', requestId: 'req-discovery', identityType: 'service',
  clientId: 'fixture-client-01', communityId: 'community-fixture', workspaceId: 'workspace-fixture', investigationId: 'investigation-fixture',
  environment: 'development', maximumVisibility: 'private', scopes: ['community.research.execute'],
  contractVersions: { capabilities: 'integration-capabilities.v1', timelineAnalysis: 'timeline-analysis.v1' },
  capabilities: { anonymousAnalysis: true, publicBcw: true, timelineAnalysis: true, communityIngest: false, jobStatus: false, artifactRead: false, projectionRead: false, persistentWorkspace: false, researchQuestions: false, cop: false, behaviorIntake: false, claimMatch: false, feedJobs: false, webhookManagement: false }, limits: {},
}
const input: TimelineInput = { url: 'https://publisher.example/article' }
function harness(answer: () => Response = () => Response.json(corpus.successResponse), discovery: unknown = capabilities) {
  const calls: Array<{ url: string; init: RequestInit }> = []
  const client = createTimelineClient({ baseUrl: 'https://researchtools.example', serviceToken: token, fetch: (async (url, init = {}) => {
    calls.push({ url: String(url), init })
    return String(url).endsWith('/capabilities') ? Response.json(discovery) : answer()
  }) as typeof fetch })
  return { client, calls }
}

test.describe('generic timeline service client @smoke', () => {
  test('discovers then submits URL and supplied content without modifying input', async () => {
    const { client, calls } = harness()
    expect(await client.analyze(input, { correlationId: 'correlation-fixture-01' })).toEqual(corpus.successResponse)
    const supplied = { ...input, content: { ...corpus.fixtures[0].request.content } }
    const before = JSON.stringify(supplied)
    await client.analyze(supplied)
    expect(JSON.stringify(supplied)).toBe(before)
    expect(calls.map(call => new URL(call.url).pathname)).toEqual(['/api/integrations/capabilities', '/api/tools/extract-timeline', '/api/integrations/capabilities', '/api/tools/extract-timeline'])
    expect(JSON.parse(String(calls[1].init.body))).toEqual({ schemaVersion: 'timeline-analysis.v1', ...input })
    expect(JSON.parse(String(calls[3].init.body))).toEqual({ schemaVersion: 'timeline-analysis.v1', ...supplied })
    for (const call of calls) {
      const headers = new Headers(call.init.headers)
      expect(headers.get('authorization')).toBe(`Bearer ${token}`)
      expect(headers.has('x-guest-session')).toBe(false)
      expect(headers.has('x-service-key')).toBe(false)
      expect(call.init).toMatchObject({ credentials: 'omit', redirect: 'manual', cache: 'no-store' })
    }
    expect(new Headers(calls[1].init.headers).get('x-correlation-id')).toBe('correlation-fixture-01')
  })

  test('preserves no_events and rejects inconsistent or malformed success', async () => {
    const empty = { ...corpus.successResponse, outcome: 'no_events', events: [], model: { ...corpus.successResponse.model, status: 'no_events' } }
    expect(await harness(() => Response.json(empty)).client.analyze(input)).toEqual(empty)
    for (const malformed of [
      { ...empty, events: corpus.successResponse.events },
      { ...corpus.successResponse, events: [] },
      { ...corpus.successResponse, model: { ...corpus.successResponse.model, status: 'no_events' } },
      { ...corpus.successResponse, extraction: { ...corpus.successResponse.extraction, quality: { ...corpus.successResponse.extraction.quality, accepted: false } } },
      { ...corpus.successResponse, events: [{ ...corpus.successResponse.events[0], eventDate: '2026-02-29', datePrecision: 'day' }] },
      { ...corpus.successResponse, events: [{ ...corpus.successResponse.events[0], importance: 'urgent' }] },
    ]) {
      expect(isTimelineResult(malformed)).toBe(false)
      await expect(harness(() => Response.json(malformed)).client.analyze(input)).rejects.toMatchObject({ code: 'invalid_response' })
    }
    expect(isTimelineResult({ ...corpus.successResponse, additiveFutureField: true })).toBe(true)
  })

  test('does not submit when discovery is absent, unsupported or malformed', async () => {
    for (const discovery of [
      { ...capabilities, capabilities: { ...capabilities.capabilities, timelineAnalysis: false } },
      { ...capabilities, contractVersions: { capabilities: 'integration-capabilities.v1' } },
      { ...capabilities, scopes: [] },
      { ...capabilities, identityType: 'anonymous' },
      { ...capabilities, limits: { maxBatchUrls: -1 } },
      { ...capabilities, capabilities: { timelineAnalysis: true } },
    ]) {
      const { client, calls } = harness(undefined, discovery)
      await expect(client.analyze(input)).rejects.toBeInstanceOf(TimelineClientError)
      expect(calls).toHaveLength(1)
    }
  })

  for (const fixture of corpus.serviceErrors) {
    test(`handles ${fixture.status} ${fixture.code} once with no recovery or guest retry`, async () => {
      const { client, calls } = harness(() => Response.json({ schemaVersion: 'integration-error.v1', requestId: 'req-service-error', correlationId: 'correlation-fixture-01', error: { code: fixture.code, retryable: fixture.retryable, message: `Do not expose ${token}` } }, { status: fixture.status, headers: { 'Retry-After': '2' } }))
      let caught: unknown
      try { await client.analyze(input) } catch (error) { caught = error }
      expect(caught).toMatchObject({ code: fixture.code, status: fixture.status, retryable: fixture.retryable, requestId: 'req-service-error', correlationId: 'correlation-fixture-01', retryAfterSeconds: 2 })
      expect(`${String(caught)} ${JSON.stringify(caught)}`).not.toContain(token)
      expect(calls).toHaveLength(2)
    })
  }

  test('recognizes flat middleware failures without claiming a nested service error', async () => {
    await expect(harness(() => Response.json({ error: 'rate limit' }, { status: 429 })).client.analyze(input)).rejects.toMatchObject({ code: 'rate_limited', status: 429, retryable: true })
    await expect(harness(() => Response.json({ error: 'unavailable', retryable: true }, { status: 503 })).client.analyze(input)).rejects.toMatchObject({ code: 'service_unavailable', status: 503, retryable: true })
  })

  test('checks bytes, shape, URLs and timestamp semantics before transport', async () => {
    const { client, calls } = harness()
    const invalid: unknown[] = [
      { url: 'http://127.0.0.1/private' }, { url: 'http://0x7f000001/private' }, { url: 'http://[::1]/' },
      { url: 'https://user:secret@publisher.example/' }, { url: 'https://publisher.example:8443/' }, { url: 'file:///tmp/a' },
      { ...input, content: { text: 'é'.repeat(51201), source: 'publisher-feed' } },
      { ...input, content: { text: '\u0001'.repeat(20000), source: 'publisher-feed' } },
      { ...input, content: { text: 'article', source: 'unapproved' } },
      { ...input, content: { text: 'article', source: 'publisher-feed', title: 'x'.repeat(501) } },
      { ...input, content: { text: 'article', source: 'publisher-feed', publishedAt: '2026-02-29T12:00:00Z' } },
      { ...input, content: { text: 'article', source: 'publisher-feed', publishedAt: '2026T12:00Z' } },
      { ...input, extra: true },
    ]
    for (const value of invalid) await expect(client.analyze(value as TimelineInput)).rejects.toMatchObject({ code: 'invalid_input' })
    await expect(client.analyze(input, { correlationId: 'short' })).rejects.toMatchObject({ code: 'invalid_input' })
    expect(calls).toHaveLength(0)
    await client.analyze({ ...input, content: { text: 'é'.repeat(51200), source: 'publisher-feed', publishedAt: '2026-09-11T12:30:00+02:00' } })
    expect(calls).toHaveLength(2)
  })

  test('refuses insecure origins and redirected bearer forwarding', async () => {
    for (const baseUrl of ['http://researchtools.example', 'https://researchtools.example/path', 'https://researchtools.example?token=x', 'https://user:secret@researchtools.example', 'https://127.0.0.1']) expect(() => createTimelineClient({ baseUrl, serviceToken: token })).toThrow(TimelineClientError)
    const { client, calls } = harness(() => new Response(null, { status: 302, headers: { Location: 'https://evil.example/steal' } }))
    await expect(client.analyze(input)).rejects.toMatchObject({ code: 'redirect_denied' })
    expect(calls).toHaveLength(2)
    expect(calls.every(call => new URL(call.url).origin === 'https://researchtools.example')).toBe(true)
  })

  test('bounds declared and streamed bytes, cancels bodies and rejects non-JSON/invalid UTF-8', async () => {
    let canceled = false
    const streamed = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array(TIMELINE_LIMITS.responseBytes + 1)) }, cancel() { canceled = true } })
    await expect(harness(() => new Response(streamed, { headers: { 'Content-Type': 'application/json' } })).client.analyze(input)).rejects.toMatchObject({ code: 'response_too_large' })
    expect(canceled).toBe(true)
    await expect(harness(() => new Response('{}', { headers: { 'Content-Type': 'application/json', 'Content-Length': String(TIMELINE_LIMITS.responseBytes + 1) } })).client.analyze(input)).rejects.toMatchObject({ code: 'response_too_large' })
    await expect(harness(() => new Response('<html>bad</html>', { headers: { 'Content-Type': 'text/html' } })).client.analyze(input)).rejects.toMatchObject({ code: 'invalid_response' })
    await expect(harness(() => new Response(new Uint8Array([0xff]), { headers: { 'Content-Type': 'application/json' } })).client.analyze(input)).rejects.toMatchObject({ code: 'invalid_response' })
  })

  test('bounds uncooperative transport, cancels stalled body and sanitizes network failure', async () => {
    const stalled = createTimelineClient({ baseUrl: 'https://researchtools.example', serviceToken: token, timeoutMs: 10, fetch: (() => new Promise<Response>(() => {})) as typeof fetch })
    await expect(stalled.discover()).rejects.toMatchObject({ code: 'timeout' })
    let canceled = false
    const body = new ReadableStream<Uint8Array>({ cancel() { canceled = true } })
    const slowBody = createTimelineClient({ baseUrl: 'https://researchtools.example', serviceToken: token, timeoutMs: 10, fetch: (async () => new Response(body, { headers: { 'Content-Type': 'application/json' } })) as typeof fetch })
    await expect(slowBody.discover()).rejects.toMatchObject({ code: 'timeout' })
    expect(canceled).toBe(true)
    const aborter = new AbortController()
    aborter.abort()
    await expect(stalled.discover({ signal: aborter.signal })).rejects.toMatchObject({ code: 'aborted' })
    const network = createTimelineClient({ baseUrl: 'https://researchtools.example', serviceToken: token, fetch: (async () => { throw new Error(token) }) as typeof fetch })
    await expect(network.discover()).rejects.toMatchObject({ code: 'network_error', message: 'Timeline request failed (network_error).' })
  })

  test('caller abort during transport rejects promptly and cancels a late response body', async () => {
    const aborter = new AbortController()
    let resolveTransport!: (response: Response) => void
    let markStarted!: () => void
    let markCanceled!: () => void
    let transportSignal: AbortSignal | null | undefined
    const started = new Promise<void>(resolve => { markStarted = resolve })
    const canceled = new Promise<void>(resolve => { markCanceled = resolve })
    const client = createTimelineClient({
      baseUrl: 'https://researchtools.example', serviceToken: token,
      fetch: ((_url, init) => {
        transportSignal = init?.signal
        markStarted()
        // Deliberately ignores the signal so the client must clean up its late response.
        return new Promise<Response>(resolve => { resolveTransport = resolve })
      }) as typeof fetch,
    })
    const pending = client.discover({ signal: aborter.signal })
    const rejected = expect(pending).rejects.toMatchObject({ code: 'aborted' })
    await started
    expect(transportSignal?.aborted).toBe(false)
    aborter.abort()
    await rejected
    expect(transportSignal?.aborted).toBe(true)
    resolveTransport(new Response(new ReadableStream<Uint8Array>({ cancel() { markCanceled() } }), { headers: { 'Content-Type': 'application/json' } }))
    await canceled
  })

  test('caller abort after response streaming starts cancels the active reader', async () => {
    const aborter = new AbortController()
    let markReading!: () => void
    let markCanceled!: () => void
    const reading = new Promise<void>(resolve => { markReading = resolve })
    const canceled = new Promise<void>(resolve => { markCanceled = resolve })
    let pulls = 0
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls += 1
        if (pulls === 1) controller.enqueue(new TextEncoder().encode('{"schemaVersion":'))
        else markReading() // The client has consumed the first chunk and is awaiting more.
      },
      cancel() { markCanceled() },
    }, { highWaterMark: 0 })
    const client = createTimelineClient({
      baseUrl: 'https://researchtools.example', serviceToken: token,
      fetch: (async () => new Response(body, { headers: { 'Content-Type': 'application/json' } })) as typeof fetch,
    })
    const pending = client.discover({ signal: aborter.signal })
    const rejected = expect(pending).rejects.toMatchObject({ code: 'aborted' })
    await reading
    expect(body.locked).toBe(true)
    aborter.abort()
    await rejected
    await canceled
    expect(body.locked).toBe(false)
  })
})
