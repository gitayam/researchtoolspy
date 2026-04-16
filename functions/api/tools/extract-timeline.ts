/**
 * Extract timeline events from a URL using AI analysis.
 *
 * Scrapes article content and uses GPT to identify dated events,
 * returning structured timeline entries ready for the COP timeline panel.
 */

import { callOpenAIViaGateway, getOptimalCacheTTL } from '../_shared/ai-gateway'
import { enhancedFetch } from '../../utils/browser-profiles'
import { getUserFromRequest } from '../_shared/auth-helpers'
import { JSON_HEADERS, optionsResponse } from '../_shared/api-utils'

interface Env {
  DB: D1Database
  OPENAI_API_KEY: string
  AI_GATEWAY_ACCOUNT_ID?: string
  AI_CONFIG: KVNamespace
  CACHE: KVNamespace
}

// ─── Content extraction (simplified from extract-claims) ───

function stripHtmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<aside[\s\S]*?<\/aside>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function extractTitle(html: string): string {
  // OG title
  const ogMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i)
  if (ogMatch) return ogMatch[1]
  // <title> tag
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  if (titleMatch) return titleMatch[1].trim()
  return ''
}

// ─── AI extraction ───

async function extractTimelineFromText(env: Env, text: string, title: string): Promise<any[]> {
  const truncated = text.slice(0, 12000)

  const prompt = `Analyze the following article and extract a chronological timeline of events. For each event, identify:
- event_date: The date (ISO format YYYY-MM-DD if exact, or YYYY-MM if only month known, or YYYY if only year). Use best judgment for relative dates ("last Tuesday", "three weeks ago", etc.) based on the article's publish date context.
- title: A concise one-line summary of the event (under 120 chars)
- description: A 1-2 sentence description with key details
- category: One of: event, meeting, communication, financial, legal, travel, publication, military, political
- importance: One of: low, normal, high, critical

Return ONLY valid JSON:
{ "events": [{ "event_date": "...", "title": "...", "description": "...", "category": "...", "importance": "..." }] }

If no datable events can be found, return { "events": [] }.

Article title: ${title}

Article text:
${truncated}`

  const aiData = await callOpenAIViaGateway(env, {
    model: 'gpt-5.4-mini',
    messages: [
      {
        role: 'system',
        content: 'You are an intelligence analyst specializing in chronological event extraction. Extract every datable event from the text, even if the date is approximate. Be precise with dates and concise with descriptions. Return ONLY valid JSON.'
      },
      { role: 'user', content: prompt }
    ],
    max_completion_tokens: 3000,
    reasoning_effort: 'none',
    temperature: 0.1,
    response_format: { type: 'json_object' }
  }, {
    cacheTTL: getOptimalCacheTTL('timeline-extraction'),
    metadata: { endpoint: 'extract-timeline', url: title.substring(0, 80) }
  })

  const rawContent = aiData.choices[0].message.content
  let parsed: any
  try { parsed = JSON.parse(rawContent) } catch {
    console.warn('[extract-timeline] Failed to parse AI response:', rawContent?.substring(0, 200))
    return []
  }

  // Validate each event field-by-field (never spread raw LLM output)
  const validCategories = ['event', 'meeting', 'communication', 'financial', 'legal', 'travel', 'publication', 'military', 'political']
  const validImportance = ['low', 'normal', 'high', 'critical']

  return (parsed.events ?? []).map((e: any) => ({
    event_date: typeof e.event_date === 'string' ? e.event_date : new Date().toISOString().slice(0, 10),
    title: typeof e.title === 'string' ? e.title.slice(0, 200) : 'Unknown event',
    description: typeof e.description === 'string' ? e.description.slice(0, 500) : null,
    category: validCategories.includes(e.category) ? e.category : 'event',
    importance: validImportance.includes(e.importance) ? e.importance : 'normal',
  }))
}

// ─── Handler ───

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const authUserId = await getUserFromRequest(context.request, context.env)
    if (!authUserId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: JSON_HEADERS,
      })
    }

    const body = await context.request.json() as { url: string }

    if (!body.url) {
      return new Response(JSON.stringify({ error: 'url is required' }), {
        status: 400, headers: JSON_HEADERS,
      })
    }

    const url = body.url

    // Early detection: x.com/twitter.com
    try {
      const parsedUrl = new URL(url)
      const host = parsedUrl.hostname.replace(/^www\./, '')
      if (host === 'x.com' || host === 'twitter.com') {
        return new Response(JSON.stringify({
          error: 'Twitter/X posts cannot be scraped',
          details: 'X.com blocks server-side requests. Enter timeline events manually instead.',
        }), { status: 422, headers: JSON_HEADERS })
      }
    } catch {
      // Invalid URL — will be caught by fetch below
    }

    // Fetch content
    const res = await enhancedFetch(url, {
      headers: { 'Accept': 'text/html,application/xhtml+xml' },
    })

    if (!res.ok) {
      return new Response(JSON.stringify({
        error: `Failed to fetch URL (${res.status})`,
      }), { status: 422, headers: JSON_HEADERS })
    }

    const html = await res.text()
    const text = stripHtmlToText(html)
    const title = extractTitle(html) || url

    if (text.length < 100) {
      return new Response(JSON.stringify({
        error: 'Insufficient content to extract timeline events',
      }), { status: 422, headers: JSON_HEADERS })
    }

    // Extract timeline events via AI
    const events = await extractTimelineFromText(context.env, text, title)

    const domain = new URL(url).hostname.replace(/^www\./, '')

    return new Response(JSON.stringify({
      events,
      title,
      domain,
      url,
      event_count: events.length,
    }), { headers: JSON_HEADERS })
  } catch (error) {
    console.error('[ExtractTimeline] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to extract timeline events',
    }), { status: 500, headers: JSON_HEADERS })
  }
}

// Reject GET requests (POST-only endpoint)
export const onRequestGet: PagesFunction = async () => {
  return new Response(JSON.stringify({ error: 'Method not allowed. Use POST.' }), {
    status: 405, headers: JSON_HEADERS,
  })
}

export const onRequestOptions: PagesFunction = async () => {
  return optionsResponse()
}
