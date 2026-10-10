import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'
import { onRequest } from '../../../functions/api/web-scraper'

const fixtures = resolve(process.cwd(), 'tests/fixtures/product-pages')
const holybroHtml = readFileSync(resolve(fixtures, 'holybro-x500-v2-spares.html'), 'utf8')
const holybroJs = readFileSync(resolve(fixtures, 'holybro-x500-v2-spares.js.json'), 'utf8')
const HOLYBRO_URL = 'https://holybro.com/products/spare-parts-x500-v2-kit'

const env = { SESSIONS: { get: async () => JSON.stringify({ user_id: 42 }) } }

function post(body: unknown, headers: Record<string, string> = { Authorization: 'Bearer test-session' }) {
  return onRequest({
    request: new Request('https://researchtools.test/api/web-scraper', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    }),
    env,
  } as never)
}

// Loose view of the JSON response; each test asserts the shape it relies on.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Payload = Record<string, any>

type Route = (url: URL) => Response | Promise<Response>

async function withFetch<T>(route: Route, run: (requested: string[]) => Promise<T>): Promise<T> {
  const originalFetch = globalThis.fetch
  const requested: string[] = []
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = new URL(input instanceof Request ? input.url : String(input))
    if (url.hostname === 'cloudflare-dns.com' || url.hostname === 'dns.google') {
      const ipv6 = url.searchParams.get('type') === 'AAAA'
      return Response.json({
        Status: 0,
        Answer: [{ type: ipv6 ? 28 : 1, data: ipv6 ? '2606:4700::6810:1' : '23.227.38.65' }],
      })
    }
    requested.push(url.href)
    return route(url)
  }) as typeof fetch
  try {
    return await run(requested)
  } finally {
    globalThis.fetch = originalFetch
  }
}

