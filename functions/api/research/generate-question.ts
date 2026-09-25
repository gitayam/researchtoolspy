/**
 * Generate Research Question API
 * POST /api/research/generate-question
 *
 * Uses AI to generate 3 high-quality research questions based on user inputs.
 * Applies SMART and FINER criteria, includes null/alternative hypotheses.
 *
 * Two callers:
 * - Users (session/JWT/hash) via requireAuth, unchanged; may opt into saving.
 * - Scoped services (`Bearer rt_svc_…`) with `community.research.execute`,
 *   gated by COMMUNITY_INTEGRATIONS_ENABLED and RESEARCH_QUESTIONS_SERVICE_ENABLED.
 *   Service requests never reach user auth, never persist, and fail with
 *   integration-error.v1 documents.
 */

import { requireAuth } from '../_shared/auth-helpers'
import { callOpenAIViaGateway } from '../_shared/ai-gateway'
import { CORS_HEADERS, JSON_HEADERS, optionsResponse } from '../_shared/api-utils'
import {
  buildIntegrationErrorDocument,
  readIntegrationCorrelationId,
  type IntegrationErrorCode,
} from '../_shared/integration-contract'
import {
  getIntegrationPrincipalFromRequest,
  IntegrationAuthError,
  isReservedIntegrationAuthorization,
  type IntegrationAuthEnv,
} from '../_shared/service-auth'

interface Env extends IntegrationAuthEnv {
  DB: D1Database
  SESSIONS?: KVNamespace
  OPENAI_API_KEY: string
  AI_GATEWAY_ACCOUNT_ID?: string
  COMMUNITY_INTEGRATIONS_ENABLED?: string
  RESEARCH_QUESTIONS_SERVICE_ENABLED?: string
}

/** Service bodies are bounded before parsing; every field feeds the prompt. */
const MAX_SERVICE_REQUEST_BYTES = 16 * 1024
const MAX_SERVICE_TOPIC_CHARS = 2000

type Caller =
  | { kind: 'user'; userId: number }
  | { kind: 'service'; clientId: string }

function serviceErrorResponse(options: {
  requestId: string
  correlationId?: string
  code: IntegrationErrorCode
  message: string
  retryable: boolean
  status: number
}): Response {
  return new Response(JSON.stringify(buildIntegrationErrorDocument(options)), {
    status: options.status,
    headers: {
      ...JSON_HEADERS,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...(options.status === 503 ? { 'Retry-After': '2' } : {}),
    },
  })
}

async function authorizeServiceCaller(
  request: Request,
  env: Env,
  requestId: string,
  correlationId?: string,
): Promise<Caller | Response> {
  try {
    const principal = await getIntegrationPrincipalFromRequest(request, env)
    if (!principal) {
      return serviceErrorResponse({
        requestId, correlationId, code: 'authentication_required',
        message: 'A ResearchTools service credential is required.', retryable: false, status: 401,
      })
    }
    if (
      env.COMMUNITY_INTEGRATIONS_ENABLED !== 'true'
      || env.RESEARCH_QUESTIONS_SERVICE_ENABLED !== 'true'
      || !principal.scopes.includes('community.research.execute')
    ) {
      return serviceErrorResponse({
        requestId, correlationId, code: 'scope_denied',
        message: 'Research question generation is not enabled for this service credential.',
        retryable: false, status: 403,
      })
    }
    return { kind: 'service', clientId: principal.clientId }
  } catch (error) {
    if (error instanceof IntegrationAuthError) {
      return serviceErrorResponse({
        requestId, correlationId, code: error.code, message: error.message,
        retryable: error.retryable, status: error.status,
      })
    }
    return serviceErrorResponse({
      requestId, correlationId, code: 'internal_error',
      message: 'Research question authentication failed.', retryable: true, status: 500,
    })
  }
}

