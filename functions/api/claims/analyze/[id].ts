/**
 * Manual Claims Analysis API
 * POST /api/claims/analyze/:content_analysis_id
 * Extracts claims and runs deception analysis (manual tool like DIME/Starbursting)
 */

import { getUserFromRequest } from '../../_shared/auth-helpers'
import { callOpenAIViaGateway, getOptimalCacheTTL, ANALYST_SYSTEM_PREFIX } from '../../_shared/ai-gateway'
import { analyzeClaimsForDeception } from '../../_shared/deception-analysis'
import { CORS_HEADERS, JSON_HEADERS, optionsResponse } from '../../_shared/api-utils'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
  OPENAI_API_KEY: string
  AI_GATEWAY_ACCOUNT_ID?: string
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const userId = await getUserFromRequest(context.request, context.env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: JSON_HEADERS,
      })
    }

    const url = new URL(context.request.url)
    const pathParts = url.pathname.split('/')
    const contentAnalysisId = pathParts[pathParts.length - 1]


    if (!contentAnalysisId || contentAnalysisId === 'analyze') {
      return new Response(JSON.stringify({
        error: 'content_analysis_id is required in URL path'
      }), {
        status: 400,
        headers: JSON_HEADERS
      })
    }

    // Get the content analysis
    const analysis = await context.env.DB.prepare(`
      SELECT id, user_id, extracted_text, title, url
      FROM content_analysis
      WHERE id = ?
    `).bind(contentAnalysisId).first()

    if (!analysis) {
      console.error('[Claims Analysis] Analysis not found:', contentAnalysisId)
      return new Response(JSON.stringify({ error: 'Analysis not found' }), {
        status: 404,
        headers: JSON_HEADERS
      })
    }

    // Verify ownership
    if (analysis.user_id !== userId) {
      console.error('[Claims Analysis] Unauthorized access attempt for analysis:', contentAnalysisId, 'by user:', userId)
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 403,
        headers: JSON_HEADERS
      })
    }

    const fullText = analysis.extracted_text as string || ''
    const title = analysis.title as string || ''

    if (!fullText) {
      console.error('[Claims Analysis] No extracted_text for analysis:', contentAnalysisId)
      return new Response(JSON.stringify({
        error: 'No text content available for claims analysis',
        details: 'The content analysis does not have extracted text. This typically means the URL analysis did not complete successfully.',
        suggestion: 'Try re-analyzing the URL with "Full Analysis" mode to ensure text extraction completes.'
      }), {
        status: 400,
        headers: JSON_HEADERS
      })
    }

    if (fullText.length < 100) {
      console.error('[Claims Analysis] Extracted text too short for analysis:', contentAnalysisId, 'length:', fullText.length)
      return new Response(JSON.stringify({
        error: 'Extracted text is too short for claims analysis',
        details: `Only ${fullText.length} characters of text were extracted. Need at least 100 characters.`,
        suggestion: 'The article may be behind a paywall or the content could not be extracted. Try a different source.'
      }), {
        status: 400,
        headers: JSON_HEADERS
      })
    }


    // Extract claims
    const claims = await extractClaims(fullText, context.env, title)

    let claimAnalysis
    if (claims.length > 0) {
      // Run deception analysis
      claimAnalysis = await analyzeClaimsForDeception(claims, fullText, context.env, {
        systemPrefix: ANALYST_SYSTEM_PREFIX,
        source: 'claims-analysis',
        operation: 'deception-analysis',
        timeout: 60000
      })
    } else {
      claimAnalysis = {
        claims: [],
        summary: {
          total_claims: 0,
          high_risk_claims: 0,
          medium_risk_claims: 0,
          low_risk_claims: 0,
          most_concerning_claim: 'No claims extracted',
          overall_content_credibility: null
        }
      }
    }

    // Update database
    await context.env.DB.prepare(`
      UPDATE content_analysis
      SET claim_analysis = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(
      JSON.stringify(claimAnalysis),
      contentAnalysisId
    ).run()


    return new Response(JSON.stringify({
      success: true,
      claim_analysis: claimAnalysis,
      message: `Claims analysis complete - ${claims.length} claims analyzed`
    }), {
      headers: JSON_HEADERS
    })

  } catch (error) {
    console.error('[Claims Analysis] Error:', error)
    console.error('[Claims Analysis] Error stack:', error instanceof Error ? error.stack : 'No stack')

    return new Response(JSON.stringify({
      error: 'Failed to run claims analysis'
    }), {
      status: 500,
      headers: JSON_HEADERS
    })
  }
}

/**
 * Extract factual claims from text
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
    const data = await callOpenAIViaGateway(env, {
      model: 'gpt-5.4-mini',
      messages: [
        { role: 'system', content: ANALYST_SYSTEM_PREFIX + 'You are an expert at extracting factual claims from text. Return only valid JSON.' },
        { role: 'user', content: prompt }
      ],
      max_completion_tokens: 2000,
      reasoning_effort: 'none',
      temperature: 0.2
    }, {
      cacheTTL: getOptimalCacheTTL('claim-extraction'),
      metadata: {
        endpoint: 'claims-analysis',
        operation: 'extract-claims'
      },
      timeout: 60000  // Increased to 60 seconds
    })

    if (!data.choices?.[0]?.message?.content) {
      throw new Error('Invalid API response for claim extraction')
    }

    const jsonText = data.choices[0].message.content
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()

    const claims = JSON.parse(jsonText)
    return Array.isArray(claims) ? claims : []

  } catch (error) {
    console.error('[Claim Extraction] Error:', error)
    return []
  }
}

/**
 * Analyze claims for deception using multiple methods
 */
// Reject GET requests (POST-only endpoint)
export const onRequestGet: PagesFunction = async () => {
  return new Response(JSON.stringify({ error: 'Method not allowed. Use POST.' }), {
    status: 405, headers: JSON_HEADERS,
  })
}

// CORS preflight
export const onRequestOptions: PagesFunction = async () => {
  return optionsResponse()
}
