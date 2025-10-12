/**
 * Research Question Recommendations API
 * POST /api/research/recommend-questions
 *
 * Generates research question recommendations based on a topic description.
 */

import { requireAuth } from '../_shared/auth-helpers'
import { callOpenAIViaGateway } from '../_shared/ai-gateway'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
  OPENAI_API_KEY: string
  AI_GATEWAY_ACCOUNT_ID?: string
}

interface RecommendQuestionsRequest {
  topic: string
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

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const userId = await requireAuth(context.request, context.env)

    const body = await context.request.json() as RecommendQuestionsRequest

    // Validate required fields
    if (!body.topic || !body.topic.trim()) {
      return new Response(JSON.stringify({
        error: 'Topic is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const count = body.count || 3

    // Build AI prompt for generating research question recommendations
    const prompt = `You are an expert research methodologist. Based on the following topic description, generate ${count} high-quality research questions with varying scopes (broad, moderate, narrow).

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
- Questions should be appropriate for academic/professional research
- Include questions with different scopes: broad exploratory, moderate analytical, narrow focused
- Ensure questions are feasible and ethical
- Questions should be relevant to current research trends
- Provide specific, actionable assessments

Return the response as a JSON array with this structure:
[
  {
    "question": "Research question text",
    "smartAssessment": {
      "specific": { "passed": true/false, "explanation": "explanation" },
      "measurable": { "passed": true/false, "explanation": "explanation" },
      "achievable": { "passed": true/false, "explanation": "explanation" },
      "relevant": { "passed": true/false, "explanation": "explanation" },
      "timeBound": { "passed": true/false, "explanation": "explanation" }
    },
    "finerAssessment": {
      "feasible": { "passed": true/false, "explanation": "explanation" },
      "interesting": { "passed": true/false, "explanation": "explanation" },
      "novel": { "passed": true/false, "explanation": "explanation" },
      "ethical": { "passed": true/false, "explanation": "explanation" },
      "relevant": { "passed": true/false, "explanation": "explanation" }
    },
    "nullHypothesis": "H₀ statement",
    "alternativeHypothesis": "H₁ statement",
    "keyVariables": ["variable1", "variable2", "variable3"],
    "dataCollectionMethods": ["method1", "method2"],
    "potentialChallenges": ["challenge1", "challenge2"],
    "overallScore": 85
  }
]`

    console.log('[recommend-questions] Calling AI Gateway for question generation')

    const aiResponse = await callOpenAIViaGateway({
      messages: [
        {
          role: 'system',
          content: 'You are an expert research methodologist specializing in formulating high-quality research questions. You provide detailed assessments based on SMART and FINER criteria.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      model: 'gpt-4o-mini',
      temperature: 0.7,
      max_tokens: 3000,
      response_format: { type: 'json_object' }
    }, context.env)

    console.log('[recommend-questions] AI Response received')

    // Parse AI response
    let questions: GeneratedQuestion[] = []
    try {
      const parsed = JSON.parse(aiResponse.content)
      questions = Array.isArray(parsed) ? parsed : (parsed.questions || [])
    } catch (error) {
      console.error('[recommend-questions] Failed to parse AI response:', error)
      // Try to extract JSON array from response
      const match = aiResponse.content.match(/\[[\s\S]*\]/)
      if (match) {
        questions = JSON.parse(match[0])
      } else {
        throw new Error('Failed to parse AI response into questions array')
      }
    }

    if (!questions || questions.length === 0) {
      throw new Error('No questions generated from AI response')
    }

    console.log(`[recommend-questions] Generated ${questions.length} questions`)

    return new Response(JSON.stringify({
      questions,
      count: questions.length
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('[recommend-questions] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to generate research question recommendations',
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
