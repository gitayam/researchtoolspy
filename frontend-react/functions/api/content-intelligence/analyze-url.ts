/**
 * Content Intelligence - URL Analysis Endpoint
 *
 * Features:
 * - URL content extraction with timeout handling
 * - Word frequency analysis (2-10 word phrases)
 * - Entity extraction with GPT
 * - Immediate bypass/archive link generation
 * - Social media detection
 * - Optional link saving with notes
 */

import type { PagesFunction } from '@cloudflare/workers-types'

interface Env {
  DB: D1Database
  OPENAI_API_KEY: string
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
    // Parse request
    const body = await request.json() as AnalyzeUrlRequest
    const { url, mode = 'full', save_link = false, link_note, link_tags } = body

    if (!url) {
      return new Response(JSON.stringify({ error: 'URL is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log(`[Content Intelligence] Analyzing URL: ${url} (mode: ${mode})`)

    const startTime = Date.now()

    // Normalize URL
    const normalizedUrl = normalizeUrl(url)

    // Detect social media
    const socialMediaInfo = detectSocialMedia(url)

    // Generate bypass/archive links immediately (no API calls needed)
    const bypassUrls = generateBypassUrls(normalizedUrl)
    const archiveUrls = generateArchiveUrls(normalizedUrl)

    // Extract content with timeout
    const contentData = await extractUrlContent(normalizedUrl)

    if (!contentData.success) {
      return new Response(JSON.stringify({
        error: contentData.error,
        bypass_urls: bypassUrls,
        archive_urls: archiveUrls
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Calculate content hash
    const contentHash = await calculateHash(contentData.text)

    // Word frequency analysis (2-10 word phrases)
    const wordFrequency = analyzeWordFrequency(contentData.text)
    const topPhrases = getTopPhrases(wordFrequency, 10)

    // For quick mode, return basic results immediately
    if (mode === 'quick') {
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
        processing_duration_ms: Date.now() - startTime
      }

      return new Response(JSON.stringify(quickResult), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Full mode: Extract entities and generate summary with GPT
    const entitiesData = await extractEntities(contentData.text, env.OPENAI_API_KEY)
    const summary = await generateSummary(contentData.text, env.OPENAI_API_KEY)

    // Save to database
    const analysisId = await saveAnalysis(env.DB, {
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
      archive_urls: archiveUrls,
      bypass_urls: bypassUrls,
      processing_mode: mode,
      processing_duration_ms: Date.now() - startTime,
      gpt_model_used: 'gpt-5-mini'
    })

    // Optionally save link
    let savedLinkId: number | undefined
    if (save_link) {
      savedLinkId = await saveLinkToLibrary(env.DB, {
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
      archive_urls: archiveUrls,
      bypass_urls: bypassUrls,
      processing_mode: mode,
      processing_duration_ms: Date.now() - startTime,
      gpt_model_used: 'gpt-5-mini'
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('[Content Intelligence] Error:', error)
    return new Response(JSON.stringify({
      error: 'Analysis failed',
      details: error instanceof Error ? error.message : 'Unknown error'
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
    '12ft': `https://12ft.io/proxy?q=${encoded}`,
    'outline': `https://outline.com/${url}`,
    'google_cache': `https://webcache.googleusercontent.com/search?q=cache:${encoded}`
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

async function extractUrlContent(url: string): Promise<{
  success: boolean
  error?: string
  text: string
  title?: string
  author?: string
  publishDate?: string
}> {
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
    .replace(/<[^>]+>/g, ' ') // Remove all HTML tags
    .replace(/&nbsp;/g, ' ')
    .replace(/&[a-z]+;/g, ' ') // Remove HTML entities
    .replace(/\s+/g, ' ') // Collapse whitespace
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

function getTopPhrases(frequency: Record<string, number>, limit: number): Array<{
  phrase: string
  count: number
  percentage: number
}> {
  const totalCount = Object.values(frequency).reduce((sum, count) => sum + count, 0)

  return Object.entries(frequency)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([phrase, count]) => ({
      phrase,
      count,
      percentage: Math.round((count / totalCount) * 10000) / 100
    }))
}

async function extractEntities(text: string, apiKey: string): Promise<{
  people: Array<{ name: string; count: number }>
  organizations: Array<{ name: string; count: number }>
  locations: Array<{ name: string; count: number }>
}> {
  // Truncate text for GPT
  const truncated = text.substring(0, 10000)

  const prompt = `Extract all named entities from this text. Return ONLY valid JSON.

Text: ${truncated}

Return format:
{
  "people": [{"name": "John Doe", "count": 3}, ...],
  "organizations": [{"name": "FBI", "count": 5}, ...],
  "locations": [{"name": "New York", "count": 2}, ...]
}`

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
        model: 'gpt-5-mini',
        messages: [
          { role: 'system', content: 'You are a named entity recognition expert. Extract people, organizations, and locations from text. Return ONLY valid JSON.' },
          { role: 'user', content: prompt }
        ],
        max_completion_tokens: 800
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

    const jsonText = data.choices[0].message.content
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()

    return JSON.parse(jsonText)

  } catch (error) {
    console.error('[Entity Extraction] Error:', error)
    return { people: [], organizations: [], locations: [] }
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
        model: 'gpt-5-mini',
        messages: [
          { role: 'system', content: 'You are a professional summarizer.' },
          { role: 'user', content: prompt }
        ],
        max_completion_tokens: 500
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

async function saveAnalysis(db: D1Database, data: any): Promise<number> {
  const result = await db.prepare(`
    INSERT INTO content_analysis (
      user_id, url, url_normalized, content_hash, title, author, publish_date,
      domain, is_social_media, social_platform, extracted_text, summary, word_count,
      word_frequency, top_phrases, entities, archive_urls, bypass_urls,
      processing_mode, processing_duration_ms, gpt_model_used
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    1, // TODO: Get actual user_id from auth
    data.url,
    data.url,
    data.content_hash,
    data.title,
    data.author,
    data.publish_date,
    data.domain,
    data.is_social_media ? 1 : 0,
    data.social_platform,
    data.extracted_text,
    data.summary,
    data.word_count,
    JSON.stringify(data.word_frequency),
    JSON.stringify(data.top_phrases),
    JSON.stringify(data.entities),
    JSON.stringify(data.archive_urls),
    JSON.stringify(data.bypass_urls),
    data.processing_mode,
    data.processing_duration_ms,
    data.gpt_model_used
  ).run()

  return result.meta.last_row_id as number
}

async function saveLinkToLibrary(db: D1Database, data: any): Promise<number> {
  const result = await db.prepare(`
    INSERT INTO saved_links (
      user_id, url, title, note, tags, domain, is_social_media, social_platform,
      is_processed, analysis_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    1, // TODO: Get actual user_id from auth
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
