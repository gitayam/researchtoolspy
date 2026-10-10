/**
 * Structured product/price extraction for one product page.
 *
 * Pure and dependency-free so it runs on Workers and in tests. Every exported
 * function tolerates arbitrary input: malformed markup or JSON yields empty
 * offers, never an exception.
 *
 * Source priority (highest first):
 *   1. schema.org JSON-LD Product / ProductGroup (hasVariant), Offer, AggregateOffer, @graph
 *   2. Shopify product JSON (`<product-url>.js`: integer cents; `.json`: decimal strings)
 *   3. Meta tags: itemprop microdata, then product:/og: price metadata
 *
 * A lower-priority source fills fields a higher one lacks (for example a
 * Shopify variant title for a JSON-LD offer that only carries a SKU and URL),
 * but never replaces a price that a higher-priority source stated.
 */
import { decodeHtmlEntities } from './article-extractor'

export const PRODUCT_EXTRACTOR_VERSION = 'product.v1' as const

export type ProductAvailability = 'in_stock' | 'out_of_stock' | 'preorder' | 'unknown'
export type ProductSource = 'json-ld' | 'microdata-meta' | 'shopify' | 'og-meta'

export interface ProductOffer {
  /** Variant or offer name. Falls back to the product name for single-offer pages. */
  title: string
  /** Price in major currency units (dollars, euros), never cents. */
  price: number
  currency: string | null
  availability: ProductAvailability
  sku: string | null
  url: string | null
  image?: string | null
  /** Present only for a schema.org AggregateOffer summarised as one offer. */
  aggregate?: { high_price: number | null; offer_count: number | null }
}

export interface ProductExtraction {
  name: string | null
  brand: string | null
  sku: string | null
  image: string | null
  currency: string | null
  offers: ProductOffer[]
  /** Sources that contributed at least one field, in priority order. */
  sources: ProductSource[]
  /**
   * 0–1 extraction-coverage heuristic: how structured the price evidence was.
   * It is not a statement that the price is current or that the seller is reliable.
   */
  confidence: number
  /** min/max across offers (or the AggregateOffer range), when any priced offer exists. */
  price_range: { low: number; high: number; currency: string | null } | null
  extractor_version: typeof PRODUCT_EXTRACTOR_VERSION
}

export interface ProductExtractionInput {
  html?: string | null
  /** Parsed `<product-url>.js` or `<product-url>.json` body (with or without the `product` wrapper). */
  shopifyJson?: unknown
  url: string
}

const MAX_OFFERS = 250
const MAX_JSON_LD_BLOCKS = 50
const MAX_JSON_LD_BYTES = 512 * 1024
const MAX_NODE_DEPTH = 12

/* ------------------------------------------------------------------ */
/* Primitive parsing                                                   */
/* ------------------------------------------------------------------ */

const SYMBOL_CURRENCIES: ReadonlyArray<[string, string]> = [
  ['US$', 'USD'], ['CA$', 'CAD'], ['C$', 'CAD'], ['A$', 'AUD'], ['AU$', 'AUD'], ['NZ$', 'NZD'],
  ['HK$', 'HKD'], ['S$', 'SGD'], ['R$', 'BRL'], ['€', 'EUR'], ['£', 'GBP'], ['¥', 'JPY'],
  ['₹', 'INR'], ['₩', 'KRW'], ['₽', 'RUB'], ['zł', 'PLN'], ['kr', 'SEK'], ['CHF', 'CHF'], ['$', 'USD'],
]

function str(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value !== 'string') return null
  const cleaned = decodeHtmlEntities(value).replace(/\s+/g, ' ').trim()
  return cleaned ? cleaned : null
}

/** ISO 4217 code from an explicit code or a currency symbol/prefix in free text. */
export function detectCurrency(value: unknown): string | null {
  const text = str(value)
  if (!text) return null
  const code = text.toUpperCase().match(/(?:^|[^A-Z])([A-Z]{3})(?:[^A-Z]|$)/)
  if (code && /^(USD|EUR|GBP|CAD|AUD|NZD|JPY|CNY|RMB|HKD|SGD|CHF|SEK|NOK|DKK|PLN|CZK|INR|KRW|BRL|MXN|RUB|TRY|ZAR|TWD|THB|ILS)$/.test(code[1])) {
    return code[1] === 'RMB' ? 'CNY' : code[1]
  }
  for (const [symbol, iso] of SYMBOL_CURRENCIES) {
    if (text.includes(symbol)) return iso
  }
  return null
}

