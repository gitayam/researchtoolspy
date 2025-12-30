/**
 * Generate More Starbursting Questions API
 * POST /api/content-intelligence/starbursting/:id/generate-questions
 * Generates additional questions based on existing Q&A context
 */

import { getUserIdOrDefault } from '../../../_shared/auth-helpers'
import { callOpenAIViaGateway, getOptimalCacheTTL } from '../../../_shared/ai-gateway'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
  OPENAI_API_KEY: string
  AI_GATEWAY_ACCOUNT_ID?: string
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  }

  try {
    const userId = await getUserIdOrDefault(context.request, context.env)
    const sessionId = context.params.id as string

    console.log('[Generate More Questions] Request for session:', sessionId, 'by user:', userId)

    if (!sessionId) {
      return new Response(JSON.stringify({
        error: 'session_id is required'
      }), {
        status: 400,
        headers: corsHeaders
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
        headers: corsHeaders
      })
    }

    // Verify ownership
    if (session.user_id !== userId) {
      return new Response(JSON.stringify({
        error: 'Unauthorized'
      }), {
        status: 403,
        headers: corsHeaders
      })
    }

    // Parse existing data
    const existingData = JSON.parse(session.data as string || '{}')
    console.log('[Generate More Questions] Existing questions:', {
      hasWho: !!existingData.who,
      hasWhat: !!existingData.what,
      hasWhere: !!existingData.where,
      hasWhen: !!existingData.when,
      hasWhy: !!existingData.why,
      hasHow: !!existingData.how,
      totalQuestions: (existingData.who?.length || 0) + (existingData.what?.length || 0) +
                      (existingData.where?.length || 0) + (existingData.when?.length || 0) +
                      (existingData.why?.length || 0) + (existingData.how?.length || 0)
    })

    // Get content analysis to extract more context
    const contentAnalysisId = existingData.content_analysis_id || existingData.analysis_ids?.[0]
    if (!contentAnalysisId) {
      return new Response(JSON.stringify({
        error: 'No content analysis linked to this session'
      }), {
        status: 400,
        headers: corsHeaders
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
        headers: corsHeaders
      })
    }

    const fullText = (analysis.extracted_text as string || '').substring(0, 8000)
    const summary = analysis.summary as string || ''
    const entities = JSON.parse(analysis.entities as string || '{}')
    const title = analysis.title as string || session.title

    console.log('[Generate More Questions] Content context:', {
      hasText: !!fullText,
      textLength: fullText.length,
      hasEntities: !!entities,
      peopleCount: entities.people?.length || 0,
      orgsCount: entities.organizations?.length || 0,
      locationsCount: entities.locations?.length || 0
    })

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

    console.log('[Generate More Questions] Success - added questions:', {
      newWho: newQuestions.who?.length || 0,
      newWhat: newQuestions.what?.length || 0,
      newWhere: newQuestions.where?.length || 0,
      newWhen: newQuestions.when?.length || 0,
      newWhy: newQuestions.why?.length || 0,
      newHow: newQuestions.how?.length || 0
    })

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
      headers: corsHeaders
    })

  } catch (error) {
    console.error('[Generate More Questions] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to generate more questions',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: corsHeaders
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

  const prompt = `Generate additional 5W1H Starbursting questions for deeper investigation.

Article Title: ${title}
Summary: ${summary}

Extracted Text Context (first 2000 chars):
${fullText.substring(0, 2000)}

Entities:
- People: ${entities.people?.map((p: any) => p.name).join(', ') || 'None'}
- Organizations: ${entities.organizations?.map((o: any) => o.name).join(', ') || 'None'}
- Locations: ${entities.locations?.map((l: any) => l.name).join(', ') || 'None'}

EXISTING QUESTIONS (DO NOT DUPLICATE):
${existingQuestionsContext}

INSTRUCTIONS:
1. Generate 2-3 NEW questions for each category (Who, What, Where, When, Why, How)
2. Questions MUST be specific - reference actual names, places, dates, organizations, actions
3. DO NOT use vague terms like "this", "it", "the situation", "these events"
4. DO NOT duplicate or rephrase existing questions
5. Focus on gaps in the existing questions - what hasn't been asked yet?
6. Use the full text context to identify specific unanswered aspects
7. Try to answer questions from the text when possible, leave blank if not found
8. Mark status as 'answered' if answer found, 'pending' if not

Return ONLY valid JSON in this format:
{
  "who": [
    {
      "id": "who_new_1",
      "category": "who",
      "question": "Who is [specific person] and what specific role do they play in [specific situation]?",
      "answer": "Answer from text or empty string",
      "priority": 3,
      "source": "Text search" or "Requires investigation",
      "status": "answered" or "pending"
    }
  ],
  "what": [...],
  "where": [...],
  "when": [...],
  "why": [...],
  "how": [...]
}`

  try {
    const data = await callOpenAIViaGateway(env, {
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert investigative researcher. Generate specific, detailed 5W1H questions that avoid duplication and reference concrete nouns, entities, and actions from the text. Return ONLY valid JSON.'
        },
        { role: 'user', content: prompt }
      ],
      max_completion_tokens: 2000,
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

    return JSON.parse(jsonText)

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

// CORS preflight
export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  })
}
