/**
 * Smart SATS Pre-Evaluation System
 * Uses AI to automatically generate initial SATS evidence evaluations
 * Based on text analysis and contextual understanding
 */

import OpenAI from 'openai'
import { checkAIAvailability } from './ai-analysis'
import { EVIDENCE_QUESTIONS, calculateEvidenceConfidence, getCredibilityRating } from './evidence-evaluation'

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY || 'demo-key',
  dangerouslyAllowBrowser: true
})

export interface SmartSATSResult {
  scores: Record<string, number>
  rationale: Record<string, string>
  confidence: {
    confidence: number
    level: 'VERY_HIGH' | 'HIGH' | 'MODERATE' | 'LOW' | 'VERY_LOW'
    percentage: number
  }
  credibility: {
    letter: string
    description: string
    color: string
  }
  recommendations: string[]
  warnings: string[]
}

export interface EvidenceContext {
  text: string
  source?: string
  publication?: string
  date?: string
  author?: string
  url?: string
  additionalContext?: string
}

/**
 * Generate smart SATS pre-evaluation using AI analysis
 */
export async function generateSmartSATSEvaluation(
  evidence: EvidenceContext
): Promise<SmartSATSResult> {
  try {
    const prompt = `You are an intelligence analyst expert in Structured Analytic Techniques (SATS) evidence evaluation. Analyze the provided evidence and assign scores for each SATS criterion.

EVIDENCE TO ANALYZE:
Text: ${evidence.text}
${evidence.source ? `Source: ${evidence.source}` : ''}
${evidence.publication ? `Publication: ${evidence.publication}` : ''}
${evidence.date ? `Date: ${evidence.date}` : ''}
${evidence.author ? `Author: ${evidence.author}` : ''}
${evidence.url ? `URL: ${evidence.url}` : ''}
${evidence.additionalContext ? `Additional Context: ${evidence.additionalContext}` : ''}

SATS EVALUATION CRITERIA:
${EVIDENCE_QUESTIONS.map(q => `
${q.id.toUpperCase()}: ${q.question}
Options:
${q.options.map(opt => `- ${opt.label} (weight: ${opt.weight})`).join('\n')}
Guidance: ${q.guidance}
`).join('\n')}

Analyze the evidence systematically and provide scores for each criterion. Consider:

1. SOURCE ANALYSIS:
   - What type of source is this (primary/secondary/tertiary)?
   - What indicators suggest the source's reliability?
   - Are there signs of bias or motivation issues?

2. CONTENT ANALYSIS:
   - Can the information be corroborated?
   - How direct is the information chain?
   - How current/relevant is the timing?

3. EXPERTISE & ACCESS:
   - Does the source demonstrate relevant expertise?
   - What level of access to information is indicated?

4. RED FLAGS:
   - Any obvious credibility concerns?
   - Contradictory information?
   - Missing critical details?

Format your response as JSON:
{
  "scores": {
    "source_type": weight_number,
    "corroboration": weight_number,
    "source_bias": weight_number,
    "motivation_to_deceive": weight_number,
    "directness": weight_number,
    "timeliness": weight_number,
    "expertise": weight_number,
    "access_to_information": weight_number
  },
  "rationale": {
    "source_type": "explanation for score",
    "corroboration": "explanation for score",
    "source_bias": "explanation for score", 
    "motivation_to_deceive": "explanation for score",
    "directness": "explanation for score",
    "timeliness": "explanation for score",
    "expertise": "explanation for score",
    "access_to_information": "explanation for score"
  },
  "recommendations": [
    "specific actionable recommendation based on analysis",
    "another recommendation if warranted"
  ],
  "warnings": [
    "critical concern about evidence reliability",
    "another warning if significant issues found"
  ]
}

Be conservative in scoring - when in doubt, assign lower scores. Focus on what can be determined from the available information.`

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a senior intelligence analyst with expertise in SATS methodology and evidence evaluation. You provide rigorous, conservative assessments following intelligence community standards.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.2,
      max_tokens: 2000
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error('No response from AI service')
    }

    const aiResult = JSON.parse(content)
    
    // Calculate confidence and credibility ratings
    const confidence = calculateEvidenceConfidence(aiResult.scores)
    const credibility = getCredibilityRating(confidence.confidence)

    return {
      scores: aiResult.scores,
      rationale: aiResult.rationale,
      confidence,
      credibility,
      recommendations: aiResult.recommendations || [],
      warnings: aiResult.warnings || []
    }

  } catch (error) {
    console.error('Error generating smart SATS evaluation:', error)
    return generateFallbackSATSEvaluation(evidence)
  }
}

