/**
 * AI Configuration Types and Defaults
 *
 * Manages GPT-5 model configuration, use case mappings, and feature flags
 */

import { DEFAULT_MODELS, estimateCost } from '../../../functions/api/_shared/ai-models'

/** A model ID. See `AIModel` in types/settings.ts for why this is not a union. */
export type AIModel = string

export type AIUseCase =
  | 'summarization'
  | 'questionGeneration'
  | 'deepAnalysis'
  | 'fieldSuggestions'
  | 'formatting'
  | 'guidance'

export type VerbosityLevel = 'low' | 'medium' | 'high'

export interface ModelSettings {
  verbosity: VerbosityLevel
  reasoningEffort?: 'none' | 'low' | 'medium' | 'high'
  maxTokens: number
  systemPrompt: string
}

export interface AIConfiguration {
  // Model Selection
  defaultModel: AIModel

  // Model-Specific Settings
  models: Record<AIModel, ModelSettings>

  // Use Case Mappings
  useCases: Record<AIUseCase, AIModel>

  // API Configuration (stored in KV, not exposed to client)
  apiKey?: string
  organization?: string

  // Feature Flags
  features: {
    enableSummarization: boolean
    enableQuestionGeneration: boolean
    enableFieldSuggestions: boolean
    enableGuidance: boolean
    enableAutoFormat: boolean
  }

  // Rate Limiting
  rateLimits: {
    requestsPerMinute: number
    tokensPerDay: number
  }

  // Cost Tracking
  costs?: {
    totalTokensUsed: number
    estimatedCost: number
    lastReset: string
  }
}

/**
 * Default AI Configuration
 * Optimized for cost-effective intelligence analysis
 */
export const defaultAIConfig: AIConfiguration = {
  defaultModel: DEFAULT_MODELS.cheap,

  models: {
    [DEFAULT_MODELS.standard]: {
      verbosity: 'high',
      maxTokens: 4096,
      systemPrompt: `You are an expert intelligence analyst assistant. Provide detailed, structured analysis following intelligence community standards. Focus on analytical rigor, evidence-based reasoning, and clear communication. Always consider alternative hypotheses and indicate confidence levels.`
    },
    [DEFAULT_MODELS.cheap]: {
      verbosity: 'medium',
      maxTokens: 2048,
      systemPrompt: `You are an intelligence analyst assistant. Provide clear, concise analysis based on the provided evidence. Use structured formats (bullet points, numbered lists) when appropriate. Be objective and highlight key findings.`
    }
  },

  // The old three-way split gave nano the short-form jobs. One model now beats
  // it on both price axes, so the cheap tier carries everything but deep analysis.
  useCases: {
    summarization: DEFAULT_MODELS.cheap,
    questionGeneration: DEFAULT_MODELS.cheap,
    deepAnalysis: DEFAULT_MODELS.standard,
    fieldSuggestions: DEFAULT_MODELS.cheap,
    formatting: DEFAULT_MODELS.cheap,
    guidance: DEFAULT_MODELS.cheap
  },

  features: {
    enableSummarization: true,
    enableQuestionGeneration: true,
    enableFieldSuggestions: true,
    enableGuidance: true,
    enableAutoFormat: false  // Opt-in for auto-formatting
  },

  rateLimits: {
    requestsPerMinute: 20,
    tokensPerDay: 1_000_000  // ~$1-2/day depending on model mix
  },

  costs: {
    totalTokensUsed: 0,
    estimatedCost: 0,
    lastReset: new Date().toISOString()
  }
}

/**
 * Model Pricing (per 1M tokens)
 */
/**
 * Re-exported, not redefined. This was the third copy of the price table — the
 * other two lived beside the API's own cost estimators — and all three had to be
 * edited together to stay honest. They were not, so the settings page quoted
 * prices the product had stopped paying.
 */
export { MODEL_PRICING } from '../../../functions/api/_shared/ai-models'

/**
 * Model Capabilities
 */
export const MODEL_CAPABILITIES = {
  maxInputTokens: 272_000,
  maxOutputTokens: 128_000,
  totalContextWindow: 400_000
} as const

/**
 * Calculate estimated cost for a request
 */
export function estimateRequestCost(
  model: AIModel,
  inputTokens: number,
  estimatedOutputTokens: number = 500
): number {
  return estimateCost(model, inputTokens, estimatedOutputTokens)
}

/**
 * Get recommended model for a use case
 */
export function getModelForUseCase(
  useCase: AIUseCase,
  config: AIConfiguration = defaultAIConfig
): AIModel {
  return config.useCases[useCase] || config.defaultModel
}

/**
 * Validate AI configuration
 */
export function validateAIConfig(config: Partial<AIConfiguration>): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  // A retired ID is not invalid — the gateway remaps it, and a config saved
  // before a generation change must still validate. Only an empty or non-string
  // value is a real error here.
  if (config.defaultModel !== undefined
    && (typeof config.defaultModel !== 'string' || !config.defaultModel.trim())) {
    errors.push('Invalid default model')
  }

  if (config.rateLimits) {
    if (config.rateLimits.requestsPerMinute < 1 || config.rateLimits.requestsPerMinute > 100) {
      errors.push('Requests per minute must be between 1 and 100')
    }
    if (config.rateLimits.tokensPerDay < 1000 || config.rateLimits.tokensPerDay > 10_000_000) {
      errors.push('Tokens per day must be between 1,000 and 10,000,000')
    }
  }

  return {
    valid: errors.length === 0,
    errors
  }
}
