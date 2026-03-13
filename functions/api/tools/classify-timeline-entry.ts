/**
 * Classify a timeline entry text into category + importance using AI.
 * POST /api/tools/classify-timeline-entry
 * Body: { text: string, today?: string }
 * Returns: { category, importance, event_date_hint }
 */

import { callOpenAIViaGateway, getOptimalCacheTTL } from '../_shared/ai-gateway'

interface Env {
  OPENAI_API_KEY: string
  AI_GATEWAY_ACCOUNT_ID?: string
  AI_CONFIG: KVNamespace
  CACHE: KVNamespace
}

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash, X-Workspace-ID',
}

const VALID_CATEGORIES = ['event', 'meeting', 'communication', 'financial', 'legal', 'travel', 'publication', 'military', 'political']
const VALID_IMPORTANCE = ['low', 'normal', 'high', 'critical']

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const body = await context.request.json() as { text: string; today?: string }

    if (!body.text?.trim()) {
      return new Response(JSON.stringify({ error: 'text is required' }), {
        status: 400, headers: corsHeaders,
      })
    }

    const today = body.today || new Date().toISOString().slice(0, 10)

    const aiData = await callOpenAIViaGateway(context.env, {
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You classify intelligence timeline events. Today's date is ${today}.

Given event text, return JSON with:
- category: one of [${VALID_CATEGORIES.join(', ')}]
- importance: one of [${VALID_IMPORTANCE.join(', ')}]
- event_date_hint: ISO date (YYYY-MM-DD) if text mentions a specific date or relative date ("last Tuesday", "March 5"), otherwise null

Return ONLY valid JSON: { "category": "...", "importance": "...", "event_date_hint": "..." }`
        },
        { role: 'user', content: body.text.slice(0, 500) }
      ],
      max_completion_tokens: 100,
      temperature: 0.1,
      response_format: { type: 'json_object' }
    }, {
      cacheTTL: getOptimalCacheTTL('classification'),
      metadata: { endpoint: 'classify-timeline-entry' }
    })

    const raw = JSON.parse(aiData.choices[0].message.content)

    // Validate field-by-field — never spread raw LLM output
    const category = VALID_CATEGORIES.includes(raw.category) ? raw.category : 'event'
    const importance = VALID_IMPORTANCE.includes(raw.importance) ? raw.importance : 'normal'
    let event_date_hint: string | null = null
    if (typeof raw.event_date_hint === 'string' && !isNaN(Date.parse(raw.event_date_hint))) {
      event_date_hint = raw.event_date_hint
    }

    return new Response(JSON.stringify({ category, importance, event_date_hint }), {
      headers: corsHeaders,
    })
  } catch (error) {
    console.error('[ClassifyTimeline] Error:', error)
    // Fallback — never block the user
    return new Response(JSON.stringify({
      category: 'event',
      importance: 'normal',
      event_date_hint: null,
    }), { headers: corsHeaders })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: corsHeaders })
}
