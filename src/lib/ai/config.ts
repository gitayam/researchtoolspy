/**
 * AI Configuration Types and Defaults
 *
 * Manages GPT-5 model configuration, use case mappings, and feature flags
 */

export type AIModel = 'gpt-5' | 'gpt-5-mini' | 'gpt-5-nano'

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
  reasoningEffort?: 'minimal'
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
  defaultModel: 'gpt-5-mini',

  models: {
    'gpt-5': {
      verbosity: 'high',
      maxTokens: 4096,
      systemPrompt: `You are an expert intelligence analyst assistant. Provide detailed, structured analysis following intelligence community standards. Focus on analytical rigor, evidence-based reasoning, and clear communication. Always consider alternative hypotheses and indicate confidence levels.`
    },
    'gpt-5-mini': {
      verbosity: 'medium',
      maxTokens: 2048,
      systemPrompt: `You are an intelligence analyst assistant. Provide clear, concise analysis based on the provided evidence. Use structured formats (bullet points, numbered lists) when appropriate. Be objective and highlight key findings.`
    },
    'gpt-5-nano': {
      verbosity: 'low',
      reasoningEffort: 'minimal',
      maxTokens: 1024,
      systemPrompt: `You are a research assistant. Provide brief, focused responses. Use bullet points for clarity. Be concise and actionable.`
    }
  },

  useCases: {
    summarization: 'gpt-5-mini',
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
export const MODEL_PRICING = {
  'gpt-5': {
    input: 1.25,  // $1.25 per 1M input tokens
    output: 10.0  // $10.00 per 1M output tokens
  },
  'gpt-5-mini': {
    input: 0.25,  // $0.25 per 1M input tokens
    output: 2.0   // $2.00 per 1M output tokens
  },
  'gpt-5-nano': {
    input: 0.05,  // $0.05 per 1M input tokens
    output: 0.40  // $0.40 per 1M output tokens
  }
} as const

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
  const pricing = MODEL_PRICING[model]
  const inputCost = (inputTokens / 1_000_000) * pricing.input
  const outputCost = (estimatedOutputTokens / 1_000_000) * pricing.output
  return inputCost + outputCost
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

  if (config.defaultModel && !['gpt-5', 'gpt-5-mini', 'gpt-5-nano'].includes(config.defaultModel)) {
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
