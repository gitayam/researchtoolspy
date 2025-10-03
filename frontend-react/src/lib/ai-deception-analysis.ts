/**
 * AI-Powered Deception Analysis
 * Uses GPT-4 to analyze scenarios and auto-generate deception assessments
 * Based on CIA SATS Methodology + existing AI analysis patterns
 */

import OpenAI from 'openai'
import type { DeceptionScores, DeceptionAssessment } from './deception-scoring'
import { calculateDeceptionLikelihood, SCORING_CRITERIA } from './deception-scoring'

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY || 'demo-key',
  dangerouslyAllowBrowser: true
})

export interface AIDeceptionAnalysis {
  // Auto-generated scores
  scores: DeceptionScores
  assessment: DeceptionAssessment

  // Executive summary for commanders
  executiveSummary: string
  bottomLine: string  // BLUF (Bottom Line Up Front)

  // Key findings
  deceptionLikelihood: number  // 0-100%
  keyIndicators: string[]
  counterIndicators: string[]

  // Recommendations
  recommendations: string[]
  collectionPriorities: string[]
  riskMitigation: string[]

  // Alternative explanations
  alternativeExplanations: string[]

  // Confidence factors
  confidenceFactors: {
    strengths: string[]
    weaknesses: string[]
  }

  // Predictions
  trendAssessment: 'INCREASING' | 'STABLE' | 'DECREASING'
  indicatorsToWatch: string[]
}

export interface DeceptionScenario {
  scenario: string
  mom?: string      // MOM analysis text
  pop?: string      // POP analysis text
  moses?: string    // MOSES analysis text
  eve?: string      // EVE analysis text
  additionalContext?: string
}

/**
 * Analyze deception scenario with AI
 */
