import { callOpenAIViaGateway, getOptimalCacheTTL } from '../_shared/ai-gateway'
import { scrapeUrl } from '../_shared/scraper-utils'

interface Env {
  OPENAI_API_KEY: string
  AI_CONFIG: KVNamespace
  CACHE: KVNamespace
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { url } = await context.request.json() as { url: string }

    if (!url) {
      return new Response(JSON.stringify({ error: 'URL is required' }), { status: 400 })
    }

    
    // Use shared scraper
    const scraped = await scrapeUrl(url)

    if (scraped.error) {
       return new Response(JSON.stringify({ 
         error: 'Scraping Failed', 
         details: scraped.error 
       }), { status: 422 })
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
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Analyze this content:\n\n${content}` }
      ],
      temperature: 0.0, // Deterministic for scoring
      max_completion_tokens: 1500
    }, {
      cacheTTL: getOptimalCacheTTL('content-intelligence'),
      metadata: { endpoint: 'rage-check', url }
    })

    const rawContent = aiData.choices[0].message.content
    const jsonContent = rawContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const analysis = JSON.parse(jsonContent)

    // Return analysis + extracted content preview
    return new Response(JSON.stringify({
      ...analysis,
      meta: {
        title,
        contentPreview: content.substring(0, 500) + (content.length > 500 ? '...' : '')
      }
    }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })

  } catch (error) {
    console.error('RageCheck error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to perform RageCheck'
    }), { status: 500 })
  }
}
