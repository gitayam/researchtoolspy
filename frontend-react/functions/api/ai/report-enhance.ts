/**
 * AI Report Enhancement API
 *
 * Enhances framework analysis reports with AI-generated content:
 * - Executive summaries (BLUF format)
 * - Key insights and patterns
 * - Actionable recommendations
 * - Comprehensive analysis
 */

interface Env {
  AI_CONFIG: KVNamespace
  OPENAI_API_KEY?: string
  OPENAI_ORGANIZATION?: string
  ENABLE_AI_FEATURES?: string
}

interface ReportEnhanceRequest {
  frameworkType: string
  data: Record<string, any>
  enhancementType: 'summary' | 'insights' | 'recommendations' | 'full'
  verbosity?: 'executive' | 'standard' | 'comprehensive'
}

interface ReportEnhancement {
  executiveSummary?: string
  keyInsights?: string[]
  recommendations?: string[]
  comprehensiveAnalysis?: string
  warnings?: string[]
}

// Framework-specific prompts for different enhancement types
const FRAMEWORK_PROMPTS = {
  swot: {
    summary: `Analyze this SWOT analysis and create a BLUF (Bottom Line Up Front) executive summary.

SWOT Data:
{data}

Provide a 2-3 sentence executive summary that captures the most critical strategic position. Start with the most important finding first.`,

    insights: `Analyze this SWOT analysis and identify 4-6 key strategic insights.

SWOT Data:
{data}

For each insight:
- Identify cross-quadrant patterns (e.g., S-O, W-T relationships)
- Highlight critical dependencies or vulnerabilities
- Note competitive advantages or disadvantages
- Flag urgent priorities

Return ONLY a JSON array of insight strings: ["Insight 1", "Insight 2", ...]`,

    recommendations: `Based on this SWOT analysis, provide 4-6 actionable strategic recommendations.

SWOT Data:
{data}

For each recommendation:
- Be specific and actionable
- Prioritize by impact and urgency
- Consider feasibility
- Link to specific SWOT elements

Return ONLY a JSON array of recommendation strings: ["Recommendation 1", "Recommendation 2", ...]`
  },

  ach: {
    summary: `Analyze this ACH (Analysis of Competing Hypotheses) results and create an executive summary.

ACH Data:
{data}

Provide a 2-3 sentence executive summary highlighting:
- Most likely hypothesis
- Confidence level
- Critical evidence gaps

Start with the conclusion first (BLUF format).`,

    insights: `Analyze this ACH matrix and identify key analytical insights.

ACH Data:
{data}

Identify insights about:
- Hypothesis consistency with evidence
- Evidence quality concerns
- Diagnostic value of key evidence
- Alternative explanations
- Analyst biases to watch for

Return ONLY a JSON array of insight strings: ["Insight 1", "Insight 2", ...]`,

    recommendations: `Based on this ACH analysis, provide actionable recommendations.

ACH Data:
{data}

Recommend:
- Collection priorities for evidence gaps
- Additional hypotheses to consider
- Evidence quality improvements needed
- Follow-up analysis steps

Return ONLY a JSON array of recommendation strings: ["Recommendation 1", "Recommendation 2", ...]`
  },

  dime: {
    summary: `Analyze this DIME framework assessment and create an executive summary.

DIME Data:
{data}

Provide a 2-3 sentence executive summary of the Diplomatic, Information, Military, and Economic factors. Highlight the most critical domain and cross-domain effects.`,

    insights: `Analyze this DIME assessment for key insights.

DIME Data:
{data}

Identify:
- Cross-domain synergies or conflicts
- Critical dependencies between domains
- Gaps in coverage
- Dominant influencing factors

Return ONLY a JSON array of insight strings.`,

    recommendations: `Provide recommendations based on this DIME analysis.

DIME Data:
{data}

Recommend actions across all four domains:
- Diplomatic initiatives
- Information operations
- Military posturing
- Economic measures

Return ONLY a JSON array of recommendation strings.`
  },

  'pmesii-pt': {
    summary: `Analyze this PMESII-PT assessment and create an executive summary.

PMESII-PT Data:
{data}

Summarize the Political, Military, Economic, Social, Information, Infrastructure, Physical Environment, and Time considerations. Highlight the most critical factors.`,

    insights: `Identify key insights from this PMESII-PT analysis.

PMESII-PT Data:
{data}

Look for:
- System interconnections
- Cascading effects
- Leverage points
- Temporal dynamics

Return ONLY a JSON array of insight strings.`,

    recommendations: `Provide strategic recommendations from this PMESII-PT analysis.

PMESII-PT Data:
{data}

Recommend interventions across relevant domains that consider:
- Second and third-order effects
- Time horizon
- Resource requirements

Return ONLY a JSON array of recommendation strings.`
  },

  deception: {
    summary: `Analyze this deception assessment (SATS methodology) and create an executive summary.

Deception Analysis Data:
{data}

Provide a 2-3 sentence summary of the deception likelihood, risk level, and key indicators from MOM/POP/MOSES/EVE analysis.`,

    insights: `Identify key deception indicators from this SATS analysis.

Analysis Data:
{data}

Highlight:
- Strongest deception indicators
- Anomalies in the pattern
- Inconsistencies in evidence
- Credibility concerns

Return ONLY a JSON array of insight strings.`,

    recommendations: `Recommend verification actions based on this deception assessment.

Analysis Data:
{data}

Suggest:
- Additional collection needs
- Verification methods
- Source testing approaches
- Risk mitigation steps

Return ONLY a JSON array of recommendation strings.`
  }
}

