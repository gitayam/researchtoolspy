/**
 * URL Scraping and AI Extraction API
 *
 * Scrapes URLs, extracts content, and uses GPT-5-nano to extract structured data
 */

import { callOpenAIViaGateway, getOptimalCacheTTL } from '../_shared/ai-gateway'

interface Env {
  OPENAI_API_KEY: string
  AI_GATEWAY_ACCOUNT_ID?: string
  AI_CONFIG: KVNamespace
  CACHE: KVNamespace
  RATE_LIMIT?: KVNamespace
}

interface ScrapeRequest {
  url: string
  framework: string
  language?: string
}

// Language name mapping for AI prompts
const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  es: 'Spanish (Español)',
  fr: 'French (Français)',
  de: 'German (Deutsch)',
  pt: 'Portuguese (Português)',
  it: 'Italian (Italiano)',
  zh: 'Chinese (中文)',
  ja: 'Japanese (日本語)',
  ko: 'Korean (한국어)',
  ar: 'Arabic (العربية)',
  ru: 'Russian (Русский)',
}

// Generate language instruction for AI prompts
function getLanguageInstruction(languageCode?: string): string {
  if (!languageCode || languageCode === 'en') {
    return ''
  }
  const languageName = LANGUAGE_NAMES[languageCode] || languageCode
  return `

=== CRITICAL LANGUAGE REQUIREMENT ===
You MUST write ALL text output in ${languageName}.
This is NON-NEGOTIABLE. Every string value in your JSON response MUST be in ${languageName}.
- "scenario" field: Write in ${languageName}
- All array items: Write in ${languageName}
- All questions: Write in ${languageName}
- All answers: Write in ${languageName}
- All descriptions: Write in ${languageName}
DO NOT write in English. Write EVERYTHING in ${languageName}.
=== END LANGUAGE REQUIREMENT ===
`
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
  citation?: {
    id: string
    sourceType: 'website' | 'news'
    citationStyle: 'apa'
    fields: any
    citation: string
    inTextCitation: string
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
  starbursting: `Analyze this article and perform a 5W1H "Starbursting" analysis using a structured ontology.

Article Title: {title}
Article URL: {url}
Article Content: {content}

### ONTOLOGY CLASSES
1. **Actor** (Who): People, groups, or organizations. Properties: name, details (role/affiliation).
2. **Event** (What/When): Actions, incidents, or temporal markers. Properties: name, details (date/type).
3. **Place** (Where): Geographic locations. Properties: name, details (region/type).
4. **Mechanism** (How): Methods, tools, or techniques used. Properties: name, details (tool/method).
5. **Cause** (Why): Intent, motivations, or strategic goals. Properties: name, details (intent/goal).

### INSTRUCTIONS
1. Generate 3-5 specific questions for each category based on the article content.
2. For each question, provide a detailed answer extracted from the article.
3. EXTRACT specific entities mentioned in the answer and map them to the Ontology Classes.
4. If the answer is not available in the article, set answer to empty string "".

CRITICAL REQUIREMENTS for QUESTIONS:
1. Include the specific article title in the question (NEVER use "this article", "the article", "this", or "it").
2. Include specific dates, event names, and entity names mentioned in the article.
3. Replace ALL pronouns with specific references.

Return ONLY valid JSON with the following structure:
{
  "who": [
    {
      "question": "Who question?",
      "answer": "Specific answer.",
      "extracted_entities": [{ "name": "Entity Name", "type": "Actor", "details": "Role" }]
    }
  ],
  "what": [
    {
      "question": "What question?",
      "answer": "Specific answer.",
      "extracted_entities": [{ "name": "Entity Name", "type": "Event", "details": "Action" }]
    }
  ],
  "where": [
    {
      "question": "Where question?",
      "answer": "Specific answer.",
      "extracted_entities": [{ "name": "Entity Name", "type": "Place", "details": "Location Type" }]
    }
  ],
  "when": [
    {
      "question": "When question?",
      "answer": "Specific answer.",
      "extracted_entities": [{ "name": "Entity Name", "type": "Event", "details": "Date/Time" }]
    }
  ],
  "why": [
    {
      "question": "Why question?",
      "answer": "Specific answer.",
      "extracted_entities": [{ "name": "Entity Name", "type": "Cause", "details": "Motivation" }]
    }
  ],
  "how": [
    {
      "question": "How question?",
      "answer": "Specific answer.",
      "extracted_entities": [{ "name": "Entity Name", "type": "Mechanism", "details": "Method" }]
    }
  ]
}`,

  dime: `Analyze this article using the DIME framework (Diplomatic, Information, Military, Economic) and extract specific question-answer pairs with structured entities.

Article Title: {title}
Article URL: {url}
Article Content: {content}

### ONTOLOGY CLASSES
1. **Actor** (Diplomatic/Military): People, groups, or organizations.
2. **Event** (Military/Information): Actions, incidents, or temporal markers.
3. **Place** (Diplomatic/Military): Geographic locations.
4. **Mechanism** (Information/Economic): Methods, tools, or techniques used.
5. **Cause** (Diplomatic/Information): Intent, motivations, or strategic goals.

### INSTRUCTIONS
1. For each DIME dimension, generate 2-4 specific questions.
2. Provide answers extracted from the article.
3. EXTRACT specific entities mentioned in each answer and map them to the Ontology Classes.
4. If an answer is not found, use empty string "".

CRITICAL REQUIREMENTS:
1. Include the specific article title in each question.
2. Include specific dates, event names, country names, and entity names.
3. Replace ALL pronouns with specific references.

Return ONLY valid JSON:
{
  "diplomatic": [
    {
      "question": "Question?",
      "answer": "Answer.",
      "extracted_entities": [{ "name": "Name", "type": "Actor", "details": "Role" }]
    }
  ],
  "information": [
    {
      "question": "Question?",
      "answer": "Answer.",
      "extracted_entities": [{ "name": "Name", "type": "Mechanism", "details": "Narrative/Tool" }]
    }
  ],
  "military": [
    {
      "question": "Question?",
      "answer": "Answer.",
      "extracted_entities": [{ "name": "Name", "type": "Event", "details": "Operation" }]
    }
  ],
  "economic": [
    {
      "question": "Question?",
      "answer": "Answer.",
      "extracted_entities": [{ "name": "Name", "type": "Mechanism", "details": "Sanction/Trade" }]
    }
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

  deception: `Analyze this content for potential deception indicators using CIA SATS methodology and "RageCheck" analysis for manipulative framing:

Article: {content}

Extract key information. Return ONLY valid JSON:

{
  "scenario": "Summary of claims/narrative being analyzed",
  "mom": ["Motive indicator", "Opportunity indicator", "Means indicator"],
  "pop": ["Historical pattern 1", "Pattern 2", ...],
  "moses": ["Source vulnerability 1", "Source issue 2", ...],
  "eve": ["Consistency note 1", "Evidence note 2", ...],
  "rage_check": [
    "Emotional Provocation: [Specific phrase/example]",
    "Tribalism (Us vs Them): [Specific phrase/example]",
    "Catastrophizing: [Specific phrase/example]",
    "Generalization: [Specific phrase/example]"
  ],
  "rage_score": 0, // Integer 0-100 indicating intensity of manipulative framing
  "rage_intensity": "Low/Medium/High", // Qualitative assessment
  "assessment": "Overall assessment of deception risk and manipulative framing"
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
    const { url, framework, language } = request


    if (!url || !framework) {
      return new Response(JSON.stringify({ error: 'URL and framework are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Get language instruction for AI prompts
    const languageInstruction = getLanguageInstruction(language)

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

    // KV Cache Check - save costs by caching AI responses
    // Include language in cache key so different languages are cached separately
    const cacheKey = `scrape:${url}:${framework}:${language || 'en'}`
    const cached = await context.env.CACHE.get(cacheKey, 'json')
    if (cached) {
      return new Response(JSON.stringify(cached), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Cache': 'HIT'
        }
      })
    }


    let content = ''
    let title = ''
    let html = ''

    // 1. Specialized Twitter/X Scraping (oEmbed)
    const isTwitter = /twitter\.com|x\.com/.test(url)
    
    if (isTwitter) {
      try {
        const oembedUrl = `https://publish.twitter.com/oembed?url=${encodeURIComponent(url)}`
        const twitterResponse = await fetch(oembedUrl)
        
        if (twitterResponse.ok) {
          const data = await twitterResponse.json() as any
          html = data.html || ''
          
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
        console.error('[Scrape] Twitter oEmbed failed:', e)
      }
    }

    // 2. Standard Fetch (if content not already extracted)
    if (!content) {
      // Fetch the URL with timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000) // 15 second timeout

      let response
      try {
        response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; ResearchToolsBot/1.0)'
          },
          signal: controller.signal
        })
      } catch (fetchError) {
        clearTimeout(timeoutId)
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          return new Response(JSON.stringify({
            error: 'The website took too long to respond',
            errorType: 'timeout',
            suggestions: [
              'Try again - the site might be temporarily slow',
              'Check if the URL is accessible in your browser',
              'The website might have anti-bot protection'
            ],
            technicalDetails: 'Request timeout after 15 seconds'
          }), {
            status: 504,
            headers: { 'Content-Type': 'application/json' }
          })
        }
        throw fetchError
      } finally {
        clearTimeout(timeoutId)
      }

      if (!response.ok) {
        let userMessage = 'Failed to access the website'
        let suggestions: string[] = []

        if (response.status === 403 || response.status === 401) {
          userMessage = 'The website is blocking automated access'
          suggestions = [
            'This website has anti-bot protection',
            'Try accessing the URL directly in your browser',
            'The content may require authentication',
            'Consider manually copying the content instead'
          ]
        } else if (response.status === 404) {
          userMessage = 'The page was not found'
          suggestions = [
            'Check if the URL is correct',
            'The page might have been moved or deleted',
            'Try searching for the content on the website'
          ]
        } else if (response.status >= 500) {
          userMessage = 'The website server is having issues'
          suggestions = [
            'Try again later - the server might be temporarily down',
            'Check if the website is accessible in your browser',
            'The website might be experiencing technical difficulties'
          ]
        } else {
          suggestions = [
            'Try again later',
            'Check if the URL is correct and accessible'
          ]
        }

        return new Response(JSON.stringify({
          error: userMessage,
          errorType: 'http_error',
          suggestions,
          technicalDetails: `HTTP ${response.status} ${response.statusText}`
        }), {
          status: response.status,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      html = await response.text()

      const extracted = extractTextFromHTML(html)
      title = extracted.title
      content = extracted.content
    }
    

    // Generate citation from URL metadata
    const citationId = `cit-${Date.now()}-${Math.random().toString(36).substring(7)}`
    const today = new Date()
    const sourceType: 'website' | 'news' = parsedUrl.hostname.includes('news') ||
      title.toLowerCase().includes('news') ? 'news' : 'website'

    const citationFields = {
      authors: [{ firstName: '', lastName: 'Unknown', middleName: '' }],
      title: title,
      year: today.getFullYear().toString(),
      month: (today.getMonth() + 1).toString().padStart(2, '0'),
      day: today.getDate().toString().padStart(2, '0'),
      url: url,
      accessDate: today.toISOString().split('T')[0],
      siteName: parsedUrl.hostname.replace('www.', ''),
      publisher: undefined
    }

    // Try to extract publish date and author from content if available
    // This is a simple extraction - could be enhanced with better metadata parsing
    const publishDateMatch = content.match(/published[:\s]+(\w+\s+\d+,?\s+\d{4})/i)
    if (publishDateMatch) {
      const dateStr = publishDateMatch[1]
      try {
        const pubDate = new Date(dateStr)
        if (!isNaN(pubDate.getTime())) {
          citationFields.year = pubDate.getFullYear().toString()
          citationFields.month = (pubDate.getMonth() + 1).toString().padStart(2, '0')
          citationFields.day = pubDate.getDate().toString().padStart(2, '0')
        }
      } catch (e) {
        // Keep default date
      }
    }

    // Generate APA citation
    const authors = citationFields.authors
    const year = citationFields.year
    const formattedDate = `${citationFields.year}, ${citationFields.month} ${citationFields.day}`
    const siteName = citationFields.siteName
    const fullCitation = `${authors[0].lastName}. (${formattedDate}). ${title}. ${siteName}. ${url}`
    const inTextCitation = `(${authors[0].lastName}, ${year})`

    const generatedCitation = {
      id: citationId,
      sourceType,
      citationStyle: 'apa' as const,
      fields: citationFields,
      citation: fullCitation,
      inTextCitation: inTextCitation
    }

    // Generate summary with AI
    const apiKey = context.env.OPENAI_API_KEY
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'OpenAI API key not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // First, get summary
    const summarySystemPrompt = language && language !== 'en'
      ? `You are a concise summarization assistant. Summarize articles in 2-3 sentences. ${languageInstruction}`
      : 'You are a concise summarization assistant. Summarize articles in 2-3 sentences.'

    const summaryData = await callOpenAIViaGateway(context.env, {
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: summarySystemPrompt
        },
        {
          role: 'user',
          content: `Summarize this article:\n\n${content.substring(0, 10000)}${languageInstruction}`
        }
      ],
      max_completion_tokens: 500
    }, {
      cacheTTL: getOptimalCacheTTL('content-intelligence'),
      metadata: {
        endpoint: 'ai-scrape',
        operation: 'generate-summary',
        url: url
      },
      timeout: 15000
    })

    // Validate summary response structure
    if (!summaryData.choices || !summaryData.choices[0] || !summaryData.choices[0].message) {
      console.error('Invalid OpenAI summary response structure:', summaryData)
      throw new Error('Invalid API response structure for summary')
    }

    const summary = summaryData.choices[0].message.content || 'No summary available'

    // Extract framework-specific data if prompt exists
    let extractedData: Record<string, any> = {}

    if (extractionPrompts[framework]) {
      const extractPrompt = extractionPrompts[framework]
        .replace('{title}', title)
        .replace('{url}', url)
        .replace('{content}', content.substring(0, 15000))


      // Build system prompt with language instruction if needed
      const extractSystemPrompt = language && language !== 'en'
        ? `You are an expert intelligence analyst and data extraction assistant. Extract specific, factual information from articles and structure it as valid JSON. CRITICAL: Generate questions that include the specific article title, dates, entity names, and event names. NEVER use pronouns like "this", "it", "the article" - always use specific references. Questions must be self-contained and understandable without seeing the article. Be precise and thorough. Return ONLY valid JSON, no other text or explanations.${languageInstruction}`
        : 'You are an expert intelligence analyst and data extraction assistant. Extract specific, factual information from articles and structure it as valid JSON. CRITICAL: Generate questions that include the specific article title, dates, entity names, and event names. NEVER use pronouns like "this", "it", "the article" - always use specific references. Questions must be self-contained and understandable without seeing the article. Be precise and thorough. Return ONLY valid JSON, no other text or explanations.'

      try {
        const extractData = await callOpenAIViaGateway(context.env, {
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: extractSystemPrompt
            },
            {
              role: 'user',
              content: extractPrompt + languageInstruction
            }
          ],
          max_completion_tokens: 3000
          // Note: gpt-4o-mini only supports temperature=1 (default), so we omit it
        }, {
          cacheTTL: getOptimalCacheTTL('content-intelligence'),
          metadata: {
            endpoint: 'ai-scrape',
            operation: 'extract-framework-data',
            framework: framework,
            url: url
          },
          timeout: 20000
        })


        // Validate response structure
        if (!extractData.choices || !extractData.choices[0] || !extractData.choices[0].message) {
          console.error(`Invalid OpenAI response structure for ${framework}:`, extractData)
          extractedData = {
            _error: 'Invalid API response structure',
            _raw: JSON.stringify(extractData),
            _framework: framework,
            _model: 'gpt-4o-mini'
          }
        } else {
          const extractedText = extractData.choices[0].message.content || ''


          // Try to parse JSON
          try {
            // Remove markdown code blocks if present
            const jsonText = extractedText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

            // Check if response is empty
            if (!jsonText) {
              throw new Error('AI returned empty response')
            }

            extractedData = JSON.parse(jsonText)

            // Attach citation info to each Q&A item
            if (framework === 'starbursting' || framework === 'dime') {
              Object.keys(extractedData).forEach(category => {
                if (Array.isArray(extractedData[category])) {
                  extractedData[category] = extractedData[category].map((item: any) => {
                    if (typeof item === 'object' && 'question' in item) {
                      return {
                        ...item,
                        citationId: citationId,
                        sourceUrl: url,
                        sourceTitle: title,
                        sourceDate: `${citationFields.year}-${citationFields.month}-${citationFields.day}`,
                        sourceAuthor: citationFields.authors[0].lastName
                      }
                    }
                    return item
                  })
                }
              })
            }
          } catch (e) {
            console.error(`Failed to parse extracted JSON for ${framework}:`, e)
            console.error('Raw extracted text:', extractedText)
            extractedData = {
              _raw: extractedText || '(empty response)',
              _parseError: (e as Error).message,
              _framework: framework,
              _model: 'gpt-4o-mini'
            }
          }
        }
      } catch (extractError) {
        console.error(`OpenAI extraction API error for ${framework}:`, extractError)
        extractedData = {
          _error: `Failed to extract ${framework} data`,
          _model: 'gpt-4o-mini',
          _framework: framework
        }
      }

    // Generate unanswered questions for Q&A frameworks (starbursting, dime)
    // Using reduced count (1-2 per category instead of 2-3) to keep it fast
    if ((framework === 'starbursting' || framework === 'dime') &&
        !extractedData._error &&
        !extractedData._parseError) {


      const unansweredPrompt = framework === 'starbursting'
        ? `Based on this article, generate 1-2 important follow-up questions for each category that CANNOT be answered from the article content.

Article Title: ${title}
Article URL: ${url}
Article Content: ${content.substring(0, 10000)}

CRITICAL REQUIREMENTS:
- Include the specific article title in each question (NEVER use "this article", "the article", "this", or "it")
- Include specific dates, event names, and entity names where relevant
- Questions must be self-contained and understandable without seeing the article
- Replace ALL pronouns with specific references
- Focus on information gaps that would be valuable to investigate further

Example GOOD question: "What specific military capabilities did China deploy in the South China Sea during the incidents described in '${title}' (${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })})?"
Example BAD question: "What military capabilities were used?" (vague, no context)

Return ONLY JSON:
{"who": ["Specific Q1 with article title?", "Specific Q2 with article title?"], "what": ["Specific Q1?", "Specific Q2?"], "when": ["Specific Q1?", "Specific Q2?"], "where": ["Specific Q1?", "Specific Q2?"], "why": ["Specific Q1?", "Specific Q2?"], "how": ["Specific Q1?", "Specific Q2?"]}`
        : `Based on this article, generate 1-2 important follow-up questions for each DIME category that CANNOT be answered from the article content.

Article Title: ${title}
Article URL: ${url}
Article Content: ${content.substring(0, 10000)}

CRITICAL REQUIREMENTS:
- Include the specific article title in each question (NEVER use "this article", "the article", "this", or "it")
- Include specific dates, event names, country names, and entity names where relevant
- Questions must be self-contained and understandable without seeing the article
- Replace ALL pronouns with specific references
- Focus on information gaps in each DIME dimension

Example GOOD question: "What economic sanctions did European Union members impose on Russia following the events described in '${title}' (${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })})?"
Example BAD question: "What sanctions were imposed?" (vague, no context)

Return ONLY JSON:
{"diplomatic": ["Specific Q1 with article title?", "Specific Q2 with article title?"], "information": ["Specific Q1?", "Specific Q2?"], "military": ["Specific Q1?", "Specific Q2?"], "economic": ["Specific Q1?", "Specific Q2?"]}`


      // Build system prompt with language instruction if needed
      const unansweredSystemPrompt = language && language !== 'en'
        ? `You are an expert intelligence analyst. Generate relevant unanswered questions that would help researchers identify information gaps. CRITICAL: Each question must include the specific article title, dates, entity names, and event names. NEVER use pronouns like "this", "it", "the article" - always use specific references. Questions must be self-contained and understandable without seeing the article. Return ONLY valid JSON.${languageInstruction}`
        : 'You are an expert intelligence analyst. Generate relevant unanswered questions that would help researchers identify information gaps. CRITICAL: Each question must include the specific article title, dates, entity names, and event names. NEVER use pronouns like "this", "it", "the article" - always use specific references. Questions must be self-contained and understandable without seeing the article. Return ONLY valid JSON.'

      try {
        const unansweredData = await callOpenAIViaGateway(context.env, {
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: unansweredSystemPrompt
            },
            {
              role: 'user',
              content: unansweredPrompt + languageInstruction
            }
          ],
          max_completion_tokens: 800  // Reduced from 2000 for faster response
        }, {
          cacheTTL: getOptimalCacheTTL('content-intelligence'),
          metadata: {
            endpoint: 'ai-scrape',
            operation: 'generate-unanswered-questions',
            framework: framework,
            url: url
          },
          timeout: 15000
        })


        // Validate response structure
        if (!unansweredData.choices || !unansweredData.choices[0] || !unansweredData.choices[0].message) {
          console.error('Invalid OpenAI unanswered questions response structure:', unansweredData)
        } else {
          const unansweredText = unansweredData.choices[0].message.content || ''

          try {
            const jsonText = unansweredText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

            // Check if response is empty
            if (!jsonText) {
              throw new Error('AI returned empty response for unanswered questions')
            }

            const unansweredQuestions = JSON.parse(jsonText)
            extractedData._unansweredQuestions = unansweredQuestions
          } catch (e) {
            console.error('Failed to parse unanswered questions JSON:', e)
            console.error('Raw unanswered questions text:', unansweredText)
          }
        }
      } catch (unansweredError) {
        console.error('Failed to generate unanswered questions:', unansweredError)
      }
    }

    // Build response with all data
    const result: ScrapeResponse = {
      url,
      title,
      content: content.substring(0, 5000), // Return first 5KB for reference
      summary,
      extractedData,
      metadata: {
        source: parsedUrl.hostname
      },
      citation: generatedCitation
    }


    // Cache the result in KV for 1 hour (3600 seconds)
    // This saves significant AI API costs on repeated requests
    try {
      await context.env.CACHE.put(cacheKey, JSON.stringify(result), {
        expirationTtl: 3600 // 1 hour TTL
      })
    } catch (cacheError) {
      console.error('[Scrape] Failed to cache result:', cacheError)
      // Continue anyway - caching is optional
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-Cache': 'MISS'
      }
    })

  } catch (error) {
    console.error('Scraping error:', error)

    // Create user-friendly error message
    let userMessage = 'Failed to scrape the URL'
    let suggestions: string[] = []
    let errorType = 'unknown'

    if (error instanceof Error) {
      // Network/timeout errors
      if (error.name === 'AbortError' || error.message?.includes('timeout')) {
        errorType = 'timeout'
        userMessage = 'The website took too long to respond'
        suggestions = [
          'Try again - the site might be temporarily slow',
          'Check if the URL is accessible',
          'The website might be blocking automated requests'
        ]
      }
      // Fetch/network errors
      else if (error.message?.includes('fetch') || error.message?.includes('network')) {
        errorType = 'network'
        userMessage = 'Unable to connect to the website'
        suggestions = [
          'Check your internet connection',
          'Verify the URL is correct and accessible',
          'The website might be down'
        ]
      }
      // Invalid URL
      else if (error.message?.includes('Invalid URL')) {
        errorType = 'invalid_url'
        userMessage = 'The URL format is invalid'
        suggestions = [
          'Make sure the URL starts with http:// or https://',
          'Check for typos in the URL',
          'Ensure the URL is complete'
        ]
      }
      // AI/parsing errors
      else if (error.message?.includes('OpenAI') || error.message?.includes('AI') || error.message?.includes('parse')) {
        errorType = 'parsing'
        userMessage = 'Failed to analyze the content'
        suggestions = [
          'The page content might be too complex',
          'Try a different page from the same site',
          'Some pages cannot be automatically analyzed'
        ]
      }
      // Generic error
      else {
        errorType = 'parsing'
        userMessage = 'Failed to extract content from the website'
        suggestions = [
          'The page structure might be unusual',
          'Try a different page or source',
          'Some content requires JavaScript which we cannot execute'
        ]
      }
    }

    return new Response(JSON.stringify({
      error: userMessage,
      errorType,
      suggestions
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
