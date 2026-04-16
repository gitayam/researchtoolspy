/**
 * Generate Research Plan API
 * POST /api/research/generate-plan
 *
 * Generates a comprehensive research plan from a selected research question.
 * Includes methodology, timeline, resources, literature review, data analysis,
 * ethical considerations, and dissemination strategy.
 * Adapts to research context (academic, OSINT, investigation, etc.).
 */

import { requireAuth } from '../_shared/auth-helpers'
import { callOpenAIViaGateway } from '../_shared/ai-gateway'
import { JSON_HEADERS, optionsResponse } from '../_shared/api-utils'

interface Env {
  DB?: D1Database
  OPENAI_API_KEY: string
  SESSIONS?: KVNamespace
  AI_GATEWAY_ACCOUNT_ID?: string
}

interface GeneratePlanRequest {
  researchQuestionId?: string
  researchQuestion: string
  duration?: string
  resources?: string[]
  experienceLevel?: string
  projectType?: string
  fiveWs?: {
    who?: { population: string; subgroups?: string }
    what?: { variables: string; expectedOutcome?: string }
    where?: { location: string; specificSettings?: string }
    when?: { timePeriod: string; studyType?: string }
    why?: { importance: string; beneficiaries?: string }
  }
  researchContext?: 'academic' | 'osint' | 'investigation' | 'business' | 'journalism' | 'personal'
  teamSize?: 'solo' | 'small-team' | 'large-team'
  teamRoles?: string[]
}

interface Milestone {
  phase: string
  tasks: string[]
  duration: string
  deliverables: string[]
}

