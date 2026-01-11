import { callOpenAIViaGateway, getOptimalCacheTTL } from '../_shared/ai-gateway'

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

    // 1. Scrape the URL (reusing the logic from scrape-url is best, but for now I'll just use a direct fetch/clean approach or call the scrape-url internal function if it was exported. 
    // Since I can't easily import from sibling functions in Cloudflare Pages functions without shared modules, I will replicate the fetch/clean logic briefly or assume the user wants me to do the fetching here.)
    // Actually, I can just fetch the URL here.

    console.log(`[RageCheck] Fetching ${url}...`)
    
    let content = ''
    let title = ''

    // 1. Robust Scraping Strategy
    const isTwitter = /twitter\.com|x\.com/.test(url)

    if (isTwitter) {
      try {
        console.log('[RageCheck] Detected Twitter URL, using oEmbed...')
        const oembedUrl = `https://publish.twitter.com/oembed?url=${encodeURIComponent(url)}`
        const twitterResponse = await fetch(oembedUrl)
        
        if (twitterResponse.ok) {
          const data = await twitterResponse.json() as any
          const html = data.html || ''
          // Extract text from blockquote
          const pMatch = html.match(/<p[^>]*>(.*?)<\/p>/)
          if (pMatch && pMatch[1]) {
            content = pMatch[1]
              .replace(/<br\s*\/?>/g, '\n')
              .replace(/<[^>]+>/g, '')
              .replace(/&amp;/g, '&')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&quot;/g, '"')
              .replace(/&#39;/g, "'")
              .trim()
          }
          title = `Tweet by ${data.author_name}`
        }
      } catch (e) {
        console.error('[RageCheck] Twitter oEmbed failed:', e)
      }
    } 
    
    // Fallback or Standard Fetch
    if (!content) {
      const response = await fetch(url, {
        headers: { 
          'User-Agent': 'Mozilla/5.0 (compatible; ResearchToolsBot/1.0; +http://research.example.com)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
      })

      if (!response.ok) {
        // If 403/401, likely anti-bot. Return specific error to UI.
        if (response.status === 403 || response.status === 401) {
           return new Response(JSON.stringify({ 
             error: 'Access Denied', 
             details: 'The website blocked the analysis tool. Try copying the text manually.'
           }), { status: 422 })
        }
        throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`)
      }

      const html = await response.text()
      
      // Extract Title
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
      title = titleMatch ? titleMatch[1].trim() : url

      // Extract Text
      let text = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      text = text.replace(/<[^>]+>/g, ' ')
      text = text.replace(/\s+/g, ' ').trim()
      content = text.substring(0, 15000)
    }

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
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('RageCheck error:', error)
    return new Response(JSON.stringify({ 
      error: 'Failed to perform RageCheck', 
      details: error instanceof Error ? error.message : String(error)
    }), { status: 500 })
  }
}
