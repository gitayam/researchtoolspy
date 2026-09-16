/**
 * AI Configuration API
 *
 * Manages AI configuration stored in Cloudflare KV
 * GET: Retrieve current configuration
 * PUT: Update configuration
 */

import { DEFAULT_MODELS, resolveModel } from '../_shared/ai-models'
import { getUserFromRequest } from '../_shared/auth-helpers'

interface Env {
  AI_CONFIG: KVNamespace
  OPENAI_API_KEY?: string
  OPENAI_ORGANIZATION?: string
  ENABLE_AI_FEATURES?: string
  DEFAULT_AI_MODEL?: string
  SESSIONS?: KVNamespace
}

const DEFAULT_CONFIG = {
  defaultModel: DEFAULT_MODELS.cheap,
  models: {
    [DEFAULT_MODELS.standard]: {
      maxTokens: 4096,
      systemPrompt: 'You are an expert intelligence analyst assistant. Provide detailed, structured analysis following intelligence community standards. Focus on analytical rigor, evidence-based reasoning, and clear communication. Always consider alternative hypotheses and indicate confidence levels.'
    },
    [DEFAULT_MODELS.cheap]: {
      maxTokens: 2048,
      systemPrompt: 'You are an intelligence analyst assistant. Provide clear, concise analysis based on the provided evidence. Use structured formats (bullet points, numbered lists) when appropriate. Be objective and highlight key findings.'
    }
  },
  // The old three-way split (mini / nano / full) mapped two of its three choices
  // onto models that gpt-5.6-luna now beats on both price axes, so the cheap tier
  // carries everything that is not deep analysis.
  useCases: {
    summarization: DEFAULT_MODELS.cheap,
    questionGeneration: DEFAULT_MODELS.cheap,
    deepAnalysis: DEFAULT_MODELS.standard,
    generation: DEFAULT_MODELS.cheap,
    fieldSuggestions: DEFAULT_MODELS.cheap,
    formatting: DEFAULT_MODELS.cheap,
    guidance: DEFAULT_MODELS.cheap
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
      message: 'AI request failed'
    }, { status: 500 })
  }
}

/**
 * PUT /api/ai/config
 * Update AI configuration
 */
export const onRequestPut: PagesFunction<Env> = async (context) => {
  try {
    const userId = await getUserFromRequest(context.request, context.env)
    if (!userId) {
      return Response.json({ error: 'Authentication required' }, { status: 401 })
    }

    const newConfig = await context.request.json() as Partial<typeof DEFAULT_CONFIG>

    // A tier name, or any model the gateway will accept. The old list named the
    // gpt-5.4 family only, which meant an operator could not select a current
    // model — the allow-list outlived the models it was written for. A retired
    // ID is still accepted here and remapped at the gateway, so a stored config
    // written before this change keeps working.
    const selectableModels = [...Object.keys(DEFAULT_MODELS), ...Object.values(DEFAULT_MODELS)]
    if (!newConfig.defaultModel || typeof newConfig.defaultModel !== 'string') {
      return Response.json({
        error: 'Invalid configuration',
        message: `defaultModel is required — a tier (${Object.keys(DEFAULT_MODELS).join(', ')}) or a model ID`
      }, { status: 400 })
    }
    if (!selectableModels.includes(newConfig.defaultModel)
      && resolveModel(newConfig.defaultModel, 'cheap', context.env) === newConfig.defaultModel
      && !newConfig.defaultModel.startsWith('gpt-')) {
      return Response.json({
        error: 'Invalid configuration',
        message: `defaultModel must be a tier (${Object.keys(DEFAULT_MODELS).join(', ')}) or an OpenAI model ID`
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
      message: 'AI request failed'
    }, { status: 500 })
  }
}

/**
 * POST /api/ai/config/reset
 * Reset to default configuration
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const userId = await getUserFromRequest(context.request, context.env)
    if (!userId) {
      return Response.json({ error: 'Authentication required' }, { status: 401 })
    }

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
      message: 'AI request failed'
    }, { status: 500 })
  }
}
