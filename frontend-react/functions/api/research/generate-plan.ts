/**
 * Generate Research Plan API
 * POST /api/research/generate-plan
 *
 * Uses AI to generate a comprehensive research plan based on a research question.
 * Includes methodology, timeline, resources, literature review strategy, data analysis plan.
 */

interface Env {
  DB?: D1Database
  OPENAI_API_KEY: string
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
  // NEW: Research context and team structure
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
  // NEW: Team collaboration (optional, for team-based research)
  teamCollaboration?: {
    roles: Array<{ role: string; responsibilities: string[] }>
    communicationPlan: string
    taskDistribution: string[]
    collaborationTools: string[]
  }
}

// Helper function to get context-specific prompts
function getContextSpecificGuidance(context?: string): string {
  switch (context) {
    case 'osint':
      return `
OSINT-Specific Requirements:
- Include source verification protocols and credibility assessment framework
- Add OPSEC (Operational Security) considerations for researchers
- Include digital footprint management guidelines
- Provide attribution methodology for sources
- Include threat modeling for sensitive investigations
- Recommend specific OSINT tools and platforms (Maltego, Shodan, OSINT Framework, etc.)
- Include data privacy and legal compliance measures`

    case 'investigation':
      return `
Private Investigation Requirements:
- Include legal compliance checklist (varying by jurisdiction)
- Establish chain of custody procedures for evidence
- Include client reporting schedules and deliverables
- Add surveillance protocol guidelines (legal and ethical)
- Include confidentiality and privacy protection measures
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
- Include market sizing and validation approaches
- Provide actionable business recommendations framework`

    case 'journalism':
      return `
Investigative Journalism Requirements:
- Include source protection protocols
- Add fact-checking and verification procedures
- Include editorial standards compliance
- Provide public interest justification
- Add legal review checkpoints
- Include ethical consideration for sensitive topics
- Provide publication timeline and format recommendations`

    case 'personal':
      return `
Personal/Hobby Research Requirements:
- Allow flexible timeline with learning milestones
- Recommend community resources and free tools
- Include skill-building objectives
- Provide low-cost or no-cost alternatives
- Include passion-driven motivational elements
- Suggest collaboration with hobbyist communities
- Allow for exploratory and iterative approaches`

    case 'academic':
    default:
      return `
Academic Research Requirements:
- Include IRB (Institutional Review Board) approval timeline if needed
- Add comprehensive literature review strategy
- Include peer review preparation guidelines
- Provide academic publication targeting
- Include conference presentation opportunities
- Add academic rigor and methodology standards`
  }
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
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
    const contextGuidance = getContextSpecificGuidance(body.researchContext)

    const systemPrompt = `You are an expert research methodologist and project manager. Generate a comprehensive, actionable research plan that follows best practices and is tailored to the researcher's experience level and available resources.

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
  },
  "teamCollaboration": {
    "roles": [{"role": "role name", "responsibilities": ["responsibility 1", "responsibility 2"]}],
    "communicationPlan": "how team will communicate and coordinate",
    "taskDistribution": ["distribution strategy 1", "distribution strategy 2"],
    "collaborationTools": ["tool 1", "tool 2"]
  }
}

NOTE: Only include "teamCollaboration" if this is team-based research (not solo). Omit it entirely for solo researchers.`

    const contextLabel = body.researchContext
      ? `${body.researchContext.charAt(0).toUpperCase() + body.researchContext.slice(1)}`
      : 'General'

    const teamInfo = body.teamSize && body.teamSize !== 'solo'
      ? `
TEAM STRUCTURE:
- Team Size: ${body.teamSize === 'small-team' ? 'Small Team (2-5 people)' : 'Large Team (6+ people)'}
${body.teamRoles && body.teamRoles.length > 0 ? `- Team Roles: ${body.teamRoles.join(', ')}` : ''}
`
      : '\nTEAM STRUCTURE: Solo Researcher\n'

    const userPrompt = `Generate a comprehensive research plan for:

RESEARCH QUESTION: ${body.researchQuestion}

RESEARCH TYPE: ${contextLabel}

PROJECT DETAILS:
- Type: ${body.projectType}
- Duration: ${body.duration}
- Experience Level: ${body.experienceLevel}
- Available Resources: ${body.resources.join(', ')}
${teamInfo}
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
${body.teamSize && body.teamSize !== 'solo' ? '8. Includes team collaboration plan with role assignments and communication strategy' : ''}

Make the plan specific to THIS research question and research type, not generic advice. Consider the ${body.experienceLevel} experience level and ${body.duration} duration.${body.teamSize && body.teamSize !== 'solo' ? ` Include specific guidance for coordinating a ${body.teamSize === 'small-team' ? 'small' : 'large'} team.` : ''}`

    // Call OpenAI API directly
    const apiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${context.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.6,
        max_tokens: 3500,
        response_format: { type: 'json_object' }
      })
    })

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text()
      console.error('[generate-plan] OpenAI API error:', errorText)
      throw new Error(`OpenAI API error ${apiResponse.status}: ${errorText}`)
    }

    const response = await apiResponse.json()
    const plan: ResearchPlan = JSON.parse(response.choices[0].message.content)

    console.log('[generate-plan] Plan generated successfully')

    // Save plan to database if research question ID provided and DB is available
    if (body.researchQuestionId && context.env.DB) {
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
