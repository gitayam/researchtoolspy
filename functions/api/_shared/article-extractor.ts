/** Worker-safe semantic article extraction without a DOM dependency. */
export interface ArticleExtraction {
  title?: string
  author?: string
  publishedTime?: string
  siteName?: string
  excerpt?: string
  text: string
  wordCount: number
  quality: 'good' | 'thin' | 'empty'
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
      return Number.isFinite(point) && point > 0 ? String.fromCodePoint(point) : full
    }
    return named[code.toLowerCase()] ?? full
  })
}

function attr(html: string, key: string): string | undefined {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["']`, 'i'),
  ]
  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (match?.[1]) return decodeHtmlEntities(match[1].trim())
  }
  return undefined
}

function jsonLdObjects(html: string): any[] {
  const objects: any[] = []
  for (const match of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const parsed = JSON.parse(decodeHtmlEntities(match[1]).trim())
      const visit = (value: any) => {
        if (Array.isArray(value)) return value.forEach(visit)
        if (!value || typeof value !== 'object') return
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
  const match = html.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\/${tag}>`, 'i'))
  return match?.[1]
}

export function extractArticle(html: string, _url: string): ArticleExtraction {
  const structured = jsonLdObjects(html).find((item) => {
    const types = Array.isArray(item['@type']) ? item['@type'] : [item['@type']]
    return types.some((type: unknown) => ['Article', 'NewsArticle', 'Report', 'BlogPosting'].includes(String(type)))
  })
  const authorValue = structured?.author
  const author = typeof authorValue === 'string' ? authorValue
    : Array.isArray(authorValue) ? authorValue.map((a) => typeof a === 'string' ? a : a?.name).filter(Boolean).join(', ')
      : authorValue?.name
  const articleBlock = firstBlock(html, 'article')
  const mainBlock = firstBlock(html, 'main')
  const paragraphs = [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => cleanText(match[1]))
    .filter((text) => text.length >= 40)
  let method: ArticleExtraction['method'] = 'body'
  let text = ''
  if (articleBlock) { method = 'article'; text = cleanText(articleBlock) }
  else if (mainBlock) { method = 'main'; text = cleanText(mainBlock) }
  else if (paragraphs.join('\n\n').length >= 300) { method = 'paragraphs'; text = paragraphs.join('\n\n') }
  else text = cleanText(html)

  const wordCount = text ? text.split(/\s+/).length : 0
  const titleTag = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
  const title = structured?.headline || attr(html, 'og:title') || attr(html, 'twitter:title') || (titleTag ? cleanText(titleTag) : undefined)
  const excerpt = structured?.description || attr(html, 'og:description') || attr(html, 'description')
  return {
    title: title ? String(title).trim() : undefined,
    author: author || attr(html, 'article:author') || attr(html, 'author'),
    publishedTime: structured?.datePublished || attr(html, 'article:published_time'),
    siteName: structured?.publisher?.name || attr(html, 'og:site_name'),
    excerpt,
    text,
    wordCount,
    quality: wordCount >= 150 ? 'good' : wordCount >= 40 ? 'thin' : 'empty',
    method,
  }
}
