/**
 * Social Media Extraction Endpoint
 *
 * Provides specialized extraction for social media platforms:
 * - YouTube: Video download URLs, transcripts, metadata
 * - Instagram: Canonical post identity and manual extraction guidance
 * - TikTok: Video URLs, metadata (via external API)
 * - Twitter/X: Tweet data, media URLs
 * - Bluesky: Post media, text, author info, engagement metrics (via AT Protocol API)
 */

import type { PagesFunction } from '@cloudflare/workers-types'

import { getUserFromRequest } from '../_shared/auth-helpers'
import { JSON_HEADERS } from '../_shared/api-utils'
import {
  parseCanonicalInstagramUrl,
  parseCanonicalTwitterUrl,
  parseCanonicalYouTubeUrl,
  type CanonicalInstagramTarget,
  type CanonicalTwitterTarget,
  type CanonicalYouTubeTarget,
} from '../_shared/social-url'
import { fetchTwitterProvider } from '../_shared/twitter-provider'
import { createYouTubeProviderDeadline, fetchYouTubeProvider } from '../_shared/youtube-provider'

interface Env {
  DB: D1Database
  OPENAI_API_KEY: string
  CACHE: KVNamespace
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
  metadata?: Record<string, any>
  transcript?: string
  error?: string
}

type YouTubeMode = NonNullable<SocialMediaExtractRequest['mode']>
const EXTRACTION_MODES: readonly YouTubeMode[] = ['metadata', 'download', 'stream', 'transcript', 'full']
const TRANSCRIPT_FALLBACK = 'Transcript not available for this video. Try using YouTube\'s built-in transcript feature.'

// ========================================
// Helper Functions
// ========================================

/**
 * Fetch with retry and exponential backoff
 */
async function fetchWithRetry<T>(
  fetcher: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fetcher()
    } catch (error) {
      if (attempt === maxRetries - 1) throw error

      const delay = baseDelay * Math.pow(2, attempt)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  throw new Error('Max retries exceeded')
}

/**
 * Get cached result or fetch fresh
 */
