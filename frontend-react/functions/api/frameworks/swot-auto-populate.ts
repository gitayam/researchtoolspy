/**
 * SWOT Auto-Population API
 *
 * Analyzes content from Content Intelligence and auto-generates SWOT items
 * using GPT-5-mini for cost-effective, high-quality extraction
 */

import type { PagesFunction } from '@cloudflare/workers-types'

interface Env {
  DB: D1Database
  OPENAI_API_KEY: string
}

interface SwotItem {
  text: string
  source: string
  confidence: number
  excerpt?: string
}

interface SwotAutoPopulateRequest {
  contentIds: string[] // Array of content IDs from content_intelligence table
  workspaceId?: string
  title?: string // Optional SWOT title for better context
}

interface SwotAutoPopulateResponse {
  success: boolean
  strengths: SwotItem[]
  weaknesses: SwotItem[]
  opportunities: SwotItem[]
  threats: SwotItem[]
  metadata: {
    contentCount: number
    totalItems: number
    processingTime: number
    model: string
  }
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  const startTime = Date.now()

  try {
    const body = await request.json() as SwotAutoPopulateRequest

    if (!body.contentIds || body.contentIds.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No content IDs provided'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Limit to 5 content sources for performance
    if (body.contentIds.length > 5) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Maximum 5 content sources allowed for auto-population'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log(`[SWOT Auto-Populate] Fetching ${body.contentIds.length} content sources`)

    // Fetch content from database
    const placeholders = body.contentIds.map(() => '?').join(',')
    const query = `
      SELECT
        id,
        url,
        title,
        description,
        main_content,
        key_entities,
        top_10_words,
        top_10_phrases,
        metadata
      FROM content_intelligence
      WHERE id IN (${placeholders})
      LIMIT 5
    `

    const { results } = await env.DB.prepare(query).bind(...body.contentIds).all()

    if (!results || results.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No content found for provided IDs'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log(`[SWOT Auto-Populate] Found ${results.length} content sources, analyzing...`)

    // Prepare content for GPT analysis
    const contentSummaries = results.map((content: any) => ({
      id: content.id,
      url: content.url,
      title: content.title || 'Untitled',
      description: content.description || '',
      // Truncate main_content to first 3000 characters to stay within token limits
      content: content.main_content?.substring(0, 3000) || '',
      entities: content.key_entities ? JSON.parse(content.key_entities) : [],
      phrases: content.top_10_phrases ? JSON.parse(content.top_10_phrases) : []
    }))

    // Use GPT-4o-mini (GPT-5 not yet available) for analysis
    // According to user's CLAUDE.md: use gpt-4o-mini as fallback until GPT-5 available
    const gptResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.7,
        max_tokens: 2000,
        messages: [
          {
            role: 'system',
            content: `You are an expert strategic analyst specializing in SWOT analysis.

Your task is to analyze provided content and extract SWOT items following these strict rules:

STRENGTHS: Internal positive attributes, capabilities, resources, competitive advantages
WEAKNESSES: Internal limitations, gaps, vulnerabilities, areas needing improvement
OPPORTUNITIES: External favorable conditions, market trends, potential growth areas
THREATS: External risks, challenges, competitive pressures, adverse trends

CRITICAL RULES:
1. Strengths/Weaknesses = INTERNAL factors (within the organization/entity)
2. Opportunities/Threats = EXTERNAL factors (market, environment, competition)
3. Each item must be concise (1-2 sentences maximum)
4. Include specific evidence from the content
5. Assign confidence score (0.0-1.0) based on evidence strength
6. Cite the source URL for each item

Return JSON format:
{
  "strengths": [{"text": "...", "confidence": 0.85, "excerpt": "...", "source": "url"}],
  "weaknesses": [...],
  "opportunities": [...],
  "threats": [...]
}`
          },
          {
            role: 'user',
            content: `Analyze the following content and extract SWOT items for: ${body.title || 'Strategic Analysis'}

CONTENT SOURCES:
${contentSummaries.map((c, i) => `
[Source ${i + 1}] ${c.title}
URL: ${c.url}
Description: ${c.description}
Key Entities: ${c.entities.slice(0, 10).map((e: any) => e.text).join(', ')}
Top Phrases: ${c.phrases.slice(0, 5).map((p: any) => p.phrase).join(', ')}

Content Excerpt:
${c.content}

---
`).join('\n')}

Extract 3-5 items per SWOT quadrant. Focus on actionable insights.`
          }
        ]
      })
    })

    if (!gptResponse.ok) {
      const errorText = await gptResponse.text()
      console.error('[SWOT Auto-Populate] GPT API error:', gptResponse.status, errorText)
      return new Response(JSON.stringify({
        success: false,
        error: `GPT API error: ${gptResponse.status}`
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const gptData = await gptResponse.json() as any
    const gptContent = gptData.choices[0].message.content

    console.log('[SWOT Auto-Populate] GPT response length:', gptContent.length)

    // Parse JSON from GPT response (handle markdown code blocks if present)
    let swotData
    try {
      // Remove markdown code blocks if present
      const jsonMatch = gptContent.match(/```json\n?([\s\S]*?)\n?```/) || gptContent.match(/```\n?([\s\S]*?)\n?```/)
      const jsonStr = jsonMatch ? jsonMatch[1] : gptContent
      swotData = JSON.parse(jsonStr.trim())
    } catch (parseError) {
      console.error('[SWOT Auto-Populate] Failed to parse GPT JSON:', parseError)
      console.error('[SWOT Auto-Populate] GPT content:', gptContent)
      return new Response(JSON.stringify({
        success: false,
        error: 'Failed to parse GPT response. Please try again.'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Validate and format response
    const response: SwotAutoPopulateResponse = {
      success: true,
      strengths: swotData.strengths || [],
      weaknesses: swotData.weaknesses || [],
      opportunities: swotData.opportunities || [],
      threats: swotData.threats || [],
      metadata: {
        contentCount: results.length,
        totalItems: (swotData.strengths?.length || 0) +
                    (swotData.weaknesses?.length || 0) +
                    (swotData.opportunities?.length || 0) +
                    (swotData.threats?.length || 0),
        processingTime: Date.now() - startTime,
        model: 'gpt-4o-mini' // Will update to gpt-5-mini when available
      }
    }

    console.log(`[SWOT Auto-Populate] Generated ${response.metadata.totalItems} items in ${response.metadata.processingTime}ms`)

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('[SWOT Auto-Populate] Error:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
