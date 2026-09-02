/**
 * Social Media Content Extraction API
 *
 * Uses platform-specific extractors with multiple fallback methods
 *
 * Supported platforms:
 * - YouTube: yt-dlp API (metadata, transcripts, engagement)
 * - Instagram: Canonical post/reel/TV identity with manual-upload guidance
 * - Twitter/X: yt-dlp/nitter (tweets, threads, media)
 * - TikTok: yt-dlp API (videos, metadata)
 * - Facebook: yt-dlp API (videos, posts)
 */

import type { PagesFunction } from '@cloudflare/workers-types'

import { getUserFromRequest } from '../_shared/auth-helpers'
import { JSON_HEADERS } from '../_shared/api-utils'
import {
  parseCanonicalInstagramUrl,
  parseCanonicalYouTubeUrl,
  type CanonicalInstagramTarget,
  type CanonicalYouTubeTarget,
} from '../_shared/social-url'
import { createYouTubeProviderDeadline, fetchYouTubeProvider } from '../_shared/youtube-provider'

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

type YouTubeMode = NonNullable<SocialExtractRequest['extract_mode']>
const YOUTUBE_MODES: readonly YouTubeMode[] = ['metadata', 'full', 'download']
const INSTAGRAM_MODES: readonly YouTubeMode[] = ['metadata', 'full', 'download']

function validInstagramOptions(options: unknown): options is NonNullable<SocialExtractRequest['options']> {
  if (!options || typeof options !== 'object' || Array.isArray(options)) return false
  const candidate = options as Record<string, unknown>
  return ['include_comments', 'include_transcript', 'include_media']
    .every(key => candidate[key] === undefined || typeof candidate[key] === 'boolean')
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  try {
    const body = await request.json() as SocialExtractRequest
    const { url, platform, extract_mode = 'metadata', options = {} } = body
    const normalizedPlatform = platform?.toLowerCase() === 'x'
      ? 'twitter'
      : platform?.toLowerCase()
    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: JSON_HEADERS,
      })
    }

    if (!url || !platform) {
      return new Response(JSON.stringify({ error: 'URL and platform are required' }), {
        status: 400,
        headers: JSON_HEADERS
      })
    }

    const youtubeTarget = typeof url === 'string' ? parseCanonicalYouTubeUrl(url) : null
    const instagramTarget = typeof url === 'string' ? parseCanonicalInstagramUrl(url) : null
    if (youtubeTarget && normalizedPlatform !== 'youtube') {
      return new Response(JSON.stringify({ error: 'URL does not match the selected platform' }), {
        status: 400,
        headers: JSON_HEADERS,
      })
    }
    if (instagramTarget && normalizedPlatform !== 'instagram') {
      return new Response(JSON.stringify({ error: 'URL does not match the selected platform' }), {
        status: 400,
        headers: JSON_HEADERS,
      })
    }
    if (normalizedPlatform === 'youtube' && (!YOUTUBE_MODES.includes(extract_mode)
      || !options || typeof options !== 'object' || Array.isArray(options))) {
      return new Response(JSON.stringify({ error: 'Invalid extraction options' }), {
        status: 400,
        headers: JSON_HEADERS,
      })
    }
    if (normalizedPlatform === 'instagram' && (!INSTAGRAM_MODES.includes(extract_mode)
      || !validInstagramOptions(options))) {
      return new Response(JSON.stringify({ error: 'Invalid extraction options' }), {
        status: 400,
        headers: JSON_HEADERS,
      })
    }


    // Route to platform-specific extractor
    let extractionResult: any

    switch (normalizedPlatform) {
      case 'youtube':
        if (!youtubeTarget) {
          extractionResult = { success: false, error: 'Invalid YouTube URL' }
          break
        }
        extractionResult = await extractYouTube(youtubeTarget, extract_mode, options, request.signal)
        if (extractionResult === null) {
          return new Response(JSON.stringify({ error: 'Social media extraction failed' }), {
            status: 500,
            headers: JSON_HEADERS,
          })
        }
        break
      case 'instagram':
        if (!instagramTarget) {
          extractionResult = { success: false, error: 'Invalid Instagram URL' }
          break
        }
        if (request.signal.aborted) {
          return new Response(JSON.stringify({ error: 'Social media extraction failed' }), {
            status: 500,
            headers: JSON_HEADERS,
          })
        }
        extractionResult = extractInstagramUnavailable(instagramTarget)
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
          headers: JSON_HEADERS
        })
    }

    if ((youtubeTarget && normalizedPlatform === 'youtube'
      || instagramTarget && normalizedPlatform === 'instagram') && request.signal.aborted) {
      return new Response(JSON.stringify({ error: 'Social media extraction failed' }), {
        status: 500,
        headers: JSON_HEADERS,
      })
    }

    // YouTube and Instagram extraction are deliberately ephemeral; preserve legacy persistence for other platforms.
    if (extractionResult.success && normalizedPlatform !== 'youtube' && normalizedPlatform !== 'instagram') {
      await saveExtraction(env.DB, {
        url,
        platform: normalizedPlatform,
        extract_mode,
        metadata: extractionResult.metadata,
        content: extractionResult.content,
        media: extractionResult.media
      }, userId)
    }

    return new Response(JSON.stringify(extractionResult), {
      status: extractionResult.success ? 200 : 500,
      headers: JSON_HEADERS
    })

  } catch (error) {
    console.error('[Social Extract] Error:', error)
    return new Response(JSON.stringify({
      error: 'Social media extraction failed'

    }), {
      status: 500,
      headers: JSON_HEADERS
    })
  }
}

