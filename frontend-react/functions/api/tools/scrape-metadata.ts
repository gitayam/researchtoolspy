import { Env } from '../../types'

interface ScrapedMetadata {
  title?: string
  author?: string
  siteName?: string
  publication?: string
  date?: string
  description?: string
  url: string
  type?: 'article' | 'website' | 'book'
}

// Helper to check if a string looks like a person's name (not a publication)
function looksLikePersonName(name: string): boolean {
  if (!name) return false

  // Reject common publication patterns
  const publicationPatterns = [
    /^the\s+/i,  // "The Wall Street Journal"
    /\s+(news|times|post|journal|magazine|press|gazette|tribune|herald|observer|guardian|telegraph)\s*$/i,
    /\s+(media|publishing|publications|network|corp|inc|llc|ltd)\s*$/i,
    /^(staff|editorial|editor|newsroom)/i,
  ]

  for (const pattern of publicationPatterns) {
    if (pattern.test(name)) return false
  }

  // Accept if it has 2-4 words and starts with capital letter
  const words = name.trim().split(/\s+/)
  if (words.length < 2 || words.length > 4) return false

  // Each word should start with capital letter
  return words.every(word => /^[A-Z]/.test(word))
}

// Extract metadata from HTML
function extractMetadata(html: string, url: string): ScrapedMetadata {
  const metadata: ScrapedMetadata = { url }

  // Try to extract from JSON-LD structured data first (most reliable)
  const jsonLdMatches = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>(.*?)<\/script>/gis)
  for (const match of jsonLdMatches) {
    try {
      const jsonData = JSON.parse(match[1])

      // Handle both single objects and arrays
      const data = Array.isArray(jsonData) ? jsonData[0] : jsonData

      if (data['@type'] === 'NewsArticle' || data['@type'] === 'Article') {
        // Get author
        if (data.author) {
          if (typeof data.author === 'string') {
            if (looksLikePersonName(data.author)) {
              metadata.author = data.author
            }
          } else if (data.author.name && looksLikePersonName(data.author.name)) {
            metadata.author = data.author.name
          } else if (Array.isArray(data.author) && data.author[0]) {
            const firstAuthor = typeof data.author[0] === 'string' ? data.author[0] : data.author[0].name
            if (looksLikePersonName(firstAuthor)) {
              metadata.author = firstAuthor
            }
          }
        }

        // Get publication/publisher
        if (data.publisher?.name) {
          metadata.publication = data.publisher.name
        }

        // Get title
        if (data.headline && !metadata.title) {
          metadata.title = data.headline
        }

        // Get date
        if (data.datePublished) {
          const date = new Date(data.datePublished)
          if (!isNaN(date.getTime())) {
            metadata.date = date.getFullYear().toString()
          }
        }
      }
    } catch (e) {
      // Invalid JSON, continue
    }
  }

  // Extract title from <title> tag if not found
  if (!metadata.title) {
    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i)
    if (titleMatch) {
      metadata.title = titleMatch[1].trim()
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        // Remove site name suffix from title (e.g. " - CNN", " | The Guardian")
        .replace(/\s*[-–|]\s*[^-–|]+$/, '')
    }
  }

  // Extract meta tags
  const metaTags = html.matchAll(/<meta\s+([^>]+)>/gi)

  for (const tag of metaTags) {
    const attrs = tag[1]

    // Get property/name and content
    const propertyMatch = attrs.match(/(?:property|name)=["']([^"']+)["']/i)
    const contentMatch = attrs.match(/content=["']([^"']+)["']/i)

    if (propertyMatch && contentMatch) {
      const prop = propertyMatch[1].toLowerCase()
      const content = contentMatch[1]
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")

      // Open Graph tags
      if (prop === 'og:title' && !metadata.title) {
        metadata.title = content
      } else if (prop === 'og:site_name' && !metadata.siteName) {
        metadata.siteName = content
      } else if (prop === 'og:description' && !metadata.description) {
        metadata.description = content
      } else if (prop === 'og:type') {
        if (content === 'article') metadata.type = 'article'
      }

      // Article author - validate it looks like a person name
      else if (prop === 'article:author' && !metadata.author) {
        if (looksLikePersonName(content)) {
          metadata.author = content
        }
      } else if (prop === 'article:published_time' && !metadata.date) {
        const date = new Date(content)
        if (!isNaN(date.getTime())) {
          metadata.date = date.getFullYear().toString()
        }
      }

      // Article publisher/publication
      else if (prop === 'article:publisher' && !metadata.publication) {
        metadata.publication = content
      }

      // Standard meta tags for author
      else if ((prop === 'author' || prop === 'citation_author' || prop === 'sailthru.author' ||
                prop === 'parsely-author' || prop === 'dc.creator') && !metadata.author) {
        if (looksLikePersonName(content)) {
          metadata.author = content
        }
      }

      // Publication name
      else if ((prop === 'citation_journal_title' || prop === 'og:site_name') && !metadata.publication) {
        metadata.publication = content
      }

      // Other meta tags
      else if (prop === 'description' && !metadata.description) {
        metadata.description = content
      } else if ((prop === 'dc.date.issued' || prop === 'citation_publication_date' ||
                  prop === 'publishdate' || prop === 'article:published_time') && !metadata.date) {
        const date = new Date(content)
        if (!isNaN(date.getTime())) {
          metadata.date = date.getFullYear().toString()
        }
      }
    }
  }

  // Try to extract author from byline patterns in HTML content
  if (!metadata.author) {
    const bylinePatterns = [
      /by\s+([A-Z][a-z]+(?:\s+[A-Z]\.?)?\s+[A-Z][a-z]+)/i,  // "By John Smith" or "By John A. Smith"
      /written\s+by\s+([A-Z][a-z]+(?:\s+[A-Z]\.?)?\s+[A-Z][a-z]+)/i,
      /author:\s*([A-Z][a-z]+(?:\s+[A-Z]\.?)?\s+[A-Z][a-z]+)/i,
      /<span[^>]*class=["'][^"']*author[^"']*["'][^>]*>([^<]+)</i,
      /<div[^>]*class=["'][^"']*byline[^"']*["'][^>]*>.*?by\s+([A-Z][a-z]+(?:\s+[A-Z]\.?)?\s+[A-Z][a-z]+)/is,
      /<a[^>]*rel=["']author["'][^>]*>([^<]+)</i,
    ]

    for (const pattern of bylinePatterns) {
      const match = html.match(pattern)
      if (match && looksLikePersonName(match[1].trim())) {
        metadata.author = match[1].trim()
        break
      }
    }
  }

  // Try to extract date from page content
  if (!metadata.date) {
    const datePatterns = [
      /(\d{4})-(\d{2})-(\d{2})/,  // 2025-10-02
      /(\d{1,2})\/(\d{1,2})\/(\d{4})/,  // 10/02/2025
      /(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})/i,
    ]

    for (const pattern of datePatterns) {
      const match = html.match(pattern)
      if (match) {
        if (pattern.source.includes('January')) {
          metadata.date = match[3] // Year
        } else if (match[0].includes('-')) {
          metadata.date = match[1] // Year
        } else {
          metadata.date = match[3] // Year
        }
        break
      }
    }
  }

  // Extract site name from domain if not found
  if (!metadata.siteName && !metadata.publication) {
    try {
      const urlObj = new URL(url)
      const hostname = urlObj.hostname.replace('www.', '')
      metadata.siteName = hostname.split('.')[0]
        .replace(/-/g, ' ')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
    } catch (e) {
      // Invalid URL
    }
  }

  // Set type based on content
  if (!metadata.type) {
    if (html.includes('article') || html.includes('blog')) {
      metadata.type = 'article'
    } else {
      metadata.type = 'website'
    }
  }

  return metadata
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request } = context

  try {
    const body = await request.json() as { url: string }

    if (!body.url) {
      return new Response(JSON.stringify({ error: 'URL is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Validate URL format
    let validUrl: URL
    try {
      validUrl = new URL(body.url)
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid URL format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Fetch the URL
    const response = await fetch(body.url, {
      headers: {
        'User-Agent': 'ResearchToolsPy Citation Bot/1.0 (Academic Research Tool)'
      }
    })

    if (!response.ok) {
      return new Response(JSON.stringify({
        error: `Failed to fetch URL: ${response.statusText}`
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const html = await response.text()
    const metadata = extractMetadata(html, body.url)

    // Get current date for access date
    const now = new Date()
    const accessDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

    return new Response(JSON.stringify({
      ...metadata,
      accessDate,
      success: true
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })

  } catch (error) {
    console.error('Scrape metadata error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to scrape metadata',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Handle OPTIONS requests for CORS
export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  })
}
