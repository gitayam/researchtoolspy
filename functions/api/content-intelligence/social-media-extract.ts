/**
 * Social Media Extraction Endpoint
 *
 * Provides specialized extraction for social media platforms:
 * - YouTube: Video download URLs, transcripts, metadata
 * - Instagram: Canonical post identity and manual extraction guidance
 * - TikTok: Bounded first-party oEmbed metadata and canonical player links
 * - Twitter/X: Bounded first-party oEmbed metadata and canonical status links
 * - Bluesky: Bounded public AppView metadata and canonical post links
 */

import type { PagesFunction } from '@cloudflare/workers-types'

import { getUserFromRequest } from '../_shared/auth-helpers'
import { JSON_HEADERS } from '../_shared/api-utils'
import {
  parseCanonicalBlueskyUrl,
  parseCanonicalInstagramUrl,
  parseCanonicalTikTokUrl,
  parseCanonicalTwitterUrl,
  parseCanonicalYouTubeUrl,
  type CanonicalBlueskyTarget,
  type CanonicalInstagramTarget,
  type CanonicalTikTokTarget,
  type CanonicalTwitterTarget,
  type CanonicalYouTubeTarget,
} from '../_shared/social-url'
import { fetchBlueskyProvider } from '../_shared/bluesky-provider'
import { fetchTikTokProvider } from '../_shared/tiktok-provider'
import { fetchTwitterProvider } from '../_shared/twitter-provider'
import { createYouTubeProviderDeadline, fetchYouTubeProvider } from '../_shared/youtube-provider'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
}

interface SocialMediaExtractRequest {
  url: string
  platform?: string // Auto-detected if not provided
  mode?: 'metadata' | 'download' | 'stream' | 'transcript' | 'full'
}

interface MediaUrls {
  video?: string
  audio?: string
  thumbnail?: string
  images?: string[]
}

interface DownloadOption {
  quality: string
  format: string
  url: string
  size?: number
  hasAudio?: boolean
  hasVideo?: boolean
}

interface SocialMediaExtractionResult {
  success: boolean
  platform: string
  postType?: string
  mediaUrls?: MediaUrls
  downloadOptions?: DownloadOption[]
  streamUrl?: string
  embedCode?: string
  metadata?: Record<string, unknown>
  transcript?: string
  error?: string
}

type YouTubeMode = NonNullable<SocialMediaExtractRequest['mode']>
const EXTRACTION_MODES: readonly YouTubeMode[] = ['metadata', 'download', 'stream', 'transcript', 'full']
const TRANSCRIPT_FALLBACK = 'Transcript not available for this video. Try using YouTube\'s built-in transcript feature.'

/**
 * Create user-friendly error result
 */
