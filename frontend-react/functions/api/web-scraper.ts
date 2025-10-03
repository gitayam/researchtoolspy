// Cloudflare Pages Function for Web Scraping API
import { enhancedFetch } from '../utils/browser-profiles'

interface ScrapingRequest {
  url: string
  extract_mode?: 'full' | 'metadata' | 'summary'
  create_dataset?: boolean
}

interface ScrapingResult {
  url: string
  title?: string
  description?: string
  author?: string
  published_date?: string
  domain?: string
  content?: {
    text: string
    summary?: string
    word_count: number
  }
  metadata?: {
    keywords?: string[]
    og_title?: string
    og_description?: string
    og_image?: string
    [key: string]: any
  }
  reliability_score?: number
  extracted_at: string
}

export async function onRequest(context: any) {
  const { request, env } = context

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
  }

  // Handle preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: corsHeaders,
    })
  }

  try {
    const body: ScrapingRequest = await request.json()

    if (!body.url) {
      return new Response(JSON.stringify({ error: 'URL is required' }), {
        status: 400,
        headers: corsHeaders,
      })
    }

    // Validate URL
    let url: URL
    try {
      url = new URL(body.url)
      if (!['http:', 'https:'].includes(url.protocol)) {
        throw new Error('Invalid protocol')
      }
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Invalid URL' }), {
        status: 400,
        headers: corsHeaders,
      })
    }

    // Fetch the URL with enhanced browser headers
    const response = await enhancedFetch(url.toString(), {
      maxRetries: 3,
      retryDelay: 500
    })

    if (!response.ok) {
      return new Response(JSON.stringify({
        error: `Failed to fetch URL: ${response.status} ${response.statusText}`
      }), {
        status: 400,
        headers: corsHeaders,
      })
    }

    const html = await response.text()

    // Extract metadata using regex (lightweight parsing)
    const result: ScrapingResult = {
      url: url.toString(),
      domain: url.hostname,
      extracted_at: new Date().toISOString(),
    }

    // Extract title
    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i)
    if (titleMatch) {
      result.title = titleMatch[1].trim()
    }

    // Extract meta description
    const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["'](.*?)["']/i)
    if (descMatch) {
      result.description = descMatch[1].trim()
    }

    // Extract author
    const authorMatch = html.match(/<meta\s+name=["']author["']\s+content=["'](.*?)["']/i)
    if (authorMatch) {
      result.author = authorMatch[1].trim()
    }

    // Extract keywords
    const keywordsMatch = html.match(/<meta\s+name=["']keywords["']\s+content=["'](.*?)["']/i)
    const keywords = keywordsMatch ? keywordsMatch[1].split(',').map(k => k.trim()) : []

    // Extract Open Graph metadata
    const metadata: any = {}

    const ogTitleMatch = html.match(/<meta\s+property=["']og:title["']\s+content=["'](.*?)["']/i)
    if (ogTitleMatch) metadata.og_title = ogTitleMatch[1].trim()

    const ogDescMatch = html.match(/<meta\s+property=["']og:description["']\s+content=["'](.*?)["']/i)
    if (ogDescMatch) metadata.og_description = ogDescMatch[1].trim()

    const ogImageMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["'](.*?)["']/i)
    if (ogImageMatch) metadata.og_image = ogImageMatch[1].trim()

    const ogTypeMatch = html.match(/<meta\s+property=["']og:type["']\s+content=["'](.*?)["']/i)
    if (ogTypeMatch) metadata.og_type = ogTypeMatch[1].trim()

    if (keywords.length > 0) metadata.keywords = keywords

    result.metadata = metadata

    // Extract content if requested
    if (body.extract_mode === 'full' || body.extract_mode === 'summary') {
      // Remove scripts, styles, and other non-content tags
      let textContent = html
        .replace(/<script[^>]*>.*?<\/script>/gis, '')
        .replace(/<style[^>]*>.*?<\/style>/gis, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/\s+/g, ' ')
        .trim()

      // Limit content size
      const maxLength = 10000
      if (textContent.length > maxLength) {
        textContent = textContent.substring(0, maxLength) + '...'
      }

      const wordCount = textContent.split(/\s+/).length

      result.content = {
        text: textContent,
        word_count: wordCount,
      }

      // Simple summary (first 500 characters)
      if (body.extract_mode === 'summary' && textContent.length > 500) {
        result.content.summary = textContent.substring(0, 500) + '...'
      }
    }

    // Calculate basic reliability score based on domain and metadata completeness
    let reliabilityScore = 5.0

    // Common reliable domains
    const reliableDomains = ['gov', 'edu', 'org']
    if (reliableDomains.some(d => url.hostname.endsWith('.' + d))) {
      reliabilityScore += 2.0
    }

    // Check metadata completeness
    if (result.title) reliabilityScore += 0.5
    if (result.description) reliabilityScore += 0.5
    if (result.author) reliabilityScore += 1.0
    if (metadata.keywords && metadata.keywords.length > 0) reliabilityScore += 0.5
    if (metadata.og_title) reliabilityScore += 0.5

    result.reliability_score = Math.min(10, reliabilityScore)

    // Optionally create dataset
    if (body.create_dataset) {
      try {
        const datasetData = {
          title: result.title || url.hostname,
          description: result.description || `Content from ${url.hostname}`,
          source: url.toString(),
          type: 'web_article',
          source_name: url.hostname,
          source_url: url.toString(),
          author: result.author,
          reliability_rating: result.reliability_score >= 7 ? 'high' : result.reliability_score >= 5 ? 'medium' : 'low',
          tags: metadata.keywords || [],
          metadata: JSON.stringify(metadata),
          access_date: new Date().toISOString().split('T')[0],
        }

        const datasetResponse = await fetch(`${new URL(request.url).origin}/api/datasets`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(datasetData),
        })

        if (datasetResponse.ok) {
          const { dataset } = await datasetResponse.json()
          result.dataset_id = dataset.id
        }
      } catch (error) {
        console.error('Failed to create dataset:', error)
        // Don't fail the whole request if dataset creation fails
      }
    }

    return new Response(JSON.stringify({
      success: true,
      data: result
    }), {
      status: 200,
      headers: corsHeaders,
    })

  } catch (error: any) {
    console.error('Web scraping error:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Failed to scrape URL'
    }), {
      status: 500,
      headers: corsHeaders,
    })
  }
}
