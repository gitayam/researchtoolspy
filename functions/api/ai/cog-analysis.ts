/**
 * AI COG Analysis API
 *
 * Provides AI-powered assistance for Center of Gravity analysis
 * POST: Generate COG components (identification, capabilities, requirements, vulnerabilities, impact)
 *
 * Modes:
 *   suggest-cog             → 2-3 COG suggestions from operational context
 *   validate-cog            → Validate a proposed COG against JP 3-0 doctrine
 *   generate-capabilities   → 3-5 critical capabilities for a COG
 *   generate-requirements   → 2-4 critical requirements for a capability
 *   generate-vulnerabilities → 2-3 critical vulnerabilities for a requirement
 *   generate-impact         → Impact analysis for a vulnerability
 */

import { callOpenAIViaGateway, getOptimalCacheTTL } from '../_shared/ai-gateway'
import { requireAuth } from '../_shared/auth-helpers'
import { JSON_HEADERS, optionsResponse } from '../_shared/api-utils'

interface Env {
  DB: D1Database
  AI_CONFIG: KVNamespace
  OPENAI_API_KEY?: string
  OPENAI_ORGANIZATION?: string
  AI_GATEWAY_ACCOUNT_ID?: string
  SESSIONS?: KVNamespace
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

// Token limits per mode — vulnerabilities need more tokens for scoring objects
const MODE_TOKEN_LIMITS: Record<AnalysisMode, number> = {
  'suggest-cog': 1000,
  'validate-cog': 800,
  'generate-capabilities': 1000,
  'generate-requirements': 800,
  'generate-vulnerabilities': 1500,
  'generate-impact': 1200,
}

const MODEL_PRICING = {
  'gpt-5.4': { input: 2.50, output: 15.0 },
  'gpt-5.4-mini': { input: 0.75, output: 4.50 },
  'gpt-5.4-nano': { input: 0.20, output: 1.25 },
}

function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = MODEL_PRICING[model as keyof typeof MODEL_PRICING] || MODEL_PRICING['gpt-5.4-mini']
  return (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output
}

// --- Response validators (field-by-field, never trust raw AI JSON) ---

const str = (v: any, fb = '') => typeof v === 'string' ? v : fb
const bool = (v: any, fb = false) => typeof v === 'boolean' ? v : fb
const arr = (v: any) => Array.isArray(v) ? v.filter((s: any) => typeof s === 'string') : []
const num = (v: any, min: number, max: number, fb: number) => {
  const n = typeof v === 'number' ? v : fb
  return Math.max(min, Math.min(max, n))
}

function validateSuggestedCOGs(raw: any): any[] {
  const items = Array.isArray(raw) ? raw : (raw?.suggestions || raw?.COGs || raw?.cogs || raw?.potential_centers_of_gravity || [])
  return items.map((item: any) => ({
    description: str(item?.description),
    actor: str(item?.actor, 'Adversary'),
    domain: str(item?.domain, 'Military'),
    rationale: str(item?.rationale),
  })).filter((c: any) => c.description)
}

function validateCOGValidation(raw: any): any {
  const criterion = (c: any) => ({
    passes: bool(c?.passes),
    explanation: str(c?.explanation),
  })
  return {
    isValid: bool(raw?.isValid),
    overallAssessment: str(raw?.overallAssessment),
    criteria: {
      criticalDegradation: criterion(raw?.criteria?.criticalDegradation),
      sourceOfPower: criterion(raw?.criteria?.sourceOfPower),
      appropriateLevel: criterion(raw?.criteria?.appropriateLevel),
      exploitable: criterion(raw?.criteria?.exploitable),
    },
    recommendations: arr(raw?.recommendations),
  }
}

function validateCapabilities(raw: any): any[] {
  const items = Array.isArray(raw) ? raw : (raw?.capabilities || raw?.critical_capabilities || [])
  return items.map((item: any) => ({
    capability: str(item?.capability),
    description: str(item?.description),
  })).filter((c: any) => c.capability)
}

function validateRequirements(raw: any): any[] {
  const items = Array.isArray(raw) ? raw : (raw?.requirements || raw?.critical_requirements || [])
  return items.map((item: any) => ({
    requirement: str(item?.requirement),
    type: str(item?.type, 'other'),
    description: str(item?.description),
  })).filter((r: any) => r.requirement)
}

function validateVulnerabilities(raw: any): any[] {
  const items = Array.isArray(raw) ? raw : (raw?.vulnerabilities || raw?.critical_vulnerabilities || [])
  return items.map((item: any) => ({
    vulnerability: str(item?.vulnerability),
    type: str(item?.type, 'other'),
    description: str(item?.description),
    expectedEffect: str(item?.expectedEffect),
    recommendedActions: arr(item?.recommendedActions),
    confidence: ['low', 'medium', 'high'].includes(item?.confidence) ? item.confidence : 'medium',
    scoring: {
      impact_on_cog: num(item?.scoring?.impact_on_cog, 1, 5, 3),
      attainability: num(item?.scoring?.attainability, 1, 5, 3),
      follow_up_potential: num(item?.scoring?.follow_up_potential, 1, 5, 3),
    },
  })).filter((v: any) => v.vulnerability)
}

function validateImpact(raw: any): any {
  return {
    expectedEffect: str(raw?.expectedEffect),
    cascadingEffects: arr(raw?.cascadingEffects),
    recommendedActions: arr(raw?.recommendedActions),
    confidence: ['low', 'medium', 'high'].includes(raw?.confidence) ? raw.confidence : 'medium',
    confidenceRationale: str(raw?.confidenceRationale),
    timeToEffect: str(raw?.timeToEffect, 'days'),
    reversibility: str(raw?.reversibility, 'moderate'),
    riskToFriendlyForces: ['low', 'medium', 'high'].includes(raw?.riskToFriendlyForces) ? raw.riskToFriendlyForces : 'medium',
    considerations: arr(raw?.considerations),
  }
}

// Validate result based on mode
function validateResult(mode: AnalysisMode, raw: any): any {
  switch (mode) {
    case 'suggest-cog': return validateSuggestedCOGs(raw)
    case 'validate-cog': return validateCOGValidation(raw)
    case 'generate-capabilities': return validateCapabilities(raw)
    case 'generate-requirements': return validateRequirements(raw)
    case 'generate-vulnerabilities': return validateVulnerabilities(raw)
    case 'generate-impact': return validateImpact(raw)
    default: return raw
  }
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

Return JSON with a "suggestions" array:
{
  "suggestions": [
    {
      "description": "COG description here",
      "actor": "Adversary",
      "domain": "Military",
      "rationale": "Brief explanation of why this meets COG criteria"
    }
  ]
}

Ensure each suggested COG:
- Is a true source of power (not just important)
- Would critically degrade objectives if neutralized
- Is at the appropriate level of analysis
- Can be protected/exploited through vulnerabilities`

    case 'validate-cog':
      if (!cog) throw new Error('COG data required for validation')

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
  "isValid": true,
  "overallAssessment": "Brief overall assessment",
  "criteria": {
    "criticalDegradation": { "passes": true, "explanation": "Brief explanation" },
    "sourceOfPower": { "passes": true, "explanation": "Brief explanation" },
    "appropriateLevel": { "passes": true, "explanation": "Brief explanation" },
    "exploitable": { "passes": true, "explanation": "Brief explanation" }
  },
  "recommendations": ["Specific recommendation 1", "Specific recommendation 2"]
}`

    case 'generate-capabilities':
      if (!cog) throw new Error('COG data required for capability generation')

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

Return JSON with a "capabilities" array:
{
  "capabilities": [
    {
      "capability": "Verb-focused capability statement",
      "description": "How this capability works and supports objectives"
    }
  ]
}`

    case 'generate-requirements':
      if (!capability) throw new Error('Capability data required for requirements generation')

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

Return JSON with a "requirements" array:
{
  "requirements": [
    {
      "requirement": "Specific noun-focused requirement",
      "type": "Personnel|Equipment|Logistics|Information|Infrastructure|Other",
      "description": "Why this is critical for the capability"
    }
  ]
}`

    case 'generate-vulnerabilities':
      if (!requirement) throw new Error('Requirement data required for vulnerability generation')

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

Return JSON with a "vulnerabilities" array:
{
  "vulnerabilities": [
    {
      "vulnerability": "Specific exploitable weakness",
      "type": "Physical|Cyber|Human|Logistical|Informational|Other",
      "description": "Detailed description of the weakness",
      "expectedEffect": "What happens if this vulnerability is exploited",
      "recommendedActions": ["Action 1", "Action 2", "Action 3"],
      "confidence": "low|medium|high",
      "scoring": {
        "impact_on_cog": 3,
        "attainability": 3,
        "follow_up_potential": 3
      }
    }
  ]
}

Scoring guidance (1-5 scale):
- Impact: 5=Catastrophic effect on COG, 1=Minimal effect
- Attainability: 5=Easy to exploit, 1=Nearly impossible
- Follow-up: 5=Enables many follow-on actions, 1=Isolated effect`

    case 'generate-impact':
      if (!request.requirement || !capabilities || capabilities.length === 0) {
        throw new Error('Requirements and capabilities data required for impact generation')
      }

      const reqSection = requirements?.length
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
${reqSection}

## Vulnerability Being Analyzed
- Vulnerability: ${request.requirement.requirement}

Generate a comprehensive impact analysis. Focus on "SO WHAT?" - why does this matter?

Return JSON:
{
  "expectedEffect": "What happens when this vulnerability is exploited",
  "cascadingEffects": ["Effect on requirement", "Effect on capability", "Effect on COG", "Effect on objectives"],
  "recommendedActions": ["Specific action 1", "Specific action 2", "Specific action 3"],
  "confidence": "low|medium|high",
  "confidenceRationale": "Why this confidence level",
  "timeToEffect": "immediate|hours|days|weeks|months",
  "reversibility": "irreversible|difficult|moderate|easy",
  "riskToFriendlyForces": "low|medium|high",
  "considerations": ["Legal/policy consideration", "Operational consideration"]
}`

    default:
      throw new Error(`Unknown mode: ${mode}`)
  }
}