function createUserFriendlyError(
  platform: string,
  technicalError: string,
  userMessage: string
): SocialMediaExtractionResult {
  return {
    success: false,
    platform,
    error: userMessage,
    metadata: {
      technicalDetails: 'Extraction failed',
      timestamp: new Date().toISOString()
    }
  }
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  const authUserId = await getUserFromRequest(request, env)
  if (!authUserId) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), {
      status: 401,
      headers: JSON_HEADERS,
    })
  }

  try {
    const body: SocialMediaExtractRequest = await request.json() as SocialMediaExtractRequest
    const { url, platform: providedPlatform, mode = 'full' } = body

    if (!url) {
      return new Response(JSON.stringify({
        success: false,
        error: 'URL is required'
      }), { status: 400, headers: JSON_HEADERS })
    }

    const youtubeTarget = typeof url === 'string' ? parseCanonicalYouTubeUrl(url) : null
    const youtubeHint = typeof providedPlatform === 'string' && providedPlatform.toLowerCase() === 'youtube'
    const malformedYouTubeAuthority = !providedPlatform && !youtubeTarget
      && typeof url === 'string' && hasExactRawYouTubeAuthority(url)
    const instagramTarget = typeof url === 'string' ? parseCanonicalInstagramUrl(url) : null
    const instagramHint = typeof providedPlatform === 'string' && providedPlatform.toLowerCase() === 'instagram'
    const malformedInstagramAuthority = !providedPlatform && !instagramTarget
      && typeof url === 'string' && hasExactRawInstagramAuthority(url)
    const twitterTarget = typeof url === 'string' ? parseCanonicalTwitterUrl(url) : null
    const twitterHint = typeof providedPlatform === 'string'
      && ['twitter', 'x'].includes(providedPlatform.toLowerCase())
    const malformedTwitterAuthority = !providedPlatform && !twitterTarget
      && typeof url === 'string' && hasExactRawTwitterAuthority(url)
    const tiktokTarget = typeof url === 'string' ? parseCanonicalTikTokUrl(url) : null
    const tiktokHint = typeof providedPlatform === 'string' && providedPlatform.toLowerCase() === 'tiktok'
    const malformedTikTokAuthority = !providedPlatform && !tiktokTarget
      && typeof url === 'string' && hasExactRawTikTokAuthority(url)
    const blueskyTarget = typeof url === 'string' ? parseCanonicalBlueskyUrl(url) : null
    const blueskyHint = typeof providedPlatform === 'string' && providedPlatform.toLowerCase() === 'bluesky'
    const malformedBlueskyAuthority = !providedPlatform && !blueskyTarget
      && typeof url === 'string' && hasExactRawBlueskyAuthority(url)

    if (youtubeTarget && providedPlatform && !youtubeHint) {
      const result = createUserFriendlyError('youtube', 'Platform mismatch', 'The selected platform does not match the YouTube URL.')
      return new Response(JSON.stringify(result), { status: 422, headers: JSON_HEADERS })
    }
    if (instagramTarget && providedPlatform && !instagramHint) {
      const result = createUserFriendlyError('instagram', 'Platform mismatch', 'The selected platform does not match the Instagram URL.')
      return new Response(JSON.stringify(result), { status: 422, headers: JSON_HEADERS })
    }
    if (twitterTarget && providedPlatform && !twitterHint) {
      const result = createUserFriendlyError('twitter', 'Platform mismatch', 'The selected platform does not match the Twitter/X URL.')
      return new Response(JSON.stringify(result), { status: 422, headers: JSON_HEADERS })
    }
    if (tiktokTarget && providedPlatform && !tiktokHint) {
      const result = createUserFriendlyError('tiktok', 'Platform mismatch', 'The selected platform does not match the TikTok URL.')
      return new Response(JSON.stringify(result), { status: 422, headers: JSON_HEADERS })
    }
    if (blueskyTarget && providedPlatform && !blueskyHint) {
      const result = createUserFriendlyError('bluesky', 'Platform mismatch', 'The selected platform does not match the Bluesky URL.')
      return new Response(JSON.stringify(result), { status: 422, headers: JSON_HEADERS })
    }
    if ((youtubeHint || malformedYouTubeAuthority) && !youtubeTarget) {
      const result = invalidYouTubeResult()
      return new Response(JSON.stringify(result), { status: 422, headers: JSON_HEADERS })
    }
    if ((instagramHint || malformedInstagramAuthority) && !instagramTarget) {
      const result = invalidInstagramResult()
      return new Response(JSON.stringify(result), { status: 422, headers: JSON_HEADERS })
    }
    if ((twitterHint || malformedTwitterAuthority) && !twitterTarget) {
      const result = invalidTwitterResult()
      return new Response(JSON.stringify(result), { status: 422, headers: JSON_HEADERS })
    }
    if ((tiktokHint || malformedTikTokAuthority) && !tiktokTarget) {
      const result = invalidTikTokResult()
      return new Response(JSON.stringify(result), { status: 422, headers: JSON_HEADERS })
    }
    if ((blueskyHint || malformedBlueskyAuthority) && !blueskyTarget) {
      const result = invalidBlueskyResult()
      return new Response(JSON.stringify(result), { status: 422, headers: JSON_HEADERS })
    }
    if ((youtubeTarget || youtubeHint || malformedYouTubeAuthority) && !EXTRACTION_MODES.includes(mode)) {
      const result = createUserFriendlyError('youtube', 'Invalid mode', 'YouTube extraction mode is invalid.')
      return new Response(JSON.stringify(result), { status: 422, headers: JSON_HEADERS })
    }
    if ((instagramTarget || instagramHint || malformedInstagramAuthority) && !EXTRACTION_MODES.includes(mode)) {
      const result = createUserFriendlyError('instagram', 'Invalid mode', 'Instagram extraction mode is invalid.')
      return new Response(JSON.stringify(result), { status: 422, headers: JSON_HEADERS })
    }
    if ((twitterTarget || twitterHint || malformedTwitterAuthority) && !EXTRACTION_MODES.includes(mode)) {
      const result = createUserFriendlyError('twitter', 'Invalid mode', 'Twitter/X extraction mode is invalid.')
      return new Response(JSON.stringify(result), { status: 422, headers: JSON_HEADERS })
    }
    if ((tiktokTarget || tiktokHint || malformedTikTokAuthority) && !EXTRACTION_MODES.includes(mode)) {
      const result = createUserFriendlyError('tiktok', 'Invalid mode', 'TikTok extraction mode is invalid.')
      return new Response(JSON.stringify(result), { status: 422, headers: JSON_HEADERS })
    }
    if ((blueskyTarget || blueskyHint || malformedBlueskyAuthority) && !EXTRACTION_MODES.includes(mode)) {
      const result = createUserFriendlyError('bluesky', 'Invalid mode', 'Bluesky extraction mode is invalid.')
      return new Response(JSON.stringify(result), { status: 422, headers: JSON_HEADERS })
    }

    // Normalize supported aliases before retaining an explicit unsupported platform label.
    const platform = youtubeHint
      ? 'youtube'
      : instagramHint
        ? 'instagram'
        : twitterHint
          ? 'twitter'
          : tiktokHint
            ? 'tiktok'
            : blueskyHint
              ? 'bluesky'
              : (providedPlatform || (youtubeTarget ? 'youtube' : instagramTarget ? 'instagram' : twitterTarget ? 'twitter' : tiktokTarget ? 'tiktok' : blueskyTarget ? 'bluesky' : null))

    if (!platform) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Could not detect social media platform from URL'
      }), { status: 400, headers: JSON_HEADERS })
    }


    // Instagram intentionally has no server-side provider transport. Keep the
    // canonical identity useful to callers without placing it in KV or D1.
    if (platform === 'instagram' && instagramTarget) {
      if (request.signal.aborted) {
        return genericExtractionFailure()
      }
      return new Response(JSON.stringify(instagramUnavailableResult(instagramTarget)), {
        status: 422,
        headers: JSON_HEADERS,
      })
    }

    if (platform === 'twitter' && twitterTarget) {
      const twitterResult = await extractTwitter(twitterTarget, mode, request.signal)
      if (twitterResult === null) return genericExtractionFailure()
      return new Response(JSON.stringify(twitterResult), {
        status: twitterResult.success ? 200 : 422,
        headers: JSON_HEADERS,
      })
    }

    if (platform === 'tiktok' && tiktokTarget) {
      const tiktokResult = await extractTikTok(tiktokTarget, mode, request.signal)
      if (tiktokResult === null) return genericExtractionFailure()
      return new Response(JSON.stringify(tiktokResult), {
        status: tiktokResult.success ? 200 : 422,
        headers: JSON_HEADERS,
      })
    }

    if (platform === 'bluesky' && blueskyTarget) {
      const blueskyResult = await extractBluesky(blueskyTarget, mode, request.signal)
      if (blueskyResult === null) return genericExtractionFailure()
      return new Response(JSON.stringify(blueskyResult), {
        status: blueskyResult.success ? 200 : 422,
        headers: JSON_HEADERS,
      })
    }

    let result: SocialMediaExtractionResult
    if (platform === 'youtube' && youtubeTarget) {
      const youtubeResult = await extractYouTube(youtubeTarget, mode, request.signal)
      if (youtubeResult === null) {
        return new Response(JSON.stringify({ success: false, error: 'Failed to extract social media content' }), {
          status: 500,
          headers: JSON_HEADERS,
        })
      }
      result = youtubeResult
    } else {
      result = createUserFriendlyError(
        platform,
        `Platform '${platform}' not supported`,
        `Sorry, ${platform} extraction is not yet available. Supported platforms: YouTube, Instagram, TikTok, Twitter/X, Bluesky.`
      )
    }

    if (platform === 'youtube' && request.signal.aborted) {
      return new Response(JSON.stringify({ success: false, error: 'Failed to extract social media content' }), {
        status: 500,
        headers: JSON_HEADERS,
      })
    }

    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 422,
      headers: JSON_HEADERS
    })

  } catch (error) {
    console.error('[Social Extract] Error:', error)
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to extract social media content'
    }), {
      status: 500,
      headers: JSON_HEADERS
    })
  }
}

