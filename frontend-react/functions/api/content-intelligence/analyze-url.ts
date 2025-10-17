/**
 * Content Intelligence - URL Analysis Endpoint
 *
 * Features:
 * - URL content extraction with timeout handling
 * - PDF analysis with intelligent chunking for large documents
 * - Word frequency analysis (2-7 word phrases, single words shown in word cloud)
 * - Entity extraction with GPT
 * - Immediate bypass/archive link generation
 * - Social media detection
 * - Optional link saving with notes
 */

import type { PagesFunction } from '@cloudflare/workers-types'
import { isPDFUrl, extractPDFText, intelligentPDFSummary } from './pdf-extractor'
import { getUserIdOrDefault } from '../_shared/auth-helpers'
import { callOpenAIViaGateway, getOptimalCacheTTL } from '../_shared/ai-gateway'
import { normalizeClaims } from './normalize-claims'
import { extractAndSaveClaimEntities } from './extract-claim-entities'
import { matchMultipleClaimsEntities } from './match-entities-to-actors'

interface Env {
  DB: D1Database
  OPENAI_API_KEY: string
  AI_GATEWAY_ACCOUNT_ID?: string
  SESSIONS?: KVNamespace
  RATE_LIMIT?: KVNamespace
}

interface AnalyzeUrlRequest {
  url: string
  mode?: 'quick' | 'normal' | 'full'
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

    const { url, mode = 'normal', save_link = false, link_note, link_tags, load_existing = false, analysis_id } = body

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
          topics: result.topics ? JSON.parse(result.topics as string) : null,
          claim_analysis: result.claim_analysis ? JSON.parse(result.claim_analysis as string) : null
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

    // Extract content with automatic fallback to archives if blocked
    console.log('[DEBUG] Extracting URL content with fallback support...')
    const contentData = await extractUrlContentWithFallback(normalizedUrl, env.OPENAI_API_KEY)
    console.log(`[DEBUG] Content extraction result: success=${contentData.success}, source=${contentData.source}, isPDF=${contentData.isPDF}`)

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
          claim_analysis: existingAnalysis.claim_analysis ? JSON.parse(existingAnalysis.claim_analysis as string) : null,
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

    // Word frequency analysis (2-7 word phrases only, no single words)
    const wordFrequency = analyzeWordFrequency(contentData.text)
    const topPhrases = getTopPhrases(wordFrequency, 10)

    // For quick mode, return only summary (skip wordcloud, entities, claims, etc.)
    if (mode === 'quick') {
      console.log('[DEBUG] Quick mode - generating summary only...')

      // Generate summary with GPT
      let summary = ''
      try {
        console.log('[DEBUG] Quick mode: Calling generateSummary with GPT...')
        summary = await generateSummary(contentData.text, env)
        console.log(`[DEBUG] Quick mode: Summary generated`)
      } catch (error) {
        console.error('[DEBUG] Quick mode: Summary generation failed:', error)
        summary = 'Summary generation failed in quick mode.'
      }

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
        extracted_text: contentData.text,
        summary: summary,
        word_count: countWords(contentData.text),
        content_hash: contentHash,
        bypass_urls: bypassUrls,
        archive_urls: archiveUrls,
        is_social_media: !!socialMediaInfo,
        social_platform: socialMediaInfo?.platform,
        processing_mode: mode,
        processing_duration_ms: Date.now() - startTime,
        saved_link_id: savedLinkId,
        content_source: contentData.source || 'original',
        fallback_attempts: contentData.fallback_attempts || []
      }

      console.log('[DEBUG] Quick mode complete (summary only), returning result')
      return new Response(JSON.stringify(quickResult), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Normal/Full mode: Extract entities, generate summary, and run full analysis with GPT
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

      entitiesData = await extractEntities(contentData.text, env, contentData.author)
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
        summary = await generateSummary(contentData.text, env)
      }

