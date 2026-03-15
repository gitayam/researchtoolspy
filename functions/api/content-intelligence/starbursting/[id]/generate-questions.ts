/**
 * Generate More Starbursting Questions API
 * POST /api/content-intelligence/starbursting/:id/generate-questions
 * Generates additional questions based on existing Q&A context
 */

import { getUserFromRequest } from '../../../_shared/auth-helpers'
import { callOpenAIViaGateway, getOptimalCacheTTL } from '../../../_shared/ai-gateway'
import { STARBURSTING_SYSTEM_PROMPT, STARBURSTING_JSON_SCHEMA } from '../schema'
import { JSON_HEADERS, optionsResponse } from '../../../_shared/api-utils'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
  OPENAI_API_KEY: string
  AI_GATEWAY_ACCOUNT_ID?: string
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const userId = await getUserFromRequest(context.request, context.env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: JSON_HEADERS,
      })
    }
    const sessionId = context.params.id as string


    if (!sessionId) {
      return new Response(JSON.stringify({
        error: 'session_id is required'
      }), {
        status: 400,
        headers: JSON_HEADERS
      })
    }

    // Get existing framework session
    const session = await context.env.DB.prepare(`
      SELECT id, user_id, title, data, framework_type
      FROM framework_sessions
      WHERE id = ?
    `).bind(sessionId).first()

    if (!session) {
      return new Response(JSON.stringify({
        error: 'Framework session not found'
      }), {
        status: 404,
        headers: JSON_HEADERS
      })
    }

    // Verify ownership
    if (session.user_id !== userId) {
      return new Response(JSON.stringify({
        error: 'Unauthorized'
      }), {
        status: 403,
        headers: JSON_HEADERS
      })
    }

    // Parse existing data
    const existingData = JSON.parse(session.data as string || '{}')

    // Get content analysis to extract more context
    const contentAnalysisId = existingData.content_analysis_id || existingData.analysis_ids?.[0]
    if (!contentAnalysisId) {
      return new Response(JSON.stringify({
        error: 'No content analysis linked to this session'
      }), {
        status: 400,
        headers: JSON_HEADERS
      })
    }

    const analysis = await context.env.DB.prepare(`
      SELECT extracted_text, summary, entities, title
      FROM content_analysis
      WHERE id = ?
    `).bind(contentAnalysisId).first()

    if (!analysis) {
      return new Response(JSON.stringify({
        error: 'Content analysis not found'
      }), {
        status: 404,
        headers: JSON_HEADERS
      })
    }

    const fullText = (analysis.extracted_text as string || '').substring(0, 8000)
    const summary = analysis.summary as string || ''
    const entities = JSON.parse(analysis.entities as string || '{}')
    const title = analysis.title as string || session.title

    // Generate new questions using AI
    const newQuestions = await generateAdditionalQuestions(
      existingData,
      fullText,
      summary,
      entities,
      title,
      context.env
    )

    // Merge new questions with existing ones
    const mergedData = {
      ...existingData,
      who: [...(existingData.who || []), ...(newQuestions.who || [])],
      what: [...(existingData.what || []), ...(newQuestions.what || [])],
      where: [...(existingData.where || []), ...(newQuestions.where || [])],
      when: [...(existingData.when || []), ...(newQuestions.when || [])],
      why: [...(existingData.why || []), ...(newQuestions.why || [])],
      how: [...(existingData.how || []), ...(newQuestions.how || [])]
    }

    // Update database
    await context.env.DB.prepare(`
      UPDATE framework_sessions
      SET data = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(JSON.stringify(mergedData), sessionId).run()

    return new Response(JSON.stringify({
      success: true,
      session_id: sessionId,
      framework_data: {
        id: sessionId,
        title: session.title,
        framework_type: 'starbursting',
        data: mergedData
      },
      new_questions_count: (newQuestions.who?.length || 0) + (newQuestions.what?.length || 0) +
                          (newQuestions.where?.length || 0) + (newQuestions.when?.length || 0) +
                          (newQuestions.why?.length || 0) + (newQuestions.how?.length || 0)
    }), {
      headers: JSON_HEADERS
    })

  } catch (error) {
    console.error('[Generate More Questions] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to generate more questions'

    }), {
      status: 500,
      headers: JSON_HEADERS
    })
  }
}

/**
 * Generate additional questions using AI
 */
async function generateAdditionalQuestions(
  existingData: any,
  fullText: string,
  summary: string,
  entities: any,
  title: string,
  env: Env
): Promise<any> {
  // Build context of existing questions
  const existingQuestionsContext = buildExistingQuestionsContext(existingData)

  const prompt = `
Article Title: ${title}
Summary: ${summary}

Extracted Text Context (first 2500 chars):
${fullText.substring(0, 2500)}

EXISTING QUESTIONS (DO NOT DUPLICATE):
${existingQuestionsContext}

GENERATE NEW QUESTIONS:
Generate 2-3 NEW, DEEP-DIVE questions for each category (Who, What, Where, When, Why, How) using the defined Ontology.
Focus on gaps in the existing analysis.
Return ONLY valid JSON matching the schema below:
${STARBURSTING_JSON_SCHEMA}
`

  try {
    const data = await callOpenAIViaGateway(env, {
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: STARBURSTING_SYSTEM_PROMPT
        },
        { role: 'user', content: prompt }
      ],
      max_completion_tokens: 2500,
      temperature: 0.7
    }, {
      cacheTTL: getOptimalCacheTTL('starbursting-questions'),
      metadata: {
        endpoint: 'starbursting-generate-more',
        operation: 'generate-questions'
      },
      timeout: 30000
    })

    if (!data.choices?.[0]?.message?.content) {
      throw new Error('Invalid API response')
    }

    const jsonText = data.choices[0].message.content
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()

    const parsed = JSON.parse(jsonText)
    const result: any = { who: [], what: [], where: [], when: [], why: [], how: [] }

    // Post-process to add metadata and IDs
    for (const cat of Object.keys(result)) {
      if (parsed[cat] && Array.isArray(parsed[cat])) {
        result[cat] = parsed[cat].map((q: any, index: number) => ({
          ...q,
          id: `${cat}_new_${Date.now()}_${index}`,
          category: cat,
          priority: 3,
          source: 'AI Extracted',
          status: q.answer ? 'answered' : 'pending',
          // Ensure extracted_entities is present
          extracted_entities: q.extracted_entities || []
        }))
      }
    }

    return result

  } catch (error) {
    console.error('[Generate Additional Questions] AI error:', error)
    // Return empty structure on error
    return {
      who: [],
      what: [],
      where: [],
      when: [],
      why: [],
      how: []
    }
  }
}

/**
 * Build context string from existing questions
 */
function buildExistingQuestionsContext(data: any): string {
  const categories = ['who', 'what', 'where', 'when', 'why', 'how']
  const lines: string[] = []

  for (const cat of categories) {
    if (data[cat] && Array.isArray(data[cat]) && data[cat].length > 0) {
      lines.push(`\n${cat.toUpperCase()}:`)
      data[cat].forEach((q: any) => {
        lines.push(`- ${q.question}`)
      })
    }
  }

  return lines.join('\n')
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
