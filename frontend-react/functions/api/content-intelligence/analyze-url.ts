/**
 * Content Intelligence - URL Analysis Endpoint
 *
 * Features:
 * - URL content extraction with timeout handling
 * - PDF analysis with intelligent chunking for large documents
 * - Word frequency analysis (2-10 word phrases)
 * - Entity extraction with GPT
 * - Immediate bypass/archive link generation
 * - Social media detection
 * - Optional link saving with notes
 */

import type { PagesFunction } from '@cloudflare/workers-types'
import { isPDFUrl, extractPDFText, intelligentPDFSummary } from './pdf-extractor'
import { getUserIdOrDefault } from '../_shared/auth-helpers'

interface Env {
  DB: D1Database
  OPENAI_API_KEY: string
  SESSIONS?: KVNamespace
}

interface AnalyzeUrlRequest {
  url: string
  mode?: 'quick' | 'full' | 'forensic'
  save_link?: boolean
  link_note?: string
  link_tags?: string[]
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  try {
    console.log('[DEBUG] Starting analyze-url endpoint')
    console.log(`[DEBUG] Request method: ${request.method}`)
    console.log(`[DEBUG] Request URL: ${request.url}`)

    // Check environment bindings
    console.log(`[DEBUG] Environment check:`)
    console.log(`[DEBUG]   - DB: ${!!env.DB}`)
    console.log(`[DEBUG]   - OPENAI_API_KEY: ${!!env.OPENAI_API_KEY}`)

    if (!env.DB) {
      console.error('[DEBUG] CRITICAL: Database binding not available!')
      return new Response(JSON.stringify({
        error: 'Database not configured',
        details: 'Database binding is not available in environment'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (!env.OPENAI_API_KEY) {
      console.error('[DEBUG] WARNING: OpenAI API key not available!')
    }

    // Get workspace and user authentication
    const workspaceId = request.headers.get('X-Workspace-ID') || '1'
    const userHash = request.headers.get('X-User-Hash')
    const authToken = request.headers.get('Authorization')?.replace('Bearer ', '')

    console.log(`[DEBUG] Auth: workspace=${workspaceId}, userHash=${!!userHash}, authToken=${!!authToken}`)

    // Determine user_id using shared auth helper
    // Supports both session-based and hash-based authentication
    const userId = await getUserIdOrDefault(request, env)
    const bookmarkHash: string | null = userHash || null

    // Parse request
    let body: AnalyzeUrlRequest
    try {
      body = await request.json() as AnalyzeUrlRequest
      console.log(`[DEBUG] Request body parsed: ${JSON.stringify({ url: body.url, mode: body.mode })}`)
    } catch (error) {
      console.error('[DEBUG] Failed to parse request body:', error)
      return new Response(JSON.stringify({
        error: 'Invalid request body',
        details: error instanceof Error ? error.message : 'Failed to parse JSON'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const { url, mode = 'full', save_link = false, link_note, link_tags, load_existing = false, analysis_id } = body

    // If load_existing is true, fetch and return existing analysis
    if (load_existing && analysis_id) {
      console.log(`[DEBUG] Loading existing analysis ID: ${analysis_id}`)
      try {
        const result = await env.DB.prepare(`
          SELECT * FROM content_analysis WHERE id = ?
        `).bind(analysis_id).first()

        if (!result) {
          return new Response(JSON.stringify({ error: 'Analysis not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
          })
        }

        // Parse JSON fields
        const analysis = {
          ...result,
          entities: JSON.parse(result.entities as string || '{}'),
          word_frequency: JSON.parse(result.word_frequency as string || '{}'),
          sentiment_analysis: result.sentiment_analysis ? JSON.parse(result.sentiment_analysis as string) : null,
          keyphrases: result.keyphrases ? JSON.parse(result.keyphrases as string) : null,
          topics: result.topics ? JSON.parse(result.topics as string) : null
        }

        console.log(`[DEBUG] Loaded existing analysis for URL: ${result.url}`)
        return new Response(JSON.stringify({ analysis }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      } catch (error) {
        console.error('[DEBUG] Failed to load existing analysis:', error)
        return new Response(JSON.stringify({
          error: 'Failed to load analysis',
          details: error instanceof Error ? error.message : 'Unknown error'
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        })
      }
    }

    if (!url) {
      console.error('[DEBUG] No URL provided')
      return new Response(JSON.stringify({ error: 'URL is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log(`[DEBUG] Analyzing URL: ${url} (mode: ${mode}, save_link: ${save_link})`)

    const startTime = Date.now()

    // Normalize URL
    console.log('[DEBUG] Normalizing URL...')
    const normalizedUrl = normalizeUrl(url)
    console.log(`[DEBUG] Normalized URL: ${normalizedUrl}`)

    // Detect social media
    console.log('[DEBUG] Detecting social media...')
    const socialMediaInfo = detectSocialMedia(url)
    console.log(`[DEBUG] Social media detected: ${JSON.stringify(socialMediaInfo)}`)

    // Generate bypass/archive links immediately (no API calls needed)
    console.log('[DEBUG] Generating bypass/archive URLs...')
    const bypassUrls = generateBypassUrls(normalizedUrl)
    const archiveUrls = generateArchiveUrls(normalizedUrl)
    console.log('[DEBUG] Bypass/archive URLs generated')

    // Extract content with timeout
    console.log('[DEBUG] Extracting URL content...')
    const contentData = await extractUrlContent(normalizedUrl, env.OPENAI_API_KEY)
    console.log(`[DEBUG] Content extraction result: success=${contentData.success}, isPDF=${contentData.isPDF}`)

    if (!contentData.success) {
      console.error(`[DEBUG] Content extraction failed: ${contentData.error}`)

      // Provide user-friendly error message
      let userMessage = contentData.error || 'Failed to extract content'
      if (userMessage.includes('timeout')) {
        userMessage = 'The website took too long to respond. Try using one of the bypass URLs below.'
      } else if (userMessage.includes('403') || userMessage.includes('401')) {
        userMessage = 'The website blocked access. Try using one of the bypass URLs below.'
      } else if (userMessage.includes('404')) {
        userMessage = 'The page was not found. Please check the URL.'
      } else if (userMessage.includes('500') || userMessage.includes('502') || userMessage.includes('503')) {
        userMessage = 'The website is experiencing issues. Try again later or use a bypass URL.'
      }

      return new Response(JSON.stringify({
        error: userMessage,
        technical_error: contentData.error,
        suggestion: 'Try using one of the bypass or archive URLs to access the content',
        bypass_urls: bypassUrls,
        archive_urls: archiveUrls
      }), {
        status: 422, // Use 422 instead of 500 for content extraction failures
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log(`[DEBUG] Content extracted: ${contentData.text.length} characters`)

    // Calculate content hash
    const contentHash = await calculateHash(contentData.text)
    console.log(`[DEBUG] Content hash: ${contentHash}`)

    // Check for duplicate content in this workspace
    console.log('[DEBUG] Checking for duplicate content...')
    const dedupCheck = await env.DB.prepare(`
      SELECT canonical_content_id, duplicate_count
      FROM content_deduplication
      WHERE content_hash = ?
    `).bind(contentHash).first()

    if (dedupCheck) {
      console.log(`[DEBUG] Duplicate content found! canonical_id=${dedupCheck.canonical_content_id}`)

      // Update access stats
      await env.DB.prepare(`
        UPDATE content_deduplication
        SET total_access_count = total_access_count + 1,
            duplicate_count = duplicate_count + 1,
            last_accessed_at = datetime('now')
        WHERE content_hash = ?
      `).bind(contentHash).run()

      await env.DB.prepare(`
        UPDATE content_analysis
        SET access_count = access_count + 1,
            last_accessed_at = datetime('now')
        WHERE id = ?
      `).bind(dedupCheck.canonical_content_id).run()

      // Return existing analysis
      const existingAnalysis = await env.DB.prepare(`
        SELECT * FROM content_analysis WHERE id = ?
      `).bind(dedupCheck.canonical_content_id).first()

      if (existingAnalysis) {
        console.log('[DEBUG] Returning cached analysis (deduped)')
        return new Response(JSON.stringify({
          ...existingAnalysis,
          entities: JSON.parse(existingAnalysis.entities as string || '{}'),
          word_frequency: JSON.parse(existingAnalysis.word_frequency as string || '{}'),
          top_phrases: JSON.parse(existingAnalysis.top_phrases as string || '[]'),
          sentiment_analysis: existingAnalysis.sentiment_analysis ? JSON.parse(existingAnalysis.sentiment_analysis as string) : null,
          keyphrases: existingAnalysis.keyphrases ? JSON.parse(existingAnalysis.keyphrases as string) : null,
          topics: existingAnalysis.topics ? JSON.parse(existingAnalysis.topics as string) : null,
          archive_urls: JSON.parse(existingAnalysis.archive_urls as string || '{}'),
          bypass_urls: JSON.parse(existingAnalysis.bypass_urls as string || '{}'),
          from_cache: true,
          cache_hit_count: dedupCheck.duplicate_count
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      }
    }

    // Word frequency analysis (2-10 word phrases)
    const wordFrequency = analyzeWordFrequency(contentData.text)
    const topPhrases = getTopPhrases(wordFrequency, 10)

    // For quick mode, return basic results immediately
    if (mode === 'quick') {
      console.log('[DEBUG] Quick mode - saving link if requested...')

      // Optionally save link for quick mode
      let savedLinkId: number | undefined
      if (save_link) {
        try {
          console.log('[DEBUG] Saving link with title:', contentData.title)
          savedLinkId = await saveLinkToLibrary(env.DB, {
            user_id: userId,
            workspace_id: workspaceId,
            bookmark_hash: bookmarkHash,
            url: normalizedUrl,
            title: contentData.title || new URL(normalizedUrl).hostname,
            note: link_note,
            tags: link_tags,
            domain: new URL(normalizedUrl).hostname,
            is_social_media: !!socialMediaInfo,
            social_platform: socialMediaInfo?.platform,
            is_processed: false, // Quick mode doesn't do full processing
            analysis_id: undefined
          })
          console.log(`[DEBUG] Quick mode link saved with ID: ${savedLinkId}`)
        } catch (error) {
          console.error('[DEBUG] Quick mode link save failed (non-fatal):', error)
          // Don't fail the whole request if link save fails
        }
      }

      const quickResult = {
        url: normalizedUrl,
        title: contentData.title,
        author: contentData.author,
        publish_date: contentData.publishDate,
        domain: new URL(normalizedUrl).hostname,
        extracted_text: contentData.text.substring(0, 5000), // First 5KB
        word_count: countWords(contentData.text),
        content_hash: contentHash,
        top_phrases: topPhrases.slice(0, 5),
        bypass_urls: bypassUrls,
        archive_urls: archiveUrls,
        is_social_media: !!socialMediaInfo,
        social_platform: socialMediaInfo?.platform,
        processing_mode: mode,
        processing_duration_ms: Date.now() - startTime,
        saved_link_id: savedLinkId
      }

      console.log('[DEBUG] Quick mode complete, returning result')
      return new Response(JSON.stringify(quickResult), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Full mode: Extract entities and generate summary with GPT
    let entitiesData = {
      people: [],
      organizations: [],
      locations: [],
      dates: [],
      money: [],
      events: [],
      products: [],
      percentages: []
    }
    let summary = ''

    try {
      console.log('[DEBUG] Calling extractEntities with GPT...')
      console.log(`[DEBUG] API Key available: ${!!env.OPENAI_API_KEY}`)
      console.log(`[DEBUG] Text length: ${contentData.text.length}`)

      entitiesData = await extractEntities(contentData.text, env.OPENAI_API_KEY, contentData.author)
      console.log(`[DEBUG] Entities extracted: ${JSON.stringify(entitiesData)}`)
    } catch (error) {
      console.error('[DEBUG] Entity extraction failed:', error)
      console.error('[DEBUG] Continuing with empty entities...')
      // Continue with empty entities rather than failing
    }

    try {
      console.log('[DEBUG] Calling generateSummary with GPT...')

      // For large PDFs (>2000 words), use intelligent chunking
      if (contentData.isPDF && wordCount > 2000) {
        console.log('[DEBUG] Large PDF detected, using intelligent summarization')
        const intelligentResult = await intelligentPDFSummary(
          contentData.text,
          wordCount,
          env.OPENAI_API_KEY
        )
        summary = intelligentResult.summary

        // Store additional PDF metadata if available
        if (intelligentResult.chapters) {
          contentData.pdfMetadata = {
            ...contentData.pdfMetadata,
            chapters: intelligentResult.chapters,
            keyPoints: intelligentResult.keyPoints
          }
        }

        console.log(`[DEBUG] Intelligent summary generated with ${intelligentResult.chapters?.length || 0} chapters`)
      } else {
        summary = await generateSummary(contentData.text, env.OPENAI_API_KEY)
      }

      console.log(`[DEBUG] Summary generated: ${summary?.substring(0, 100)}...`)
    } catch (error) {
      console.error('[DEBUG] Summary generation failed:', error)
      console.error('[DEBUG] Continuing without summary...')
      // Continue without summary rather than failing
    }

    // Sentiment analysis
    let sentimentData
    try {
      console.log('[DEBUG] Calling analyzeSentiment with GPT...')
      sentimentData = await analyzeSentiment(contentData.text, env.OPENAI_API_KEY)
      console.log(`[DEBUG] Sentiment analyzed: ${sentimentData.overall} (score: ${sentimentData.score})`)
    } catch (error) {
      console.error('[DEBUG] Sentiment analysis failed:', error)
      console.error('[DEBUG] Continuing without sentiment...')
      // Continue without sentiment rather than failing
    }

    // Keyphrase extraction
    let keyphrases
    try {
      console.log('[DEBUG] Calling extractKeyphrases with GPT...')
      keyphrases = await extractKeyphrases(contentData.text, env.OPENAI_API_KEY)
      console.log(`[DEBUG] Keyphrases extracted: ${keyphrases.length} phrases`)
    } catch (error) {
      console.error('[DEBUG] Keyphrase extraction failed:', error)
      console.error('[DEBUG] Continuing without keyphrases...')
      // Continue without keyphrases rather than failing
    }

    // Topic modeling
    let topics
    try {
      console.log('[DEBUG] Calling extractTopics with GPT...')
      topics = await extractTopics(contentData.text, env.OPENAI_API_KEY)
      console.log(`[DEBUG] Topics extracted: ${topics.length} topics`)
    } catch (error) {
      console.error('[DEBUG] Topic extraction failed:', error)
      console.error('[DEBUG] Continuing without topics...')
      // Continue without topics rather than failing
    }

    // Save to database
    console.log('[DEBUG] Saving to database...')
    let analysisId: number
    try {
      analysisId = await saveAnalysis(env.DB, {
      user_id: userId,
      bookmark_hash: bookmarkHash,
      workspace_id: workspaceId,
      url: normalizedUrl,
      content_hash: contentHash,
      title: contentData.title,
      author: contentData.author,
      publish_date: contentData.publishDate,
      domain: new URL(normalizedUrl).hostname,
      is_social_media: !!socialMediaInfo,
      social_platform: socialMediaInfo?.platform,
      extracted_text: contentData.text,
      summary,
      word_count: countWords(contentData.text),
      word_frequency: wordFrequency,
      top_phrases: topPhrases,
      entities: entitiesData,
      sentiment_analysis: sentimentData,
      keyphrases: keyphrases,
      topics: topics,
      archive_urls: archiveUrls,
      bypass_urls: bypassUrls,
      processing_mode: mode,
      processing_duration_ms: Date.now() - startTime,
      gpt_model_used: 'gpt-4o-mini'
    })
      console.log(`[DEBUG] Saved to database with ID: ${analysisId}`)

      // Create deduplication entry for new content
      await env.DB.prepare(`
        INSERT INTO content_deduplication (
          content_hash, canonical_content_id, duplicate_count,
          total_access_count, first_analyzed_at, last_accessed_at
        ) VALUES (?, ?, 1, 1, datetime('now'), datetime('now'))
      `).bind(contentHash, analysisId).run()

      console.log('[DEBUG] Deduplication entry created')
    } catch (error) {
      console.error('[DEBUG] Database save failed:', error)
      console.error('[DEBUG] Error details:', error instanceof Error ? error.message : String(error))
      throw new Error(`Database save failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    // Optionally save link
    let savedLinkId: number | undefined
    if (save_link) {
      try {
        console.log('[DEBUG] Saving link to library...')
        savedLinkId = await saveLinkToLibrary(env.DB, {
          user_id: userId,
          workspace_id: workspaceId,
          bookmark_hash: bookmarkHash,
          url: normalizedUrl,
          title: contentData.title,
          note: link_note,
          tags: link_tags,
          domain: new URL(normalizedUrl).hostname,
          is_social_media: !!socialMediaInfo,
          social_platform: socialMediaInfo?.platform,
          is_processed: true,
          analysis_id: analysisId
        })
        console.log(`[DEBUG] Link saved with ID: ${savedLinkId}`)
      } catch (error) {
        console.error('[DEBUG] Link save failed (non-fatal):', error)
        // Don't fail the whole request if link save fails
      }
    }

    const result = {
      id: analysisId,
      saved_link_id: savedLinkId,
      url: normalizedUrl,
      url_normalized: normalizedUrl,
      content_hash: contentHash,
      title: contentData.title,
      author: contentData.author,
      publish_date: contentData.publishDate,
      domain: new URL(normalizedUrl).hostname,
      is_social_media: !!socialMediaInfo,
      social_platform: socialMediaInfo?.platform,
      extracted_text: contentData.text,
      summary,
      word_count: countWords(contentData.text),
      word_frequency: wordFrequency,
      top_phrases: topPhrases,
      entities: entitiesData,
      sentiment_analysis: sentimentData,
      keyphrases: keyphrases,
      topics: topics,
      archive_urls: archiveUrls,
      bypass_urls: bypassUrls,
      processing_mode: mode,
      processing_duration_ms: Date.now() - startTime,
      gpt_model_used: 'gpt-4o-mini'
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('[DEBUG] CRITICAL ERROR in analyze-url:', error)
    console.error('[DEBUG] Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    console.error('[DEBUG] Error name:', error instanceof Error ? error.name : 'Unknown')
    console.error('[DEBUG] Error message:', error instanceof Error ? error.message : String(error))

    return new Response(JSON.stringify({
      error: 'Analysis failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      errorName: error instanceof Error ? error.name : 'Unknown',
      stack: error instanceof Error ? error.stack : undefined
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// ========================================
// Helper Functions
// ========================================

function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url)
    // Remove tracking parameters, fragments, etc.
    parsed.hash = ''
    // Sort query params for consistency
    parsed.searchParams.sort()
    return parsed.toString()
  } catch {
    // If parsing fails, prepend https://
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return `https://${url}`
    }
    return url
  }
}

function detectSocialMedia(url: string): { platform: string } | null {
  const urlLower = url.toLowerCase()

  if (urlLower.includes('twitter.com') || urlLower.includes('x.com')) {
    return { platform: 'twitter' }
  }
  if (urlLower.includes('facebook.com')) {
    return { platform: 'facebook' }
  }
  if (urlLower.includes('instagram.com')) {
    return { platform: 'instagram' }
  }
  if (urlLower.includes('linkedin.com')) {
    return { platform: 'linkedin' }
  }
  if (urlLower.includes('tiktok.com')) {
    return { platform: 'tiktok' }
  }
  if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be')) {
    return { platform: 'youtube' }
  }
  if (urlLower.includes('reddit.com')) {
    return { platform: 'reddit' }
  }

  return null
}

function generateBypassUrls(url: string): Record<string, string> {
  const encoded = encodeURIComponent(url)
  return {
    '12ft': `https://12ft.io/proxy?q=${encoded}`
  }
}

function generateArchiveUrls(url: string): Record<string, string> {
  const encoded = encodeURIComponent(url)
  return {
    wayback: `https://web.archive.org/web/*/${url}`,
    archive_is: `https://archive.is/${url}`,
    screenshot: `/api/content-intelligence/screenshot?url=${encoded}` // TODO: Implement
  }
}

async function extractUrlContent(url: string, apiKey?: string): Promise<{
  success: boolean
  error?: string
  text: string
  title?: string
  author?: string
  publishDate?: string
  isPDF?: boolean
  pdfMetadata?: {
    pageCount?: number
    keywords?: string[]
    chapters?: string[]
    keyPoints?: string[]
  }
}> {
  // Check if URL is a PDF
  if (isPDFUrl(url)) {
    console.log('[Content Extract] Detected PDF URL, using PDF extractor')
    try {
      const pdfResult = await extractPDFText(url)

      return {
        success: true,
        text: pdfResult.text,
        title: pdfResult.metadata?.title,
        author: pdfResult.metadata?.author,
        isPDF: true,
        pdfMetadata: {
          pageCount: pdfResult.metadata?.pageCount,
          keywords: pdfResult.metadata?.keywords
        }
      }
    } catch (pdfError) {
      console.error('[Content Extract] PDF extraction failed:', pdfError)
      return {
        success: false,
        error: pdfError instanceof Error ? pdfError.message : 'PDF extraction failed',
        text: '',
        isPDF: true
      }
    }
  }

  // Standard HTML extraction
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 15000) // 15s timeout

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ResearchToolsBot/1.0)'
      },
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
        text: ''
      }
    }

    const html = await response.text()

    // Parse HTML (simple extraction, can be enhanced)
    const title = extractMetaTag(html, 'title')
    const author = extractMetaTag(html, 'author')
    const publishDate = extractMetaTag(html, 'article:published_time') ||
                       extractMetaTag(html, 'publishdate')

    // Extract main text (remove scripts, styles, nav, footer)
    const cleanText = cleanHtmlText(html)

    return {
      success: true,
      text: cleanText,
      title,
      author,
      publishDate
    }

  } catch (error) {
    clearTimeout(timeoutId)

    if (error instanceof Error && error.name === 'AbortError') {
      return {
        success: false,
        error: 'Request timeout - page took too long to load',
        text: ''
      }
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      text: ''
    }
  }
}

function extractMetaTag(html: string, tag: string): string | undefined {
  const patterns = [
    new RegExp(`<meta[^>]*name=["']${tag}["'][^>]*content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]*property=["']${tag}["'][^>]*content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*name=["']${tag}["']`, 'i'),
    new RegExp(`<title>([^<]+)</title>`, 'i')
  ]

  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (match && match[1]) {
      return match[1].trim()
    }
  }

  return undefined
}

function cleanHtmlText(html: string): string {
  // Remove scripts, styles, and other non-content tags
  let text = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, '')
    .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, '')
    .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, '') // Remove headers (often contain bylines)
    .replace(/<[^>]+>/g, ' ') // Remove all HTML tags
    .replace(/&nbsp;/g, ' ')
    .replace(/&[a-z]+;/g, ' ') // Remove HTML entities
    .replace(/\s+/g, ' ') // Collapse whitespace
    .trim()

  // Remove common byline patterns that might remain
  text = text
    .replace(/\b(?:By|Written by|Author:|Reporter:|Reported by)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/gi, '')
    .replace(/\bPublished\s+\d{1,2}\s+(?:hours?|minutes?|days?)\s+ago\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()

  return text
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(w => w.length > 0).length
}

async function calculateHash(text: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(text)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

function analyzeWordFrequency(text: string): Record<string, number> {
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2) // Ignore very short words

  const frequency: Record<string, number> = {}

  // First, add single word frequencies
  const stopWords = new Set([
    'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i',
    'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
    'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she',
    'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what',
    'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me',
    'when', 'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know', 'take',
    'people', 'into', 'year', 'your', 'good', 'some', 'could', 'them', 'see', 'other',
    'than', 'then', 'now', 'look', 'only', 'come', 'its', 'over', 'think', 'also',
    'back', 'after', 'use', 'two', 'how', 'our', 'work', 'first', 'well', 'way',
    'even', 'new', 'want', 'because', 'any', 'these', 'give', 'day', 'most', 'us'
  ])

  words.forEach(word => {
    if (!stopWords.has(word) && word.length > 3) {
      frequency[word] = (frequency[word] || 0) + 1
    }
  })

  // Generate 2-10 word phrases
  for (let phraseLength = 2; phraseLength <= 10; phraseLength++) {
    for (let i = 0; i <= words.length - phraseLength; i++) {
      const phrase = words.slice(i, i + phraseLength).join(' ')

      // Skip if phrase contains only stop words or is too short
      if (phrase.length < 10 || isStopWordsOnly(phrase)) continue

      frequency[phrase] = (frequency[phrase] || 0) + 1
    }
  }

  return frequency
}

function isStopWordsOnly(phrase: string): boolean {
  const stopWords = new Set([
    'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i',
    'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
    'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she',
    'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what'
  ])

  const words = phrase.split(' ')
  return words.every(w => stopWords.has(w))
}

function deduplicateSubstringPhrases(
  phrases: Array<{ phrase: string; count: number; percentage: number }>
): Array<{ phrase: string; count: number; percentage: number }> {
  if (phrases.length === 0) return phrases

  // Sort by count descending, then length descending for ties
  const sorted = [...phrases].sort((a, b) => {
    const countDiff = b.count - a.count
    const maxCount = Math.max(a.count, b.count)

    // If within 15% frequency, prefer longer phrase for semantic richness
    if (maxCount > 0 && Math.abs(countDiff) / maxCount < 0.15) {
      return b.phrase.length - a.phrase.length
    }

    return countDiff
  })

  const result: typeof phrases = []
  const acceptedPhrases = new Set<string>()

  for (const candidate of sorted) {
    let isSubstring = false

    // Check if candidate is substring of any already-accepted phrase
    for (const accepted of acceptedPhrases) {
      if (accepted.includes(candidate.phrase)) {
        isSubstring = true
        break
      }
    }

    if (!isSubstring) {
      result.push(candidate)
      acceptedPhrases.add(candidate.phrase)
    }
  }

  return result
}

function getTopPhrases(frequency: Record<string, number>, limit: number): Array<{
  phrase: string
  count: number
  percentage: number
}> {
  // Get top phrases sorted by frequency (3x limit to allow for deduplication)
  const sorted = Object.entries(frequency)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit * 3)

  // Calculate percentage relative to the maximum count (so top item = 100%)
  const maxCount = sorted[0]?.[1] || 1

  const candidates = sorted.map(([phrase, count]) => ({
    phrase,
    count,
    percentage: Math.round((count / maxCount) * 100)
  }))

  // Deduplicate substrings (e.g., remove "berlin wall" if "the berlin wall" exists)
  const deduplicated = deduplicateSubstringPhrases(candidates)

  // Return top N after deduplication
  return deduplicated.slice(0, limit)
}

async function extractEntities(text: string, apiKey: string, articleAuthor?: string): Promise<{
  people: Array<{ name: string; count: number }>
  organizations: Array<{ name: string; count: number }>
  locations: Array<{ name: string; count: number }>
  dates: Array<{ name: string; count: number }>
  money: Array<{ name: string; count: number }>
  events: Array<{ name: string; count: number }>
  products: Array<{ name: string; count: number }>
  percentages: Array<{ name: string; count: number }>
}> {
  // Truncate text for GPT
  const truncated = text.substring(0, 10000)

  const authorNote = articleAuthor
    ? `\n\nIMPORTANT: "${articleAuthor}" is the article author/journalist, NOT a subject of the story. DO NOT include them in the people list unless they are directly involved in the story events themselves.`
    : ''

  const prompt = `Extract ALL named entities from this article's CONTENT. Categorize entities by type.${authorNote}

Extract these entity types:
1. PEOPLE - Individuals mentioned (EXCLUDE article authors/journalists unless they are story subjects)
2. ORGANIZATIONS - Companies, agencies, institutions, government bodies
3. LOCATIONS - Cities, countries, regions, landmarks, facilities
4. DATES - Specific dates, time periods, years (e.g., "January 2024", "last week", "2023")
5. MONEY - Financial amounts, currencies (e.g., "$5 million", "€100", "2 billion dollars")
6. EVENTS - Named events, incidents, operations (e.g., "Operation Desert Storm", "COVID-19 pandemic")
7. PRODUCTS - Named products, technologies, weapons systems (e.g., "iPhone", "F-35", "ChatGPT")
8. PERCENTAGES - Percentage values mentioned (e.g., "25%", "fifty percent")

Rules:
- EXCLUDE article authors, journalists, and byline names from PEOPLE
- Count occurrences of each unique entity
- Normalize similar references (e.g., "U.S.", "United States", "USA" → "United States")
- Include context-relevant entities only (skip generic terms)

Text: ${truncated}

Return ONLY valid JSON in this exact format:
{
  "people": [{"name": "John Doe", "count": 3}, ...],
  "organizations": [{"name": "FBI", "count": 5}, ...],
  "locations": [{"name": "New York", "count": 2}, ...],
  "dates": [{"name": "January 2024", "count": 1}, ...],
  "money": [{"name": "$5 million", "count": 2}, ...],
  "events": [{"name": "Operation Storm", "count": 1}, ...],
  "products": [{"name": "F-35", "count": 3}, ...],
  "percentages": [{"name": "25%", "count": 1}, ...]
}`

  try {
    console.log('[DEBUG] extractEntities called, API key present:', !!apiKey)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)

    console.log('[DEBUG] Calling OpenAI API for entity extraction...')
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: 'gpt-4o-mini',  // Using gpt-4o-mini as fallback until GPT-5 is available
        messages: [
          { role: 'system', content: 'You are a named entity recognition expert. Extract entities by type: people, organizations, locations, dates, money, events, products, and percentages. Exclude article authors from people. Normalize similar entities. Return ONLY valid JSON.' },
          { role: 'user', content: prompt }
        ],
        max_completion_tokens: 1200,
        temperature: 0.7
      })
    })

    clearTimeout(timeoutId)
    console.log('[DEBUG] OpenAI response status:', response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[DEBUG] OpenAI API error response:', errorText)
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`)
    }

    const data = await response.json() as any
    console.log('[DEBUG] OpenAI response received')

    if (!data.choices?.[0]?.message?.content) {
      console.error('[DEBUG] Invalid API response structure:', JSON.stringify(data))
      throw new Error('Invalid API response')
    }

    const jsonText = data.choices[0].message.content
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()

    console.log('[DEBUG] Parsing entities JSON...')
    const result = JSON.parse(jsonText)
    console.log('[DEBUG] Entities parsed successfully')
    return result

  } catch (error) {
    console.error('[DEBUG] Entity Extraction Error:', error)
    console.error('[DEBUG] Entity Error stack:', error instanceof Error ? error.stack : 'No stack')
    return {
      people: [],
      organizations: [],
      locations: [],
      dates: [],
      money: [],
      events: [],
      products: [],
      percentages: []
    }
  }
}

async function generateSummary(text: string, apiKey: string): Promise<string> {
  const truncated = text.substring(0, 10000)

  const prompt = `Summarize this content in 200-250 words. Focus on key facts and main points.

${truncated}`

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: 'gpt-4o-mini',  // Using gpt-4o-mini as fallback until GPT-5 is available
        messages: [
          { role: 'system', content: 'You are a professional summarizer.' },
          { role: 'user', content: prompt }
        ],
        max_completion_tokens: 500,
        temperature: 0.7
      })
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`)
    }

    const data = await response.json() as any

    if (!data.choices?.[0]?.message?.content) {
      throw new Error('Invalid API response')
    }

    return data.choices[0].message.content.trim()

  } catch (error) {
    console.error('[Summary Generation] Error:', error)
    return ''
  }
}

async function extractTopics(text: string, apiKey: string): Promise<Array<{
  name: string
  keywords: string[]
  coherence: number // 0.0 to 1.0 - how well-defined
  coverage: number // 0.0 to 1.0 - % of document
  description: string
}>> {
  const truncated = text.substring(0, 10000)

  const prompt = `Analyze this content and identify the 3-5 main topics using Latent Dirichlet Allocation (LDA) principles.

For each topic, provide:
1. Topic Name - A clear, descriptive label (2-4 words)
2. Keywords - Top 5-10 keywords that define this topic
3. Coherence Score - How well-defined and internally consistent the topic is (0.0 to 1.0)
4. Coverage - What percentage of the document relates to this topic (0.0 to 1.0, all topics should sum to ~1.0)
5. Description - Brief explanation of what this topic covers

Guidelines:
- Topics should be distinct from each other (avoid overlap)
- Keywords should be specific and meaningful
- Coverage should reflect actual document content distribution
- Higher coherence means more focused, well-defined topics
- Aim for 3-5 topics (don't force more if content is focused)

Text to analyze:
${truncated}

Return ONLY valid JSON in this exact format:
[
  {
    "name": "Machine Learning Applications",
    "keywords": ["neural networks", "deep learning", "training", "models", "accuracy"],
    "coherence": 0.88,
    "coverage": 0.45,
    "description": "Technical discussion of ML model training and deployment"
  },
  {
    "name": "Data Privacy Regulations",
    "keywords": ["GDPR", "privacy", "compliance", "data protection", "regulations"],
    "coherence": 0.82,
    "coverage": 0.35,
    "description": "Legal and regulatory aspects of data handling"
  }
]`

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 20000) // Longer timeout for topic modeling

    console.log('[DEBUG] Calling OpenAI API for topic extraction...')
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a topic modeling expert using LDA principles. Identify distinct, coherent topics with accurate coverage distributions. Return ONLY valid JSON.' },
          { role: 'user', content: prompt }
        ],
        max_completion_tokens: 1000,
        temperature: 0.3 // Lower temperature for consistent topic identification
      })
    })

    clearTimeout(timeoutId)
    console.log('[DEBUG] Topic extraction response status:', response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[DEBUG] Topic API error:', errorText)
      throw new Error(`OpenAI API error: ${response.status}`)
    }

    const data = await response.json() as any

    if (!data.choices?.[0]?.message?.content) {
      throw new Error('Invalid API response for topics')
    }

    const jsonText = data.choices[0].message.content
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()

    console.log('[DEBUG] Parsing topics JSON...')
    const result = JSON.parse(jsonText)
    console.log('[DEBUG] Topics parsed:', result.length, 'topics')
    return result

  } catch (error) {
    console.error('[Topic Modeling] Error:', error)
    // Return empty array on error
    return []
  }
}

async function extractKeyphrases(text: string, apiKey: string): Promise<Array<{
  phrase: string
  score: number // 0.0 to 1.0 importance score
  category: 'technology' | 'concept' | 'event' | 'location' | 'other'
  relevance: 'high' | 'medium' | 'low'
}>> {
  const truncated = text.substring(0, 10000)

  const prompt = `Extract the most important keyphrases from this content using TextRank-style analysis.

Identify phrases that are:
1. Central to the document's main topics (high graph centrality)
2. Domain-specific terminology (technical terms, jargon, specialized vocabulary)
3. Conceptually important (core ideas, themes, arguments)
4. Unique and specific (not generic common phrases like "the government" or "many people")

Extract 10-15 keyphrases maximum. Focus on quality over quantity.

Categorize each keyphrase:
- technology: Technical terms, products, systems, methods
- concept: Abstract ideas, theories, principles, frameworks
- event: Specific incidents, operations, phenomena
- location: Specific places mentioned prominently
- other: Other important terms

Score each keyphrase 0.0 to 1.0 based on importance to the document.

Text to analyze:
${truncated}

Return ONLY valid JSON in this exact format:
[
  {
    "phrase": "machine learning algorithms",
    "score": 0.95,
    "category": "technology",
    "relevance": "high"
  },
  {
    "phrase": "data privacy concerns",
    "score": 0.82,
    "category": "concept",
    "relevance": "high"
  }
]`

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)

