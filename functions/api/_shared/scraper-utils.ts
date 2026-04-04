/**
 * Shared Scraping Utilities
 * Centralizes logic for fetching and extracting text from URLs
 * including platform-specific handlers (Twitter, TikTok via Apify)
 */

import { fetchSocialViaApify } from './apify-social'

export interface ScrapedContent {
  title: string
  content: string
  error?: string
}

export async function scrapeUrl(url: string, apifyApiKey?: string): Promise<ScrapedContent> {
  // 1. Try Apify for Twitter/X and TikTok (richer content with engagement metrics)
  if (apifyApiKey) {
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
  const isTwitter = /twitter\.com|x\.com/.test(url)

  if (isTwitter) {
    try {
      const twitterUrl = url.replace('https://x.com/', 'https://twitter.com/')
      const oembedUrl = `https://publish.twitter.com/oembed?url=${encodeURIComponent(twitterUrl)}`
      const twitterResponse = await fetch(oembedUrl, { signal: AbortSignal.timeout(10000) })

      if (twitterResponse.ok) {
        const data = await twitterResponse.json() as any
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
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000) // 15s timeout

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ResearchToolsBot/1.0; +http://research.example.com)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      if (response.status === 403 || response.status === 401) {
        return { title: 'Access Denied', content: '', error: 'Access Denied: The website blocked automated access.' }
      }
      throw new Error(`HTTP ${response.status}`)
    }

    const html = await response.text()

    // Extract Title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    const title = titleMatch ? titleMatch[1].trim() : url

    // Extract Text (Simple)
    let text = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    text = text.replace(/<[^>]+>/g, ' ')
    text = text.replace(/\s+/g, ' ').trim()

    return {
      title,
      content: text.substring(0, 20000) // Limit to 20k chars
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