/**
 * YouTube extraction using yt-dlp compatible API
 */
async function extractYouTube(
  target: CanonicalYouTubeTarget,
  mode: YouTubeMode,
  options: NonNullable<SocialExtractRequest['options']>,
  signal: AbortSignal,
): Promise<Record<string, unknown> | null> {
  const includeTranscript = mode === 'full' && options.include_transcript === true
  const provider = await fetchYouTubeProvider(target, {
    includeTranscript,
    includeMedia: true,
    signal,
    deadline: createYouTubeProviderDeadline(30_000, signal),
  })
  if (!provider.success || !provider.metadata) {
    if (provider.failure?.code === 'aborted') return null
    return {
      success: false,
      error: 'YouTube extraction failed',
      platform: 'youtube',
    }
  }

  const { videoId, canonicalUrl } = target
  const oembedData = provider.metadata

  const metadata = {
    title: oembedData.title,
    author: oembedData.authorName,
    author_url: oembedData.authorUrl,
    post_url: canonicalUrl,
    thumbnail_url: oembedData.thumbnailUrl,
    thumbnail_width: oembedData.thumbnailWidth,
    thumbnail_height: oembedData.thumbnailHeight,
    video_id: videoId,
    platform: 'youtube',
    post_type: 'video'
  }

  const transcript = includeTranscript ? provider.transcript : undefined

  const downloadOptions = {
    download_helpers: provider.mediaFallback === 'watch_on_youtube'
      ? [{ name: 'Watch on YouTube', url: canonicalUrl, description: 'Open the canonical video on YouTube' }]
      : [],
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
      thumbnail_url: oembedData.thumbnailUrl,
      video_url: canonicalUrl,
      embed_url: `https://www.youtube.com/embed/${videoId}`,
      stream_url: `https://www.youtube.com/embed/${videoId}`,
      download_options: downloadOptions.download_helpers,
      thumbnail_options: downloadOptions.thumbnail_urls
    },
    extraction_note: mode === 'metadata' ?
      'Metadata only. Use "full" mode with include_transcript:true for transcript extraction.' :
      transcript ? `Full extraction complete with ${transcript.split(/\s+/).length} word transcript` : 'Full extraction complete (transcript unavailable)'
  }
}

function extractInstagramUnavailable(target: CanonicalInstagramTarget): Record<string, unknown> {
  const postType = target.kind === 'reel' ? 'reel' : target.kind === 'tv' ? 'igtv' : 'post'
  return {
    success: false,
    error: 'Instagram extraction is unavailable. Download the post manually and upload it to Content Research.',
    platform: 'instagram',
    post_type: postType,
    metadata: {
      shortcode: target.shortcode,
      post_url: target.canonicalUrl,
      direct_link: target.canonicalUrl,
      platform: 'instagram',
      post_type: postType,
    },
    attempts: 0,
    errors: [],
    suggestions: [
      'Download manually from the canonical Instagram post.',
      'Upload the downloaded media to Content Research.',
    ],
  }
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
        },
        signal: AbortSignal.timeout(15000),
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
      error: 'Twitter extraction failed',
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
      error: 'TikTok extraction failed',
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
      error: 'Facebook extraction failed',
      platform: 'facebook'
    }
  }
}

/**
 * Save extraction to database for caching
 */
async function saveExtraction(db: D1Database, data: any, userId: number): Promise<void> {
  try {
    const content = data.content || {}
    const metadata = {
      ...(data.metadata || {}),
      content,
    }
    const transcript = typeof content.transcript === 'string'
      ? content.transcript
      : (typeof content.text === 'string' ? content.text : null)

    await db.prepare(`
      INSERT INTO social_media_extractions (
        user_id, url, platform, post_type, media_urls,
        metadata, transcript, extraction_mode
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      userId,
      data.url,
      data.platform,
      data.metadata?.post_type || 'unknown',
      JSON.stringify(data.media || {}),
      JSON.stringify(metadata),
      transcript,
      data.extract_mode || 'metadata'
    ).run()
  } catch (error) {
    console.error('[Social Extract] Failed to save extraction:', error)
    // Don't throw - extraction succeeded even if save failed
  }
}

// Reject GET requests (POST-only endpoint)
export const onRequestGet: PagesFunction = async () => {
  return new Response(JSON.stringify({ error: 'Method not allowed. Use POST.' }), {
    status: 405, headers: JSON_HEADERS,
  })
}
