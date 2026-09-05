export const ARTICLE_EXTRACTOR_VERSION = 'heuristic.v2' as const
export const ARTICLE_QUALITY_VERSION = 'article-quality.v2' as const

export type ArticleRejectionReason =
  | 'empty'
  | 'too_short'
  | 'login_or_paywall'
  | 'high_link_density'
  | 'low_text_density'

export interface ArticleQualitySignals {
  version: typeof ARTICLE_QUALITY_VERSION
  accepted: boolean
  score: number
  reasons: ArticleRejectionReason[]
  paragraphCount: number
  textToMarkupRatio: number
  linkDensity: number
}

/** Worker-safe semantic article extraction without executing untrusted HTML. */
export interface ArticleExtraction {
  extractorVersion: typeof ARTICLE_EXTRACTOR_VERSION
  title?: string
  author?: string
  publishedTime?: string
  siteName?: string
  excerpt?: string
  ogTitle?: string
  ogDescription?: string
  image?: string
  ogType?: string
  keywords: string[]
  text: string
  wordCount: number
  quality: 'good' | 'thin' | 'empty'
  qualitySignals: ArticleQualitySignals
  method: 'article' | 'main' | 'paragraphs' | 'body'
}

export function decodeHtmlEntities(value: string): string {
  const named: Record<string, string> = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—',
    lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', hellip: '…',
  }
  return value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (full, code: string) => {
    if (code[0] === '#') {
      const hex = code[1].toLowerCase() === 'x'
      const point = Number.parseInt(code.slice(hex ? 2 : 1), hex ? 16 : 10)
      return Number.isFinite(point)
        && point > 0
        && point <= 0x10ffff
        && !(point >= 0xd800 && point <= 0xdfff)
        ? String.fromCodePoint(point)
        : full
    }
    return named[code.toLowerCase()] ?? full
  })
}

function tagAttributes(tag: string): Record<string, string> {
  const result: Record<string, string> = {}
  const pattern = /([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g
  for (const match of tag.matchAll(pattern)) {
    result[match[1].toLowerCase()] = decodeHtmlEntities(match[2] ?? match[3] ?? match[4] ?? '')
  }
  return result
}

function metaValues(html: string): Map<string, string> {
  const values = new Map<string, string>()
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attributes = tagAttributes(match[0])
    const key = (attributes.property || attributes.name || attributes.itemprop || '').trim().toLowerCase()
    const content = attributes.content?.trim()
    if (key && content && !values.has(key)) values.set(key, content)
  }
  return values
}

type JsonObject = Record<string, unknown>

function isJsonObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function jsonLdObjects(html: string): JsonObject[] {
  const objects: JsonObject[] = []
  for (const match of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const parsed: unknown = JSON.parse(decodeHtmlEntities(match[1]).trim())
      const visit = (value: unknown): void => {
        if (Array.isArray(value)) return value.forEach(visit)
        if (!isJsonObject(value)) return
        objects.push(value)
        if (Array.isArray(value['@graph'])) value['@graph'].forEach(visit)
      }
      visit(parsed)
    } catch { /* malformed publisher JSON-LD */ }
  }
  return objects
}

function cleanText(html: string): string {
  return decodeHtmlEntities(html
    .replace(/<(script|style|noscript|template|svg|nav|footer|header|aside|form)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|section|article|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' '))
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function firstBlock(html: string, tag: string): string | undefined {
  const match = html.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'i'))
  return match?.[1]
}

function boundedRatio(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0
  return Math.max(0, Math.min(1, numerator / denominator))
}

