/**
 * AI Behavior Analysis API
 * POST /api/ai/behavior-analysis
 *
 * AI-powered COM-B diagnosis and intervention recommendation.
 * Supports two contexts:
 *   - "intelligence": Adversary/actor behavior analysis (why does this actor behave this way?)
 *   - "product": Stakeholder/user behavior analysis (why does the user behave this way?)
 *
 * Modes:
 *   diagnose-comb        → Analyze a behavior description and score 6 COM-B dimensions
 *   suggest-interventions → Given COM-B scores, suggest domain-appropriate interventions
 *   analyze-motivation   → Deep dive on motivation factors (reflective vs automatic)
 *   full-analysis        → Combined: diagnose + interventions in one call
 */

import { requireAuth } from '../_shared/auth-helpers'
import { callOpenAIViaGateway } from '../_shared/ai-gateway'
import { JSON_HEADERS, optionsResponse } from '../_shared/api-utils'

interface Env {
  DB: D1Database
  OPENAI_API_KEY: string
  AI_GATEWAY_ACCOUNT_ID?: string
  SESSIONS?: KVNamespace
}

type AnalysisMode = 'diagnose-comb' | 'suggest-interventions' | 'analyze-motivation' | 'full-analysis'
type AnalysisContext = 'intelligence' | 'product'

interface BehaviorAnalysisRequest {
  mode: AnalysisMode
  context: AnalysisContext

  // The behavior being analyzed
  behavior: {
    description: string
    actor?: string          // Who performs this behavior
    setting?: string        // Where/when it occurs
    frequency?: string      // How often
    consequences?: string   // Known outcomes
  }

  // For suggest-interventions mode: existing COM-B scores
  combAssessment?: {
    physical_capability: { deficit_level: string; evidence_notes: string }
    psychological_capability: { deficit_level: string; evidence_notes: string }
    physical_opportunity: { deficit_level: string; evidence_notes: string }
    social_opportunity: { deficit_level: string; evidence_notes: string }
    reflective_motivation: { deficit_level: string; evidence_notes: string }
    automatic_motivation: { deficit_level: string; evidence_notes: string }
  }

  // Optional additional context
  additionalContext?: string
}

// --- Vocabulary mapping per context ---

const CONTEXT_VOCAB = {
  intelligence: {
    subject: 'actor/adversary',
    subjectAction: 'exhibits this behavior',
    capPhysical: 'Physical resources, tools, weapons, infrastructure available to the actor',
    capPsychological: 'Knowledge, training, expertise, cognitive skills the actor possesses',
    oppPhysical: 'Environmental conditions, access, timing windows, operational environment',
    oppSocial: 'Social networks, organizational support, cultural norms, peer influence',
    motReflective: 'Strategic intent, calculated goals, ideology, planned objectives',
    motAutomatic: 'Habitual patterns, emotional drivers, ingrained responses, conditioning',
    interventionFrame: 'collection requirements, influence approaches, or countermeasures',
    outputLabel: 'Intelligence Assessment',
  },
  product: {
    subject: 'user/stakeholder',
    subjectAction: 'performs or avoids this behavior',
    capPhysical: 'Physical ability, device access, connectivity, motor skills',
    capPsychological: 'Knowledge of the product, digital literacy, mental models, attention',
    oppPhysical: 'UI accessibility, feature discoverability, time availability, environment',
    oppSocial: 'Peer adoption, social proof, organizational culture, team norms',
    motReflective: 'Perceived value, cost-benefit analysis, goals, identity alignment',
    motAutomatic: 'Habits, emotional response to UI, past experience, default behaviors',
    interventionFrame: 'product interventions (onboarding, UI changes, incentives, nudges)',
    outputLabel: 'Behavior Diagnosis',
  },
}

// --- Validators ---

const str = (v: any, fb = '') => typeof v === 'string' ? v : fb
const arr = (v: any) => Array.isArray(v) ? v.filter((s: any) => typeof s === 'string') : []
const deficitLevel = (v: any) => ['adequate', 'deficit', 'major_barrier'].includes(v) ? v : 'deficit'
const confidence = (v: any) => ['low', 'medium', 'high'].includes(v) ? v : 'medium'