// Generic fallback prompts for frameworks not specifically defined
const GENERIC_PROMPTS = {
  summary: `Analyze this {frameworkType} analysis and create a 2-3 sentence executive summary.

Data:
{data}

Highlight the most critical findings using BLUF (Bottom Line Up Front) format.`,

  insights: `Identify 4-6 key insights from this {frameworkType} analysis.

Data:
{data}

Return ONLY a JSON array of insight strings.`,

  recommendations: `Provide 4-6 actionable recommendations based on this {frameworkType} analysis.

Data:
{data}

Return ONLY a JSON array of recommendation strings.`
}

function getPrompt(frameworkType: string, enhancementType: string, data: any): string {
  const frameworkPrompts = FRAMEWORK_PROMPTS[frameworkType as keyof typeof FRAMEWORK_PROMPTS] || GENERIC_PROMPTS
  const promptTemplate = frameworkPrompts[enhancementType as keyof typeof frameworkPrompts] || GENERIC_PROMPTS[enhancementType as keyof typeof GENERIC_PROMPTS]

  return promptTemplate
    .replace('{frameworkType}', frameworkType.toUpperCase())
    .replace('{data}', JSON.stringify(data, null, 2))
}

/**
 * POST /api/ai/report-enhance
 * Enhance framework reports with AI-generated content
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    if (context.env.ENABLE_AI_FEATURES !== 'true') {
      return Response.json({ error: 'AI features are disabled' }, { status: 403 })
    }

    const apiKey = context.env.OPENAI_API_KEY
    if (!apiKey) {
      return Response.json({ error: 'OpenAI API key not configured' }, { status: 500 })
    }

    const request = await context.request.json() as ReportEnhanceRequest

    if (!request.frameworkType || !request.data) {
      return Response.json({ error: 'Missing frameworkType or data' }, { status: 400 })
    }

    const enhancementType = request.enhancementType || 'full'
    const verbosity = request.verbosity || 'standard'

    // Get model configuration
    const config = await context.env.AI_CONFIG.get('default', { type: 'json' }) as any
    const model = config?.useCases?.summarization || 'gpt-5-mini'

    const enhancement: ReportEnhancement = {}

    // Generate executive summary
    if (enhancementType === 'summary' || enhancementType === 'full') {
      const summaryPrompt = getPrompt(request.frameworkType, 'summary', request.data)

      const summaryResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          ...(context.env.OPENAI_ORGANIZATION && { 'OpenAI-Organization': context.env.OPENAI_ORGANIZATION })
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: 'You are an expert intelligence analyst. Provide clear, concise analysis using IC standards. Always start with the bottom line (BLUF).' },
            { role: 'user', content: summaryPrompt }
          ],
          max_completion_tokens: verbosity === 'executive' ? 500 : verbosity === 'comprehensive' ? 2000 : 1000,
          verbosity: verbosity === 'executive' ? 'low' : verbosity === 'comprehensive' ? 'high' : 'medium'
        })
      })

      if (summaryResponse.ok) {
        const data = await summaryResponse.json()
        enhancement.executiveSummary = data.choices[0].message.content
      }
    }

    // Generate key insights
    if (enhancementType === 'insights' || enhancementType === 'full') {
      const insightsPrompt = getPrompt(request.frameworkType, 'insights', request.data)

      const insightsResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          ...(context.env.OPENAI_ORGANIZATION && { 'OpenAI-Organization': context.env.OPENAI_ORGANIZATION })
        },
        body: JSON.stringify({
          model: 'gpt-5-nano', // Use faster model for structured extraction
          messages: [
            { role: 'system', content: 'You are an analytical pattern recognition expert. Return ONLY valid JSON arrays, no other text.' },
            { role: 'user', content: insightsPrompt }
          ],
          max_completion_tokens: 1500,
          verbosity: 'low',
          reasoning_effort: 'minimal'
        })
      })

      if (insightsResponse.ok) {
        const data = await insightsResponse.json()
        const content = data.choices[0].message.content
        try {
          const jsonText = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
          enhancement.keyInsights = JSON.parse(jsonText)
        } catch {
          enhancement.keyInsights = content.split('\n').filter((line: string) => line.trim())
        }
      }
    }

    // Generate recommendations
    if (enhancementType === 'recommendations' || enhancementType === 'full') {
      const recommendationsPrompt = getPrompt(request.frameworkType, 'recommendations', request.data)

      const recommendationsResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          ...(context.env.OPENAI_ORGANIZATION && { 'OpenAI-Organization': context.env.OPENAI_ORGANIZATION })
        },
        body: JSON.stringify({
          model: 'gpt-5-nano',
          messages: [
            { role: 'system', content: 'You are a strategic advisor. Provide specific, actionable recommendations. Return ONLY valid JSON arrays.' },
            { role: 'user', content: recommendationsPrompt }
          ],
          max_completion_tokens: 1500,
          verbosity: 'low',
          reasoning_effort: 'minimal'
        })
      })

      if (recommendationsResponse.ok) {
        const data = await recommendationsResponse.json()
        const content = data.choices[0].message.content
        try {
          const jsonText = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
          enhancement.recommendations = JSON.parse(jsonText)
        } catch {
          enhancement.recommendations = content.split('\n').filter((line: string) => line.trim())
        }
      }
    }

    return Response.json(enhancement)

  } catch (error) {
    console.error('Report enhancement error:', error)
    return Response.json({
      error: 'Report enhancement failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
