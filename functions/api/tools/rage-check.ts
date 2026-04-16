import { callOpenAIViaGateway, getOptimalCacheTTL } from '../_shared/ai-gateway'
import { scrapeUrl } from '../_shared/scraper-utils'
import { getUserFromRequest } from '../_shared/auth-helpers'
import { JSON_HEADERS } from '../_shared/api-utils'

interface Env {
  DB: D1Database
  OPENAI_API_KEY: string
  AI_CONFIG: KVNamespace
  CACHE: KVNamespace
  APIFY_API_KEY?: string
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const authUserId = await getUserFromRequest(context.request, context.env)
    if (!authUserId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: JSON_HEADERS,
      })
    }
    const { url } = await context.request.json() as { url: string }

    if (!url) {
      return new Response(JSON.stringify({ error: 'URL is required' }), { status: 400 })
    }

    
    // Use shared scraper
    const scraped = await scrapeUrl(url, context.env.APIFY_API_KEY)

    if (scraped.error) {
       console.error('[RageCheck] Scrape failed:', scraped.error)
       return new Response(JSON.stringify({
         error: 'Failed to scrape URL content',
       }), { status: 422, headers: { 'Content-Type': 'application/json' } })
    }

    const content = scraped.content
    const title = scraped.title

    if (!content || content.length < 50) {
       return new Response(JSON.stringify({ 
         error: 'No Content Found', 
         details: 'Could not extract enough text to analyze. The page might be empty, JavaScript-heavy, or blocked.'
       }), { status: 422 })
    }

    // 2. Perform RageCheck Analysis via AI
    // We strictly follow the scoring categories and weights from the reference repo
    const systemPrompt = `You are "RageCheck", a specialized tool for detecting manipulative framing in media. 
Your job is to analyze the provided text and score it based on 5 specific categories of outrage-bait patterns.
You MUST be objective and focus on linguistic patterns, not political bias or factual accuracy.

### SCORING CATEGORIES & WEIGHTS
1. **Loaded Language (Weight: 25%)**: Emotional, inflammatory words (e.g., "disgusting", "evil", "scum", "radical").
2. **Absolutist (Weight: 15%)**: Certainty/black-and-white language (e.g., "always", "never", "everyone knows", "undeniable").
3. **Threat/Panic (Weight: 25%)**: Fear-mongering framing (e.g., "they're coming for", "under attack", "collapse", "destroy").
4. **Us-vs-Them (Weight: 15%)**: Divisive in-group/out-group language (e.g., "those people", "elites", "real Americans", "enemies").
5. **Engagement Bait (Weight: 20%)**: Clickbait/viral patterns (e.g., "you won't believe", "shocking", "must see").

### INSTRUCTIONS
1. Analyze the text for these specific patterns.
2. Assign a score (0-100) for each category based on the density and intensity of the patterns found.
3. Identify specific phrases (highlights) that triggered the score.
4. Calculate the Final Score using the weights: (Loaded * 0.25) + (Absolutist * 0.15) + (Threat * 0.25) + (UsVsThem * 0.15) + (Bait * 0.20).
5. Determine the Label: Low (0-33), Medium (34-66), High (67-100).

Return ONLY valid JSON in this structure:
{
  "score": number, // 0-100
  "label": "Low" | "Medium" | "High",
  "categoryScores": {
    "loaded_language": number,
    "absolutist": number,
    "threat_panic": number,
    "us_vs_them": number,
    "engagement_bait": number
  },
  "explanation": "Brief summary of why it received this score",
  "highlights": [
    { "text": "quoted phrase", "category": "loaded_language", "explanation": "Why this is loaded" }
  ]
}`

    const aiData = await callOpenAIViaGateway(context.env, {
      model: 'gpt-5.4-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Analyze this content:\n\n${content}` }
      ],
      reasoning_effort: 'none',
      temperature: 0.0, // Deterministic for scoring
      max_completion_tokens: 1500
    }, {
      cacheTTL: getOptimalCacheTTL('content-intelligence'),
      metadata: { endpoint: 'rage-check', url }
    })

    const rawContent = aiData.choices[0].message.content
    const jsonContent = rawContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    let analysis: any
    try { analysis = JSON.parse(jsonContent) } catch {
      console.warn('[rage-check] Failed to parse AI response:', jsonContent?.substring(0, 200))
      return new Response(JSON.stringify({ error: 'AI returned invalid JSON' }), {
        status: 502, headers: JSON_HEADERS,
      })
    }

    // Return analysis + extracted content preview
    return new Response(JSON.stringify({
      ...analysis,
      meta: {
        title,
        contentPreview: content.substring(0, 500) + (content.length > 500 ? '...' : '')
      }
    }), {
      headers: JSON_HEADERS
    })

  } catch (error) {
    console.error('RageCheck error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to perform RageCheck'
    }), { status: 500 })
  }
}

// Reject GET requests (POST-only endpoint)
export const onRequestGet: PagesFunction = async () => {
  return new Response(JSON.stringify({ error: 'Method not allowed. Use POST.' }), {
    status: 405, headers: JSON_HEADERS,
  })
}

