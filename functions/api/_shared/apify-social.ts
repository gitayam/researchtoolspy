/**
 * Apify Social Media Content Extraction
 *
 * Uses Apify actors to extract rich content from Twitter/X and TikTok URLs.
 * Falls back gracefully if APIFY_API_KEY is not configured.
 */

import { safeFetchText } from './safe-fetch'

const APIFY_BASE = 'https://api.apify.com/v2'

interface TwitterOEmbed {
  html?: string
  author_name?: string
  author_url?: string
}

interface ApifyRunResponse {
  data: { status?: string; defaultDatasetId?: string }
}

interface TwitterItem {
  author?: { name?: string; userName?: string }
  user?: { name?: string }
  username?: string
  text?: string
  full_text?: string
  tweetText?: string
  createdAt?: string
  created_at?: string
  viewCount?: number
  views?: number
  likeCount?: number
  favoriteCount?: number
  likes?: number
  retweetCount?: number
  retweets?: number
  replyCount?: number
  replies?: number
}

interface TikTokItem {
  authorMeta?: { nickName?: string; name?: string; verified?: boolean }
  text?: string
  desc?: string
  createTimeISO?: string
  playCount?: number
  diggCount?: number
  shareCount?: number
  commentCount?: number
}

export interface SocialContent {
  success: boolean
  text: string
  title?: string
  author?: string
  publishDate?: string
  platform: 'twitter' | 'tiktok'
  engagement?: {
    views?: number
    likes?: number
    shares?: number
    comments?: number
  }
  error?: string
}

/**
 * Extract content from a Twitter/X URL.
 * Strategy: oEmbed first (instant, reliable for individual tweets),
 * then Apify tweet-scraper as fallback (better for search-based scraping).
 */
export async function fetchTwitterViaApify(url: string, apiKey: string): Promise<SocialContent> {
  if (isApifySupportedUrl(url) !== 'twitter') {
    return { success: false, text: '', platform: 'twitter', error: 'Unsupported Twitter URL' }
  }

  // 1. Try oEmbed first — fast and works for individual tweet URLs
  // Note: oEmbed requires twitter.com domain (x.com returns 404)
  try {
    const twitterUrl = url.replace('https://x.com/', 'https://twitter.com/')
    const oembedUrl = `https://publish.twitter.com/oembed?url=${encodeURIComponent(twitterUrl)}`
    const oembed = await safeFetchText(oembedUrl, {
      timeoutMs: 8_000,
      maxRedirects: 2,
      maxResponseBytes: 128 * 1024,
      allowedHostnames: ['publish.twitter.com'],
      allowedContentTypes: ['application/json'],
    })
    const oembedRes = oembed.response

    if (oembedRes.ok) {
      const data = JSON.parse(oembed.text) as TwitterOEmbed
      const html = data.html || ''

      // Extract text from the blockquote
      const pMatch = html.match(/<p[^>]*>([\s\S]*?)<\/p>/)
      if (pMatch && pMatch[1]) {
        const text = pMatch[1]
          .replace(/<br\s*\/?>/g, '\n')
          .replace(/<a[^>]*>([^<]+)<\/a>/g, '$1')
          .replace(/<[^>]+>/g, '')
          .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
          .trim()

        if (text.length > 10) {
          const authorName = data.author_name || 'Unknown'
          const authorUrl = data.author_url || ''
          const handle = authorUrl.match(/\/([^/]+)$/)?.[1] || authorName

          return {
            success: true,
            text: `${text}\n\n— @${handle} (${authorName})`,
            title: `Tweet by @${handle}: ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}`,
            author: `@${handle}`,
            platform: 'twitter',
          }
        }
      }
    }
  } catch (e) {
    console.error('[Twitter oEmbed] Failed:', e)
  }

  // 2. Fallback: Apify tweet-scraper (uses search, may not find specific tweets)
  try {
    const runRes = await fetch(`${APIFY_BASE}/acts/apidojo~tweet-scraper/runs?waitForFinish=60`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        startUrls: [{ url }],
        maxItems: 1,
      }),
    })

    if (!runRes.ok) {
      return { success: false, text: '', platform: 'twitter', error: `Apify returned ${runRes.status}` }
    }

    const runData = await runRes.json() as ApifyRunResponse
    const run = runData.data
    if (run.status !== 'SUCCEEDED') {
      return { success: false, text: '', platform: 'twitter', error: `Run status: ${run.status}` }
    }

    const datasetId = run.defaultDatasetId
    const itemsRes = await fetch(`${APIFY_BASE}/datasets/${datasetId}/items?limit=1&format=json`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    })

    if (!itemsRes.ok) {
      return { success: false, text: '', platform: 'twitter', error: 'Failed to fetch results' }
    }

    const items = await itemsRes.json() as TwitterItem[]
    if (items.length === 0) {
      return { success: false, text: '', platform: 'twitter', error: 'No results from scraper' }
    }

    const tweet = items[0]
    const authorName = tweet.author?.name || tweet.user?.name || tweet.username || 'Unknown'
    const authorHandle = tweet.author?.userName || tweet.username || authorName
    const text = tweet.text || tweet.full_text || tweet.tweetText || ''
    const createdAt = tweet.createdAt || tweet.created_at || ''

    if (!text) {
      return { success: false, text: '', platform: 'twitter', error: 'Tweet content empty' }
    }

    const engagement = {
      views: tweet.viewCount || tweet.views || 0,
      likes: tweet.likeCount || tweet.favoriteCount || tweet.likes || 0,
      shares: tweet.retweetCount || tweet.retweets || 0,
      comments: tweet.replyCount || tweet.replies || 0,
    }

    const engagementLine = `Views: ${engagement.views} | Likes: ${engagement.likes} | Retweets: ${engagement.shares} | Replies: ${engagement.comments}`
    const fullText = `${text}\n\n— @${authorHandle} (${authorName})\n${createdAt ? `Posted: ${createdAt}\n` : ''}${engagementLine}`

    return {
      success: true,
      text: fullText,
      title: `Tweet by @${authorHandle}: ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}`,
      author: `@${authorHandle}`,
      publishDate: createdAt,
      platform: 'twitter',
      engagement,
    }
  } catch (error) {
    console.error('[Apify Twitter] Error:', error)
    return { success: false, text: '', platform: 'twitter', error: 'Apify request failed' }
  }
}