/**
 * Generate fallback SATS evaluation using rule-based analysis
 */
function generateFallbackSATSEvaluation(evidence: EvidenceContext): SmartSATSResult {
  const text = evidence.text.toLowerCase()
  const scores: Record<string, number> = {}
  const rationale: Record<string, string> = {}
  const recommendations: string[] = []
  const warnings: string[] = []

  // Rule-based analysis for basic scoring
  
  // Source Type Analysis
  if (evidence.source || evidence.publication) {
    if (text.includes('witnessed') || text.includes('observed') || text.includes('participated')) {
      scores.source_type = 13
      rationale.source_type = 'Text indicates direct observation or participation'
    } else if (evidence.source?.includes('news') || evidence.publication) {
      scores.source_type = 8
      rationale.source_type = 'Appears to be secondary source analysis'
    } else {
      scores.source_type = 5
      rationale.source_type = 'Source type unclear from available information'
    }
  } else {
    scores.source_type = 3
    rationale.source_type = 'No source information provided'
    warnings.push('Source information missing - credibility cannot be properly assessed')
  }

  // Corroboration Analysis
  if (text.includes('multiple sources') || text.includes('confirmed by')) {
    scores.corroboration = 13
    rationale.corroboration = 'Text mentions multiple sources or confirmation'
  } else if (text.includes('reported by') || text.includes('according to')) {
    scores.corroboration = 3
    rationale.corroboration = 'Single source reporting indicated'
  } else {
    scores.corroboration = 5
    rationale.corroboration = 'Corroboration status unclear'
    recommendations.push('Seek additional sources to corroborate this information')
  }

  // Source Bias Analysis
  const biasIndicators = ['allegedly', 'claimed', 'reportedly', 'biased', 'partial']
  if (biasIndicators.some(indicator => text.includes(indicator))) {
    scores.source_bias = 3
    rationale.source_bias = 'Text contains language suggesting potential bias'
    warnings.push('Potential bias indicators detected in text')
  } else {
    scores.source_bias = 8
    rationale.source_bias = 'No obvious bias indicators in text'
  }

  // Motivation to Deceive
  if (text.includes('conflict') || text.includes('dispute') || text.includes('controversial')) {
    scores.motivation_to_deceive = 5
    rationale.motivation_to_deceive = 'Potentially contentious subject matter'
  } else {
    scores.motivation_to_deceive = 8
    rationale.motivation_to_deceive = 'No apparent motivation for deception'
  }

  // Directness Analysis
  if (text.includes('first-hand') || text.includes('directly') || text.includes('personally')) {
    scores.directness = 13
    rationale.directness = 'Text suggests direct access to information'
  } else if (text.includes('told by') || text.includes('heard that')) {
    scores.directness = 5
    rationale.directness = 'Text suggests second-hand information'
  } else {
    scores.directness = 8
    rationale.directness = 'Directness unclear from text'
  }

  // Timeliness Analysis
  if (evidence.date) {
    const dateProvided = new Date(evidence.date)
    const now = new Date()
    const daysDiff = Math.abs((now.getTime() - dateProvided.getTime()) / (1000 * 3600 * 24))
    
    if (daysDiff <= 7) {
      scores.timeliness = 13
      rationale.timeliness = 'Very recent information (within a week)'
    } else if (daysDiff <= 30) {
      scores.timeliness = 8
      rationale.timeliness = 'Recent information (within a month)'
    } else if (daysDiff <= 365) {
      scores.timeliness = 5
      rationale.timeliness = 'Somewhat dated information'
    } else {
      scores.timeliness = 3
      rationale.timeliness = 'Old information (over a year)'
    }
  } else {
    scores.timeliness = 3
    rationale.timeliness = 'No date information provided'
    recommendations.push('Determine the date of this information')
  }

  // Expertise Analysis
  if (evidence.author && (text.includes('expert') || text.includes('specialist'))) {
    scores.expertise = 13
    rationale.expertise = 'Source appears to have relevant expertise'
  } else if (evidence.publication) {
    scores.expertise = 8
    rationale.expertise = 'Published source suggests some level of expertise'
  } else {
    scores.expertise = 5
    rationale.expertise = 'Expertise level unclear'
  }

  // Access to Information
  if (text.includes('official') || text.includes('authorized') || text.includes('inside')) {
    scores.access_to_information = 13
    rationale.access_to_information = 'Text suggests privileged access'
  } else {
    scores.access_to_information = 5
    rationale.access_to_information = 'Access level unclear from available information'
  }

  // Calculate overall confidence
  const confidence = calculateEvidenceConfidence(scores)
  const credibility = getCredibilityRating(confidence.confidence)

  return {
    scores,
    rationale,
    confidence,
    credibility,
    recommendations: recommendations.length > 0 ? recommendations : ['Consider seeking additional context for more accurate evaluation'],
    warnings: warnings.length > 0 ? warnings : []
  }
}

