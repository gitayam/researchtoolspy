/**
 * AI COG Analysis API
 *
 * Provides AI-powered assistance for Center of Gravity analysis
 * POST: Generate COG components (identification, capabilities, requirements, vulnerabilities, impact)
 */

import { callOpenAIViaGateway, getOptimalCacheTTL } from '../_shared/ai-gateway'

interface Env {
  AI_CONFIG: KVNamespace
  OPENAI_API_KEY?: string
  OPENAI_ORGANIZATION?: string
  AI_GATEWAY_ACCOUNT_ID?: string
}

type AnalysisMode =
  | 'validate-cog'
  | 'generate-capabilities'
  | 'generate-requirements'
  | 'generate-vulnerabilities'
  | 'generate-impact'
  | 'suggest-cog'

interface COGAnalysisRequest {
  mode: AnalysisMode
  context?: {
    objective?: string
    impactGoal?: string
    friendlyForces?: string
    operatingEnvironment?: string
    constraints?: string
    timeframe?: string
    strategicLevel?: string
  }
  cog?: {
    description: string
    actor: string
    domain: string
    rationale?: string
  }
  capabilities?: Array<{
    capability: string
    description?: string
  }>
  requirements?: Array<{
    requirement: string
    type?: string
    capabilityId?: string
  }>
  requirement?: {
    requirement: string
    type?: string
  }
  capability?: {
    capability: string
    description?: string
  }
}

const MODEL_PRICING = {
  'gpt-5': {
    input: 1.25,
    output: 10.0
  },
  'gpt-4o-mini': {
    input: 0.25,
    output: 2.0
  },
  'gpt-5-nano': {
    input: 0.05,
    output: 0.40
  }
}

function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = MODEL_PRICING[model as keyof typeof MODEL_PRICING] || MODEL_PRICING['gpt-4o-mini']
  const inputCost = (inputTokens / 1_000_000) * pricing.input
  const outputCost = (outputTokens / 1_000_000) * pricing.output
  return inputCost + outputCost
}

/**
 * Build prompts for different COG analysis modes
 */
