/**
 * Social Media Extraction Endpoint
 *
 * Provides specialized extraction for social media platforms:
 * - YouTube: Video download URLs, transcripts, metadata
 * - Instagram: Post media, captions, engagement metrics
 * - TikTok: Video URLs, metadata (via external API)
 * - Twitter/X: Tweet data, media URLs
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
            return await extractInstagram(url, mode)
          case 'tiktok':
            return await extractTikTok(url, mode)
          case 'twitter':
          case 'x':
            return await extractTwitter(url, mode)
          default:
            return createUserFriendlyError(
              platform,
              `Platform '${platform}' not supported`,
              `Sorry, ${platform} extraction is not yet available. Supported platforms: YouTube, Instagram, TikTok, Twitter/X.`
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
async function fetchYouTubeTranscript(videoId: string): Promise<string> {
  try {
    // Try to get English transcript
    const transcriptUrl = `https://www.youtube.com/api/timedtext?lang=en&v=${videoId}`

    const response = await fetch(transcriptUrl)

    if (!response.ok) {
      throw new Error('Transcript API returned error')
    }

    const text = await response.text()

    // Parse XML transcript
    // Extract text from <text> tags
    const textMatches = text.match(/<text[^>]*>(.*?)<\/text>/g)

    if (!textMatches || textMatches.length === 0) {
      throw new Error('No transcript text found')
    }

    // Clean up the text
    const transcript = textMatches
      .map(match => {
        // Extract text content
        const content = match.replace(/<text[^>]*>/, '').replace(/<\/text>/, '')
        // Decode HTML entities
        return content
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .trim()
      })
      .filter(line => line.length > 0)
      .join(' ')

    return transcript || 'Transcript fetched but appears to be empty.'

  } catch (error) {
    console.error('[YouTube Transcript] Error:', error)
    throw new Error('Could not fetch transcript. Video may not have captions available.')
  }
}

// ========================================
// Instagram Extraction
// ========================================

async function extractInstagram(url: string, mode: string): Promise<SocialMediaExtractionResult> {
  // Extract shortcode for metadata
  const shortcode = extractInstagramShortcode(url)
  if (!shortcode) {
    return createUserFriendlyError(
      'instagram',
      'Invalid URL format',
      'Could not find a valid Instagram post ID in the URL. Please use a standard Instagram link (e.g., instagram.com/p/...).'
    )
  }

  const errors: string[] = []

  // Strategy 1: Try cobalt.tools (primary method)
  try {
    console.log('[Instagram] Attempting extraction via cobalt.tools, mode:', mode, 'url:', url)
    return await extractInstagramViaCobalt(url, shortcode, mode)
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    console.warn('[Instagram] Cobalt.tools failed:', errorMsg)
    errors.push(`cobalt.tools: ${errorMsg}`)
  }

  // Strategy 2: Try InstaDP API (fallback)
  try {
    console.log('[Instagram] Attempting fallback extraction via InstaDP')
    return await extractInstagramViaInstaDP(url, shortcode)
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    console.warn('[Instagram] InstaDP failed:', errorMsg)
    errors.push(`InstaDP: ${errorMsg}`)
  }

  // Strategy 3: Try oEmbed API (metadata only)
  try {
    console.log('[Instagram] Attempting fallback via Instagram oEmbed API')
    return await extractInstagramViaOEmbed(url, shortcode)
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    console.warn('[Instagram] oEmbed failed:', errorMsg)
    errors.push(`oEmbed: ${errorMsg}`)
  }

  // All strategies failed - return comprehensive error
  console.error('[Instagram] All extraction methods failed:', errors)

  // Determine likely failure reason based on error patterns
  let friendlyMessage = 'Instagram post could not be extracted.'
  let diagnostics = errors.join('; ')

  if (errors.some(e => e.includes('429') || e.includes('rate limit'))) {
    friendlyMessage += ' The service is temporarily rate-limited. Please try again in a few minutes.'
  } else if (errors.some(e => e.includes('404') || e.includes('not found'))) {
    friendlyMessage += ' The post may have been deleted or the URL is incorrect.'
  } else if (errors.some(e => e.includes('403') || e.includes('private'))) {
    friendlyMessage += ' The post may be private or require authentication.'
  } else {
    friendlyMessage += ' The post may be private, deleted, or Instagram may be blocking automated access. You can try: (1) Waiting a few minutes and trying again, (2) Downloading manually from Instagram and uploading the media, (3) Using the Instagram embed URL instead.'
  }

  return createUserFriendlyError(
    'instagram',
    diagnostics,
    friendlyMessage
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
    console.log('[Twitter] Starting extraction via oEmbed API, mode:', mode, 'url:', url)

    // Twitter oEmbed API with retry logic
    const data = await fetchWithRetry(async () => {
      const oembedUrl = `https://publish.twitter.com/oembed?url=${encodeURIComponent(url)}`
      const response = await fetch(oembedUrl)

      if (!response.ok) {
        throw new Error(`Twitter oEmbed API returned status ${response.status}`)
      }

      return await response.json() as any
    }, 2, 1000)

    return {
      success: true,
      platform: 'twitter',
      postType: 'tweet',
      embedCode: data.html,
      metadata: {
        authorName: data.author_name,
        authorUrl: data.author_url,
        html: data.html,
        width: data.width,
        height: data.height,
        providerName: data.provider_name,
        providerUrl: data.provider_url,
        note: 'Download not available via official API - embed only'
      }
    }

  } catch (error) {
    console.error('[Twitter] Extraction failed:', error)
    return createUserFriendlyError(
      'twitter',
      error instanceof Error ? error.message : 'Unknown error',
      'Tweet could not be extracted. The tweet may be from a protected account, deleted, or temporarily unavailable. Note: Direct downloads are not available for Twitter - embed code only.'
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
