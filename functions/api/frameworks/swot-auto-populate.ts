/**
 * SWOT Auto-Population API
 * POST /api/frameworks/swot-auto-populate
 *
 * Analyzes content from Content Intelligence and auto-generates SWOT items
 * using AI. Extracts strengths, weaknesses, opportunities, and threats
 * with source attribution and confidence scores.
 */

import { requireAuth } from '../_shared/auth-helpers'
import { callOpenAIViaGateway } from '../_shared/ai-gateway'
import { JSON_HEADERS, optionsResponse } from '../_shared/api-utils'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
  OPENAI_API_KEY: string
  AI_GATEWAY_ACCOUNT_ID?: string
}

interface SwotItem {
  text: string
  source: string
  confidence: number
  excerpt?: string
}

interface SwotAutoPopulateRequest {
  contentIds: string[]
  workspaceId?: string
  title?: string
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

// Validate a single SWOT item from AI response
function validateSwotItem(raw: any, fallbackSource: string): SwotItem | null {
  if (!raw || typeof raw !== 'object') return null
  const text = typeof raw.text === 'string' ? raw.text.trim() : ''
  if (!text) return null
  return {
    text,
    source: typeof raw.source === 'string' ? raw.source : fallbackSource,
    confidence: typeof raw.confidence === 'number' ? Math.max(0, Math.min(1, raw.confidence)) : 0.5,
    excerpt: typeof raw.excerpt === 'string' ? raw.excerpt : undefined,
  }
}

function validateSwotArray(arr: any, fallbackSource: string): SwotItem[] {
  if (!Array.isArray(arr)) return []
  return arr.map(item => validateSwotItem(item, fallbackSource)).filter(Boolean) as SwotItem[]
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const startTime = Date.now()

  try {
    const userId = await requireAuth(context.request, context.env)

    const body = await context.request.json() as SwotAutoPopulateRequest

    if (!body.contentIds || body.contentIds.length === 0) {
      return new Response(JSON.stringify({ error: 'No content IDs provided' }), {
        status: 400, headers: JSON_HEADERS
      })
    }

    if (body.contentIds.length > 5) {
      return new Response(JSON.stringify({ error: 'Maximum 5 content sources allowed' }), {
        status: 400, headers: JSON_HEADERS
      })
    }

    // Fetch content from database
    const placeholders = body.contentIds.map(() => '?').join(',')
    const { results } = await context.env.DB.prepare(`
      SELECT id, url, title, description, main_content, key_entities, top_10_phrases
      FROM content_intelligence
      WHERE id IN (${placeholders})
      LIMIT 5
    `).bind(...body.contentIds).all()

    if (!results || results.length === 0) {
      return new Response(JSON.stringify({ error: 'No content found for provided IDs' }), {
        status: 404, headers: JSON_HEADERS
      })
    }

    // Prepare content summaries
    const contentSummaries = results.map((c: any) => {
      const entities = c.key_entities ? JSON.parse(c.key_entities) : []
      const phrases = c.top_10_phrases ? JSON.parse(c.top_10_phrases) : []
      return {
        url: c.url || '',
        title: c.title || 'Untitled',
        description: c.description || '',
        content: (c.main_content || '').substring(0, 3000),
        entities: entities.slice(0, 10).map((e: any) => e.text || e).join(', '),
        phrases: phrases.slice(0, 5).map((p: any) => p.phrase || p).join(', '),
      }
    })

    const data = await callOpenAIViaGateway(
      context.env,
      {
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an expert strategic analyst specializing in SWOT analysis.

Analyze provided content and extract SWOT items:

STRENGTHS: Internal positive attributes, capabilities, competitive advantages
WEAKNESSES: Internal limitations, gaps, vulnerabilities
OPPORTUNITIES: External favorable conditions, market trends, growth areas
THREATS: External risks, challenges, competitive pressures

Rules:
1. Strengths/Weaknesses = INTERNAL factors
2. Opportunities/Threats = EXTERNAL factors
3. Each item: 1-2 sentences maximum
4. Include confidence score (0.0-1.0) based on evidence strength
5. Cite the source URL

Return JSON:
{
  "strengths": [{"text": "...", "confidence": 0.85, "excerpt": "...", "source": "url"}],
  "weaknesses": [...],
  "opportunities": [...],
  "threats": [...]
}`
          },
          {
            role: 'user',
            content: `Analyze and extract SWOT items for: ${body.title || 'Strategic Analysis'}

CONTENT SOURCES:
${contentSummaries.map((c, i) => `
[Source ${i + 1}] ${c.title}
URL: ${c.url}
Description: ${c.description}
Key Entities: ${c.entities}
Top Phrases: ${c.phrases}

Content Excerpt:
${c.content}

---
`).join('\n')}

Extract 3-5 items per SWOT quadrant. Focus on actionable insights.`
          }
        ],
        temperature: 0.7,
        max_completion_tokens: 2000,
        response_format: { type: 'json_object' }
      },
      {
        cacheTTL: 1800,
        metadata: { endpoint: 'swot-auto-populate', userId },
        timeout: 30000
      }
    )

    if (!data?.choices?.[0]?.message?.content) {
      throw new Error('Empty AI response')
    }

    let content = data.choices[0].message.content.trim()
    if (content.startsWith('```')) {
      content = content.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '')
    }

    let parsed: any
    try {
      parsed = JSON.parse(content)
    } catch {
      console.error('[SWOT] Failed to parse AI response:', content.slice(0, 200))
      throw new Error('AI returned invalid JSON')
    }

    const fallbackSource = contentSummaries[0]?.url || 'unknown'
    const strengths = validateSwotArray(parsed.strengths, fallbackSource)
    const weaknesses = validateSwotArray(parsed.weaknesses, fallbackSource)
    const opportunities = validateSwotArray(parsed.opportunities, fallbackSource)
    const threats = validateSwotArray(parsed.threats, fallbackSource)

    const response: SwotAutoPopulateResponse = {
      success: true,
      strengths,
      weaknesses,
      opportunities,
      threats,
      metadata: {
        contentCount: results.length,
        totalItems: strengths.length + weaknesses.length + opportunities.length + threats.length,
        processingTime: Date.now() - startTime,
        model: 'gpt-4o-mini'
      }
    }

    return new Response(JSON.stringify(response), { headers: JSON_HEADERS })
  } catch (error) {
    if (error instanceof Response) return error
    console.error('[SWOT Auto-Populate] Error:', error)
    return new Response(JSON.stringify({ error: 'Failed to auto-populate SWOT' }), {
      status: 500, headers: JSON_HEADERS
    })
  }
}

export const onRequestGet: PagesFunction = async () => {
  return new Response(JSON.stringify({ error: 'Method not allowed. Use POST.' }), {
    status: 405, headers: JSON_HEADERS,
  })
}

export const onRequestOptions: PagesFunction = async () => {
  return optionsResponse()
}
