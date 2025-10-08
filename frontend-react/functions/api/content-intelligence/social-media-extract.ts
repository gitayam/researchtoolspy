/**
 * Social Media Extraction Endpoint
 *
 * Provides specialized extraction for social media platforms:
 * - YouTube: Video download URLs, transcripts, metadata
 * - Instagram: Post media, captions, engagement metrics
 * - TikTok: Video URLs, metadata (via external API)
 * - Twitter/X: Tweet data, media URLs
 * - Bluesky: Post media, text, author info, engagement metrics (via AT Protocol API)
 */

import type { PagesFunction } from '@cloudflare/workers-types'

interface Env {
  DB: D1Database
  OPENAI_API_KEY: string
  CACHE: KVNamespace
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
      console.log(`[Retry] Attempt ${attempt + 1} failed, retrying in ${delay}ms`)
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
      console.log(`[Cache HIT] ${key}`)
      return JSON.parse(cached) as T
    }
  } catch (cacheError) {
    console.warn('[Cache] Read error:', cacheError)
  }

  // Cache miss - fetch fresh
  console.log(`[Cache MISS] ${key}`)
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
      technicalDetails: technicalError,
      timestamp: new Date().toISOString()
    }
  }
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  try {
    const body: SocialMediaExtractRequest = await request.json() as SocialMediaExtractRequest
    const { url, platform: providedPlatform, mode = 'full' } = body

    if (!url) {
      return new Response(JSON.stringify({
        success: false,
        error: 'URL is required'
      }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }

    // Detect platform
    const platform = providedPlatform || detectPlatform(url)

    if (!platform) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Could not detect social media platform from URL'
      }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }

    console.log(`[Social Extract] Platform: ${platform}, Mode: ${mode}, URL: ${url}`)

    // Create cache key
    const cacheKey = `social:${platform}:${mode}:${encodeURIComponent(url)}`

    // Route to platform-specific extraction with caching
    const result = await getCached<SocialMediaExtractionResult>(
      env.CACHE,
      cacheKey,
      3600, // 1 hour TTL
      async () => {
        switch (platform) {
          case 'youtube':
            return await extractYouTube(url, mode)
          case 'instagram':
            return await extractInstagram(url, mode, env)
          case 'tiktok':
            return await extractTikTok(url, mode)
          case 'twitter':
          case 'x':
            return await extractTwitter(url, mode)
          case 'bluesky':
            return await extractBluesky(url, mode)
          default:
            return createUserFriendlyError(
              platform,
              `Platform '${platform}' not supported`,
              `Sorry, ${platform} extraction is not yet available. Supported platforms: YouTube, Instagram, TikTok, Twitter/X, Bluesky.`
            )
        }
      }
    )

    // Save to database if successful
    if (result.success && env.DB) {
      try {
        await saveSocialMediaExtraction(env.DB, {
          user_id: 1, // TODO: Get from auth
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
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('[Social Extract] Error:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error instanceof Error ? error.stack : undefined
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// ========================================
// Platform Detection
// ========================================

function detectPlatform(url: string): string | null {
  const urlLower = url.toLowerCase()

  if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be')) {
    return 'youtube'
  }
  if (urlLower.includes('instagram.com')) {
    return 'instagram'
  }
  if (urlLower.includes('tiktok.com')) {
    return 'tiktok'
  }
  if (urlLower.includes('twitter.com') || urlLower.includes('x.com')) {
    return 'twitter'
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

// ========================================
// YouTube Extraction
// ========================================

async function extractYouTube(url: string, mode: string): Promise<SocialMediaExtractionResult> {
  try {
    console.log('[YouTube] Starting extraction, mode:', mode, 'url:', url)

    // Extract video ID
    const videoId = extractYouTubeVideoId(url)
    if (!videoId) {
      return createUserFriendlyError(
        'youtube',
        'Invalid URL format',
        'Could not find a valid YouTube video ID in the URL. Please use a standard YouTube link (e.g., youtube.com/watch?v=... or youtu.be/...).'
      )
    }

    console.log('[YouTube] Video ID:', videoId)

    // Use YouTube oEmbed API for reliable metadata with retry
    const oembedData = await fetchWithRetry(async () => {
      const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
      const oembedResponse = await fetch(oembedUrl)

      if (!oembedResponse.ok) {
        throw new Error(`YouTube oEmbed API failed with status ${oembedResponse.status}`)
      }

      return await oembedResponse.json() as any
    })

    // Build embed URLs
    const embedUrl = `https://www.youtube.com/embed/${videoId}`
    const embedCode = `<iframe width="560" height="315" src="${embedUrl}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`

    // Build download options using external service (cobalt.tools)
    let downloadOptions: DownloadOption[] = []
    let mediaUrls: MediaUrls = {
      thumbnail: oembedData.thumbnail_url
    }

    if (mode === 'download' || mode === 'full') {
      try {
        console.log('[YouTube] Fetching download URLs via cobalt.tools...')

        // Use retry logic for cobalt.tools API
        const cobaltData = await fetchWithRetry(async () => {
          const cobaltResponse = await fetch('https://co.wuk.sh/api/json', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify({
              url: `https://www.youtube.com/watch?v=${videoId}`,
              vCodec: 'h264',
              vQuality: '1080',
              aFormat: 'mp3',
              isAudioOnly: false,
              isTTFullAudio: false
            })
          })

          if (!cobaltResponse.ok) {
            throw new Error(`Cobalt API returned status ${cobaltResponse.status}`)
          }

          return await cobaltResponse.json() as any
        }, 2, 1000) // 2 retries with 1s base delay

        console.log('[YouTube] Cobalt response status:', cobaltData.status)

        if (cobaltData.status === 'redirect' || cobaltData.status === 'stream') {
          mediaUrls.video = cobaltData.url
          downloadOptions.push({
            quality: '1080p (via cobalt)',
            format: 'mp4',
            url: cobaltData.url,
            hasAudio: true,
            hasVideo: true
          })
        } else {
          console.warn('[YouTube] Cobalt returned unexpected status:', cobaltData.status)
        }

        // Always provide the YouTube watch link as fallback
        downloadOptions.push({
          quality: 'Watch on YouTube',
          format: 'web',
          url: `https://www.youtube.com/watch?v=${videoId}`,
          hasAudio: true,
          hasVideo: true
        })

        // Add yt-dlp service link as option
        downloadOptions.push({
          quality: 'Use yt-dlp (external)',
          format: 'various',
          url: `https://yt-dlp.org/`,
          hasAudio: true,
          hasVideo: true
        })
      } catch (downloadError) {
        console.error('[YouTube] Download extraction failed:', downloadError)
        // Provide YouTube link as fallback
        downloadOptions.push({
          quality: 'Watch on YouTube',
          format: 'web',
          url: `https://www.youtube.com/watch?v=${videoId}`,
          hasAudio: true,
          hasVideo: true
        })
      }
    }

    // Get transcript if requested
    let transcript: string | undefined
    if (mode === 'transcript' || mode === 'full') {
      try {
        console.log('[YouTube] Attempting to fetch transcript...')
        transcript = await fetchYouTubeTranscript(videoId)
        console.log('[YouTube] Transcript length:', transcript?.length || 0)
      } catch (transcriptError) {
        console.error('[YouTube] Transcript extraction failed:', transcriptError)
        transcript = 'Transcript not available for this video. Try using YouTube\'s built-in transcript feature.'
      }
    }

    return {
      success: true,
      platform: 'youtube',
      postType: 'video',
      mediaUrls,
      downloadOptions,
      streamUrl: embedUrl,
      embedCode,
      metadata: {
        title: oembedData.title,
        author: oembedData.author_name,
        channelUrl: oembedData.author_url,
        thumbnail: oembedData.thumbnail_url,
        videoId: videoId,
        watchUrl: `https://www.youtube.com/watch?v=${videoId}`
      },
      transcript
    }

  } catch (error) {
    console.error('[YouTube] Extraction failed:', error)
    return createUserFriendlyError(
      'youtube',
      error instanceof Error ? error.message : 'Unknown error',
      'YouTube video could not be extracted. The video may be private, age-restricted, or unavailable in your region.'
    )
  }
}

// Helper: Extract YouTube video ID from various URL formats
function extractYouTubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match && match[1]) {
      return match[1]
    }
  }

  return null
}

// Helper: Fetch YouTube transcript using YouTube's timedtext API
/**
 * Fetch YouTube transcript using InnerTube API (2025 method)
 * Supports auto-generated and manual captions with multi-language fallback
 *
 * @param videoId - YouTube video ID (11 characters)
 * @param preferredLang - Preferred language code (default: 'en')
 * @returns Transcript text or throws error if unavailable
 */
async function fetchYouTubeTranscript(videoId: string, preferredLang: string = 'en'): Promise<string> {
  try {
    console.log(`[YouTube Transcript] Fetching transcript for video ${videoId}, preferred language: ${preferredLang}`)

    // Use YouTube InnerTube API with Android client for reliability
    // This API key is public and used by YouTube's Android app
    const playerResponse = await fetch(
      `https://www.youtube.com/youtubei/v1/player?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context: {
            client: {
              clientName: 'ANDROID',
              clientVersion: '17.31.35',
              androidSdkVersion: 30,
              hl: 'en',
              gl: 'US',
            }
          },
          videoId: videoId
        })
      }
    )

    if (!playerResponse.ok) {
      throw new Error(`InnerTube API returned ${playerResponse.status}`)
    }

    const playerData = await playerResponse.json() as any
    const captionTracks = playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks

    if (!captionTracks || captionTracks.length === 0) {
      throw new Error('No captions available for this video')
    }

    console.log(`[YouTube Transcript] Found ${captionTracks.length} caption tracks`)

    // Multi-language fallback chain:
    // 1. Preferred language (exact match)
    // 2. English (if not already preferred)
    // 3. Auto-generated in preferred language
    // 4. First available track
    let selectedTrack = captionTracks.find((t: any) => t.languageCode === preferredLang && !t.kind)
      || captionTracks.find((t: any) => t.languageCode === 'en' && !t.kind)
      || captionTracks.find((t: any) => t.languageCode === preferredLang)
      || captionTracks.find((t: any) => t.languageCode === 'en')
      || captionTracks[0]

    if (!selectedTrack || !selectedTrack.baseUrl) {
      throw new Error('Selected caption track has no baseUrl')
    }

    console.log(`[YouTube Transcript] Selected track: ${selectedTrack.name?.simpleText || 'Unknown'} (${selectedTrack.languageCode})${selectedTrack.kind ? ' [auto-generated]' : ''}`)

    // Fetch transcript XML
    const transcriptResponse = await fetch(selectedTrack.baseUrl)

    if (!transcriptResponse.ok) {
      throw new Error(`Failed to fetch transcript: ${transcriptResponse.status}`)
    }

    const xml = await transcriptResponse.text()

    // Parse XML and extract text from <text> tags
    const textMatches = xml.match(/<text[^>]*>(.*?)<\/text>/g)

    if (!textMatches || textMatches.length === 0) {
      throw new Error('No transcript text found in XML')
    }

    // Clean up and decode HTML entities
    const transcript = textMatches
      .map(match => {
        const content = match.replace(/<text[^>]*>/, '').replace(/<\/text>/, '')
        return content
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&nbsp;/g, ' ')
          .trim()
      })
      .filter(line => line.length > 0)
      .join(' ')

    if (!transcript || transcript.length === 0) {
      throw new Error('Transcript fetched but appears to be empty')
    }

    console.log(`[YouTube Transcript] Successfully extracted ${transcript.length} characters`)
    return transcript

  } catch (error) {
    console.error('[YouTube Transcript] Error:', error)

    // Provide user-friendly error messages
    if (error instanceof Error) {
      if (error.message.includes('No captions available')) {
        throw new Error('This video does not have captions or transcripts available.')
      } else if (error.message.includes('InnerTube API returned')) {
        throw new Error('YouTube API is temporarily unavailable. Please try again later.')
      }
    }

    throw new Error('Could not fetch transcript. The video may not have captions available or YouTube blocked the request.')
  }
}

// ========================================
// Instagram Extraction
// ========================================

async function extractInstagram(url: string, mode: string, env?: { CACHE?: KVNamespace }): Promise<SocialMediaExtractionResult> {
  // Extract shortcode for metadata
  const shortcode = extractInstagramShortcode(url)
  if (!shortcode) {
    return createUserFriendlyError(
      'instagram',
      'Invalid URL format',
      'Could not find a valid Instagram post ID in the URL. Please use a standard Instagram link (e.g., instagram.com/p/...).'
    )
  }

  // Try cache first to reduce API calls (24-hour TTL)
  if (env?.CACHE) {
    try {
      const cacheKey = `instagram:${shortcode}:${mode}`
      const cached = await env.CACHE.get(cacheKey, 'json')
      if (cached) {
        console.log('[Instagram] Cache hit for shortcode:', shortcode)
        return cached as SocialMediaExtractionResult
      }
    } catch (error) {
      console.warn('[Instagram] Cache read failed:', error)
      // Continue with extraction if cache fails
    }
  }

  const errors: string[] = []

  // Helper to cache and return successful result
  const cacheAndReturn = async (result: SocialMediaExtractionResult): Promise<SocialMediaExtractionResult> => {
    if (env?.CACHE && result.success) {
      try {
        const cacheKey = `instagram:${shortcode}:${mode}`
        await env.CACHE.put(cacheKey, JSON.stringify(result), {
          expirationTtl: 86400 // 24 hours
        })
        console.log('[Instagram] Cached result for shortcode:', shortcode)
      } catch (error) {
        console.warn('[Instagram] Cache write failed:', error)
        // Don't fail if caching fails
      }
    }
    return result
  }

  // Strategy 1: Try cobalt.tools (primary method)
  try {
    console.log('[Instagram] Attempting extraction via cobalt.tools, mode:', mode, 'url:', url)
    const result = await extractInstagramViaCobalt(url, shortcode, mode)
    return await cacheAndReturn(result)
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    console.warn('[Instagram] Cobalt.tools failed:', errorMsg)
    errors.push(`cobalt.tools: ${errorMsg}`)
  }

  // Strategy 2: Try SnapInsta API (fallback)
  try {
    console.log('[Instagram] Attempting fallback extraction via SnapInsta')
    const result = await extractInstagramViaSnapInsta(url, shortcode)
    return await cacheAndReturn(result)
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    console.warn('[Instagram] SnapInsta failed:', errorMsg)
    errors.push(`SnapInsta: ${errorMsg}`)
  }

  // Strategy 3: Try InstaDP API (fallback)
  try {
    console.log('[Instagram] Attempting fallback extraction via InstaDP')
    const result = await extractInstagramViaInstaDP(url, shortcode)
    return await cacheAndReturn(result)
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    console.warn('[Instagram] InstaDP failed:', errorMsg)
    errors.push(`InstaDP: ${errorMsg}`)
  }

  // Strategy 4: Try SaveInsta API (fallback)
  try {
    console.log('[Instagram] Attempting fallback extraction via SaveInsta')
    const result = await extractInstagramViaSaveInsta(url, shortcode)
    return await cacheAndReturn(result)
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    console.warn('[Instagram] SaveInsta failed:', errorMsg)
    errors.push(`SaveInsta: ${errorMsg}`)
  }

  // Strategy 5: Try oEmbed API (metadata only)
  try {
    console.log('[Instagram] Attempting fallback via Instagram oEmbed API')
    const result = await extractInstagramViaOEmbed(url, shortcode)
    return await cacheAndReturn(result)
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    console.warn('[Instagram] oEmbed failed:', errorMsg)
    errors.push(`oEmbed: ${errorMsg}`)
  }

  // All strategies failed - return comprehensive error with specific diagnostics
  console.error('[Instagram] All 5 extraction methods failed:', errors)

  // Count how many services failed
  const totalStrategies = 5
  const failedStrategies = errors.length

  // Determine specific failure reason based on error patterns
  let friendlyMessage = `Instagram extraction failed after trying ${failedStrategies} different methods. `
  let diagnostics = errors.join(' | ')
  let suggestions: string[] = []

  // Analyze error patterns for specific guidance
  if (errors.some(e => e.includes('429') || e.toLowerCase().includes('rate limit'))) {
    friendlyMessage += 'Rate limiting detected. '
    suggestions.push('Wait 5-10 minutes before retrying')
    suggestions.push('Try a different network or VPN')
  } else if (errors.some(e => e.includes('404') || e.toLowerCase().includes('not found'))) {
    friendlyMessage += 'Post not found. '
    suggestions.push('Verify the Instagram URL is correct')
    suggestions.push('Check if the post was deleted')
    suggestions.push('Try accessing the post in a browser first')
  } else if (errors.some(e => e.includes('403') || e.toLowerCase().includes('forbidden') || e.toLowerCase().includes('private'))) {
    friendlyMessage += 'Access forbidden. '
    suggestions.push('The post may be from a private account')
    suggestions.push('Try logging into Instagram first and sharing the post URL')
  } else if (errors.every(e => e.toLowerCase().includes('http 5') || e.toLowerCase().includes('timeout'))) {
    friendlyMessage += 'External services are experiencing issues. '
    suggestions.push('Wait a few minutes and try again')
    suggestions.push('The extraction services may be temporarily down')
  } else {
    friendlyMessage += 'Instagram is blocking automated access. '
    suggestions.push('Instagram frequently updates their anti-bot measures')
    suggestions.push('Wait 10-15 minutes and try again')
    suggestions.push('Try a different Instagram post first')
    suggestions.push('Download manually from Instagram app/website')
  }

  // Always add manual workaround suggestion
  suggestions.push('Manual workaround: Download from Instagram → Upload to Content Intelligence')

  // Build final user-friendly message
  const finalMessage = friendlyMessage + '\n\n📋 Suggestions:\n' + suggestions.map((s, i) => `${i + 1}. ${s}`).join('\n')

  return createUserFriendlyError(
    'instagram',
    `[Diagnostics] ${diagnostics}`,
    finalMessage
  )
}

/**
 * Extract Instagram content via cobalt.tools API
 */
async function extractInstagramViaCobalt(url: string, shortcode: string, mode: string): Promise<SocialMediaExtractionResult> {
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
        vQuality: '1080',
        aFormat: 'mp3',
        isAudioOnly: false
      })
    })

    if (!cobaltResponse.ok) {
      throw new Error(`HTTP ${cobaltResponse.status}`)
    }

    return await cobaltResponse.json() as any
  }, 2, 1000)

  console.log('[Instagram] Cobalt response status:', cobaltData.status)

  // Handle different response types
  if (cobaltData.status === 'picker') {
    // Instagram carousel - multiple images/videos
    const downloadOptions: DownloadOption[] = cobaltData.picker.map((item: any, idx: number) => ({
      quality: 'Original',
      format: item.type === 'video' ? 'mp4' : 'jpg',
      url: item.url,
      hasAudio: item.type === 'video',
      hasVideo: item.type === 'video'
    }))

    const images = cobaltData.picker
      .filter((item: any) => item.type === 'photo')
      .map((item: any) => item.url)

    const videos = cobaltData.picker
      .filter((item: any) => item.type === 'video')
      .map((item: any) => item.url)

    return {
      success: true,
      platform: 'instagram',
      postType: 'carousel',
      mediaUrls: {
        images,
        video: videos[0],
        thumbnail: images[0] || videos[0]
      },
      downloadOptions,
      metadata: {
        shortcode,
        itemCount: cobaltData.picker.length,
        extractedVia: 'cobalt.tools'
      }
    }
  } else if (cobaltData.status === 'redirect' || cobaltData.status === 'stream') {
    // Single image or video
    const isVideo = cobaltData.url?.includes('.mp4') || mode === 'download'

    return {
      success: true,
      platform: 'instagram',
      postType: isVideo ? 'video' : 'image',
      mediaUrls: {
        [isVideo ? 'video' : 'thumbnail']: cobaltData.url
      },
      downloadOptions: [{
        quality: 'Original',
        format: isVideo ? 'mp4' : 'jpg',
        url: cobaltData.url,
        hasAudio: isVideo,
        hasVideo: isVideo
      }],
      metadata: {
        shortcode,
        extractedVia: 'cobalt.tools'
      }
    }
  } else if (cobaltData.status === 'error') {
    throw new Error(cobaltData.text || 'Extraction failed')
  } else {
    throw new Error(`Unexpected status: ${cobaltData.status}`)
  }
}

/**
 * Extract Instagram content via SnapInsta API (fallback)
 */
async function extractInstagramViaSnapInsta(url: string, shortcode: string): Promise<SocialMediaExtractionResult> {
  // SnapInsta provides Instagram media extraction via their API
  const response = await fetchWithRetry(async () => {
    return await fetch('https://snapinsta.app/api/ajaxSearch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      body: `q=${encodeURIComponent(url)}&t=media&lang=en`
    })
  }, 2, 1000)

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  const data = await response.json() as any

  if (!data.data || data.status !== 'ok') {
    throw new Error(data.mess || 'No media found')
  }

  // Parse HTML response to extract media URLs
  // SnapInsta returns HTML with download links
  const html = data.data
  const videoMatch = html.match(/href="([^"]+)"[^>]*>Download Video/)
  const imageMatch = html.match(/href="([^"]+)"[^>]*>Download Image/)

  const videoUrl = videoMatch ? videoMatch[1] : null
  const imageUrl = imageMatch ? imageMatch[1] : null

  if (!videoUrl && !imageUrl) {
    throw new Error('No downloadable media found in response')
  }

  const isVideo = !!videoUrl

  return {
    success: true,
    platform: 'instagram',
    postType: isVideo ? 'video' : 'image',
    mediaUrls: {
      [isVideo ? 'video' : 'thumbnail']: isVideo ? videoUrl : imageUrl
    },
    downloadOptions: [{
      quality: 'Original',
      format: isVideo ? 'mp4' : 'jpg',
      url: isVideo ? videoUrl : imageUrl,
      hasAudio: isVideo,
      hasVideo: isVideo
    }],
    metadata: {
      shortcode,
      extractedVia: 'SnapInsta'
    }
  }
}

/**
 * Extract Instagram content via InstaDP API (fallback)
 */
async function extractInstagramViaInstaDP(url: string, shortcode: string): Promise<SocialMediaExtractionResult> {
  // InstaDP provides a simple API for Instagram media extraction
  const response = await fetch(`https://www.instadp.com/api/media?url=${encodeURIComponent(url)}`, {
    headers: {
      'Accept': 'application/json'
    }
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  const data = await response.json() as any

  if (!data.success || !data.media) {
    throw new Error(data.message || 'No media found')
  }

  // Parse InstaDP response
  const mediaUrl = data.media.url || data.media.display_url
  const isVideo = data.media.is_video || false

  return {
    success: true,
    platform: 'instagram',
    postType: isVideo ? 'video' : 'image',
    mediaUrls: {
      [isVideo ? 'video' : 'thumbnail']: mediaUrl
    },
    downloadOptions: [{
      quality: 'Original',
      format: isVideo ? 'mp4' : 'jpg',
      url: mediaUrl,
      hasAudio: isVideo,
      hasVideo: isVideo
    }],
    metadata: {
      shortcode,
      extractedVia: 'InstaDP'
    }
  }
}

/**
 * Extract Instagram content via SaveInsta API (fallback)
 */
async function extractInstagramViaSaveInsta(url: string, shortcode: string): Promise<SocialMediaExtractionResult> {
  // SaveInsta provides Instagram download services
  const response = await fetchWithRetry(async () => {
    return await fetch('https://v3.saveinsta.app/api/ajaxSearch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': '*/*',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      body: `q=${encodeURIComponent(url)}&t=media&lang=en`
    })
  }, 2, 1000)

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  const data = await response.json() as any

  if (!data.data || data.status !== 'ok') {
    throw new Error('No media found')
  }

  // Parse HTML response similar to SnapInsta
  const html = data.data
  const videoMatch = html.match(/<a[^>]+href="([^"]+)"[^>]*class="[^"]*download-media[^"]*"[^>]*>[\s\S]*?Video/)
  const imageMatch = html.match(/<a[^>]+href="([^"]+)"[^>]*class="[^"]*download-media[^"]*"[^>]*>[\s\S]*?Photo/)

  const videoUrl = videoMatch ? videoMatch[1].replace(/&amp;/g, '&') : null
  const imageUrl = imageMatch ? imageMatch[1].replace(/&amp;/g, '&') : null

  if (!videoUrl && !imageUrl) {
    throw new Error('No downloadable media found in response')
  }

  const isVideo = !!videoUrl

  return {
    success: true,
    platform: 'instagram',
    postType: isVideo ? 'video' : 'image',
    mediaUrls: {
      [isVideo ? 'video' : 'thumbnail']: isVideo ? videoUrl : imageUrl
    },
    downloadOptions: [{
      quality: 'Original',
      format: isVideo ? 'mp4' : 'jpg',
      url: isVideo ? videoUrl : imageUrl,
      hasAudio: isVideo,
      hasVideo: isVideo
    }],
    metadata: {
      shortcode,
      extractedVia: 'SaveInsta'
    }
  }
}

/**
 * Extract Instagram content via official oEmbed API (metadata only, no download URLs)
 */
async function extractInstagramViaOEmbed(url: string, shortcode: string): Promise<SocialMediaExtractionResult> {
  const oembedUrl = `https://api.instagram.com/oembed/?url=${encodeURIComponent(url)}`

  const response = await fetch(oembedUrl, {
    headers: {
      'Accept': 'application/json'
    }
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  const data = await response.json() as any

  if (!data.thumbnail_url) {
    throw new Error('No thumbnail available')
  }

  // oEmbed doesn't provide direct download URLs, only embed code and thumbnails
  return {
    success: true,
    platform: 'instagram',
    postType: 'post',
    mediaUrls: {
      thumbnail: data.thumbnail_url
    },
    embedCode: data.html,
    metadata: {
      shortcode,
      title: data.title,
      author: data.author_name,
      authorUrl: data.author_url,
      width: data.thumbnail_width,
      height: data.thumbnail_height,
      extractedVia: 'Instagram oEmbed API (metadata only)',
      note: 'Direct download not available via oEmbed. Use embed code or thumbnail only.'
    }
  }
}

function extractInstagramShortcode(url: string): string | null {
  // Extract from URLs like:
  // https://www.instagram.com/p/ABC123/
  // https://www.instagram.com/reel/ABC123/
  const match = url.match(/instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/)
  return match ? match[1] : null
}

// ========================================
// TikTok Extraction
// ========================================

async function extractTikTok(url: string, mode: string): Promise<SocialMediaExtractionResult> {
  try {
    console.log('[TikTok] Starting extraction via cobalt.tools, mode:', mode, 'url:', url)

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
        })
      })

      if (!cobaltResponse.ok) {
        throw new Error(`Cobalt API returned status ${cobaltResponse.status}`)
      }

      return await cobaltResponse.json() as any
    }, 2, 1000)

    console.log('[TikTok] Cobalt response status:', cobaltData.status)

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
      error instanceof Error ? error.message : 'Unknown error',
      'TikTok video could not be extracted. The video may be private, deleted, or temporarily unavailable. Please try again later.'
    )
  }
}

