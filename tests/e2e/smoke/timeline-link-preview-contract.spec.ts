import { expect, test } from '@playwright/test'
import { timelineLinkPreview } from '../../../src/lib/timeline-link-preview'
import { decodeTimelinePresentation, type TimelinePresentation } from '../../../src/lib/timeline-presentation-contract'
import { onRequest } from '../../../functions/present/[[catchall]]'

function timeline(headline = 'Recorded timeline', framing = '<p>A selected narrative.</p>', count = 1): TimelinePresentation['timeline'] {
  return decodeTimelinePresentation({ schemaVersion: 'timeline-presentation.v1', timeline: {
    scale: 'human', title: { text: { headline, text: framing }, unique_id: 'narrative-title', autolink: false },
    events: Array.from({ length: count }, (_, i) => ({ start_date: { year: 2026 }, text: { headline: `Private detail ${i}`, text: '<p>Hidden assessment must not enter metadata.</p>' }, unique_id: `event-${i}`, display_date: '2026', autolink: false })),
  } }).timeline
}
function invoke(request: Request, env: unknown): Promise<Response> {
  return Promise.resolve(onRequest({ request, env } as Parameters<typeof onRequest>[0]) as Response | Promise<Response>)
}

test.describe('shared presentation link preview @smoke', () => {
  test('uses only selected framing and event count, with singular/plural descriptions', () => {
    expect(timelineLinkPreview(timeline())).toEqual({ title: 'Recorded timeline', description: '1 event · A selected narrative.', eventCount: 1, imagePath: '/timeline-share-card.png', imageAlt: 'Timeline presentation card with connected events' })
    const result = timelineLinkPreview(timeline('Selected title', '<p>Selected framing</p>', 100))
    expect(result.description).toBe('100 events · Selected framing')
    expect(JSON.stringify(result)).not.toMatch(/Private detail|Hidden assessment|2026/)
  })

  test('decodes entities once, removes permitted formatting and normalizes paragraph whitespace', () => {
    const result = timelineLinkPreview(timeline('&lt;script&gt; &amp; &quot;quotes&quot; &#39;single&#39; &amp;lt;', '<p>First <strong>bold</strong>.</p><p>Second\n line &amp;lt;.</p>'))
    expect(result.title).toBe('<script> & "quotes" \'single\' &lt;')
    expect(result.description).toBe('1 event · First bold. Second line &lt;.')
    // Text is deliberately plain rather than pre-escaped: each output surface
    // must escape it once, preventing entity double-decoding into active markup.
    expect(result.title).not.toContain('&amp;lt;')
  })

  test('bounds title and description by Unicode codepoints without splitting astral characters', () => {
    const result = timelineLinkPreview(timeline('😀'.repeat(151), `<p>${'🛰'.repeat(300)}</p>`))
    expect(Array.from(result.title)).toHaveLength(150)
    expect(result.title).toBe('😀'.repeat(149) + '…')
    expect(Array.from(result.description)).toHaveLength(240)
    expect(result.description.startsWith('1 event · ')).toBe(true)
    expect(result.description.endsWith('…')).toBe(true)
    expect(result.description).not.toMatch(/[\uD800-\uDBFF]($|[^\uDC00-\uDFFF])|(^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]/)
    expect(timelineLinkPreview(timeline('😀'.repeat(150))).title).toBe('😀'.repeat(150))
  })

  test('uses stable empty-text fallbacks and never mutates the frozen projection', () => {
    const input = timeline(' \n ', '<p> </p>')
    const before = JSON.stringify(input)
    Object.freeze(input.title.text); Object.freeze(input.title); Object.freeze(input.events); Object.freeze(input)
    const result = timelineLinkPreview(input)
    expect(result.title).toBe('Timeline presentation')
    expect(result.description).toBe('1 event · Explore this shared timeline presentation.')
    result.title = 'Changed consumer copy'
    expect(JSON.stringify(input)).toBe(before)
    expect(timelineLinkPreview(input).title).toBe('Timeline presentation')
  })

  test('rejects non-read methods without database/assets and retains privacy headers', async () => {
    const response = await invoke(new Request('https://reader.example/present/' + 'a'.repeat(64), { method: 'POST' }), {})
    expect(response.status).toBe(405)
    expect(response.headers.get('Allow')).toBe('GET, HEAD')
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(response.headers.get('Referrer-Policy')).toBe('no-referrer')
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex,nofollow')
    expect(response.headers.get('Content-Security-Policy')).toContain("script-src 'self';")
    expect(response.headers.has('Access-Control-Allow-Origin')).toBe(false)
    expect(await response.text()).not.toContain('a'.repeat(64))
  })

  test('fails closed for datastore/assets failure and never forwards caller credentials to assets', async () => {
    const assetRequests: Request[] = []
    let dbReads = 0
    const env = {
      DB: { prepare() { dbReads++; throw new Error('private database detail') } },
      ASSETS: { async fetch(request: Request) { assetRequests.push(request); return new Response('asset unavailable', { status: 503 }) } },
    }
    for (const path of ['/present/invalid', '/present/' + 'a'.repeat(64) + '?private=query', '/present/' + 'a'.repeat(64) + '/extra']) {
      const response = await invoke(new Request('https://reader.example' + path, { headers: { Authorization: 'Bearer private', Cookie: 'private=value', 'X-Forwarded-Host': 'untrusted.example' } }), env)
      expect(response.status).toBe(503) // Even a generic404 shell requires a working asset.
      expect(await response.text()).not.toMatch(/private|untrusted|asset unavailable/)
    }
    expect(dbReads).toBe(0)
    const head = await invoke(new Request('https://reader.example/present/' + 'a'.repeat(64), { method: 'HEAD' }), env)
    expect(dbReads).toBe(1)
    expect(head.status).toBe(503)
    expect(await head.text()).toBe('')
    expect(assetRequests).toHaveLength(4)
    for (const request of assetRequests) {
      expect(request.url).toBe('https://reader.example/index.html')
      expect(request.method).toBe('GET')
      expect([...request.headers]).toEqual([])
    }
  })

  test('rejects incomplete successful asset bodies before metadata rewriting', async () => {
    const shells = [
      '<!doctype html><html><head><title>Partial asset</title>',
      '<!doctype html><html><head><title>Partial asset</title></head><body><div id="root"></div></body></html>',
      '<!doctype html><html><head><title>Partial asset</title></head><body><script type="module" src="/assets/index.js"></script></body></html>',
      '<!doctype html><html><head><title>Partial asset</title></head><body><div id="root"></div><script type="module" src="https://untrusted.example/index.js"></script></body></html>',
    ]
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'HTMLRewriter')
    let rewriterAccesses = 0
    // Observe forbidden access only; supply no fake HTMLRewriter implementation.
    Object.defineProperty(globalThis, 'HTMLRewriter', { configurable: true, get() { rewriterAccesses++; throw new Error('Rewriter must not be reached') } })
    try {
    for (const shell of shells) {
      const env = { ASSETS: { async fetch() { return new Response(shell, { headers: { 'Content-Type': 'text/html' } }) } } }
      for (const method of ['GET', 'HEAD']) {
        // Invalid token avoids D1; rejection must happen before HTMLRewriter.
        // No fake parser or rewriter is installed in the Node contract runner.
        const response = await invoke(new Request('https://reader.example/present/invalid', { method }), env)
        expect(response.status).toBe(503)
        expect(response.headers.get('Cache-Control')).toBe('no-store')
        const body = await response.text()
        if (method === 'HEAD') expect(body).toBe('')
        else expect(body).toContain('Timeline presentation unavailable')
        expect(body).not.toMatch(/Partial asset|untrusted|og:title/)
      }
    }
    expect(rewriterAccesses).toBe(0)
    } finally {
      if (descriptor) Object.defineProperty(globalThis, 'HTMLRewriter', descriptor)
      else Reflect.deleteProperty(globalThis, 'HTMLRewriter')
    }
  })

})