      console.log(`[DEBUG] Summary generated: ${summary?.substring(0, 100)}...`)
    } catch (error) {
      console.error('[DEBUG] Summary generation failed:', error)
      console.error('[DEBUG] Continuing without summary...')
      // Continue without summary rather than failing
    }

    // Sentiment analysis - initialize with fallback to ensure always available
    let sentimentData = {
      overall: 'neutral' as const,
      score: 0,
      confidence: 0,
      emotions: { joy: 0, anger: 0, fear: 0, sadness: 0, surprise: 0 },
      controversialClaims: [],
      keyInsights: ['Sentiment analysis unavailable']
    }
    try {
      console.log('[DEBUG] Calling analyzeSentiment with GPT...')
      sentimentData = await analyzeSentiment(contentData.text, env)
      console.log(`[DEBUG] Sentiment analyzed: ${sentimentData.overall} (score: ${sentimentData.score})`)
    } catch (error) {
      console.error('[DEBUG] Sentiment analysis failed:', error)
      console.error('[DEBUG] Using fallback neutral sentiment')
      // sentimentData already has fallback value
    }

    // Keyphrase extraction
    let keyphrases
    try {
      console.log('[DEBUG] Calling extractKeyphrases with GPT...')
      keyphrases = await extractKeyphrases(contentData.text, env)
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
      topics = await extractTopics(contentData.text, env)
      console.log(`[DEBUG] Topics extracted: ${topics.length} topics`)
    } catch (error) {
      console.error('[DEBUG] Topic extraction failed:', error)
      console.error('[DEBUG] Continuing without topics...')
      // Continue without topics rather than failing
    }

    // Claim extraction and deception detection - DISABLED for performance
    // Claims analysis is now a manual tool (like DIME/Starbursting) to improve initial analysis speed
    // Users can run claims analysis separately via the Claims tab
    let claimAnalysis = null
    console.log('[DEBUG] Claims analysis disabled in automatic mode - run manually via Claims tab')

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
      links_analysis: contentData.links || [],
      sentiment_analysis: sentimentData,
      keyphrases: keyphrases,
      topics: topics,
      claim_analysis: claimAnalysis,
      archive_urls: archiveUrls,
      bypass_urls: bypassUrls,
      processing_mode: mode,
      processing_duration_ms: Date.now() - startTime,
      gpt_model_used: 'gpt-4o-mini'
    })
      console.log(`[DEBUG] Saved to database with ID: ${analysisId}`)

      // Create deduplication entry for new content (use INSERT OR IGNORE to handle race conditions)
      try {
        await env.DB.prepare(`
          INSERT OR IGNORE INTO content_deduplication (
            content_hash, canonical_content_id, duplicate_count,
            total_access_count, first_analyzed_at, last_accessed_at
          ) VALUES (?, ?, 1, 1, datetime('now'), datetime('now'))
        `).bind(contentHash, analysisId).run()

        console.log('[DEBUG] Deduplication entry created (or already exists)')
      } catch (dedupError) {
        // Non-fatal: deduplication is an optimization, not critical
        console.error('[DEBUG] Deduplication insert failed (non-fatal):', dedupError)
      }
    } catch (error) {
      console.error('[DEBUG] Database save failed:', error)
      console.error('[DEBUG] Error details:', error instanceof Error ? error.message : String(error))

      // Check if this is a duplicate content error
      if (error instanceof Error && error.message.includes('UNIQUE constraint failed: content_deduplication.content_hash')) {
        // This is a race condition - content was analyzed simultaneously
        // Find and return the existing analysis
        console.log('[DEBUG] Duplicate content detected via race condition, finding existing analysis...')
        const existingDedup = await env.DB.prepare(`
          SELECT canonical_content_id FROM content_deduplication WHERE content_hash = ?
        `).bind(contentHash).first()

        if (existingDedup) {
          const existingAnalysis = await env.DB.prepare(`
            SELECT * FROM content_analysis WHERE id = ?
          `).bind(existingDedup.canonical_content_id).first()

          if (existingAnalysis) {
            console.log('[DEBUG] Returning existing analysis from race condition')
            return new Response(JSON.stringify({
              ...existingAnalysis,
              entities: JSON.parse(existingAnalysis.entities as string || '{}'),
              word_frequency: JSON.parse(existingAnalysis.word_frequency as string || '{}'),
              top_phrases: JSON.parse(existingAnalysis.top_phrases as string || '[]'),
              sentiment_analysis: existingAnalysis.sentiment_analysis ? JSON.parse(existingAnalysis.sentiment_analysis as string) : null,
              keyphrases: existingAnalysis.keyphrases ? JSON.parse(existingAnalysis.keyphrases as string) : null,
              topics: existingAnalysis.topics ? JSON.parse(existingAnalysis.topics as string) : null,
              claim_analysis: existingAnalysis.claim_analysis ? JSON.parse(existingAnalysis.claim_analysis as string) : null,
              archive_urls: JSON.parse(existingAnalysis.archive_urls as string || '{}'),
              bypass_urls: JSON.parse(existingAnalysis.bypass_urls as string || '{}'),
              from_cache: true,
              race_condition_recovery: true
            }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            })
          }
        }
      }

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

    // Normalize claims to database (Phase 1: Claims & Entity Integration)
    let claimIds: string[] = []
    if (claimAnalysis && claimAnalysis.claims && claimAnalysis.claims.length > 0) {
      try {
        console.log('[DEBUG] Normalizing claims to database...')
        claimIds = await normalizeClaims(env.DB, {
          content_analysis_id: analysisId,
          claims: claimAnalysis.claims,
          user_id: userId,
          workspace_id: workspaceId
        })
        console.log(`[DEBUG] Successfully normalized ${claimIds.length} claims`)

        // Phase 2: Extract entities from claims
        if (claimIds.length > 0) {
          try {
            console.log('[DEBUG] Extracting entities from claims...')
            const claimsWithIds = claimAnalysis.claims.map((claim, idx) => ({
              claimId: claimIds[idx],
              claimText: claim.claim
            }))

            const entityStats = await extractAndSaveClaimEntities(
              env.DB,
              claimsWithIds,
              env
            )

            console.log(`[DEBUG] Entity extraction complete: ${entityStats.totalEntities} entities from ${entityStats.claimsWithEntities} claims`)

            // Phase 3: Match extracted entities to existing actors/places/events
            if (entityStats.totalEntities > 0) {
              try {
                console.log('[DEBUG] Matching entities to existing actors...')
                const matchStats = await matchMultipleClaimsEntities(
                  env.DB,
                  claimIds,
                  workspaceId
                )

                console.log(`[DEBUG] Entity matching complete: ${matchStats.exactMatches} exact + ${matchStats.fuzzyMatches} fuzzy matches (${matchStats.noMatches} unmatched)`)
              } catch (error) {
                console.error('[DEBUG] Entity matching failed (non-fatal):', error)
                // Don't fail if matching fails
                // Entities still have temp IDs and can be manually matched later
              }
            }
          } catch (error) {
            console.error('[DEBUG] Entity extraction failed (non-fatal):', error)
            // Don't fail if entity extraction fails
            // Claims are still normalized without entities
          }
        }
      } catch (error) {
        console.error('[DEBUG] Claim normalization failed (non-fatal):', error)
        // Don't fail the whole request if normalization fails
        // Claims are still available in JSON format
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
      links_analysis: contentData.links || [],
      sentiment_analysis: sentimentData,
      keyphrases: keyphrases,
      topics: topics,
      claim_analysis: claimAnalysis,
      archive_urls: archiveUrls,
      bypass_urls: bypassUrls,
      processing_mode: mode,
      processing_duration_ms: Date.now() - startTime,
      gpt_model_used: 'gpt-4o-mini',
      content_source: contentData.source || 'original',
      fallback_attempts: contentData.fallback_attempts || []
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
  if (urlLower.includes('facebook.com') || urlLower.includes('fb.me') ||
      urlLower.includes('fb.watch') || urlLower.includes('m.facebook.com')) {
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
  if (urlLower.includes('spotify.com') || urlLower.includes('spotify.link')) {
    return { platform: 'spotify' }
  }

  return null
}

function generateBypassUrls(url: string): Record<string, string> {
  const encoded = encodeURIComponent(url)
  return {
    'smry_ai': `https://smry.ai/${encoded}`,
    'archive_ph': `https://archive.ph/newest/${url}`
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

/**
 * Resolve Spotify shortened links (spotify.link) to actual Spotify URLs
 */
async function resolveSpotifyRedirect(url: string): Promise<string> {
  const urlLower = url.toLowerCase()

  // Only process spotify.link URLs
  if (!urlLower.includes('spotify.link')) {
    return url
  }

  console.log('[Spotify Redirect] Resolving spotify.link URL:', url)

  try {
    const response = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ResearchToolsBot/1.0)'
      }
    })

    const finalUrl = response.url
    console.log('[Spotify Redirect] Resolved to:', finalUrl)
    return finalUrl
  } catch (error) {
    console.error('[Spotify Redirect] Failed to resolve:', error)
    // Return original URL if resolution fails
    return url
  }
}

/**
 * Resolve Facebook shortened links (fb.me, fb.watch) to actual Facebook URLs
 */
async function resolveFacebookRedirect(url: string): Promise<string> {
  const urlLower = url.toLowerCase()

  // Only process fb.me and fb.watch URLs
  if (!urlLower.includes('fb.me') && !urlLower.includes('fb.watch')) {
    return url
  }

  console.log('[Facebook Redirect] Resolving shortened Facebook URL:', url)

  try {
    const response = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ResearchToolsBot/1.0)'
      }
    })

    const finalUrl = response.url
    console.log('[Facebook Redirect] Resolved to:', finalUrl)
    return finalUrl
  } catch (error) {
    console.error('[Facebook Redirect] Failed to resolve:', error)
    // Return original URL if resolution fails
    return url
  }
}

/**
 * Check if Archive.ph has an archived version of the URL
 * Returns the archived URL if found, null otherwise
 */
async function checkArchivePh(url: string): Promise<string | null> {
  try {
    // Check archive.ph for newest snapshot
    const archiveUrl = `https://archive.ph/newest/${url}`
    console.log('[Archive.ph] Checking for archived version:', archiveUrl)

    const response = await fetch(archiveUrl, {
      method: 'HEAD',
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    })

    // If we got redirected to an archive snapshot, return it
    if (response.ok && response.url !== archiveUrl && response.url.includes('archive.ph/')) {
      console.log('[Archive.ph] Found archived version:', response.url)
      return response.url
    }

    return null
  } catch (error) {
    console.error('[Archive.ph] Check failed:', error)
    return null
  }
}

/**
 * Check Wayback Machine for the most recent snapshot
 * Uses CDX API to find latest archived version
 */
async function checkWaybackMachine(url: string): Promise<string | null> {
  try {
    // Use Wayback CDX API to get the most recent snapshot
    const cdxUrl = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(url)}&limit=1&sort=reverse`
    console.log('[Wayback] Checking for archived version via CDX API')

    const response = await fetch(cdxUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    })

    if (!response.ok) {
      return null
    }

    const text = await response.text()

    // CDX format: urlkey timestamp original mimetype statuscode digest length
    // We need the timestamp to construct the wayback URL
    const lines = text.trim().split('\n')
    if (lines.length === 0 || !lines[0]) {
      return null
    }

    const parts = lines[0].split(' ')
    if (parts.length < 2) {
      return null
    }

    const timestamp = parts[1]
    const waybackUrl = `https://web.archive.org/web/${timestamp}/${url}`
    console.log('[Wayback] Found archived version:', waybackUrl)
    return waybackUrl
  } catch (error) {
    console.error('[Wayback] Check failed:', error)
    return null
  }
}

/**
 * Detect if content extraction was blocked/paywalled
 * Returns true if the content appears to be blocked
 */