function containsAsciiControl(value: string): boolean {
  return [...value].some(character => {
    const point = character.codePointAt(0) ?? 0
    return point <= 31 || point === 127
  })
}

function hasExactRawYouTubeAuthority(value: string): boolean {
  if (value.length === 0 || value.length > 2048 || value !== value.trim() || value.includes('\\')
    || containsAsciiControl(value) || /%(?![0-9a-f]{2})/i.test(value)) return false
  const match = /^https?:\/\/([^/?#]+)/i.exec(value)
  if (!match || match[1].includes('@') || match[1].includes(':') || match[1].includes('%')) return false
  return ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'].includes(match[1].toLowerCase())
}

function hasExactRawInstagramAuthority(value: string): boolean {
  if (value.length === 0 || value.length > 2048 || value !== value.trim() || value.includes('\\')
    || containsAsciiControl(value)) return false
  const match = /^https?:\/\/([^/?#]+)/i.exec(value)
  if (!match || match[1].includes('@') || match[1].includes(':') || match[1].includes('%')) return false
  return ['instagram.com', 'www.instagram.com'].includes(match[1].toLowerCase())
}

function hasExactRawTwitterAuthority(value: string): boolean {
  if (value.length === 0 || value.length > 2048 || value !== value.trim() || value.includes('\\')
    || containsAsciiControl(value)) return false
  const match = /^https?:\/\/([^/?#]+)/i.exec(value)
  if (!match || match[1].includes('@') || match[1].includes(':') || match[1].includes('%')) return false
  return ['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com'].includes(match[1].toLowerCase())
}

function hasExactRawTikTokAuthority(value: string): boolean {
  if (value.length === 0 || value.length > 2048 || value !== value.trim() || value.includes('\\')
    || containsAsciiControl(value)) return false
  const match = /^https?:\/\/([^/?#]+)/i.exec(value)
  if (!match || match[1].includes('@') || match[1].includes(':') || match[1].includes('%')) return false
  return ['tiktok.com', 'www.tiktok.com'].includes(match[1].toLowerCase())
}

function hasExactRawBlueskyAuthority(value: string): boolean {
  if (value.length === 0 || value.length > 2048 || value !== value.trim() || value.includes('\\')
    || containsAsciiControl(value)) return false
  if (value.startsWith('at://')) return true
  const match = /^https?:\/\/([^/?#]+)/i.exec(value)
  if (!match || match[1].includes('@') || match[1].includes(':') || match[1].includes('%')) return false
  return ['bsky.app', 'www.bsky.app'].includes(match[1].toLowerCase())
}

function invalidYouTubeResult(): SocialMediaExtractionResult {
  return createUserFriendlyError(
    'youtube',
    'Invalid URL format',
    'Could not find a valid YouTube video ID in the URL. Please use a standard YouTube link (e.g., youtube.com/watch?v=... or youtu.be/...).',
  )
}

function invalidInstagramResult(): SocialMediaExtractionResult {
  return createUserFriendlyError(
    'instagram',
    'Invalid URL format',
    'Could not find a valid Instagram post ID in the URL. Please use a standard Instagram link (e.g., instagram.com/p/...).',
  )
}

function invalidTwitterResult(): SocialMediaExtractionResult {
  return createUserFriendlyError(
    'twitter',
    'Invalid URL format',
    'Could not find a valid tweet ID in the URL. Please use a canonical Twitter/X link (for example, x.com/user/status/123...).',
  )
}

function invalidTikTokResult(): SocialMediaExtractionResult {
  return createUserFriendlyError(
    'tiktok',
    'Invalid URL format',
    'Could not find a valid TikTok video ID in the URL. Please use a canonical link (for example, tiktok.com/@user/video/123...).',
  )
}

function invalidBlueskyResult(): SocialMediaExtractionResult {
  return createUserFriendlyError(
    'bluesky',
    'Invalid URL format',
    'Could not parse a canonical Bluesky post. Use https://bsky.app/profile/{handle-or-did}/post/{rkey} or at://{handle-or-did}/app.bsky.feed.post/{rkey}.',
  )
}

function instagramUnavailableResult(target: CanonicalInstagramTarget): SocialMediaExtractionResult {
  return {
    success: false,
    platform: 'instagram',
    postType: target.kind,
    error: 'Automatic Instagram extraction is not currently available. Open the post on Instagram or download it manually, then upload it to Content Intelligence.',
    metadata: {
      kind: target.kind,
      shortcode: target.shortcode,
      canonicalUrl: target.canonicalUrl,
      openUrl: target.canonicalUrl,
      manualUploadGuidance: 'Download the post from Instagram, then upload it to Content Intelligence.',
    },
  }
}

function genericExtractionFailure(): Response {
  return new Response(JSON.stringify({ success: false, error: 'Failed to extract social media content' }), {
    status: 500,
    headers: JSON_HEADERS,
  })
}

// ========================================
// YouTube Extraction
// ========================================

async function extractYouTube(
  target: CanonicalYouTubeTarget,
  mode: YouTubeMode,
  signal: AbortSignal,
): Promise<SocialMediaExtractionResult | null> {
  const includeTranscript = mode === 'transcript' || mode === 'full'
  const includeMedia = mode === 'download' || mode === 'full'
  const provider = await fetchYouTubeProvider(target, {
    includeTranscript,
    includeMedia,
    signal,
    deadline: createYouTubeProviderDeadline(30_000, signal),
  })
  if (!provider.success || !provider.metadata) {
    if (provider.failure?.code === 'aborted') return null
    return createUserFriendlyError(
      'youtube',
      'Extraction failed',
      'YouTube video could not be extracted. The video may be private, age-restricted, or unavailable in your region.',
    )
  }

  const { videoId, canonicalUrl } = target
  const embedUrl = `https://www.youtube.com/embed/${videoId}`
  const embedCode = `<iframe width="560" height="315" src="${embedUrl}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`
  const downloadOptions: DownloadOption[] = includeMedia && provider.mediaFallback === 'watch_on_youtube'
    ? [{ quality: 'Watch on YouTube', format: 'web', url: canonicalUrl, hasAudio: true, hasVideo: true }]
    : []

  return {
    success: true,
    platform: 'youtube',
    postType: 'video',
    mediaUrls: { thumbnail: provider.metadata.thumbnailUrl },
    downloadOptions,
    streamUrl: embedUrl,
    embedCode,
    metadata: {
      title: provider.metadata.title,
      author: provider.metadata.authorName,
      channelUrl: provider.metadata.authorUrl,
      thumbnail: provider.metadata.thumbnailUrl,
      videoId,
      watchUrl: canonicalUrl,
    },
    transcript: includeTranscript ? (provider.transcript ?? TRANSCRIPT_FALLBACK) : undefined,
  }
}

// ========================================
// TikTok Extraction
// ========================================

async function extractTikTok(
  target: CanonicalTikTokTarget,
  mode: YouTubeMode,
  signal: AbortSignal,
): Promise<SocialMediaExtractionResult | null> {
  const provider = await fetchTikTokProvider(target, { signal })
  if (!provider.success || !provider.metadata) {
    if (provider.failure?.code === 'aborted') return null
    return createUserFriendlyError(
      'tiktok',
      'Extraction failed',
      'TikTok video could not be extracted. The video may be private, deleted, or temporarily unavailable.',
    )
  }
  const playerUrl = `https://www.tiktok.com/player/v1/${target.videoId}`
  const includePlayer = mode === 'stream' || mode === 'download' || mode === 'full'
  return {
    success: true,
    platform: 'tiktok',
    postType: 'video',
    downloadOptions: includePlayer
      ? [{ quality: 'Open on TikTok', format: 'web', url: target.canonicalUrl, hasAudio: false, hasVideo: false }]
      : undefined,
    streamUrl: includePlayer ? playerUrl : undefined,
    embedCode: includePlayer
      ? `<iframe src="${playerUrl}" allow="encrypted-media; fullscreen" allowfullscreen></iframe>`
      : undefined,
    metadata: {
      videoId: target.videoId,
      authorName: provider.metadata.authorName,
      authorHandle: provider.metadata.authorHandle,
      authorUrl: provider.metadata.authorUrl,
      description: provider.metadata.description,
      videoUrl: target.canonicalUrl,
      extractedVia: 'TikTok oEmbed API',
      directMediaAvailable: false,
    },
  }
}

// Twitter/X Extraction
// ========================================

async function extractTwitter(
  target: CanonicalTwitterTarget,
  mode: YouTubeMode,
  signal: AbortSignal,
): Promise<SocialMediaExtractionResult | null> {
  const provider = await fetchTwitterProvider(target, { signal })
  if (!provider.success || !provider.metadata) {
    if (provider.failure?.code === 'aborted') return null
    return createUserFriendlyError(
      'twitter',
      'Extraction failed',
      'Tweet could not be extracted. The post may be protected, deleted, or temporarily unavailable. Open the canonical post on X to verify it.',
    )
  }
  const includeOpenAction = mode === 'download' || mode === 'stream' || mode === 'full'
  return {
    success: true,
    platform: 'twitter',
    postType: 'tweet',
    downloadOptions: includeOpenAction
      ? [{
        quality: 'Open on X',
        format: 'web',
        url: target.canonicalUrl,
        hasAudio: false,
        hasVideo: false,
      }]
      : undefined,
    metadata: {
      tweetId: target.tweetId,
      authorName: provider.metadata.authorName,
      authorHandle: provider.metadata.authorHandle,
      authorUrl: provider.metadata.authorUrl,
      text: provider.metadata.text,
      tweetUrl: target.canonicalUrl,
      hasMedia: false,
      mediaCount: 0,
      extractedVia: 'X oEmbed API',
      directMediaAvailable: false,
    },
  }
}

// Bluesky (AT Protocol) Extraction
// ========================================

async function extractBluesky(
  target: CanonicalBlueskyTarget,
  mode: YouTubeMode,
  signal: AbortSignal,
): Promise<SocialMediaExtractionResult | null> {
  const provider = await fetchBlueskyProvider(target, { signal })
  if (!provider.success || !provider.metadata) {
    if (provider.failure?.code === 'aborted') return null
    return createUserFriendlyError(
      'bluesky',
      'Extraction failed',
      'Bluesky post could not be extracted. The post may be deleted, unavailable, or the public Bluesky API may be temporarily unavailable.',
    )
  }
  const metadata = provider.metadata
  const includeOpenAction = mode === 'download' || mode === 'stream' || mode === 'full'
  return {
    success: true,
    platform: 'bluesky',
    postType: metadata.postType,
    downloadOptions: includeOpenAction
      ? [{
        quality: 'Open on Bluesky',
        format: 'web',
        url: target.canonicalUrl,
        hasAudio: false,
        hasVideo: false,
      }]
      : undefined,
    metadata: {
      author: metadata.authorName,
      authorHandle: metadata.authorHandle,
      authorDid: metadata.authorDid,
      authorUrl: metadata.authorUrl,
      text: metadata.text,
      createdAt: metadata.createdAt,
      replyCount: metadata.replyCount,
      repostCount: metadata.repostCount,
      likeCount: metadata.likeCount,
      quoteCount: metadata.quoteCount,
      uri: metadata.postUri,
      postUrl: target.canonicalUrl,
      hasMedia: metadata.hasMedia,
      mediaCount: metadata.mediaCount,
      directMediaAvailable: false,
      extractedVia: 'Bluesky public AppView API',
    },
  }
}

// Reject GET requests (POST-only endpoint)
export const onRequestGet: PagesFunction = async () => {
  return new Response(JSON.stringify({ error: 'Method not allowed. Use POST.' }), {
    status: 405, headers: JSON_HEADERS,
  })
}
