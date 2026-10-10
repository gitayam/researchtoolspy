/**
 * Structured product/price extraction for one product page.
 *
 * Pure and dependency-free so it runs on Workers and in tests. Every exported
 * function tolerates arbitrary input: malformed markup or JSON yields empty
 * offers, never an exception.
 *
 * Offer sources, highest priority first:
 *   1. schema.org JSON-LD Product / ProductGroup (hasVariant), Offer, AggregateOffer, @graph
 *   2. Shopify product JSON (`<product-url>.js`: integer cents; `.json`: decimal strings)
 *   3. Platform data embedded in the page: WooCommerce `data-product_variations`,
 *      Magento 2 `spConfig`/`jsonConfig`
 *   4. Platform JSON fetched by the caller: WooCommerce Store API, Magento GraphQL
 *   5. BigCommerce `BCData` (product-level price and stock)
 *   6. schema.org microdata (an item tree: nested offers, text-content values)
 *   7. product:/og: price meta tags
 *
 * The first source with offers is primary, except that a variant-level source
 * with several offers (Shopify, Woo, Magento) replaces a primary source that
 * has only one. Every other source then fills fields the primary lacks (variant
 * titles, stock, SKU, list price), matched by variant id, SKU or variant title,
 * but never replaces a price the primary stated.
 *
 * Structured numbers are read literally; display-text heuristics (price-parse)
 * apply only to strings that are not plain `.`-decimal numbers.
 */
import { decodeHtmlEntities } from './article-extractor'
import { findMicrodataItems, parseMicrodata, type MicrodataItem } from './microdata'
import {
  detectCurrencyInfo,
  parseStructuredPrice,
  type CurrencyHint,
  type PriceHint,
} from './price-parse'
import {
  fromBigCommerceBCData,
  fromMagentoGraphql,
  fromMagentoSpConfig,
  fromWooStoreApi,
  fromWooVariations,
  wooPageCurrencySymbol,
  type PlatformResult,
  type PlatformSource,
} from './product-platforms'

export { detectCurrency, detectCurrencyInfo, parsePrice, parseStructuredPrice } from './price-parse'

export const PRODUCT_EXTRACTOR_VERSION = 'product.v2' as const

export type ProductAvailability = 'in_stock' | 'out_of_stock' | 'preorder' | 'unknown'
export type ProductSource = 'json-ld' | 'shopify' | PlatformSource | 'microdata-meta' | 'og-meta'

/** Every source in priority order; `sources` in a result follows this order. */
const SOURCE_ORDER: ProductSource[] = [
  'json-ld', 'shopify', 'woo-variations', 'magento-spconfig', 'woo-store-api', 'magento-graphql',
  'bigcommerce-bcdata', 'microdata-meta', 'og-meta',
]
const VARIANT_SOURCES = new Set<ProductSource>(['shopify', 'woo-variations', 'magento-spconfig', 'woo-store-api', 'magento-graphql'])

export interface ProductOffer {
  /** Variant or offer name. Falls back to the SKU, then the product name. */
  title: string
  /** Current (sale) price in major currency units (dollars, euros), never cents. */
  price: number
  /** The list / struck-through / compare-at price, present only when it is higher than `price`. */
  regular_price?: number
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
  /**
   * True when `currency` was read from a symbol shared by several currencies
   * ($, kr, ¥, Rs) and nothing on the page stated the ISO code. A language or
   * TLD hint may have chosen a better guess, but it is still a guess.
   */
  currency_ambiguous: boolean
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
  /** WooCommerce Store API `/wc/store/v1/products/<id>` body and, for a variable product, its variation listing. */
  wooStoreApi?: { product: unknown; variations?: unknown } | null
  /** Magento GraphQL `products(filter:{url_key…})` response body. */
  magentoGraphql?: unknown
  url: string
}

const MAX_OFFERS = 250
const MAX_JSON_LD_BLOCKS = 50
const MAX_JSON_LD_BYTES = 512 * 1024
const MAX_NODE_DEPTH = 12

/* ------------------------------------------------------------------ */
/* Primitive parsing                                                   */
/* ------------------------------------------------------------------ */

function str(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value !== 'string') return null
  const cleaned = decodeHtmlEntities(value).replace(/\s+/g, ' ').trim()
  return cleaned ? cleaned : null
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
/* Page context: currency and number-format hints                      */
/* ------------------------------------------------------------------ */