interface ResearchPlan {
  methodology: {
    approach: string
    design: string
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
  teamCollaboration?: {
    roles: Array<{ role: string; responsibilities: string[] }>
    communicationPlan: string
    taskDistribution: string[]
    collaborationTools: string[]
  }
}

function getContextSpecificGuidance(context?: string): string {
  switch (context) {
    case 'osint':
      return `
OSINT-Specific Requirements:
- Include source verification protocols and credibility assessment framework
- Add OPSEC (Operational Security) considerations for researchers
- Include digital footprint management guidelines
- Provide attribution methodology for sources
- Recommend specific OSINT tools and platforms (Maltego, Shodan, OSINT Framework, etc.)
- Include data privacy and legal compliance measures`

    case 'investigation':
      return `
Private Investigation Requirements:
- Include legal compliance checklist (varying by jurisdiction)
- Establish chain of custody procedures for evidence
- Include client reporting schedules and deliverables
- Add surveillance protocol guidelines (legal and ethical)
- Provide documentation standards for court admissibility
- Include risk assessment for investigator safety`

    case 'business':
      return `
Business Research Requirements:
- Include ROI (Return on Investment) projections
- Add stakeholder analysis and engagement plan
- Include competitive intelligence gathering methods
- Provide risk mitigation strategies
- Add executive summary requirements
- Include market sizing and validation approaches`

    case 'journalism':
      return `
Investigative Journalism Requirements:
- Include source protection protocols
- Add fact-checking and verification procedures
- Include editorial standards compliance
- Provide public interest justification
- Add legal review checkpoints
- Provide publication timeline and format recommendations`

    case 'personal':
      return `
Personal/Hobby Research Requirements:
- Allow flexible timeline with learning milestones
- Recommend community resources and free tools
- Include skill-building objectives
- Provide low-cost or no-cost alternatives
- Suggest collaboration with hobbyist communities`

    case 'academic':
    default:
      return `
Academic Research Requirements:
- Include IRB (Institutional Review Board) approval timeline if needed
- Add comprehensive literature review strategy
- Include peer review preparation guidelines
- Provide academic publication targeting
- Add academic rigor and methodology standards`
  }
}

// Validate plan fields from AI response
function validatePlan(raw: any): ResearchPlan {
  const arr = (v: any) => Array.isArray(v) ? v.filter((s: any) => typeof s === 'string') : []
  const str = (v: any, fb = '') => typeof v === 'string' ? v : fb
  const bool = (v: any, fb = false) => typeof v === 'boolean' ? v : fb
  const num = (v: any, fb = 0) => typeof v === 'number' ? v : fb

  return {
    methodology: {
      approach: str(raw.methodology?.approach, 'Mixed Methods'),
      design: str(raw.methodology?.design),
      rationale: str(raw.methodology?.rationale),
      dataCollection: arr(raw.methodology?.dataCollection),
      sampling: str(raw.methodology?.sampling),
      sampleSize: str(raw.methodology?.sampleSize),
    },
    timeline: {
      totalDuration: str(raw.timeline?.totalDuration),
      milestones: Array.isArray(raw.timeline?.milestones)
        ? raw.timeline.milestones.map((m: any) => ({
            phase: str(m?.phase),
            tasks: arr(m?.tasks),
            duration: str(m?.duration),
            deliverables: arr(m?.deliverables),
          }))
        : [],
      criticalPath: arr(raw.timeline?.criticalPath),
    },
    resources: {
      personnel: arr(raw.resources?.personnel),
      equipment: arr(raw.resources?.equipment),
      software: arr(raw.resources?.software),
      funding: str(raw.resources?.funding),
      facilities: arr(raw.resources?.facilities),
    },
    literatureReview: {
      databases: arr(raw.literatureReview?.databases),
      searchTerms: arr(raw.literatureReview?.searchTerms),
      inclusionCriteria: arr(raw.literatureReview?.inclusionCriteria),
      exclusionCriteria: arr(raw.literatureReview?.exclusionCriteria),
      expectedSources: num(raw.literatureReview?.expectedSources, 20),
    },
    dataAnalysis: {
      quantitativeTests: arr(raw.dataAnalysis?.quantitativeTests),
      qualitativeApproaches: arr(raw.dataAnalysis?.qualitativeApproaches),
      software: arr(raw.dataAnalysis?.software),
      validationMethods: arr(raw.dataAnalysis?.validationMethods),
    },
    ethicalConsiderations: {
      irbRequired: bool(raw.ethicalConsiderations?.irbRequired),
      riskLevel: str(raw.ethicalConsiderations?.riskLevel, 'Minimal'),
      consentRequired: bool(raw.ethicalConsiderations?.consentRequired),
      privacyMeasures: arr(raw.ethicalConsiderations?.privacyMeasures),
      potentialRisks: arr(raw.ethicalConsiderations?.potentialRisks),
    },
    dissemination: {
      targetJournals: arr(raw.dissemination?.targetJournals),
      conferences: arr(raw.dissemination?.conferences),
      stakeholders: arr(raw.dissemination?.stakeholders),
      formats: arr(raw.dissemination?.formats),
    },
    ...(raw.teamCollaboration ? {
      teamCollaboration: {
        roles: Array.isArray(raw.teamCollaboration?.roles)
          ? raw.teamCollaboration.roles.map((r: any) => ({
              role: str(r?.role),
              responsibilities: arr(r?.responsibilities),
            }))
          : [],
        communicationPlan: str(raw.teamCollaboration?.communicationPlan),
        taskDistribution: arr(raw.teamCollaboration?.taskDistribution),
        collaborationTools: arr(raw.teamCollaboration?.collaborationTools),
      }
    } : {}),
  }
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const userId = await requireAuth(context.request, context.env)

    const body = await context.request.json() as GeneratePlanRequest

    if (!body.researchQuestion) {
      return new Response(JSON.stringify({
        error: 'Missing required field: researchQuestion'
      }), {
        status: 400,
        headers: JSON_HEADERS
      })
    }

    // Defaults for optional fields
    const duration = body.duration || '3-6 months'
    const resources = body.resources || []
    const experienceLevel = body.experienceLevel || 'intermediate'
    const projectType = body.projectType || 'General research'
    const fiveWs = {
      who: body.fiveWs?.who?.population ? body.fiveWs.who : { population: 'To be determined' },
      what: body.fiveWs?.what?.variables ? body.fiveWs.what : { variables: 'To be determined' },
      where: body.fiveWs?.where?.location ? body.fiveWs.where : { location: 'To be determined' },
      when: body.fiveWs?.when?.timePeriod ? body.fiveWs.when : { timePeriod: 'To be determined', studyType: 'cross-sectional' },
      why: body.fiveWs?.why?.importance ? body.fiveWs.why : { importance: 'As specified in research question' },
    }

    const contextGuidance = getContextSpecificGuidance(body.researchContext)
    const contextLabel = body.researchContext
      ? body.researchContext.charAt(0).toUpperCase() + body.researchContext.slice(1)
      : 'General'

    const teamInfo = body.teamSize && body.teamSize !== 'solo'
      ? `\nTEAM STRUCTURE:\n- Team Size: ${body.teamSize === 'small-team' ? 'Small Team (2-5 people)' : 'Large Team (6+ people)'}${body.teamRoles?.length ? `\n- Team Roles: ${body.teamRoles.join(', ')}` : ''}\n`
      : '\nTEAM STRUCTURE: Solo Researcher\n'

    const systemPrompt = `You are an expert research methodologist and project manager. Generate a comprehensive, actionable research plan tailored to the researcher's context, experience level, and available resources.

Your plan should be:
- Realistic given the timeline and resources
- Specific and actionable (not generic advice)
- Follows ethical research standards
- Includes contingency planning
- Appropriate for the experience level
- Adapted to the specific research context

${contextGuidance}

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
    "personnel": ["role 1"],
    "equipment": ["equipment 1"],
    "software": ["software 1"],
    "funding": "estimated budget range with breakdown",
    "facilities": ["facility 1"]
  },
  "literatureReview": {
    "databases": ["database 1"],
    "searchTerms": ["term 1"],
    "inclusionCriteria": ["criterion 1"],
    "exclusionCriteria": ["criterion 1"],
    "expectedSources": 30
  },
  "dataAnalysis": {
    "quantitativeTests": ["test 1"],
    "qualitativeApproaches": ["approach 1"],
    "software": ["software 1"],
    "validationMethods": ["method 1"]
  },
  "ethicalConsiderations": {
    "irbRequired": false,
    "riskLevel": "Minimal|Low|Moderate|High",
    "consentRequired": false,
    "privacyMeasures": ["measure 1"],
    "potentialRisks": ["risk 1"]
  },
  "dissemination": {
    "targetJournals": ["journal 1"],
    "conferences": ["conference 1"],
    "stakeholders": ["stakeholder 1"],
    "formats": ["format 1"]
  }${body.teamSize && body.teamSize !== 'solo' ? `,
  "teamCollaboration": {
    "roles": [{"role": "role name", "responsibilities": ["responsibility 1"]}],
    "communicationPlan": "how team will coordinate",
    "taskDistribution": ["strategy 1"],
    "collaborationTools": ["tool 1"]
  }` : ''}
}`

    const userPrompt = `Generate a comprehensive research plan for:

RESEARCH QUESTION: ${body.researchQuestion}

RESEARCH TYPE: ${contextLabel}

PROJECT DETAILS:
- Type: ${projectType}
- Duration: ${duration}
- Experience Level: ${experienceLevel}
${resources.length ? `- Available Resources: ${resources.join(', ')}` : ''}
${teamInfo}
RESEARCH CONTEXT:
- Population: ${fiveWs.who.population}${(fiveWs.who as any).subgroups ? ` (subgroups: ${(fiveWs.who as any).subgroups})` : ''}
- Variables: ${fiveWs.what.variables}
- Location: ${fiveWs.where.location}${(fiveWs.where as any).specificSettings ? ` (${(fiveWs.where as any).specificSettings})` : ''}
- Time Period: ${fiveWs.when.timePeriod} (${(fiveWs.when as any).studyType || 'cross-sectional'})
- Importance: ${fiveWs.why.importance}

Make the plan specific to THIS research question and context, not generic advice.`

    const response = await callOpenAIViaGateway(
      context.env,
      {
        model: 'gpt-5.4-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        reasoning_effort: 'none',
        temperature: 0.6,
        max_completion_tokens: 3500,
        response_format: { type: 'json_object' }
      },
      {
        cacheTTL: 0, // Don't cache plans — they're personalized
        metadata: { endpoint: 'generate-plan', userId },
        timeout: 45000
      }
    )

    if (!response?.choices?.[0]?.message?.content) {
      throw new Error('No content in AI response')
    }

    let planContent = response.choices[0].message.content.trim()
    if (planContent.startsWith('```')) {
      planContent = planContent.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '')
    }

    let rawPlan: any
    try {
      rawPlan = JSON.parse(planContent)
    } catch (parseError) {
      console.error('[generate-plan] Failed to parse AI response:', planContent.slice(0, 200))
      throw new Error('AI returned invalid JSON for research plan')
    }

    const plan = validatePlan(rawPlan)

    // Save plan to database if research question ID provided
    if (body.researchQuestionId && context.env.DB) {
      try {
        await context.env.DB.prepare(`
          UPDATE research_questions
          SET custom_edits = ?, updated_at = datetime('now')
          WHERE id = ?
        `).bind(
          JSON.stringify({ generatedPlan: plan, generatedAt: new Date().toISOString() }),
          body.researchQuestionId
        ).run()
      } catch (dbError) {
        console.error('[generate-plan] Failed to save plan:', dbError)
        // Non-fatal — still return the plan
      }
    }

    return new Response(JSON.stringify({ success: true, plan }), {
      headers: JSON_HEADERS
    })
  } catch (error) {
    if (error instanceof Response) return error
    console.error('[generate-plan] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to generate research plan'
    }), {
      status: 500,
      headers: JSON_HEADERS
    })
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
