/**
 * Generate Research Plan API
 * POST /api/research/generate-plan
 *
 * Uses AI to generate a comprehensive research plan based on a research question.
 * Includes methodology, timeline, resources, literature review strategy, data analysis plan.
 */

import { requireAuth } from '../_shared/auth-helpers'
import { callOpenAIViaGateway } from '../_shared/ai-gateway'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
  OPENAI_API_KEY: string
  AI_GATEWAY_ACCOUNT_ID?: string
}

interface GeneratePlanRequest {
  researchQuestionId: string // ID from research_questions table
  researchQuestion: string
  duration: string
  resources: string[]
  experienceLevel: string
  projectType: string
  fiveWs: {
    who: { population: string; subgroups?: string }
    what: { variables: string; expectedOutcome?: string }
    where: { location: string; specificSettings?: string }
    when: { timePeriod: string; studyType: string }
    why: { importance: string; beneficiaries?: string }
  }
}

interface Milestone {
  phase: string
  tasks: string[]
  duration: string
  deliverables: string[]
}

interface ResearchPlan {
  methodology: {
    approach: string // "Quantitative", "Qualitative", "Mixed Methods"
    design: string // "Experimental", "Survey", "Case Study", etc.
    rationale: string
    dataCollection: string[]
    sampling: string
    sampleSize: string
  }
  timeline: {
    totalDuration: string
    milestones: Milestone[]
    criticalPath: string[]
  }
  resources: {
    personnel: string[]
    equipment: string[]
    software: string[]
    funding: string
    facilities: string[]
  }
  literatureReview: {
    databases: string[]
    searchTerms: string[]
    inclusionCriteria: string[]
    exclusionCriteria: string[]
    expectedSources: number
  }
  dataAnalysis: {
    quantitativeTests: string[]
    qualitativeApproaches: string[]
    software: string[]
    validationMethods: string[]
  }
  ethicalConsiderations: {
    irbRequired: boolean
    riskLevel: string
    consentRequired: boolean
    privacyMeasures: string[]
    potentialRisks: string[]
  }
  dissemination: {
    targetJournals: string[]
    conferences: string[]
    stakeholders: string[]
    formats: string[]
  }
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const userId = await requireAuth(context.request, context.env)

    const body = await context.request.json() as GeneratePlanRequest

    if (!body.researchQuestion || !body.duration) {
      return new Response(JSON.stringify({
        error: 'Missing required fields: researchQuestion, duration'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('[generate-plan] Generating research plan for:', body.researchQuestion)

    // Build AI prompt
    const systemPrompt = `You are an expert research methodologist and project manager. Generate a comprehensive, actionable research plan that follows academic best practices and is tailored to the researcher's experience level and available resources.

Your plan should be:
- Realistic given the timeline and resources
- Specific and actionable (not generic advice)
- Follows ethical research standards
- Includes contingency planning
- Appropriate for the experience level

Return ONLY valid JSON in this exact structure (no markdown, no explanation):
{
  "methodology": {
    "approach": "Quantitative|Qualitative|Mixed Methods",
    "design": "specific design type",
    "rationale": "why this methodology fits the research question",
    "dataCollection": ["specific method 1", "specific method 2"],
    "sampling": "sampling strategy with justification",
    "sampleSize": "recommended sample size with justification"
  },
  "timeline": {
    "totalDuration": "duration",
    "milestones": [
      {
        "phase": "phase name",
        "tasks": ["task 1", "task 2"],
        "duration": "duration",
        "deliverables": ["deliverable 1"]
      }
    ],
    "criticalPath": ["critical task 1", "critical task 2"]
  },
  "resources": {
    "personnel": ["role 1", "role 2"],
    "equipment": ["equipment 1"],
    "software": ["software 1"],
    "funding": "estimated budget range with breakdown",
    "facilities": ["facility 1"]
  },
  "literatureReview": {
    "databases": ["database 1", "database 2"],
    "searchTerms": ["term 1", "term 2"],
    "inclusionCriteria": ["criterion 1"],
    "exclusionCriteria": ["criterion 1"],
    "expectedSources": number
  },
  "dataAnalysis": {
    "quantitativeTests": ["test 1"],
    "qualitativeApproaches": ["approach 1"],
    "software": ["software 1"],
    "validationMethods": ["method 1"]
  },
  "ethicalConsiderations": {
    "irbRequired": boolean,
    "riskLevel": "Minimal|Low|Moderate|High",
    "consentRequired": boolean,
    "privacyMeasures": ["measure 1"],
    "potentialRisks": ["risk 1"]
  },
  "dissemination": {
    "targetJournals": ["journal 1"],
    "conferences": ["conference 1"],
    "stakeholders": ["stakeholder 1"],
    "formats": ["format 1"]
  }
}`

    const userPrompt = `Generate a comprehensive research plan for:

RESEARCH QUESTION: ${body.researchQuestion}

PROJECT DETAILS:
- Type: ${body.projectType}
- Duration: ${body.duration}
- Experience Level: ${body.experienceLevel}
- Available Resources: ${body.resources.join(', ')}

RESEARCH CONTEXT:
- Population: ${body.fiveWs.who.population}${body.fiveWs.who.subgroups ? ` (subgroups: ${body.fiveWs.who.subgroups})` : ''}
- Variables: ${body.fiveWs.what.variables}
- Location: ${body.fiveWs.where.location}${body.fiveWs.where.specificSettings ? ` (${body.fiveWs.where.specificSettings})` : ''}
- Time Period: ${body.fiveWs.when.timePeriod} (${body.fiveWs.when.studyType})
- Importance: ${body.fiveWs.why.importance}

Generate a detailed, actionable research plan that:
1. Recommends appropriate methodology (quantitative/qualitative/mixed)
2. Provides realistic timeline with specific milestones
3. Lists required resources and estimated budget
4. Suggests literature review strategy
5. Outlines data analysis approach
6. Addresses ethical considerations
7. Proposes dissemination strategy

Make the plan specific to THIS research question, not generic advice. Consider the ${body.experienceLevel} experience level and ${body.duration} duration.`

    // Call OpenAI API
    const response = await callOpenAIViaGateway(
      context.env.OPENAI_API_KEY,
      'gpt-4o', // Use GPT-4o for comprehensive planning
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      {
        temperature: 0.6, // Balance structure and creativity
        max_tokens: 3500,
        response_format: { type: 'json_object' }
      },
      context.env.AI_GATEWAY_ACCOUNT_ID
    )

    const plan: ResearchPlan = JSON.parse(response.choices[0].message.content)

    console.log('[generate-plan] Plan generated successfully')

    // Save plan to database if research question ID provided
    if (body.researchQuestionId) {
      try {
        await context.env.DB.prepare(`
          UPDATE research_questions
          SET custom_edits = ?
          WHERE id = ?
        `).bind(
          JSON.stringify({ generatedPlan: plan, generatedAt: new Date().toISOString() }),
          body.researchQuestionId
        ).run()

        console.log('[generate-plan] Saved plan to research question:', body.researchQuestionId)
      } catch (error) {
        console.error('[generate-plan] Failed to save plan:', error)
        // Non-fatal - continue
      }
    }

    return new Response(JSON.stringify({
      success: true,
      plan
    }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('[generate-plan] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to generate research plan',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
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