interface PageContext {
  pageUrl: string
  currencyHint: CurrencyHint
  priceHint: PriceHint
}

/** Read a currency code or symbol, recording whether the symbol was ambiguous. */
function currencyOf(value: unknown, ctx: PageContext): { code: string | null; ambiguous: boolean } {
  const info = detectCurrencyInfo(value, ctx.currencyHint)
  return info ? { code: info.code, ambiguous: info.ambiguous } : { code: null, ambiguous: false }
}

/** ISO codes the page states outright, in the order a reader would trust them. */
function statedCurrency(html: string, extra: Array<string | null>): string | null {
  const patterns = [
    /"priceCurrency"\s*:\s*"([A-Za-z]{3})"/,
    /<meta\b[^>]*(?:property|name)=["'](?:product|og):price:currency["'][^>]*content=["']([A-Za-z]{3})["']/i,
    /<meta\b[^>]*content=["']([A-Za-z]{3})["'][^>]*(?:property|name)=["'](?:product|og):price:currency["']/i,
    /itemprop=["']priceCurrency["'][^>]*content=["']([A-Za-z]{3})["']/i,
    /content=["']([A-Za-z]{3})["'][^>]*itemprop=["']priceCurrency["']/i,
    /Shopify\.currency\s*=\s*\{[^}]*"active"\s*:\s*"([A-Z]{3})"/,
  ]
  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (match) return match[1].toUpperCase()
  }
  return extra.find((code): code is string => !!code) ?? null
}

/** Shopify `money_format` names its separator ("amount_with_comma_separator" → ","). */
function shopifyDecimalSeparator(html: string): '.' | ',' | null {
  const match = html.match(/money_format["']?\s*[:=]\s*["'][^"']*\{\{\s*(amount[a-z_]*)\s*\}\}/i)
  if (!match) return null
  return /comma_separator/.test(match[1]) ? ',' : '.'
}

function pageContext(html: string, pageUrl: string, platforms: PlatformResult[]): PageContext {
  let hostname: string | null
  try {
    hostname = new URL(pageUrl).hostname
  } catch {
    hostname = null
  }
  const lang = html.match(/<html\b[^>]*\blang=["']([A-Za-z]{2,3}(?:[-_][A-Za-z0-9]{2,8})?)["']/i)?.[1] ?? null
  const code = statedCurrency(html, platforms.map(p => p.currency))
  const decimalSeparator = platforms.find(p => p.decimalSeparator)?.decimalSeparator ?? shopifyDecimalSeparator(html)
  return {
    pageUrl,
    currencyHint: { code, lang, hostname },
    priceHint: { decimalSeparator },
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

/**
 * "Kit – DC / XH - Flying Tech" names a variant "Kit – DC / XH – DC (Deadcat) – Lite":
 * strip the group name, also when the group name carries a " - Site" suffix the variants lack.
 */
function stripGroupPrefix(variantName: string | null, groupName: string | null): string | null {
  if (!variantName || !groupName) return variantName
  const candidates = [groupName]
  const suffix = groupName.match(/^(.*\S)\s+[-–—|]\s+[^-–—|]{2,40}$/)
  if (suffix) candidates.push(suffix[1])
  for (const prefix of candidates) {
    if (variantName.length > prefix.length && variantName.toLowerCase().startsWith(prefix.toLowerCase())) {
      const rest = variantName.slice(prefix.length).replace(/^\s*[-–—:|/]\s*/, '').trim()
      if (rest) return rest
    }
  }
  return variantName
}

interface DraftOffer extends Omit<ProductOffer, 'title' | 'regular_price'> {
  title: string | null
  regularPrice: number | null
  variantId: string | null
  /** Came from a variant list (hasVariant, Shopify, Woo, Magento), not a product-level offer. */
  isVariant: boolean
  availabilityGuessed: boolean
  currencyAmbiguous: boolean
}

interface SourceResult {
  name: string | null
  brand: string | null
  sku: string | null
  image: string | null
  currency: string | null
  currencyAmbiguous: boolean
  offers: DraftOffer[]
}

function emptySource(): SourceResult {
  return { name: null, brand: null, sku: null, image: null, currency: null, currencyAmbiguous: false, offers: [] }
}

const STRIKETHROUGH = /strikethroughprice|listprice|msrp|srp|retailprice|invoiceprice/i

function validNow(spec: Record<string, unknown>, now: number): { valid: boolean; windowed: boolean } {
  const from = typeof spec.validFrom === 'string' ? Date.parse(spec.validFrom) : Number.NaN
  const through = typeof spec.validThrough === 'string' ? Date.parse(spec.validThrough) : Number.NaN
  const windowed = Number.isFinite(from) || Number.isFinite(through)
  const valid = (!Number.isFinite(from) || from <= now) && (!Number.isFinite(through) || through >= now)
  return { valid, windowed }
}

/**
 * The current and list prices among an offer's priceSpecification entries
 * (UnitPriceSpecification, CompoundPriceSpecification.priceComponent).
 * A spec whose priceType is StrikethroughPrice/ListPrice/MSRP is a list price,
 * never the current one; a spec outside its validFrom/validThrough window is skipped.
 */
function specificationPrices(value: unknown, ctx: PageContext, now: number, depth = 0): {
  current: number | null
  currentCurrency: string | null
  windowed: boolean
  regular: number | null
} {
  const out = { current: null as number | null, currentCurrency: null as string | null, windowed: false, regular: null as number | null }
  if (depth > 3) return out
  for (const spec of asArray(value)) {
    if (!isObject(spec)) continue
    if (spec.priceComponent) {
      const nested = specificationPrices(spec.priceComponent, ctx, now, depth + 1)
      out.regular ??= nested.regular
      if (out.current === null && nested.current !== null) Object.assign(out, { ...nested, regular: out.regular })
      continue
    }
    const price = parseStructuredPrice(spec.price, ctx.priceHint)
    if (price === null) continue
    if (STRIKETHROUGH.test(String(spec.priceType ?? ''))) {
      out.regular = out.regular === null ? price : Math.max(out.regular, price)
      continue
    }
    const { valid, windowed } = validNow(spec, now)
    if (!valid) continue
    // A spec with a validity window that covers today outranks an open-ended one.
    if (out.current === null || (windowed && !out.windowed)) {
      out.current = price
      out.currentCurrency = currencyOf(spec.priceCurrency, ctx).code
      out.windowed = windowed
    }
  }
  return out
}

interface OfferContext { title: string | null; sku: string | null; currency: string | null; image: string | null; isVariant: boolean }

function offersFromJsonLdOffer(
  offerValue: unknown,
  context: OfferContext,
  ctx: PageContext,
  out: DraftOffer[],
  depth = 0,
): void {
  if (depth > MAX_NODE_DEPTH) return
  const base = ctx.pageUrl
  const now = Date.now()
  for (const offer of asArray(offerValue)) {
    if (!isObject(offer) || out.length >= MAX_OFFERS) continue
    const offerTypes = types(offer)
    const stated = currencyOf(offer.priceCurrency, ctx)
    const currency = stated.code ?? context.currency
    const isAggregate = offerTypes.includes('aggregateoffer')
      || (offer.price === undefined && offer.priceSpecification === undefined && offer.lowPrice !== undefined)
    if (isAggregate) {
      const nested = asArray(offer.offers)
      if (nested.length > 0) {
        offersFromJsonLdOffer(nested, { ...context, currency }, ctx, out, depth + 1)
        continue
      }
      const low = parseStructuredPrice(offer.lowPrice, ctx.priceHint) ?? parseStructuredPrice(offer.price, ctx.priceHint)
      if (low === null) continue
      const high = parseStructuredPrice(offer.highPrice, ctx.priceHint)
      const count = typeof offer.offerCount === 'number' ? offer.offerCount
        : Number.isFinite(Number(offer.offerCount)) && offer.offerCount !== undefined ? Number(offer.offerCount) : null
      const url = absoluteUrl(offer.url, base)
      out.push({
        title: context.title,
        price: low,
        regularPrice: null,
        currency,
        availability: normalizeAvailability(offer.availability),
        sku: str(offer.sku) ?? context.sku,
        url,
        image: context.image,
        aggregate: { high_price: high, offer_count: count },
        variantId: variantIdFromUrl(url),
        isVariant: context.isVariant,
        availabilityGuessed: false,
        currencyAmbiguous: false,
      })
      continue
    }
    // Offer (or an untyped offer-like object). priceSpecification is the structured alternative to price.
    let price = parseStructuredPrice(offer.price, ctx.priceHint)
    const specs = specificationPrices(offer.priceSpecification, ctx, now)
    if (specs.current !== null) {
      if (price === null) price = specs.current
      else if (specs.windowed && specs.current !== price) price = specs.current
      else if (specs.regular !== null && price === specs.regular && specs.current < price) price = specs.current
    }
    if (price === null) continue
    let textCurrency = { code: null as string | null, ambiguous: false }
    if (!stated.code && !specs.currentCurrency && !context.currency && typeof offer.price === 'string') {
      textCurrency = currencyOf(offer.price, ctx)
    }
    const url = absoluteUrl(offer.url, base)
    out.push({
      title: str(offer.name) ?? context.title,
      price,
      regularPrice: specs.regular !== null && specs.regular > price ? specs.regular : null,
      currency: stated.code ?? specs.currentCurrency ?? context.currency ?? textCurrency.code,
      availability: normalizeAvailability(offer.availability),
      sku: str(offer.sku) ?? context.sku,
      url,
      image: imageOf(offer.image, base) ?? context.image,
      variantId: variantIdFromUrl(url),
      isVariant: context.isVariant,
      availabilityGuessed: false,
      currencyAmbiguous: !stated.code && !specs.currentCurrency && !context.currency && textCurrency.ambiguous,
    })
  }
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

/** Shared by JSON-LD and microdata: Product/ProductGroup nodes in schema.org JSON shape. */
function fromProductNodes(allNodes: Record<string, unknown>[], ctx: PageContext): SourceResult {
  const result = emptySource()
  const pageUrl = ctx.pageUrl
  if (allNodes.length === 0) return result
  // Product carousels ("you may also like") also emit Product nodes. When some
  // node identifies itself as this page, ignore the others.
  const own = allNodes.filter(node => samePage(str(node.url) ?? str(node['@id']), pageUrl))
  let nodes = own.length > 0 ? own : allNodes.slice(0, 1)
  // ProductGroup first: its hasVariant entries carry per-variant names that a
  // sibling Product node's bare offers lack, and dedupe keeps the first title.
  nodes = [...nodes].sort((a, b) => Number(types(b).includes('productgroup')) - Number(types(a).includes('productgroup')))

  for (const node of nodes) {
    const name = str(node.name)
    const image = imageOf(node.image, pageUrl)
    const sku = str(node.sku) ?? str(node.mpn) ?? str(node.productID)
    result.name ??= name
    result.brand ??= nameOf(node.brand) ?? nameOf(node.manufacturer)
    result.sku ??= sku
    result.image ??= image

    const variants = asArray(node.hasVariant)
    for (const variant of variants) {
      if (!isObject(variant)) continue
      offersFromJsonLdOffer(variant.offers, {
        title: stripGroupPrefix(str(variant.name), name),
        sku: str(variant.sku) ?? str(variant.mpn),
        currency: null,
        image: imageOf(variant.image, pageUrl) ?? image,
        isVariant: true,
      }, ctx, result.offers)
    }
    // Several offers on one Product are variants whose names the offers rarely
    // carry; leave the title empty so another source (Shopify) can supply it.
    const offers = asArray(node.offers)
    const single = variants.length === 0 && offers.length <= 1
    const before = result.offers.length
    offersFromJsonLdOffer(offers, {
      title: single ? name : null,
      sku: single ? sku : null,
      currency: null,
      image,
      isVariant: false,
    }, ctx, result.offers)
    // Microdata often puts price straight on the Product with no Offer item.
    if (result.offers.length === before && offers.length === 0 && variants.length === 0
      && (node.price !== undefined || node.lowPrice !== undefined)) {
      offersFromJsonLdOffer({ ...node, '@type': 'Offer', name: undefined }, {
        title: name, sku, currency: null, image, isVariant: false,
      }, ctx, result.offers)
    }
  }
  result.offers = dedupeOffers(result.offers)
  result.currency = result.offers.find(o => o.currency)?.currency ?? null
  result.currencyAmbiguous = result.offers.find(o => o.currency)?.currencyAmbiguous ?? false
  return result
}

function fromJsonLd(html: string, ctx: PageContext): SourceResult {
  return fromProductNodes(productNodes(jsonLdBlocks(html)), ctx)
}

/** Merge duplicates (same variant id, else same SKU+price, else indistinguishable) keeping the most complete fields. */
function dedupeOffers(offers: DraftOffer[]): DraftOffer[] {
  const out: DraftOffer[] = []
  for (const offer of offers) {
    const existing = out.find(other =>
      (offer.variantId && other.variantId === offer.variantId)
      || (!offer.variantId && !other.variantId && offer.url && other.url === offer.url && other.price === offer.price)
      || (offer.sku && other.sku === offer.sku && other.price === offer.price && (!offer.variantId || !other.variantId))
      || (!offer.variantId && !other.variantId && !offer.sku && !other.sku && other.price === offer.price
        && (offer.title ?? null) === (other.title ?? null) && (!offer.url || !other.url)))
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
    existing.regularPrice ??= offer.regularPrice
    existing.isVariant ||= offer.isVariant
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

function shopifyCents(value: unknown, isJsShape: boolean): number | null {
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? round2(value / 100) : null
  if (isJsShape && typeof value === 'string' && /^\d+$/.test(value)) return round2(Number(value) / 100)
  return parseStructuredPrice(value)
}

function fromShopify(raw: unknown, ctx: PageContext, fallbackCurrency: string | null): SourceResult {
  const result = emptySource()
  const pageUrl = ctx.pageUrl
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
    const price = shopifyCents(variant.price, isJsShape)
    if (price === null) continue
    const compareAt = shopifyCents(variant.compare_at_price, isJsShape)
    const id = variant.id !== undefined && variant.id !== null ? String(variant.id) : null
    const image = isObject(variant.featured_image) ? variant.featured_image.src : undefined
    result.offers.push({
      title: singleDefault ? result.name : str(variant.title) ?? str(variant.public_title) ?? result.name,
      price,
      regularPrice: compareAt !== null && compareAt > price ? compareAt : null,
      currency: currencyOf(variant.price_currency, ctx).code ?? fallbackCurrency,
      availability: 'available' in variant ? normalizeAvailability(Boolean(variant.available)) : 'unknown',
      sku: str(variant.sku),
      url: id ? `${base}?variant=${encodeURIComponent(id)}` : base,
      image: absoluteUrl(typeof image === 'string' && image.startsWith('//') ? `https:${image}` : image, pageUrl),
      variantId: id,
      isVariant: !singleDefault,
      availabilityGuessed: false,
      currencyAmbiguous: false,
    })
  }
  result.currency = result.offers.find(o => o.currency)?.currency ?? fallbackCurrency
  return result
}

/* ------------------------------------------------------------------ */
/* Platform data (WooCommerce, Magento, BigCommerce)                   */
/* ------------------------------------------------------------------ */

function fromPlatform(platform: PlatformResult): SourceResult {
  const result = emptySource()
  result.name = platform.name
  result.sku = platform.sku
  result.image = platform.image
  result.currency = platform.currency
  result.offers = platform.offers.map(offer => ({
    title: offer.title,
    price: offer.price,
    regularPrice: offer.regularPrice,
    currency: offer.currency,
    availability: offer.availability,
    sku: offer.sku,
    url: offer.url,
    image: offer.image,
    variantId: offer.variantId,
    isVariant: platform.source !== 'bigcommerce-bcdata' && platform.offers.length > 1,
    availabilityGuessed: offer.availabilityGuessed === true,
    currencyAmbiguous: false,
  }))
  return result
}

/* ------------------------------------------------------------------ */
/* Microdata and meta tags                                             */
/* ------------------------------------------------------------------ */

/** A microdata item in schema.org JSON shape, so JSON-LD offer logic applies unchanged. */
function microdataToNode(item: MicrodataItem, depth = 0): Record<string, unknown> {
  const node: Record<string, unknown> = { '@type': item.types }
  if (depth > MAX_NODE_DEPTH) return node
  const camel: Record<string, string> = {
    pricecurrency: 'priceCurrency', pricespecification: 'priceSpecification', pricetype: 'priceType',
    lowprice: 'lowPrice', highprice: 'highPrice', offercount: 'offerCount', hasvariant: 'hasVariant',
    validfrom: 'validFrom', validthrough: 'validThrough', productid: 'productID', pricecomponent: 'priceComponent',
  }
  for (const [name, values] of item.properties) {
    const converted = values.map(v => typeof v === 'string' ? v : microdataToNode(v, depth + 1))
    node[camel[name] ?? name] = converted.length === 1 ? converted[0] : converted
  }
  return node
}

function attributesOf(tag: string): Record<string, string> {
  const result: Record<string, string> = {}
  for (const match of tag.matchAll(/([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
    result[match[1].toLowerCase()] = decodeHtmlEntities(match[2] ?? match[3] ?? match[4] ?? '')
  }
  return result
}

function fromMicrodata(html: string, ctx: PageContext): SourceResult {
  const items = parseMicrodata(html)
  let products = findMicrodataItems(items, 'product')
  if (products.length === 0) products = findMicrodataItems(items, 'productgroup')
  if (products.length > 0) {
    const result = fromProductNodes(products.map(item => microdataToNode(item)), ctx)
    if (result.offers.length > 0 || result.name) return result
  }
  const offers = findMicrodataItems(items, 'offer')
  if (offers.length > 0) {
    const result = emptySource()
    offersFromJsonLdOffer(offers.map(item => microdataToNode(item)), {
      title: null, sku: null, currency: null, image: null, isVariant: false,
    }, ctx, result.offers)
    result.offers = dedupeOffers(result.offers)
    result.currency = result.offers.find(o => o.currency)?.currency ?? null
    if (result.offers.length > 0) return result
  }
  return flatMicrodata(html, ctx)
}

/** Loose itemprop values with no itemscope tree at all: first value of each property wins. */
function flatMicrodata(html: string, ctx: PageContext): SourceResult {
  const item = new Map<string, string>()
  for (const match of html.matchAll(/<(meta|link|span|div|data|p|strong|b)\b[^>]*\bitemprop\b[^>]*>/gi)) {
    const attrs = attributesOf(match[0])
    const value = (attrs.content ?? attrs.href ?? attrs.value ?? '').trim()
    const itemprop = (attrs.itemprop || '').toLowerCase()
    if (itemprop && value && !item.has(itemprop)) item.set(itemprop, value)
  }
  const result = emptySource()
  const price = parseStructuredPrice(item.get('price') ?? item.get('lowprice'), ctx.priceHint)
  if (price === null) return result
  const stated = currencyOf(item.get('pricecurrency'), ctx)
  const fromText = stated.code ? stated : currencyOf(item.get('price'), ctx)
  result.currency = fromText.code
  result.currencyAmbiguous = fromText.ambiguous
  result.name = item.get('name') ? str(item.get('name')) : null
  result.sku = item.get('sku') ? str(item.get('sku')) : null
  result.offers.push({
    title: result.name,
    price,
    regularPrice: null,
    currency: result.currency,
    availability: normalizeAvailability(item.get('availability')),
    sku: result.sku,
    url: absoluteUrl(item.get('url'), ctx.pageUrl),
    image: null,
    variantId: null,
    isVariant: false,
    availabilityGuessed: false,
    currencyAmbiguous: fromText.ambiguous,
  })
  return result
}

function fromOgMeta(html: string, ctx: PageContext): SourceResult {
  const og = new Map<string, string>()
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = attributesOf(match[0])
    const property = (attrs.property || attrs.name || '').toLowerCase()
    const value = (attrs.content ?? '').trim()
    if (property && value && !og.has(property)) og.set(property, value)
  }
  const result = emptySource()
  const amount = og.get('product:price:amount') ?? og.get('og:price:amount') ?? og.get('product:sale_price:amount')
  const price = parseStructuredPrice(amount, ctx.priceHint)
  result.name = str(og.get('og:title'))
  result.image = absoluteUrl(og.get('og:image'), ctx.pageUrl)
  result.brand = str(og.get('product:brand') ?? og.get('og:brand'))
  if (price !== null) {
    const stated = currencyOf(og.get('product:price:currency') ?? og.get('og:price:currency'), ctx)
    const currency = stated.code ? stated : currencyOf(amount, ctx)
    result.currency = currency.code
    result.currencyAmbiguous = currency.ambiguous
    result.offers.push({
      title: result.name,
      price,
      regularPrice: null,
      currency: result.currency,
      availability: normalizeAvailability(og.get('product:availability') ?? og.get('og:availability')),
      sku: str(og.get('product:retailer_item_id')),
      url: absoluteUrl(og.get('og:url'), ctx.pageUrl) ?? ctx.pageUrl,
      image: result.image,
      variantId: null,
      isVariant: false,
      availabilityGuessed: false,
      currencyAmbiguous: currency.ambiguous,
    })
  }
  return result
}

/* ------------------------------------------------------------------ */
/* Orchestration                                                       */
/* ------------------------------------------------------------------ */

function emptyExtraction(): ProductExtraction {
  return {
    name: null, brand: null, sku: null, image: null, currency: null, currency_ambiguous: false, offers: [], sources: [],
    confidence: 0, price_range: null, extractor_version: PRODUCT_EXTRACTOR_VERSION,
  }
}

function titleKey(title: string | null): string | null {
  return title ? title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim() || null : null
}

/**
 * Fill a primary offer's missing fields from the matching offer of another
 * source: same variant id, else same SKU, else the same variant title; two
 * single-offer sources describe the same thing. Never touches the price.
 */
function enrichFrom(primary: DraftOffer[], secondary: DraftOffer[]): boolean {
  let used = false
  const single = primary.length === 1 && secondary.length === 1
  for (const offer of primary) {
    const match = secondary.find(other => offer.variantId && other.variantId === offer.variantId)
      ?? secondary.find(other => offer.sku && other.sku === offer.sku)
      ?? secondary.find(other => titleKey(offer.title) && titleKey(other.title) === titleKey(offer.title))
      ?? (single ? secondary[0] : undefined)
    if (!match) continue
    if (!offer.title && match.title) { offer.title = match.title; used = true }
    if ((offer.availability === 'unknown' || offer.availabilityGuessed)
      && match.availability !== 'unknown' && !match.availabilityGuessed) {
      offer.availability = match.availability
      offer.availabilityGuessed = false
      used = true
    } else if (offer.availability === 'unknown' && match.availability !== 'unknown') {
      offer.availability = match.availability
      offer.availabilityGuessed = match.availabilityGuessed
      used = true
    }
    if (!offer.sku && match.sku) { offer.sku = match.sku; used = true }
    if (!offer.image && match.image) { offer.image = match.image; used = true }
    if (offer.regularPrice === null && match.regularPrice !== null && match.regularPrice > offer.price
      && match.price === offer.price) { offer.regularPrice = match.regularPrice; used = true }
    if (!offer.currency && match.currency) {
      offer.currency = match.currency
      offer.currencyAmbiguous = match.currencyAmbiguous
      used = true
    }
  }
  return used
}

/**
 * A product-level offer listed beside its own variants ("from $2.00", no stock,
 * no variant id) is a summary, not something to buy: drop it.
 */
function dropParentOffer(offers: DraftOffer[], productSku: string | null): DraftOffer[] {
  const variants = offers.filter(o => o.variantId || o.isVariant)
  if (variants.length < 2) return offers
  const low = Math.min(...variants.map(o => o.price))
  const high = Math.max(...variants.map(o => o.price))
  return offers.filter(o => o.variantId || o.isVariant
    || !(o.price >= low && o.price <= high && (o.availability === 'unknown' || o.aggregate)
      && (!o.sku || o.sku === productSku)))
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

  const platforms: PlatformResult[] = [
    fromWooVariations(html, pageUrl),
    fromMagentoSpConfig(html, pageUrl),
    input?.wooStoreApi ? fromWooStoreApi(input.wooStoreApi.product, input.wooStoreApi.variations, pageUrl) : null,
    input?.magentoGraphql ? fromMagentoGraphql(input.magentoGraphql, pageUrl) : null,
    fromBigCommerceBCData(html, pageUrl),
  ].filter((p): p is PlatformResult => p !== null)
  const ctx = pageContext(html, pageUrl, platforms)

  const jsonLd = html ? fromJsonLd(html, ctx) : emptySource()
  const microdata = html ? fromMicrodata(html, ctx) : emptySource()
  const og = html ? fromOgMeta(html, ctx) : emptySource()
  const statedCode = ctx.currencyHint.code ?? null
  const symbol = wooPageCurrencySymbol(html) ?? platforms.find(p => p.currencySymbol)?.currencySymbol ?? null
  const symbolCurrency = !statedCode && symbol ? currencyOf(symbol, ctx) : null
  const pageCurrency = jsonLd.currency ?? og.currency ?? microdata.currency ?? statedCode ?? symbolCurrency?.code ?? null
  const pageCurrencyAmbiguous = jsonLd.currency ? jsonLd.currencyAmbiguous
    : og.currency ? og.currencyAmbiguous
      : microdata.currency ? microdata.currencyAmbiguous
        : statedCode ? false : symbolCurrency?.ambiguous ?? false
  const shopify = input?.shopifyJson !== undefined && input?.shopifyJson !== null
    ? fromShopify(input.shopifyJson, ctx, pageCurrency)
    : emptySource()

  const bySource = new Map<ProductSource, SourceResult>([
    ['json-ld', jsonLd],
    ['shopify', shopify],
    ...platforms.map(p => [p.source, fromPlatform(p)] as [ProductSource, SourceResult]),
    ['microdata-meta', microdata],
    ['og-meta', og],
  ])
  const ordered = SOURCE_ORDER.map(source => [source, bySource.get(source) ?? emptySource()] as const)

  const sources = new Set<ProductSource>()
  let primaryIndex = ordered.findIndex(([, data]) => data.offers.length > 0)
  if (primaryIndex >= 0 && ordered[primaryIndex][1].offers.length <= 1) {
    const variantSource = ordered.findIndex(([source, data]) => VARIANT_SOURCES.has(source) && data.offers.length > 1)
    if (variantSource >= 0) primaryIndex = variantSource
  }
  let offers: DraftOffer[] = []
  if (primaryIndex >= 0) {
    const [primarySource, primary] = ordered[primaryIndex]
    // Drop the product-level summary offer before enrichment can give it stock.
    offers = dropParentOffer(primary.offers.map(offer => ({ ...offer })), primary.sku)
    sources.add(primarySource)
    for (const [source, data] of ordered) {
      if (source === primarySource || data.offers.length === 0) continue
      if (enrichFrom(offers, data.offers)) sources.add(source)
    }
    // BigCommerce themes mark the unselected default "OutOfStock" in schema
    // data while BCData says the product is in stock: trust BCData.
    const bc = bySource.get('bigcommerce-bcdata')
    if (bc && bc.offers.length === 1 && offers.length === 1 && primarySource !== 'bigcommerce-bcdata'
      && bc.offers[0].availability === 'in_stock' && offers[0].availability === 'out_of_stock'
      && bc.offers[0].price === offers[0].price) {
      offers[0].availability = 'in_stock'
      sources.add('bigcommerce-bcdata')
    }
  }

  const pick = <K extends 'name' | 'brand' | 'sku' | 'image'>(key: K): string | null => {
    for (const [source, data] of ordered) {
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

  const firstWithCurrency = offers.find(o => o.currency)
  const currency = firstWithCurrency?.currency ?? pageCurrency
  const currencyAmbiguous = firstWithCurrency ? firstWithCurrency.currencyAmbiguous : pageCurrencyAmbiguous
  result.offers = offers.slice(0, MAX_OFFERS).map(offer => {
    const clean: ProductOffer = {
      price: offer.price,
      ...(offer.regularPrice !== null && offer.regularPrice > offer.price ? { regular_price: offer.regularPrice } : {}),
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
  result.currency_ambiguous = result.currency ? currencyAmbiguous : false
  result.sources = SOURCE_ORDER.filter(s => sources.has(s))

  if (result.offers.length > 0) {
    const prices = result.offers.map(o => o.price)
    const aggregateHigh = result.offers.map(o => o.aggregate?.high_price ?? null).filter((v): v is number => v !== null)
    result.price_range = {
      low: Math.min(...prices),
      high: Math.max(...prices, ...aggregateHigh),
      currency: result.currency,
    }
  }
  result.confidence = scoreConfidence(result)
  return result
}

const STRUCTURED_SOURCES = new Set<ProductSource>([
  'json-ld', 'shopify', 'woo-variations', 'magento-spconfig', 'woo-store-api', 'magento-graphql',
])

function scoreConfidence(result: ProductExtraction): number {
  if (result.offers.length === 0) return 0
  const structured = result.sources.filter(s => STRUCTURED_SOURCES.has(s))
  let score = structured.length > 0 ? 0.7
    : result.sources.includes('bigcommerce-bcdata') ? 0.6
      : result.sources.includes('microdata-meta') ? 0.5 : 0.4
  if (structured.length > 1) score += 0.1
  if (result.currency && !result.currency_ambiguous) score += 0.1
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