// ========================================
// Twitter/X Extraction
// ========================================

async function extractTwitter(url: string, mode: string): Promise<SocialMediaExtractionResult> {
  try {
    console.log('[Twitter] Starting enhanced extraction, mode:', mode, 'url:', url)

    // Extract tweet ID from URL
    const tweetId = extractTweetId(url)
    if (!tweetId) {
      return createUserFriendlyError(
        'twitter',
        'Invalid URL format',
        'Could not find a valid tweet ID in the URL. Please use a standard Twitter/X link (e.g., twitter.com/user/status/123... or x.com/user/status/123...)'
      )
    }

    console.log('[Twitter] Extracted tweet ID:', tweetId)

    // Strategy 1: Try cobalt.tools for media downloads (if download mode)
    let cobaltData: any = null
    if (mode === 'download' || mode === 'full') {
      try {
        console.log('[Twitter] Attempting media extraction via cobalt.tools...')
        cobaltData = await fetchWithRetry(async () => {
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
            })
          })

          if (!cobaltResponse.ok) {
            throw new Error(`Cobalt API returned status ${cobaltResponse.status}`)
          }

          return await cobaltResponse.json() as any
        }, 2, 1000)

        console.log('[Twitter] Cobalt response status:', cobaltData?.status)
      } catch (cobaltError) {
        console.warn('[Twitter] Cobalt extraction failed:', cobaltError)
        // Continue with oEmbed even if cobalt fails
      }
    }

    // Strategy 2: Get metadata via Twitter oEmbed API
    const oembedData = await fetchWithRetry(async () => {
      const oembedUrl = `https://publish.twitter.com/oembed?url=${encodeURIComponent(url)}`
      const response = await fetch(oembedUrl)

      if (!response.ok) {
        throw new Error(`Twitter oEmbed API returned status ${response.status}`)
      }

      return await response.json() as any
    }, 2, 1000)

    // Parse tweet text from embed HTML
    const embedHtml = oembedData.html
    const tweetText = extractTweetTextFromHTML(embedHtml)
    const authorHandle = extractAuthorHandleFromHTML(embedHtml)

    console.log('[Twitter] Extracted text length:', tweetText?.length || 0)

    // Build media URLs from cobalt if available
    const mediaUrls: MediaUrls = {}
    const downloadOptions: DownloadOption[] = []

    if (cobaltData && (cobaltData.status === 'redirect' || cobaltData.status === 'stream' || cobaltData.status === 'picker')) {
      if (cobaltData.status === 'picker') {
        // Multiple media items (carousel)
        const images: string[] = []
        const videos: string[] = []

        for (const item of cobaltData.picker || []) {
          if (item.type === 'photo') {
            images.push(item.url)
            downloadOptions.push({
              quality: 'Original',
              format: 'jpg',
              url: item.url,
              hasAudio: false,
              hasVideo: false
            })
          } else if (item.type === 'video') {
            videos.push(item.url)
            downloadOptions.push({
              quality: 'Original',
              format: 'mp4',
              url: item.url,
              hasAudio: true,
              hasVideo: true
            })
          }
        }

        if (images.length > 0) mediaUrls.images = images
        if (videos.length > 0) mediaUrls.video = videos[0]
      } else if (cobaltData.url) {
        // Single media item
        const isVideo = cobaltData.url.includes('.mp4') || cobaltData.url.includes('video')

        if (isVideo) {
          mediaUrls.video = cobaltData.url
        } else {
          mediaUrls.images = [cobaltData.url]
        }

        downloadOptions.push({
          quality: isVideo ? 'Original' : 'High quality',
          format: isVideo ? 'mp4' : 'jpg',
          url: cobaltData.url,
          hasAudio: isVideo,
          hasVideo: isVideo
        })
      }
    }

    // Strategy 3: Try vxTwitter API as fallback for reliable image extraction
    if (!mediaUrls.images && !mediaUrls.video) {
      try {
        console.log('[Twitter] Attempting vxTwitter API fallback for media extraction...')

        // Extract username from URL for vxTwitter endpoint
        const usernameMatch = url.match(/(?:twitter\.com|x\.com)\/([^\/]+)\/status/)
        const username = usernameMatch ? usernameMatch[1] : 'Twitter'

        const vxData = await fetchWithRetry(async () => {
          const vxUrl = `https://api.vxtwitter.com/${username}/status/${tweetId}`
          const vxResponse = await fetch(vxUrl)

          if (!vxResponse.ok) {
            throw new Error(`VxTwitter API returned status ${vxResponse.status}`)
          }

          return await vxResponse.json() as any
        }, 2, 1000)

        console.log('[Twitter] VxTwitter response received, media count:', vxData.mediaURLs?.length || 0)

        // Map vxTwitter response to mediaUrls
        if (vxData.mediaURLs && vxData.mediaURLs.length > 0) {
          const images: string[] = []
          let videoUrl: string | undefined

          for (const mediaUrl of vxData.mediaURLs) {
            const isVideo = mediaUrl.includes('.mp4')

            if (isVideo) {
              videoUrl = mediaUrl
              downloadOptions.push({
                quality: 'Original',
                format: 'mp4',
                url: mediaUrl,
                hasAudio: true,
                hasVideo: true
              })
            } else {
              images.push(mediaUrl)
              downloadOptions.push({
                quality: 'Original',
                format: 'jpg',
                url: mediaUrl,
                hasAudio: false,
                hasVideo: false
              })
            }
          }

          if (images.length > 0) {
            mediaUrls.images = images
            mediaUrls.thumbnail = images[0]
          }
          if (videoUrl) {
            mediaUrls.video = videoUrl
          }

          console.log('[Twitter] Extracted from vxTwitter:', images.length, 'images,', videoUrl ? '1 video' : '0 videos')
        }

      } catch (vxError) {
        console.warn('[Twitter] VxTwitter API fallback failed:', vxError)
        // Continue to metadata even if vxTwitter fails
      }
    }

    // Build enhanced metadata
    const metadata: Record<string, any> = {
      tweetId,
      authorName: oembedData.author_name,
      authorHandle: authorHandle || oembedData.author_name,
      authorUrl: oembedData.author_url,
      text: tweetText || 'Unable to extract tweet text',
      tweetUrl: url,
      hasMedia: !!(mediaUrls.video || mediaUrls.images?.length),
      mediaCount: (mediaUrls.images?.length || 0) + (mediaUrls.video ? 1 : 0),
      width: oembedData.width,
      height: oembedData.height,
      extractedVia: cobaltData?.status === 'picker' || cobaltData?.url
        ? 'cobalt.tools + oEmbed'
        : (mediaUrls.images?.length || mediaUrls.video) && downloadOptions.length > 0
        ? 'vxTwitter + oEmbed'
        : 'oEmbed only'
    }

    // Determine post type
    let postType = 'tweet'
    if (tweetText?.includes('RT @') || tweetText?.toLowerCase().includes('retweet')) {
      postType = 'retweet'
    } else if (url.includes('/status/') && url.split('/').length > 6) {
      postType = 'reply'
    }

    return {
      success: true,
      platform: 'twitter',
      postType,
      mediaUrls: Object.keys(mediaUrls).length > 0 ? mediaUrls : undefined,
      downloadOptions: downloadOptions.length > 0 ? downloadOptions : undefined,
      embedCode: embedHtml,
      metadata
    }

  } catch (error) {
    console.error('[Twitter] Extraction failed:', error)
    return createUserFriendlyError(
      'twitter',
      error instanceof Error ? error.message : 'Unknown error',
      'Tweet could not be extracted. The tweet may be from a protected account, deleted, or temporarily unavailable. Try copying the tweet URL again or check if the account is public.'
    )
  }
}