/**
 * Extract content from a TikTok URL using Apify tiktok-scraper
 */
export async function fetchTikTokViaApify(url: string, apiKey: string): Promise<SocialContent> {
  if (isApifySupportedUrl(url) !== 'tiktok') {
    return { success: false, text: '', platform: 'tiktok', error: 'Unsupported TikTok URL' }
  }

  try {
    const runRes = await fetch(`${APIFY_BASE}/acts/clockworks~tiktok-scraper/runs?waitForFinish=60`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        postURLs: [url],
        resultsPerPage: 1,
        shouldDownloadVideos: false,
        shouldDownloadCovers: false,
      }),
    })

    if (!runRes.ok) {
      return { success: false, text: '', platform: 'tiktok', error: `Apify returned ${runRes.status}` }
    }

    const runData = await runRes.json() as ApifyRunResponse
    const run = runData.data
    if (run.status !== 'SUCCEEDED') {
      return { success: false, text: '', platform: 'tiktok', error: `Run status: ${run.status}` }
    }

    const datasetId = run.defaultDatasetId
    const itemsRes = await fetch(`${APIFY_BASE}/datasets/${datasetId}/items?limit=1&format=json`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    })

    if (!itemsRes.ok) {
      return { success: false, text: '', platform: 'tiktok', error: 'Failed to fetch results' }
    }

    const items = await itemsRes.json() as TikTokItem[]
    if (items.length === 0) {
      return { success: false, text: '', platform: 'tiktok', error: 'No results from scraper' }
    }

    const video = items[0]
    const authorName = video.authorMeta?.nickName || video.authorMeta?.name || 'Unknown'
    const authorHandle = video.authorMeta?.name || authorName
    const text = video.text || video.desc || ''
    const createdAt = video.createTimeISO || ''
    const verified = video.authorMeta?.verified ? ' ✓' : ''

    const engagement = {
      views: video.playCount || 0,
      likes: video.diggCount || 0,
      shares: video.shareCount || 0,
      comments: video.commentCount || 0,
    }

    const engagementLine = `Views: ${engagement.views} | Likes: ${engagement.likes} | Shares: ${engagement.shares} | Comments: ${engagement.comments}`
    const fullText = `${text}\n\n— @${authorHandle}${verified} (${authorName})\n${createdAt ? `Posted: ${createdAt}\n` : ''}${engagementLine}`

    return {
      success: true,
      text: fullText,
      title: `TikTok by @${authorHandle}: ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}`,
      author: `@${authorHandle}`,
      publishDate: createdAt,
      platform: 'tiktok',
      engagement,
    }
  } catch (error) {
    console.error('[Apify TikTok] Error:', error)
    return { success: false, text: '', platform: 'tiktok', error: 'Apify request failed' }
  }
}

/**
 * Detect if a URL is a social media post that Apify can extract
 */
export function isApifySupportedUrl(url: string): 'twitter' | 'tiktok' | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, '')
  const path = parsed.pathname.toLowerCase()
  const isTwitterHost = hostname === 'twitter.com' || hostname.endsWith('.twitter.com')
    || hostname === 'x.com' || hostname.endsWith('.x.com')
  const isTikTokHost = hostname === 'tiktok.com' || hostname.endsWith('.tiktok.com')

  if (isTwitterHost && /\/status\/\d+(?:\/|$)/.test(path)) {
    return 'twitter'
  }
  if (isTikTokHost && /\/video\/\d+(?:\/|$)/.test(path)) {
    return 'tiktok'
  }
  return null
}

/**
 * Try to extract social media content via Apify. Returns null if not applicable or fails.
 */
export async function fetchSocialViaApify(url: string, apiKey: string | undefined): Promise<SocialContent | null> {
  if (!apiKey) return null

  const platform = isApifySupportedUrl(url)
  if (!platform) return null

  if (platform === 'twitter') {
    const result = await fetchTwitterViaApify(url, apiKey)
    return result.success ? result : null
  }

  if (platform === 'tiktok') {
    const result = await fetchTikTokViaApify(url, apiKey)
    return result.success ? result : null
  }

  return null
}