/** Parse and validate a service body; returns an error message on rejection. */
async function readServiceBody(request: Request): Promise<GenerateQuestionRequest | string> {
  const declared = request.headers.get('Content-Length')
  if (declared && /^\d+$/.test(declared) && Number(declared) > MAX_SERVICE_REQUEST_BYTES) {
    return 'The request body exceeds 16 KiB.'
  }
  const text = await request.text()
  if (new TextEncoder().encode(text).byteLength > MAX_SERVICE_REQUEST_BYTES) {
    return 'The request body exceeds 16 KiB.'
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return 'The request body must be valid JSON.'
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return 'The request body must be a JSON object.'
  }
  const body = parsed as GenerateQuestionRequest
  if (typeof body.topic !== 'string' || !body.topic.trim()) return 'topic is required.'
  if (body.topic.length > MAX_SERVICE_TOPIC_CHARS) {
    return `topic must be at most ${MAX_SERVICE_TOPIC_CHARS} characters.`
  }
  if (body.saveToDatabase === true) return 'Service callers cannot persist research questions.'
  return body
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
  const requestId = `req-${crypto.randomUUID()}`
  const correlationId = readIntegrationCorrelationId(context.request)
  const serviceRequest = isReservedIntegrationAuthorization(context.request)

  try {
    let caller: Caller
    let body: GenerateQuestionRequest
    if (serviceRequest) {
      const authorized = await authorizeServiceCaller(context.request, context.env, requestId, correlationId)
      if (authorized instanceof Response) return authorized
      caller = authorized
      const parsed = await readServiceBody(context.request)
      if (typeof parsed === 'string') {
        return serviceErrorResponse({
          requestId, correlationId, code: 'invalid_request', message: parsed, retryable: false,
          status: parsed.includes('16 KiB') ? 413 : 400,
        })
      }
      body = parsed
    } else {
      caller = { kind: 'user', userId: await requireAuth(context.request, context.env) }
      body = await context.request.json() as GenerateQuestionRequest
    }
    const userId = caller.kind === 'user' ? caller.userId : null

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
          tier: 'cheap',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          reasoning_effort: 'none',
          temperature: 0.7,
          max_completion_tokens: 3000,
          response_format: { type: 'json_object' }
        },
        {
          // Optional metadata for logging/tracking
          metadata: {
            endpoint: 'generate-question',
            userId: userId,
            // The gateway's per-caller limiter keys on user_id; bind services to it.
            ...(caller.kind === 'service' ? { user_id: `service:${caller.clientId}` } : {}),
          }
        }
      )
    } catch (aiError) {
      console.error('[generate-question] AI Gateway Error:', aiError)
      if (aiError instanceof Error && aiError.name === 'RateLimitError') throw aiError
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


    // Optionally save to database. Best-effort: a save failure must NEVER block
    // question generation (the primary purpose of this endpoint), so the whole
    // block is wrapped in try/catch and returns the questions regardless.
    let savedId: string | null = null
    if (body.saveToDatabase && userId !== null) {
      try {
        // Get OR create the user's workspace. Guest/hash users are provisioned
        // in `users` (auth-helpers.resolveHashUser) but have no workspace_members
        // row until they explicitly create a workspace — ~90% of users in prod.
        // Hard-failing here returned a 400 ("No workspace found for user") that
        // surfaced to the user as "Failed to generate questions". Auto-provision
        // a personal workspace instead, mirroring functions/api/investigations/index.ts.
        const workspace = await context.env.DB.prepare(`
          SELECT workspace_id FROM workspace_members WHERE user_id = ? LIMIT 1
        `).bind(userId).first<{ workspace_id: string }>()

        let workspaceId: string
        if (workspace) {
          workspaceId = workspace.workspace_id
        } else {
          workspaceId = crypto.randomUUID()
          const user = await context.env.DB.prepare(
            `SELECT username FROM users WHERE id = ?`
          ).bind(userId).first<{ username: string }>()
          const workspaceName = user?.username
            ? `${user.username}'s Workspace`
            : `Workspace ${workspaceId.slice(0, 8)}`

          await context.env.DB.prepare(`
            INSERT INTO workspaces (id, name, description, type, owner_id, is_public, created_at, updated_at)
            VALUES (?, ?, ?, 'PERSONAL', ?, 0, datetime('now'), datetime('now'))
          `).bind(workspaceId, workspaceName, 'Personal workspace', userId).run()

          await context.env.DB.prepare(`
            INSERT INTO workspace_members (id, workspace_id, user_id, role, joined_at)
            VALUES (?, ?, ?, 'ADMIN', datetime('now'))
          `).bind(crypto.randomUUID(), workspaceId, userId).run()
        }

        savedId = `rq-${crypto.randomUUID()}`
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
          workspaceId,
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
      } catch (saveError) {
        // Log for prod visibility but still return the generated questions.
        console.error('[generate-question] Failed to save to database:', saveError)
        savedId = null
      }
    }

    return new Response(JSON.stringify({
      success: true,
      id: savedId,
      researchQuestionId: savedId, // frontend reads data.researchQuestionId
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
      headers: serviceRequest
        ? { ...JSON_HEADERS, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
        : JSON_HEADERS
    })
  } catch (error) {
    if (error instanceof Response) return error
    console.error('[generate-question] Error:', error)
    if (serviceRequest) {
      const rateLimited = error instanceof Error && error.name === 'RateLimitError'
      return serviceErrorResponse({
        requestId, correlationId, code: 'internal_error',
        message: rateLimited
          ? 'Research question generation is rate limited; retry later.'
          : 'Failed to generate research questions.',
        retryable: true, status: rateLimited ? 503 : 500,
      })
    }
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