/**
 * POST /api/ai/cog-analysis
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const userId = await requireAuth(context.request, context.env)

    if (!context.env.OPENAI_API_KEY) {
      console.error('[COG AI] OpenAI API key not available')
      return Response.json({ error: 'AI service not configured' }, { status: 500 })
    }

    const request = await context.request.json() as COGAnalysisRequest

    if (!request.mode) {
      return Response.json({ error: 'Missing mode parameter' }, { status: 400 })
    }

    // Validate mode
    const validModes: AnalysisMode[] = ['suggest-cog', 'validate-cog', 'generate-capabilities', 'generate-requirements', 'generate-vulnerabilities', 'generate-impact']
    if (!validModes.includes(request.mode)) {
      return Response.json({ error: `Invalid mode: ${request.mode}` }, { status: 400 })
    }

    // Build prompt
    let prompt: string
    try {
      prompt = buildPrompt(request)
    } catch (error: any) {
      return Response.json({ error: error.message || 'Invalid request' }, { status: 400 })
    }

    const model = 'gpt-5.4-mini'
    const maxTokens = MODE_TOKEN_LIMITS[request.mode]

    let data
    try {
      data = await callOpenAIViaGateway(
        context.env,
        {
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
- Formatted exactly as requested (valid JSON only)`
            },
            { role: 'user', content: prompt }
          ],
          max_completion_tokens: maxTokens,
          response_format: { type: 'json_object' }
        },
        {
          cacheTTL: getOptimalCacheTTL('cog-analysis'),
          metadata: { endpoint: 'cog-analysis', mode: request.mode, userId },
          timeout: 30000
        }
      )
    } catch (error) {
      console.error('[COG AI] OpenAI API error:', error)
      return Response.json({ error: 'AI generation failed' }, { status: 500 })
    }

    // Extract content
    const content = data?.choices?.[0]?.message?.content
    if (!content) {
      return Response.json({ error: 'Empty AI response' }, { status: 500 })
    }

    const tokensUsed = {
      input: data.usage?.prompt_tokens || 0,
      output: data.usage?.completion_tokens || 0,
      total: data.usage?.total_tokens || 0,
    }

    // Parse JSON
    let rawContent = content.trim()
    if (rawContent.startsWith('```')) {
      rawContent = rawContent.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '')
    }

    let parsed: any
    try {
      parsed = JSON.parse(rawContent)
    } catch (parseError) {
      console.error('[COG AI] Failed to parse AI response:', rawContent.slice(0, 200))
      return Response.json({ error: 'AI returned invalid response format' }, { status: 500 })
    }

    // Validate result per mode (field-by-field, never trust raw LLM output)
    const result = validateResult(request.mode, parsed)

    // Cost tracking
    const cost = estimateCost(model, tokensUsed.input, tokensUsed.output)

    // Update usage stats async
    if (context.env.AI_CONFIG) {
      context.waitUntil(updateUsageStats(context.env.AI_CONFIG, tokensUsed.total, cost))
    }

    return Response.json({
      mode: request.mode,
      result,
      model,
      tokensUsed,
      estimatedCost: cost,
      finishReason: data.choices[0].finish_reason
    })
  } catch (error) {
    if (error instanceof Response) return error
    console.error('[COG AI] Error:', error)

    if (error instanceof Error && error.name === 'AbortError') {
      return Response.json({ error: 'Request timeout. Please try again.' }, { status: 504 })
    }

    return Response.json({ error: 'Analysis failed' }, { status: 500 })
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
      config.costs = { totalTokensUsed: 0, estimatedCost: 0, lastReset: new Date().toISOString() }
    }

    const daysSinceReset = (Date.now() - new Date(config.costs.lastReset).getTime()) / (1000 * 60 * 60 * 24)
    if (daysSinceReset >= 1) {
      config.costs.totalTokensUsed = 0
      config.costs.estimatedCost = 0
      config.costs.lastReset = new Date().toISOString()
    }

    config.costs.totalTokensUsed += tokens
    config.costs.estimatedCost += cost
    await kv.put('default', JSON.stringify(config))
  } catch (error) {
    console.error('[COG AI] Failed to update usage stats:', error)
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
