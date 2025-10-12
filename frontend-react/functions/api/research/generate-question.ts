/**
 * Generate Research Question API
 * POST /api/research/generate-question
 *
 * Uses AI to generate 3 high-quality research questions based on user inputs.
 * Applies SMART and FINER criteria, includes null/alternative hypotheses.
 */

import { requireAuth } from '../_shared/auth-helpers'
import { callOpenAIViaGateway } from '../_shared/ai-gateway'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
  OPENAI_API_KEY: string
  AI_GATEWAY_ACCOUNT_ID?: string
}

interface GenerateQuestionRequest {
  // Step 1: Basic context
  topic: string
  purpose: string[] // ["exploratory", "descriptive", etc.]
  projectType: string // "Academic thesis", "Policy report", etc.

  // Step 2: 5 W's
  who: {
    population: string
    subgroups?: string
  }
  what: {
    variables: string
    expectedOutcome?: string
  }
  where: {
    location: string
    specificSettings?: string
  }
  when: {
    timePeriod: string
    studyType: 'cross-sectional' | 'longitudinal' | 'historical' | 'real-time'
  }
  why: {
    importance: string
    beneficiaries?: string
  }

  // Step 3: Constraints & Resources
  duration: string
  resources: string[]
  experienceLevel: string
  constraints?: string
  ethicalConsiderations?: string

  // Optional: save to database
  saveToDatabase?: boolean
}

interface CriterionAssessment {
  passed: boolean
  explanation: string
}

interface GeneratedQuestion {
  question: string
  smartAssessment: {
    specific: CriterionAssessment
    measurable: CriterionAssessment
    achievable: CriterionAssessment
    relevant: CriterionAssessment
    timeBound: CriterionAssessment
  }
  finerAssessment: {
    feasible: CriterionAssessment
    interesting: CriterionAssessment
    novel: CriterionAssessment
    ethical: CriterionAssessment
    relevant: CriterionAssessment
  }
  nullHypothesis: string
  alternativeHypothesis: string
  keyVariables: string[]
  dataCollectionMethods: string[]
  potentialChallenges: string[]
  overallScore: number // 0-100
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const auth = await requireAuth(context)
    if (!auth) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const body = await context.request.json() as GenerateQuestionRequest

