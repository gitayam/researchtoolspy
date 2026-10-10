import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'
import { PRODUCT_BOT_USER_AGENT, fetchSameHostJson, onRequest } from '../../../functions/api/web-scraper'

const fixtures = resolve(process.cwd(), 'tests/fixtures/product-pages')
const holybroHtml = readFileSync(resolve(fixtures, 'holybro-x500-v2-spares.html'), 'utf8')
const holybroJs = readFileSync(resolve(fixtures, 'holybro-x500-v2-spares.js.json'), 'utf8')
const HOLYBRO_URL = 'https://holybro.com/products/spare-parts-x500-v2-kit'

const env = { SESSIONS: { get: async () => JSON.stringify({ user_id: 42 }) } }

function post(
  body: unknown,
  headers: Record<string, string> = { Authorization: 'Bearer test-session' },
  extraEnv: Record<string, unknown> = {},
) {
  return onRequest({
    request: new Request('https://researchtools.test/api/web-scraper', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    }),
    env: { ...env, ...extraEnv },
  } as never)
}

// Loose view of the JSON response; each test asserts the shape it relies on.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Payload = Record<string, any>

type Route = (url: URL) => Response | Promise<Response>

/** User-Agent of every non-DNS outbound request, in order. */
const userAgents: string[] = []

async function withFetch<T>(route: Route, run: (requested: string[]) => Promise<T>): Promise<T> {
  const originalFetch = globalThis.fetch
  const requested: string[] = []
  userAgents.length = 0
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input))
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined))
    if (url.hostname === 'cloudflare-dns.com' || url.hostname === 'dns.google') {
      const ipv6 = url.searchParams.get('type') === 'AAAA'
      return Response.json({
        Status: 0,
        Answer: [{ type: ipv6 ? 28 : 1, data: ipv6 ? '2606:4700::6810:1' : '23.227.38.65' }],
      })
    }
    requested.push(url.href)
    userAgents.push(headers.get('User-Agent') ?? '')
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

