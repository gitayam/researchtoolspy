import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'
import {
  detectCurrency,
  extractProduct,
  looksLikeShopify,
  matchOffer,
  matchOfferWithScore,
  normalizeAvailability,
  parseJsonLenient,
  parsePrice,
  shopifyProductJsUrl,
  tokenizeForMatch,
} from '../../../functions/api/_shared/product-extractor'

const fixtures = resolve(process.cwd(), 'tests/fixtures/product-pages')
const fixture = (name: string) => readFileSync(resolve(fixtures, name), 'utf8')
const jsonFixture = (name: string) => JSON.parse(fixture(name)) as Record<string, unknown>

const HOLYBRO_URL = 'https://holybro.com/products/spare-parts-x500-v2-kit'
const RDQ_URL = 'https://www.racedayquads.com/products/axisflying-af2406-x-modular-motor-1860kv-2080kv'

const ld = (value: unknown) => `<script type="application/ld+json">${JSON.stringify(value)}</script>`

test.describe('product extractor: price parsing @smoke', () => {
  test('@smoke parses US, European and plain price formats', () => {
    expect(parsePrice('$1,234.56')).toBe(1234.56)
    expect(parsePrice('1.234,56 €')).toBe(1234.56)
    expect(parsePrice('1 234,56 €')).toBe(1234.56)
    expect(parsePrice('1 234,56')).toBe(1234.56)
    expect(parsePrice("CHF 1'234.50")).toBe(1234.5)
    expect(parsePrice('12,50')).toBe(12.5)
    expect(parsePrice('1,234')).toBe(1234)
    expect(parsePrice('1.234.567')).toBe(1234567)
    expect(parsePrice('USD 19.99')).toBe(19.99)
    expect(parsePrice('&#36;7.00')).toBe(7)
    expect(parsePrice(18.99)).toBe(18.99)
    expect(parsePrice('32.49')).toBe(32.49)
  })

  test('@smoke rejects non-prices without throwing', () => {
    for (const value of ['', 'Call for price', '-5.00', '$-5', null, undefined, {}, [], Number.NaN, -1, Infinity]) {
      expect(parsePrice(value)).toBeNull()
    }
  })

  test('@smoke detects currency from codes and symbols', () => {
    expect(detectCurrency('USD')).toBe('USD')
    expect(detectCurrency('eur')).toBe('EUR')
    expect(detectCurrency('1.234,56 €')).toBe('EUR')
    expect(detectCurrency('£20')).toBe('GBP')
    expect(detectCurrency('CA$15.00')).toBe('CAD')
    expect(detectCurrency('$15.00')).toBe('USD')
    expect(detectCurrency('15.00')).toBeNull()
    expect(detectCurrency(null)).toBeNull()
  })

  test('@smoke normalizes schema.org and free-text availability', () => {
    expect(normalizeAvailability('http://schema.org/InStock')).toBe('in_stock')
    expect(normalizeAvailability('https://schema.org/OutOfStock')).toBe('out_of_stock')
    expect(normalizeAvailability('SoldOut')).toBe('out_of_stock')
    expect(normalizeAvailability('https://schema.org/PreOrder')).toBe('preorder')
    expect(normalizeAvailability('BackOrder')).toBe('preorder')
    expect(normalizeAvailability('in stock')).toBe('in_stock')
    expect(normalizeAvailability(true)).toBe('in_stock')
    expect(normalizeAvailability(false)).toBe('out_of_stock')
    expect(normalizeAvailability('LimitedEdition?')).toBe('unknown')
    expect(normalizeAvailability(undefined)).toBe('unknown')
  })
})

