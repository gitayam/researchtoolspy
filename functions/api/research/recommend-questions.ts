/**
 * Research Question Recommendations API
 * POST /api/research/recommend-questions
 *
 * Quick-generate research questions from a topic description.
 * Lighter than /generate-question — no 5 W's required.
 * Optionally accepts research context for tailored output.
 */

import { requireAuth } from '../_shared/auth-helpers'
import { callOpenAIViaGateway } from '../_shared/ai-gateway'
import { JSON_HEADERS, optionsResponse } from '../_shared/api-utils'

interface Env {
  DB: D1Database
  OPENAI_API_KEY: string
  AI_GATEWAY_ACCOUNT_ID?: string
}

interface RecommendQuestionsRequest {
  topic: string
  context?: 'academic' | 'osint' | 'investigation' | 'business' | 'journalism' | 'personal'
  count?: number // Default 3
}

interface CriterionAssessment {
  passed: boolean
  explanation: string
}

interface GeneratedQuestion {
  question: string
  smartAssessment: Record<string, CriterionAssessment>
  finerAssessment: Record<string, CriterionAssessment>
  nullHypothesis: string
  alternativeHypothesis: string
  keyVariables: string[]
  dataCollectionMethods: string[]
  potentialChallenges: string[]
  overallScore: number
}

function getContextHint(context?: string): string {
  switch (context) {
    case 'osint': return '\nThe researcher works in Open Source Intelligence (OSINT). Emphasize source verification, digital footprint analysis, and attribution methodology.'
    case 'investigation': return '\nThe researcher works in private investigation. Emphasize legal compliance, evidence chain of custody, and confidentiality.'
    case 'business': return '\nThe researcher works in business/market research. Emphasize ROI, stakeholder analysis, and actionable recommendations.'
    case 'journalism': return '\nThe researcher works in investigative journalism. Emphasize source protection, fact verification, and public interest.'
    case 'personal': return '\nThis is personal/hobby research. Emphasize flexible timelines, free tools, and learning goals.'
    case 'academic': return '\nThis is academic research. Emphasize methodological rigor, IRB compliance, and peer review standards.'
    default: return ''
  }
}

// Validate a single question object from AI response
function validateQuestion(raw: any): GeneratedQuestion {
  return {
    question: typeof raw.question === 'string' ? raw.question : '',
    smartAssessment: raw.smartAssessment && typeof raw.smartAssessment === 'object' ? raw.smartAssessment : {},
    finerAssessment: raw.finerAssessment && typeof raw.finerAssessment === 'object' ? raw.finerAssessment : {},
    nullHypothesis: typeof raw.nullHypothesis === 'string' ? raw.nullHypothesis : '',
    alternativeHypothesis: typeof raw.alternativeHypothesis === 'string' ? raw.alternativeHypothesis : '',
    keyVariables: Array.isArray(raw.keyVariables) ? raw.keyVariables.filter((v: any) => typeof v === 'string') : [],
    dataCollectionMethods: Array.isArray(raw.dataCollectionMethods) ? raw.dataCollectionMethods.filter((v: any) => typeof v === 'string') : [],
    potentialChallenges: Array.isArray(raw.potentialChallenges) ? raw.potentialChallenges.filter((v: any) => typeof v === 'string') : [],
    overallScore: typeof raw.overallScore === 'number' ? Math.min(100, Math.max(0, raw.overallScore)) : 0,
  }
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const userId = await requireAuth(context.request, context.env)

    const body = await context.request.json() as RecommendQuestionsRequest

    if (!body.topic || !body.topic.trim()) {
      return new Response(JSON.stringify({ error: 'Topic is required' }), {
        status: 400,
        headers: JSON_HEADERS
      })
    }

    const count = Math.min(body.count || 3, 5) // Cap at 5
    const contextHint = getContextHint(body.context)

    const prompt = `You are an expert research methodologist. Based on the following topic description, generate ${count} high-quality research questions with varying scopes (broad, moderate, narrow).
${contextHint}
Topic/Area of Interest:
"${body.topic}"

For each research question, provide:
1. The research question itself (clear, focused, researchable)
2. SMART criteria assessment (Specific, Measurable, Achievable, Relevant, Time-bound)
3. FINER criteria assessment (Feasible, Interesting, Novel, Ethical, Relevant)
4. Null hypothesis (H₀)
5. Alternative hypothesis (H₁)
6. Key variables (3-5 main variables to study)
7. Data collection methods (2-4 appropriate methods)
8. Potential challenges (2-3 main challenges)
9. Overall quality score (0-100 based on SMART + FINER criteria)

Requirements:
- Questions should range from broad exploratory to narrow focused
- Ensure questions are feasible and ethical
- Provide specific, actionable assessments

Return the response as a JSON object with a "questions" array:
{
  "questions": [
    {
      "question": "Research question text",
      "smartAssessment": {
        "specific": { "passed": true, "explanation": "explanation" },
        "measurable": { "passed": true, "explanation": "explanation" },
        "achievable": { "passed": true, "explanation": "explanation" },
        "relevant": { "passed": true, "explanation": "explanation" },
        "timeBound": { "passed": true, "explanation": "explanation" }
      },
      "finerAssessment": {
        "feasible": { "passed": true, "explanation": "explanation" },
        "interesting": { "passed": true, "explanation": "explanation" },
        "novel": { "passed": true, "explanation": "explanation" },
        "ethical": { "passed": true, "explanation": "explanation" },
        "relevant": { "passed": true, "explanation": "explanation" }
      },
      "nullHypothesis": "H₀ statement",
      "alternativeHypothesis": "H₁ statement",
      "keyVariables": ["variable1", "variable2", "variable3"],
      "dataCollectionMethods": ["method1", "method2"],
      "potentialChallenges": ["challenge1", "challenge2"],
      "overallScore": 85
    }
  ]
}`

    const response = await callOpenAIViaGateway(
      context.env,
      {
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert research methodologist specializing in formulating high-quality research questions. You provide detailed assessments based on SMART and FINER criteria.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_completion_tokens: 3000,
        response_format: { type: 'json_object' }
      },
      {
        cacheTTL: 1800, // 30 min cache — topic-based recommendations benefit from caching
        metadata: { endpoint: 'recommend-questions', userId },
        timeout: 30000
      }
    )

    if (!response?.choices?.[0]?.message?.content) {
      throw new Error('No content in AI response')
    }

    let content = response.choices[0].message.content.trim()
    if (content.startsWith('```')) {
      content = content.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '')
    }

    const parsed = JSON.parse(content)
    const questions: GeneratedQuestion[] = (parsed.questions || [])
      .map(validateQuestion)
      .filter((q: GeneratedQuestion) => q.question) // Drop any with empty question text

    if (questions.length === 0) {
      throw new Error('No valid questions generated')
    }

    return new Response(JSON.stringify({ questions, count: questions.length }), {
      headers: JSON_HEADERS
    })
  } catch (error) {
    if (error instanceof Response) return error
    console.error('[recommend-questions] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to generate research question recommendations'
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
