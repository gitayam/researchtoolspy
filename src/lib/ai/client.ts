/**
 * AI Client Service
 *
 * Handles communication with OpenAI GPT-5 models
 * Manages configuration, rate limiting, and error handling
 */

import type {
  AIConfiguration,
  AIModel,
  AIUseCase,
  VerbosityLevel,
  ModelSettings
} from './config'
import { defaultAIConfig, estimateRequestCost, MODEL_CAPABILITIES } from './config'

export interface GenerateParams {
  prompt: string
  model?: AIModel
  useCase?: AIUseCase
  maxTokens?: number
  verbosity?: VerbosityLevel
  reasoningEffort?: 'minimal'
  systemPrompt?: string
}

export interface GenerateResponse {
  content: string
  model: AIModel
  tokensUsed: {
    input: number
    output: number
    total: number
  }
  estimatedCost: number
  finishReason: string
}

export interface BatchGenerateParams {
  prompts: Array<{
    field: string
    prompt: string
    useCase?: AIUseCase
  }>
  model?: AIModel
}

export interface BatchGenerateResponse {
  results: Record<string, string>
  tokensUsed: number
  estimatedCost: number
}

/**
 * AI Client for generating content via OpenAI API
 */
export class AIClient {
  private config: AIConfiguration
  private baseURL = 'https://api.openai.com/v1'

  constructor(config: AIConfiguration = defaultAIConfig) {
    this.config = config
  }

  /**
   * Update configuration
   */
  setConfig(config: AIConfiguration) {
    this.config = config
  }

  /**
   * Generate content using AI
   */
  async generate(params: GenerateParams): Promise<GenerateResponse> {
    // Determine which model to use
    const model = this.selectModel(params)
    const settings = this.config.models[model]

    // Build system prompt
    const systemPrompt = params.systemPrompt || settings.systemPrompt

    // Check rate limits
    await this.checkRateLimits()

    try {
      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
          ...(this.config.organization && { 'OpenAI-Organization': this.config.organization })
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: params.prompt }
          ],
          max_tokens: params.maxTokens || settings.maxTokens,
          // Note: temperature is NOT supported in GPT-5 reasoning models
          // verbosity and reasoning_effort are the control parameters
          ...(params.verbosity && { verbosity: params.verbosity }),
          ...(params.reasoningEffort && { reasoning_effort: params.reasoningEffort })
        })
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }))
        throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`)
      }

      const data = await response.json()
      const content = data.choices[0].message.content
      const tokensUsed = {
        input: data.usage.prompt_tokens,
        output: data.usage.completion_tokens,
        total: data.usage.total_tokens
      }

      return {
        content,
        model,
        tokensUsed,
        estimatedCost: estimateRequestCost(model, tokensUsed.input, tokensUsed.output),
        finishReason: data.choices[0].finish_reason
      }
    } catch (error) {
      console.error('AI generation failed:', error)
      throw error
    }
  }

  /**
   * Generate content for multiple fields in batch
   * More efficient than individual requests
   */
  async generateBatch(params: BatchGenerateParams): Promise<BatchGenerateResponse> {
    const model = params.model || this.config.defaultModel
    const settings = this.config.models[model]

    // Combine all prompts into a single structured request
    const batchPrompt = this.buildBatchPrompt(params.prompts)

    await this.checkRateLimits()

    try {
      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
          ...(this.config.organization && { 'OpenAI-Organization': this.config.organization })
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: settings.systemPrompt },
            { role: 'user', content: batchPrompt }
          ],
          max_tokens: settings.maxTokens * params.prompts.length,
          response_format: { type: 'json_object' },  // Request JSON response
          verbosity: settings.verbosity
        })
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }))
        throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`)
      }

      const data = await response.json()
      let results
      try {
        results = JSON.parse(data.choices[0].message.content)
      } catch (parseError) {
        console.error('Failed to parse AI response:', parseError)
        throw new Error('Invalid JSON response from AI')
      }

      return {
        results,
        tokensUsed: data.usage.total_tokens,
        estimatedCost: estimateRequestCost(
          model,
          data.usage.prompt_tokens,
          data.usage.completion_tokens
        )
      }
    } catch (error) {
      console.error('Batch generation failed:', error)
      throw error
    }
  }

  /**
   * Summarize content
   */
  async summarize(
    content: string,
    mode: 'executive' | 'standard' | 'comprehensive' = 'standard'
  ): Promise<string> {
    const verbosityMap = {
      executive: 'low' as VerbosityLevel,
      standard: 'medium' as VerbosityLevel,
      comprehensive: 'high' as VerbosityLevel
    }

    const prompt = `Summarize the following content as a ${mode} summary:

${content}

Requirements:
- Preserve key facts and findings
- Use intelligence community writing standards
- ${mode === 'executive' ? 'Limit to 2-3 sentences (BLUF format)' : mode === 'standard' ? 'Limit to 1 paragraph' : 'Provide comprehensive multi-paragraph summary with structure'}`

    const response = await this.generate({
      prompt,
      useCase: 'summarization',
      verbosity: verbosityMap[mode]
    })

    return response.content
  }

  /**
   * Generate follow-up questions based on context
   */
  async generateQuestions(context: {
    framework: string
    completedFields: Record<string, any>
    linkedEvidence?: any[]
  }): Promise<string[]> {
    const prompt = `Framework: ${context.framework}
Completed Sections: ${JSON.stringify(context.completedFields, null, 2)}
${context.linkedEvidence ? `Linked Evidence: ${context.linkedEvidence.length} items` : ''}

Generate 3-5 probing questions that would help improve this analysis.
Focus on:
- Identifying gaps in evidence
- Challenging assumptions
- Exploring alternative hypotheses
- Highlighting contradictions or inconsistencies

Format as a JSON array of strings: ["Question 1", "Question 2", ...]`

    const response = await this.generate({
      prompt,
      useCase: 'questionGeneration',
      reasoningEffort: 'minimal'
    })

    try {
      return JSON.parse(response.content)
    } catch {
      // Fallback: parse numbered list
      return response.content
        .split('\n')
        .filter(line => /^\d+\./.test(line.trim()))
        .map(line => line.replace(/^\d+\.\s*/, '').trim())
    }
  }

  /**
   * Format and enhance content
   */
  async formatContent(content: string): Promise<string> {
    const prompt = `Format and enhance the following content for an intelligence report:

${content}

Apply these improvements:
- Standardize date formats (DD Mon YYYY)
- Add **bold** for key terms and entities
- Fix grammar and punctuation
- Structure with bullet points if appropriate
- Add [needs verification] tags for unverified claims

Return only the formatted content, no explanations.`

    const response = await this.generate({
      prompt,
      useCase: 'formatting',
      reasoningEffort: 'minimal'
    })

    return response.content
  }

  /**
   * Private: Select appropriate model based on parameters
   */
  private selectModel(params: GenerateParams): AIModel {
    if (params.model) {
      return params.model
    }
    if (params.useCase) {
      return this.config.useCases[params.useCase]
    }
    return this.config.defaultModel
  }

  /**
   * Private: Build batch prompt from multiple field prompts
   */
  private buildBatchPrompt(prompts: BatchGenerateParams['prompts']): string {
    const fields = prompts.map(p => p.field).join(', ')

    return `Generate content for the following fields: ${fields}

Return a JSON object with field names as keys and generated content as values.

Fields to generate:
${prompts.map((p, i) => `
${i + 1}. Field: "${p.field}"
   Context: ${p.prompt}
`).join('\n')}

Return format:
{
  "${prompts[0].field}": "generated content...",
  "${prompts[1]?.field}": "generated content...",
  ...
}`
  }

  /**
   * Private: Check rate limits before making request
   */
  private async checkRateLimits(): Promise<void> {
    // TODO: Implement rate limiting logic
    // - Check requests per minute
    // - Check tokens per day
    // - Throw error if limit exceeded
  }
}