test.describe('product extractor: JSON-LD @smoke', () => {
  test('@smoke single Product with one Offer', () => {
    const html = `<html><head>${ld({
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: 'TBS Crossfire Nano RX',
      sku: 'TBS-CRSF-NANO',
      brand: { '@type': 'Brand', name: 'Team BlackSheep' },
      image: '/img/nano.jpg',
      offers: { '@type': 'Offer', price: '29.95', priceCurrency: 'USD', availability: 'https://schema.org/InStock', url: '/p/nano' },
    })}</head></html>`
    const product = extractProduct({ html, url: 'https://shop.example/p/nano' })
    expect(product).toMatchObject({
      name: 'TBS Crossfire Nano RX',
      brand: 'Team BlackSheep',
      sku: 'TBS-CRSF-NANO',
      image: 'https://shop.example/img/nano.jpg',
      currency: 'USD',
      sources: ['json-ld'],
      price_range: { low: 29.95, high: 29.95, currency: 'USD' },
    })
    expect(product.offers).toEqual([{
      title: 'TBS Crossfire Nano RX',
      price: 29.95,
      currency: 'USD',
      availability: 'in_stock',
      sku: 'TBS-CRSF-NANO',
      url: 'https://shop.example/p/nano',
      image: 'https://shop.example/img/nano.jpg',
    }])
    expect(product.confidence).toBeGreaterThanOrEqual(0.9)
  })

  test('@smoke AggregateOffer keeps the low/high range and offer count', () => {
    const html = ld({
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: '5" Freestyle Props',
      offers: { '@type': 'AggregateOffer', lowPrice: '3.99', highPrice: '5,49', offerCount: '6', priceCurrency: 'EUR' },
    })
    const product = extractProduct({ html, url: 'https://shop.example/props' })
    expect(product.offers).toHaveLength(1)
    expect(product.offers[0]).toMatchObject({
      title: '5" Freestyle Props',
      price: 3.99,
      currency: 'EUR',
      aggregate: { high_price: 5.49, offer_count: 6 },
    })
    expect(product.price_range).toEqual({ low: 3.99, high: 5.49, currency: 'EUR' })
  })

  test('@smoke @graph arrays and priceSpecification are followed', () => {
    const html = ld({
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'WebPage', '@id': 'https://shop.example/esc#page' },
        { '@type': 'Organization', name: 'Shop' },
        {
          '@type': ['Product'],
          '@id': 'https://shop.example/esc#product',
          name: '4-in-1 45A ESC',
          offers: [{ '@type': 'Offer', priceSpecification: { '@type': 'UnitPriceSpecification', price: 54.99, priceCurrency: 'GBP' } }],
        },
      ],
    })
    const product = extractProduct({ html, url: 'https://shop.example/esc' })
    expect(product.name).toBe('4-in-1 45A ESC')
    expect(product.offers[0]).toMatchObject({ price: 54.99, currency: 'GBP', title: '4-in-1 45A ESC' })
  })

  test('@smoke a page Product beats an unrelated carousel Product', () => {
    const html = ld({ '@type': 'Product', name: 'Related thing', url: 'https://shop.example/other', offers: { price: '1.00', priceCurrency: 'USD' } })
      + ld({ '@type': 'Product', name: 'This thing', url: 'https://shop.example/this/', offers: { price: '9.00', priceCurrency: 'USD' } })
    const product = extractProduct({ html, url: 'https://shop.example/this?ref=x' })
    expect(product.name).toBe('This thing')
    expect(product.offers.map(o => o.price)).toEqual([9])
  })

  test('@smoke ProductGroup hasVariant from a real RaceDayQuads page', () => {
    const product = extractProduct({ html: fixture('racedayquads-af2406-x.html'), url: RDQ_URL })
    expect(product.name).toBe('Axisflying AF2406-X Modular Motor - 1860KV/2080KV')
    expect(product.brand).toBe('AXIS FLYING')
    expect(product.sources).toContain('json-ld')
    // The sibling Product node repeats both offers without names; they are merged, not duplicated.
    expect(product.offers.map(o => [o.title, o.price, o.sku, o.availability])).toEqual([
      ['1860KV', 32.49, 'G25021CN1Z', 'in_stock'],
      ['2080KV', 32.49, 'G25022CN1Z', 'in_stock'],
    ])
    expect(product.offers[1].url).toBe(`${RDQ_URL}?variant=44514325135473`)
  })

  test('@smoke malformed JSON-LD is repaired or skipped, never thrown', () => {
    const repaired = extractProduct({
      html: `<script type="application/ld+json">{"@type":"Product","name":"Frame
 kit","offers":{"price":"99.00","priceCurrency":"USD",},}</script>`,
      url: 'https://shop.example/frame',
    })
    expect(repaired.offers[0]).toMatchObject({ price: 99, currency: 'USD' })

    const broken = extractProduct({
      html: '<script type="application/ld+json">{"@type":"Product", "offers": [ {"price": </script>'
        + '<meta property="product:price:amount" content="12.00"><meta property="product:price:currency" content="USD">',
      url: 'https://shop.example/x',
    })
    expect(broken.sources).toEqual(['og-meta'])
    expect(broken.offers[0].price).toBe(12)

    expect(parseJsonLenient('<!-- {"a":1} -->')).toEqual({ a: 1 })
    expect(parseJsonLenient('not json')).toBeNull()
  })

  test('@smoke HTML entities in names are decoded', () => {
    const product = extractProduct({
      html: ld({ '@type': 'Product', name: 'Gemfan 51433 &amp; Mounting Kit &#8211; 3 Blade', offers: { price: '4.99', priceCurrency: 'USD' } }),
      url: 'https://shop.example/p',
    })
    expect(product.name).toBe('Gemfan 51433 & Mounting Kit – 3 Blade')
  })
})