const fixtureText = (name: string) => readFileSync(resolve(fixtures, name), 'utf8')
const FLYINGTECH_URL = 'https://www.flyingtech.co.uk/product/speedybee-mario-5-5%e2%80%b3-fpv-frame-kit-dc-xh-lite-advanced/'
const HORUS_URL = 'https://www.horusrc.com/vantac-f722-f405-flight-controller.html'
const html = (body: string) => new Response(body, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
const json = (body: string) => new Response(body, { headers: { 'Content-Type': 'application/json' } })

test.describe('web scraper product mode v2 @smoke', () => {
  test.describe.configure({ mode: 'serial' })

  test('@smoke product mode sends an honest user agent; metadata mode is unchanged', async () => {
    await withFetch(url => url.pathname.endsWith('.js') ? json(holybroJs) : html(holybroHtml), async () => {
      await post({ url: HOLYBRO_URL, extract_mode: 'product' })
      expect(userAgents).toEqual([PRODUCT_BOT_USER_AGENT, PRODUCT_BOT_USER_AGENT])
      expect(PRODUCT_BOT_USER_AGENT).toBe('ResearchTools/1.0 (+https://researchtools.net/bot)')
    })
    await withFetch(() => html('<html><head><title>Article</title></head><body><p>Text</p></body></html>'), async () => {
      await post({ url: 'https://news.example/story', extract_mode: 'metadata' })
      expect(userAgents).toHaveLength(1)
      expect(userAgents[0]).toMatch(/^Mozilla\/5\.0/)
    })
  })

  test('@smoke a WooCommerce page with complete variations makes one request', async () => {
    await withFetch(() => html(fixtureText('flyingtech-mario5-frame.html')), async requested => {
      const payload = await (await post({ url: FLYINGTECH_URL, extract_mode: 'product', match: 'XH Advanced' })).json() as Payload
      expect(requested).toEqual([FLYINGTECH_URL])
      expect(payload.matched_offer).toMatchObject({ title: 'XH – Advanced', price: 57.9, currency: 'GBP', availability: 'out_of_stock' })
    })
  })

  test('@smoke deferred WooCommerce variations come from the Store API (two same-host GETs)', async () => {
    const page = fixtureText('flyingtech-mario5-frame.html')
      .replace(/<script type="application\/ld\+json"[\s\S]*?<\/script>/g, '')
      .replace(/data-product_variations="[^"]*"/, 'data-product_variations="false"')
    await withFetch(url => {
      if (url.pathname === '/wp-json/wc/store/v1/products/120272') return json(fixtureText('flyingtech-mario5-frame.store-api.json'))
      if (url.pathname === '/wp-json/wc/store/v1/products') return json(fixtureText('flyingtech-mario5-frame.store-api-variations.json'))
      return html(page)
    }, async requested => {
      const payload = await (await post({ url: FLYINGTECH_URL, extract_mode: 'product', match: 'DC Lite' })).json() as Payload
      expect(requested).toEqual([
        FLYINGTECH_URL,
        'https://www.flyingtech.co.uk/wp-json/wc/store/v1/products/120272',
        'https://www.flyingtech.co.uk/wp-json/wc/store/v1/products?type=variation&parent=120272&per_page=100',
      ])
      expect(userAgents.every(ua => ua === PRODUCT_BOT_USER_AGENT)).toBe(true)
      expect(payload.product.sources[0]).toBe('woo-store-api')
      expect(payload.product.offers).toHaveLength(4)
      expect(payload.matched_offer).toMatchObject({ title: 'DC (Deadcat) – Lite', price: 52.9, currency: 'GBP', sku: 'SB-MARIO5-FRAME-DC-LITE' })
    })
  })

  test('@smoke Magento pages ask GraphQL for child SKUs and stock; a 404 falls back to spConfig', async () => {
    const graphql = fixtureText('horusrc-vantac-f722-f405.graphql.json')
    await withFetch(url => url.pathname === '/graphql' ? json(graphql) : html(fixtureText('horusrc-vantac-f722-f405.html')), async requested => {
      const payload = await (await post({ url: HORUS_URL, extract_mode: 'product', match: 'F722' })).json() as Payload
      expect(requested).toHaveLength(2)
      const query = new URL(requested[1])
      expect(query.origin + query.pathname).toBe('https://www.horusrc.com/graphql')
      expect(query.searchParams.get('query')).toContain('url_key:{eq:"vantac-f722-f405-flight-controller"}')
      expect(payload.product.sources).toEqual(expect.arrayContaining(['magento-spconfig', 'magento-graphql']))
      expect(payload.matched_offer).toMatchObject({ title: 'F722', price: 34.99, sku: '03060110', availability: 'in_stock' })
    })
    await withFetch(url => url.pathname === '/graphql'
      ? new Response('Not Found', { status: 404, headers: { 'Content-Type': 'text/html' } })
      : html(fixtureText('horusrc-vantac-f722-f405.html')), async () => {
      const payload = await (await post({ url: HORUS_URL, extract_mode: 'product', match: 'F722' })).json() as Payload
      expect(payload.product.sources).not.toContain('magento-graphql')
      expect(payload.matched_offer).toMatchObject({ title: 'F722', price: 34.99, sku: null })
    })
  })

  test('@smoke platform JSON is never fetched from another hostname', async () => {
    await withFetch(() => { throw new Error('must not fetch') }, async requested => {
      const attempts: unknown[] = []
      const result = await fetchSameHostJson('https://evil.example/wp-json/x', new URL(FLYINGTECH_URL), a => { attempts.push(a) })
      expect(result).toBeNull()
      expect(requested).toEqual([])
    })
  })

  const shell = '<html><head><title>Shop</title></head><body><div id="app"></div><script src="/app.js"></script></body></html>'
  const renderedPage = '<html><body>' + '<p>rendered</p>'.repeat(20)
    + '<script type="application/ld+json">{"@type":"Product","name":"SPA Motor","offers":{"price":"21.50","priceCurrency":"EUR","availability":"InStock"}}</script></body></html>'

  test('@smoke the browser fallback is off unless PRODUCT_BROWSER_FALLBACK=1', async () => {
    let renders = 0
    const BROWSER_RENDERER = { fetch: async () => { renders++; return Response.json({ html: renderedPage }) } }
    await withFetch(() => html(shell), async () => {
      const payload = await (await post({ url: 'https://spa.example/p/motor', extract_mode: 'product' }, undefined, { BROWSER_RENDERER })).json() as Payload
      expect(renders).toBe(0)
      expect(payload).toMatchObject({ content_source: 'fetched', product: { offers: [] } })
    })
  })

  test('@smoke an empty 2xx page is rendered and re-extracted when the fallback is on', async () => {
    const calls: Array<{ url: string; body: unknown }> = []
    const BROWSER_RENDERER = {
      fetch: async (url: string, init?: RequestInit) => {
        calls.push({ url, body: JSON.parse(String(init?.body)) })
        return Response.json({ html: renderedPage, source: 'cloudflare-browser-run' })
      },
    }
    await withFetch(() => html(shell), async requested => {
      const payload = await (await post(
        { url: 'https://spa.example/p/motor', extract_mode: 'product' },
        undefined,
        { BROWSER_RENDERER, PRODUCT_BROWSER_FALLBACK: '1' },
      )).json() as Payload
      expect(requested).toEqual(['https://spa.example/p/motor'])
      expect(calls).toEqual([{ url: expect.any(String), body: { url: 'https://spa.example/p/motor', mode: 'html' } }])
      expect(payload.content_source).toBe('rendered')
      expect(payload.product.offers[0]).toMatchObject({ title: 'SPA Motor', price: 21.5, currency: 'EUR', availability: 'in_stock' })
    })
  })

  test('@smoke challenge pages and pages with offers are never rendered', async () => {
    let renders = 0
    const BROWSER_RENDERER = { fetch: async () => { renders++; return Response.json({ html: renderedPage }) } }
    const extraEnv = { BROWSER_RENDERER, PRODUCT_BROWSER_FALLBACK: '1' }
    await withFetch(() => html('<html><head><title>Just a moment...</title></head><body>cf-chl</body></html>'), async () => {
      const payload = await (await post({ url: 'https://walled.example/p/x', extract_mode: 'product' }, undefined, extraEnv)).json() as Payload
      expect(payload.content_source).toBe('fetched')
    })
    await withFetch(() => html('<script type="application/ld+json">{"@type":"Product","name":"Nano RX","offers":{"price":"29.95","priceCurrency":"USD"}}</script>'), async () => {
      await post({ url: 'https://shop.example/products/nano', extract_mode: 'product' }, undefined, extraEnv)
    })
    expect(renders).toBe(0)
  })

  test('@smoke a failed render keeps the static result', async () => {
    const BROWSER_RENDERER = { fetch: async () => Response.json({ error: 'Browser rendering failed' }, { status: 502 }) }
    await withFetch(() => html(shell), async () => {
      const payload = await (await post(
        { url: 'https://spa.example/p/motor', extract_mode: 'product' },
        undefined,
        { BROWSER_RENDERER, PRODUCT_BROWSER_FALLBACK: '1' },
      )).json() as Payload
      expect(payload).toMatchObject({ success: true, content_source: 'fetched', product: { offers: [] } })
    })
  })
})