// Helper: Extract tweet ID from various Twitter/X URL formats
function extractTweetId(url: string): string | null {
  const patterns = [
    /(?:twitter\.com|x\.com)\/(?:#!\/)?[\w]+\/status(?:es)?\/(\d+)/,
    /(?:twitter\.com|x\.com)\/[\w]+\/status\/(\d+)/
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match && match[1]) {
      return match[1]
    }
  }

  return null
}

// Helper: Extract tweet text from oEmbed HTML
function extractTweetTextFromHTML(html: string): string | null {
  try {
    // The oEmbed HTML contains a blockquote with the tweet text
    // Format: <blockquote class="twitter-tweet"><p lang="en" dir="ltr">TWEET TEXT HERE</p>&mdash; @author...

    // Extract content from <p> tag
    const pMatch = html.match(/<p[^>]*>(.*?)<\/p>/)
    if (pMatch && pMatch[1]) {
      // Clean up HTML entities and tags
      let text = pMatch[1]
        .replace(/<a[^>]*>(.*?)<\/a>/g, '$1') // Remove link tags but keep text
        .replace(/<br\s*\/?>/g, '\n') // Convert <br> to newlines
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&mdash;/g, '—')
        .trim()

      return text
    }

    return null
  } catch (error) {
    console.error('[Twitter] Failed to parse tweet text:', error)
    return null
  }
}