/**
 * Parse a price in major units from a number or display string.
 *
 * Handles "$1,234.56", "1.234,56 €", "1 234,56", "12,5", "1'234.50", "USD 19.99".
 * When both separators occur, the last one is the decimal separator. A lone comma
 * followed by exactly three digits is a thousands separator ("1,234" → 1234); any
 * other lone comma is decimal ("12,50" → 12.5). A single dot is always decimal.
 * Returns null for anything that is not a finite, non-negative amount.
 */
export function parsePrice(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? round2(value) : null
  if (typeof value !== 'string') return null
  const text = decodeHtmlEntities(value).replace(/[\s\u00a0\u202f']/g, '')
  const match = text.match(/\d[\d.,]*/)
  if (!match) return null
  // "-5", "$-5", "-$5" are negative; "Price-$5" (a dash used as punctuation) is not.
  if (/(^|[^a-z])-\D{0,3}$/i.test(text.slice(0, match.index ?? 0))) return null
  let digits = match[0].replace(/[.,]+$/, '')
  const lastComma = digits.lastIndexOf(',')
  const lastDot = digits.lastIndexOf('.')
  if (lastComma >= 0 && lastDot >= 0) {
    const decimal = lastComma > lastDot ? ',' : '.'
    const thousands = decimal === ',' ? '.' : ','
    digits = digits.split(thousands).join('').replace(decimal, '.')
  } else if (lastComma >= 0) {
    const commaCount = digits.split(',').length - 1
    const tail = digits.slice(lastComma + 1)
    digits = commaCount > 1 || tail.length === 3
      ? digits.replace(/,/g, '')
      : digits.replace(',', '.')
  } else if ((digits.match(/\./g) ?? []).length > 1) {
    digits = digits.replace(/\./g, '')
  }
  const parsed = Number(digits)
  return Number.isFinite(parsed) && parsed >= 0 ? round2(parsed) : null
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

export function normalizeAvailability(value: unknown): ProductAvailability {
  if (typeof value === 'boolean') return value ? 'in_stock' : 'out_of_stock'
  const text = str(value)
  if (!text) return 'unknown'
  const key = text.toLowerCase().replace(/^https?:\/\/schema\.org\//, '').replace(/[^a-z]/g, '')
  if (/^(instock|instoreonly|onlineonly|limitedavailability|available|true|yes|in)$/.test(key)) return 'in_stock'
  if (/^(outofstock|soldout|discontinued|unavailable|oos|false|no|out)$/.test(key)) return 'out_of_stock'
  if (/^(preorder|presale|backorder|availablefororder|madetoorder)$/.test(key)) return 'preorder'
  return 'unknown'
}

function absoluteUrl(value: unknown, base: string): string | null {
  const raw = str(value)
  if (!raw) return null
  try {
    const resolved = new URL(raw, base)
    return resolved.protocol === 'http:' || resolved.protocol === 'https:' ? resolved.href : null
  } catch {
    return null
  }
}

function asArray(value: unknown): unknown[] {
  if (value === undefined || value === null) return []
  return Array.isArray(value) ? value : [value]
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function types(node: Record<string, unknown>): string[] {
  return asArray(node['@type']).filter((t): t is string => typeof t === 'string')
    .map(t => t.replace(/^https?:\/\/schema\.org\//i, '').toLowerCase())
}

function nameOf(value: unknown): string | null {
  if (isObject(value)) return str(value.name)
  if (Array.isArray(value)) return nameOf(value[0])
  return str(value)
}

function imageOf(value: unknown, base: string): string | null {
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = imageOf(entry, base)
      if (found) return found
    }
    return null
  }
  if (isObject(value)) return absoluteUrl(value.url ?? value.contentUrl ?? value.image, base)
  return absoluteUrl(value, base)
}

function variantIdFromUrl(url: string | null): string | null {
  if (!url) return null
  try {
    return new URL(url).searchParams.get('variant')
  } catch {
    return null
  }
}

/* ------------------------------------------------------------------ */
/* JSON-LD                                                             */
/* ------------------------------------------------------------------ */

/** Parse JSON-LD text, repairing the common breakages (raw control chars, trailing commas). */
export function parseJsonLenient(text: string): unknown {
  const trimmed = text
    .replace(/^\s*<!\[CDATA\[/, '').replace(/\]\]>\s*$/, '')
    .replace(/^\s*<!--/, '').replace(/-->\s*$/, '')
    .trim()
  if (!trimmed || trimmed.length > MAX_JSON_LD_BYTES) return null
  try {
    return JSON.parse(trimmed)
  } catch {
    // fall through to repair
  }
  try {
    // Control characters are invalid inside JSON strings; outside them they are
    // whitespace, so replacing all of them with a space is safe either way.
    // eslint-disable-next-line no-control-regex
    const repaired = trimmed.replace(/[\u0000-\u001f]+/g, ' ').replace(/,\s*([}\]])/g, '$1')
    return JSON.parse(repaired)
  } catch {
    return null
  }
}

function jsonLdBlocks(html: string): unknown[] {
  const blocks: unknown[] = []
  const pattern = /<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi
  for (const match of html.matchAll(pattern)) {
    if (blocks.length >= MAX_JSON_LD_BLOCKS) break
    const parsed = parseJsonLenient(match[1])
    if (parsed !== null) blocks.push(parsed)
  }
  return blocks
}

/** Top-level Product/ProductGroup nodes, flattening arrays and @graph but not descending into hasVariant. */
function productNodes(blocks: unknown[]): Record<string, unknown>[] {
  const found: Record<string, unknown>[] = []
  const visit = (value: unknown, depth: number) => {
    if (depth > MAX_NODE_DEPTH) return
    if (Array.isArray(value)) {
      for (const entry of value) visit(entry, depth + 1)
      return
    }
    if (!isObject(value)) return
    const nodeTypes = types(value)
    if (nodeTypes.includes('product') || nodeTypes.includes('productgroup')) {
      found.push(value)
      return
    }
    if (value['@graph']) visit(value['@graph'], depth + 1)
    // WebPage { mainEntity: Product } and ItemPage patterns.
    if (value.mainEntity) visit(value.mainEntity, depth + 1)
  }
  for (const block of blocks) visit(block, 0)
  return found
}

function stripGroupPrefix(variantName: string | null, groupName: string | null): string | null {
  if (!variantName) return null
  if (groupName && variantName.length > groupName.length
    && variantName.toLowerCase().startsWith(groupName.toLowerCase())) {
    const rest = variantName.slice(groupName.length).replace(/^\s*[-–—:|/]\s*/, '').trim()
    if (rest) return rest
  }
  return variantName
}

interface DraftOffer extends Omit<ProductOffer, 'title'> {
  title: string | null
  variantId: string | null
}

function offersFromJsonLdOffer(
  offerValue: unknown,
  context: { title: string | null; sku: string | null; currency: string | null; image: string | null },
  base: string,
  out: DraftOffer[],
  aggregate: { low: number; high: number | null; count: number | null; currency: string | null }[],
  depth = 0,
): void {
  if (depth > MAX_NODE_DEPTH) return
  for (const offer of asArray(offerValue)) {
    if (!isObject(offer) || out.length >= MAX_OFFERS) continue
    const offerTypes = types(offer)
    const currency = detectCurrency(offer.priceCurrency) ?? context.currency
    if (offerTypes.includes('aggregateoffer')) {
      const nested = asArray(offer.offers)
      if (nested.length > 0) {
        offersFromJsonLdOffer(nested, { ...context, currency }, base, out, aggregate, depth + 1)
        continue
      }
      const low = parsePrice(offer.lowPrice) ?? parsePrice(offer.price)
      if (low === null) continue
      const high = parsePrice(offer.highPrice)
      const count = typeof offer.offerCount === 'number' ? offer.offerCount
        : Number.isFinite(Number(offer.offerCount)) && offer.offerCount !== undefined ? Number(offer.offerCount) : null
      aggregate.push({ low, high, count, currency })
      out.push({
        title: context.title,
        price: low,
        currency,
        availability: normalizeAvailability(offer.availability),
        sku: str(offer.sku) ?? context.sku,
        url: absoluteUrl(offer.url, base),
        image: context.image,
        aggregate: { high_price: high, offer_count: count },
        variantId: variantIdFromUrl(absoluteUrl(offer.url, base)),
      })
      continue
    }
    // Offer (or untyped offer-like object). priceSpecification is the structured alternative to price.
    let price = parsePrice(offer.price)
    let specCurrency: string | null = null
    if (price === null) {
      for (const spec of asArray(offer.priceSpecification)) {
        if (!isObject(spec)) continue
        price = parsePrice(spec.price)
        specCurrency = detectCurrency(spec.priceCurrency)
        if (price !== null) break
      }
    }
    if (price === null) continue
    const url = absoluteUrl(offer.url, base)
    out.push({
      title: str(offer.name) ?? context.title,
      price,
      currency: detectCurrency(offer.priceCurrency) ?? specCurrency ?? context.currency
        ?? (typeof offer.price === 'string' ? detectCurrency(offer.price) : null),
      availability: normalizeAvailability(offer.availability),
      sku: str(offer.sku) ?? context.sku,
      url,
      image: imageOf(offer.image, base) ?? context.image,
      variantId: variantIdFromUrl(url),
    })
  }
}

interface SourceResult {
  name: string | null
  brand: string | null
  sku: string | null
  image: string | null
  currency: string | null
  offers: DraftOffer[]
  aggregate: { low: number; high: number | null; count: number | null; currency: string | null }[]
}

function emptySource(): SourceResult {
  return { name: null, brand: null, sku: null, image: null, currency: null, offers: [], aggregate: [] }
}

function samePage(nodeUrl: string | null, pageUrl: string): boolean {
  if (!nodeUrl) return false
  try {
    const a = new URL(nodeUrl, pageUrl)
    const b = new URL(pageUrl)
    return a.hostname === b.hostname && a.pathname.replace(/\/+$/, '') === b.pathname.replace(/\/+$/, '')
  } catch {
    return false
  }
}

function fromJsonLd(html: string, pageUrl: string): SourceResult {
  const result = emptySource()
  let nodes = productNodes(jsonLdBlocks(html))
  if (nodes.length === 0) return result
  // Product carousels ("you may also like") also emit Product nodes. When some
  // node identifies itself as this page, ignore the others.
  const own = nodes.filter(node => samePage(str(node.url) ?? str(node['@id']), pageUrl))
  if (own.length > 0) nodes = own
  else nodes = nodes.slice(0, 1)
  // ProductGroup first: its hasVariant entries carry per-variant names that a
  // sibling Product node's bare offers lack, and dedupe keeps the first title.
  nodes = [...nodes].sort((a, b) => Number(types(b).includes('productgroup')) - Number(types(a).includes('productgroup')))

  for (const node of nodes) {
    const name = str(node.name)
    const image = imageOf(node.image, pageUrl)
    const sku = str(node.sku) ?? str(node.mpn)
    result.name ??= name
    result.brand ??= nameOf(node.brand) ?? nameOf(node.manufacturer)
    result.sku ??= sku
    result.image ??= image

    const variants = asArray(node.hasVariant)
    for (const variant of variants) {
      if (!isObject(variant)) continue
      const variantName = stripGroupPrefix(str(variant.name), name)
      offersFromJsonLdOffer(variant.offers, {
        title: variantName,
        sku: str(variant.sku) ?? str(variant.mpn),
        currency: null,
        image: imageOf(variant.image, pageUrl) ?? image,
      }, pageUrl, result.offers, result.aggregate)
    }
    // Several offers on one Product are variants whose names the offers rarely
    // carry; leave the title empty so another source (Shopify) can supply it.
    const single = variants.length === 0 && asArray(node.offers).length <= 1
    offersFromJsonLdOffer(node.offers, {
      title: single ? name : null,
      sku: single ? sku : null,
      currency: null,
      image,
    }, pageUrl, result.offers, result.aggregate)
  }
  result.offers = dedupeOffers(result.offers)
  result.currency = result.offers.find(o => o.currency)?.currency ?? null
  return result
}

/** Merge duplicates (same variant id, else same SKU+price) keeping the most complete fields. */
function dedupeOffers(offers: DraftOffer[]): DraftOffer[] {
  const out: DraftOffer[] = []
  for (const offer of offers) {
    const existing = out.find(other =>
      (offer.variantId && other.variantId === offer.variantId)
      || (!offer.variantId && !other.variantId && offer.url && other.url === offer.url && other.price === offer.price)
      || (offer.sku && other.sku === offer.sku && other.price === offer.price && (!offer.variantId || !other.variantId)))
    if (!existing) {
      out.push({ ...offer })
      continue
    }
    existing.title ??= offer.title
    existing.currency ??= offer.currency
    existing.sku ??= offer.sku
    existing.url ??= offer.url
    existing.image ??= offer.image
    existing.variantId ??= offer.variantId
    if (existing.availability === 'unknown') existing.availability = offer.availability
  }
  return out
}

/* ------------------------------------------------------------------ */
/* Shopify product JSON                                                */
/* ------------------------------------------------------------------ */

/** Strip query/fragment and any trailing .js/.json/.oembed from a Shopify product URL. */
export function shopifyProductBaseUrl(pageUrl: string): string | null {
  try {
    const url = new URL(pageUrl)
    url.search = ''
    url.hash = ''
    url.pathname = url.pathname.replace(/\/+$/, '').replace(/\.(js|json|oembed)$/i, '')
    return /\/products\/[^/]+$/.test(url.pathname) ? url.href : null
  } catch {
    return null
  }
}

/** The `<product-url>.js` endpoint for a Shopify product page URL, or null if the path is not /products/<handle>. */
export function shopifyProductJsUrl(pageUrl: string): string | null {
  const base = shopifyProductBaseUrl(pageUrl)
  return base ? `${base}.js` : null
}

/** Heuristic: does this HTML come from a Shopify storefront? */
export function looksLikeShopify(html: string | null | undefined): boolean {
  if (!html) return false
  const head = html.slice(0, 400_000)
  return /cdn\.shopify\.com|\/cdn\/shop\/|Shopify\.shop\s*=|<meta[^>]+name=["']shopify-|shopify-features|window\.ShopifyAnalytics/i.test(head)
}

function shopifyPageCurrency(html: string | null | undefined): string | null {
  if (!html) return null
  const match = html.match(/Shopify\.currency\s*=\s*\{[^}]*"active"\s*:\s*"([A-Z]{3})"/)
  return match ? match[1] : null
}

function fromShopify(raw: unknown, pageUrl: string, fallbackCurrency: string | null): SourceResult {
  const result = emptySource()
  const product = isObject(raw) && isObject(raw.product) ? raw.product : raw
  if (!isObject(product)) return result
  const variants = asArray(product.variants).filter(isObject)
  // `.js` has `price` in integer cents and `available`; `.json` has decimal strings and `price_currency`.
  const isJsShape = variants.some(v => typeof v.price === 'number')
    || typeof product.price === 'number' || 'available' in product

  result.name = str(product.title)
  result.brand = str(product.vendor)
  const featured = product.featured_image ?? (isObject(product.image) ? product.image.src : undefined)
    ?? (Array.isArray(product.images) ? (isObject(product.images[0]) ? product.images[0].src : product.images[0]) : undefined)
  result.image = absoluteUrl(typeof featured === 'string' && featured.startsWith('//') ? `https:${featured}` : featured, pageUrl)
  result.sku = str(variants[0]?.sku)

  const base = shopifyProductBaseUrl(pageUrl) ?? pageUrl
  const singleDefault = variants.length === 1 && /^default title$/i.test(String(variants[0].title ?? ''))

  for (const variant of variants.slice(0, MAX_OFFERS)) {
    const rawPrice = variant.price
    const price = typeof rawPrice === 'number'
      ? (Number.isFinite(rawPrice) && rawPrice >= 0 ? round2(rawPrice / 100) : null)
      : isJsShape && typeof rawPrice === 'string' && /^\d+$/.test(rawPrice)
        ? round2(Number(rawPrice) / 100)
        : parsePrice(rawPrice)
    if (price === null) continue
    const id = variant.id !== undefined && variant.id !== null ? String(variant.id) : null
    const image = isObject(variant.featured_image) ? variant.featured_image.src : undefined
    result.offers.push({
      title: singleDefault ? result.name : str(variant.title) ?? str(variant.public_title) ?? result.name,
      price,
      currency: detectCurrency(variant.price_currency) ?? fallbackCurrency,
      availability: 'available' in variant ? normalizeAvailability(Boolean(variant.available)) : 'unknown',
      sku: str(variant.sku),
      url: id ? `${base}?variant=${encodeURIComponent(id)}` : base,
      image: absoluteUrl(typeof image === 'string' && image.startsWith('//') ? `https:${image}` : image, pageUrl),
      variantId: id,
    })
  }
  result.currency = result.offers.find(o => o.currency)?.currency ?? fallbackCurrency
  return result
}

/* ------------------------------------------------------------------ */
/* Meta tags                                                           */
/* ------------------------------------------------------------------ */

function attributesOf(tag: string): Record<string, string> {
  const result: Record<string, string> = {}
  for (const match of tag.matchAll(/([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
    result[match[1].toLowerCase()] = decodeHtmlEntities(match[2] ?? match[3] ?? match[4] ?? '')
  }
  return result
}

function fromMeta(html: string, pageUrl: string): { microdata: SourceResult; og: SourceResult } {
  const og = new Map<string, string>()
  const item = new Map<string, string>()
  for (const match of html.matchAll(/<(meta|link|span|div|data|p|strong|b)\b[^>]*>/gi)) {
    const attrs = attributesOf(match[0])
    const property = (attrs.property || attrs.name || '').toLowerCase()
    const value = (attrs.content ?? attrs.href ?? attrs.value ?? '').trim()
    if (property && value && match[1].toLowerCase() === 'meta' && !og.has(property)) og.set(property, value)
    const itemprop = (attrs.itemprop || '').toLowerCase()
    if (itemprop && value && !item.has(itemprop)) item.set(itemprop, value)
  }

  const microdata = emptySource()
  const microPrice = parsePrice(item.get('price') ?? item.get('lowprice'))
  if (microPrice !== null) {
    microdata.currency = detectCurrency(item.get('pricecurrency')) ?? detectCurrency(item.get('price'))
    microdata.name = item.get('name') ? str(item.get('name')) : null
    microdata.sku = item.get('sku') ? str(item.get('sku')) : null
    microdata.offers.push({
      title: microdata.name,
      price: microPrice,
      currency: microdata.currency,
      availability: normalizeAvailability(item.get('availability')),
      sku: microdata.sku,
      url: absoluteUrl(item.get('url'), pageUrl),
      image: null,
      variantId: null,
    })
  }

  const ogResult = emptySource()
  const amount = og.get('product:price:amount') ?? og.get('og:price:amount') ?? og.get('product:sale_price:amount')
  const ogPrice = parsePrice(amount)
  ogResult.name = str(og.get('og:title'))
  ogResult.image = absoluteUrl(og.get('og:image'), pageUrl)
  ogResult.brand = str(og.get('product:brand') ?? og.get('og:brand'))
  if (ogPrice !== null) {
    ogResult.currency = detectCurrency(og.get('product:price:currency') ?? og.get('og:price:currency')) ?? detectCurrency(amount)
    ogResult.offers.push({
      title: ogResult.name,
      price: ogPrice,
      currency: ogResult.currency,
      availability: normalizeAvailability(og.get('product:availability') ?? og.get('og:availability')),
      sku: str(og.get('product:retailer_item_id')),
      url: absoluteUrl(og.get('og:url'), pageUrl) ?? pageUrl,
      image: ogResult.image,
      variantId: null,
    })
  }
  return { microdata, og: ogResult }
}

/* ------------------------------------------------------------------ */
/* Orchestration                                                       */
/* ------------------------------------------------------------------ */

function emptyExtraction(): ProductExtraction {
  return {
    name: null, brand: null, sku: null, image: null, currency: null, offers: [], sources: [],
    confidence: 0, price_range: null, extractor_version: PRODUCT_EXTRACTOR_VERSION,
  }
}

/** Fill a JSON-LD offer's missing title/availability/sku from the matching Shopify variant. */
function enrichFrom(primary: DraftOffer[], secondary: DraftOffer[]): boolean {
  let used = false
  for (const offer of primary) {
    const match = secondary.find(other =>
      (offer.variantId && other.variantId === offer.variantId)
      || (!offer.variantId && offer.sku && other.sku === offer.sku))
    if (!match) continue
    if ((!offer.title || offer.title === null) && match.title) { offer.title = match.title; used = true }
    if (offer.availability === 'unknown' && match.availability !== 'unknown') { offer.availability = match.availability; used = true }
    if (!offer.sku && match.sku) { offer.sku = match.sku; used = true }
    if (!offer.image && match.image) { offer.image = match.image; used = true }
  }
  return used
}

export function extractProduct(input: ProductExtractionInput): ProductExtraction {
  try {
    return extractProductUnsafe(input)
  } catch {
    return emptyExtraction()
  }
}

function extractProductUnsafe(input: ProductExtractionInput): ProductExtraction {
  const pageUrl = typeof input?.url === 'string' ? input.url : ''
  const html = typeof input?.html === 'string' ? input.html : ''
  const result = emptyExtraction()

  const jsonLd = html ? fromJsonLd(html, pageUrl) : emptySource()
  const { microdata, og } = html ? fromMeta(html, pageUrl) : { microdata: emptySource(), og: emptySource() }
  const pageCurrency = jsonLd.currency ?? og.currency ?? microdata.currency ?? shopifyPageCurrency(html)
  const shopify = input?.shopifyJson !== undefined && input?.shopifyJson !== null
    ? fromShopify(input.shopifyJson, pageUrl, pageCurrency)
    : emptySource()

  const sources = new Set<ProductSource>()
  let offers: DraftOffer[] = []
  if (jsonLd.offers.length > 0) {
    offers = jsonLd.offers
    sources.add('json-ld')
    // Shopify knows variant titles that some themes leave out of JSON-LD.
    if (shopify.offers.length > 0 && enrichFrom(offers, shopify.offers)) sources.add('shopify')
  } else if (shopify.offers.length > 0) {
    offers = shopify.offers
    sources.add('shopify')
  } else if (microdata.offers.length > 0) {
    offers = microdata.offers
    sources.add('microdata-meta')
  } else if (og.offers.length > 0) {
    offers = og.offers
    sources.add('og-meta')
  }

  const order: Array<[ProductSource, SourceResult]> = [
    ['json-ld', jsonLd], ['shopify', shopify], ['microdata-meta', microdata], ['og-meta', og],
  ]
  const pick = <K extends 'name' | 'brand' | 'sku' | 'image'>(key: K): string | null => {
    for (const [source, data] of order) {
      if (data[key]) {
        sources.add(source)
        return data[key]
      }
    }
    return null
  }
  result.name = pick('name')
  result.brand = pick('brand')
  result.sku = pick('sku')
  result.image = pick('image')

  const currency = offers.find(o => o.currency)?.currency ?? pageCurrency
  result.offers = offers.slice(0, MAX_OFFERS).map(offer => {
    const clean: ProductOffer = {
      price: offer.price,
      availability: offer.availability,
      sku: offer.sku,
      url: offer.url,
      image: offer.image,
      ...(offer.aggregate ? { aggregate: offer.aggregate } : {}),
      title: offer.title ?? offer.sku ?? result.name ?? 'Offer',
      currency: offer.currency ?? currency,
    }
    return clean
  })
  result.currency = currency ?? null
  result.sources = (['json-ld', 'shopify', 'microdata-meta', 'og-meta'] as ProductSource[]).filter(s => sources.has(s))

  if (result.offers.length > 0) {
    const prices = result.offers.map(o => o.price)
    const aggregateHigh = jsonLd.aggregate.map(a => a.high).filter((v): v is number => v !== null)
    result.price_range = {
      low: Math.min(...prices),
      high: Math.max(...prices, ...aggregateHigh),
      currency: result.currency,
    }
  }
  result.confidence = scoreConfidence(result)
  return result
}

function scoreConfidence(result: ProductExtraction): number {
  if (result.offers.length === 0) return 0
  let score = result.sources.includes('json-ld') || result.sources.includes('shopify') ? 0.7
    : result.sources.includes('microdata-meta') ? 0.5 : 0.4
  if (result.sources.includes('json-ld') && result.sources.includes('shopify')) score += 0.1
  if (result.currency) score += 0.1
  if (result.offers.some(o => o.availability !== 'unknown')) score += 0.05
  if (result.name) score += 0.05
  return Math.min(1, Math.round(score * 100) / 100)
}

/* ------------------------------------------------------------------ */
/* Offer matching                                                      */
/* ------------------------------------------------------------------ */

const STOP_WORDS = new Set(['the', 'a', 'an', 'and', 'or', 'with', 'for', 'of', 'in', 'to', 'x', 'set', 'kit', 'new'])
const UNIT_PATTERN = 'kv|mah|ghz|mhz|mm|cm|inch|in|awg|pcs|pc|pair|pairs|pack|s|v|a|w|g'

interface QueryTokens { words: Set<string>; numbers: Set<string> }

/**
 * Tokenize for matching. Number+unit pairs are canonicalised ("KV920", "920 kv",
 * "920KV" → "920kv"), bare numbers stay numbers ("2216"), letter/digit runs are
 * split ("Propeller1045" → "propeller", "1045").
 */
export function tokenizeForMatch(value: string): QueryTokens {
  const words = new Set<string>()
  const numbers = new Set<string>()
  const text = decodeHtmlEntities(String(value ?? '')).toLowerCase()
    .replace(/(\d)\s*(?:"|''|”)/g, '$1in ')
    .replace(/[^a-z0-9.]+/g, ' ')
  const pattern = new RegExp(`kv\\s*(\\d+(?:\\.\\d+)?)|(\\d+(?:\\.\\d+)?)\\s*(${UNIT_PATTERN})(?![a-z0-9])|(\\d+(?:\\.\\d+)?)|([a-z]+)`, 'g')
  for (const match of text.matchAll(pattern)) {
    if (match[1]) numbers.add(`${trimNumber(match[1])}kv`)
    else if (match[2]) {
      const unit = match[3] === 'inch' ? 'in' : match[3] === 'pcs' ? 'pc' : match[3] === 'pairs' ? 'pair' : match[3]
      numbers.add(`${trimNumber(match[2])}${unit}`)
    } else if (match[4]) numbers.add(trimNumber(match[4]))
    else if (match[5] && !STOP_WORDS.has(match[5]) && match[5].length > 0) words.add(match[5])
  }
  return { words, numbers }
}

function trimNumber(value: string): string {
  const n = Number(value)
  return Number.isFinite(n) ? String(n) : value
}

export interface OfferMatchContext {
  /** Product name. Its numbers ("AF2406", "X500") count as present in every offer. */
  productName?: string | null
}

/** Score how well an offer title matches a query, or -1 when a number in the query contradicts it. */
export function scoreOfferMatch(
  offer: Pick<ProductOffer, 'title' | 'sku'>,
  query: string,
  context: OfferMatchContext = {},
): number {
  const q = tokenizeForMatch(query)
  const o = tokenizeForMatch(`${offer?.title ?? ''} ${offer?.sku ?? ''}`)
  if (q.words.size === 0 && q.numbers.size === 0) return 0
  const shared = tokenizeForMatch(context?.productName ?? '')
  // A number in the query (920KV, 1045, 1500mAh) must appear in the offer (or
  // the product name) when the offer title carries numbers at all. Titles
  // without numbers ("Pink", "CW") are judged on words only.
  if (o.numbers.size > 0) {
    for (const n of q.numbers) if (!o.numbers.has(n) && !shared.numbers.has(n)) return -1
  }
  let score = 0
  for (const n of q.numbers) if (o.numbers.has(n)) score += 2
  for (const w of q.words) if (o.words.has(w)) score += 1
  const sku = str(offer?.sku)?.toLowerCase()
  if (sku && sku.length >= 3 && query.toLowerCase().includes(sku)) score += 3
  return score
}

/**
 * Pick the offer whose title best matches `query` on a multi-variant page.
 *
 * Returns null when nothing matches or a query number contradicts every offer.
 * A tie is resolved only when the tied offers have the same price and currency
 * (e.g. CW/CCW motor variants), since then the price is unambiguous; any other
 * tie returns null, because a guessed variant is worse than none for price
 * verification. A single-offer page returns its offer unless a query number
 * contradicts it.
 */
export function matchOffer<T extends Pick<ProductOffer, 'title' | 'sku'> & Partial<Pick<ProductOffer, 'price' | 'currency'>>>(
  offers: readonly T[],
  query: string,
  context: OfferMatchContext = {},
): T | null {
  return matchOfferWithScore(offers, query, context)?.offer ?? null
}

export function matchOfferWithScore<T extends Pick<ProductOffer, 'title' | 'sku'> & Partial<Pick<ProductOffer, 'price' | 'currency'>>>(
  offers: readonly T[],
  query: string,
  context: OfferMatchContext = {},
): { offer: T; score: number; ambiguous_same_price: boolean } | null {
  if (!Array.isArray(offers) || offers.length === 0 || typeof query !== 'string' || !query.trim()) return null
  const scored = offers.map(offer => ({ offer, score: scoreOfferMatch(offer, query, context) }))
  if (offers.length === 1) {
    return scored[0].score >= 0 ? { ...scored[0], ambiguous_same_price: false } : null
  }
  const best = scored.reduce((top, entry) => (entry.score > top.score ? entry : top), scored[0])
  if (best.score <= 0) return null
  const tied = scored.filter(entry => entry.score === best.score)
  if (tied.length === 1) return { ...best, ambiguous_same_price: false }
  const samePrice = tied.every(entry =>
    entry.offer.price !== undefined && entry.offer.price === best.offer.price
    && (entry.offer.currency ?? null) === (best.offer.currency ?? null))
  return samePrice ? { ...best, ambiguous_same_price: true } : null
}
