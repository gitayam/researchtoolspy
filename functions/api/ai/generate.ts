/**
 * AI Generation API
 *
 * Handles AI content generation requests
 * POST: Generate content based on prompt and context
 */

import { getUserFromRequest } from '../_shared/auth-helpers'
import { requireConsent } from '../_shared/consent'
import { JSON_HEADERS } from '../_shared/api-utils'
import { callOpenAIViaGateway, ANALYST_SYSTEM_PREFIX, REFUSAL_BODY } from '../_shared/ai-gateway'
import { estimateCost } from '../_shared/ai-models'
import { aiModel } from '../_shared/ai-models'

interface Env {
  DB: D1Database
  AI_CONFIG: KVNamespace
  OPENAI_API_KEY?: string
  OPENAI_ORGANIZATION?: string
  ENABLE_AI_FEATURES?: string
}

interface GenerateRequest {
  prompt: string
  /** A model ID or a tier name. Resolved and validated at the gateway. */
  model?: string
  useCase?: 'summarization' | 'questionGeneration' | 'deepAnalysis' | 'fieldSuggestions' | 'formatting' | 'guidance'
  maxTokens?: number
  verbosity?: 'low' | 'medium' | 'high'
  reasoningEffort?: 'none' | 'low' | 'medium' | 'high' | 'xhigh' | 'max'
}


/**
 * POST /api/ai/generate
 * Generate AI content
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const authUserId = await getUserFromRequest(context.request, context.env)
    if (!authUserId) {
      return Response.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Sensitive-use gate: arbitrary generation requires recorded consent
    const consentGate = await requireConsent(context.env as any, authUserId)
    if (consentGate) return consentGate

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
      model = config?.defaultModel || aiModel('cheap', context.env)
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
          content: `${ANALYST_SYSTEM_PREFIX}${modelSettings.systemPrompt}`
        },
        {
          role: 'user',
          content: request.prompt
        }
      ],
      max_completion_tokens: request.maxTokens || modelSettings.maxTokens,
      ...(request.reasoningEffort && { reasoning_effort: request.reasoningEffort })
    }

    // Call OpenAI via AI Gateway (no caching for arbitrary user generation)
    const data = await callOpenAIViaGateway(context.env, openaiRequest, {
      metadata: { endpoint: 'ai/generate' },
      cacheTTL: 0
    })

    if (data?._refusal) {
      return new Response(JSON.stringify(REFUSAL_BODY), { status: 200, headers: JSON_HEADERS })
    }

    // Extract response
    const content = data.choices[0].message.content
    const tokensUsed = {
      input: data.usage.prompt_tokens,
      output: data.usage.completion_tokens,
      total: data.usage.total_tokens
    }

    // Price what actually ran, not what was asked for: a tier or a retired ID
    // resolves at the gateway, so the two differ and the request is the wrong
    // thing to cost. OpenAI echoes the served model back.
    const servedModel = typeof data.model === 'string' && data.model ? data.model : model
    const cost = estimateCost(servedModel, tokensUsed.input, tokensUsed.output, context.env)

    // Update usage statistics in KV (async, don't wait)
    context.waitUntil(updateUsageStats(context.env.AI_CONFIG, tokensUsed.total, cost))

    return Response.json({
      content,
      model: servedModel,
      tokensUsed,
      estimatedCost: cost,
      finishReason: data.choices[0].finish_reason
    })
  } catch (error) {
    console.error('Generation error:', error)
    return Response.json({
      error: 'Generation failed',
      message: 'AI request failed'
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

// Reject GET requests (POST-only endpoint)
export const onRequestGet: PagesFunction = async () => {
  return new Response(JSON.stringify({ error: 'Method not allowed. Use POST.' }), {
    status: 405, headers: JSON_HEADERS,
  })
}
