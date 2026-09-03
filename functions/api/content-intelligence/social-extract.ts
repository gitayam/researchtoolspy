/**
 * Social Media Content Extraction API
 *
 * Uses platform-specific extractors with multiple fallback methods
 *
 * Supported platforms:
 * - YouTube: yt-dlp API (metadata, transcripts, engagement)
 * - Instagram: Canonical post/reel/TV identity with manual-upload guidance
 * - Twitter/X: Bounded first-party oEmbed metadata and canonical status links
 * - TikTok: Bounded first-party oEmbed metadata and canonical player links
 * - Facebook: Canonical public post/reel identity with manual-open guidance
 */

import type { PagesFunction } from '@cloudflare/workers-types'

import { getUserFromRequest } from '../_shared/auth-helpers'
import { JSON_HEADERS } from '../_shared/api-utils'
import {
  parseCanonicalFacebookUrl,
  parseCanonicalInstagramUrl,
  parseCanonicalTikTokUrl,
  parseCanonicalTwitterUrl,
  parseCanonicalYouTubeUrl,
  type CanonicalFacebookTarget,
  type CanonicalInstagramTarget,
  type CanonicalTikTokTarget,
  type CanonicalTwitterTarget,
  type CanonicalYouTubeTarget,
} from '../_shared/social-url'
import { fetchTikTokProvider } from '../_shared/tiktok-provider'
import { fetchTwitterProvider } from '../_shared/twitter-provider'
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
const TWITTER_MODES: readonly YouTubeMode[] = ['metadata', 'full', 'download']
const TIKTOK_MODES: readonly YouTubeMode[] = ['metadata', 'full', 'download']
const FACEBOOK_MODES: readonly YouTubeMode[] = ['metadata', 'full', 'download']
const SOCIAL_OPTION_KEYS = new Set(['include_comments', 'include_transcript', 'include_media'])

function validSocialOptions(options: unknown): options is NonNullable<SocialExtractRequest['options']> {
  if (!options || typeof options !== 'object' || Array.isArray(options)) return false
  const candidate = options as Record<string, unknown>
  return Object.keys(candidate).every(key => SOCIAL_OPTION_KEYS.has(key)
    && typeof candidate[key] === 'boolean')
}

