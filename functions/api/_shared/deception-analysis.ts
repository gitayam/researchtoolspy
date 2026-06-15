/**
 * Shared deception-analysis engine for claim scoring.
 *
 * Per-claim analysis is token-heavy: 6 reasoning blocks + red_flags +
 * confidence_assessment per claim. A single batched LLM call for ~13+ claims
 * overflows the model's output budget (finish_reason: "length"), truncates the
 * JSON mid-string, and fails JSON.parse — which historically nulled out EVERY
 * claim ("AI analysis failed"). This module batches claims into small groups,
 * runs the batches concurrently, and isolates failures so one bad batch degrades
 * only its own claims instead of the whole analysis. The summary is recomputed
 * from the merged per-claim results.
 *
 * Single source of truth — previously copy-pasted (and drifted) across
 * content-intelligence/analyze-url.ts, claims/analyze/[id].ts, and
 * claims/retry-analysis/[id].ts.
 */

import { callOpenAIViaGateway, getOptimalCacheTTL } from './ai-gateway'
import { logEvent } from './event-log'

export interface DeceptionClaimInput {
  claim: string
  category: string
  source?: string
  confidence: number
  supporting_text?: string
}

interface DeceptionMethod { score: number; reasoning: string }

export interface DeceptionAnalysis {
  overall_risk: 'low' | 'medium' | 'high'
  risk_score: number
  methods: {
    internal_consistency: DeceptionMethod
    source_credibility: DeceptionMethod
    evidence_quality: DeceptionMethod
    logical_coherence: DeceptionMethod
    temporal_consistency: DeceptionMethod
    specificity: DeceptionMethod
  }
  red_flags: string[]
  confidence_assessment: string
}

export interface DeceptionResult {
  claims: Array<{
    claim: string
    category: string
    source?: string
    deception_analysis: DeceptionAnalysis
  }>
  summary: {
    total_claims: number
    high_risk_claims: number
    medium_risk_claims: number
    low_risk_claims: number
    most_concerning_claim?: string
    overall_content_credibility: number
  }
}

export interface DeceptionOptions {
  /** Prepended to the system prompt (e.g. ANALYST_SYSTEM_PREFIX to reduce refusals). */
  systemPrefix?: string
  /** Per-call gateway timeout in ms. */
  timeout?: number
  /** event_logs source + gateway metadata.endpoint. */
  source?: string
  /** Gateway metadata.operation. */
  operation?: string
  /** Claims per LLM call. 6 keeps each response well under the token budget. */
  batchSize?: number
}

const SYSTEM_BASE =
  'You are a deception detection expert trained in multiple analytical methods. ' +
  'Analyze claims objectively using: internal consistency, source credibility, evidence quality, ' +
  'logical coherence, temporal consistency, and specificity. Provide detailed reasoning for each score. ' +
  'Return ONLY valid JSON.'

function buildPrompt(batch: DeceptionClaimInput[], contextText: string): string {
  return `Analyze these claims for potential deception using multiple detection methods.

Full Article Context (for reference):
${contextText}...

Claims to Analyze:
${JSON.stringify(batch, null, 2)}

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
          "internal_consistency": { "score": 90, "reasoning": "No contradictions found" },
          "source_credibility": { "score": 85, "reasoning": "Authoritative source on this topic" },
          "evidence_quality": { "score": 80, "reasoning": "Strong supporting evidence provided" },
          "logical_coherence": { "score": 90, "reasoning": "Claim makes logical sense" },
          "temporal_consistency": { "score": 95, "reasoning": "Timeline is consistent" },
          "specificity": { "score": 80, "reasoning": "Includes specific details" }
        },
        "red_flags": [],
        "confidence_assessment": "High confidence this is factual"
      }
    }
  ]
}`
}

function fallbackFor(batch: DeceptionClaimInput[]): DeceptionResult['claims'] {
  return batch.map(c => ({
    claim: c.claim,
    category: c.category,
    source: c.source,
    deception_analysis: {
      overall_risk: 'medium' as const,
      risk_score: null as any, // null signals "not analyzed" so the UI prompts manual assessment
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
        'Analysis processing error'
      ],
      confidence_assessment: 'AI analysis failed - manual review strongly recommended. Edit scores below to provide your assessment.'
    }
  }))
}

