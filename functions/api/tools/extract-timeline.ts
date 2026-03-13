/**
 * Extract timeline events from a URL using AI analysis.
 *
 * Scrapes article content and uses GPT to identify dated events,
 * returning structured timeline entries ready for the COP timeline panel.
 */

import { callOpenAIViaGateway, getOptimalCacheTTL } from '../_shared/ai-gateway'
import { enhancedFetch } from '../../utils/browser-profiles'

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
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: 'You are an intelligence analyst specializing in chronological event extraction. Extract every datable event from the text, even if the date is approximate. Be precise with dates and concise with descriptions. Return ONLY valid JSON.'
      },
      { role: 'user', content: prompt }
    ],
    max_completion_tokens: 3000,
    temperature: 0.1,
    response_format: { type: 'json_object' }
  }, {
    cacheTTL: getOptimalCacheTTL('timeline-extraction'),
    metadata: { endpoint: 'extract-timeline', url: title.substring(0, 80) }
  })

  const rawContent = aiData.choices[0].message.content
  const parsed = JSON.parse(rawContent)

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
    const body = await context.request.json() as { url: string }

    if (!body.url) {
      return new Response(JSON.stringify({ error: 'url is required' }), {
        status: 400, headers: corsHeaders,
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
        }), { status: 422, headers: corsHeaders })
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
      }), { status: 422, headers: corsHeaders })
    }

    const html = await res.text()
    const text = stripHtmlToText(html)
    const title = extractTitle(html) || url

    if (text.length < 100) {
      return new Response(JSON.stringify({
        error: 'Insufficient content to extract timeline events',
      }), { status: 422, headers: corsHeaders })
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
    }), { headers: corsHeaders })
  } catch (error) {
    console.error('[ExtractTimeline] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to extract timeline events',
      details: error instanceof Error ? error.message : 'Unknown error',
    }), { status: 500, headers: corsHeaders })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: corsHeaders })
}
