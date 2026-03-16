/**
 * Generate Research Question API
 * POST /api/research/generate-question
 *
 * Uses AI to generate 3 high-quality research questions based on user inputs.
 * Applies SMART and FINER criteria, includes null/alternative hypotheses.
 */

import { requireAuth } from '../_shared/auth-helpers'
import { callOpenAIViaGateway } from '../_shared/ai-gateway'
import { CORS_HEADERS, JSON_HEADERS, optionsResponse } from '../_shared/api-utils'

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
    const userId = await requireAuth(context.request, context.env)

    const body = await context.request.json() as GenerateQuestionRequest

    // Validate required fields — only topic is truly required
    if (!body.topic) {
      return new Response(JSON.stringify({
        error: 'Missing required field: topic'
      }), {
        status: 400,
        headers: JSON_HEADERS
      })
    }

    // Default optional 5 W's so the prompt is always well-formed
    const who = body.who?.population ? body.who : { population: 'To be determined', subgroups: '' }
    const what = body.what?.variables ? body.what : { variables: 'To be determined', expectedOutcome: '' }
    const where = body.where?.location ? body.where : { location: 'To be determined', specificSettings: '' }
    const when = body.when?.timePeriod ? body.when : { timePeriod: 'To be determined', studyType: 'cross-sectional' as const }
    const why = body.why?.importance ? body.why : { importance: 'To be determined', beneficiaries: '' }


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
${body.purpose?.length ? `PURPOSE: ${body.purpose.join(', ')}` : ''}
${body.projectType ? `PROJECT TYPE: ${body.projectType}` : ''}

5 W'S:
- WHO: ${who.population}${who.subgroups ? ` (comparing ${who.subgroups})` : ''}
- WHAT: ${what.variables}${what.expectedOutcome ? ` (expected: ${what.expectedOutcome})` : ''}
- WHERE: ${where.location}${where.specificSettings ? ` (settings: ${where.specificSettings})` : ''}
- WHEN: ${when.timePeriod} (${when.studyType})
- WHY: ${why.importance}${why.beneficiaries ? ` (beneficiaries: ${why.beneficiaries})` : ''}

${body.duration || body.resources?.length || body.experienceLevel ? `CONSTRAINTS:
${body.duration ? `- Duration: ${body.duration}` : ''}
${body.resources?.length ? `- Resources: ${body.resources.join(', ')}` : ''}
${body.experienceLevel ? `- Experience Level: ${body.experienceLevel}` : ''}
${body.constraints ? `- Areas to Avoid: ${body.constraints}` : ''}
${body.ethicalConsiderations ? `- Ethical Considerations: ${body.ethicalConsiderations}` : ''}` : ''}

Generate 3 research questions with varying scope that are SMART and FINER compliant.`

    // Call OpenAI API
    let response;
    try {
      response = await callOpenAIViaGateway(
        context.env, // Pass full environment object
        {
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.7,
          max_completion_tokens: 3000,
          response_format: { type: 'json_object' }
        },
        {
          // Optional metadata for logging/tracking
          metadata: {
            endpoint: 'generate-question',
            userId: userId
          }
        }
      )
    } catch (aiError) {
      console.error('[generate-question] AI Gateway Error:', aiError)
      throw new Error('AI generation failed')
    }

    if (!response?.choices?.[0]?.message?.content) {
      throw new Error('Invalid response format from AI provider')
    }

    let aiContent = response.choices[0].message.content.trim()
    // Strip markdown code fences if AI wraps JSON in ```json ... ```
    if (aiContent.startsWith('```')) {
      aiContent = aiContent.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '')
    }
    let aiResponse: any
    try {
      aiResponse = JSON.parse(aiContent)
    } catch (parseError) {
      console.error('[generate-question] Failed to parse AI response:', aiContent.slice(0, 200))
      throw new Error('AI returned invalid JSON')
    }
    const generatedQuestions: GeneratedQuestion[] = (aiResponse.questions || []).map((raw: any) => ({
      question: typeof raw.question === 'string' ? raw.question : '',
      smartAssessment: raw.smartAssessment && typeof raw.smartAssessment === 'object' ? raw.smartAssessment : {},
      finerAssessment: raw.finerAssessment && typeof raw.finerAssessment === 'object' ? raw.finerAssessment : {},
      nullHypothesis: typeof raw.nullHypothesis === 'string' ? raw.nullHypothesis : '',
      alternativeHypothesis: typeof raw.alternativeHypothesis === 'string' ? raw.alternativeHypothesis : '',
      keyVariables: Array.isArray(raw.keyVariables) ? raw.keyVariables.filter((v: any) => typeof v === 'string') : [],
      dataCollectionMethods: Array.isArray(raw.dataCollectionMethods) ? raw.dataCollectionMethods.filter((v: any) => typeof v === 'string') : [],
      potentialChallenges: Array.isArray(raw.potentialChallenges) ? raw.potentialChallenges.filter((v: any) => typeof v === 'string') : [],
      overallScore: typeof raw.overallScore === 'number' ? Math.min(100, Math.max(0, raw.overallScore)) : 0,
    })).filter((q: GeneratedQuestion) => q.question)


    // Optionally save to database
    let savedId: string | null = null
    if (body.saveToDatabase) {
      savedId = `rq-${crypto.randomUUID()}`

      // Get user's workspace
      const workspace = await context.env.DB.prepare(`
        SELECT workspace_id FROM workspace_members WHERE user_id = ? LIMIT 1
      `).bind(userId).first()

      if (!workspace) {
        return new Response(JSON.stringify({
          error: 'No workspace found for user'
        }), {
          status: 400,
          headers: JSON_HEADERS
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
        userId,
        workspace.workspace_id,
        body.topic,
        JSON.stringify(body.purpose),
        body.projectType,
        JSON.stringify({ who, what, where, when, why }),
        body.duration,
        JSON.stringify(body.resources),
        body.experienceLevel,
        body.constraints || null,
        body.ethicalConsiderations || null,
        JSON.stringify(generatedQuestions),
        'draft'
      ).run()

    }

    return new Response(JSON.stringify({
      success: true,
      id: savedId,
      questions: generatedQuestions,
      summary: {
        topic: body.topic,
        who: who.population,
        what: what.variables,
        where: where.location,
        when: when.timePeriod,
        why: why.importance
      }
    }), {
      headers: JSON_HEADERS
    })
  } catch (error) {
    if (error instanceof Response) return error
    console.error('[generate-question] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to generate research questions'

    }), {
      status: 500,
      headers: JSON_HEADERS
    })
  }
}

// Reject GET requests (POST-only endpoint)
export const onRequestGet: PagesFunction = async () => {
  return new Response(JSON.stringify({ error: 'Method not allowed. Use POST.' }), {
    status: 405, headers: JSON_HEADERS,
  })
}

// CORS preflight
export const onRequestOptions: PagesFunction = async () => {
  return optionsResponse()
}
