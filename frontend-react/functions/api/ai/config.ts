/**
 * AI Configuration API
 *
 * Manages AI configuration stored in Cloudflare KV
 * GET: Retrieve current configuration
 * PUT: Update configuration
 */

interface Env {
  AI_CONFIG: KVNamespace
  OPENAI_API_KEY?: string
  OPENAI_ORGANIZATION?: string
  ENABLE_AI_FEATURES?: string
  DEFAULT_AI_MODEL?: string
}

const DEFAULT_CONFIG = {
  defaultModel: 'gpt-4o-mini',
  models: {
    'gpt-5': {
      verbosity: 'high',
      maxTokens: 4096,
      systemPrompt: 'You are an expert intelligence analyst assistant. Provide detailed, structured analysis following intelligence community standards. Focus on analytical rigor, evidence-based reasoning, and clear communication. Always consider alternative hypotheses and indicate confidence levels.'
    },
    'gpt-4o-mini': {
      verbosity: 'medium',
      maxTokens: 2048,
      systemPrompt: 'You are an intelligence analyst assistant. Provide clear, concise analysis based on the provided evidence. Use structured formats (bullet points, numbered lists) when appropriate. Be objective and highlight key findings.'
    },
    'gpt-5-nano': {
      verbosity: 'low',
      reasoningEffort: 'minimal',
      maxTokens: 1024,
      systemPrompt: 'You are a research assistant. Provide brief, focused responses. Use bullet points for clarity. Be concise and actionable.'
    }
  },
  useCases: {
    summarization: 'gpt-4o-mini',
    questionGeneration: 'gpt-5-nano',
    deepAnalysis: 'gpt-5',
    fieldSuggestions: 'gpt-5-nano',
    formatting: 'gpt-5-nano',
    guidance: 'gpt-5-nano'
  },
  features: {
    enableSummarization: true,
    enableQuestionGeneration: true,
    enableFieldSuggestions: true,
    enableGuidance: true,
    enableAutoFormat: false
  },
  rateLimits: {
    requestsPerMinute: 20,
    tokensPerDay: 1000000
  },
  costs: {
    totalTokensUsed: 0,
    estimatedCost: 0,
    lastReset: new Date().toISOString()
  }
}

/**
 * GET /api/ai/config
 * Retrieve AI configuration
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const enableAI = context.env.ENABLE_AI_FEATURES === 'true'

    if (!enableAI) {
      return Response.json({
        enabled: false,
        message: 'AI features are disabled'
      }, { status: 200 })
    }

    // Try to get configuration from KV
    let config
    try {
      const stored = await context.env.AI_CONFIG.get('default', { type: 'json' })
      config = stored || DEFAULT_CONFIG
    } catch (error) {
      console.warn('KV read failed, using default config:', error)
      config = DEFAULT_CONFIG
    }

    // Override with environment variables
    if (context.env.DEFAULT_AI_MODEL) {
      config.defaultModel = context.env.DEFAULT_AI_MODEL
    }

    // Never expose API key to client
    const safeConfig = {
      ...config,
      enabled: true,
      hasApiKey: !!(context.env.OPENAI_API_KEY || config.apiKey),
      apiKey: undefined,
      organization: undefined
    }

    return Response.json(safeConfig, {
      headers: {
        'Cache-Control': 'private, max-age=300'
      }
    })
  } catch (error) {
    console.error('Config retrieval error:', error)
    return Response.json({
      error: 'Failed to retrieve configuration',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

/**
 * PUT /api/ai/config
 * Update AI configuration
 */
export const onRequestPut: PagesFunction<Env> = async (context) => {
  try {
    // TODO: Add authentication check
    // Only allow authenticated admins to update config

    const newConfig = await context.request.json()

    // Validate configuration
    if (!newConfig.defaultModel || !['gpt-5', 'gpt-4o-mini', 'gpt-5-nano'].includes(newConfig.defaultModel)) {
      return Response.json({
        error: 'Invalid configuration',
        message: 'defaultModel must be one of: gpt-5, gpt-4o-mini, gpt-5-nano'
      }, { status: 400 })
    }

    // Validate rate limits
    if (newConfig.rateLimits) {
      if (newConfig.rateLimits.requestsPerMinute < 1 || newConfig.rateLimits.requestsPerMinute > 100) {
        return Response.json({
          error: 'Invalid rate limit',
          message: 'requestsPerMinute must be between 1 and 100'
        }, { status: 400 })
      }
    }

    // Store in KV
    await context.env.AI_CONFIG.put('default', JSON.stringify(newConfig))

    return Response.json({
      success: true,
      message: 'Configuration updated successfully'
    })
  } catch (error) {
    console.error('Config update error:', error)
    return Response.json({
      error: 'Failed to update configuration',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

/**
 * POST /api/ai/config/reset
 * Reset to default configuration
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    // TODO: Add authentication check

    await context.env.AI_CONFIG.put('default', JSON.stringify(DEFAULT_CONFIG))

    return Response.json({
      success: true,
      message: 'Configuration reset to defaults',
      config: DEFAULT_CONFIG
    })
  } catch (error) {
    console.error('Config reset error:', error)
    return Response.json({
      error: 'Failed to reset configuration',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
