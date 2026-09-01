/**
 * Extract timeline events from a URL using AI analysis.
 *
 * Scrapes article content and uses GPT to identify dated events,
 * returning structured timeline entries ready for the COP timeline panel.
 */

import { callOpenAIViaGateway, getOptimalCacheTTL } from '../_shared/ai-gateway'
import { getUserFromRequest } from '../_shared/auth-helpers'
import { JSON_HEADERS, optionsResponse } from '../_shared/api-utils'
import { extractArticle } from '../_shared/article-extractor'
import { parseSafeOutboundUrl, safeFetchText } from '../_shared/safe-fetch'

interface Env {
  DB: D1Database
  OPENAI_API_KEY: string
  AI_GATEWAY_ACCOUNT_ID?: string
  AI_CONFIG: KVNamespace
  CACHE: KVNamespace
}

interface TimelineEvent {
  event_date: string
  title: string
  description: string | null
  category: string
  importance: string
}

interface TimelineSource {
  response: Response
  html: string
  finalUrl: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export async function fetchTimelineSource(url: string): Promise<TimelineSource> {
  const fetched = await safeFetchText(url, {
    timeoutMs: 15_000,
    maxRedirects: 5,
    maxResponseBytes: 2 * 1024 * 1024,
    allowedContentTypes: ['text/', 'application/xhtml+xml', 'application/xml'],
    requestInit: {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ResearchToolsBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8',
      },
    },
  })
  return { response: fetched.response, html: fetched.text, finalUrl: fetched.finalUrl }
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

async function extractTimelineFromText(env: Env, text: string, title: string): Promise<TimelineEvent[]> {
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
  let parsed: unknown
  try { parsed = JSON.parse(rawContent) as unknown } catch {
    console.warn('[extract-timeline] Failed to parse AI response:', rawContent?.substring(0, 200))
    return []
  }

  // Validate each event field-by-field (never spread raw LLM output)
  const validCategories = ['event', 'meeting', 'communication', 'financial', 'legal', 'travel', 'publication', 'military', 'political']
  const validImportance = ['low', 'normal', 'high', 'critical']

  const events = isRecord(parsed) && Array.isArray(parsed.events) ? parsed.events : []
  return events.filter(isRecord).map(event => ({
    event_date: typeof event.event_date === 'string' ? event.event_date : new Date().toISOString().slice(0, 10),
    title: typeof event.title === 'string' ? event.title.slice(0, 200) : 'Unknown event',
    description: typeof event.description === 'string' ? event.description.slice(0, 500) : null,
    category: typeof event.category === 'string' && validCategories.includes(event.category) ? event.category : 'event',
    importance: typeof event.importance === 'string' && validImportance.includes(event.importance) ? event.importance : 'normal',
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

    let parsedUrl: URL
    try {
      parsedUrl = parseSafeOutboundUrl(body.url)
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid or unsafe URL format' }), {
        status: 400, headers: JSON_HEADERS,
      })
    }
    const url = parsedUrl.href

    // Early detection: x.com/twitter.com
    const host = parsedUrl.hostname.toLowerCase().replace(/^www\./, '').replace(/\.$/, '')
    if (host === 'x.com' || host === 'twitter.com') {
      return new Response(JSON.stringify({
        error: 'Twitter/X posts cannot be scraped',
        details: 'X.com blocks server-side requests. Enter timeline events manually instead.',
      }), { status: 422, headers: JSON_HEADERS })
    }

    // Static-only until Browser Run navigation and subresources are forced
    // through the same enforcing egress boundary as this bounded request.
    let source: TimelineSource
    try {
      source = await fetchTimelineSource(url)
    } catch {
      return new Response(JSON.stringify({ error: 'Failed to fetch URL' }), {
        status: 422, headers: JSON_HEADERS,
      })
    }
    const res = source.response

    if (!res.ok) {
      return new Response(JSON.stringify({
        error: `Failed to fetch URL (${res.status})`,
      }), { status: 422, headers: JSON_HEADERS })
    }

    const html = source.html
    const article = extractArticle(html, source.finalUrl)
    const text = article.text
    const title = article.title || extractTitle(html) || url

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
      extraction: {
        method: article.method,
        quality: article.quality,
        word_count: text ? text.split(/\s+/).length : 0,
      },
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