    console.log('[DEBUG] Calling OpenAI API for keyphrase extraction...')
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a keyphrase extraction expert. Identify important concepts, terminology, and themes using graph-based importance ranking. Return ONLY valid JSON.' },
          { role: 'user', content: prompt }
        ],
        max_completion_tokens: 800,
        temperature: 0.3 // Lower temperature for consistent extraction
      })
    })

    clearTimeout(timeoutId)
    console.log('[DEBUG] Keyphrase extraction response status:', response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[DEBUG] Keyphrase API error:', errorText)
      throw new Error(`OpenAI API error: ${response.status}`)
    }

    const data = await response.json() as any

    if (!data.choices?.[0]?.message?.content) {
      throw new Error('Invalid API response for keyphrases')
    }

    const jsonText = data.choices[0].message.content
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()

    console.log('[DEBUG] Parsing keyphrases JSON...')
    const result = JSON.parse(jsonText)
    console.log('[DEBUG] Keyphrases parsed:', result.length, 'phrases')
    return result

  } catch (error) {
    console.error('[Keyphrase Extraction] Error:', error)
    // Return empty array on error
    return []
  }
}

async function analyzeSentiment(text: string, apiKey: string): Promise<{
  overall: 'positive' | 'negative' | 'neutral' | 'mixed'
  score: number // -1.0 to +1.0
  confidence: number // 0.0 to 1.0
  emotions: {
    joy: number
    anger: number
    fear: number
    sadness: number
    surprise: number
  }
  controversialClaims: Array<{
    text: string
    sentiment: string
    reason: string
  }>
  keyInsights: string[]
}> {
  const truncated = text.substring(0, 10000)

  const prompt = `Analyze the sentiment of this content. Provide:
1. Overall sentiment (positive, negative, neutral, or mixed)
2. Sentiment score from -1.0 (very negative) to +1.0 (very positive)
3. Confidence score (0.0 to 1.0)
4. Emotion breakdown (joy, anger, fear, sadness, surprise) as percentages 0-100
5. Controversial or inflammatory claims (if any)
6. Key insights about the tone and messaging

Text to analyze:
${truncated}

Return ONLY valid JSON in this exact format:
{
  "overall": "positive|negative|neutral|mixed",
  "score": -1.0 to +1.0,
  "confidence": 0.0 to 1.0,
  "emotions": {
    "joy": 0-100,
    "anger": 0-100,
    "fear": 0-100,
    "sadness": 0-100,
    "surprise": 0-100
  },
  "controversialClaims": [
    {
      "text": "claim snippet",
      "sentiment": "description",
      "reason": "why controversial"
    }
  ],
  "keyInsights": [
    "Main positive aspect: ...",
    "Main concern: ...",
    "Notable tone: ..."
  ]
}`

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)

    console.log('[DEBUG] Calling OpenAI API for sentiment analysis...')
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a sentiment analysis expert. Analyze content objectively and return only valid JSON.' },
          { role: 'user', content: prompt }
        ],
        max_completion_tokens: 1000,
        temperature: 0.3 // Lower temperature for more consistent analysis
      })
    })

    clearTimeout(timeoutId)
    console.log('[DEBUG] Sentiment analysis response status:', response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[DEBUG] Sentiment API error:', errorText)
      throw new Error(`OpenAI API error: ${response.status}`)
    }

    const data = await response.json() as any

    if (!data.choices?.[0]?.message?.content) {
      throw new Error('Invalid API response for sentiment')
    }

    const jsonText = data.choices[0].message.content
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()

    console.log('[DEBUG] Parsing sentiment JSON...')
    const result = JSON.parse(jsonText)
    console.log('[DEBUG] Sentiment parsed:', result.overall, result.score)
    return result

  } catch (error) {
    console.error('[Sentiment Analysis] Error:', error)
    // Return neutral fallback
    return {
      overall: 'neutral',
      score: 0,
      confidence: 0,
      emotions: { joy: 0, anger: 0, fear: 0, sadness: 0, surprise: 0 },
      controversialClaims: [],
      keyInsights: ['Sentiment analysis unavailable']
    }
  }
}