/**
 * Check if smart SATS evaluation service is available
 */
export async function checkSmartSATSAvailability(): Promise<boolean> {
  return await checkAIAvailability()
}

/**
 * Suggest evidence collection priorities based on current SATS scores
 */
export function suggestEvidenceImprovements(
  currentScores: Record<string, number>
): {
  priorities: Array<{
    criterion: string
    currentScore: number
    targetScore: number
    actionItems: string[]
    impact: 'high' | 'medium' | 'low'
  }>
  overallStrategy: string[]
} {
  const priorities = []
  const overallStrategy = []

  EVIDENCE_QUESTIONS.forEach(question => {
    const currentScore = currentScores[question.id] || 0
    if (currentScore <= 5) {
      const actionItems = []
      let targetScore = 8
      let impact: 'high' | 'medium' | 'low' = 'medium'

      switch (question.id) {
        case 'source_type':
          actionItems.push('Locate primary sources (witnesses, participants)')
          actionItems.push('Interview direct participants if possible')
          actionItems.push('Find original documents or recordings')
          impact = 'high'
          break
          
        case 'corroboration':
          actionItems.push('Search for additional independent sources')
          actionItems.push('Cross-reference with other reporting')
          actionItems.push('Check official records or databases')
          impact = 'high'
          break
          
        case 'source_bias':
          actionItems.push('Research source background and affiliations')
          actionItems.push('Look for sources with different perspectives')
          actionItems.push('Consider motivation and interests')
          impact = 'medium'
          break
          
        case 'motivation_to_deceive':
          actionItems.push('Analyze what source might gain/lose from deception')
          actionItems.push('Check source\'s track record for truthfulness')
          actionItems.push('Consider alternative explanations')
          impact = 'medium'
          break
          
        case 'directness':
          actionItems.push('Find sources closer to the original event')
          actionItems.push('Identify and interview direct participants')
          actionItems.push('Locate firsthand accounts or documents')
          impact = 'high'
          break
          
        case 'timeliness':
          actionItems.push('Seek more recent information on the topic')
          actionItems.push('Check if situation has changed since original reporting')
          actionItems.push('Find real-time or contemporary sources')
          impact = 'low'
          break
          
        case 'expertise':
          actionItems.push('Consult subject matter experts')
          actionItems.push('Find sources with relevant technical knowledge')
          actionItems.push('Verify claims with expert opinion')
          impact = 'medium'
          break
          
        case 'access_to_information':
          actionItems.push('Find sources with insider access')
          actionItems.push('Locate official or privileged sources')
          actionItems.push('Identify sources in position to know')
          impact = 'high'
          break
      }

      priorities.push({
        criterion: question.question,
        currentScore,
        targetScore,
        actionItems,
        impact
      })
    }
  })

  // Sort by impact and current score
  priorities.sort((a, b) => {
    const impactScore = { high: 3, medium: 2, low: 1 }
    return impactScore[b.impact] - impactScore[a.impact] || a.currentScore - b.currentScore
  })

  // Generate overall strategy
  const avgScore = Object.values(currentScores).reduce((a, b) => a + b, 0) / Object.keys(currentScores).length
  
  if (avgScore < 4) {
    overallStrategy.push('Evidence base is weak - prioritize finding primary sources and corroboration')
    overallStrategy.push('Consider deferring analysis until stronger evidence is available')
  } else if (avgScore < 7) {
    overallStrategy.push('Evidence base is moderate - focus on addressing specific weaknesses')
    overallStrategy.push('Proceed with analysis but note limitations in conclusions')
  } else {
    overallStrategy.push('Evidence base is strong - proceed with high confidence')
    overallStrategy.push('Continue monitoring for contradictory information')
  }

  return { priorities, overallStrategy }
}