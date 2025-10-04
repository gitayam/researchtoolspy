/**
 * AI Generation API
 *
 * Handles AI content generation requests
 * POST: Generate content based on prompt and context
 */

interface Env {
  AI_CONFIG: KVNamespace
  OPENAI_API_KEY?: string
  OPENAI_ORGANIZATION?: string
  ENABLE_AI_FEATURES?: string
}

interface GenerateRequest {
  prompt: string
  model?: 'gpt-5' | 'gpt-5-mini' | 'gpt-5-nano'
  useCase?: 'summarization' | 'questionGeneration' | 'deepAnalysis' | 'fieldSuggestions' | 'formatting' | 'guidance'
  maxTokens?: number
  verbosity?: 'low' | 'medium' | 'high'
  reasoningEffort?: 'minimal'
}

const MODEL_PRICING = {
  'gpt-5': {
    input: 1.25,  // $1.25 per 1M tokens
    output: 10.0  // $10.00 per 1M tokens
  },
  'gpt-5-mini': {
    input: 0.25,
    output: 2.0
  },
  'gpt-5-nano': {
    input: 0.05,
    output: 0.40
  }
}

function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = MODEL_PRICING[model as keyof typeof MODEL_PRICING] || MODEL_PRICING['gpt-5-mini']
  const inputCost = (inputTokens / 1_000_000) * pricing.input
  const outputCost = (outputTokens / 1_000_000) * pricing.output
  return inputCost + outputCost
}

/**
 * POST /api/ai/generate
 * Generate AI content
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    // Check if AI features are enabled
    if (context.env.ENABLE_AI_FEATURES !== 'true') {
      return Response.json({
        error: 'AI features are disabled'
      }, { status: 403 })
    }

    // Get API key
    const apiKey = context.env.OPENAI_API_KEY
    if (!apiKey) {
      return Response.json({
        error: 'OpenAI API key not configured'
      }, { status: 500 })
    }

    const request = await context.request.json() as GenerateRequest

    if (!request.prompt) {
      return Response.json({
        error: 'Missing prompt'
      }, { status: 400 })
    }

    // Load configuration from KV
    let config
    try {
      config = await context.env.AI_CONFIG.get('default', { type: 'json' })
    } catch (error) {
      console.warn('Failed to load config from KV, using defaults')
      config = null
    }

    // Determine model to use
    let model = request.model
    if (!model && request.useCase && config?.useCases) {
      model = config.useCases[request.useCase]
    }
    if (!model) {
      model = config?.defaultModel || 'gpt-5-mini'
    }

    // Get model settings
    const modelSettings = config?.models?.[model] || {
      verbosity: 'medium',
      maxTokens: 2048,
      systemPrompt: 'You are an intelligence analyst assistant.'
    }

    // Build OpenAI request
    const openaiRequest = {
      model,
      messages: [
        {
          role: 'system',
          content: modelSettings.systemPrompt
        },
        {
          role: 'user',
          content: request.prompt
        }
      ],
      max_completion_tokens: request.maxTokens || modelSettings.maxTokens,
      ...(request.verbosity && { verbosity: request.verbosity }),
      ...(request.reasoningEffort && { reasoning_effort: request.reasoningEffort })
    }

    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        ...(context.env.OPENAI_ORGANIZATION && {
          'OpenAI-Organization': context.env.OPENAI_ORGANIZATION
        })
      },
      body: JSON.stringify(openaiRequest)
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }))
      console.error('OpenAI API error:', error)
      return Response.json({
        error: 'AI generation failed',
        message: error.error?.message || response.statusText
      }, { status: response.status })
    }

    const data = await response.json()

    // Extract response
    const content = data.choices[0].message.content
    const tokensUsed = {
      input: data.usage.prompt_tokens,
      output: data.usage.completion_tokens,
      total: data.usage.total_tokens
    }

    // Calculate cost
    const cost = estimateCost(model, tokensUsed.input, tokensUsed.output)

    // Update usage statistics in KV (async, don't wait)
    context.waitUntil(updateUsageStats(context.env.AI_CONFIG, tokensUsed.total, cost))

    return Response.json({
      content,
      model,
      tokensUsed,
      estimatedCost: cost,
      finishReason: data.choices[0].finish_reason
    })
  } catch (error) {
    console.error('Generation error:', error)
    return Response.json({
      error: 'Generation failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

/**
 * Update usage statistics in KV
 */
async function updateUsageStats(kv: KVNamespace, tokens: number, cost: number) {
  try {
    const config = await kv.get('default', { type: 'json' }) as any
    if (!config) return

    if (!config.costs) {
      config.costs = {
        totalTokensUsed: 0,
        estimatedCost: 0,
        lastReset: new Date().toISOString()
      }
    }

    // Reset daily counters if needed
    const lastReset = new Date(config.costs.lastReset)
    const now = new Date()
    const daysSinceReset = (now.getTime() - lastReset.getTime()) / (1000 * 60 * 60 * 24)

    if (daysSinceReset >= 1) {
      config.costs.totalTokensUsed = 0
      config.costs.estimatedCost = 0
      config.costs.lastReset = now.toISOString()
    }

    // Update counters
    config.costs.totalTokensUsed += tokens
    config.costs.estimatedCost += cost

    await kv.put('default', JSON.stringify(config))
  } catch (error) {
    console.error('Failed to update usage stats:', error)
  }
}