function buildPrompt(request: COGAnalysisRequest): string {
  const { mode, context, cog, capabilities, requirements, requirement, capability } = request

  const contextSection = context ? `
## Operational Context
- Objective: ${context.objective || 'Not specified'}
- Impact Goal: ${context.impactGoal || 'Not specified'}
- Friendly Forces: ${context.friendlyForces || 'Not specified'}
- Operating Environment: ${context.operatingEnvironment || 'Not specified'}
- Constraints: ${context.constraints || 'Not specified'}
- Timeframe: ${context.timeframe || 'Not specified'}
- Strategic Level: ${context.strategicLevel || 'Not specified'}
` : ''

  switch (mode) {
    case 'suggest-cog':
      return `You are a military intelligence analyst expert in Center of Gravity (COG) analysis following JP 3-0 and JP 5-0 doctrine.

${contextSection}

Based on the operational context above, suggest 2-3 potential Centers of Gravity for analysis. For each, provide:
1. A clear, concise COG description (what it is)
2. Actor category (Friendly/Adversary/Host Nation/Third Party)
3. Primary DIMEFIL domain (Diplomatic/Information/Military/Economic/Financial/Intelligence/Law Enforcement/Cyber/Space)
4. Brief rationale (why this is a COG)

Format your response as JSON (return an array directly):
[
  {
    "description": "COG description here",
    "actor": "Adversary",
    "domain": "Military",
    "rationale": "Brief explanation of why this meets COG criteria"
  },
  ...
]

Ensure each suggested COG:
- Is a true source of power (not just important)
- Would critically degrade objectives if neutralized
- Is at the appropriate level of analysis
- Can be protected/exploited through vulnerabilities`

    case 'validate-cog':
      if (!cog) {
        throw new Error('COG data required for validation')
      }

      return `You are a military intelligence analyst expert in Center of Gravity (COG) analysis following JP 3-0 and JP 5-0 doctrine.

${contextSection}

## Proposed Center of Gravity
- Description: ${cog.description}
- Actor: ${cog.actor}
- Domain: ${cog.domain}
- Rationale: ${cog.rationale || 'Not provided'}

Validate this proposed COG against the four criteria:
1. **Critical Degradation**: If neutralized/protected, would this critically degrade the actor's ability to achieve objectives?
2. **Source of Power**: Is this truly a source of power, not just an important capability or effect?
3. **Appropriate Level**: Is this at the right level of analysis (not too broad, not too narrow)?
4. **Exploitable**: Can this be protected/exploited through its critical vulnerabilities?

Provide your assessment in JSON format:
{
  "isValid": true/false,
  "overallAssessment": "Brief overall assessment",
  "criteria": {
    "criticalDegradation": {
      "passes": true/false,
      "explanation": "Brief explanation"
    },
    "sourceOfPower": {
      "passes": true/false,
      "explanation": "Brief explanation"
    },
    "appropriateLevel": {
      "passes": true/false,
      "explanation": "Brief explanation"
    },
    "exploitable": {
      "passes": true/false,
      "explanation": "Brief explanation"
    }
  },
  "recommendations": ["Specific recommendation 1", "Specific recommendation 2"]
}`

    case 'generate-capabilities':
      if (!cog) {
        throw new Error('COG data required for capability generation')
      }

      return `You are a military intelligence analyst expert in Center of Gravity (COG) analysis following JP 3-0 and JP 5-0 doctrine.

${contextSection}

## Center of Gravity
- Description: ${cog.description}
- Actor: ${cog.actor}
- Domain: ${cog.domain}

Generate 3-5 Critical Capabilities for this COG. Critical Capabilities answer: "What can this COG DO?"

Requirements:
- Use VERB-focused language (e.g., "Conduct", "Sustain", "Maintain", "Coordinate")
- Each capability should be a primary action or function
- Capabilities should support the actor's objectives
- Be specific to this COG and domain
- Consider DIMEFIL aspects relevant to the domain

Format your response as JSON (return an array directly):
[
  {
    "capability": "Verb-focused capability statement",
    "description": "How this capability works and supports objectives"
  },
  ...
]

Example capabilities:
- Military: "Conduct integrated air defense operations", "Project power beyond territorial borders"
- Information: "Control narrative across multiple media platforms", "Conduct coordinated disinformation campaigns"
- Economic: "Manipulate currency exchange rates", "Control critical supply chains"
- Cyber: "Disrupt critical infrastructure networks", "Maintain persistent network access"`

    case 'generate-requirements':
      if (!capability) {
        throw new Error('Capability data required for requirements generation')
      }

      return `You are a military intelligence analyst expert in Center of Gravity (COG) analysis following JP 3-0 and JP 5-0 doctrine.

${contextSection}

${cog ? `## Center of Gravity
- Description: ${cog.description}
- Actor: ${cog.actor}
- Domain: ${cog.domain}

` : ''}## Critical Capability
- Capability: ${capability.capability}
- Description: ${capability.description || 'Not provided'}

Generate 2-4 Critical Requirements for this capability. Critical Requirements answer: "What does this capability NEED?"

Requirements:
- Use NOUN-focused language (specific resources, conditions, or means)
- Each requirement should be essential for the capability to function
- Identify single points of failure where possible
- Classify by type: Personnel, Equipment, Logistics, Information, Infrastructure, Other
- Be specific and targetable

Format your response as JSON (return an array directly):
[
  {
    "requirement": "Specific noun-focused requirement",
    "type": "Personnel|Equipment|Logistics|Information|Infrastructure|Other",
    "description": "Why this is critical for the capability"
  },
  ...
]

Example requirements:
- Personnel: "Trained radar operators with air battle management experience"
- Equipment: "Long-range surveillance radar network with 360-degree coverage"
- Logistics: "Continuous electrical power supply from protected grid"
- Information: "Real-time intelligence feed from satellite reconnaissance"
- Infrastructure: "Underground command and control facility with redundant communications"`

    case 'generate-vulnerabilities':
      if (!requirement) {
        throw new Error('Requirement data required for vulnerability generation')
      }

      return `You are a military intelligence analyst expert in Center of Gravity (COG) analysis following JP 3-0 and JP 5-0 doctrine.

${contextSection}

${cog ? `## Center of Gravity
- Description: ${cog.description}
- Actor: ${cog.actor}
- Domain: ${cog.domain}

` : ''}${capability ? `## Critical Capability
- Capability: ${capability.capability}

` : ''}## Critical Requirement
- Requirement: ${requirement.requirement}
- Type: ${requirement.type || 'Not specified'}

Generate 2-3 Critical Vulnerabilities for this requirement. Critical Vulnerabilities answer: "What is the WEAKNESS?"

Requirements:
- Identify specific exploitable weaknesses in this requirement
- Vulnerabilities should be actionable and targetable
- Consider multiple exploitation methods (Physical, Cyber, Human, Logistical, Informational)
- Provide realistic assessment of exploitability
- Include both direct and indirect approaches

Format your response as JSON (return an array directly):
[
  {
    "vulnerability": "Specific exploitable weakness",
    "type": "Physical|Cyber|Human|Logistical|Informational|Other",
    "description": "Detailed description of the weakness",
    "expectedEffect": "What happens if this vulnerability is exploited",
    "recommendedActions": ["Action 1", "Action 2", "Action 3"],
    "confidence": "low|medium|high",
    "scoring": {
      "impact_on_cog": 1-5,
      "attainability": 1-5,
      "follow_up_potential": 1-5
    }
  },
  ...
]

Scoring guidance:
- Impact (1-5): 5 = Catastrophic effect on COG, 1 = Minimal effect
- Attainability (1-5): 5 = Easy to exploit, 1 = Nearly impossible
- Follow-up (1-5): 5 = Enables many follow-on actions, 1 = Isolated effect`

    case 'generate-impact':
      if (!request.requirement || !capabilities || capabilities.length === 0) {
        throw new Error('Requirements and capabilities data required for impact generation')
      }

      const vulnerabilitiesSection = requirements && requirements.length > 0
        ? `\n## Current Requirements\n${requirements.map(r => `- ${r.requirement}`).join('\n')}`
        : ''

      return `You are a military intelligence analyst expert in Center of Gravity (COG) analysis following JP 3-0 and JP 5-0 doctrine.

${contextSection}

${cog ? `## Center of Gravity
- Description: ${cog.description}
- Actor: ${cog.actor}
- Domain: ${cog.domain}

` : ''}## Critical Capabilities
${capabilities.map(c => `- ${c.capability}`).join('\n')}
${vulnerabilitiesSection}

## Vulnerability Being Analyzed
- Vulnerability: ${request.requirement.requirement}

Generate a comprehensive impact analysis for exploiting this vulnerability. Focus on "SO WHAT?" - why does this matter?

Format your response as JSON:
{
  "expectedEffect": "Detailed description of what happens when this vulnerability is exploited",
  "cascadingEffects": ["Effect on requirement", "Effect on capability", "Effect on COG", "Effect on actor's objectives"],
  "recommendedActions": ["Specific action 1", "Specific action 2", "Specific action 3"],
  "confidence": "low|medium|high",
  "confidenceRationale": "Why this confidence level",
  "timeToEffect": "immediate|hours|days|weeks|months",
  "reversibility": "irreversible|difficult|moderate|easy",
  "riskToFriendlyForces": "low|medium|high",
  "considerations": ["Legal/policy consideration", "Operational consideration", "Strategic consideration"]
}`

    default:
      throw new Error(`Unknown mode: ${mode}`)
  }
}

