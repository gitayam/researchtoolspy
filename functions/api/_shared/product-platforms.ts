/**
 * Storefront-platform product data: per-variant prices, SKUs and stock that
 * WooCommerce, Magento 2 and BigCommerce embed in the product page, plus the
 * public read-only JSON endpoints (WooCommerce Store API, Magento GraphQL) that
 * the scraper may fetch from the same hostname as a second request.
 *
 * Pure and dependency-free like product-extractor; every function tolerates
 * arbitrary input and returns null/empty instead of throwing.
 *
 * Numbers in platform JSON are `.`-decimal (or integer minor units for the
 * Woo Store API), so they are read literally, never with display-text heuristics.
 */
import { decodeHtmlEntities } from './article-extractor'
import { decodePriceEntities, parseStructuredPrice } from './price-parse'

export type PlatformAvailability = 'in_stock' | 'out_of_stock' | 'preorder' | 'unknown'
export type PlatformSource =
  | 'woo-variations'
  | 'magento-spconfig'
  | 'bigcommerce-bcdata'
  | 'woo-store-api'
  | 'magento-graphql'

export interface PlatformOffer {
  title: string | null
  price: number
  regularPrice: number | null
  currency: string | null
  availability: PlatformAvailability
  /** True when stock was inferred (Magento lists only salable children by default) rather than stated. */
  availabilityGuessed?: boolean
  sku: string | null
  url: string | null
  image: string | null
  variantId: string | null
}

export interface PlatformResult {
  source: PlatformSource
  name: string | null
  sku: string | null
  image: string | null
  /** ISO code stated by the platform data itself (not guessed from a symbol). */
  currency: string | null
  /** The store's decimal separator for display prices, when the platform states it. */
  decimalSeparator: '.' | ',' | null
  /** The currency symbol the store formats prices with (Woo price_html, Magento currencyFormat); may be ambiguous. */
  currencySymbol: string | null
  offers: PlatformOffer[]
}

const MAX_PLATFORM_OFFERS = 250
const MAX_BLOB_BYTES = 1024 * 1024

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function text(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value !== 'string') return null
  const cleaned = decodeHtmlEntities(value).replace(/\s+/g, ' ').trim()
  return cleaned || null
}

function parseJson(raw: string): unknown {
  if (!raw || raw.length > MAX_BLOB_BYTES) return null
  try {
    return JSON.parse(raw)
  } catch {
    try {
      // eslint-disable-next-line no-control-regex
      return JSON.parse(raw.replace(/[\u0000-\u001f]+/g, ' ').replace(/,\s*([}\]])/g, '$1'))
    } catch {
      return null
    }
  }
}

function absolute(value: unknown, base: string): string | null {
  const raw = text(value)
  if (!raw) return null
  try {
    const url = new URL(raw.startsWith('//') ? `https:${raw}` : raw, base)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null
  } catch {
    return null
  }
}

function emptyResult(source: PlatformSource): PlatformResult {
  return { source, name: null, sku: null, image: null, currency: null, decimalSeparator: null, currencySymbol: null, offers: [] }
}

function regularOf(price: number, regular: number | null): number | null {
  return regular !== null && regular > price ? regular : null
}

