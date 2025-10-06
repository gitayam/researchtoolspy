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

// Framework question generation configurations
const FRAMEWORK_CONFIGS: Record<string, {
  categories: string[]
  categoryDescriptions: Record<string, string>
  frameworkDescription: string
}> = {
  starbursting: {
    categories: ['who', 'what', 'when', 'where', 'why', 'how'],
    categoryDescriptions: {
      who: 'people/stakeholders',
      what: 'actions/things',
      when: 'timing',
      where: 'location',
      why: 'reasons/motivations',
      how: 'methods/processes'
    },
    frameworkDescription: 'Starbursting'
  },
  dime: {
    categories: ['diplomatic', 'information', 'military', 'economic'],
    categoryDescriptions: {
      diplomatic: 'relationships/negotiations',
      information: 'intelligence/communications',
      military: 'force/capabilities',
      economic: 'resources/sanctions'
    },
    frameworkDescription: 'DIME framework'
  },
  'pmesii-pt': {
    categories: ['political', 'military', 'economic', 'social', 'information', 'infrastructure', 'physical', 'time'],
    categoryDescriptions: {
      political: 'political structures/governance',
      military: 'military capabilities/posture',
      economic: 'economic systems/resources',
      social: 'social structures/demographics',
      information: 'information systems/flow',
      infrastructure: 'physical/organizational infrastructure',
      physical: 'geography/terrain/climate',
      time: 'temporal factors/timing'
    },
    frameworkDescription: 'PMESII-PT environmental analysis'
  },
  cog: {
    categories: ['center_of_gravity', 'critical_capabilities', 'critical_requirements', 'critical_vulnerabilities'],
    categoryDescriptions: {
      center_of_gravity: 'source of power/strength',
      critical_capabilities: 'primary abilities',
      critical_requirements: 'essential conditions/resources',
      critical_vulnerabilities: 'exploitable weaknesses'
    },
    frameworkDescription: 'Center of Gravity analysis'
  },
  surveillance: {
    categories: ['commanders_guidance', 'intelligence_requirements', 'collection_strategies', 'surveillance_targets', 'reconnaissance_tasks', 'collection_assets', 'processing_plan', 'dissemination'],
    categoryDescriptions: {
      commanders_guidance: 'strategic objectives/priorities',
      intelligence_requirements: 'PIRs/EEIs',
      collection_strategies: 'methods/platforms',
      surveillance_targets: 'entities/locations to monitor',
      reconnaissance_tasks: 'information-gathering missions',
      collection_assets: 'sensors/platforms/resources',
      processing_plan: 'analysis/fusion procedures',
      dissemination: 'intelligence sharing procedures'
    },
    frameworkDescription: 'ISR collection planning'
  },
  'fundamental-flow': {
    categories: ['planning_direction', 'collection', 'processing', 'exploitation_production', 'dissemination', 'feedback_evaluation', 'information_sources', 'flow_metrics'],
    categoryDescriptions: {
      planning_direction: 'requirements definition/priorities',
      collection: 'information gathering methods',
      processing: 'data conversion/structuring',
      exploitation_production: 'analysis/product creation',
      dissemination: 'distribution to consumers',
      feedback_evaluation: 'effectiveness assessment',
      information_sources: 'available feeds/capabilities',
      flow_metrics: 'timeliness/accuracy/relevance measurements'
    },
    frameworkDescription: 'intelligence cycle flow'
  }
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


    // Get framework configuration
    const config = FRAMEWORK_CONFIGS[framework]
    if (!config) {
      return new Response(JSON.stringify({ error: `Unsupported framework: ${framework}` }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Build category descriptions string
    const categoryDescList = config.categories.map(cat =>
      `${cat.charAt(0).toUpperCase() + cat.slice(1).replace('_', ' ')} = ${config.categoryDescriptions[cat]}`
    ).join(', ')

    // Build JSON format example
    const jsonFormat = '{' + config.categories.map(cat =>
      `"${cat}": [${hasExistingQuestions ? '"Specific question 1?", "Specific question 2?"' : '"Question 1?", "Question 2?", "Question 3?"'}]`
    ).join(', ') + '}'

    // Build prompt based on whether we have existing questions
    const prompt = hasExistingQuestions
      ? `You are analyzing an existing ${config.frameworkDescription} analysis. Your task is to generate SPECIFIC, TARGETED follow-up questions that:
- Build directly upon the existing questions and their context
- Identify information gaps that need further investigation
- Are concrete and actionable (not generic or broad)
- Are NOT duplicates of existing questions
- Include specific names, dates, entities, and events (NEVER use "this", "it", "the topic", etc.)
- Are self-contained and understandable without additional context

Existing Analysis:
${existingQuestions}

${analysisContext ? `Analysis Context/Description: ${analysisContext}` : ''}

Generate exactly 2 specific, contextual follow-up questions for each category. Each question must:
- Reference specific aspects mentioned in the existing analysis by name
- Include specific entities, dates, events, or topics (avoid all pronouns)
- Dig deeper into unanswered details
- Be precise and actionable
- Stand alone without requiring the reader to see the original analysis

Example GOOD question: "What economic sanctions did the European Union impose on Russian energy exports following the February 2022 invasion of Ukraine?"
Example BAD question: "What sanctions were imposed?" (too vague, missing context)

Return ONLY valid JSON in this exact format:
${jsonFormat}`
      : `You are analyzing a topic for ${config.frameworkDescription}. Your task is to generate SPECIFIC, TARGETED questions based on the description provided.

Topic/Description:
${analysisContext || 'No description provided'}

Generate exactly 3 specific, insightful questions for each category. Each question must:
- Be directly related to the topic described
- Include specific names, dates, entities, and events from the topic (NEVER use "this topic", "it", "the subject", etc.)
- Be self-contained and understandable without seeing the topic description
- Be specific and actionable (not generic)
- Help uncover critical information about the topic
- Be appropriate for the category (${categoryDescList})

Example GOOD question: "What military capabilities did China deploy in the South China Sea between 2020-2023 according to U.S. Department of Defense assessments?"
Example BAD question: "What capabilities were deployed?" (too vague, missing context)

Return ONLY valid JSON in this exact format:
${jsonFormat}`
    // Calculate appropriate token limit based on mode and framework
    // Initial questions need more tokens than follow-ups
    // More categories = more tokens needed
    const categoryCount = config.categories.length
    const baseTokens = categoryCount <= 4 ? 900 : (categoryCount <= 6 ? 1100 : 1400)
    const maxTokens = hasExistingQuestions
      ? 800  // Follow-up: 2 questions per category
      : baseTokens  // Initial: 3 questions per category

    // Log API call details
    console.log(`[Generate Questions] Calling OpenAI API`)
    console.log(`[Generate Questions] Model: gpt-4o-mini`)
    console.log(`[Generate Questions] Max tokens:`, maxTokens)
    console.log(`[Generate Questions] Prompt preview:`, prompt.substring(0, 200))

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: hasExistingQuestions
              ? 'You are an expert intelligence analyst specializing in identifying critical information gaps. Generate SPECIFIC, CONTEXTUAL follow-up questions that build upon existing analysis. CRITICAL: Your questions must include specific names, dates, entities, and events - NEVER use pronouns like "this", "it", "the topic". Questions must be self-contained and understandable without seeing the original analysis. Be concrete, actionable, and reference specific details by name. Return ONLY valid JSON with no other text.'
              : 'You are an expert intelligence analyst specializing in generating insightful questions for analysis. Generate SPECIFIC, TARGETED initial questions based on the topic description. CRITICAL: Your questions must include specific names, dates, entities, and events from the topic - NEVER use pronouns like "this", "it", "the subject". Questions must be self-contained and understandable without seeing the topic description. Be concrete, actionable, and directly related to the topic. Return ONLY valid JSON with no other text.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_completion_tokens: maxTokens
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
