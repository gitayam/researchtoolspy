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

    console.log(`[Generate Questions] Starting - Framework: ${framework}`)
    console.log(`[Generate Questions] Has context description:`, !!analysisContext)
    console.log(`[Generate Questions] Context length:`, analysisContext?.length || 0)

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

    // Check if there are any existing questions
    const hasExistingQuestions = existingQuestions.trim().length > 0
    console.log(`[Generate Questions] Has existing questions:`, hasExistingQuestions)
    console.log(`[Generate Questions] Generation mode:`, hasExistingQuestions ? 'follow-up' : 'initial')

    // If no existing questions, generate initial questions from context
    // If existing questions, generate follow-up questions
    const prompt = framework === 'starbursting'
      ? (hasExistingQuestions
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
          : `You are analyzing a topic for Starbursting analysis. Your task is to generate SPECIFIC, TARGETED questions based on the description provided.

Topic/Description:
${analysisContext || 'No description provided'}

Generate exactly 3 specific, insightful questions for each category (Who, What, When, Where, Why, How). Each question must:
- Be directly related to the topic described
- Be specific and actionable (not generic)
- Help uncover critical information about the topic
- Be appropriate for the category (Who = people/stakeholders, What = actions/things, When = timing, Where = location, Why = reasons/motivations, How = methods/processes)

Return ONLY valid JSON in this exact format:
{"who": ["Question 1?", "Question 2?", "Question 3?"], "what": ["Question 1?", "Question 2?", "Question 3?"], "when": ["Question 1?", "Question 2?", "Question 3?"], "where": ["Question 1?", "Question 2?", "Question 3?"], "why": ["Question 1?", "Question 2?", "Question 3?"], "how": ["Question 1?", "Question 2?", "Question 3?"]}`)
      : (hasExistingQuestions
          ? `You are analyzing an existing DIME framework analysis. Your task is to generate SPECIFIC, TARGETED follow-up questions that:
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
          : `You are analyzing a topic for DIME framework analysis. Your task is to generate SPECIFIC, TARGETED questions based on the description provided.

Topic/Description:
${analysisContext || 'No description provided'}

Generate exactly 3 specific, insightful questions for each DIME dimension (Diplomatic, Information, Military, Economic). Each question must:
- Be directly related to the topic described
- Be specific and actionable (not generic)
- Help analyze the dimension's impact and considerations
- Be appropriate for the dimension (Diplomatic = relationships/negotiations, Information = intelligence/communications, Military = force/capabilities, Economic = resources/sanctions)

Return ONLY valid JSON in this exact format:
{"diplomatic": ["Question 1?", "Question 2?", "Question 3?"], "information": ["Question 1?", "Question 2?", "Question 3?"], "military": ["Question 1?", "Question 2?", "Question 3?"], "economic": ["Question 1?", "Question 2?", "Question 3?"]}`)

    // Log API call details
    console.log(`[Generate Questions] Calling OpenAI API`)
    console.log(`[Generate Questions] Model: gpt-5-mini`)
    console.log(`[Generate Questions] Max tokens: 800`)
    console.log(`[Generate Questions] Prompt preview:`, prompt.substring(0, 200))

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
            content: hasExistingQuestions
              ? 'You are an expert intelligence analyst specializing in identifying critical information gaps. Generate SPECIFIC, CONTEXTUAL follow-up questions that build upon existing analysis. Your questions must be concrete, actionable, and reference specific details from the analysis - never generic or broad. Return ONLY valid JSON with no other text.'
              : 'You are an expert intelligence analyst specializing in generating insightful questions for analysis. Generate SPECIFIC, TARGETED initial questions based on the topic description. Your questions must be concrete, actionable, and directly related to the topic - never generic or broad. Return ONLY valid JSON with no other text.'
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

    // Log full response for debugging
    console.log('[Generate Questions] OpenAI API response received')
    console.log('[Generate Questions] Choices count:', data.choices?.length || 0)

    // Validate response structure
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error('[Generate Questions] Invalid OpenAI response structure:', JSON.stringify(data))
      throw new Error(`Invalid API response structure. Response: ${JSON.stringify(data).substring(0, 200)}`)
    }

    const generatedText = data.choices[0].message.content || ''
    console.log('[Generate Questions] Raw response length:', generatedText.length)

    // Validate content exists BEFORE cleaning
    if (!generatedText.trim()) {
      console.error('[Generate Questions] AI returned empty content')
      console.error('[Generate Questions] Full response:', JSON.stringify(data))
      throw new Error('AI returned empty response. This may be due to timeout, token limits, or model issues. Please try again with a shorter description.')
    }

    const jsonText = generatedText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    console.log('[Generate Questions] Cleaned JSON length:', jsonText.length)

    if (!jsonText) {
      console.error('[Generate Questions] Empty response after cleaning markdown')
      console.error('[Generate Questions] Raw text was:', generatedText)
      throw new Error(`AI returned response but it was empty after cleaning. Raw: ${generatedText.substring(0, 100)}`)
    }

    let questions
    try {
      questions = JSON.parse(jsonText)
      console.log(`[Generate Questions] Successfully parsed ${Object.keys(questions).length} categories`)
    } catch (parseError) {
      console.error('[Generate Questions] JSON parse error:', parseError)
      console.error('[Generate Questions] Failed to parse:', jsonText.substring(0, 500))
      throw new Error(`Failed to parse AI response as JSON. Error: ${parseError instanceof Error ? parseError.message : 'Unknown'}. Response preview: ${jsonText.substring(0, 200)}`)
    }

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