export function assessArticleQuality(
  html: string,
  text: string,
  wordCount: number,
  paragraphCount: number,
  hasTitle: boolean,
): ArticleQualitySignals {
  const visiblePageText = cleanText(html)
  const linkText = [...html.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)]
    .map(match => cleanText(match[1])).join(' ')
  const textToMarkupRatio = boundedRatio(text.length, html.length)
  const linkDensity = boundedRatio(linkText.length, visiblePageText.length)
  const lower = `${hasTitle ? '' : 'untitled '} ${text}`.toLowerCase()
  const blocked = [
    'sign in to continue', 'log in to continue', 'subscribe to continue',
    'subscription required', 'create an account to continue', 'premium content',
  ].some(marker => lower.includes(marker))
  const reasons: ArticleRejectionReason[] = []
  if (wordCount === 0) reasons.push('empty')
  else if (blocked && wordCount < 180) reasons.push('login_or_paywall')
  else if (wordCount < 40) reasons.push('too_short')
  if (linkDensity > 0.55 && wordCount < 250) reasons.push('high_link_density')
  if (textToMarkupRatio < 0.015 && wordCount < 120) reasons.push('low_text_density')

  let score = Math.min(55, wordCount / 4)
  if (hasTitle) score += 15
  score += Math.min(20, paragraphCount * 4)
  score += Math.max(0, 10 - linkDensity * 20)
  score -= reasons.length * 25
  score = Math.round(Math.max(0, Math.min(100, score)))

  // A structured short primary document can be useful; length alone is not a rejection.
  const accepted = reasons.length === 0 && (wordCount >= 80 || (hasTitle && paragraphCount >= 2 && wordCount >= 40))
  return {
    version: ARTICLE_QUALITY_VERSION,
    accepted,
    score,
    reasons,
    paragraphCount,
    textToMarkupRatio: Number(textToMarkupRatio.toFixed(4)),
    linkDensity: Number(linkDensity.toFixed(4)),
  }
}

function objectName(value: unknown): string | undefined {
  return isJsonObject(value) && typeof value.name === 'string' ? value.name : undefined
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

export function extractArticle(html: string, url: string): ArticleExtraction {
  void url
  const metadata = metaValues(html)
  const structured = jsonLdObjects(html).find((item) => {
    const types = Array.isArray(item['@type']) ? item['@type'] : [item['@type']]
    return types.some((type: unknown) => ['Article', 'NewsArticle', 'Report', 'BlogPosting'].includes(String(type)))
  })
  const authorValue = structured?.author
  const author = typeof authorValue === 'string' ? authorValue
    : Array.isArray(authorValue) ? authorValue.map((value) => stringValue(value) ?? objectName(value)).filter(Boolean).join(', ')
      : objectName(authorValue)
  const articleBlock = firstBlock(html, 'article')
  const mainBlock = firstBlock(html, 'main')
  const paragraphs = [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => cleanText(match[1]))
    .filter((text) => text.length >= 40)
  let method: ArticleExtraction['method'] = 'body'
  let text: string
  if (articleBlock) { method = 'article'; text = cleanText(articleBlock) }
  else if (mainBlock) { method = 'main'; text = cleanText(mainBlock) }
  else if (paragraphs.join('\n\n').length >= 300) { method = 'paragraphs'; text = paragraphs.join('\n\n') }
  else { text = cleanText(html) }

  const wordCount = text ? text.split(/\s+/).length : 0
  const titleTag = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
  const title = stringValue(structured?.headline) || metadata.get('og:title') || metadata.get('twitter:title') || (titleTag ? cleanText(titleTag) : undefined)
  const excerpt = stringValue(structured?.description) || metadata.get('og:description') || metadata.get('description')
  const normalizedTitle = title ? String(title).trim() : undefined
  const qualitySignals = assessArticleQuality(html, text, wordCount, paragraphs.length, Boolean(normalizedTitle))
  const keywords = (stringValue(structured?.keywords) || metadata.get('keywords') || '')
    .toString().split(',').map((value: string) => value.trim()).filter(Boolean).slice(0, 50)
  return {
    extractorVersion: ARTICLE_EXTRACTOR_VERSION,
    title: normalizedTitle,
    author: author || metadata.get('article:author') || metadata.get('author'),
    publishedTime: stringValue(structured?.datePublished) || metadata.get('article:published_time'),
    siteName: objectName(structured?.publisher) || metadata.get('og:site_name'),
    excerpt,
    ogTitle: metadata.get('og:title'),
    ogDescription: metadata.get('og:description'),
    image: metadata.get('og:image'),
    ogType: metadata.get('og:type'),
    keywords,
    text,
    wordCount,
    quality: qualitySignals.accepted ? 'good' : wordCount >= 40 ? 'thin' : 'empty',
    qualitySignals,
    method,
  }
}
