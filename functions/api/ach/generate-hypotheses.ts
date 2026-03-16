/**
 * ACH Hypothesis Generation API
 * POST /api/ach/generate-hypotheses
 *
 * Generates 4-6 competing hypotheses for an intelligence question
 * using ACH methodology principles.
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

interface GenerateRequest {
  question: string
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const userId = await requireAuth(context.request, context.env)

    const body = await context.request.json() as GenerateRequest

    if (!body.question || !body.question.trim()) {
      return new Response(JSON.stringify({ error: 'Question is required' }), {
        status: 400, headers: JSON_HEADERS
      })
    }

    const data = await callOpenAIViaGateway(
      context.env,
      {
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an expert intelligence analyst skilled in Analysis of Competing Hypotheses (ACH) methodology.

Generate 4-6 competing hypotheses for intelligence questions. Follow ACH principles:

1. **Mutually Exclusive**: Hypotheses should be distinct alternatives
2. **Comprehensive Coverage**: Cover the full spectrum of plausible explanations
3. **Include Contrarian Views**: At least one hypothesis should challenge conventional thinking
4. **Specific & Testable**: Each must be specific enough to evaluate with evidence
5. **Intelligence-Relevant**: Focus on intentions, capabilities, and strategic implications

Return JSON with a "hypotheses" array of strings:
{
  "hypotheses": ["hypothesis 1", "hypothesis 2", "hypothesis 3", "hypothesis 4"]
}`
          },
          {
            role: 'user',
            content: `Generate 4-6 competing hypotheses for this intelligence question:\n\n"${body.question}"`
          }
        ],
        temperature: 0.7,
        max_completion_tokens: 800,
        response_format: { type: 'json_object' }
      },
      {
        cacheTTL: 1800, // 30 min — same question likely yields similar hypotheses
        metadata: { endpoint: 'ach-generate-hypotheses', userId },
        timeout: 30000
      }
    )

    if (!data?.choices?.[0]?.message?.content) {
      throw new Error('Empty AI response')
    }

    let content = data.choices[0].message.content.trim()
    if (content.startsWith('```')) {
      content = content.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '')
    }

    const parsed = JSON.parse(content)

    // Extract hypotheses array (handle different response formats)
    let raw: any[]
    if (Array.isArray(parsed)) {
      raw = parsed
    } else if (Array.isArray(parsed.hypotheses)) {
      raw = parsed.hypotheses
    } else {
      // Try any array-valued key
      const arrayKey = Object.keys(parsed).find(k => Array.isArray(parsed[k]))
      raw = arrayKey ? parsed[arrayKey] : []
    }

    // Validate: must be strings, non-empty, 2-8 items
    const hypotheses = raw
      .filter((h: any) => typeof h === 'string' && h.trim())
      .map((h: string) => h.trim())
      .slice(0, 6) // Cap at 6

    if (hypotheses.length < 2) {
      throw new Error('AI generated fewer than 2 valid hypotheses')
    }

    return new Response(JSON.stringify({
      hypotheses,
      question: body.question,
      generated_at: new Date().toISOString(),
      model: 'gpt-4o-mini'
    }), { headers: JSON_HEADERS })
  } catch (error) {
    if (error instanceof Response) return error
    console.error('[ACH] Hypothesis generation error:', error)
    return new Response(JSON.stringify({ error: 'Failed to generate hypotheses' }), {
      status: 500, headers: JSON_HEADERS
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
