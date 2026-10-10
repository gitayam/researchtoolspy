import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'
import {
  detectCurrency,
  detectCurrencyInfo,
  parsePrice,
  parseStructuredPrice,
} from '../../../functions/api/_shared/price-parse'

interface Example {
  list: string
  price_raw: string | null
  currency_raw: string | null
  currency: string | null
  amount: number | null
  decimal_separator?: '.' | ','
}

// scrapinghub/price-parser's labelled corpus (BSD-3-Clause; see tests/fixtures/price-parser/LICENSE).
const corpus = JSON.parse(readFileSync(resolve(process.cwd(), 'tests/fixtures/price-parser/examples.json'), 'utf8')) as {
  examples: Example[]
}
// Upstream's own expected-failure lists, and the decimal-separator list whose
// cases depend on hints the extractor never has, are not part of the score.
const EXCLUDED = new Set([
  'PRICE_PARSING_EXAMPLES_XFAIL',
  'PRICE_PARSING_EXAMPLES_XFAIL_CURRENCIES_TO_BE_ADDED',
  'PRICE_PARSING_DECIMAL_SEPARATOR_EXAMPLES',
])
const scored = corpus.examples.filter(e => !EXCLUDED.has(e.list) && e.price_raw !== null)
const round2 = (value: number) => Math.round(value * 100) / 100

test.describe('price parsing: price-parser corpus @smoke', () => {
  test('@smoke amount accuracy on the labelled corpus (product.v1 baseline: 1016/1035 = 98.2%)', () => {
    const failures: string[] = []
    for (const example of scored) {
      const want = example.amount === null ? null : round2(example.amount)
      const got = parsePrice(example.price_raw)
      if (got !== want) failures.push(`${JSON.stringify(example.price_raw)} want ${want} got ${got}`)
    }
    expect(scored.length).toBe(1035)
    const accuracy = (scored.length - failures.length) / scored.length
    // Measured 1035/1035 when ported; leave a little room before this fails.
    expect(accuracy, failures.slice(0, 20).join('\n')).toBeGreaterThanOrEqual(0.995)
  })

  test('@smoke currency is recognised wherever the corpus labels one', () => {
    const labelled = scored.filter(e => e.currency)
    const detected = labelled.filter(e => detectCurrencyInfo(`${e.price_raw ?? ''} ${e.currency_raw ?? ''}`))
    // product.v1 detected 643/902; the misses left are obsolete currencies (PTE, DEM, ₣) and rare symbols.
    expect(labelled.length).toBe(902)
    expect(detected.length).toBeGreaterThanOrEqual(880)
  })

  test('@smoke the product.v1 regression list', () => {
    const cases: Array<[string, number | null]> = [
      ['Free!', 0],
      ['Rp 31.500', 31500],
      ['129.900', 129900],
      ['.75 €', 0.75],
      ['$.75', 0.75],
      ['$..75', 0.75],
      ['35€ 99', 35.99],
      ['40% OFF', null],
      ['1.727 Ft', 1727],
      ['200.000 đ', 200000],
      ['12.500 ₫', 12500],
      ['1.899,-', 1899],
      ['- $44.99', 44.99],
      ['From 26 to 50 €', 26],
    ]
    for (const [input, want] of cases) expect(parsePrice(input), input).toBe(want)
  })
})

test.describe('price parsing: display text @smoke', () => {
  test('@smoke the number next to the currency symbol wins', () => {
    expect(parsePrice('Save 20% now $15.99')).toBe(15.99)
    expect(parsePrice('2 x $5.00')).toBe(5)
    expect(parsePrice('Was $20 Now $15')).toBe(15)
    expect(parsePrice('RRP £59.99 Sale £44.99')).toBe(44.99)
    expect(parsePrice('From $12.99 – $19.99')).toBe(12.99)
    // A "Now $0.00" segment is a broken template, not a price.
    expect(parsePrice('Was: $124.95 Now: $0.00')).toBe(124.95)
  })

  test('@smoke a separator followed by exactly three digits groups thousands', () => {
    expect(parsePrice('£1.299')).toBe(1299)
    expect(parsePrice('1,234')).toBe(1234)
    expect(parsePrice('12,50')).toBe(12.5)
    expect(parsePrice('34.992001')).toBe(34.99)
    // Unless the page says otherwise, or the currency has three minor digits.
    expect(parsePrice('1.299', { decimalSeparator: '.' })).toBe(1.3)
    expect(parsePrice('140.000', { decimalSeparator: ',' })).toBe(140000)
    expect(parsePrice('423.923 KD')).toBe(423.92)
  })

  test('@smoke negatives are rejected, decorations are not', () => {
    expect(parsePrice('-5.00')).toBeNull()
    expect(parsePrice('$-5')).toBeNull()
    expect(parsePrice('-$5')).toBeNull()
    expect(parsePrice('Price-$5')).toBe(5)
  })

  test('@smoke structured fields are read literally', () => {
    expect(parseStructuredPrice('1.299')).toBe(1.3)
    expect(parseStructuredPrice(' 18.5 ')).toBe(18.5)
    expect(parseStructuredPrice(42)).toBe(42)
    // A site that wrote display text into a structured field still parses.
    expect(parseStructuredPrice('5,49')).toBe(5.49)
    expect(parseStructuredPrice('$12.99')).toBe(12.99)
    // "Free" → 0 is a display convention; a structured field needs digits.
    expect(parseStructuredPrice('free')).toBeNull()
    expect(parseStructuredPrice(-1)).toBeNull()
  })
})

test.describe('price parsing: currency @smoke', () => {
  test('@smoke unique symbols and codes are unambiguous', () => {
    expect(detectCurrencyInfo('1 299 Kč')).toEqual({ code: 'CZK', raw: 'Kč', ambiguous: false })
    expect(detectCurrency('1 128 240 руб.')).toBe('RUB')
    expect(detectCurrency('1.727 Ft')).toBe('HUF')
    expect(detectCurrency('₪ 89')).toBe('ILS')
    expect(detectCurrency('Rp 31.500')).toBe('IDR')
    expect(detectCurrency('99 lei')).toBe('RON')
    expect(detectCurrency('NZD $12')).toBe('NZD')
    expect(detectCurrency('eur')).toBe('EUR')
    // An uppercase word that is also a code needs a number beside it.
    expect(detectCurrency('ALL PRICES INCLUDE VAT')).toBeNull()
  })

  test('@smoke shared symbols are flagged and resolved from hints', () => {
    expect(detectCurrencyInfo('$15.00')).toEqual({ code: 'USD', raw: '$', ambiguous: true })
    expect(detectCurrencyInfo('kr 199')).toMatchObject({ code: 'SEK', ambiguous: true })
    expect(detectCurrencyInfo('¥ 120')).toMatchObject({ code: 'JPY', ambiguous: true })
    // An explicit code settles it.
    expect(detectCurrencyInfo('$45 CAD')).toMatchObject({ code: 'CAD', ambiguous: false })
    expect(detectCurrencyInfo('$5', { code: 'AUD' })).toMatchObject({ code: 'AUD', ambiguous: false })
    // Language or TLD is a better guess, still a guess.
    expect(detectCurrencyInfo('kr 199', { lang: 'nb-NO' })).toMatchObject({ code: 'NOK', ambiguous: true })
    expect(detectCurrencyInfo('¥ 120', { hostname: 'shop.example.cn' })).toMatchObject({ code: 'CNY', ambiguous: true })
    expect(detectCurrencyInfo('CA$ 45')).toMatchObject({ code: 'CAD', ambiguous: false })
  })
})