function isContentBlocked(result: {
  success: boolean
  error?: string
  text: string
}): boolean {
  // Check for explicit errors indicating blocking
  if (!result.success && result.error) {
    const errorLower = result.error.toLowerCase()
    if (errorLower.includes('403') || errorLower.includes('401') ||
        errorLower.includes('402') || errorLower.includes('blocked')) {
      return true
    }
  }

  // Check for minimal/suspicious content
  if (result.success) {
    const textLower = result.text.toLowerCase()
    const wordCount = result.text.split(/\s+/).length

    // Paywall/login keywords
    const paywallKeywords = [
      'paywall', 'subscribe', 'subscription', 'login required',
      'sign in to continue', 'create account', 'register to read',
      'this content is exclusive', 'premium content'
    ]

    const hasPaywallKeyword = paywallKeywords.some(kw => textLower.includes(kw))

    // If content is very short and contains paywall keywords, it's likely blocked
    if (wordCount < 100 && hasPaywallKeyword) {
      return true
    }
  }

  return false
}

/**
 * Extract URL content with automatic fallback to archives if blocked
 */
async function extractUrlContentWithFallback(url: string, apiKey?: string): Promise<{
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
  source?: 'original' | 'archive.ph' | 'wayback' | 'smry.ai'
  fallback_attempts?: string[]
  links?: LinkInfo[]
}> {
  const fallbackAttempts: string[] = []

  // Try original URL first
  console.log('[Fallback] Attempting original URL:', url)
  fallbackAttempts.push('original')
  const originalResult = await extractUrlContent(url, apiKey)

  // If successful and not blocked, return immediately
  if (originalResult.success && !isContentBlocked(originalResult)) {
    console.log('[Fallback] Original URL succeeded')
    return {
      ...originalResult,
      source: 'original',
      fallback_attempts: fallbackAttempts
    }
  }

  console.log('[Fallback] Original URL blocked or failed, trying fallbacks...')

  // Try Archive.ph
  try {
    const archivePhUrl = await checkArchivePh(url)
    if (archivePhUrl) {
      console.log('[Fallback] Attempting Archive.ph:', archivePhUrl)
      fallbackAttempts.push('archive.ph')
      const archivePhResult = await extractUrlContent(archivePhUrl, apiKey)

      if (archivePhResult.success && !isContentBlocked(archivePhResult)) {
        console.log('[Fallback] Archive.ph succeeded')
        return {
          ...archivePhResult,
          source: 'archive.ph',
          fallback_attempts: fallbackAttempts
        }
      }
    }
  } catch (error) {
    console.error('[Fallback] Archive.ph attempt failed:', error)
  }

  // Try Wayback Machine
  try {
    const waybackUrl = await checkWaybackMachine(url)
    if (waybackUrl) {
      console.log('[Fallback] Attempting Wayback Machine:', waybackUrl)
      fallbackAttempts.push('wayback')
      const waybackResult = await extractUrlContent(waybackUrl, apiKey)

      if (waybackResult.success && !isContentBlocked(waybackResult)) {
        console.log('[Fallback] Wayback Machine succeeded')
        return {
          ...waybackResult,
          source: 'wayback',
          fallback_attempts: fallbackAttempts
        }
      }
    }
  } catch (error) {
    console.error('[Fallback] Wayback Machine attempt failed:', error)
  }

  // Try SMRY.ai as last resort
  try {
    const smryUrl = `https://smry.ai/${encodeURIComponent(url)}`
    console.log('[Fallback] Attempting SMRY.ai:', smryUrl)
    fallbackAttempts.push('smry.ai')
    const smryResult = await extractUrlContent(smryUrl, apiKey)

    if (smryResult.success && !isContentBlocked(smryResult)) {
      console.log('[Fallback] SMRY.ai succeeded')
      return {
        ...smryResult,
        source: 'smry.ai',
        fallback_attempts: fallbackAttempts
      }
    }
  } catch (error) {
    console.error('[Fallback] SMRY.ai attempt failed:', error)
  }

  // All fallbacks failed, return original result with fallback info
  console.log('[Fallback] All fallback methods failed')
  return {
    ...originalResult,
    source: 'original',
    fallback_attempts: fallbackAttempts
  }
}

/**
 * Classify Facebook content type from URL structure
 */