// Helper: Extract author handle from oEmbed HTML
function extractAuthorHandleFromHTML(html: string): string | null {
  try {
    // Look for @username pattern in the HTML
    const handleMatch = html.match(/@(\w+)/)
    if (handleMatch && handleMatch[1]) {
      return '@' + handleMatch[1]
    }

    return null
  } catch (error) {
    console.error('[Twitter] Failed to parse author handle:', error)
    return null
  }
}

// ========================================
// Bluesky (AT Protocol) Extraction
// ========================================

async function extractBluesky(url: string, mode: string): Promise<SocialMediaExtractionResult> {
  try {
    console.log('[Bluesky] Starting extraction, mode:', mode, 'url:', url)

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

    console.log('[Bluesky] Extracted - handle:', handle, 'rkey:', rkey)

    // Fetch post using Bluesky public API
    const postData = await fetchWithRetry(async () => {
      // First resolve the handle to DID if needed
      let did = handle
      if (!handle.startsWith('did:')) {
        const resolveUrl = `https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`
        const resolveResponse = await fetch(resolveUrl)
        if (!resolveResponse.ok) {
          throw new Error(`Failed to resolve handle: ${resolveResponse.status}`)
        }
        const resolveData = await resolveResponse.json() as any
        did = resolveData.did
        console.log('[Bluesky] Resolved handle to DID:', did)
      }

      // Now fetch the post
      const postUrl = `https://public.api.bsky.app/xrpc/app.bsky.feed.getPostThread?uri=at://${did}/app.bsky.feed.post/${rkey}&depth=0`
      const postResponse = await fetch(postUrl)

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
      error instanceof Error ? error.message : 'Unknown error',
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
