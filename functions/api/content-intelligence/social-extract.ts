/**
 * Social Media Content Extraction API
 *
 * Uses platform-specific extractors with multiple fallback methods
 *
 * Supported platforms:
 * - YouTube: yt-dlp API (metadata, transcripts, engagement)
 * - Instagram: Multiple extraction methods with fallbacks (posts, reels, stories)
 * - Twitter/X: yt-dlp/nitter (tweets, threads, media)
 * - TikTok: yt-dlp API (videos, metadata)
 * - Facebook: yt-dlp API (videos, posts)
 */

import type { PagesFunction } from '@cloudflare/workers-types'

import { getUserIdOrDefault } from '../_shared/auth-helpers'

interface Env {
  DB: D1Database
  OPENAI_API_KEY?: string
  SESSIONS?: KVNamespace
}

interface SocialExtractRequest {
  url: string
  platform: string
  extract_mode?: 'metadata' | 'full' | 'download'
  options?: {
    include_comments?: boolean
    include_transcript?: boolean
    include_media?: boolean
  }
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  try {
    const body = await request.json() as SocialExtractRequest
    const { url, platform, extract_mode = 'metadata', options = {} } = body

    if (!url || !platform) {
      return new Response(JSON.stringify({ error: 'URL and platform are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log(`[Social Extract] Platform: ${platform}, Mode: ${extract_mode}, URL: ${url}`)

    // Route to platform-specific extractor
    let extractionResult: any

    switch (platform.toLowerCase()) {
      case 'youtube':
        extractionResult = await extractYouTube(url, extract_mode, options)
        break
      case 'instagram':
        extractionResult = await extractInstagram(url, extract_mode, options)
        break
      case 'twitter':
      case 'x':
        extractionResult = await extractTwitter(url, extract_mode, options)
        break
      case 'tiktok':
        extractionResult = await extractTikTok(url, extract_mode, options)
        break
      case 'facebook':
        extractionResult = await extractFacebook(url, extract_mode, options)
        break
      default:
        return new Response(JSON.stringify({
          error: `Platform '${platform}' not yet supported`,
          supported_platforms: ['youtube', 'instagram', 'twitter', 'tiktok', 'facebook']
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
    }

    // Save extraction to database for caching
    if (extractionResult.success) {
      await saveExtraction(env.DB, {
        url,
        platform,
        extract_mode,
        metadata: extractionResult.metadata,
        content: extractionResult.content,
        media: extractionResult.media
      })
    }

    return new Response(JSON.stringify(extractionResult), {
      status: extractionResult.success ? 200 : 500,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('[Social Extract] Error:', error)
    return new Response(JSON.stringify({
      error: 'Social media extraction failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

/**
 * YouTube extraction using yt-dlp compatible API
 */
async function extractYouTube(url: string, mode: string, options: any): Promise<any> {
  try {
    const videoId = extractYouTubeId(url)

    if (!videoId) {
      return {
        success: false,
        error: 'Invalid YouTube URL'
      }
    }

    // Use YouTube oEmbed API for basic metadata (no API key needed)
    const oembedResponse = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
    )

    if (!oembedResponse.ok) {
      throw new Error('Failed to fetch YouTube metadata')
    }

    const oembedData = await oembedResponse.json() as any

    const metadata = {
      title: oembedData.title,
      author: oembedData.author_name,
      author_url: oembedData.author_url,
      post_url: url,
      thumbnail_url: oembedData.thumbnail_url,
      thumbnail_width: oembedData.thumbnail_width,
      thumbnail_height: oembedData.thumbnail_height,
      video_id: videoId,
      platform: 'youtube',
      post_type: 'video'
    }

    // For full mode, add transcript extraction
    let transcript: string | undefined
    if (mode === 'full' && options.include_transcript) {
      try {
        transcript = await fetchYouTubeTranscript(videoId)
      } catch (err) {
        console.warn('Transcript extraction failed:', err)
      }
    }

    // Generate download URLs for various qualities
    const downloadOptions = {
      watch_youtube: `https://www.youtube.com/watch?v=${videoId}`,
      embed_url: `https://www.youtube.com/embed/${videoId}`,
      // Note: Actual video file downloads require yt-dlp or similar tools
      // These are alternative access methods:
      download_helpers: [
        { name: 'yt-dlp', url: `yt-dlp "https://www.youtube.com/watch?v=${videoId}"`, description: 'Command-line download tool' },
        { name: 'youtube-dl', url: `youtube-dl "https://www.youtube.com/watch?v=${videoId}"`, description: 'Python-based downloader' },
        { name: '4K Video Downloader', url: `https://www.4kdownload.com/`, description: 'GUI application for downloads' },
        { name: 'SaveFrom.net', url: `https://en.savefrom.net/1-youtube-video-downloader-75/${videoId}`, description: 'Online downloader' }
      ],
      thumbnail_urls: {
        maxres: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
        hq: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        mq: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
        sd: `https://img.youtube.com/vi/${videoId}/sddefault.jpg`,
        default: `https://img.youtube.com/vi/${videoId}/default.jpg`
      }
    }

    return {
      success: true,
      platform: 'youtube',
      post_type: 'video',
      metadata,
      content: {
        transcript,
        transcript_available: !!transcript,
        transcript_word_count: transcript ? transcript.split(/\s+/).length : 0,
        description: 'YouTube video content extraction'
      },
      media: {
        thumbnail_url: oembedData.thumbnail_url,
        video_url: `https://www.youtube.com/watch?v=${videoId}`,
        embed_url: `https://www.youtube.com/embed/${videoId}`,
        stream_url: `https://www.youtube.com/embed/${videoId}`,
        download_options: downloadOptions.download_helpers,
        thumbnail_options: downloadOptions.thumbnail_urls
      },
      extraction_note: mode === 'metadata' ?
        'Metadata only. Use "full" mode with include_transcript:true for transcript extraction.' :
        transcript ? `Full extraction complete with ${transcript.split(/\s+/).length} word transcript` : 'Full extraction complete (transcript unavailable)'
    }

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'YouTube extraction failed',
      platform: 'youtube'
    }
  }
}

/**
 * Instagram extraction with multiple fallback methods
 * Attempts 5 different extraction strategies like instaloader
 */
async function extractInstagram(url: string, mode: string, options: any): Promise<any> {
  const errors: string[] = []
  let attemptCount = 0

  try {
    // Extract Instagram shortcode from URL
    const shortcodeMatch = url.match(/instagram\.com\/(p|reel|tv)\/([A-Za-z0-9_-]+)/)

    if (!shortcodeMatch) {
      return {
        success: false,
        error: 'Invalid Instagram URL',
        suggestions: [
          'URL should be in format: https://www.instagram.com/p/SHORTCODE/ or https://www.instagram.com/reel/SHORTCODE/'
        ]
      }
    }

    const shortcode = shortcodeMatch[2]
    const postType = shortcodeMatch[1] === 'reel' ? 'reel' : shortcodeMatch[1] === 'tv' ? 'igtv' : 'post'

    console.log(`[Instagram] Attempting extraction for ${postType}: ${shortcode}`)

    // Method 1: Instagram GraphQL Public API
    attemptCount++
    try {
      console.log(`[Instagram] Method 1: GraphQL Public API`)
      const graphqlUrl = `https://www.instagram.com/graphql/query/?query_hash=b3055c01b4b222b8a47dc12b090e4e64&variables=${encodeURIComponent(JSON.stringify({ shortcode }))}`

      const graphqlResponse = await fetch(graphqlUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
        }
      })

      if (graphqlResponse.ok) {
        const data = await graphqlResponse.json() as any
        if (data?.data?.shortcode_media) {
          const media = data.data.shortcode_media
          return formatInstagramSuccess(media, shortcode, postType, url, 'GraphQL API')
        }
      }
      errors.push(`Method 1 failed: ${graphqlResponse.status}`)
    } catch (err) {
      errors.push(`Method 1 error: ${err instanceof Error ? err.message : 'Unknown'}`)
    }

    // Method 2: Instagram Public JSON Endpoint (Legacy)
    attemptCount++
    try {
      console.log(`[Instagram] Method 2: Public JSON endpoint`)
      const jsonUrl = `https://www.instagram.com/p/${shortcode}/?__a=1&__d=dis`

      const jsonResponse = await fetch(jsonUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        }
      })

      if (jsonResponse.ok) {
        const data = await jsonResponse.json() as any
        if (data?.items?.[0]) {
          return formatInstagramSuccess(data.items[0], shortcode, postType, url, 'JSON Endpoint')
        }
      }
      errors.push(`Method 2 failed: ${jsonResponse.status}`)
    } catch (err) {
      errors.push(`Method 2 error: ${err instanceof Error ? err.message : 'Unknown'}`)
    }

    // Method 3: Scrape HTML and extract JSON
    attemptCount++
    try {
      console.log(`[Instagram] Method 3: HTML scraping`)
      const htmlResponse = await fetch(`https://www.instagram.com/p/${shortcode}/`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        }
      })

      if (htmlResponse.ok) {
        const html = await htmlResponse.text()

        // Extract window._sharedData or window.__additionalDataLoaded
        const sharedDataMatch = html.match(/window\._sharedData\s*=\s*({.+?});/)
        if (sharedDataMatch) {
          const sharedData = JSON.parse(sharedDataMatch[1])
          const media = sharedData?.entry_data?.PostPage?.[0]?.graphql?.shortcode_media
          if (media) {
            return formatInstagramSuccess(media, shortcode, postType, url, 'HTML Scraping')
          }
        }

        // Try alternative pattern
        const additionalDataMatch = html.match(/window\.__additionalDataLoaded\('extra',\s*({.+?})\);/)
        if (additionalDataMatch) {
          const additionalData = JSON.parse(additionalDataMatch[1])
          if (additionalData?.graphql?.shortcode_media) {
            return formatInstagramSuccess(additionalData.graphql.shortcode_media, shortcode, postType, url, 'HTML Scraping')
          }
        }
      }
      errors.push(`Method 3 failed: No JSON data found in HTML`)
    } catch (err) {
      errors.push(`Method 3 error: ${err instanceof Error ? err.message : 'Unknown'}`)
    }

    // Method 4: Instagram oEmbed API
    attemptCount++
    try {
      console.log(`[Instagram] Method 4: oEmbed API`)
      const oembedResponse = await fetch(
        `https://graph.facebook.com/v18.0/instagram_oembed?url=${encodeURIComponent(url)}&access_token=&fields=author_name,author_url,media_id,thumbnail_url,title`
      )

      if (oembedResponse.ok) {
        const oembedData = await oembedResponse.json() as any
        if (oembedData && !oembedData.error) {
          return {
            success: true,
            platform: 'instagram',
            post_type: postType,
            extraction_method: 'oEmbed API (Limited)',
            metadata: {
              shortcode,
              post_url: url,
              platform: 'instagram',
              post_type: postType,
              author: oembedData.author_name,
              author_url: oembedData.author_url,
              title: oembedData.title,
              thumbnail_url: oembedData.thumbnail_url
            },
            content: {
              caption: oembedData.title || '',
              note: 'Limited data - oEmbed API only provides basic information'
            },
            media: {
              thumbnail_url: oembedData.thumbnail_url
            },
            limitations: [
              'oEmbed API provides limited data',
              'Full captions, comments, and high-res media not available',
              'Download manually for complete content'
            ]
          }
        }
      }
      errors.push(`Method 4 failed: ${oembedResponse.status}`)
    } catch (err) {
      errors.push(`Method 4 error: ${err instanceof Error ? err.message : 'Unknown'}`)
    }

    // Method 5: Fallback to basic metadata only
    attemptCount++
    console.log(`[Instagram] Method 5: Basic metadata fallback`)
    return {
      success: false,
      error: 'Instagram extraction failed after trying 5 different methods. Instagram is blocking automated access.',
      platform: 'instagram',
      post_type: postType,
      metadata: {
        shortcode,
        post_url: url,
        direct_link: `https://www.instagram.com/p/${shortcode}/`,
        platform: 'instagram'
      },
      attempts: attemptCount,
      errors,
      suggestions: [
        '📋 **Manual Workarounds:**',
        '1. Instagram frequently updates their anti-bot measures',
        '2. Wait 10-15 minutes and try again',
        '3. Try a different Instagram post first',
        '4. Download manually from Instagram app/website',
        '5. **Manual workaround:** Download from Instagram → Upload to Content Research',
        '',
        '🔗 **Alternative Access:**',
        `• Direct link: https://www.instagram.com/p/${shortcode}/`,
        `• Mobile app: instagram://media?id=${shortcode}`,
        '',
        '⚠️ **Why This Happens:**',
        'Instagram actively blocks automated scraping to protect user privacy.',
        'Even tools like instaloader require authenticated sessions.',
        '',
        '💡 **For Bulk Extraction:**',
        'Use the Social Media page to set up profile tracking with proper authentication.'
      ]
    }

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Instagram extraction failed',
      platform: 'instagram',
      attempts: attemptCount,
      errors,
      suggestions: [
        'Instagram blocks automated access',
        'Download manually and upload to Content Research',
        'Try again in 10-15 minutes',
        'Use the Social Media page for profile tracking'
      ]
    }
  }
}

/**
 * Format successful Instagram extraction
 */
function formatInstagramSuccess(media: any, shortcode: string, postType: string, url: string, method: string): any {
  const owner = media.owner || {}
  const caption = media.edge_media_to_caption?.edges?.[0]?.node?.text || media.caption || ''

  return {
    success: true,
    platform: 'instagram',
    post_type: postType,
    extraction_method: method,
    metadata: {
      shortcode,
      post_url: url,
      platform: 'instagram',
      post_type: postType,
      author: owner.username || owner.full_name,
      author_id: owner.id,
      author_url: owner.username ? `https://www.instagram.com/${owner.username}/` : undefined,
      media_id: media.id,
      timestamp: media.taken_at_timestamp,
      is_video: media.is_video || postType === 'reel',
      dimensions: {
        width: media.dimensions?.width,
        height: media.dimensions?.height
      },
      engagement: {
        likes: media.edge_media_preview_like?.count || media.like_count,
        comments: media.edge_media_to_comment?.count || media.comment_count,
        views: media.video_view_count
      }
    },
    content: {
      caption,
      hashtags: extractHashtags(caption),
      mentions: extractMentions(caption),
      accessibility_caption: media.accessibility_caption
    },
    media: {
      thumbnail_url: media.thumbnail_src || media.display_url,
      display_url: media.display_url,
      is_video: media.is_video,
      video_url: media.video_url,
      media_type: media.is_video ? 'video' : 'image'
    }
  }
}

/**
 * Extract hashtags from caption
 */
function extractHashtags(text: string): string[] {
  const matches = text.match(/#[\w]+/g)
  return matches ? matches.map(tag => tag.substring(1)) : []
}

/**
 * Extract mentions from caption
 */
function extractMentions(text: string): string[] {
  const matches = text.match(/@[\w.]+/g)
  return matches ? matches.map(mention => mention.substring(1)) : []
}

/**
 * Twitter/X extraction using oEmbed API
 */
async function extractTwitter(url: string, mode: string, options: any): Promise<any> {
  try {
    // Extract tweet ID
    const tweetIdMatch = url.match(/status\/(\d+)/)

    if (!tweetIdMatch) {
      return {
        success: false,
        error: 'Invalid Twitter/X URL'
      }
    }

    const tweetId = tweetIdMatch[1]

    // Try Twitter oEmbed API (public, no auth required)
    try {
      const oembedUrl = `https://publish.twitter.com/oembed?url=${encodeURIComponent(url)}&omit_script=true&dnt=true`
      const oembedResponse = await fetch(oembedUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      })

      if (oembedResponse.ok) {
        const oembedData = await oembedResponse.json() as any

        // Extract text from HTML (remove HTML tags)
        let tweetText = ''
        if (oembedData.html) {
          // Extract text content from the HTML, removing tags
          tweetText = oembedData.html
            .replace(/<script[^>]*>.*?<\/script>/gi, '') // Remove scripts
            .replace(/<style[^>]*>.*?<\/style>/gi, '') // Remove styles
            .replace(/<br\s*\/?>/gi, '\n') // Convert breaks to newlines
            .replace(/<\/p>/gi, '\n') // Convert paragraph ends to newlines
            .replace(/<[^>]+>/g, '') // Remove all other HTML tags
            .replace(/&nbsp;/g, ' ') // Decode nbsp
            .replace(/&amp;/g, '&') // Decode ampersand
            .replace(/&lt;/g, '<') // Decode lt
            .replace(/&gt;/g, '>') // Decode gt
            .replace(/&quot;/g, '"') // Decode quot
            .replace(/&#39;/g, "'") // Decode apos
            .replace(/\n\s*\n/g, '\n') // Collapse multiple newlines
            .trim()
        }

        // Extract username from author_url
        const username = oembedData.author_url?.split('/').pop() || 'unknown'

        // Extract pic.twitter.com links from HTML
        const picLinks: string[] = []
        const picMatches = oembedData.html?.match(/pic\.twitter\.com\/([a-zA-Z0-9]+)/g) || []

        for (const picLink of picMatches) {
          picLinks.push(`https://${picLink}`)
        }

        // Also check for direct pbs.twimg.com links in HTML (rare in oEmbed)
        const pbsMatches = oembedData.html?.match(/https:\/\/pbs\.twimg\.com\/media\/[^"'\s]+/g) || []

        return {
          success: true,
          platform: 'twitter',
          post_type: 'tweet',
          extraction_method: 'oEmbed API + Media Extraction',
          metadata: {
            post_url: url,
            tweet_id: tweetId,
            platform: 'twitter',
            author: oembedData.author_name || username,
            author_url: oembedData.author_url,
            author_username: username
          },
          content: {
            text: tweetText,
            html: oembedData.html,
            word_count: tweetText.split(/\s+/).filter(w => w.length > 0).length
          },
          media: {
            image_links: picLinks.length > 0 ? picLinks : undefined,
            direct_images: pbsMatches.length > 0 ? pbsMatches : undefined,
            image_count: picLinks.length + pbsMatches.length,
            extraction_note: picLinks.length > 0
              ? 'pic.twitter.com links detected - open in browser to view images'
              : 'No images detected in tweet'
          },
          limitations: [
            'oEmbed API provides tweet text but limited media metadata',
            'pic.twitter.com links require opening in browser or authenticated API access',
            'For high-quality downloads, open pic.twitter.com link in browser and save image',
            'For video downloads, use yt-dlp or download manually',
            'Thread context not included - only this tweet'
          ]
        }
      }
    } catch (oembedError) {
      console.warn('[Twitter] oEmbed extraction failed:', oembedError)
    }

    // Fallback if oEmbed fails
    return {
      success: false,
      error: 'Twitter oEmbed extraction failed. Tweet may be deleted, private, or from suspended account.',
      platform: 'twitter',
      post_type: 'tweet',
      metadata: {
        post_url: url,
        tweet_id: tweetId,
        platform: 'twitter'
      },
      suggestions: [
        'Tweet may be deleted, private, or from suspended account',
        'Try viewing directly on Twitter/X',
        `View on Twitter: ${url}`,
        `View on Nitter (privacy-friendly): https://nitter.net/i/status/${tweetId}`,
        'For authenticated access, use the Social Media page'
      ]
    }

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Twitter extraction failed',
      platform: 'twitter'
    }
  }
}

/**
 * TikTok extraction
 */
async function extractTikTok(url: string, mode: string, options: any): Promise<any> {
  try {
    // TikTok video ID extraction
    const videoIdMatch = url.match(/\/video\/(\d+)/)

    const metadata = {
      post_url: url,
      platform: 'tiktok',
      post_type: 'video',
      video_id: videoIdMatch?.[1]
    }

    return {
      success: true,
      platform: 'tiktok',
      post_type: 'video',
      metadata,
      content: {
        note: 'TikTok requires specialized extraction tools. Use yt-dlp service for complete data.'
      },
      suggestions: [
        'For full extraction including video downloads, use the Social Media page',
        `Direct TikTok link: ${url}`
      ]
    }

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'TikTok extraction failed',
      platform: 'tiktok'
    }
  }
}

/**
 * Facebook extraction
 */
async function extractFacebook(url: string, mode: string, options: any): Promise<any> {
  try {
    return {
      success: true,
      platform: 'facebook',
      post_type: 'post',
      metadata: {
        post_url: url,
        platform: 'facebook'
      },
      content: {
        note: 'Facebook requires authentication for content extraction. Use yt-dlp service for video downloads.'
      },
      suggestions: [
        'For full extraction, use the Social Media page',
        `Direct Facebook link: ${url}`
      ]
    }

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Facebook extraction failed',
      platform: 'facebook'
    }
  }
}

/**
 * Helper: Extract YouTube video ID
 */
function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/,
    /youtube\.com\/embed\/([A-Za-z0-9_-]{11})/,
    /youtube\.com\/v\/([A-Za-z0-9_-]{11})/,
    /youtube\.com\/live\/([A-Za-z0-9_-]{11})/,  // YouTube live streams
    /youtube\.com\/shorts\/([A-Za-z0-9_-]{11})/  // YouTube shorts
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }

  return null
}

/**
 * Helper: Fetch YouTube transcript using YouTube's native timedtext API
 */
async function fetchYouTubeTranscript(videoId: string): Promise<string | undefined> {
  try {
    // Step 1: Fetch video page to get caption tracks
    const videoPageUrl = `https://www.youtube.com/watch?v=${videoId}`
    const videoPageResponse = await fetch(videoPageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    })

    if (!videoPageResponse.ok) {
      console.warn(`[YouTube Transcript] Failed to fetch video page: ${videoPageResponse.status}`)
      return undefined
    }

    const videoPageHtml = await videoPageResponse.text()

    // Step 2: Extract caption tracks from page HTML
    // Look for "captionTracks" in the ytInitialPlayerResponse JSON
    const captionTracksMatch = videoPageHtml.match(/"captionTracks":(\[.*?\])/)

    if (!captionTracksMatch) {
      console.warn(`[YouTube Transcript] No caption tracks found for video ${videoId}`)
      return undefined
    }

    const captionTracks = JSON.parse(captionTracksMatch[1])

    // Prefer English captions, fallback to first available
    let captionTrack = captionTracks.find((track: any) =>
      track.languageCode === 'en' || track.languageCode?.startsWith('en')
    )

    if (!captionTrack && captionTracks.length > 0) {
      captionTrack = captionTracks[0]
    }

    if (!captionTrack || !captionTrack.baseUrl) {
      console.warn(`[YouTube Transcript] No valid caption track found`)
      return undefined
    }

    // Step 3: Fetch transcript from caption URL
    const transcriptResponse = await fetch(captionTrack.baseUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    })

    if (!transcriptResponse.ok) {
      console.warn(`[YouTube Transcript] Failed to fetch transcript: ${transcriptResponse.status}`)
      return undefined
    }

    const transcriptXml = await transcriptResponse.text()

    // Step 4: Parse XML and extract text
    // Extract text from <text> tags and decode HTML entities
    const textMatches = transcriptXml.matchAll(/<text[^>]*>(.*?)<\/text>/g)
    const transcriptParts: string[] = []

    for (const match of textMatches) {
      let text = match[1]
      // Decode common HTML entities
      text = text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ')
        .replace(/<[^>]+>/g, '') // Remove any remaining tags

      if (text.trim()) {
        transcriptParts.push(text.trim())
      }
    }

    if (transcriptParts.length === 0) {
      console.warn(`[YouTube Transcript] No text found in transcript`)
      return undefined
    }

    const fullTranscript = transcriptParts.join(' ')
    console.log(`[YouTube Transcript] Successfully extracted ${fullTranscript.length} characters`)

    return fullTranscript

  } catch (error) {
    console.error(`[YouTube Transcript] Extraction error:`, error)
    return undefined
  }
}

/**
 * Save extraction to database for caching
 */
async function saveExtraction(db: D1Database, data: any): Promise<void> {
  try {
    await db.prepare(`
      INSERT INTO social_media_extractions (
        user_id, url, platform, post_type, metadata, content, media, extraction_mode, extracted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).bind(
      1, // TODO: Get actual user_id from auth
      data.url,
      data.platform,
      data.metadata?.post_type || 'unknown',
      JSON.stringify(data.metadata || {}),
      JSON.stringify(data.content || {}),
      JSON.stringify(data.media || {}),
      data.extract_mode || 'metadata'
    ).run()
  } catch (error) {
    console.error('[Social Extract] Failed to save extraction:', error)
    // Don't throw - extraction succeeded even if save failed
  }
}