async function getCached<T>(
  cache: KVNamespace | undefined,
  key: string,
  ttl: number,
  fetcher: () => Promise<T>
): Promise<T> {
  // If no cache available, just fetch
  if (!cache) {
    return await fetcher()
  }

  // Try cache first
  try {
    const cached = await cache.get(key)
    if (cached) {
      return JSON.parse(cached) as T
    }
  } catch (cacheError) {
    console.warn('[Cache] Read error:', cacheError)
  }

  // Cache miss - fetch fresh
  const result = await fetcher()

  // Store in cache
  try {
    await cache.put(key, JSON.stringify(result), {
      expirationTtl: ttl
    })
  } catch (cacheError) {
    console.warn('[Cache] Write error:', cacheError)
  }

  return result
}

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

    // Outside the constrained platform decisions, retain the caller's exact legacy platform identity.
    const platform = youtubeHint
      ? 'youtube'
      : instagramHint
        ? 'instagram'
        : twitterHint
          ? 'twitter'
          : (providedPlatform || (youtubeTarget ? 'youtube' : instagramTarget ? 'instagram' : twitterTarget ? 'twitter' : detectPlatform(url)))

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
      // Preserve the legacy cache contract for every non-YouTube platform.
      const cacheKey = `social:${platform}:${mode}:${encodeURIComponent(url)}`
      result = await getCached<SocialMediaExtractionResult>(
        env.CACHE,
        cacheKey,
        3600, // 1 hour TTL
        async () => {
          switch (platform) {
          case 'tiktok':
            return await extractTikTok(url, mode)
          case 'bluesky':
            return await extractBluesky(url, mode)
          default:
            return createUserFriendlyError(
              platform,
              `Platform '${platform}' not supported`,
              `Sorry, ${platform} extraction is not yet available. Supported platforms: YouTube, Instagram, TikTok, Twitter/X, Bluesky.`
            )
          }
        },
      )
    }

    if (platform === 'youtube' && request.signal.aborted) {
      return new Response(JSON.stringify({ success: false, error: 'Failed to extract social media content' }), {
        status: 500,
        headers: JSON_HEADERS,
      })
    }

    // Save to database if successful
    if (result.success && env.DB && platform !== 'youtube') {
      try {
        await saveSocialMediaExtraction(env.DB, {
          user_id: authUserId,
          url,
          platform,
          post_type: result.postType,
          media_urls: result.mediaUrls,
          download_options: result.downloadOptions,
          stream_url: result.streamUrl,
          embed_code: result.embedCode,
          metadata: result.metadata,
          transcript: result.transcript,
          extraction_mode: mode
        })
      } catch (dbError) {
        console.error('[Social Extract] Database save failed (non-fatal):', dbError)
      }
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

// ========================================
// Platform Detection
// ========================================

function detectPlatform(url: string): string | null {
  const urlLower = url.toLowerCase()

  if (urlLower.includes('tiktok.com')) {
    return 'tiktok'
  }
  if (urlLower.includes('bsky.app') || urlLower.startsWith('at://')) {
    return 'bluesky'
  }
  if (urlLower.includes('facebook.com')) {
    return 'facebook'
  }
  if (urlLower.includes('reddit.com')) {
    return 'reddit'
  }

  return null
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

async function extractTikTok(url: string, mode: string): Promise<SocialMediaExtractionResult> {
  try {

    // TikTok extraction via cobalt.tools with retry logic
    const cobaltData = await fetchWithRetry(async () => {
      const cobaltResponse = await fetch('https://co.wuk.sh/api/json', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          url,
          vCodec: 'h264',
          vQuality: '720',
          aFormat: 'mp3',
          isAudioOnly: false
        }),
        signal: AbortSignal.timeout(15000)
      })

      if (!cobaltResponse.ok) {
        throw new Error(`Cobalt API returned status ${cobaltResponse.status}`)
      }

      return await cobaltResponse.json() as any
    }, 2, 1000)


    if (cobaltData.status === 'error') {
      throw new Error(cobaltData.text || 'TikTok extraction failed')
    }

    if (cobaltData.status !== 'redirect' && cobaltData.status !== 'stream') {
      throw new Error(`Unexpected response status: ${cobaltData.status}`)
    }

    const videoUrl = cobaltData.url
    const audioUrl = cobaltData.audio

    return {
      success: true,
      platform: 'tiktok',
      postType: 'video',
      mediaUrls: {
        video: videoUrl,
        audio: audioUrl
      },
      downloadOptions: [
        {
          quality: '720p',
          format: 'mp4',
          url: videoUrl,
          hasAudio: true,
          hasVideo: true
        }
      ],
      metadata: {
        extractedVia: 'cobalt.tools',
        note: 'TikTok metadata limited due to anti-bot measures'
      }
    }

  } catch (error) {
    console.error('[TikTok] Extraction failed:', error)
    return createUserFriendlyError(
      'tiktok',
      'Extraction failed',
      'TikTok video could not be extracted. The video may be private, deleted, or temporarily unavailable. Please try again later.'
    )
  }
}

// ========================================
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