test.describe('product extractor: Shopify @smoke', () => {
  test('@smoke recognises Shopify pages and derives the .js URL', () => {
    expect(looksLikeShopify(fixture('holybro-x500-v2-spares.html'))).toBe(true)
    expect(looksLikeShopify('<html><body>plain</body></html>')).toBe(false)
    expect(shopifyProductJsUrl(`${HOLYBRO_URL}?variant=41591073669309#reviews`)).toBe(`${HOLYBRO_URL}.js`)
    expect(shopifyProductJsUrl(`${HOLYBRO_URL}/`)).toBe(`${HOLYBRO_URL}.js`)
    expect(shopifyProductJsUrl('https://shop.example/collections/motors')).toBeNull()
  })

  test('@smoke .js prices are integer cents', () => {
    const product = extractProduct({ shopifyJson: jsonFixture('holybro-x500-v2-spares.js.json'), url: HOLYBRO_URL })
    expect(product.sources).toContain('shopify')
    expect(product.offers).toHaveLength(17)
    const prop = product.offers.find(o => o.title === 'Propeller1045(2pair)')
    expect(prop).toMatchObject({ price: 11.59, availability: 'out_of_stock', sku: '530084', url: `${HOLYBRO_URL}?variant=41591073669309` })
    expect(product.offers[0]).toMatchObject({ price: 18.99, availability: 'in_stock' })
    // .js carries no currency; without a page it stays unknown rather than guessed.
    expect(product.currency).toBeNull()
  })

  test('@smoke .json prices are decimal strings with per-variant currency', () => {
    const product = extractProduct({ shopifyJson: jsonFixture('holybro-x500-v2-spares.product.json'), url: HOLYBRO_URL })
    expect(product.offers[0]).toMatchObject({
      title: 'Carbon Fiber Landing Gear with Plastic Connectors (Single Leg)',
      price: 18.99,
      currency: 'USD',
      availability: 'unknown',
    })
    expect(product.offers[3]).toMatchObject({ title: 'Propeller1045(2pair)', price: 11.59 })
    expect(product.brand).toBe('PCBA')
  })

  test('@smoke real Holybro page: JSON-LD prices with Shopify variant titles', () => {
    const htmlOnly = extractProduct({ html: fixture('holybro-x500-v2-spares.html'), url: HOLYBRO_URL })
    expect(htmlOnly.sources).toEqual(['json-ld'])
    expect(htmlOnly.offers).toHaveLength(17)
    // The theme's JSON-LD offers carry no variant names; the SKU is the best label available.
    expect(htmlOnly.offers[3]).toMatchObject({ title: '530084', price: 11.59, currency: 'USD', availability: 'out_of_stock' })

    const merged = extractProduct({
      html: fixture('holybro-x500-v2-spares.html'),
      shopifyJson: jsonFixture('holybro-x500-v2-spares.js.json'),
      url: HOLYBRO_URL,
    })
    expect(merged.sources).toEqual(['json-ld', 'shopify'])
    expect(merged.currency).toBe('USD')
    expect(merged.offers[3]).toMatchObject({ title: 'Propeller1045(2pair)', price: 11.59, currency: 'USD' })
    expect(merged.price_range).toEqual({ low: 2.59, high: 30.59, currency: 'USD' })
    expect(merged.confidence).toBeGreaterThan(htmlOnly.confidence)
  })

  test('@smoke Shopify JSON alone uses the page Shopify.currency', () => {
    const html = '<script>Shopify.currency = {"active":"CAD","rate":"1.37"};</script><link href="https://cdn.shopify.com/x.css">'
    const product = extractProduct({ html, shopifyJson: jsonFixture('racedayquads-af2406-x.js.json'), url: RDQ_URL })
    expect(product.offers.map(o => [o.title, o.price, o.currency])).toEqual([
      ['1860KV', 32.49, 'CAD'],
      ['2080KV', 32.49, 'CAD'],
    ])
  })

  test('@smoke a single "Default Title" variant takes the product name', () => {
    const product = extractProduct({
      shopifyJson: { title: 'XT60 Pigtail', vendor: 'Amass', variants: [{ id: 1, title: 'Default Title', price: 299, available: true }] },
      url: 'https://shop.example/products/xt60-pigtail',
    })
    expect(product.offers[0]).toMatchObject({ title: 'XT60 Pigtail', price: 2.99 })
  })
})