/**
 * Browser-side AI client that makes requests via API routes
 * (doesn't expose API key to client)
 */
export class BrowserAIClient {
  private baseURL = '/api/ai'

  async generate(params: Omit<GenerateParams, 'systemPrompt'>): Promise<GenerateResponse> {
    const response = await fetch(`${this.baseURL}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }))
      throw new Error(error.message || 'AI generation failed')
    }

    return response.json()
  }

  async generateBatch(params: BatchGenerateParams): Promise<BatchGenerateResponse> {
    const response = await fetch(`${this.baseURL}/generate-batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }))
      throw new Error(error.message || 'Batch generation failed')
    }

    return response.json()
  }

  async summarize(content: string, mode: 'executive' | 'standard' | 'comprehensive' = 'standard'): Promise<string> {
    const response = await fetch(`${this.baseURL}/summarize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, mode })
    })

    if (!response.ok) {
      throw new Error('Summarization failed')
    }

    const data = await response.json()
    return data.summary
  }

  async generateQuestions(context: Parameters<AIClient['generateQuestions']>[0]): Promise<string[]> {
    const response = await fetch(`${this.baseURL}/questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(context)
    })

    if (!response.ok) {
      throw new Error('Question generation failed')
    }

    const data = await response.json()
    return data.questions
  }

  async formatContent(content: string): Promise<string> {
    const response = await fetch(`${this.baseURL}/format`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    })

    if (!response.ok) {
      throw new Error('Formatting failed')
    }

    const data = await response.json()
    return data.formatted
  }
}