export async function analyzeDeceptionWithAI(
  scenario: DeceptionScenario
): Promise<AIDeceptionAnalysis> {
  try {
    const prompt = buildDeceptionPrompt(scenario)

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a senior intelligence analyst expert in deception detection using CIA Structured Analytic Techniques (SATS). You follow the MOM-POP-MOSES-EVE framework developed by Richards J. Heuer Jr. for the CIA.

Your analysis must be:
- Conservative and evidence-based
- Follow intelligence community standards
- Provide actionable recommendations
- Consider alternative explanations
- Focus on what can be eliminated rather than confirmed`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.2,  // Low temperature for analytical consistency
      max_tokens: 3000
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error('No response from AI service')
    }

    const aiResult = JSON.parse(content)

    // Calculate assessment from AI-generated scores
    const assessment = calculateDeceptionLikelihood(aiResult.scores)

    return {
      scores: aiResult.scores,
      assessment,
      executiveSummary: aiResult.executiveSummary,
      bottomLine: aiResult.bottomLine,
      deceptionLikelihood: assessment.overallLikelihood,
      keyIndicators: aiResult.keyIndicators || [],
      counterIndicators: aiResult.counterIndicators || [],
      recommendations: aiResult.recommendations || [],
      collectionPriorities: aiResult.collectionPriorities || [],
      riskMitigation: aiResult.riskMitigation || [],
      alternativeExplanations: aiResult.alternativeExplanations || [],
      confidenceFactors: aiResult.confidenceFactors || { strengths: [], weaknesses: [] },
      trendAssessment: aiResult.trendAssessment || 'STABLE',
      indicatorsToWatch: aiResult.indicatorsToWatch || []
    }

  } catch (error) {
    console.error('Error in AI deception analysis:', error)
    return generateFallbackAnalysis(scenario)
  }
}

/**
 * Build comprehensive prompt for AI analysis
 */
function buildDeceptionPrompt(scenario: DeceptionScenario): string {
  return `Conduct a deception detection analysis using the MOM-POP-MOSES-EVE framework.

SCENARIO:
${scenario.scenario}

${scenario.mom ? `MOM (Motive, Opportunity, Means) ANALYSIS:
${scenario.mom}
` : ''}
${scenario.pop ? `POP (Patterns of Practice) ANALYSIS:
${scenario.pop}
` : ''}
${scenario.moses ? `MOSES (My Own Sources) ANALYSIS:
${scenario.moses}
` : ''}
${scenario.eve ? `EVE (Evaluation of Evidence) ANALYSIS:
${scenario.eve}
` : ''}
${scenario.additionalContext ? `ADDITIONAL CONTEXT:
${scenario.additionalContext}
` : ''}

SCORING CRITERIA:
Assign scores (0-5) for each criterion based on the scenario and analysis:

MOM (Motive, Opportunity, Means):
- Motive: ${SCORING_CRITERIA.motive.levels.map(l => `${l.value}=${l.label}`).join(', ')}
- Opportunity: ${SCORING_CRITERIA.opportunity.levels.map(l => `${l.value}=${l.label}`).join(', ')}
- Means: ${SCORING_CRITERIA.means.levels.map(l => `${l.value}=${l.label}`).join(', ')}

POP (Patterns of Practice):
- Historical Pattern: ${SCORING_CRITERIA.historicalPattern.levels.map(l => `${l.value}=${l.label}`).join(', ')}
- Sophistication: ${SCORING_CRITERIA.sophisticationLevel.levels.map(l => `${l.value}=${l.label}`).join(', ')}
- Success Rate: ${SCORING_CRITERIA.successRate.levels.map(l => `${l.value}=${l.label}`).join(', ')}

MOSES (My Own Sources):
- Source Vulnerability: ${SCORING_CRITERIA.sourceVulnerability.levels.map(l => `${l.value}=${l.label}`).join(', ')}
- Manipulation Evidence: ${SCORING_CRITERIA.manipulationEvidence.levels.map(l => `${l.value}=${l.label}`).join(', ')}

EVE (Evaluation of Evidence):
- Internal Consistency: ${SCORING_CRITERIA.internalConsistency.levels.map(l => `${l.value}=${l.label}`).join(', ')}
- External Corroboration: ${SCORING_CRITERIA.externalCorroboration.levels.map(l => `${l.value}=${l.label}`).join(', ')}
- Anomaly Detection: ${SCORING_CRITERIA.anomalyDetection.levels.map(l => `${l.value}=${l.label}`).join(', ')}

ANALYSIS REQUIREMENTS:

1. SCORING: Assign conservative scores for each criterion based on available information
2. EXECUTIVE SUMMARY: Write a 3-4 sentence commander's brief (BLUF style)
3. BOTTOM LINE: One sentence conclusion about deception likelihood
4. KEY INDICATORS: List 3-5 specific signs pointing to deception
5. COUNTER-INDICATORS: List 2-3 pieces of evidence against deception
6. RECOMMENDATIONS: Provide 3-4 actionable next steps
7. COLLECTION PRIORITIES: What additional information would help most?
8. RISK MITIGATION: How to reduce exposure if deception is occurring?
9. ALTERNATIVE EXPLANATIONS: What else could explain the situation?
10. CONFIDENCE FACTORS: What strengthens/weakens confidence in assessment?
11. TREND: Is deception risk INCREASING, STABLE, or DECREASING?
12. INDICATORS TO WATCH: What would change the assessment?

Return response as JSON:
{
  "scores": {
    "motive": number,
    "opportunity": number,
    "means": number,
    "historicalPattern": number,
    "sophisticationLevel": number,
    "successRate": number,
    "sourceVulnerability": number,
    "manipulationEvidence": number,
    "internalConsistency": number,
    "externalCorroboration": number,
    "anomalyDetection": number
  },
  "executiveSummary": "CDR, based on MOM-POP-MOSES-EVE analysis...",
  "bottomLine": "One sentence conclusion",
  "keyIndicators": ["indicator 1", "indicator 2", ...],
  "counterIndicators": ["counter 1", "counter 2", ...],
  "recommendations": ["rec 1", "rec 2", ...],
  "collectionPriorities": ["priority 1", "priority 2", ...],
  "riskMitigation": ["mitigation 1", "mitigation 2", ...],
  "alternativeExplanations": ["explanation 1", "explanation 2", ...],
  "confidenceFactors": {
    "strengths": ["strength 1", ...],
    "weaknesses": ["weakness 1", ...]
  },
  "trendAssessment": "INCREASING|STABLE|DECREASING",
  "indicatorsToWatch": ["indicator 1", "indicator 2", ...]
}

Be conservative in scoring. When in doubt, assign lower scores. Focus on what the evidence allows us to eliminate or confirm.`
}

/**
 * Generate fallback analysis when AI fails
 */
function generateFallbackAnalysis(scenario: DeceptionScenario): AIDeceptionAnalysis {
  // Rule-based scoring
  const scores = generateRuleBasedScores(scenario)
  const assessment = calculateDeceptionLikelihood(scores)

  return {
    scores,
    assessment,
    executiveSummary: `CDR, preliminary MOM-POP-MOSES-EVE analysis of the scenario suggests ${assessment.overallLikelihood}% likelihood of deception (${assessment.riskLevel} risk). Assessment based on available indicators with ${assessment.confidenceLevel.toLowerCase().replace('_', ' ')} confidence. Recommend additional collection to refine estimate.`,
    bottomLine: `Deception likelihood assessed at ${assessment.overallLikelihood}% based on initial analysis.`,
    deceptionLikelihood: assessment.overallLikelihood,
    keyIndicators: [
      'Scenario contains elements suggesting potential deception',
      'Further analysis required to confirm indicators',
      'AI-assisted analysis unavailable - manual review recommended'
    ],
    counterIndicators: [
      'Insufficient data for definitive counter-indicators',
      'Alternative explanations possible'
    ],
    recommendations: [
      'Conduct detailed MOM-POP-MOSES-EVE analysis with subject matter experts',
      'Seek additional sources to corroborate or refute indicators',
      'Monitor for pattern changes or new information'
    ],
    collectionPriorities: [
      'Independent source verification',
      'Historical deception pattern research',
      'Source credibility assessment'
    ],
    riskMitigation: [
      'Treat information as potentially compromised until verified',
      'Seek alternative information channels',
      'Implement deception countermeasures'
    ],
    alternativeExplanations: [
      'Information may be accurate but misinterpreted',
      'Coincidental patterns not indicative of deception',
      'Partial truth mixed with inaccuracies'
    ],
    confidenceFactors: {
      strengths: ['Systematic framework application', 'Multiple criteria evaluation'],
      weaknesses: ['Limited AI analysis', 'Incomplete scenario information', 'Requires expert validation']
    },
    trendAssessment: 'STABLE',
    indicatorsToWatch: [
      'Changes in source behavior or access',
      'New corroborating or contradicting evidence',
      'Pattern shifts in adversary activities'
    ]
  }
}

/**
 * Rule-based scoring for fallback analysis
 */
function generateRuleBasedScores(scenario: DeceptionScenario): DeceptionScores {
  const text = `${scenario.scenario} ${scenario.mom || ''} ${scenario.pop || ''} ${scenario.moses || ''} ${scenario.eve || ''}`.toLowerCase()

  const scores: DeceptionScores = {
    motive: 2,
    opportunity: 2,
    means: 2,
    historicalPattern: 2,
    sophisticationLevel: 2,
    successRate: 2,
    sourceVulnerability: 2,
    manipulationEvidence: 2,
    internalConsistency: 3,
    externalCorroboration: 3,
    anomalyDetection: 2
  }

  // Motive indicators
  if (text.includes('gain') || text.includes('benefit') || text.includes('advantage')) scores.motive += 1
  if (text.includes('critical') || text.includes('survival') || text.includes('threat')) scores.motive += 1

  // Opportunity indicators
  if (text.includes('control') || text.includes('monopoly') || text.includes('exclusive')) scores.opportunity += 1
  if (text.includes('state media') || text.includes('censorship')) scores.opportunity += 1

  // Means indicators
  if (text.includes('propaganda') || text.includes('sophisticated') || text.includes('capabilities')) scores.means += 1
  if (text.includes('denial') || text.includes('deception') || text.includes('maskirovka')) scores.means += 1

  // Historical pattern
  if (text.includes('history') || text.includes('past') || text.includes('previous')) scores.historicalPattern += 1
  if (text.includes('pattern') || text.includes('repeatedly') || text.includes('routine')) scores.historicalPattern += 1

  // Source vulnerability
  if (text.includes('single source') || text.includes('limited access') || text.includes('vulnerable')) scores.sourceVulnerability += 1
  if (text.includes('compromised') || text.includes('controlled')) scores.sourceVulnerability += 1

  // Evidence quality (inverted)
  if (text.includes('inconsistent') || text.includes('contradicts') || text.includes('conflicting')) {
    scores.internalConsistency = Math.max(0, scores.internalConsistency - 2)
    scores.anomalyDetection += 2
  }
  if (text.includes('no corroboration') || text.includes('unverified') || text.includes('uncorroborated')) {
    scores.externalCorroboration = Math.max(0, scores.externalCorroboration - 2)
  }

  // Cap all scores at 5
  Object.keys(scores).forEach(key => {
    scores[key as keyof DeceptionScores] = Math.min(5, scores[key as keyof DeceptionScores])
  })

  return scores
}

/**
 * Check if AI service is available
 */
export async function checkAIAvailability(): Promise<boolean> {
  try {
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY
    if (!apiKey || apiKey === 'demo-key') {
      return false
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'Test' }],
      max_tokens: 1
    })

    return !!response.choices[0]
  } catch {
    return false
  }
}

/**
 * Generate predictions based on historical analysis
 */
export async function generatePredictions(
  currentAnalysis: AIDeceptionAnalysis,
  historicalPatterns?: DeceptionScores[]
): Promise<{
  futureRisk: 'INCREASING' | 'STABLE' | 'DECREASING'
  confidenceInterval: { min: number; max: number }
  keyDrivers: string[]
  scenarioForecasts: Array<{
    condition: string
    impact: string
    likelihood: number
  }>
}> {
  // Simple trend analysis if we have historical data
  if (historicalPatterns && historicalPatterns.length >= 3) {
    const recentTrend = analyzeHistoricalTrend(historicalPatterns)
    return recentTrend
  }

  // Single-point prediction based on current scores
  const currentLikelihood = currentAnalysis.deceptionLikelihood
  const margin = currentAnalysis.assessment.confidenceLevel === 'VERY_HIGH' ? 5 :
                 currentAnalysis.assessment.confidenceLevel === 'HIGH' ? 10 :
                 currentAnalysis.assessment.confidenceLevel === 'MODERATE' ? 15 :
                 currentAnalysis.assessment.confidenceLevel === 'LOW' ? 20 : 25

  return {
    futureRisk: currentAnalysis.trendAssessment,
    confidenceInterval: {
      min: Math.max(0, currentLikelihood - margin),
      max: Math.min(100, currentLikelihood + margin)
    },
    keyDrivers: currentAnalysis.keyIndicators.slice(0, 3),
    scenarioForecasts: [
      {
        condition: 'If additional corroborating evidence emerges',
        impact: 'Deception likelihood increases 15-25%',
        likelihood: 40
      },
      {
        condition: 'If independent sources contradict current assessment',
        impact: 'Deception likelihood decreases 20-30%',
        likelihood: 30
      },
      {
        condition: 'If pattern continues unchanged',
        impact: 'Assessment remains stable within confidence interval',
        likelihood: 60
      }
    ]
  }
}

/**
 * Analyze historical trend from multiple assessments
 */
function analyzeHistoricalTrend(patterns: DeceptionScores[]): any {
  const likelihoods = patterns.map(p => calculateDeceptionLikelihood(p).overallLikelihood)

  // Simple linear regression to detect trend
  const avgChange = (likelihoods[likelihoods.length - 1] - likelihoods[0]) / likelihoods.length

  const futureRisk = avgChange > 5 ? 'INCREASING' :
                     avgChange < -5 ? 'DECREASING' : 'STABLE'

  const currentLikelihood = likelihoods[likelihoods.length - 1]
  const variance = Math.max(...likelihoods) - Math.min(...likelihoods)

  return {
    futureRisk,
    confidenceInterval: {
      min: Math.max(0, currentLikelihood - variance / 2),
      max: Math.min(100, currentLikelihood + variance / 2)
    },
    keyDrivers: ['Historical pattern analysis', 'Trend direction confirmed', 'Multiple data points'],
    scenarioForecasts: [
      {
        condition: 'Trend continues at current rate',
        impact: `Deception likelihood ${futureRisk.toLowerCase()} by ${Math.abs(avgChange).toFixed(0)}% per assessment`,
        likelihood: 70
      },
      {
        condition: 'Significant pattern disruption',
        impact: 'Trend may reverse or accelerate',
        likelihood: 20
      },
      {
        condition: 'No new information',
        impact: 'Assessment stabilizes around current level',
        likelihood: 50
      }
    ]
  }
}
