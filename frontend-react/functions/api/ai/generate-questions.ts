/**
 * Generate Follow-up Questions API
 * 
 * Generates unanswered follow-up questions based on existing analysis content
 */

interface Env {
  OPENAI_API_KEY: string
  CACHE: KVNamespace
}

interface QuestionRequest {
  framework: string
  existingData: Record<string, any>
  context?: string
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const request = await context.request.json() as QuestionRequest
    const { framework, existingData, context: analysisContext } = request

    console.log(`[Generate Questions] Framework: ${framework}`)

    const apiKey = context.env.OPENAI_API_KEY
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'OpenAI API key not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // KV Cache Check - cache based on framework and existing questions hash
    // Since existingData determines the output, we can safely cache
    const dataHash = JSON.stringify(existingData).substring(0, 100) // Simple hash
    const cacheKey = `questions:${framework}:${dataHash}`

    const cached = await context.env.CACHE.get(cacheKey, 'json')
    if (cached) {
      console.log(`[Generate Questions] Cache HIT for ${cacheKey}`)
      return new Response(JSON.stringify(cached), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Cache': 'HIT'
        }
      })
    }
    console.log(`[Generate Questions] Cache MISS for ${cacheKey}`)

    // Build context from existing data
    const existingQuestions = Object.entries(existingData)
      .map(([category, items]) => {
        if (Array.isArray(items)) {
          return `${category}: ${items.map((item: any) => 
            typeof item === 'object' && item.question ? item.question : item
          ).join(', ')}`
        }
        return ''
      })
      .filter(Boolean)
      .join('\n')

    const prompt = framework === 'starbursting'
      ? `You are analyzing an existing Starbursting analysis. Your task is to generate SPECIFIC, TARGETED follow-up questions that:
- Build directly upon the existing questions and their context
- Identify information gaps that need further investigation
- Are concrete and actionable (not generic or broad)
- Are NOT duplicates of existing questions

Existing Analysis:
${existingQuestions}

${analysisContext ? `Analysis Context/Description: ${analysisContext}` : ''}

Generate exactly 2 specific, contextual follow-up questions for each category. Each question must:
- Reference specific aspects mentioned in the existing analysis
- Dig deeper into unanswered details
- Be precise and actionable

Return ONLY valid JSON in this exact format:
{"who": ["Specific question 1?", "Specific question 2?"], "what": ["Specific question 1?", "Specific question 2?"], "when": ["Specific question 1?", "Specific question 2?"], "where": ["Specific question 1?", "Specific question 2?"], "why": ["Specific question 1?", "Specific question 2?"], "how": ["Specific question 1?", "Specific question 2?"]}`
      : `You are analyzing an existing DIME framework analysis. Your task is to generate SPECIFIC, TARGETED follow-up questions that:
- Build directly upon the existing questions and their context
- Identify information gaps in each DIME dimension
- Are concrete and actionable (not generic or broad)
- Are NOT duplicates of existing questions

Existing Analysis:
${existingQuestions}

${analysisContext ? `Analysis Context/Description: ${analysisContext}` : ''}

Generate exactly 2 specific, contextual follow-up questions for each DIME dimension. Each question must:
- Reference specific aspects mentioned in the existing analysis
- Dig deeper into unanswered details within that dimension
- Be precise and actionable

Return ONLY valid JSON in this exact format:
{"diplomatic": ["Specific question 1?", "Specific question 2?"], "information": ["Specific question 1?", "Specific question 2?"], "military": ["Specific question 1?", "Specific question 2?"], "economic": ["Specific question 1?", "Specific question 2?"]}`

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
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
            content: 'You are an expert intelligence analyst specializing in identifying critical information gaps. Generate SPECIFIC, CONTEXTUAL follow-up questions that build upon existing analysis. Your questions must be concrete, actionable, and reference specific details from the analysis - never generic or broad. Return ONLY valid JSON with no other text.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_completion_tokens: 800
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
      console.error('OpenAI API error:', errorData)
      throw new Error(`AI generation failed: ${JSON.stringify(errorData)}`)
    }

    const data = await response.json()

    // Validate response structure
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('Invalid API response structure')
    }

    const generatedText = data.choices[0].message.content || ''
    const jsonText = generatedText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

    if (!jsonText) {
      throw new Error('AI returned empty response')
    }

    const questions = JSON.parse(jsonText)
    console.log(`[Generate Questions] Generated ${Object.keys(questions).length} categories`)

    const result = { questions }

    // Cache the result for 30 minutes
    try {
      await context.env.CACHE.put(cacheKey, JSON.stringify(result), {
        expirationTtl: 1800 // 30 minutes TTL
      })
      console.log(`[Generate Questions] Cached result with key: ${cacheKey}`)
    } catch (cacheError) {
      console.error('[Generate Questions] Failed to cache result:', cacheError)
      // Continue anyway
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-Cache': 'MISS'
      }
    })

  } catch (error) {
    console.error('Question generation error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to generate questions',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
