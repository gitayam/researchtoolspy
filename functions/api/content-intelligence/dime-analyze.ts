/**
 * DIME Framework Analysis for Content Intelligence
 *
 * Analyzes content through DIME framework (Diplomatic, Information, Military, Economic)
 * Generates questions and answers for each DIME dimension
 */

import { getUserFromRequest } from '../_shared/auth-helpers'
import { callOpenAIViaGateway, getOptimalCacheTTL, ANALYST_SYSTEM_PREFIX, REFUSAL_BODY } from '../_shared/ai-gateway'
import { JSON_HEADERS } from '../_shared/api-utils'

interface Env {
  DB: D1Database
  OPENAI_API_KEY: string
  AI_GATEWAY_ACCOUNT_ID?: string
  SESSIONS?: KVNamespace
  RATE_LIMIT?: KVNamespace
}

interface DIMEAnalysisRequest {
  analysis_id?: string | number // Optional reference to a persisted content_analysis record
  content_text?: string // The extracted content text
  title?: string
  url?: string
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    // DIME generation is available for ephemeral public analyses. Authentication
    // is required only when writing the result back to a saved analysis.
    const userId = await getUserFromRequest(context.request, context.env)
    let body: DIMEAnalysisRequest
    try {
      body = await context.request.json() as DIMEAnalysisRequest
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid request body' }), {
        status: 400,
        headers: JSON_HEADERS,
      })
    }

    const submittedContent = typeof body.content_text === 'string' ? body.content_text : ''
    if (submittedContent.length > 100_000) {
      return new Response(JSON.stringify({ error: 'content_text exceeds the 100,000 character limit' }), {
        status: 413,
        headers: JSON_HEADERS,
      })
    }
    const contentText = submittedContent.trim()

    if (!contentText) {
      return new Response(JSON.stringify({
        error: 'Missing required field: content_text'
      }), {
        status: 400,
        headers: JSON_HEADERS
      })
    }

    let persistedAnalysisId: string | number | null = null
    if (body.analysis_id !== undefined && body.analysis_id !== null && body.analysis_id !== '') {
      if (!userId) {
        return new Response(JSON.stringify({
          error: 'Authentication required to update a saved analysis'
        }), {
          status: 401,
          headers: JSON_HEADERS,
        })
      }

      // Never let a caller attach framework output to another user's analysis.
      const ownedAnalysis = await context.env.DB.prepare(`
        SELECT id FROM content_analysis WHERE id = ? AND user_id = ?
      `).bind(body.analysis_id, userId).first<{ id: string | number }>()
      if (!ownedAnalysis) {
        return new Response(JSON.stringify({ error: 'Analysis not found' }), {
          status: 404,
          headers: JSON_HEADERS,
        })
      }
      persistedAnalysisId = ownedAnalysis.id
    }


    // Generate DIME analysis using GPT
    const dimePrompt = `Analyze the following content through the DIME framework (Diplomatic, Information, Military, Economic).
For each dimension, generate 3-5 relevant questions and provide answers based on the content.

Content Title: ${body.title || 'Untitled'}
Content URL: ${body.url || 'Not provided'}

Content:
${contentText.substring(0, 6000)} ${contentText.length > 6000 ? '...(truncated)' : ''}

CRITICAL ANSWER REQUIREMENTS:
1. Answers must be SELF-CONTAINED and understandable without additional context
2. DO NOT use pronouns (it, they, them, this, these, that, those) without immediately clarifying what they refer to
3. Use SPECIFIC names, organizations, locations, dates, and numbers instead of vague references
4. Each answer should explicitly state the subject (e.g., "The United States government" instead of "It")
5. Answers must be OBJECTIVE and fact-based, containing the actual information from the content
6. Include specific details: names of people, organizations, places, dates, amounts

GOOD answer example: "The United States Department of Defense announced on March 15, 2024 that it would increase military spending by $20 billion to counter threats in the Indo-Pacific region."

BAD answer example: "It announced that they would increase spending to counter threats in the region."

Generate a JSON response with this structure:
{
  "diplomatic": [
    {"question": "What diplomatic implications...", "answer": "Based on the content..."},
    ...
  ],
  "information": [
    {"question": "What information warfare aspects...", "answer": "The content reveals..."},
    ...
  ],
  "military": [
    {"question": "What military considerations...", "answer": "From a military perspective..."},
    ...
  ],
  "economic": [
    {"question": "What economic factors...", "answer": "Economically, the content..."},
    ...
  ],
  "summary": "A brief 2-3 sentence summary of key DIME insights from this content"
}

Focus on aspects that are actually present in the content. If a dimension has no relevant information, include 1-2 questions about why it might be absent or what related aspects to consider.`

    const gptData = await callOpenAIViaGateway(context.env, {
      model: 'gpt-5.4-mini',
      messages: [
        {
          role: 'system',
          content: ANALYST_SYSTEM_PREFIX + 'You are a strategic analyst expert in DIME framework analysis. Provide thoughtful, evidence-based analysis.'
        },
        {
          role: 'user',
          content: dimePrompt
        }
      ],
      reasoning_effort: 'none',
      temperature: 0.7,
      max_completion_tokens: 2000,
      response_format: { type: 'json_object' }
    }, {
      cacheTTL: getOptimalCacheTTL('dime-analysis'),
      metadata: {
        endpoint: 'content-intelligence',
        operation: 'dime-analysis',
        analysis_id: persistedAnalysisId === null ? undefined : String(persistedAnalysisId),
        persistence: persistedAnalysisId === null ? 'ephemeral' : 'saved',
        user_id: userId === null ? undefined : String(userId),
      },
      timeout: 20000
    })

    if (gptData?._refusal) {
      return new Response(JSON.stringify(REFUSAL_BODY), { status: 200, headers: JSON_HEADERS })
    }

    const dimeAnalysis = JSON.parse(gptData.choices[0].message.content)

    if (persistedAnalysisId !== null) {
      await context.env.DB.prepare(`
        UPDATE content_analysis
        SET dime_analysis = ?,
            updated_at = datetime('now')
        WHERE id = ? AND user_id = ?
      `).bind(
        JSON.stringify(dimeAnalysis),
        persistedAnalysisId,
        userId
      ).run()
    }


    return new Response(JSON.stringify({
      success: true,
      dime_analysis: dimeAnalysis,
      analysis_id: persistedAnalysisId,
      is_persisted: persistedAnalysisId !== null,
    }), {
      status: 200,
      headers: JSON_HEADERS
    })

  } catch (error) {
    console.error('[DIME] Error:', error)
    return new Response(JSON.stringify({
      error: 'DIME analysis failed'

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