/**
 * POST /api/ai/cog-analysis
 * Generate COG analysis components
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    // Check API key availability (same as content-intelligence)
    if (!context.env.OPENAI_API_KEY) {
      console.error('[COG AI] OpenAI API key not available')
      return Response.json({
        error: 'OpenAI API key not configured'
      }, { status: 500 })
    }

    const request = await context.request.json() as COGAnalysisRequest

    if (!request.mode) {
      return Response.json({
        error: 'Missing mode parameter'
      }, { status: 400 })
    }

    // Build prompt based on mode
    let prompt: string
    try {
      prompt = buildPrompt(request)
    } catch (error) {
      return Response.json({
        error: 'Invalid request',
        message: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 400 })
    }

    // Use gpt-4o-mini for COG analysis (cost optimization while maintaining quality)
    const model = 'gpt-4o-mini'

    // Build OpenAI request
    const openaiRequest = {
      model,
      messages: [
        {
          role: 'system',
          content: `You are an expert military intelligence analyst specializing in Center of Gravity (COG) analysis following JP 3-0 and JP 5-0 doctrine.

Your analysis must be:
- Evidence-based and analytically rigorous
- Consistent with joint doctrine and COG methodology
- Clear, concise, and actionable
- Focused on identifying true sources of power and critical vulnerabilities
- Formatted exactly as requested (JSON when specified)

Always provide specific, targetable recommendations that support operational planning.`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_completion_tokens: 800, // Optimized for structured responses
      response_format: { type: 'json_object' } // Ensure JSON responses for structured modes
    }

    // Call OpenAI via AI Gateway (same approach as content-intelligence)
    console.log('[COG AI] Calling OpenAI via gateway for mode:', request.mode)

    let data
    try {
      data = await callOpenAIViaGateway(
        context.env,
        openaiRequest,
        {
          cacheTTL: getOptimalCacheTTL('cog-analysis'),
          metadata: {
            endpoint: 'cog-analysis',
            mode: request.mode
          },
          timeout: 30000 // 30s timeout for COG analysis
        }
      )
    } catch (error) {
      console.error('[COG AI] OpenAI API error:', error)
      return Response.json({
        error: 'AI generation failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 })
    }

    // Extract response
    const content = data.choices[0].message.content
    const tokensUsed = {
      input: data.usage.prompt_tokens,
      output: data.usage.completion_tokens,
      total: data.usage.total_tokens
    }

    // Calculate cost
    const cost = estimateCost(model, tokensUsed.input, tokensUsed.output)

    // Parse JSON response
    let result
    try {
      result = JSON.parse(content)
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', content)
      return Response.json({
        error: 'Invalid AI response format',
        message: 'AI returned non-JSON response',
        rawContent: content
      }, { status: 500 })
    }

    // Normalize response format - GPT sometimes wraps arrays in objects
    // Extract the actual data from wrapper objects
    if (result && typeof result === 'object') {
      // Check if it's wrapped in a common key name
      const wrapperKeys = [
        'COGs',
        'capabilities',
        'requirements',
        'vulnerabilities',
        'potential_centers_of_gravity',
        'critical_capabilities',
        'critical_requirements',
        'critical_vulnerabilities'
      ]
      for (const key of wrapperKeys) {
        if (Array.isArray(result[key])) {
          console.log(`[COG AI] Unwrapping array from "${key}" key`)
          result = result[key]
          break
        }
      }
    }

    // Update usage statistics (async, don't wait)
    context.waitUntil(updateUsageStats(context.env.AI_CONFIG, tokensUsed.total, cost))

    return Response.json({
      mode: request.mode,
      result,
      model,
      tokensUsed,
      estimatedCost: cost,
      finishReason: data.choices[0].finish_reason
    })
  } catch (error) {
    console.error('COG Analysis error:', error)

    // Handle timeout and other errors
    if (error instanceof Error && error.name === 'AbortError') {
      return Response.json({
        error: 'Request timeout',
        message: 'AI analysis took too long (>30s). Please try again.'
      }, { status: 504 })
    }

    return Response.json({
      error: 'Analysis failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

/**
 * Update usage statistics in KV
 */
async function updateUsageStats(kv: KVNamespace, tokens: number, cost: number) {
  try {
    const config = await kv.get('default', { type: 'json' }) as any
    if (!config) return

    if (!config.costs) {
      config.costs = {
        totalTokensUsed: 0,
        estimatedCost: 0,
        lastReset: new Date().toISOString()
      }
    }

    // Reset daily counters if needed
    const lastReset = new Date(config.costs.lastReset)
    const now = new Date()
    const daysSinceReset = (now.getTime() - lastReset.getTime()) / (1000 * 60 * 60 * 24)

    if (daysSinceReset >= 1) {
      config.costs.totalTokensUsed = 0
      config.costs.estimatedCost = 0
      config.costs.lastReset = now.toISOString()
    }

    // Update counters
    config.costs.totalTokensUsed += tokens
    config.costs.estimatedCost += cost

    await kv.put('default', JSON.stringify(config))
  } catch (error) {
    console.error('Failed to update usage stats:', error)
  }
}
