/**
 * Survey AI Summarization
 *
 * POST /api/surveys/:id/summarize
 *
 * Fetches the last N responses, sends to GPT for structured summary.
 * Returns: { summary, key_themes, geographic_patterns, contradictions, recommended_actions }
 */
import { getUserFromRequest } from '../../_shared/auth-helpers'
import { callOpenAIViaGateway } from '../../_shared/ai-gateway'
import { JSON_HEADERS } from '../../_shared/api-utils'

interface Env {
  DB: D1Database
  OPENAI_API_KEY: string
  AI_GATEWAY_ACCOUNT_ID?: string
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const surveyId = params.id as string
  const userId = await getUserFromRequest(request, env)
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), {
      status: 401, headers: JSON_HEADERS,
    })
  }

  try {
    // Verify ownership
    const survey = await env.DB.prepare(
      'SELECT id, title, description FROM survey_drops WHERE id = ? AND created_by = ?'
    ).bind(surveyId, userId).first<{ id: string; title: string; description: string | null }>()

    if (!survey) {
      return new Response(JSON.stringify({ error: 'Survey not found' }), {
        status: 404, headers: JSON_HEADERS,
      })
    }

    // Get request params
    const body = await request.json() as { limit?: number }
    const limit = Math.min(body.limit || 50, 100)

    // Fetch responses
    const responses = await env.DB.prepare(
      `SELECT form_data, submitter_country, lat, lon, created_at
       FROM survey_responses WHERE survey_id = ? AND status IN ('pending', 'accepted')
       ORDER BY created_at DESC LIMIT ?`
    ).bind(surveyId, limit).all()

    if (!responses.results || responses.results.length === 0) {
      return new Response(JSON.stringify({ error: 'No responses to summarize' }), {
        status: 400, headers: JSON_HEADERS,
      })
    }

    // Format responses for GPT
    const formattedResponses = responses.results.map((r: any, i: number) => {
      let data: Record<string, unknown> = {}
      try { data = JSON.parse(r.form_data) } catch { /* */ }

      // Strip enrichment metadata and internal fields
      const cleanData = Object.fromEntries(
        Object.entries(data).filter(([k]) => !k.startsWith('_'))
      )

      return `Response #${i + 1} (${r.submitter_country || 'unknown country'}, ${r.created_at}):\n${
        Object.entries(cleanData).map(([k, v]) => `  ${k}: ${v}`).join('\n')
      }`
    }).join('\n\n')

    // Truncate to ~12k chars to stay within token limits (gpt-5.4-mini context)
    const maxPromptChars = 12000
    const truncatedResponses = formattedResponses.length > maxPromptChars
      ? formattedResponses.substring(0, maxPromptChars) + `\n\n[... truncated, showing ${Math.round(maxPromptChars / formattedResponses.length * 100)}% of ${responses.results.length} responses]`
      : formattedResponses

    // Call GPT
    const systemPrompt = `You are an open source research analyst reviewing crowdsourced submissions to a data collection survey titled "${survey.title}".

Survey context: ${survey.description || 'No description provided.'}

Analyze the submissions below and provide a structured analysis. Be concise and actionable. Focus on patterns, contradictions, and gaps in the data.`

    const userPrompt = `Here are the ${responses.results.length} most recent submissions:\n\n${truncatedResponses}\n\nProvide your analysis as JSON with these fields:
{
  "summary": "2-3 sentence overview of what the submissions collectively tell us",
  "key_themes": ["theme 1", "theme 2", ...],
  "geographic_patterns": ["pattern 1", ...],
  "contradictions": ["contradiction 1", ...],
  "source_assessment": "assessment of source diversity and credibility",
  "gaps": ["what information is missing", ...],
  "recommended_actions": ["action 1", ...],
  "timeline_summary": "chronological summary if timestamps are present"
}`

    const gptResponse = await callOpenAIViaGateway(env, {
      model: 'gpt-5.4-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_completion_tokens: 1500,
      response_format: { type: 'json_object' },
    })

    // Parse and validate each field individually (never spread raw LLM output)
    const raw = gptResponse?.choices?.[0]?.message?.content
    if (!raw) {
      return new Response(JSON.stringify({ error: 'AI analysis returned empty' }), {
        status: 500, headers: JSON_HEADERS,
      })
    }

    let parsed: any = {}
    try {
      // Strip markdown fences if present
      const cleaned = raw.replace(/^```json\s*/i, '').replace(/\s*```$/i, '')
      parsed = JSON.parse(cleaned)
    } catch {
      return new Response(JSON.stringify({ error: 'AI returned invalid JSON', raw_preview: raw.substring(0, 200) }), {
        status: 500, headers: JSON_HEADERS,
      })
    }

    // Validate field-by-field (per project convention: never spread raw LLM)
    const result = {
      summary: typeof parsed.summary === 'string' ? parsed.summary : 'Analysis unavailable',
      key_themes: Array.isArray(parsed.key_themes) ? parsed.key_themes.filter((t: unknown) => typeof t === 'string') : [],
      geographic_patterns: Array.isArray(parsed.geographic_patterns) ? parsed.geographic_patterns.filter((t: unknown) => typeof t === 'string') : [],
      contradictions: Array.isArray(parsed.contradictions) ? parsed.contradictions.filter((t: unknown) => typeof t === 'string') : [],
      source_assessment: typeof parsed.source_assessment === 'string' ? parsed.source_assessment : null,
      gaps: Array.isArray(parsed.gaps) ? parsed.gaps.filter((t: unknown) => typeof t === 'string') : [],
      recommended_actions: Array.isArray(parsed.recommended_actions) ? parsed.recommended_actions.filter((t: unknown) => typeof t === 'string') : [],
      timeline_summary: typeof parsed.timeline_summary === 'string' ? parsed.timeline_summary : null,
      responses_analyzed: responses.results.length,
      analyzed_at: new Date().toISOString(),
    }

    return new Response(JSON.stringify(result), { headers: JSON_HEADERS })
  } catch (error) {
    console.error('[Survey Summarize] Error:', error)
    return new Response(JSON.stringify({ error: 'Summarization failed' }), {
      status: 500, headers: JSON_HEADERS,
    })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: JSON_HEADERS })
}
