/**
 * URL Scraping and AI Extraction API
 *
 * Scrapes URLs, extracts content, and uses GPT-5-nano to extract structured data
 */

interface Env {
  OPENAI_API_KEY: string
  AI_CONFIG: KVNamespace
}

interface ScrapeRequest {
  url: string
  framework: string
}

interface ScrapeResponse {
  url: string
  title: string
  content: string
  summary: string
  extractedData: Record<string, any>
  metadata: {
    publishDate?: string
    author?: string
    source: string
  }
}

// Simple HTML to text extraction
function extractTextFromHTML(html: string): { title: string; content: string } {
  // Remove script and style tags
  let text = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
  text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')

  // Extract title
  const titleMatch = text.match(/<title[^>]*>([^<]+)<\/title>/i)
  const title = titleMatch ? titleMatch[1].trim() : 'Untitled'

  // Remove HTML tags
  text = text.replace(/<[^>]+>/g, ' ')

  // Decode HTML entities
  text = text.replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")

  // Clean up whitespace
  text = text.replace(/\s+/g, ' ').trim()

  // Limit length to 100KB
  const content = text.substring(0, 100000)

  return { title, content }
}

// Framework-specific extraction prompts
const extractionPrompts: Record<string, string> = {
  starbursting: `Analyze this article and extract 5W+How questions WITH answers:

Article: {content}

Generate 3-5 specific questions for each category based on the article content. For each question, provide an answer extracted from the article. If the answer is not available in the article, set answer to empty string "". Return ONLY valid JSON with question-answer pairs:

{
  "who": [
    {"question": "Who question 1?", "answer": "Answer from article or empty string"},
    {"question": "Who question 2?", "answer": "Answer from article or empty string"}
  ],
  "what": [
    {"question": "What question 1?", "answer": "Answer from article or empty string"},
    {"question": "What question 2?", "answer": "Answer from article or empty string"}
  ],
  "when": [
    {"question": "When question 1?", "answer": "Answer from article or empty string"},
    {"question": "When question 2?", "answer": "Answer from article or empty string"}
  ],
  "where": [
    {"question": "Where question 1?", "answer": "Answer from article or empty string"},
    {"question": "Where question 2?", "answer": "Answer from article or empty string"}
  ],
  "why": [
    {"question": "Why question 1?", "answer": "Answer from article or empty string"},
    {"question": "Why question 2?", "answer": "Answer from article or empty string"}
  ],
  "how": [
    {"question": "How question 1?", "answer": "Answer from article or empty string"},
    {"question": "How question 2?", "answer": "Answer from article or empty string"}
  ]
}`,

  dime: `Analyze this content for DIME framework elements (Diplomatic, Information, Military, Economic):

Article: {content}

Generate questions AND answers for each DIME dimension based on the article content. For each question, provide an answer extracted from the article. If the answer is not available in the article, set answer to empty string "". Return ONLY valid JSON with question-answer pairs:

{
  "diplomatic": [
    {"question": "Question about diplomatic aspects?", "answer": "Answer from article or empty string"},
    {"question": "Another diplomatic question?", "answer": "Answer from article or empty string"}
  ],
  "information": [
    {"question": "Question about information aspects?", "answer": "Answer from article or empty string"},
    {"question": "Another information question?", "answer": "Answer from article or empty string"}
  ],
  "military": [
    {"question": "Question about military aspects?", "answer": "Answer from article or empty string"},
    {"question": "Another military question?", "answer": "Answer from article or empty string"}
  ],
  "economic": [
    {"question": "Question about economic aspects?", "answer": "Answer from article or empty string"},
    {"question": "Another economic question?", "answer": "Answer from article or empty string"}
  ]
}`,

  causeway: `Analyze this content using the PUTAR methodology (Problem, Undesired Actor, Target Audience, Remedy, Story):

Article: {content}

Extract PUTAR components. Return ONLY valid JSON:

{
  "scenario": "Brief scenario description",
  "putars": ["PUTAR component 1", "PUTAR component 2", ...],
  "critical_capabilities": ["capability 1", "capability 2", ...],
  "critical_requirements": ["requirement 1", "requirement 2", ...],
  "proximate_targets": ["target 1", "target 2", ...]
}`,

  deception: `Analyze this content for potential deception indicators using CIA SATS methodology:

Article: {content}

Extract key information. Return ONLY valid JSON:

{
  "scenario": "Summary of claims/narrative being analyzed",
  "mom": ["Motive indicator", "Opportunity indicator", "Means indicator"],
  "pop": ["Historical pattern 1", "Pattern 2", ...],
  "moses": ["Source vulnerability 1", "Source issue 2", ...],
  "eve": ["Consistency note 1", "Evidence note 2", ...]
}`,

  cog: `Analyze this content for Center of Gravity analysis:

Article: {content}

Extract COG elements. Return ONLY valid JSON:

{
  "center_of_gravity": ["COG 1", "COG 2", ...],
  "critical_capabilities": ["capability 1", "capability 2", ...],
  "critical_requirements": ["requirement 1", "requirement 2", ...],
  "critical_vulnerabilities": ["vulnerability 1", "vulnerability 2", ...]
}`,

  swot: `Analyze this content for SWOT analysis:

Article: {content}

Extract SWOT elements. Return ONLY valid JSON:

{
  "strengths": ["strength 1", "strength 2", ...],
  "weaknesses": ["weakness 1", "weakness 2", ...],
  "opportunities": ["opportunity 1", "opportunity 2", ...],
  "threats": ["threat 1", "threat 2", ...]
}`
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const request = await context.request.json() as ScrapeRequest
    const { url, framework } = request

    if (!url || !framework) {
      return new Response(JSON.stringify({ error: 'URL and framework are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Validate URL
    let parsedUrl: URL
    try {
      parsedUrl = new URL(url)
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid URL format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Fetch the URL
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ResearchToolsBot/1.0)'
      }
    })

    if (!response.ok) {
      return new Response(JSON.stringify({ error: `Failed to fetch URL: ${response.status}` }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const html = await response.text()
    const { title, content } = extractTextFromHTML(html)

    // Generate summary with GPT-5-nano
    const apiKey = context.env.OPENAI_API_KEY
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'OpenAI API key not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // First, get summary
    const summaryResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-5-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a concise summarization assistant. Summarize articles in 2-3 sentences.'
          },
          {
            role: 'user',
            content: `Summarize this article:\n\n${content.substring(0, 10000)}`
          }
        ],
        max_completion_tokens: 500
      })
    })

    if (!summaryResponse.ok) {
      const errorData = await summaryResponse.json().catch(() => ({ error: 'Unknown error' }))
      console.error('OpenAI API error:', errorData)
      throw new Error(`Failed to generate summary: ${JSON.stringify(errorData)}`)
    }

    const summaryData = await summaryResponse.json()
    const summary = summaryData.choices[0].message.content

    // Extract framework-specific data if prompt exists
    let extractedData: Record<string, any> = {}

    if (extractionPrompts[framework]) {
      const extractPrompt = extractionPrompts[framework].replace('{content}', content.substring(0, 15000))

      const extractResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-5-mini',
          messages: [
            {
              role: 'system',
              content: 'You are a data extraction assistant. Return ONLY valid JSON, no other text.'
            },
            {
              role: 'user',
              content: extractPrompt
            }
          ],
          max_completion_tokens: 2000
        })
      })

      if (extractResponse.ok) {
        const extractData = await extractResponse.json()
        const extractedText = extractData.choices[0].message.content

        // Try to parse JSON
        try {
          // Remove markdown code blocks if present
          const jsonText = extractedText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
          extractedData = JSON.parse(jsonText)
        } catch (e) {
          console.error('Failed to parse extracted JSON:', e)
          extractedData = { _raw: extractedText }
        }
      }
    }

    // Build response
    const result: ScrapeResponse = {
      url,
      title,
      content: content.substring(0, 5000), // Return first 5KB for reference
      summary,
      extractedData,
      metadata: {
        source: parsedUrl.hostname
      }
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Scraping error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to scrape URL',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