function invalidInstagramResult(): Record<string, unknown> {
  return {
    success: false,
    error: 'Invalid Instagram URL',
    suggestions: [
      'URL should be in format: https://www.instagram.com/p/SHORTCODE/ or https://www.instagram.com/reel/SHORTCODE/',
    ],
  }
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
    const twitterTarget = typeof url === 'string' ? parseCanonicalTwitterUrl(url) : null
    const tiktokTarget = typeof url === 'string' ? parseCanonicalTikTokUrl(url) : null
    const facebookTarget = typeof url === 'string' ? parseCanonicalFacebookUrl(url) : null
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
    if (twitterTarget && normalizedPlatform !== 'twitter') {
      return new Response(JSON.stringify({ error: 'URL does not match the selected platform' }), {
        status: 400,
        headers: JSON_HEADERS,
      })
    }
    if (tiktokTarget && normalizedPlatform !== 'tiktok') {
      return new Response(JSON.stringify({ error: 'URL does not match the selected platform' }), {
        status: 400,
        headers: JSON_HEADERS,
      })
    }
    if (facebookTarget && normalizedPlatform !== 'facebook') {
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
      || !validSocialOptions(options))) {
      return new Response(JSON.stringify({ error: 'Invalid extraction options' }), {
        status: 400,
        headers: JSON_HEADERS,
      })
    }
    if (normalizedPlatform === 'twitter' && (!TWITTER_MODES.includes(extract_mode)
      || !validSocialOptions(options))) {
      return new Response(JSON.stringify({ error: 'Invalid extraction options' }), {
        status: 400,
        headers: JSON_HEADERS,
      })
    }
    if (normalizedPlatform === 'tiktok' && (!TIKTOK_MODES.includes(extract_mode)
      || !validSocialOptions(options))) {
      return new Response(JSON.stringify({ error: 'Invalid extraction options' }), {
        status: 400,
        headers: JSON_HEADERS,
      })
    }
    if (normalizedPlatform === 'facebook' && (!FACEBOOK_MODES.includes(extract_mode)
      || !validSocialOptions(options))) {
      return new Response(JSON.stringify({ error: 'Invalid extraction options' }), {
        status: 400,
        headers: JSON_HEADERS,
      })
    }


    // Route to platform-specific extractor
    let extractionResult: Record<string, unknown>

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
          extractionResult = invalidInstagramResult()
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
        if (!twitterTarget) {
          extractionResult = { success: false, error: 'Invalid Twitter/X URL' }
          break
        }
        extractionResult = await extractTwitter(twitterTarget, request.signal)
        if (extractionResult === null) {
          return new Response(JSON.stringify({ error: 'Social media extraction failed' }), {
            status: 500,
            headers: JSON_HEADERS,
          })
        }
        break
      case 'tiktok':
        if (!tiktokTarget) {
          extractionResult = { success: false, error: 'Invalid TikTok URL' }
          break
        }
        extractionResult = await extractTikTok(tiktokTarget, extract_mode, request.signal)
        if (extractionResult === null) {
          return new Response(JSON.stringify({ error: 'Social media extraction failed' }), {
            status: 500,
            headers: JSON_HEADERS,
          })
        }
        break
      case 'facebook':
        if (!facebookTarget) {
          extractionResult = { success: false, error: 'Invalid Facebook URL' }
          break
        }
        if (request.signal.aborted) {
          return new Response(JSON.stringify({ error: 'Social media extraction failed' }), {
            status: 500,
            headers: JSON_HEADERS,
          })
        }
        extractionResult = extractFacebookUnavailable(facebookTarget)
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
      || instagramTarget && normalizedPlatform === 'instagram'
      || twitterTarget && normalizedPlatform === 'twitter'
      || tiktokTarget && normalizedPlatform === 'tiktok'
      || facebookTarget && normalizedPlatform === 'facebook') && request.signal.aborted) {
      return new Response(JSON.stringify({ error: 'Social media extraction failed' }), {
        status: 500,
        headers: JSON_HEADERS,
      })
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

/** Twitter/X extraction through one bounded first-party oEmbed request. */
async function extractTwitter(
  target: CanonicalTwitterTarget,
  signal: AbortSignal,
): Promise<Record<string, unknown> | null> {
  const provider = await fetchTwitterProvider(target, { signal })
  if (!provider.success || !provider.metadata) {
    if (provider.failure?.code === 'aborted') return null
    return {
      success: false,
      error: 'Twitter/X extraction failed. The post may be deleted, protected, or unavailable.',
      platform: 'twitter',
      post_type: 'tweet',
      metadata: {
        post_url: target.canonicalUrl,
        tweet_id: target.tweetId,
        platform: 'twitter',
      },
      suggestions: [
        'The post may be deleted, protected, or unavailable.',
        `Open on X: ${target.canonicalUrl}`,
      ],
    }
  }
  return {
    success: true,
    platform: 'twitter',
    post_type: 'tweet',
    extraction_method: 'X oEmbed API',
    metadata: {
      post_url: target.canonicalUrl,
      tweet_id: target.tweetId,
      platform: 'twitter',
      author: provider.metadata.authorName,
      author_url: provider.metadata.authorUrl,
      author_username: target.username,
    },
    content: {
      text: provider.metadata.text,
      word_count: provider.metadata.text.split(/\s+/).filter(word => word.length > 0).length,
    },
    media: {
      image_count: 0,
      extraction_note: 'Direct media is not returned by the public X oEmbed API. Open the canonical post to view or download media.',
    },
    limitations: [
      'Public oEmbed provides bounded post text and author metadata, not direct media URLs.',
      'Thread context is not included.',
    ],
  }
}

/**
 * TikTok extraction
 */
async function extractTikTok(
  target: CanonicalTikTokTarget,
  mode: YouTubeMode,
  signal: AbortSignal,
): Promise<Record<string, unknown> | null> {
  const provider = await fetchTikTokProvider(target, { signal })
  if (!provider.success || !provider.metadata) {
    if (provider.failure?.code === 'aborted') return null
    return {
      success: false,
      error: 'TikTok extraction failed. The video may be private, deleted, or unavailable.',
      platform: 'tiktok',
      post_type: 'video',
      metadata: {
        post_url: target.canonicalUrl,
        video_id: target.videoId,
        platform: 'tiktok',
      },
      suggestions: [`Open on TikTok: ${target.canonicalUrl}`],
    }
  }
  const includeMediaAction = mode === 'full' || mode === 'download'
  return {
    success: true,
    platform: 'tiktok',
    post_type: 'video',
    extraction_method: 'TikTok oEmbed API',
    metadata: {
      post_url: target.canonicalUrl,
      video_id: target.videoId,
      platform: 'tiktok',
      author: provider.metadata.authorName,
      author_url: provider.metadata.authorUrl,
      author_username: target.username,
    },
    content: {
      text: provider.metadata.description,
      word_count: provider.metadata.description.split(/\s+/).filter(word => word.length > 0).length,
    },
    media: includeMediaAction ? {
      player_url: `https://www.tiktok.com/player/v1/${target.videoId}`,
      direct_media_available: false,
      extraction_note: 'Open the canonical TikTok post or first-party player to view media.',
    } : undefined,
    suggestions: [`Open on TikTok: ${target.canonicalUrl}`],
  }
}

/**
 * Facebook extraction
 */
function extractFacebookUnavailable(target: CanonicalFacebookTarget): Record<string, unknown> {
  return {
    success: false,
    error: 'Automatic Facebook extraction is unavailable. Open the public post on Facebook and capture the required content manually.',
    platform: 'facebook',
    post_type: target.kind,
    metadata: {
      content_id: target.contentId,
      owner: target.owner,
      post_url: target.canonicalUrl,
      direct_link: target.canonicalUrl,
      platform: 'facebook',
      post_type: target.kind,
    },
    attempts: 0,
    errors: [],
    suggestions: [
      'Open the canonical public Facebook post.',
      'Capture the required text or media, then upload it to Content Research.',
    ],
  }
}

// Reject GET requests (POST-only endpoint)
export const onRequestGet: PagesFunction = async () => {
  return new Response(JSON.stringify({ error: 'Method not allowed. Use POST.' }), {
    status: 405, headers: JSON_HEADERS,
  })
}
