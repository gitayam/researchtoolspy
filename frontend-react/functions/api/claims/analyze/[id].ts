/**
 * Manual Claims Analysis API
 * POST /api/claims/analyze/:content_analysis_id
 * Extracts claims and runs deception analysis (manual tool like DIME/Starbursting)
 */

import { getUserIdOrDefault } from '../../_shared/auth-helpers'
import { callOpenAIViaGateway, getOptimalCacheTTL } from '../../_shared/ai-gateway'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
  OPENAI_API_KEY: string
  AI_GATEWAY_ACCOUNT_ID?: string
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const userId = await getUserIdOrDefault(context.request, context.env)

    const url = new URL(context.request.url)
    const pathParts = url.pathname.split('/')
    const contentAnalysisId = pathParts[pathParts.length - 1]

    if (!contentAnalysisId || contentAnalysisId === 'analyze') {
      return new Response(JSON.stringify({
        error: 'content_analysis_id is required in URL path'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Get the content analysis
    const analysis = await context.env.DB.prepare(`
      SELECT id, user_id, full_text, title, url
      FROM content_analysis
      WHERE id = ?
    `).bind(contentAnalysisId).first()

    if (!analysis) {
      return new Response(JSON.stringify({ error: 'Analysis not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Verify ownership
    if (analysis.user_id !== userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const fullText = analysis.full_text as string || ''
    const title = analysis.title as string || ''

    if (!fullText) {
      return new Response(JSON.stringify({ error: 'No text content available for claims analysis' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('[Claims Analysis] Starting manual claims analysis for content ID:', contentAnalysisId)

    // Extract claims
    const claims = await extractClaims(fullText, context.env, title)
    console.log(`[Claims Analysis] Extracted ${claims.length} claims`)

    let claimAnalysis
    if (claims.length > 0) {
      // Run deception analysis
      claimAnalysis = await analyzeClaimsForDeception(claims, fullText, context.env)
      console.log('[Claims Analysis] Deception analysis complete')
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
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('[Claims Analysis] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to run claims analysis',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
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
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are an expert at extracting factual claims from text. Return only valid JSON.' },
        { role: 'user', content: prompt }
      ],
      max_completion_tokens: 2000,
      temperature: 0.2
    }, {
      cacheTTL: getOptimalCacheTTL('claim-extraction'),
      metadata: {
        endpoint: 'claims-analysis',
        operation: 'extract-claims'
      },
      timeout: 30000
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
      risk_score: number
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
        "risk_score": 25,
        "methods": {
          "internal_consistency": {
            "score": 90,
            "reasoning": "No contradictions found"
          },
          "source_credibility": {
            "score": 85,
            "reasoning": "Authoritative source on this topic"
          },
          "evidence_quality": {
            "score": 80,
            "reasoning": "Strong supporting evidence provided"
          },
          "logical_coherence": {
            "score": 90,
            "reasoning": "Claim makes logical sense"
          },
          "temporal_consistency": {
            "score": 95,
            "reasoning": "Timeline is consistent"
          },
          "specificity": {
            "score": 80,
            "reasoning": "Includes specific details"
          }
        },
        "red_flags": [],
        "confidence_assessment": "High confidence this is factual"
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
      temperature: 0.3
    }, {
      cacheTTL: getOptimalCacheTTL('claim-analysis'),
      metadata: {
        endpoint: 'claims-analysis',
        operation: 'deception-analysis'
      },
      timeout: 30000
    })

    if (!data.choices?.[0]?.message?.content) {
      throw new Error('Invalid API response for deception analysis')
    }

    const jsonText = data.choices[0].message.content
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()

    const result = JSON.parse(jsonText)
    console.log('[DEBUG] Deception analysis complete:', result.summary?.total_claims, 'claims analyzed')
    return result

  } catch (error) {
    console.error('[Deception Analysis] Error:', error)

    // Return claims with error indicators
    return {
      claims: claims.map(c => ({
        ...c,
        deception_analysis: {
          overall_risk: 'medium' as const,
          risk_score: null as any,
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
        overall_content_credibility: null as any
      }
    }
  }
}

// CORS preflight
export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  })
}
