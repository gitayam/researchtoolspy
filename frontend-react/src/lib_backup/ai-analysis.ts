/**
 * AI Analysis Service for ACH Executive Summaries
 * Uses GPT-5-mini for generating professional intelligence analysis
 */

import OpenAI from 'openai'
import { ACHExportData } from './ach-export'

// Initialize OpenAI client - will use environment variable or fallback
const openai = new OpenAI({
  apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY || 'demo-key',
  dangerouslyAllowBrowser: true // Only for client-side usage in demo
})

export interface AIAnalysisResult {
  executiveSummary: string
  keyFindings: string[]
  recommendations: string[]
  confidenceAssessment: string
  alternativeExplanations: string[]
  gaps: string[]
}

/**
 * Generate executive summary using GPT-5-mini
 */
export async function generateExecutiveSummary(data: ACHExportData): Promise<AIAnalysisResult> {
  try {
    // Prepare analysis context
    const analysisContext = prepareAnalysisContext(data)
    
    const prompt = `You are a senior intelligence analyst conducting an Analysis of Competing Hypotheses (ACH). Based on the following analysis data, provide a professional assessment for a military commander's briefing.

ANALYSIS CONTEXT:
${analysisContext}

Please provide a structured response with:

1. EXECUTIVE SUMMARY (single concise paragraph):
   - Write as if briefing a commander (CDR) following ACH methodology principles
   - Focus on hypotheses that can be dismissed/ruled out based on evidence
   - Identify remaining viable hypotheses rather than selecting one "most likely"
   - Emphasize what we can confidently eliminate vs. what remains plausible
   - Keep it focused, direct, and tactical - no more than 4-5 sentences

2. KEY FINDINGS (3-5 bullet points):
   - Most significant insights from the analysis
   - Critical evidence that drives conclusions
   - Evidence quality and credibility factors

3. RECOMMENDATIONS (2-4 bullet points):
   - Specific actionable recommendations based on findings
   - Areas for additional collection or investigation
   - Risk mitigation considerations

4. CONFIDENCE ASSESSMENT (1 paragraph):
   - Overall confidence in the primary hypothesis
   - Factors affecting confidence (evidence quality, quantity, consistency)
   - Limitations and uncertainties

5. ALTERNATIVE EXPLANATIONS (2-3 bullet points):
   - Other plausible hypotheses that remain viable
   - Why they are less likely but still possible

6. INTELLIGENCE GAPS (2-3 bullet points):
   - Missing information that would strengthen analysis
   - Collection priorities for follow-up

Format your response as JSON with the following structure:
{
  "executiveSummary": "...",
  "keyFindings": ["...", "..."],
  "recommendations": ["...", "..."],
  "confidenceAssessment": "...",
  "alternativeExplanations": ["...", "..."],
  "gaps": ["...", "..."]
}

Ensure your analysis is professional, objective, and follows intelligence community standards.`

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Using GPT-4o-mini as GPT-5-mini isn't available yet
      messages: [
        {
          role: 'system',
          content: 'You are a senior intelligence analyst with expertise in structured analytic techniques, particularly Analysis of Competing Hypotheses (ACH). You provide objective, professional assessments based on available evidence.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3, // Lower temperature for more focused, analytical responses
      max_tokens: 2000
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error('No response from AI service')
    }

    // Parse the JSON response
    const analysisResult = JSON.parse(content) as AIAnalysisResult
    return analysisResult

  } catch (error) {
    console.error('Error generating AI analysis:', error)
    
    // Return fallback analysis if AI fails
    return generateFallbackAnalysis(data)
  }
}

/**
 * Prepare analysis context for AI processing
 */
function prepareAnalysisContext(data: ACHExportData): string {
  const analysis = data.analysis || []
  const topHypothesis = analysis[0]
  const hypothesisText = data.hypotheses.find(h => h.id === topHypothesis?.hypothesisId)?.text

  let context = `TITLE: ${data.title}\n`
  if (data.description) {
    context += `DESCRIPTION: ${data.description}\n`
  }
  context += `SCALE TYPE: ${data.scaleType} (${data.scaleType === 'logarithmic' ? 'Fibonacci sequence' : 'Linear 1-5'})\n`
  context += `ANALYSIS DATE: ${data.createdAt.toLocaleDateString()}\n\n`

  // Hypotheses
  context += `HYPOTHESES (${data.hypotheses.length} total):\n`
  data.hypotheses.forEach((h, index) => {
    const analysisData = analysis.find(a => a.hypothesisId === h.id)
    context += `H${index + 1}: ${h.text}\n`
    if (analysisData) {
      context += `   - Weighted Score: ${analysisData.weightedScore.toFixed(2)}\n`
      context += `   - Supporting Evidence: ${analysisData.supportingEvidence}\n`
      context += `   - Contradicting Evidence: ${analysisData.contradictingEvidence}\n`
      context += `   - Confidence: ${analysisData.confidenceLevel}\n`
      context += `   - Status: ${analysisData.rejectionThreshold ? 'REJECTED' : 'VIABLE'}\n`
    }
    context += '\n'
  })

  // Evidence with SATS evaluation
  context += `EVIDENCE (${data.evidence.length} total):\n`
  data.evidence.forEach((evidence, index) => {
    context += `E${index + 1}: ${evidence.text}\n`
    if (evidence.confidenceScore) {
      context += `   - SATS Credibility Score: ${evidence.confidenceScore}/13\n`
      const credibilityLevel = evidence.confidenceScore >= 11 ? 'VERY HIGH' :
                             evidence.confidenceScore >= 7 ? 'HIGH' :
                             evidence.confidenceScore >= 4 ? 'MODERATE' :
                             evidence.confidenceScore >= 2 ? 'LOW' : 'VERY LOW'
      context += `   - Credibility Level: ${credibilityLevel}\n`
    }
    
    // Add scoring against hypotheses
    context += '   - Hypothesis Scores:\n'
    data.hypotheses.forEach((h, hIndex) => {
      const score = data.scores.get(evidence.id)?.get(h.id)
      if (score) {
        context += `     H${hIndex + 1}: ${score.score > 0 ? '+' : ''}${score.score}\n`
      }
    })
    context += '\n'
  })

  // Top hypothesis summary
  if (topHypothesis && hypothesisText) {
    context += `PRIMARY CONCLUSION:\n`
    context += `Most Likely Hypothesis: ${hypothesisText}\n`
    context += `Weighted Score: ${topHypothesis.weightedScore.toFixed(2)}\n`
    context += `Confidence Level: ${topHypothesis.confidenceLevel}\n`
    context += `Supporting Evidence Count: ${topHypothesis.supportingEvidence}\n`
    context += `Contradicting Evidence Count: ${topHypothesis.contradictingEvidence}\n`
  }

  return context
}

/**
 * Generate fallback analysis if AI service fails
 */
function generateFallbackAnalysis(data: ACHExportData): AIAnalysisResult {
  const analysis = data.analysis || []
  const topHypothesis = analysis[0]
  const hypothesisText = data.hypotheses.find(h => h.id === topHypothesis?.hypothesisId)?.text || 'Primary hypothesis'

  return {
    executiveSummary: `CDR, ACH analysis of ${data.hypotheses.length} competing hypotheses allows us to dismiss ${analysis.filter(h => h.rejectionThreshold).length} scenarios based on contradictory evidence. ${analysis.filter(h => !h.rejectionThreshold).length} hypotheses remain viable, with "${hypothesisText}" showing strongest support from available evidence. Key focus should be on continued collection to further eliminate remaining possibilities rather than committing to a single explanation.`,
    
    keyFindings: [
      `${analysis.filter(h => h.rejectionThreshold).length} hypotheses dismissed due to contradictory evidence`,
      `${analysis.filter(h => !h.rejectionThreshold).length} hypotheses remain viable based on current evidence`,
      `Evidence evaluation uses SATS-based credibility assessment for systematic analysis`,
      `"${hypothesisText}" shows strongest evidence support among remaining viable options`
    ],
    
    recommendations: [
      'Focus collection efforts on evidence that could further eliminate remaining viable hypotheses',
      'Avoid premature commitment to single explanation until alternatives are ruled out',
      'Monitor indicators that could resurrect dismissed hypotheses or eliminate remaining ones'
    ],
    
    confidenceAssessment: `Overall confidence in the primary hypothesis is ${topHypothesis?.confidenceLevel || 'moderate'} based on the quantity and quality of available evidence. The assessment considers both the consistency of evidence with the hypothesis and the credibility of information sources as evaluated through SATS methodology.`,
    
    alternativeExplanations: analysis.slice(1, 3).map(h => {
      const hypothesis = data.hypotheses.find(hyp => hyp.id === h.hypothesisId)
      return `${hypothesis?.text || 'Alternative hypothesis'} (Score: ${h.weightedScore.toFixed(2)})`
    }).filter(Boolean),
    
    gaps: [
      'Additional corroborating evidence for primary hypothesis',
      'Information to definitively rule out alternative explanations',
      'Enhanced source evaluation for key pieces of evidence'
    ]
  }
}

/**
 * Check if AI service is available
 */
export async function checkAIAvailability(): Promise<boolean> {
  try {
    if (!process.env.NEXT_PUBLIC_OPENAI_API_KEY || process.env.NEXT_PUBLIC_OPENAI_API_KEY === 'demo-key') {
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