test.describe('web scraper product mode @smoke', () => {
  test.describe.configure({ mode: 'serial' })

  test('@smoke fetches the page and the Shopify .js, then matches a variant', async () => {
    await withFetch(url => {
      if (url.pathname.endsWith('.js')) {
        return new Response(holybroJs, { headers: { 'Content-Type': 'text/javascript; charset=utf-8' } })
      }
      return new Response(holybroHtml, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
    }, async requested => {
      const response = await post({ url: `${HOLYBRO_URL}?variant=1`, extract_mode: 'product', match: 'Propeller 1045 2 pair' })
      expect(response.status).toBe(200)
      const payload = await response.json() as Payload
      expect(requested).toEqual([`${HOLYBRO_URL}?variant=1`, `${HOLYBRO_URL}.js`])
      expect(payload).toMatchObject({
        success: true,
        url: `${HOLYBRO_URL}?variant=1`,
        domain: 'holybro.com',
        content_source: 'fetched',
        product: { name: 'Spare Parts-X500 V2 Kit', currency: 'USD', sources: ['json-ld', 'shopify'] },
        matched_offer: {
          title: 'Propeller1045(2pair)',
          price: 11.59,
          currency: 'USD',
          availability: 'out_of_stock',
          sku: '530084',
          url: `${HOLYBRO_URL}?variant=41591073669309`,
          ambiguous_same_price: false,
        },
      })
      expect(payload.product.offers).toHaveLength(17)
      expect(typeof payload.extracted_at).toBe('string')
      expect(payload).not.toHaveProperty('data')
    })
  })

  test('@smoke a failing .js fetch falls back to the page alone', async () => {
    await withFetch(url => url.pathname.endsWith('.js')
      ? new Response('Too Many Requests', { status: 429, headers: { 'Content-Type': 'text/plain' } })
      : new Response(holybroHtml, { headers: { 'Content-Type': 'text/html' } }), async () => {
      const payload = await (await post({ url: HOLYBRO_URL, extract_mode: 'product' })).json() as Payload
      expect(payload.success).toBe(true)
      expect(payload.product.sources).toEqual(['json-ld'])
      expect(payload.product.offers[3]).toMatchObject({ price: 11.59, title: '530084' })
      expect(payload).not.toHaveProperty('matched_offer')
    })
  })

  test('@smoke a non-Shopify page makes exactly one request', async () => {
    const html = '<script type="application/ld+json">{"@type":"Product","name":"Nano RX","offers":{"price":"29.95","priceCurrency":"USD"}}</script>'
    await withFetch(() => new Response(html, { headers: { 'Content-Type': 'text/html' } }), async requested => {
      const payload = await (await post({ url: 'https://shop.example/products/nano', extract_mode: 'product' })).json() as Payload
      expect(requested).toHaveLength(1)
      expect(payload.product.offers[0]).toMatchObject({ title: 'Nano RX', price: 29.95 })
    })
  })

  test('@smoke an upstream 429 suggests supplying content', async () => {
    await withFetch(() => new Response('slow down', { status: 429, headers: { 'Content-Type': 'text/html' } }), async () => {
      const response = await post({ url: HOLYBRO_URL, extract_mode: 'product' })
      expect(response.status).toBe(400)
      const payload = await response.json() as { error: string; suggestions: string[]; technicalDetails: string }
      expect(payload.error).toBe('The website is rate limiting automated access')
      expect(payload.suggestions.join(' ')).toContain('content.html')
      expect(payload.technicalDetails).toContain('429')
    })
  })

  test('@smoke supplied content is extracted without any outbound request', async () => {
    await withFetch(() => { throw new Error('must not fetch') }, async requested => {
      const response = await post({
        url: HOLYBRO_URL,
        extract_mode: 'product',
        content: { html: holybroHtml, shopify_json: JSON.parse(holybroJs) },
        match: 'Motor 2216-920KV-CCW',
      })
      expect(response.status).toBe(200)
      const payload = await response.json() as Payload
      expect(requested).toEqual([])
      expect(payload.content_source).toBe('supplied')
      expect(payload.matched_offer).toMatchObject({ title: 'Motor 2216-920KV-CCW (1PC)', price: 19.99, sku: '520086' })
    })
  })

  test('@smoke supplied content with no structured price is a 200 with empty offers', async () => {
    await withFetch(() => { throw new Error('must not fetch') }, async () => {
      const payload = await (await post({
        url: HOLYBRO_URL,
        extract_mode: 'product',
        content: { html: '<html><body>Just text</body></html>' },
        match: 'anything',
      })).json() as Payload
      expect(payload.success).toBe(true)
      expect(payload.product.offers).toEqual([])
      expect(payload.matched_offer).toBeNull()
    })
  })

  test('@smoke rejects invalid product requests before any fetch', async () => {
    await withFetch(() => { throw new Error('must not fetch') }, async requested => {
      const cases: Array<[unknown, number, string]> = [
        [{ url: HOLYBRO_URL, extract_mode: 'metadata', content: { html: '<p>x</p>' } }, 400, 'only supported'],
        [{ url: HOLYBRO_URL, extract_mode: 'full', match: 'x' }, 400, 'only supported'],
        [{ url: HOLYBRO_URL, extract_mode: 'product', match: 7 }, 400, 'match must be'],
        [{ url: HOLYBRO_URL, extract_mode: 'product', match: 'x'.repeat(301) }, 400, 'match must be'],
        [{ url: HOLYBRO_URL, extract_mode: 'product', content: 'html' }, 400, 'content must be an object'],
        [{ url: HOLYBRO_URL, extract_mode: 'product', content: {} }, 400, 'non-empty'],
        [{ url: HOLYBRO_URL, extract_mode: 'product', content: { html: 5 } }, 400, 'content.html'],
        [{ url: HOLYBRO_URL, extract_mode: 'product', content: { shopify_json: [1] } }, 400, 'content.shopify_json'],
        [{ url: HOLYBRO_URL, extract_mode: 'product', content: { html: 'x'.repeat(2 * 1024 * 1024 + 1) } }, 413, '2 MiB'],
        [{ url: 'http://holybro.com/products/x', extract_mode: 'product', content: { html: '<p>x</p>' } }, 400, 'https'],
        [{ url: 'https://127.0.0.1/products/x', extract_mode: 'product', content: { html: '<p>x</p>' } }, 400, 'private'],
        [{ url: 'https://localhost/products/x', extract_mode: 'product' }, 400, 'private'],
      ]
      for (const [body, status, message] of cases) {
        const response = await post(body)
        expect(response.status, JSON.stringify(body).slice(0, 120)).toBe(status)
        expect(((await response.json()) as { error: string }).error).toContain(message)
      }
      expect(requested).toEqual([])
    })
  })

  test('@smoke product mode still requires authentication', async () => {
    const response = await post({ url: HOLYBRO_URL, extract_mode: 'product', content: { html: holybroHtml } }, {})
    expect(response.status).toBe(401)
  })
})
