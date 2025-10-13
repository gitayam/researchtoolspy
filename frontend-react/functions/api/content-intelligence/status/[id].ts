/**
 * Content Intelligence - Analysis Status Endpoint
 *
 * Polls the status of an ongoing or completed analysis
 * Used for progressive loading to show results as they become available
 */

import type { PagesFunction } from '@cloudflare/workers-types'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const analysisId = context.params.id as string

    if (!analysisId) {
      return new Response(JSON.stringify({ error: 'Analysis ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Fetch analysis from database
    const analysis = await context.env.DB.prepare(`
      SELECT
        id,
        url,
        title,
        author,
        publish_date,
        domain,
        is_social_media,
        social_platform,
        word_count,
        word_frequency,
        top_phrases,
        entities,
        summary,
        sentiment_analysis,
        keyphrases,
        topics,
        claim_analysis,
        archive_urls,
        bypass_urls,
        processing_status,
        created_at,
        updated_at
      FROM content_analysis
      WHERE id = ?
    `).bind(analysisId).first()

    if (!analysis) {
      return new Response(JSON.stringify({ error: 'Analysis not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Parse JSON fields
    const parsedAnalysis = {
      id: analysis.id,
      url: analysis.url,
      title: analysis.title,
      author: analysis.author,
      publish_date: analysis.publish_date,
      domain: analysis.domain,
      is_social_media: analysis.is_social_media,
      social_platform: analysis.social_platform,
      word_count: analysis.word_count,
      word_frequency: analysis.word_frequency ? JSON.parse(analysis.word_frequency as string) : {},
      top_phrases: analysis.top_phrases ? JSON.parse(analysis.top_phrases as string) : [],
      entities: analysis.entities ? JSON.parse(analysis.entities as string) : {},
      summary: analysis.summary,
      sentiment_analysis: analysis.sentiment_analysis ? JSON.parse(analysis.sentiment_analysis as string) : null,
      keyphrases: analysis.keyphrases ? JSON.parse(analysis.keyphrases as string) : null,
      topics: analysis.topics ? JSON.parse(analysis.topics as string) : null,
      claim_analysis: analysis.claim_analysis ? JSON.parse(analysis.claim_analysis as string) : null,
      archive_urls: analysis.archive_urls ? JSON.parse(analysis.archive_urls as string) : {},
      bypass_urls: analysis.bypass_urls ? JSON.parse(analysis.bypass_urls as string) : {},
      processing_status: analysis.processing_status || 'complete',
      created_at: analysis.created_at,
      updated_at: analysis.updated_at
    }

    // Determine component statuses
    const componentStatus = {
      basic: 'complete', // Basic info always available immediately
      wordFrequency: parsedAnalysis.word_frequency && Object.keys(parsedAnalysis.word_frequency).length > 0 ? 'complete' : 'pending',
      entities: parsedAnalysis.entities && Object.keys(parsedAnalysis.entities).length > 0 ? 'complete' : 'pending',
      summary: parsedAnalysis.summary ? 'complete' : 'pending',
      sentiment: parsedAnalysis.sentiment_analysis ? 'complete' : 'pending',
      keyphrases: parsedAnalysis.keyphrases ? 'complete' : 'pending',
      topics: parsedAnalysis.topics ? 'complete' : 'pending',
      claims: parsedAnalysis.claim_analysis ? 'complete' : 'pending'
    }

    // Overall status
    const allComplete = Object.values(componentStatus).every(status => status === 'complete')
    const overallStatus = allComplete ? 'complete' : 'processing'

    return new Response(JSON.stringify({
      analysis: parsedAnalysis,
      status: overallStatus,
      componentStatus,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('[status/id] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to fetch analysis status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