test.describe('product extractor: meta fallbacks @smoke', () => {
  test('@smoke product/og meta tags', () => {
    const product = extractProduct({
      html: fixture('racedayquads-af2406-x.html').replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, ''),
      url: RDQ_URL,
    })
    expect(product.sources).toEqual(['og-meta'])
    expect(product.offers).toEqual([{
      title: 'Axisflying AF2406-X Modular Motor - 1860KV/2080KV',
      price: 32.49,
      currency: 'USD',
      availability: 'unknown',
      sku: null,
      url: RDQ_URL,
      image: 'http://www.racedayquads.com/cdn/shop/files/axisflying-af2406-x-modular-motor-1860kv-2080kv-motor-1257660250.jpg?v=1788984849',
    }])
    expect(product.confidence).toBeLessThan(0.7)
  })

  test('@smoke itemprop microdata beats og meta', () => {
    const product = extractProduct({
      html: `<div itemscope itemtype="https://schema.org/Product">
        <meta itemprop="name" content="1500mAh 6S LiPo">
        <span itemprop="price" content="1.234,56">1.234,56 €</span>
        <meta itemprop="priceCurrency" content="EUR">
        <link itemprop="availability" href="https://schema.org/PreOrder">
      </div><meta property="og:price:amount" content="1.00">`,
      url: 'https://shop.example/lipo',
    })
    expect(product.sources[0]).toBe('microdata-meta')
    expect(product.offers[0]).toMatchObject({ price: 1234.56, currency: 'EUR', availability: 'preorder', title: '1500mAh 6S LiPo' })
  })

  test('@smoke garbage input returns empty offers', () => {
    for (const input of [
      { html: '', url: '' },
      { html: '<html><body>No product here</body></html>', url: 'https://shop.example/' },
      { html: null, shopifyJson: 'nope', url: 'not a url' },
      { html: undefined, shopifyJson: { variants: [{ price: 'free' }, null, 42] }, url: 'https://shop.example/products/x' },
      null as never,
    ]) {
      const product = extractProduct(input)
      expect(product.offers).toEqual([])
      expect(product.confidence).toBe(0)
      expect(product.price_range).toBeNull()
    }
  })
})