function validateCombDiagnosis(raw: any): any {
  const validateDimension = (d: any) => ({
    deficit_level: deficitLevel(d?.deficit_level),
    evidence_notes: str(d?.evidence_notes),
    confidence: confidence(d?.confidence),
    indicators: arr(d?.indicators),
  })

  return {
    physical_capability: validateDimension(raw?.physical_capability),
    psychological_capability: validateDimension(raw?.psychological_capability),
    physical_opportunity: validateDimension(raw?.physical_opportunity),
    social_opportunity: validateDimension(raw?.social_opportunity),
    reflective_motivation: validateDimension(raw?.reflective_motivation),
    automatic_motivation: validateDimension(raw?.automatic_motivation),
    summary: str(raw?.summary),
    key_findings: arr(raw?.key_findings),
  }
}

function validateInterventions(raw: any): any {
  const items = Array.isArray(raw?.interventions) ? raw.interventions : (Array.isArray(raw) ? raw : [])
  return items.map((item: any) => ({
    intervention: str(item?.intervention),
    target_component: str(item?.target_component),
    priority: ['high', 'medium', 'low'].includes(item?.priority) ? item.priority : 'medium',
    description: str(item?.description),
    rationale: str(item?.rationale),
    implementation_steps: arr(item?.implementation_steps),
    expected_impact: str(item?.expected_impact),
  })).filter((i: any) => i.intervention)
}

function validateMotivation(raw: any): any {
  return {
    reflective_analysis: {
      goals: arr(raw?.reflective_analysis?.goals),
      beliefs: arr(raw?.reflective_analysis?.beliefs),
      identity_factors: arr(raw?.reflective_analysis?.identity_factors),
      decision_process: str(raw?.reflective_analysis?.decision_process),
    },
    automatic_analysis: {
      habits: arr(raw?.automatic_analysis?.habits),
      emotional_drivers: arr(raw?.automatic_analysis?.emotional_drivers),
      conditioning_factors: arr(raw?.automatic_analysis?.conditioning_factors),
      triggers: arr(raw?.automatic_analysis?.triggers),
    },
    motivation_summary: str(raw?.motivation_summary),
    leverage_points: arr(raw?.leverage_points),
  }
}

function validateFullAnalysis(raw: any): any {
  return {
    diagnosis: validateCombDiagnosis(raw?.diagnosis),
    interventions: validateInterventions(raw?.interventions || raw),
    motivation_insights: raw?.motivation_insights ? {
      primary_driver: str(raw.motivation_insights.primary_driver),
      leverage_points: arr(raw.motivation_insights.leverage_points),
    } : undefined,
    overall_assessment: str(raw?.overall_assessment),
  }
}

// --- Prompt builders ---

