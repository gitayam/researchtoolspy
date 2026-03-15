/**
 * Apify Social Media Content Extraction
 *
 * Uses Apify actors to extract rich content from Twitter/X and TikTok URLs.
 * Falls back gracefully if APIFY_API_KEY is not configured.
 */

const APIFY_BASE = 'https://api.apify.com/v2'

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
  // 1. Try oEmbed first — fast and works for individual tweet URLs
  try {
    const oembedUrl = `https://publish.twitter.com/oembed?url=${encodeURIComponent(url)}`
    const oembedRes = await fetch(oembedUrl, { signal: AbortSignal.timeout(8000) })

    if (oembedRes.ok) {
      const data = await oembedRes.json() as any
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

    const runData = await runRes.json() as any
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

    const items = await itemsRes.json() as any[]
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

    const runData = await runRes.json() as any
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

    const items = await itemsRes.json() as any[]
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
  const lower = url.toLowerCase()
  if ((lower.includes('twitter.com') || lower.includes('x.com')) && /\/status\/\d+/.test(lower)) {
    return 'twitter'
  }
  if (lower.includes('tiktok.com') && /\/video\/\d+/.test(lower)) {
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