    // Validate required fields
    if (!body.topic || !body.who || !body.what || !body.where || !body.when || !body.why) {
      return new Response(JSON.stringify({
        error: 'Missing required fields: topic, who, what, where, when, why'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('[generate-question] Generating questions for topic:', body.topic)

    // Build AI prompt
    const systemPrompt = `You are an expert research methodologist specializing in formulating high-quality research questions. Your task is to generate research questions that follow SMART and FINER criteria, are measurable/observable, and include appropriate null and alternative hypotheses.

SMART Criteria: Specific, Measurable, Achievable, Relevant, Time-bound
FINER Criteria: Feasible, Interesting, Novel, Ethical, Relevant

Generate 3 distinct research questions that:
1. Are different in scope or focus but address the user's core interest
2. Range from broad to narrow in scope (Question 1: Broad, Question 2: Moderate, Question 3: Narrow)
3. Are professionally worded and academically rigorous
4. Include operational definitions of key variables
5. Can be tested with available resources
6. Follow best practices for research question formulation

For each question, provide:
- SMART assessment (detailed explanations for each criterion)
- FINER assessment (detailed explanations for each criterion)
- Null hypothesis (H₀) with equality symbol (=, ≤, ≥)
- Alternative hypothesis (H₁) with inequality symbol (<, >, ≠)
- Key measurable variables
- Suggested data collection methods
- Potential challenges
- Overall score (0-100) based on how well it meets all criteria

Return ONLY valid JSON in this exact structure:
{
  "questions": [
    {
      "question": "string",
      "smartAssessment": {
        "specific": {"passed": boolean, "explanation": "string"},
        "measurable": {"passed": boolean, "explanation": "string"},
        "achievable": {"passed": boolean, "explanation": "string"},
        "relevant": {"passed": boolean, "explanation": "string"},
        "timeBound": {"passed": boolean, "explanation": "string"}
      },
      "finerAssessment": {
        "feasible": {"passed": boolean, "explanation": "string"},
        "interesting": {"passed": boolean, "explanation": "string"},
        "novel": {"passed": boolean, "explanation": "string"},
        "ethical": {"passed": boolean, "explanation": "string"},
        "relevant": {"passed": boolean, "explanation": "string"}
      },
      "nullHypothesis": "string",
      "alternativeHypothesis": "string",
      "keyVariables": ["string"],
      "dataCollectionMethods": ["string"],
      "potentialChallenges": ["string"],
      "overallScore": number
    }
  ]
}`

    const userPrompt = `Generate 3 research questions (broad, moderate, narrow scope) based on:

TOPIC: ${body.topic}
PURPOSE: ${body.purpose.join(', ')}
PROJECT TYPE: ${body.projectType}

5 W'S:
- WHO: ${body.who.population}${body.who.subgroups ? ` (comparing ${body.who.subgroups})` : ''}
- WHAT: ${body.what.variables}${body.what.expectedOutcome ? ` (expected: ${body.what.expectedOutcome})` : ''}
- WHERE: ${body.where.location}${body.where.specificSettings ? ` (settings: ${body.where.specificSettings})` : ''}
- WHEN: ${body.when.timePeriod} (${body.when.studyType})
- WHY: ${body.why.importance}${body.why.beneficiaries ? ` (beneficiaries: ${body.why.beneficiaries})` : ''}

CONSTRAINTS:
- Duration: ${body.duration}
- Resources: ${body.resources.join(', ')}
- Experience Level: ${body.experienceLevel}
${body.constraints ? `- Areas to Avoid: ${body.constraints}` : ''}
${body.ethicalConsiderations ? `- Ethical Considerations: ${body.ethicalConsiderations}` : ''}

Generate 3 research questions with varying scope that are SMART and FINER compliant.`

    // Call OpenAI API
    const response = await callOpenAIViaGateway(
      context.env.OPENAI_API_KEY,
      'gpt-4o', // Use GPT-4o for high-quality question generation
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      {
        temperature: 0.7, // Balance creativity and consistency
        max_tokens: 3000,
        response_format: { type: 'json_object' }
      },
      context.env.AI_GATEWAY_ACCOUNT_ID
    )

    const aiResponse = JSON.parse(response.choices[0].message.content)
    const generatedQuestions: GeneratedQuestion[] = aiResponse.questions || []

    console.log('[generate-question] Generated', generatedQuestions.length, 'questions')

    // Optionally save to database
    let savedId: string | null = null
    if (body.saveToDatabase) {
      savedId = `rq-${crypto.randomUUID()}`

      // Get user's workspace
      const workspace = await context.env.DB.prepare(`
        SELECT workspace_id FROM workspace_members WHERE user_id = ? LIMIT 1
      `).bind(auth.user.id).first()

      if (!workspace) {
        return new Response(JSON.stringify({
          error: 'No workspace found for user'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      await context.env.DB.prepare(`
        INSERT INTO research_questions (
          id, user_id, workspace_id,
          topic, purpose, project_type,
          five_ws,
          duration, resources, experience_level, constraints, ethical_considerations,
          generated_questions,
          status,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).bind(
        savedId,
        auth.user.id,
        workspace.workspace_id,
        body.topic,
        JSON.stringify(body.purpose),
        body.projectType,
        JSON.stringify({
          who: body.who,
          what: body.what,
          where: body.where,
          when: body.when,
          why: body.why
        }),
        body.duration,
        JSON.stringify(body.resources),
        body.experienceLevel,
        body.constraints || null,
        body.ethicalConsiderations || null,
        JSON.stringify(generatedQuestions),
        'draft'
      ).run()

      console.log('[generate-question] Saved to database with ID:', savedId)
    }

    return new Response(JSON.stringify({
      success: true,
      id: savedId,
      questions: generatedQuestions,
      summary: {
        topic: body.topic,
        who: body.who.population,
        what: body.what.variables,
        where: body.where.location,
        when: body.when.timePeriod,
        why: body.why.importance
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('[generate-question] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to generate research questions',
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
