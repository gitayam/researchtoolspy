/**
 * Shared Scraping Utilities
 * Centralizes logic for fetching and extracting text from URLs
 * including platform-specific handlers (Twitter, TikTok via Apify)
 */

import { fetchSocialViaApify, isApifySupportedUrl } from './apify-social'
import { extractArticle } from './article-extractor'
import { parseSafeOutboundUrl, safeFetchText } from './safe-fetch'

export interface ScrapedContent {
  title: string
  content: string
  error?: string
  extraction?: { method: string; quality: string; wordCount: number }
}

interface TwitterOEmbed {
  html?: string
  author_name?: string
}

export async function scrapeUrl(
  url: string,
  apifyApiKey?: string,
): Promise<ScrapedContent> {
  try {
    url = parseSafeOutboundUrl(url).href
  } catch {
    return { title: 'Error', content: '', error: 'Scraping failed' }
  }

  // 1. Try Apify for Twitter/X and TikTok (richer content with engagement metrics)
  const socialPlatform = isApifySupportedUrl(url)
  if (apifyApiKey && socialPlatform) {
    try {
      // Race Apify against a 20s deadline to avoid hanging the Worker
      const socialResult = await Promise.race([
        fetchSocialViaApify(url, apifyApiKey),
        new Promise<null>((_, reject) => setTimeout(() => reject(new Error('Apify timeout (20s)')), 20000)),
      ])
      if (socialResult?.success && socialResult.text.length > 20) {
        return {
          title: socialResult.title || `${socialResult.platform} post`,
          content: socialResult.text,
        }
      }
    } catch (e) {
      console.error('[Scrape] Apify social extraction failed:', e)
      // Fall through to oEmbed / standard fetch
    }
  }

  // 2. Fallback: Twitter/X oEmbed (no API key needed, but limited content)
  if (socialPlatform === 'twitter') {
    try {
      const twitterUrl = url.replace('https://x.com/', 'https://twitter.com/')
      const oembedUrl = `https://publish.twitter.com/oembed?url=${encodeURIComponent(twitterUrl)}`
      const oembed = await safeFetchText(oembedUrl, {
        timeoutMs: 10_000,
        maxRedirects: 2,
        maxResponseBytes: 128 * 1024,
        allowedHostnames: ['publish.twitter.com'],
        allowedContentTypes: ['application/json'],
      })
      const twitterResponse = oembed.response

      if (twitterResponse.ok) {
        const data = JSON.parse(oembed.text) as TwitterOEmbed
        const html = data.html || ''
        let content = ''

        // Extract text from blockquote
        const pMatch = html.match(/<p[^>]*>(.*?)<\/p>/)
        if (pMatch && pMatch[1]) {
          content = pMatch[1]
            .replace(/<br\s*\/?>/g, '\n')
            .replace(/<[^>]+>/g, '')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .trim()
        }

        return {
          title: `Tweet by ${data.author_name}`,
          content: content || 'No text content found in tweet.'
        }
      }
    } catch (e) {
      console.error('[Scrape] Twitter oEmbed failed:', e)
      // Fall through to standard fetch if oEmbed fails
    }
  }

  // 3. Standard Fetch
  try {
    const fetched = await safeFetchText(url, {
      timeoutMs: 15_000,
      maxRedirects: 5,
      maxResponseBytes: 2 * 1024 * 1024,
      allowedContentTypes: ['text/', 'application/xhtml+xml', 'application/xml'],
      requestInit: {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ResearchToolsBot/1.0; +http://research.example.com)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8',
        },
      },
    })
    const { response, text: html, finalUrl } = fetched

    if (!response.ok) {
      if (response.status === 403 || response.status === 401) {
        return { title: 'Access Denied', content: '', error: 'Access Denied: The website blocked automated access.' }
      }
      throw new Error(`HTTP ${response.status}`)
    }

    const article = extractArticle(html, finalUrl)
    const content = article.text

    return {
      title: article.title || url,
      content: content.substring(0, 30000),
      extraction: {
        method: article.method,
        quality: article.quality,
        wordCount: content ? content.split(/\s+/).length : 0,
      },
    }

  } catch (error) {
    console.error('[Scrape] Standard fetch failed:', error)
    return {
      title: 'Error',
      content: '',
      error: 'Scraping failed'
    }
  }
}