test.describe('product extractor: matchOffer @smoke', () => {
  const holybro = extractProduct({
    html: fixture('holybro-x500-v2-spares.html'),
    shopifyJson: jsonFixture('holybro-x500-v2-spares.js.json'),
    url: HOLYBRO_URL,
  })
  const context = { productName: holybro.name }

  test('@smoke canonicalises number+unit tokens', () => {
    const tokens = tokenizeForMatch('Motor 2216-920KV-CW (1PC) Propeller1045(2pair) 2.4GHz 1500 mAh 5"')
    expect([...tokens.numbers].sort()).toEqual(['1045', '1500mah', '1pc', '2216', '2.4ghz', '2pair', '5in', '920kv'].sort())
    expect(tokenizeForMatch('KV920').numbers).toEqual(new Set(['920kv']))
    expect(tokenizeForMatch('X500 V2').numbers).toEqual(new Set(['500', '2']))
  })

  test('@smoke picks the propeller variant, not the motor', () => {
    expect(matchOffer(holybro.offers, 'Propeller1045(2pair)', context)?.title).toBe('Propeller1045(2pair)')
    expect(matchOffer(holybro.offers, 'x500 v2 1045 propellers', context)?.title).toBe('Propeller1045(2pair)')
  })

  test('@smoke picks the motor variant by number+unit, in either order', () => {
    expect(matchOffer(holybro.offers, 'Motor 2216-920KV-CCW', context)?.title).toBe('Motor 2216-920KV-CCW (1PC)')
    expect(matchOffer(holybro.offers, '2216 KV920 CW motor', context)?.title).toBe('Motor 2216-920KV-CW (1PC)')
  })

  test('@smoke a tie between same-priced variants resolves and is flagged', () => {
    const match = matchOfferWithScore(holybro.offers, '2216 KV920 motor', context)
    expect(match?.offer.price).toBe(19.99)
    expect(match?.ambiguous_same_price).toBe(true)
  })

  test('@smoke a contradicting number never matches', () => {
    expect(matchOffer(holybro.offers, '2306 1750KV motor', context)).toBeNull()
    expect(matchOffer(holybro.offers, 'propeller 5045', context)).toBeNull()
  })

  test('@smoke product-name numbers do not block variant-only titles', () => {
    const rdq = extractProduct({ html: fixture('racedayquads-af2406-x.html'), url: RDQ_URL })
    expect(matchOffer(rdq.offers, 'Axisflying AF2406 2080KV', { productName: rdq.name })?.sku).toBe('G25022CN1Z')
    expect(matchOffer(rdq.offers, 'AF2406-X 1860 kv', { productName: rdq.name })?.sku).toBe('G25021CN1Z')
    // Nothing distinguishes the variants: no guess.
    expect(matchOffer(rdq.offers, 'AF2406', { productName: rdq.name })).toBeNull()
  })

  test('@smoke a different-priced tie is ambiguous and returns null', () => {
    expect(matchOffer([
      { title: 'Red', sku: null, price: 1, currency: 'USD' },
      { title: 'Blue', sku: null, price: 2, currency: 'USD' },
    ], 'frame arm')).toBeNull()
  })

  test('@smoke bad arguments return null', () => {
    expect(matchOffer([], 'x')).toBeNull()
    expect(matchOffer(holybro.offers, '   ')).toBeNull()
    expect(matchOffer(null as never, 'x')).toBeNull()
  })
})
