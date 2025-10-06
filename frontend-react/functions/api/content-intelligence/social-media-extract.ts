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
import { InstagramScraper } from '@aduptive/instagram-scraper'

interface Env {
  DB: D1Database
  OPENAI_API_KEY: string
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

    // Route to platform-specific extraction
    let result: SocialMediaExtractionResult

    switch (platform) {
      case 'youtube':
        result = await extractYouTube(url, mode)
        break
      case 'instagram':
        result = await extractInstagram(url, mode)
        break
      case 'tiktok':
        result = await extractTikTok(url, mode)
        break
      case 'twitter':
      case 'x':
        result = await extractTwitter(url, mode)
        break
      default:
        result = {
          success: false,
          platform,
          error: `Platform '${platform}' extraction not yet implemented`
        }
    }

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
      return {
        success: false,
        platform: 'youtube',
        error: 'Could not extract video ID from URL'
      }
    }

    console.log('[YouTube] Video ID:', videoId)

    // Use YouTube oEmbed API for reliable metadata
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
    const oembedResponse = await fetch(oembedUrl)

    if (!oembedResponse.ok) {
      throw new Error('YouTube oEmbed API failed')
    }

    const oembedData = await oembedResponse.json() as any

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

        if (cobaltResponse.ok) {
          const cobaltData = await cobaltResponse.json() as any
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
          }
        } else {
          console.warn('[YouTube] Cobalt API failed, providing direct YouTube link')
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
    return {
      success: false,
      platform: 'youtube',
      error: error instanceof Error ? error.message : 'YouTube extraction failed'
    }
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
  try {
    const scraper = new InstagramScraper()

    // Extract shortcode from URL
    const shortcode = extractInstagramShortcode(url)
    if (!shortcode) {
      return {
        success: false,
        platform: 'instagram',
        error: 'Could not extract Instagram post shortcode from URL'
      }
    }

    // Fetch post data
    const postData = await scraper.getPost(shortcode)

    if (!postData) {
      return {
        success: false,
        platform: 'instagram',
        error: 'Failed to fetch Instagram post data. Post may be private or deleted.'
      }
    }

    // Extract media URLs
    const mediaUrls: MediaUrls = {}
    const images: string[] = []

    if (postData.display_url) {
      mediaUrls.thumbnail = postData.display_url
      images.push(postData.display_url)
    }

    if (postData.video_url) {
      mediaUrls.video = postData.video_url
    }

    // Check for carousel (multiple images)
    if (postData.edge_sidecar_to_children?.edges) {
      postData.edge_sidecar_to_children.edges.forEach((edge: any) => {
        if (edge.node?.display_url) {
          images.push(edge.node.display_url)
        }
        if (edge.node?.video_url && !mediaUrls.video) {
          mediaUrls.video = edge.node.video_url
        }
      })
    }

    mediaUrls.images = images

    // Create download options
    const downloadOptions: DownloadOption[] = []

    if (mediaUrls.video) {
      downloadOptions.push({
        quality: 'Original',
        format: 'mp4',
        url: mediaUrls.video,
        hasAudio: true,
        hasVideo: true
      })
    }

    images.forEach((imgUrl, index) => {
      downloadOptions.push({
        quality: 'Original',
        format: 'jpg',
        url: imgUrl,
        hasVideo: false,
        hasAudio: false
      })
    })

    // oEmbed for embed code
    let embedCode: string | undefined
    try {
      const oembedUrl = `https://graph.facebook.com/v8.0/instagram_oembed?url=${encodeURIComponent(url)}&access_token=YOUR_TOKEN`
      // Placeholder - would need Instagram Graph API token
      embedCode = `<!-- Instagram embed requires Graph API token -->`
    } catch {}

    return {
      success: true,
      platform: 'instagram',
      postType: mediaUrls.video ? 'video' : (images.length > 1 ? 'carousel' : 'image'),
      mediaUrls,
      downloadOptions,
      embedCode,
      metadata: {
        shortcode,
        caption: postData.edge_media_to_caption?.edges?.[0]?.node?.text,
        likeCount: postData.edge_media_preview_like?.count || 0,
        commentCount: postData.edge_media_to_comment?.count || 0,
        timestamp: postData.taken_at_timestamp,
        owner: postData.owner?.username,
        ownerId: postData.owner?.id,
        isVideo: !!postData.video_url,
        dimensions: {
          height: postData.dimensions?.height,
          width: postData.dimensions?.width
        }
      }
    }

  } catch (error) {
    console.error('[Instagram] Extraction failed:', error)
    return {
      success: false,
      platform: 'instagram',
      error: error instanceof Error ? error.message : 'Instagram extraction failed. Post may be private or require login.'
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
    // TikTok extraction requires external service (cobalt.tools API)
    // or complex scraping due to anti-bot measures

    // Attempt to use cobalt.tools API (free, open-source)
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
      throw new Error('Cobalt API request failed')
    }

    const cobaltData = await cobaltResponse.json() as any

    if (cobaltData.status !== 'success' && cobaltData.status !== 'redirect') {
      throw new Error(cobaltData.text || 'TikTok extraction failed')
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
        note: 'TikTok metadata requires additional API calls'
      }
    }

  } catch (error) {
    console.error('[TikTok] Extraction failed:', error)
    return {
      success: false,
      platform: 'tiktok',
      error: error instanceof Error ? error.message : 'TikTok extraction failed. Try using an external downloader.'
    }
  }
}

// ========================================
// Twitter/X Extraction
// ========================================

async function extractTwitter(url: string, mode: string): Promise<SocialMediaExtractionResult> {
  try {
    // Twitter oEmbed API
    const oembedUrl = `https://publish.twitter.com/oembed?url=${encodeURIComponent(url)}`

    const response = await fetch(oembedUrl)

    if (!response.ok) {
      throw new Error('Twitter oEmbed API failed')
    }

    const data = await response.json() as any

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
        providerUrl: data.provider_url
      }
    }

  } catch (error) {
    console.error('[Twitter] Extraction failed:', error)
    return {
      success: false,
      platform: 'twitter',
      error: error instanceof Error ? error.message : 'Twitter extraction failed'
    }
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