function buildPrompt(req: BehaviorAnalysisRequest): { system: string; user: string } {
  const v = CONTEXT_VOCAB[req.context]
  const { behavior } = req

  const behaviorBlock = `## Target Behavior
- Description: ${behavior.description}
${behavior.actor ? `- ${v.subject}: ${behavior.actor}` : ''}
${behavior.setting ? `- Setting: ${behavior.setting}` : ''}
${behavior.frequency ? `- Frequency: ${behavior.frequency}` : ''}
${behavior.consequences ? `- Known consequences: ${behavior.consequences}` : ''}
${req.additionalContext ? `\n## Additional Context\n${req.additionalContext}` : ''}`

  switch (req.mode) {
    case 'diagnose-comb':
      return {
        system: `You are an expert behavioral analyst using the COM-B model (Michie et al. 2011). You diagnose WHY a ${v.subject} ${v.subjectAction} by assessing six dimensions.

For each dimension, determine deficit level (adequate/deficit/major_barrier), provide evidence-based reasoning, and list observable indicators.

COM-B dimensions for this context:
- Physical Capability: ${v.capPhysical}
- Psychological Capability: ${v.capPsychological}
- Physical Opportunity: ${v.oppPhysical}
- Social Opportunity: ${v.oppSocial}
- Reflective Motivation: ${v.motReflective}
- Automatic Motivation: ${v.motAutomatic}

Return JSON:
{
  "physical_capability": {"deficit_level": "adequate|deficit|major_barrier", "evidence_notes": "...", "confidence": "low|medium|high", "indicators": ["..."]},
  "psychological_capability": {"deficit_level": "...", "evidence_notes": "...", "confidence": "...", "indicators": ["..."]},
  "physical_opportunity": {"deficit_level": "...", "evidence_notes": "...", "confidence": "...", "indicators": ["..."]},
  "social_opportunity": {"deficit_level": "...", "evidence_notes": "...", "confidence": "...", "indicators": ["..."]},
  "reflective_motivation": {"deficit_level": "...", "evidence_notes": "...", "confidence": "...", "indicators": ["..."]},
  "automatic_motivation": {"deficit_level": "...", "evidence_notes": "...", "confidence": "...", "indicators": ["..."]},
  "summary": "Overall COM-B assessment in 2-3 sentences",
  "key_findings": ["Finding 1", "Finding 2", "Finding 3"]
}`,
        user: `Diagnose the COM-B factors for this behavior:\n\n${behaviorBlock}`,
      }

    case 'suggest-interventions': {
      const combBlock = req.combAssessment ? Object.entries(req.combAssessment)
        .map(([k, v]) => `- ${k}: ${v.deficit_level} (${v.evidence_notes || 'no notes'})`)
        .join('\n') : 'No COM-B assessment provided'

      return {
        system: `You are an expert behavioral analyst. Given a COM-B assessment, recommend specific ${v.interventionFrame}.

For each intervention, specify which COM-B component it targets, priority, concrete implementation steps, and expected impact.

Return JSON:
{
  "interventions": [
    {
      "intervention": "Name of intervention",
      "target_component": "physical_capability|psychological_capability|physical_opportunity|social_opportunity|reflective_motivation|automatic_motivation",
      "priority": "high|medium|low",
      "description": "What this intervention involves",
      "rationale": "Why this addresses the deficit",
      "implementation_steps": ["Step 1", "Step 2", "Step 3"],
      "expected_impact": "What change to expect"
    }
  ]
}`,
        user: `Suggest interventions based on this COM-B assessment:\n\n${behaviorBlock}\n\n## COM-B Assessment\n${combBlock}`,
      }
    }

    case 'analyze-motivation':
      return {
        system: `You are an expert behavioral analyst specializing in motivation analysis. Analyze the reflective (conscious/strategic) and automatic (habitual/emotional) motivation factors for why a ${v.subject} ${v.subjectAction}.

Return JSON:
{
  "reflective_analysis": {
    "goals": ["Goal 1", "Goal 2"],
    "beliefs": ["Belief about consequences 1", "Belief 2"],
    "identity_factors": ["Identity factor 1"],
    "decision_process": "How they decide to perform/avoid this behavior"
  },
  "automatic_analysis": {
    "habits": ["Habitual pattern 1"],
    "emotional_drivers": ["Emotion 1", "Emotion 2"],
    "conditioning_factors": ["Past reinforcement 1"],
    "triggers": ["Trigger 1", "Trigger 2"]
  },
  "motivation_summary": "Overall motivation assessment",
  "leverage_points": ["Leverage point 1", "Leverage point 2"]
}`,
        user: `Analyze the motivation behind this behavior:\n\n${behaviorBlock}`,
      }

    case 'full-analysis':
      return {
        system: `You are an expert behavioral analyst using the COM-B model (Michie et al. 2011). Provide a complete analysis: diagnose all 6 COM-B dimensions, then recommend ${v.interventionFrame} for identified deficits.

COM-B dimensions for this ${v.subject}:
- Physical Capability: ${v.capPhysical}
- Psychological Capability: ${v.capPsychological}
- Physical Opportunity: ${v.oppPhysical}
- Social Opportunity: ${v.oppSocial}
- Reflective Motivation: ${v.motReflective}
- Automatic Motivation: ${v.motAutomatic}

Return JSON:
{
  "diagnosis": {
    "physical_capability": {"deficit_level": "adequate|deficit|major_barrier", "evidence_notes": "...", "confidence": "low|medium|high", "indicators": ["..."]},
    "psychological_capability": {"deficit_level": "...", "evidence_notes": "...", "confidence": "...", "indicators": ["..."]},
    "physical_opportunity": {"deficit_level": "...", "evidence_notes": "...", "confidence": "...", "indicators": ["..."]},
    "social_opportunity": {"deficit_level": "...", "evidence_notes": "...", "confidence": "...", "indicators": ["..."]},
    "reflective_motivation": {"deficit_level": "...", "evidence_notes": "...", "confidence": "...", "indicators": ["..."]},
    "automatic_motivation": {"deficit_level": "...", "evidence_notes": "...", "confidence": "...", "indicators": ["..."]},
    "summary": "...",
    "key_findings": ["..."]
  },
  "interventions": [
    {
      "intervention": "...",
      "target_component": "...",
      "priority": "high|medium|low",
      "description": "...",
      "rationale": "...",
      "implementation_steps": ["..."],
      "expected_impact": "..."
    }
  ],
  "motivation_insights": {
    "primary_driver": "What primarily drives this behavior",
    "leverage_points": ["Point 1", "Point 2"]
  },
  "overall_assessment": "2-3 sentence ${v.outputLabel}"
}`,
        user: `Provide a complete COM-B behavior analysis:\n\n${behaviorBlock}`,
      }

    default:
      throw new Error(`Unknown mode: ${req.mode}`)
  }
}