export async function analyzeClaimsForDeception(
  claims: DeceptionClaimInput[],
  fullText: string,
  env: any,
  options: DeceptionOptions = {}
): Promise<DeceptionResult> {
  const {
    systemPrefix = '',
    timeout = 30000,
    source = 'deception-analysis',
    operation = 'deception-analysis',
    batchSize = 6
  } = options

  const contextText = (fullText || '').substring(0, 3000)
  const systemContent = systemPrefix + SYSTEM_BASE

  const analyzeBatch = async (batch: DeceptionClaimInput[]): Promise<DeceptionResult['claims']> => {
    const data = await callOpenAIViaGateway(env, {
      model: 'gpt-5.4-mini',
      messages: [
        { role: 'system', content: systemContent },
        { role: 'user', content: buildPrompt(batch, contextText) }
      ],
      max_completion_tokens: 4000, // ample for a 6-claim batch; keeps JSON from truncating
      reasoning_effort: 'none',
      temperature: 0.3 // Moderate temperature for balanced analysis
    }, {
      cacheTTL: getOptimalCacheTTL('claim-analysis'),
      metadata: { endpoint: source, operation },
      timeout
    })

    const content = data.choices?.[0]?.message?.content
    if (!content) {
      throw new Error('Invalid API response for deception analysis')
    }
    const jsonText = content
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()
    const parsed = JSON.parse(jsonText)
    if (!parsed || !Array.isArray(parsed.claims)) {
      throw new Error('Deception analysis returned no claims array')
    }
    return parsed.claims
  }

  // Split into batches and run concurrently; isolate failures so one truncated/failed
  // response degrades only its own claims to the manual-assessment state.
  const batches: DeceptionClaimInput[][] = []
  for (let i = 0; i < claims.length; i += batchSize) {
    batches.push(claims.slice(i, i + batchSize))
  }

  const batchResults = await Promise.all(batches.map(async (batch) => {
    try {
      return await analyzeBatch(batch)
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      console.error('[Deception Analysis] batch failed:', msg, '| claims in batch:', batch.length)
      // Wire the previously-invisible failure into event_logs (never throws).
      await logEvent(env, {
        level: 'error',
        source,
        message: `deception batch failed: ${msg}`,
        context: { claims_in_batch: batch.length, operation }
      })
      return fallbackFor(batch)
    }
  }))

  const mergedClaims = batchResults.flat()

  // Recompute the summary from merged per-claim results — per-batch summaries can't be
  // trusted (each only sees its own slice). Risk bands match the prompt: low <30,
  // medium 30-60, high >60. Credibility ≈ inverse of risk, averaged over scored claims.
  const scored = mergedClaims.filter((c: any) => typeof c?.deception_analysis?.risk_score === 'number')
  const high = scored.filter((c: any) => c.deception_analysis.risk_score > 60).length
  const medium = scored.filter((c: any) => c.deception_analysis.risk_score >= 30 && c.deception_analysis.risk_score <= 60).length
  const low = scored.filter((c: any) => c.deception_analysis.risk_score < 30).length
  const overall = scored.length
    ? Math.round(scored.reduce((s: number, c: any) => s + (100 - c.deception_analysis.risk_score), 0) / scored.length)
    : null
  const mostConcerning = scored.length
    ? scored.reduce((a: any, b: any) => (b.deception_analysis.risk_score > a.deception_analysis.risk_score ? b : a)).claim
    : 'Unable to determine - manual analysis needed'

  return {
    claims: mergedClaims as any,
    summary: {
      total_claims: mergedClaims.length,
      high_risk_claims: high,
      medium_risk_claims: medium,
      low_risk_claims: low,
      most_concerning_claim: mostConcerning,
      overall_content_credibility: overall as any // null when nothing scored
    }
  }
}
