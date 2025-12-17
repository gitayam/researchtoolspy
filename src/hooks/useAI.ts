/**
 * useAI Hook
 *
 * React hook for AI-powered content generation and assistance
 * Provides easy access to AI features throughout the application
 */

import { useState, useEffect, useCallback } from 'react'
import type { AIConfiguration, AIModel, AIUseCase } from '@/lib/ai/config'

export interface GenerateParams {
  prompt: string
  model?: AIModel
  useCase?: AIUseCase
  maxTokens?: number
  verbosity?: 'low' | 'medium' | 'high'
  reasoningEffort?: 'minimal'
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

export interface QuestionContext {
  framework: string
  completedFields: Record<string, any>
  linkedEvidence?: any[]
}

/**
 * Main AI hook
 */
export function useAI() {
  const [config, setConfig] = useState<AIConfiguration | null>(null)
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load AI configuration on mount
  useEffect(() => {
    loadConfig()
  }, [])

  const loadConfig = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/ai/config')

      if (!response.ok) {
        throw new Error('Failed to load AI configuration')
      }

      const data = await response.json()
      setEnabled(data.enabled || false)
      setConfig(data)
    } catch (err) {
      console.error('Failed to load AI config:', err)
      setError(err instanceof Error ? err.message : 'Configuration load failed')
      setEnabled(false)
    } finally {
      setLoading(false)
    }
  }

  /**
   * Generate AI content
   */
  const generate = useCallback(async (params: GenerateParams): Promise<string | null> => {
    if (!enabled) {
      setError('AI features are not enabled')
      return null
    }

    setGenerating(true)
    setError(null)

    try {
      const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Generation failed' }))
        throw new Error(error.message || 'AI generation failed')
      }

      const data: GenerateResponse = await response.json()
      return data.content
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Generation failed'
      setError(message)
      console.error('AI generation error:', err)
      return null
    } finally {
      setGenerating(false)
    }
  }, [enabled])

  /**
   * Summarize content
   */
  const summarize = useCallback(async (
    content: string,
    mode: 'executive' | 'standard' | 'comprehensive' = 'standard'
  ): Promise<string | null> => {
    if (!enabled) {
      setError('AI features are not enabled')
      return null
    }

    setGenerating(true)
    setError(null)

    try {
      const response = await fetch('/api/ai/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, mode })
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Summarization failed' }))
        throw new Error(error.message || 'Summarization failed')
      }

      const data = await response.json()
      return data.summary
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Summarization failed'
      setError(message)
      console.error('Summarization error:', err)
      return null
    } finally {
      setGenerating(false)
    }
  }, [enabled])

  /**
   * Generate analytical questions
   */
  const generateQuestions = useCallback(async (
    context: QuestionContext
  ): Promise<string[] | null> => {
    if (!enabled) {
      setError('AI features are not enabled')
      return null
    }

    setGenerating(true)
    setError(null)

    try {
      const response = await fetch('/api/ai/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(context)
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Question generation failed' }))
        throw new Error(error.message || 'Question generation failed')
      }

      const data = await response.json()
      return data.questions
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Question generation failed'
      setError(message)
      console.error('Question generation error:', err)
      return null
    } finally {
      setGenerating(false)
    }
  }, [enabled])

  /**
   * Refresh configuration
   */
  const refreshConfig = useCallback(() => {
    loadConfig()
  }, [])

  return {
    // State
    config,
    enabled,
    loading,
    generating,
    error,

    // Actions
    generate,
    summarize,
    generateQuestions,
    refreshConfig
  }
}

/**
 * Hook for field-specific AI assistance
 */
export function useFieldAI(
  fieldName: string,
  currentValue: string | undefined,
  context: {
    framework?: string
    relatedFields?: Record<string, any>
    linkedEvidence?: any[]
  }
) {
  const { enabled, generating, generate, error } = useAI()
  const [preview, setPreview] = useState<string | null>(null)

  /**
   * Generate content for this field
   */
  const generateField = useCallback(async (
    mode: 'suggest' | 'expand' | 'rephrase' | 'summarize' = 'suggest'
  ): Promise<string | null> => {
    const prompts = {
      suggest: `Generate content for the "${fieldName}" field in this ${context.framework || 'analysis'}.

${context.relatedFields ? `Related Context:\n${JSON.stringify(context.relatedFields, null, 2)}\n` : ''}

${context.linkedEvidence ? `Linked Evidence: ${context.linkedEvidence.length} items\n` : ''}

Generate clear, concise content appropriate for this field.`,

      expand: `Expand and elaborate on the following content for the "${fieldName}" field:

${currentValue}

${context.relatedFields ? `\nRelated Context:\n${JSON.stringify(context.relatedFields, null, 2)}` : ''}

Provide more detail and depth while maintaining the original intent.`,

      rephrase: `Rephrase the following content for better clarity and impact:

${currentValue}

Improve clarity, conciseness, and professional tone.`,

      summarize: `Summarize the following content more concisely:

${currentValue}

Preserve key points while reducing length.`
    }

    const content = await generate({
      prompt: prompts[mode],
      useCase: 'fieldSuggestions'
    })

    if (content) {
      setPreview(content)
    }

    return content
  }, [fieldName, currentValue, context, generate])

  /**
   * Clear preview
   */
  const clearPreview = useCallback(() => {
    setPreview(null)
  }, [])

  return {
    enabled,
    generating,
    error,
    preview,
    generateField,
    clearPreview
  }
}

/**
 * Hook for batch field generation
 */
export function useBatchFieldAI(
  fields: Array<{ name: string; currentValue?: string }>,
  context: {
    framework: string
    relatedFields?: Record<string, any>
  }
) {
  const { enabled, generating, error } = useAI()
  const [results, setResults] = useState<Record<string, string>>({})
  const [progress, setProgress] = useState(0)

  /**
   * Generate content for multiple fields
   */
  const generateBatch = useCallback(async (): Promise<boolean> => {
    // TODO: Implement batch generation via API
    // For now, generate sequentially

    setResults({})
    setProgress(0)

    let generated = 0
    const newResults: Record<string, string> = {}

    for (let i = 0; i < fields.length; i++) {
      const field = fields[i]

      try {
        const response = await fetch('/api/ai/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: `Generate content for "${field.name}" field in ${context.framework} framework.`,
            useCase: 'fieldSuggestions'
          })
        })

        if (response.ok) {
          const data = await response.json()
          newResults[field.name] = data.content
          generated++
        }
      } catch (err) {
        console.error(`Failed to generate ${field.name}:`, err)
      }

      setProgress(((i + 1) / fields.length) * 100)
      setResults({ ...newResults })
    }

    return generated === fields.length
  }, [fields, context])

  return {
    enabled,
    generating,
    error,
    results,
    progress,
    generateBatch
  }
}
