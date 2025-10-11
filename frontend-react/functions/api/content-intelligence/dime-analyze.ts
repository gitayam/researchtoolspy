/**
 * DIME Framework Analysis for Content Intelligence
 *
 * Analyzes content through DIME framework (Diplomatic, Information, Military, Economic)
 * Generates questions and answers for each DIME dimension
 */

import { getUserIdOrDefault } from '../_shared/auth-helpers'
import { callOpenAIViaGateway, getOptimalCacheTTL } from '../_shared/ai-gateway'

interface Env {
  DB: D1Database
  OPENAI_API_KEY: string
  AI_GATEWAY_ACCOUNT_ID?: string
  SESSIONS?: KVNamespace
  RATE_LIMIT?: KVNamespace
}

interface DIMEAnalysisRequest {
  analysis_id: string // Reference to content_analysis record
  content_text: string // The extracted content text
  title: string
  url: string
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const userId = await getUserIdOrDefault(context.request, context.env)
    const body = await context.request.json() as DIMEAnalysisRequest

    if (!body.analysis_id || !body.content_text) {
      return new Response(JSON.stringify({
        error: 'Missing required fields: analysis_id, content_text'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      })
    }

    console.log(`[DIME] Analyzing content for analysis_id: ${body.analysis_id}`)

    // Generate DIME analysis using GPT
    const dimePrompt = `Analyze the following content through the DIME framework (Diplomatic, Information, Military, Economic).
For each dimension, generate 3-5 relevant questions and provide answers based on the content.

Content Title: ${body.title}
Content URL: ${body.url}

Content:
${body.content_text.substring(0, 6000)} ${body.content_text.length > 6000 ? '...(truncated)' : ''}

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

    console.log('[DIME] Calling OpenAI via AI Gateway...')
    const gptData = await callOpenAIViaGateway(context.env, {
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a strategic analyst expert in DIME framework analysis. Provide thoughtful, evidence-based analysis.'
        },
        {
          role: 'user',
          content: dimePrompt
        }
      ],
      temperature: 0.7,
      max_tokens: 2000,
      response_format: { type: 'json_object' }
    }, {
      cacheTTL: getOptimalCacheTTL('dime-analysis'),
      metadata: {
        endpoint: 'content-intelligence',
        operation: 'dime-analysis',
        analysis_id: body.analysis_id
      },
      timeout: 20000
    })

    console.log('[DIME] Response received from AI Gateway')
    const dimeAnalysis = JSON.parse(gptData.choices[0].message.content)

    // Update content_analysis with DIME results
    await context.env.DB.prepare(`
      UPDATE content_analysis
      SET dime_analysis = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `).bind(
      JSON.stringify(dimeAnalysis),
      body.analysis_id
    ).run()

    console.log(`[DIME] Analysis completed for ${body.analysis_id}`)

    return new Response(JSON.stringify({
      success: true,
      dime_analysis: dimeAnalysis,
      analysis_id: body.analysis_id
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })

  } catch (error) {
    console.error('[DIME] Error:', error)
    return new Response(JSON.stringify({
      error: 'DIME analysis failed',
      details: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })
  }
}