async function saveAnalysis(db: D1Database, data: any): Promise<number> {
  // D1 doesn't accept undefined, convert to null
  const toNullable = (val: any) => val === undefined ? null : val

  const result = await db.prepare(`
    INSERT INTO content_analysis (
      user_id, workspace_id, bookmark_hash, url, url_normalized, content_hash,
      title, author, publish_date, domain, is_social_media, social_platform,
      extracted_text, summary, word_count, word_frequency, top_phrases, entities,
      sentiment_analysis, keyphrases, topics,
      archive_urls, bypass_urls, processing_mode, processing_duration_ms, gpt_model_used,
      access_count, last_accessed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))
  `).bind(
    toNullable(data.user_id),
    toNullable(data.workspace_id),
    toNullable(data.bookmark_hash),
    data.url,
    data.url,
    data.content_hash,
    toNullable(data.title),
    toNullable(data.author),
    toNullable(data.publish_date),
    data.domain,
    data.is_social_media ? 1 : 0,
    toNullable(data.social_platform),
    data.extracted_text,
    toNullable(data.summary),
    data.word_count,
    JSON.stringify(data.word_frequency || {}),
    JSON.stringify(data.top_phrases || []),
    JSON.stringify(data.entities || {}),
    toNullable(data.sentiment_analysis ? JSON.stringify(data.sentiment_analysis) : null),
    toNullable(data.keyphrases ? JSON.stringify(data.keyphrases) : null),
    toNullable(data.topics ? JSON.stringify(data.topics) : null),
    JSON.stringify(data.archive_urls || {}),
    JSON.stringify(data.bypass_urls || {}),
    data.processing_mode,
    data.processing_duration_ms,
    toNullable(data.gpt_model_used)
  ).run()

  return result.meta.last_row_id as number
}

async function saveLinkToLibrary(db: D1Database, data: any): Promise<number> {
  const toNullable = (val: any) => val === undefined ? null : val

  const result = await db.prepare(`
    INSERT INTO saved_links (
      user_id, workspace_id, bookmark_hash, url, title, note, tags, domain,
      is_social_media, social_platform, is_processed, analysis_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    toNullable(data.user_id),
    toNullable(data.workspace_id),
    toNullable(data.bookmark_hash),
    data.url,
    data.title,
    data.note,
    JSON.stringify(data.tags || []),
    data.domain,
    data.is_social_media ? 1 : 0,
    data.social_platform,
    data.is_processed ? 1 : 0,
    data.analysis_id
  ).run()

  return result.meta.last_row_id as number
}