// Token limits per mode
const MODE_TOKENS: Record<AnalysisMode, number> = {
  'diagnose-comb': 1200,
  'suggest-interventions': 1500,
  'analyze-motivation': 1000,
  'full-analysis': 2500,
}

// --- Handler ---

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const userId = await requireAuth(context.request, context.env)

    const req = await context.request.json() as BehaviorAnalysisRequest

    // Validate mode
    const validModes: AnalysisMode[] = ['diagnose-comb', 'suggest-interventions', 'analyze-motivation', 'full-analysis']
    if (!req.mode || !validModes.includes(req.mode)) {
      return new Response(JSON.stringify({ error: `Invalid mode. Use: ${validModes.join(', ')}` }), {
        status: 400, headers: JSON_HEADERS
      })
    }

    // Validate context
    if (!req.context || !['intelligence', 'product'].includes(req.context)) {
      return new Response(JSON.stringify({ error: 'Context required: "intelligence" or "product"' }), {
        status: 400, headers: JSON_HEADERS
      })
    }

    // Validate behavior description
    if (!req.behavior?.description?.trim()) {
      return new Response(JSON.stringify({ error: 'behavior.description is required' }), {
        status: 400, headers: JSON_HEADERS
      })
    }

    const { system, user } = buildPrompt(req)

    const data = await callOpenAIViaGateway(
      context.env,
      {
        model: 'gpt-5.4-mini',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ],
        max_completion_tokens: MODE_TOKENS[req.mode],
        reasoning_effort: 'none',
        temperature: 0.6,
        response_format: { type: 'json_object' }
      },
      {
        cacheTTL: req.mode === 'full-analysis' ? 0 : 1800,
        metadata: { endpoint: 'behavior-analysis', mode: req.mode, context: req.context, userId },
        timeout: 45000
      }
    )

    if (!data?.choices?.[0]?.message?.content) {
      throw new Error('Empty AI response')
    }

    let content = data.choices[0].message.content.trim()
    if (content.startsWith('```')) {
      content = content.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '')
    }

    // C2 — guard against malformed AI output (refusal/safety filter/truncated JSON).
    // response_format: json_object does not guarantee parseable JSON in all edge cases.
    let parsed: any
    try {
      parsed = JSON.parse(content)
    } catch (parseError) {
      console.error('[behavior-analysis] AI returned malformed JSON', {
        mode: req.mode,
        contentPreview: content.slice(0, 200),
        error: parseError instanceof Error ? parseError.message : String(parseError),
      })
      return new Response(JSON.stringify({
        error: 'AI returned malformed response. Please retry.',
        mode: req.mode,
      }), {
        status: 502,
        headers: JSON_HEADERS,
      })
    }

    // Validate per mode
    let result: any
    switch (req.mode) {
      case 'diagnose-comb':
        result = validateCombDiagnosis(parsed)
        break
      case 'suggest-interventions':
        result = validateInterventions(parsed)
        break
      case 'analyze-motivation':
        result = validateMotivation(parsed)
        break
      case 'full-analysis':
        result = validateFullAnalysis(parsed)
        break
    }

    return new Response(JSON.stringify({
      mode: req.mode,
      context: req.context,
      result,
      model: 'gpt-5.4-mini',
      tokensUsed: {
        input: data.usage?.prompt_tokens || 0,
        output: data.usage?.completion_tokens || 0,
        total: data.usage?.total_tokens || 0,
      }
    }), { headers: JSON_HEADERS })
  } catch (error) {
    if (error instanceof Response) return error
    console.error('[Behavior Analysis] Error:', error)
    return new Response(JSON.stringify({ error: 'Behavior analysis failed' }), {
      status: 500, headers: JSON_HEADERS
    })
  }
}

export const onRequestGet: PagesFunction = async () => {
  return new Response(JSON.stringify({ error: 'Method not allowed. Use POST.' }), {
    status: 405, headers: JSON_HEADERS
  })
}

export const onRequestOptions: PagesFunction = async () => {
  return optionsResponse()
}