async function extractBluesky(url: string, mode: string): Promise<SocialMediaExtractionResult> {
  try {

    // Parse Bluesky URL to extract handle and post ID
    // Format: https://bsky.app/profile/{handle}/post/{rkey}
    // Or AT URI: at://{did}/app.bsky.feed.post/{rkey}

    let handle: string
    let rkey: string

    if (url.startsWith('at://')) {
      // AT Protocol URI format
      const match = url.match(/at:\/\/([^/]+)\/app\.bsky\.feed\.post\/(.+)/)
      if (!match) {
        return createUserFriendlyError(
          'bluesky',
          'Invalid AT URI format',
          'Could not parse AT Protocol URI. Expected format: at://{did}/app.bsky.feed.post/{rkey}'
        )
      }
      handle = match[1] // This is actually a DID, but we'll resolve it
      rkey = match[2]
    } else {
      // Web URL format
      const match = url.match(/bsky\.app\/profile\/([^/]+)\/post\/([^/?#]+)/)
      if (!match) {
        return createUserFriendlyError(
          'bluesky',
          'Invalid Bluesky URL format',
          'Could not parse Bluesky URL. Expected format: https://bsky.app/profile/{handle}/post/{rkey}'
        )
      }
      handle = match[1]
      rkey = match[2]
    }


    // Fetch post using Bluesky public API
    const postData = await fetchWithRetry(async () => {
      // First resolve the handle to DID if needed
      let did = handle
      if (!handle.startsWith('did:')) {
        const resolveUrl = `https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`
        const resolveResponse = await fetch(resolveUrl, { signal: AbortSignal.timeout(15000) })
        if (!resolveResponse.ok) {
          throw new Error(`Failed to resolve handle: ${resolveResponse.status}`)
        }
        const resolveData = await resolveResponse.json() as any
        did = resolveData.did
      }

      // Now fetch the post
      const postUrl = `https://public.api.bsky.app/xrpc/app.bsky.feed.getPostThread?uri=at://${did}/app.bsky.feed.post/${rkey}&depth=0`
      const postResponse = await fetch(postUrl, { signal: AbortSignal.timeout(15000) })

      if (!postResponse.ok) {
        throw new Error(`Bluesky API returned status ${postResponse.status}`)
      }

      return await postResponse.json() as any
    }, 2, 1000)

    const post = postData.thread?.post
    if (!post) {
      throw new Error('Post data not found in response')
    }

    // Extract media URLs from embeds
    const mediaUrls: MediaUrls = {}
    const images: string[] = []

    if (post.embed) {
      // Handle images
      if (post.embed.$type === 'app.bsky.embed.images#view') {
        for (const img of post.embed.images || []) {
          if (img.fullsize) {
            images.push(img.fullsize)
          }
        }
      }

      // Handle videos
      if (post.embed.$type === 'app.bsky.embed.video#view') {
        mediaUrls.video = post.embed.playlist || post.embed.thumbnail
        mediaUrls.thumbnail = post.embed.thumbnail
      }

      // Handle external links with thumbnails
      if (post.embed.$type === 'app.bsky.embed.external#view') {
        if (post.embed.external?.thumb) {
          mediaUrls.thumbnail = post.embed.external.thumb
        }
      }

      // Handle record with media (quote posts with images)
      if (post.embed.$type === 'app.bsky.embed.recordWithMedia#view') {
        if (post.embed.media?.$type === 'app.bsky.embed.images#view') {
          for (const img of post.embed.media.images || []) {
            if (img.fullsize) {
              images.push(img.fullsize)
            }
          }
        }
      }
    }

    if (images.length > 0) {
      mediaUrls.images = images
    }

    // Build metadata
    const metadata = {
      author: post.author?.displayName || post.author?.handle,
      authorHandle: post.author?.handle,
      authorDid: post.author?.did,
      authorAvatar: post.author?.avatar,
      text: post.record?.text || '',
      createdAt: post.record?.createdAt,
      replyCount: post.replyCount || 0,
      repostCount: post.repostCount || 0,
      likeCount: post.likeCount || 0,
      quoteCount: post.quoteCount || 0,
      uri: post.uri,
      cid: post.cid,
      hasMedia: !!(mediaUrls.images?.length || mediaUrls.video),
      mediaCount: (mediaUrls.images?.length || 0) + (mediaUrls.video ? 1 : 0)
    }

    // Determine post type
    let postType = 'post'
    if (post.record?.reply) {
      postType = 'reply'
    } else if (post.embed?.$type?.includes('recordWithMedia') || post.embed?.$type?.includes('record')) {
      postType = 'quote'
    }

    return {
      success: true,
      platform: 'bluesky',
      postType,
      mediaUrls,
      metadata
    }

  } catch (error) {
    console.error('[Bluesky] Extraction failed:', error)
    return createUserFriendlyError(
      'bluesky',
      'Extraction failed',
      'Bluesky post could not be extracted. The post may be from a private account, deleted, or the Bluesky API may be temporarily unavailable. Please verify the URL is correct and try again.'
    )
  }
}

// ========================================
// Database Save
// ========================================

async function saveSocialMediaExtraction(db: D1Database, data: any): Promise<number> {
  const result = await db.prepare(`
    INSERT INTO social_media_extractions (
      user_id, url, platform, post_type, media_urls, download_options,
      stream_url, embed_code, metadata, transcript, extraction_mode
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    data.user_id,
    data.url,
    data.platform,
    data.post_type,
    JSON.stringify(data.media_urls || {}),
    JSON.stringify(data.download_options || []),
    data.stream_url,
    data.embed_code,
    JSON.stringify(data.metadata || {}),
    data.transcript,
    data.extraction_mode
  ).run()

  return result.meta.last_row_id as number
}

// Reject GET requests (POST-only endpoint)
export const onRequestGet: PagesFunction = async () => {
  return new Response(JSON.stringify({ error: 'Method not allowed. Use POST.' }), {
    status: 405, headers: JSON_HEADERS,
  })
}