function attributesOf(tag: string): Record<string, string> {
  const result: Record<string, string> = {}
  for (const match of tag.matchAll(/([^\s=/>"']+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
    const name = match[1].toLowerCase()
    if (!(name in result)) result[name] = decodeHtmlEntities(match[2] ?? match[3] ?? match[4] ?? '')
  }
  return result
}

/* ------------------------------------------------------------------ */
/* Detection                                                           */
/* ------------------------------------------------------------------ */

export function looksLikeWooCommerce(html: string | null | undefined): boolean {
  return !!html && /wp-content\/plugins\/woocommerce|class=["'][^"']*\bwoocommerce\b|wc-block-|woocommerce_params/i.test(html.slice(0, 600_000))
}

export function looksLikeMagento(html: string | null | undefined): boolean {
  return !!html && /text\/x-magento-init|Magento_[A-Z][A-Za-z]+\//.test(html.slice(0, 600_000))
}

export function looksLikeBigCommerce(html: string | null | undefined): boolean {
  return !!html && /cdn\d*\.bigcommerce\.com|\bBCData\s*=/.test(html.slice(0, 600_000))
}

/* ------------------------------------------------------------------ */
/* WooCommerce: form.variations_form[data-product_variations]          */
/* ------------------------------------------------------------------ */

/** `<select name="attribute_pa_x"><option value="slug">Label</option>` → slug → label. */
function wooAttributeLabels(html: string): Map<string, Map<string, string>> {
  const labels = new Map<string, Map<string, string>>()
  for (const select of html.matchAll(/<select\b([^>]*\bname=["'](attribute_[^"']+)["'][^>]*)>([\s\S]*?)<\/select>/gi)) {
    const options = new Map<string, string>()
    for (const option of select[3].matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option>/gi)) {
      const value = attributesOf(option[1]).value
      const label = text(option[2].replace(/<[^>]+>/g, ' '))
      if (value && label) options.set(value, label)
    }
    labels.set(select[2].toLowerCase(), options)
  }
  return labels
}

export interface WooVariationsResult extends PlatformResult {
  /** The form exists but WooCommerce left the variations out (more than its ajax threshold). */
  deferred: boolean
  productId: string | null
}

export function fromWooVariations(html: string, pageUrl: string): WooVariationsResult {
  const result: WooVariationsResult = { ...emptyResult('woo-variations'), deferred: false, productId: null }
  if (!html) return result
  const form = html.match(/<form\b[^>]*\bvariations_form\b[^>]*>/i)
  if (!form) return result
  const attrs = attributesOf(form[0])
  result.productId = /^\d+$/.test(attrs['data-product_id'] ?? '') ? attrs['data-product_id'] : null
  const raw = attrs['data-product_variations']
  if (raw === undefined) return result
  if (raw.trim() === 'false') {
    result.deferred = true
    return result
  }
  const variations = parseJson(raw)
  if (!Array.isArray(variations)) return result
  const labels = wooAttributeLabels(html)
  const base = (() => {
    try {
      const url = new URL(pageUrl)
      url.search = ''
      url.hash = ''
      return url.href
    } catch {
      return pageUrl
    }
  })()
  for (const variation of variations.slice(0, MAX_PLATFORM_OFFERS)) {
    if (!isObject(variation)) continue
    const price = parseStructuredPrice(variation.display_price)
    if (price === null) continue
    const parts: string[] = []
    const query = new URLSearchParams()
    if (isObject(variation.attributes)) {
      for (const [key, value] of Object.entries(variation.attributes)) {
        const slug = typeof value === 'string' ? value : ''
        if (!slug) continue
        query.set(key, slug)
        parts.push(labels.get(key.toLowerCase())?.get(slug) ?? text(slug) ?? slug)
      }
    }
    if (!result.currencySymbol && typeof variation.price_html === 'string') {
      result.currencySymbol = wooPageCurrencySymbol(variation.price_html)
    }
    const availabilityHtml = typeof variation.availability_html === 'string' ? variation.availability_html : ''
    const availability: PlatformAvailability = /available-on-backorder|on-backorder/i.test(availabilityHtml)
      ? 'preorder'
      : variation.is_in_stock === true ? 'in_stock' : variation.is_in_stock === false ? 'out_of_stock' : 'unknown'
    const image = isObject(variation.image) ? variation.image.full_src ?? variation.image.url ?? variation.image.src : null
    const id = variation.variation_id !== undefined && variation.variation_id !== null ? String(variation.variation_id) : null
    result.offers.push({
      title: parts.length > 0 ? parts.join(' / ') : null,
      price,
      regularPrice: regularOf(price, parseStructuredPrice(variation.display_regular_price)),
      currency: null,
      availability,
      sku: text(variation.sku),
      url: query.toString() ? `${base}?${query.toString()}` : base,
      image: absolute(image, pageUrl),
      variantId: id,
    })
  }
  return result
}

/** The store's currency from its own price markup (`woocommerce-Price-currencySymbol`). */
export function wooPageCurrencySymbol(html: string): string | null {
  const match = html.match(/woocommerce-Price-currencySymbol["'][^>]*>([^<]{1,12})</i)
  return match ? decodePriceEntities(match[1]).trim() || null : null
}

/* ------------------------------------------------------------------ */
/* Magento 2: x-magento-init spConfig / jsonConfig                     */
/* ------------------------------------------------------------------ */

function findKey(value: unknown, key: string, depth = 0): Record<string, unknown> | null {
  if (depth > 8) return null
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = findKey(entry, key, depth + 1)
      if (found) return found
    }
    return null
  }
  if (!isObject(value)) return null
  if (isObject(value[key])) return value[key] as Record<string, unknown>
  for (const entry of Object.values(value)) {
    const found = findKey(entry, key, depth + 1)
    if (found) return found
  }
  return null
}

function amountOf(value: unknown): number | null {
  return isObject(value) ? parseStructuredPrice(value.amount) : null
}

export function fromMagentoSpConfig(html: string, pageUrl: string): PlatformResult {
  const result = emptyResult('magento-spconfig')
  if (!html) return result
  let config: Record<string, unknown> | null = null
  for (const match of html.matchAll(/<script\b[^>]*type=["']text\/x-magento-init["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    if (!/"(?:spConfig|jsonConfig)"/.test(match[1])) continue
    const parsed = parseJson(match[1].trim())
    config = findKey(parsed, 'spConfig') ?? findKey(parsed, 'jsonConfig')
    if (config && isObject(config.optionPrices)) break
  }
  if (!config || !isObject(config.optionPrices)) return result

  const format = typeof config.currencyFormat === 'string' ? config.currencyFormat
    : isObject(config.priceFormat) && typeof config.priceFormat.pattern === 'string' ? config.priceFormat.pattern : ''
  result.currencySymbol = format.replace('%s', '').trim() || null
  if (isObject(config.priceFormat)) {
    const symbol = config.priceFormat.decimalSymbol
    if (symbol === '.' || symbol === ',') result.decimalSeparator = symbol
  }
  // childId → option labels, in attribute position order.
  const labels = new Map<string, string[]>()
  const attributes = isObject(config.attributes) ? Object.values(config.attributes).filter(isObject) : []
  attributes.sort((a, b) => Number(a.position ?? 0) - Number(b.position ?? 0))
  for (const attribute of attributes) {
    for (const option of Array.isArray(attribute.options) ? attribute.options : []) {
      if (!isObject(option)) continue
      const label = text(option.label)
      for (const id of Array.isArray(option.products) ? option.products : []) {
        const key = String(id)
        if (label) labels.set(key, [...(labels.get(key) ?? []), label])
      }
    }
  }
  // Magento 2.4 `salable`: attributeId → optionId → salable child ids.
  let salable: Set<string> | null = null
  if (isObject(config.salable)) {
    salable = new Set()
    for (const options of Object.values(config.salable)) {
      if (!isObject(options)) continue
      for (const ids of Object.values(options)) {
        for (const id of Array.isArray(ids) ? ids : []) salable.add(String(id))
      }
    }
  }
  const skus = isObject(config.sku) ? config.sku : isObject(config.skus) ? config.skus : null
  const images = isObject(config.images) ? config.images : null

  for (const [childId, prices] of Object.entries(config.optionPrices).slice(0, MAX_PLATFORM_OFFERS)) {
    if (!isObject(prices)) continue
    const price = amountOf(prices.finalPrice)
    if (price === null) continue
    const listed = labels.has(childId)
    const imageList = images && Array.isArray(images[childId]) ? images[childId] as unknown[] : []
    const firstImage = isObject(imageList[0]) ? imageList[0].full ?? imageList[0].img : null
    result.offers.push({
      title: labels.get(childId)?.join(' / ') ?? null,
      price,
      regularPrice: regularOf(price, amountOf(prices.oldPrice)),
      currency: null,
      availability: salable ? (salable.has(childId) ? 'in_stock' : 'out_of_stock') : listed ? 'in_stock' : 'unknown',
      ...(salable ? {} : { availabilityGuessed: true }),
      sku: skus ? text(skus[childId]) : null,
      url: pageUrl || null,
      image: absolute(firstImage, pageUrl),
      variantId: childId,
    })
  }
  return result
}

/* ------------------------------------------------------------------ */
/* BigCommerce: BCData.product_attributes                              */
/* ------------------------------------------------------------------ */

export function fromBigCommerceBCData(html: string, pageUrl: string): PlatformResult {
  const result = emptyResult('bigcommerce-bcdata')
  if (!html) return result
  const match = html.match(/\bBCData\s*=\s*(\{[\s\S]*?\})\s*;\s*(?:<\/script>|\n)/)
  if (!match) return result
  const data = parseJson(match[1])
  const product = isObject(data) && isObject(data.product_attributes) ? data.product_attributes : null
  if (!product) return result
  const priceBlock = isObject(product.price) ? product.price : {}
  const priceOf = (key: string): { value: number | null; currency: string | null } => {
    const entry = priceBlock[key]
    return isObject(entry)
      ? { value: parseStructuredPrice(entry.value), currency: text(entry.currency) }
      : { value: null, currency: null }
  }
  const current = priceOf('without_tax').value !== null ? priceOf('without_tax') : priceOf('with_tax')
  if (current.value === null) return result
  const regular = [priceOf('non_sale_price_without_tax'), priceOf('rrp_without_tax'), priceOf('non_sale_price_with_tax'), priceOf('rrp_with_tax')]
    .map(p => p.value).find((v): v is number => v !== null) ?? null
  result.currency = current.currency && /^[A-Z]{3}$/.test(current.currency) ? current.currency : null
  result.sku = text(product.sku)
  // BCData describes the default option selection. `purchasable: false` with
  // `instock: true` means "pick an option first", not "sold out" — the schema
  // microdata on these themes reports that state as OutOfStock.
  const availability: PlatformAvailability = product.instock === true ? 'in_stock'
    : product.instock === false ? 'out_of_stock' : 'unknown'
  result.offers.push({
    title: null,
    price: current.value,
    regularPrice: regularOf(current.value, regular),
    currency: result.currency,
    availability,
    sku: result.sku,
    url: pageUrl || null,
    image: isObject(product.image) && typeof product.image.data === 'string'
      ? absolute(product.image.data.replace('{:size}', 'original'), pageUrl)
      : null,
    variantId: null,
  })
  return result
}

/* ------------------------------------------------------------------ */
/* WooCommerce Store API (second fetch)                                */
/* ------------------------------------------------------------------ */

/** WooCommerce product id from the page: wp-json alternate link, the variations form, or the body class. */
export function wooProductId(html: string): string | null {
  if (!html) return null
  const link = html.match(/<link\b[^>]*href=["'][^"']*\/wp-json\/wp\/v2\/product\/(\d+)["'][^>]*>/i)
  if (link) return link[1]
  const form = html.match(/<form\b[^>]*\bdata-product_id=["'](\d+)["']/i)
  if (form) return form[1]
  const body = html.match(/<body\b[^>]*class=["'][^"']*\bsingle-product\b[^"']*\bpostid-(\d+)/i)
    ?? html.match(/<body\b[^>]*class=["'][^"']*\bpostid-(\d+)[^"']*\bsingle-product\b/i)
  return body ? body[1] : null
}

/** Store API URLs on the page's own origin. */
export function wooStoreApiUrls(pageUrl: string, productId: string): { product: string; variations: string } | null {
  if (!/^\d{1,12}$/.test(productId)) return null
  try {
    const origin = new URL(pageUrl).origin
    return {
      product: `${origin}/wp-json/wc/store/v1/products/${productId}`,
      variations: `${origin}/wp-json/wc/store/v1/products?type=variation&parent=${productId}&per_page=100`,
    }
  } catch {
    return null
  }
}

function wooMinorUnits(prices: Record<string, unknown>, key: string): number | null {
  const raw = prices[key]
  const unit = typeof prices.currency_minor_unit === 'number' && prices.currency_minor_unit >= 0 && prices.currency_minor_unit <= 4
    ? prices.currency_minor_unit : 2
  const digits = typeof raw === 'number' ? String(raw) : typeof raw === 'string' ? raw.trim() : ''
  if (!/^\d+$/.test(digits)) return null
  return Math.round((Number(digits) / 10 ** unit) * 100) / 100
}

function wooStoreOffer(product: Record<string, unknown>, title: string | null, pageUrl: string): PlatformOffer | null {
  const prices = isObject(product.prices) ? product.prices : null
  if (!prices) return null
  const price = wooMinorUnits(prices, 'price')
  if (price === null) return null
  const code = typeof prices.currency_code === 'string' && /^[A-Z]{3}$/.test(prices.currency_code) ? prices.currency_code : null
  const images = Array.isArray(product.images) ? product.images : []
  return {
    title,
    price,
    regularPrice: regularOf(price, wooMinorUnits(prices, 'regular_price')),
    currency: code,
    availability: product.is_on_backorder === true ? 'preorder'
      : product.is_in_stock === true ? 'in_stock' : product.is_in_stock === false ? 'out_of_stock' : 'unknown',
    sku: text(product.sku),
    url: absolute(product.permalink, pageUrl),
    image: isObject(images[0]) ? absolute(images[0].src, pageUrl) : null,
    variantId: product.id !== undefined && product.id !== null ? String(product.id) : null,
  }
}

/**
 * Store API product (and, for a variable product, its variation listing).
 * Prices are integer strings in minor units (`currency_minor_unit`).
 */
export function fromWooStoreApi(product: unknown, variations: unknown, pageUrl: string): PlatformResult {
  const result = emptyResult('woo-store-api')
  const item = Array.isArray(product) ? product.find(isObject) : product
  if (!isObject(item)) return result
  result.name = text(item.name)
  result.sku = text(item.sku)
  const prices = isObject(item.prices) ? item.prices : {}
  result.currency = typeof prices.currency_code === 'string' && /^[A-Z]{3}$/.test(prices.currency_code) ? prices.currency_code : null
  const separator = prices.currency_decimal_separator
  result.decimalSeparator = separator === '.' || separator === ',' ? separator : null
  const images = Array.isArray(item.images) ? item.images : []
  result.image = isObject(images[0]) ? absolute(images[0].src, pageUrl) : null

  const children = Array.isArray(variations) ? variations.filter(isObject) : []
  if (item.type === 'variable' && children.length > 0) {
    for (const child of children.slice(0, MAX_PLATFORM_OFFERS)) {
      const attributes = Array.isArray(child.attributes) ? child.attributes.filter(isObject) : []
      const title = attributes.map(a => text(a.value)).filter(Boolean).join(' / ')
        || (typeof child.variation === 'string' ? text(child.variation.replace(/^[^:]{1,40}:\s*/, '')) : null)
      const offer = wooStoreOffer(child, title || null, pageUrl)
      if (offer) result.offers.push(offer)
    }
    return result
  }
  if (item.type !== 'variable') {
    const offer = wooStoreOffer(item, result.name, pageUrl)
    if (offer) result.offers.push(offer)
  }
  return result
}

/* ------------------------------------------------------------------ */
/* Magento GraphQL (second fetch)                                      */
/* ------------------------------------------------------------------ */

const MAGENTO_PRODUCT_FIELDS = 'sku name url_key stock_status price_range{minimum_price{final_price{value currency} regular_price{value currency}}}'

/** `url_key` of a Magento product page: the last path segment without its `.html` suffix. */
export function magentoUrlKey(pageUrl: string): string | null {
  try {
    const segment = new URL(pageUrl).pathname.replace(/\/+$/, '').split('/').pop() ?? ''
    const key = decodeURIComponent(segment).replace(/\.html?$/i, '')
    return /^[a-z0-9][a-z0-9._-]{0,200}$/i.test(key) ? key : null
  } catch {
    return null
  }
}

/** A cacheable GraphQL GET for the product and its configurable variants. */
export function magentoGraphqlUrl(pageUrl: string): string | null {
  const key = magentoUrlKey(pageUrl)
  if (!key) return null
  const query = `{products(filter:{url_key:{eq:${JSON.stringify(key)}}}){items{__typename ${MAGENTO_PRODUCT_FIELDS} `
    + '... on ConfigurableProduct{configurable_options{attribute_code label position values{value_index label}} '
    + `variants{attributes{label code value_index} product{${MAGENTO_PRODUCT_FIELDS}}}}}}}`
  try {
    const url = new URL('/graphql', pageUrl)
    url.searchParams.set('query', query)
    return url.href
  } catch {
    return null
  }
}

function magentoPrice(product: Record<string, unknown>): { price: number | null; regular: number | null; currency: string | null } {
  const minimum = isObject(product.price_range) && isObject(product.price_range.minimum_price) ? product.price_range.minimum_price : {}
  const final = isObject(minimum.final_price) ? minimum.final_price : {}
  const regular = isObject(minimum.regular_price) ? minimum.regular_price : {}
  const currency = typeof final.currency === 'string' && /^[A-Z]{3}$/.test(final.currency) ? final.currency : null
  return { price: parseStructuredPrice(final.value), regular: parseStructuredPrice(regular.value), currency }
}

function magentoStock(value: unknown): PlatformAvailability {
  return value === 'IN_STOCK' ? 'in_stock' : value === 'OUT_OF_STOCK' ? 'out_of_stock' : 'unknown'
}

export function fromMagentoGraphql(response: unknown, pageUrl: string): PlatformResult {
  const result = emptyResult('magento-graphql')
  const items = isObject(response) && isObject(response.data) && isObject(response.data.products)
    && Array.isArray(response.data.products.items) ? response.data.products.items.filter(isObject) : []
  if (items.length === 0) return result
  const key = magentoUrlKey(pageUrl)
  const item = items.find(i => i.url_key === key) ?? items[0]
  result.name = text(item.name)
  result.sku = text(item.sku)
  const own = magentoPrice(item)
  result.currency = own.currency

  const variants = Array.isArray(item.variants) ? item.variants.filter(isObject) : []
  if (variants.length > 0) {
    const order = new Map<string, number>()
    if (Array.isArray(item.configurable_options)) {
      item.configurable_options.filter(isObject).forEach((option, index) => {
        if (typeof option.attribute_code === 'string') order.set(option.attribute_code, Number(option.position ?? index))
      })
    }
    for (const variant of variants.slice(0, MAX_PLATFORM_OFFERS)) {
      const product = isObject(variant.product) ? variant.product : null
      if (!product) continue
      const { price, regular, currency } = magentoPrice(product)
      if (price === null) continue
      const attributes = Array.isArray(variant.attributes) ? variant.attributes.filter(isObject) : []
      attributes.sort((a, b) => (order.get(String(a.code)) ?? 0) - (order.get(String(b.code)) ?? 0))
      const title = attributes.map(a => text(a.label)).filter(Boolean).join(' / ')
      result.offers.push({
        title: title || text(product.name),
        price,
        regularPrice: regularOf(price, regular),
        currency: currency ?? result.currency,
        availability: magentoStock(product.stock_status),
        sku: text(product.sku),
        url: pageUrl || null,
        image: null,
        variantId: null,
      })
    }
    return result
  }
  if (own.price !== null) {
    result.offers.push({
      title: result.name,
      price: own.price,
      regularPrice: regularOf(own.price, own.regular),
      currency: own.currency,
      availability: magentoStock(item.stock_status),
      sku: result.sku,
      url: pageUrl || null,
      image: null,
      variantId: null,
    })
  }
  return result
}