function classifyFacebookContentType(url: string): string {
  const urlLower = url.toLowerCase()

  // Video content
  if (urlLower.includes('/watch') || urlLower.includes('/videos/') || urlLower.includes('fb.watch')) {
    return 'video'
  }

  // Photo content
  if (urlLower.includes('/photo.php') || urlLower.includes('/photos/')) {
    return 'photo'
  }

  // Post content
  if (urlLower.includes('/posts/') || urlLower.includes('/permalink.php') || urlLower.includes('/pfbid')) {
    return 'post'
  }

  // Group content
  if (urlLower.includes('/groups/')) {
    return 'group'
  }

  // Event content
  if (urlLower.includes('/events/')) {
    return 'event'
  }

  // Profile or page
  if (urlLower.includes('/profile.php') || urlLower.includes('/people/')) {
    return 'profile'
  }

  // Default to page (could be a page or profile with custom username)
  return 'page'
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
  links?: LinkInfo[]
}> {
  // Resolve Spotify redirect links first
  let resolvedUrl = url
  if (url.toLowerCase().includes('spotify.link')) {
    resolvedUrl = await resolveSpotifyRedirect(url)
    console.log('[Content Extract] Spotify URL resolved from', url, 'to', resolvedUrl)
  }

  // Resolve Facebook redirect links (fb.me, fb.watch)
  if (url.toLowerCase().includes('fb.me') || url.toLowerCase().includes('fb.watch')) {
    resolvedUrl = await resolveFacebookRedirect(url)
    console.log('[Content Extract] Facebook URL resolved from', url, 'to', resolvedUrl)
  }

  // Check if URL is a PDF
  if (isPDFUrl(resolvedUrl)) {
    console.log('[Content Extract] Detected PDF URL, using PDF extractor')
    try {
      const pdfResult = await extractPDFText(resolvedUrl)

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
    // Detect if this is Facebook content to use specialized User-Agent
    const isFacebookUrl = resolvedUrl.toLowerCase().includes('facebook.com') ||
                          resolvedUrl.toLowerCase().includes('m.facebook.com')

    // Use Facebook's own crawler user-agent for Facebook URLs to bypass login walls
    // Facebook allows facebookexternalhit to access Open Graph metadata without authentication
    const userAgent = isFacebookUrl
      ? 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'
      : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

    const response = await fetch(resolvedUrl, {
      headers: {
        'User-Agent': userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
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

    // Detect if this is Spotify content and use specialized extraction
    const isSpotify = resolvedUrl.toLowerCase().includes('spotify.com')

    if (isSpotify) {
      console.log('[Content Extract] Detected Spotify content, using specialized extraction')
      return extractSpotifyContent(html, resolvedUrl)
    }

    // Detect if this is Facebook content and use specialized extraction
    const isFacebook = resolvedUrl.toLowerCase().includes('facebook.com') ||
                       resolvedUrl.toLowerCase().includes('m.facebook.com')

    if (isFacebook) {
      console.log('[Content Extract] Detected Facebook content, using specialized extraction')
      return extractFacebookContent(html, resolvedUrl)
    }

    // Parse HTML (simple extraction, can be enhanced)
    const title = extractMetaTag(html, 'title')
    const author = extractMetaTag(html, 'author')
    const publishDate = extractMetaTag(html, 'article:published_time') ||
                       extractMetaTag(html, 'publishdate')

    // Extract main text (remove scripts, styles, nav, footer)
    const cleanText = cleanHtmlText(html)

    // Extract links from HTML body (excluding nav, header, footer, sidebar)
    const links = extractBodyLinks(html, resolvedUrl)

    return {
      success: true,
      text: cleanText,
      title,
      author,
      publishDate,
      links
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

/**
 * Extract Spotify-specific metadata from Open Graph tags
 */
function extractSpotifyContent(html: string, url: string): {
  success: boolean
  text: string
  title?: string
  author?: string
  publishDate?: string
} {
  console.log('[Spotify Extract] Extracting Spotify metadata from Open Graph tags')

  // Extract Open Graph metadata specific to Spotify
  const ogTitle = extractMetaTag(html, 'og:title') || extractMetaTag(html, 'title')
  const ogDescription = extractMetaTag(html, 'og:description') || extractMetaTag(html, 'description')
  const ogAudio = extractMetaTag(html, 'og:audio')
  const ogAudioType = extractMetaTag(html, 'og:audio:type')
  const ogImage = extractMetaTag(html, 'og:image')
  const ogType = extractMetaTag(html, 'og:type')
  const ogUrl = extractMetaTag(html, 'og:url') || url

  // Extract Spotify-specific metadata
  const spotifyType = extractMetaTag(html, 'music:musician') ? 'artist' :
                      extractMetaTag(html, 'music:album') ? 'album' :
                      extractMetaTag(html, 'music:song') ? 'track' :
                      url.includes('/episode/') ? 'podcast episode' :
                      url.includes('/show/') ? 'podcast show' : 'content'

  // Build structured text content from metadata
  const contentParts = []

  contentParts.push(`Spotify ${spotifyType.charAt(0).toUpperCase() + spotifyType.slice(1)}`)

  if (ogTitle) {
    contentParts.push(`Title: ${ogTitle}`)
  }

  if (ogDescription) {
    contentParts.push(`Description: ${ogDescription}`)
  }

  // Extract artist/creator information from URL or metadata
  const urlParts = url.split('/')
  const spotifyId = urlParts[urlParts.length - 1]?.split('?')[0]

  if (spotifyId) {
    contentParts.push(`Spotify ID: ${spotifyId}`)
  }

  if (ogUrl) {
    contentParts.push(`URL: ${ogUrl}`)
  }

  if (ogAudio) {
    contentParts.push(`Audio URL: ${ogAudio}`)
  }

  if (ogAudioType) {
    contentParts.push(`Audio Type: ${ogAudioType}`)
  }

  if (ogImage) {
    contentParts.push(`Cover Art: ${ogImage}`)
  }

  const text = contentParts.join('\n')

  console.log('[Spotify Extract] Extracted metadata:', {
    title: ogTitle,
    type: spotifyType,
    hasDescription: !!ogDescription,
    hasAudio: !!ogAudio
  })

  return {
    success: true,
    text,
    title: ogTitle,
    author: undefined, // Spotify doesn't always provide author in OG tags
    publishDate: undefined
  }
}

/**
 * Extract Facebook-specific metadata from Open Graph tags
 */
function extractFacebookContent(html: string, url: string): {
  success: boolean
  text: string
  title?: string
  author?: string
  publishDate?: string
} {
  console.log('[Facebook Extract] Extracting Facebook metadata from Open Graph tags')

  // Classify content type
  const contentType = classifyFacebookContentType(url)

  // Extract Open Graph metadata
  const ogTitle = extractMetaTag(html, 'og:title') || extractMetaTag(html, 'title')
  const ogDescription = extractMetaTag(html, 'og:description') || extractMetaTag(html, 'description')
  const ogImage = extractMetaTag(html, 'og:image')
  const ogType = extractMetaTag(html, 'og:type')
  const ogUrl = extractMetaTag(html, 'og:url') || url
  const ogSiteName = extractMetaTag(html, 'og:site_name')

  // Article-specific tags
  const articleAuthor = extractMetaTag(html, 'article:author')
  const articlePublishedTime = extractMetaTag(html, 'article:published_time')
  const articleModifiedTime = extractMetaTag(html, 'article:modified_time')

  // Video-specific tags
  const ogVideo = extractMetaTag(html, 'og:video') || extractMetaTag(html, 'og:video:url')
  const videoDuration = extractMetaTag(html, 'video:duration')
  const videoReleaseDate = extractMetaTag(html, 'video:release_date')

  // Profile-specific tags
  const profileFirstName = extractMetaTag(html, 'profile:first_name')
  const profileLastName = extractMetaTag(html, 'profile:last_name')
  const profileUsername = extractMetaTag(html, 'profile:username')

  // Build structured text content
  const contentParts = []

  contentParts.push(`Facebook ${contentType.charAt(0).toUpperCase() + contentType.slice(1)}`)

  if (ogTitle) {
    contentParts.push(`Title: ${ogTitle}`)
  }

  if (ogDescription) {
    contentParts.push(`Description: ${ogDescription}`)
  }

  // Add author information
  if (articleAuthor) {
    contentParts.push(`Author: ${articleAuthor}`)
  } else if (profileFirstName || profileLastName) {
    const fullName = [profileFirstName, profileLastName].filter(Boolean).join(' ')
    if (fullName) {
      contentParts.push(`Profile Name: ${fullName}`)
    }
  } else if (profileUsername) {
    contentParts.push(`Username: ${profileUsername}`)
  }

  // Add publication date
  if (articlePublishedTime) {
    contentParts.push(`Published: ${articlePublishedTime}`)
  }

  if (articleModifiedTime) {
    contentParts.push(`Modified: ${articleModifiedTime}`)
  }

  // Add video information
  if (ogVideo) {
    contentParts.push(`Video URL: ${ogVideo}`)
  }

  if (videoDuration) {
    contentParts.push(`Duration: ${videoDuration} seconds`)
  }

  if (videoReleaseDate) {
    contentParts.push(`Release Date: ${videoReleaseDate}`)
  }

  // Add metadata
  if (ogType) {
    contentParts.push(`Content Type: ${ogType}`)
  }

  if (ogUrl) {
    contentParts.push(`URL: ${ogUrl}`)
  }

  if (ogImage) {
    contentParts.push(`Image: ${ogImage}`)
  }

  const text = contentParts.join('\n')

  console.log('[Facebook Extract] Extracted metadata:', {
    title: ogTitle,
    contentType,
    hasDescription: !!ogDescription,
    hasAuthor: !!(articleAuthor || profileFirstName || profileLastName),
    hasPublishDate: !!articlePublishedTime,
    hasVideo: !!ogVideo
  })

  return {
    success: true,
    text,
    title: ogTitle,
    author: articleAuthor || (profileUsername ? `@${profileUsername}` : undefined),
    publishDate: articlePublishedTime || videoReleaseDate
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

/**
 * Extract all links from HTML body content (excluding nav, header, footer, sidebar)
 * Returns structured data about links: URL, anchor text, count
 *
 * This helps researchers:
 * - Identify sources and references cited in the article
 * - Discover related content and follow-up leads
 * - Analyze linking patterns and information flow
 * - Verify external source credibility
 */
interface LinkInfo {
  url: string
  anchor_text: string[]  // All different anchor texts used for this URL
  count: number  // How many times this link appears
  domain: string
  is_external: boolean
  first_occurrence_index: number  // Position where this link first appears (for chronological sorting)
}

function extractBodyLinks(html: string, sourceUrl: string): LinkInfo[] {
  console.log('[Link Extraction] Starting body link extraction')

  // Remove non-body content (nav, header, footer, sidebar, aside)
  let bodyHtml = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, '')
    .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, '')
    .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, '')
    .replace(/<aside\b[^<]*(?:(?!<\/aside>)<[^<]*)*<\/aside>/gi, '')
    .replace(/<div[^>]*class=["'][^"']*(?:sidebar|menu|nav)[^"']*["'][^>]*>.*?<\/div>/gi, '')

  // Extract source domain for external link detection
  let sourceDomain = ''
  try {
    sourceDomain = new URL(sourceUrl).hostname.replace('www.', '')
  } catch (e) {
    console.error('[Link Extraction] Failed to parse source URL:', e)
  }

  // Find all anchor tags with href
  const linkPattern = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi
  const linkMap = new Map<string, { texts: Set<string>, count: number, firstIndex: number }>()

  let match
  let totalLinksFound = 0
  let validLinkIndex = 0  // Track the index of valid links for chronological sorting
  while ((match = linkPattern.exec(bodyHtml)) !== null) {
    totalLinksFound++
    let url = match[1].trim()
    const anchorHtml = match[2]

    // Skip empty, anchor-only (#), javascript:, and mailto: links initially (we'll handle mailto separately)
    if (!url || url.startsWith('#') || url.startsWith('javascript:')) {
      continue
    }

    // Extract plain text from anchor (remove HTML tags)
    const anchorText = anchorHtml
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&[a-z]+;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    // Skip if no anchor text (likely an image-only link)
    if (!anchorText || anchorText.length === 0) {
      continue
    }

    // Normalize URL (resolve relative URLs)
    try {
      if (url.startsWith('//')) {
        url = 'https:' + url
      } else if (url.startsWith('/')) {
        const sourceUrlObj = new URL(sourceUrl)
        url = `${sourceUrlObj.protocol}//${sourceUrlObj.host}${url}`
      } else if (!url.startsWith('http') && !url.startsWith('mailto:')) {
        const sourceUrlObj = new URL(sourceUrl)
        url = `${sourceUrlObj.protocol}//${sourceUrlObj.host}/${url}`
      }
    } catch (e) {
      // If URL normalization fails, skip this link
      continue
    }

    // Track this link
    if (!linkMap.has(url)) {
      linkMap.set(url, { texts: new Set(), count: 0, firstIndex: validLinkIndex })
    }
    const linkData = linkMap.get(url)!
    linkData.count++
    linkData.texts.add(anchorText)
    validLinkIndex++
  }

  // Convert to array and add domain/external info
  const links: LinkInfo[] = []
  linkMap.forEach((data, url) => {
    try {
      const urlObj = new URL(url)
      const domain = urlObj.hostname.replace('www.', '')
      const isExternal = domain !== sourceDomain

      links.push({
        url,
        anchor_text: Array.from(data.texts),
        count: data.count,
        domain,
        is_external: isExternal,
        first_occurrence_index: data.firstIndex
      })
    } catch (e) {
      // Skip invalid URLs
      console.error('[Link Extraction] Invalid URL:', url)
    }
  })

  // Sort by count (most linked first)
  links.sort((a, b) => b.count - a.count)

  console.log(`[Link Extraction] Found ${totalLinksFound} total anchor tags, ${links.length} unique valid links`)
  console.log(`[Link Extraction] External links: ${links.filter(l => l.is_external).length}`)

  return links
}

/**
 * Extract email addresses from text content
 * Helps researchers identify contact information and sources
 */
function extractEmails(text: string): Array<{ email: string; count: number }> {
  const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g
  const emails = text.match(emailPattern) || []

  // Count occurrences
  const emailMap = new Map<string, number>()
  emails.forEach(email => {
    const normalized = email.toLowerCase()
    emailMap.set(normalized, (emailMap.get(normalized) || 0) + 1)
  })

  // Convert to array and sort by count
  const result = Array.from(emailMap.entries()).map(([email, count]) => ({ email, count }))
  result.sort((a, b) => b.count - a.count)

  console.log(`[Email Extraction] Found ${result.length} unique email addresses`)
  return result
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

  const stopWords = new Set([
    // Articles, pronouns, conjunctions
    'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i',
    'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
    'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she',
    'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what',
    'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me',
    'when', 'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know', 'take',
    'people', 'into', 'year', 'your', 'good', 'some', 'could', 'them', 'see', 'other',
    'than', 'then', 'now', 'look', 'only', 'come', 'its', 'over', 'think', 'also',
    'back', 'after', 'use', 'two', 'how', 'our', 'work', 'first', 'well', 'way',
    'even', 'new', 'want', 'because', 'any', 'these', 'give', 'day', 'most', 'us',
    // Additional common words
    'may', 'such', 'been', 'said', 'more', 'has', 'was', 'were', 'are', 'had',
    'did', 'does', 'being', 'each', 'few', 'many', 'much', 'own', 'same', 'very',
    'still', 'too', 'yet', 'both', 'either', 'neither', 'whether', 'since', 'while',
    'where', 'here', 'once', 'during', 'before', 'between', 'under', 'above', 'below',
    'through', 'off', 'down', 'again', 'further', 'each', 'every', 'several', 'per',
    'via', 'however', 'therefore', 'thus', 'moreover', 'nevertheless', 'meanwhile',
    // Numbers and quantifiers
    'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
    'hundred', 'thousand', 'million', 'billion', 'first', 'second', 'third',
    // Time-related
    'today', 'yesterday', 'tomorrow', 'week', 'month', 'year', 'monday', 'tuesday',
    'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'january', 'february',
    // Common verbs
    'become', 'became', 'go', 'went', 'gone', 'going', 'come', 'came', 'coming',
    'tell', 'told', 'telling', 'ask', 'asked', 'asking', 'find', 'found', 'finding'
  ])

  // Count single words (excluding stop words)
  for (const word of words) {
    if (!stopWords.has(word) && word.length > 3) {
      frequency[word] = (frequency[word] || 0) + 1
    }
  }

  // Generate 2-7 word phrases
  for (let phraseLength = 2; phraseLength <= 7; phraseLength++) {
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
    // Articles, pronouns, conjunctions
    'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i',
    'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
    'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she',
    'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what',
    'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me',
    'when', 'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know', 'take',
    // Additional common words
    'may', 'such', 'been', 'said', 'more', 'has', 'was', 'were', 'are', 'had',
    'did', 'does', 'being', 'each', 'few', 'many', 'much', 'own', 'same', 'very',
    'still', 'too', 'yet', 'both', 'either', 'neither', 'whether', 'since', 'while',
    'where', 'here', 'once', 'during', 'before', 'between', 'under', 'above', 'below',
    'through', 'off', 'down', 'again', 'further', 'each', 'every', 'several', 'per'
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
  // IMPORTANT: Filter to ONLY multi-word phrases (must contain at least one space)
  // This excludes all single words from the phrase cloud
  const phrasesOnly = Object.entries(frequency)
    .filter(([phrase]) => phrase.includes(' ')) // Only phrases with 2+ words
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit * 3) // Get top phrases sorted by frequency (3x limit to allow for deduplication)

  if (phrasesOnly.length === 0) return []

  // Calculate percentage relative to the maximum count (so top item = 100%)
  const maxCount = phrasesOnly[0]?.[1] || 1

  const candidates = phrasesOnly.map(([phrase, count]) => ({
    phrase,
    count,
    percentage: Math.round((count / maxCount) * 100)
  }))

  // Deduplicate substrings (e.g., remove "berlin wall" if "the berlin wall" exists)
  const deduplicated = deduplicateSubstringPhrases(candidates)

  // Return top N after deduplication
  return deduplicated.slice(0, limit)
}

async function extractEntities(text: string, env: Env, articleAuthor?: string): Promise<{
  people: Array<{ name: string; count: number }>
  organizations: Array<{ name: string; count: number }>
  locations: Array<{ name: string; count: number }>
  dates: Array<{ name: string; count: number }>
  money: Array<{ name: string; count: number }>
  events: Array<{ name: string; count: number }>
  products: Array<{ name: string; count: number }>
  percentages: Array<{ name: string; count: number }>
  emails: Array<{ email: string; count: number }>
}> {
  // Extract emails first using regex (faster and more reliable than GPT)
  const emails = extractEmails(text)

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
    console.log('[DEBUG] extractEntities called, API key present:', !!env.OPENAI_API_KEY)
    console.log('[DEBUG] Calling OpenAI API for entity extraction via AI Gateway...')

    const data = await callOpenAIViaGateway(env, {
      model: 'gpt-4o-mini',  // Using gpt-4o-mini as fallback until GPT-5 is available
      messages: [
        { role: 'system', content: 'You are a named entity recognition expert. Extract entities by type: people, organizations, locations, dates, money, events, products, and percentages. Exclude article authors from people. Normalize similar entities. Return ONLY valid JSON.' },
        { role: 'user', content: prompt }
      ],
      max_completion_tokens: 1200,
      temperature: 0.7
    }, {
      cacheTTL: getOptimalCacheTTL('entity-extraction'),
      metadata: {
        endpoint: 'content-intelligence',
        operation: 'extract-entities'
      },
      timeout: 15000
    })

    console.log('[DEBUG] OpenAI response received via AI Gateway')

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
    console.log('[DEBUG] Emails extracted:', emails.length)
    return {
      ...result,
      emails: emails
    }

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
      percentages: [],
      emails: emails  // Return emails even if GPT extraction fails
    }
  }
}

async function generateSummary(text: string, env: Env): Promise<string> {
  const truncated = text.substring(0, 10000)

  const prompt = `Summarize this content in 200-250 words. Focus on key facts and main points.

${truncated}`

  try {
    const data = await callOpenAIViaGateway(env, {
      model: 'gpt-4o-mini',  // Using gpt-4o-mini as fallback until GPT-5 is available
      messages: [
        { role: 'system', content: 'You are a professional summarizer.' },
        { role: 'user', content: prompt }
      ],
      max_completion_tokens: 500,
      temperature: 0.7
    }, {
      cacheTTL: getOptimalCacheTTL('content-intelligence'),
      metadata: {
        endpoint: 'content-intelligence',
        operation: 'generate-summary'
      },
      timeout: 15000
    })

    if (!data.choices?.[0]?.message?.content) {
      throw new Error('Invalid API response')
    }

    return data.choices[0].message.content.trim()

  } catch (error) {
    console.error('[Summary Generation] Error:', error)
    return ''
  }
}

async function extractTopics(text: string, env: Env): Promise<Array<{
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
    console.log('[DEBUG] Calling OpenAI API for topic extraction via AI Gateway...')
    const data = await callOpenAIViaGateway(env, {
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a topic modeling expert using LDA principles. Identify distinct, coherent topics with accurate coverage distributions. Return ONLY valid JSON.' },
        { role: 'user', content: prompt }
      ],
      max_completion_tokens: 1000,
      temperature: 0.3 // Lower temperature for consistent topic identification
    }, {
      cacheTTL: getOptimalCacheTTL('content-intelligence'),
      metadata: {
        endpoint: 'content-intelligence',
        operation: 'extract-topics'
      },
      timeout: 20000
    })

    console.log('[DEBUG] Topic extraction response received via AI Gateway')

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

async function extractKeyphrases(text: string, env: Env): Promise<Array<{
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
    console.log('[DEBUG] Calling OpenAI API for keyphrase extraction via AI Gateway...')
    const data = await callOpenAIViaGateway(env, {
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a keyphrase extraction expert. Identify important concepts, terminology, and themes using graph-based importance ranking. Return ONLY valid JSON.' },
        { role: 'user', content: prompt }
      ],
      max_completion_tokens: 800,
      temperature: 0.3 // Lower temperature for consistent extraction
    }, {
      cacheTTL: getOptimalCacheTTL('content-intelligence'),
      metadata: {
        endpoint: 'content-intelligence',
        operation: 'extract-keyphrases'
      },
      timeout: 15000
    })

    console.log('[DEBUG] Keyphrase extraction response received via AI Gateway')

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

async function analyzeSentiment(text: string, env: Env): Promise<{
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
    console.log('[DEBUG] Calling OpenAI API for sentiment analysis via AI Gateway...')
    const data = await callOpenAIViaGateway(env, {
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a sentiment analysis expert. Analyze content objectively and return only valid JSON.' },
        { role: 'user', content: prompt }
      ],
      max_completion_tokens: 1000,
      temperature: 0.3 // Lower temperature for more consistent analysis
    }, {
      cacheTTL: getOptimalCacheTTL('sentiment-analysis'),
      metadata: {
        endpoint: 'content-intelligence',
        operation: 'analyze-sentiment'
      },
      timeout: 15000
    })

    console.log('[DEBUG] Sentiment analysis response received via AI Gateway')

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

  // Size limits to prevent SQLITE_TOOBIG errors
  const MAX_TEXT_SIZE = 100 * 1024  // 100KB for extracted_text
  const MAX_CLAIMS = 50  // Maximum number of claims
  const MAX_WORD_FREQ_ENTRIES = 500  // Maximum word frequency entries
  const MAX_LINKS = 100  // Maximum links to store
  const CHUNK_SIZE = 50 * 1024  // 50KB chunks for content_chunks table

  // Track original sizes for logging
  const originalTextSize = data.extracted_text?.length || 0
  const fullText = data.extracted_text || ''

  // Truncate extracted_text if too large
  let truncatedText = data.extracted_text
  let wasTextTruncated = false
  if (data.extracted_text && data.extracted_text.length > MAX_TEXT_SIZE) {
    console.log(`[DEBUG] Truncating extracted_text from ${data.extracted_text.length} to ${MAX_TEXT_SIZE} bytes`)
    truncatedText = data.extracted_text.substring(0, MAX_TEXT_SIZE) + '\n\n[Content truncated - see content_chunks table for full text]'
    wasTextTruncated = true
  }

  // Limit word_frequency to top entries (THIS IS THE KEY FIX)
  let wordFrequency = data.word_frequency
  if (wordFrequency && typeof wordFrequency === 'object') {
    const originalCount = Object.keys(wordFrequency).length
    if (originalCount > MAX_WORD_FREQ_ENTRIES) {
      console.log(`[DEBUG] Limiting word_frequency from ${originalCount} to ${MAX_WORD_FREQ_ENTRIES} entries`)
      // Sort by frequency and keep only top N
      const sortedEntries = Object.entries(wordFrequency)
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .slice(0, MAX_WORD_FREQ_ENTRIES)
      wordFrequency = Object.fromEntries(sortedEntries)
    }
  }

  // Limit links_analysis
  let linksAnalysis = data.links_analysis
  if (linksAnalysis && Array.isArray(linksAnalysis) && linksAnalysis.length > MAX_LINKS) {
    console.log(`[DEBUG] Limiting links_analysis from ${linksAnalysis.length} to ${MAX_LINKS}`)
    linksAnalysis = linksAnalysis.slice(0, MAX_LINKS)
  }

  // Limit claims to prevent oversized JSON
  let claimAnalysis = data.claim_analysis
  if (claimAnalysis && claimAnalysis.claims && Array.isArray(claimAnalysis.claims)) {
    const originalClaimCount = claimAnalysis.claims.length
    if (originalClaimCount > MAX_CLAIMS) {
      console.log(`[DEBUG] Limiting claims from ${originalClaimCount} to ${MAX_CLAIMS}`)
      claimAnalysis = {
        ...claimAnalysis,
        claims: claimAnalysis.claims.slice(0, MAX_CLAIMS),
        truncated: true,
        original_claim_count: originalClaimCount
      }
    }
  }

  // Log sizes for debugging (using limited variables)
  const estimatedSize =
    (truncatedText?.length || 0) +
    JSON.stringify(wordFrequency || {}).length +
    JSON.stringify(data.top_phrases || []).length +
    JSON.stringify(data.entities || {}).length +
    JSON.stringify(linksAnalysis || []).length +
    JSON.stringify(claimAnalysis || null).length +
    JSON.stringify(data.sentiment_analysis || null).length +
    JSON.stringify(data.keyphrases || null).length +
    JSON.stringify(data.topics || null).length

  console.log(`[DEBUG] Estimated INSERT size: ${estimatedSize} bytes`)
  if (estimatedSize > 200 * 1024) {
    console.warn(`[WARNING] Large INSERT detected: ${estimatedSize} bytes - may cause performance issues`)
  }

  const result = await db.prepare(`
    INSERT INTO content_analysis (
      user_id, workspace_id, bookmark_hash, url, url_normalized, content_hash,
      title, author, publish_date, domain, is_social_media, social_platform,
      extracted_text, summary, word_count, word_frequency, top_phrases, entities, links_analysis,
      sentiment_analysis, keyphrases, topics, claim_analysis,
      archive_urls, bypass_urls, processing_mode, processing_duration_ms, gpt_model_used,
      access_count, last_accessed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))
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
    truncatedText,  // Use truncated version
    toNullable(data.summary),
    data.word_count,
    JSON.stringify(wordFrequency || {}),  // Use limited version
    JSON.stringify(data.top_phrases || []),
    JSON.stringify(data.entities || {}),
    JSON.stringify(linksAnalysis || []),  // Use limited version
    toNullable(data.sentiment_analysis ? JSON.stringify(data.sentiment_analysis) : null),
    toNullable(data.keyphrases ? JSON.stringify(data.keyphrases) : null),
    toNullable(data.topics ? JSON.stringify(data.topics) : null),
    toNullable(claimAnalysis ? JSON.stringify(claimAnalysis) : null),  // Use limited claims
    JSON.stringify(data.archive_urls || {}),
    JSON.stringify(data.bypass_urls || {}),
    data.processing_mode,
    data.processing_duration_ms,
    toNullable(data.gpt_model_used)
  ).run()

  const analysisId = result.meta.last_row_id as number

  // If text was truncated, save full text to content_chunks table
  if (wasTextTruncated && fullText.length > 0) {
    console.log(`[DEBUG] Saving full text (${originalTextSize} bytes) to content_chunks table`)
    await saveContentChunks(db, analysisId, fullText, CHUNK_SIZE)
  }

  return analysisId
}

// Save large content in chunks
async function saveContentChunks(
  db: D1Database,
  contentAnalysisId: number,
  fullText: string,
  chunkSize: number
): Promise<void> {
  try {
    const chunks: string[] = []
    for (let i = 0; i < fullText.length; i += chunkSize) {
      chunks.push(fullText.substring(i, i + chunkSize))
    }

    console.log(`[DEBUG] Splitting content into ${chunks.length} chunks of ~${chunkSize} bytes each`)

    // Save each chunk
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      const chunkHash = await generateHash(chunk)  // Use existing hash function

      await db.prepare(`
        INSERT INTO content_chunks (
          content_analysis_id, chunk_index, chunk_size, chunk_hash, chunk_text, created_at
        ) VALUES (?, ?, ?, ?, ?, datetime('now'))
      `).bind(
        contentAnalysisId,
        i,
        chunk.length,
        chunkHash,
        chunk
      ).run()
    }

    console.log(`[DEBUG] Successfully saved ${chunks.length} chunks`)
  } catch (error) {
    console.error('[ERROR] Failed to save content chunks:', error)
    // Non-fatal: main analysis is already saved
  }
}

// Update specific fields in an existing analysis
async function updateAnalysisFields(db: D1Database, analysisId: number, updates: {
  summary?: string
  entities?: any
  sentiment_analysis?: any
  keyphrases?: any
  topics?: any
  claim_analysis?: any
}): Promise<void> {
  const toNullable = (val: any) => val === undefined ? null : val
  const fields: string[] = []
  const values: any[] = []

  if (updates.summary !== undefined) {
    fields.push('summary = ?')
    values.push(toNullable(updates.summary))
  }
  if (updates.entities !== undefined) {
    fields.push('entities = ?')
    values.push(JSON.stringify(updates.entities))
  }
  if (updates.sentiment_analysis !== undefined) {
    fields.push('sentiment_analysis = ?')
    values.push(toNullable(updates.sentiment_analysis ? JSON.stringify(updates.sentiment_analysis) : null))
  }
  if (updates.keyphrases !== undefined) {
    fields.push('keyphrases = ?')
    values.push(toNullable(updates.keyphrases ? JSON.stringify(updates.keyphrases) : null))
  }
  if (updates.topics !== undefined) {
    fields.push('topics = ?')
    values.push(toNullable(updates.topics ? JSON.stringify(updates.topics) : null))
  }
  if (updates.claim_analysis !== undefined) {
    fields.push('claim_analysis = ?')
    values.push(toNullable(updates.claim_analysis ? JSON.stringify(updates.claim_analysis) : null))
  }

  if (fields.length === 0) return

  fields.push("updated_at = datetime('now')")
  values.push(analysisId)

  await db.prepare(`
    UPDATE content_analysis SET ${fields.join(', ')} WHERE id = ?
  `).bind(...values).run()
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

/**
 * Extract objective factual claims from content
 *
 * Extracts verifiable, specific statements about:
 * - Who said/did what
 * - When and where events occurred
 * - Quantitative data (numbers, statistics)
 * - Direct quotes from named sources
 * - Cause-effect relationships
 */
async function extractClaims(text: string, env: Env, title?: string): Promise<Array<{
  claim: string
  category: 'statement' | 'quote' | 'statistic' | 'event' | 'relationship'
  source?: string
  confidence: number
  supporting_text?: string
}>> {
  const truncated = text.substring(0, 12000)

  const prompt = `Extract objective factual claims from this article. Focus on verifiable statements, NOT opinions or analysis.

Article Title: ${title || 'Unknown'}

Extract claims in these categories:
1. STATEMENT - Factual assertions about what happened (e.g., "Company X announced layoffs on March 15, 2024")
2. QUOTE - Direct quotes from named sources (e.g., "CEO John Smith said, 'We expect growth'")
3. STATISTIC - Numerical data and statistics (e.g., "Unemployment rose to 5.2% in Q3 2024")
4. EVENT - Specific events with who/what/when/where (e.g., "The summit occurred in Geneva on June 10")
5. RELATIONSHIP - Cause-effect or correlation claims (e.g., "The policy led to a 20% increase in enrollment")

Rules for extraction:
- Claims MUST be objective and verifiable
- Include specific names, dates, numbers, locations
- NO opinions, predictions, or speculation
- NO vague statements ("some experts say", "it is believed that")
- Each claim must be self-contained (understandable without context)
- Include the source in the claim if mentioned ("According to WHO..." or "John Doe stated...")
- Extract 5-15 claims maximum (quality over quantity)

For each claim provide:
- claim: The complete factual statement
- category: statement|quote|statistic|event|relationship
- source: Name of source if mentioned (person, organization, document)
- confidence: 0.0-1.0 (how confident this is a factual claim vs opinion)
- supporting_text: Short snippet from article that contains this claim (max 150 chars)

Text to analyze:
${truncated}

Return ONLY valid JSON array:
[
  {
    "claim": "NATO announced on May 12, 2024 that it would expand its presence in Eastern Europe",
    "category": "event",
    "source": "NATO",
    "confidence": 0.95,
    "supporting_text": "NATO officials confirmed the expansion during a press conference in Brussels..."
  }
]`

  try {
    console.log('[DEBUG] Calling OpenAI API for claim extraction via AI Gateway...')
    const data = await callOpenAIViaGateway(env, {
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a fact-extraction expert. Extract only objective, verifiable claims from content. Ignore opinions, predictions, and speculation. Each claim must be specific with names, dates, numbers. Return ONLY valid JSON.'
        },
        { role: 'user', content: prompt }
      ],
      max_completion_tokens: 1500,
      temperature: 0.2 // Low temperature for consistent, factual extraction
    }, {
      cacheTTL: getOptimalCacheTTL('claim-analysis'),
      metadata: {
        endpoint: 'content-intelligence',
        operation: 'extract-claims'
      },
      timeout: 20000
    })

    console.log('[DEBUG] Claim extraction response received via AI Gateway')

    if (!data.choices?.[0]?.message?.content) {
      throw new Error('Invalid API response for claim extraction')
    }

    const jsonText = data.choices[0].message.content
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()

    console.log('[DEBUG] Parsing claims JSON...')
    const result = JSON.parse(jsonText)
    console.log('[DEBUG] Claims parsed:', result.length, 'claims')
    return result

  } catch (error) {
    console.error('[Claim Extraction] Error:', error)
    return []
  }
}

/**
 * Analyze each claim for potential deception using multiple methods
 *
 * Deception Detection Methods:
 * 1. Internal Consistency - Does claim contradict other claims?
 * 2. Source Credibility - Is the source authoritative/reliable?
 * 3. Evidence Quality - Is supporting evidence provided?
 * 4. Logical Coherence - Does the claim make logical sense?
 * 5. Temporal Consistency - Do timelines/sequences make sense?
 * 6. Specificity Analysis - Vague claims are more likely deceptive
 */
async function analyzeClaimsForDeception(
  claims: Array<{claim: string; category: string; source?: string; confidence: number; supporting_text?: string}>,
  fullText: string,
  env: Env
): Promise<{
  claims: Array<{
    claim: string
    category: string
    source?: string
    deception_analysis: {
      overall_risk: 'low' | 'medium' | 'high'
      risk_score: number // 0-100
      methods: {
        internal_consistency: { score: number; reasoning: string }
        source_credibility: { score: number; reasoning: string }
        evidence_quality: { score: number; reasoning: string }
        logical_coherence: { score: number; reasoning: string }
        temporal_consistency: { score: number; reasoning: string }
        specificity: { score: number; reasoning: string }
      }
      red_flags: string[]
      confidence_assessment: string
    }
  }>
  summary: {
    total_claims: number
    high_risk_claims: number
    medium_risk_claims: number
    low_risk_claims: number
    most_concerning_claim?: string
    overall_content_credibility: number
  }
}> {
  const truncatedText = fullText.substring(0, 15000)

  const prompt = `Analyze these claims for potential deception using multiple detection methods.

Full Article Context (for reference):
${truncatedText.substring(0, 3000)}...

Claims to Analyze:
${JSON.stringify(claims, null, 2)}

For EACH claim, run these deception detection methods:

1. INTERNAL CONSISTENCY (0-100)
   - Does this claim contradict any other claims?
   - Are there logical inconsistencies within the claim itself?
   - Score: 0 = major contradictions, 100 = fully consistent

2. SOURCE CREDIBILITY (0-100)
   - IMPORTANT: Evaluate the CLAIM MAKER, not the publication reporting it
   - For quoted statements (e.g., "X said/claimed/blamed..."), evaluate X's credibility
   - Consider: Is the claim maker authoritative on this topic?
   - Consider: Does the claim maker have political/financial motivations or biases?
   - Consider: Does the claim maker have a track record of truthfulness?
   - For direct quotes: Low credibility = known for dishonesty/political bias, High credibility = expert/neutral source
   - Score: 0 = unreliable speaker with strong bias/track record of falsehoods, 100 = highly credible expert with no conflicts

3. EVIDENCE QUALITY (0-100)
   - Is supporting evidence provided?
   - Is the evidence specific and verifiable?
   - Score: 0 = no evidence/vague claims, 100 = strong specific evidence

4. LOGICAL COHERENCE (0-100)
   - Does the claim make logical sense?
   - Are cause-effect relationships plausible?
   - Score: 0 = illogical/implausible, 100 = logically sound

5. TEMPORAL CONSISTENCY (0-100)
   - Do dates, timelines, and sequences make sense?
   - Are temporal references consistent?
   - Score: 0 = timeline inconsistencies, 100 = temporally consistent

6. SPECIFICITY ANALYSIS (0-100)
   - How specific is the claim (names, dates, numbers)?
   - Vague claims are more suspect
   - Score: 0 = very vague, 100 = highly specific

For each claim, calculate:
- Risk Score: (600 - sum of all method scores) / 6 (inverted average)
- Overall Risk: low (<30), medium (30-60), high (>60)
- Red Flags: List any concerning patterns
- Confidence Assessment: Overall evaluation

Return ONLY valid JSON:
{
  "claims": [
    {
      "claim": "...",
      "category": "...",
      "source": "...",
      "deception_analysis": {
        "overall_risk": "low|medium|high",
        "risk_score": 0-100,
        "methods": {
          "internal_consistency": {
            "score": 95,
            "reasoning": "Claim is consistent with other statements in article"
          },
          "source_credibility": {
            "score": 85,
            "reasoning": "Claim maker is a named expert with relevant authority; no obvious political bias"
          },
          "evidence_quality": {
            "score": 70,
            "reasoning": "Some specific evidence provided but could be more detailed"
          },
          "logical_coherence": {
            "score": 90,
            "reasoning": "Claim makes logical sense given context"
          },
          "temporal_consistency": {
            "score": 95,
            "reasoning": "Timeline is consistent and plausible"
          },
          "specificity": {
            "score": 80,
            "reasoning": "Includes specific date and organization name"
          }
        },
        "red_flags": [],
        "confidence_assessment": "High confidence this is a factual claim"
      }
    }
  ],
  "summary": {
    "total_claims": 10,
    "high_risk_claims": 1,
    "medium_risk_claims": 2,
    "low_risk_claims": 7,
    "most_concerning_claim": "Claim with highest risk score",
    "overall_content_credibility": 75
  }
}`

  try {
    console.log('[DEBUG] Starting deception analysis for', claims.length, 'claims')
    console.log('[DEBUG] First claim:', claims[0]?.claim || 'N/A')

    console.log('[DEBUG] Calling OpenAI API for deception analysis via AI Gateway...')
    const data = await callOpenAIViaGateway(env, {
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a deception detection expert trained in multiple analytical methods. Analyze claims objectively using: internal consistency, source credibility, evidence quality, logical coherence, temporal consistency, and specificity. Provide detailed reasoning for each score. Return ONLY valid JSON.'
        },
        { role: 'user', content: prompt }
      ],
      max_completion_tokens: 3000,
      temperature: 0.3 // Moderate temperature for balanced analysis
    }, {
      cacheTTL: getOptimalCacheTTL('claim-analysis'),
      metadata: {
        endpoint: 'content-intelligence',
        operation: 'analyze-claims-deception'
      },
      timeout: 30000
    })

    console.log('[DEBUG] Deception analysis response received via AI Gateway')

    if (!data.choices?.[0]?.message?.content) {
      console.error('[DEBUG] Invalid API response structure:', JSON.stringify(data))
      throw new Error('Invalid API response for deception analysis')
    }

    const rawContent = data.choices[0].message.content
    console.log('[DEBUG] GPT raw response length:', rawContent.length, 'chars')
    console.log('[DEBUG] GPT response preview:', rawContent.substring(0, 200))

    const jsonText = rawContent
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()

    console.log('[DEBUG] Parsing deception analysis JSON...')
    let result
    try {
      result = JSON.parse(jsonText)
    } catch (parseError) {
      console.error('[DEBUG] JSON parse error:', parseError)
      console.error('[DEBUG] Failed to parse text:', jsonText.substring(0, 500))
      throw new Error(`Failed to parse deception analysis JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`)
    }

    console.log('[DEBUG] Deception analysis complete:', result.summary?.total_claims, 'claims analyzed')
    return result

  } catch (error) {
    console.error('[Deception Analysis] Error:', error)
    console.error('[Deception Analysis] Error type:', error instanceof Error ? error.constructor.name : typeof error)
    console.error('[Deception Analysis] Error message:', error instanceof Error ? error.message : String(error))
    console.error('[Deception Analysis] Error stack:', error instanceof Error ? error.stack : 'N/A')
    console.error('[Deception Analysis] Number of claims attempted:', claims.length)

    // Return claims with NO deception analysis on error
    // This allows users to manually assess instead of showing misleading "50" scores
    return {
      claims: claims.map(c => ({
        ...c,
        deception_analysis: {
          overall_risk: 'medium' as const,
          risk_score: null as any, // Explicitly null to indicate no analysis
          methods: {
            internal_consistency: { score: null as any, reasoning: 'AI analysis failed. Please manually assess this claim.' },
            source_credibility: { score: null as any, reasoning: 'AI analysis failed. Please manually assess this claim.' },
            evidence_quality: { score: null as any, reasoning: 'AI analysis failed. Please manually assess this claim.' },
            logical_coherence: { score: null as any, reasoning: 'AI analysis failed. Please manually assess this claim.' },
            temporal_consistency: { score: null as any, reasoning: 'AI analysis failed. Please manually assess this claim.' },
            specificity: { score: null as any, reasoning: 'AI analysis failed. Please manually assess this claim.' }
          },
          red_flags: [
            '⚠️ Automated analysis unavailable',
            'Manual assessment required',
            'Error: ' + (error instanceof Error ? error.message : 'Unknown error')
          ],
          confidence_assessment: 'AI analysis failed - manual review strongly recommended. Edit scores below to provide your assessment.'
        }
      })),
      summary: {
        total_claims: claims.length,
        high_risk_claims: 0,
        medium_risk_claims: 0,
        low_risk_claims: 0,
        most_concerning_claim: 'Unable to determine - manual analysis needed',
        overall_content_credibility: null as any // Null to indicate no automated assessment
      }
    }
  }
}
