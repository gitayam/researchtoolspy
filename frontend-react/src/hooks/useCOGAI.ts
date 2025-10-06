/**
 * useCOGAI Hook
 *
 * React hook for AI-powered Center of Gravity analysis assistance
 * Provides COG identification, capability generation, requirements extraction, etc.
 */

import { useState, useCallback } from 'react'
import { useAI } from './useAI'

export type COGAnalysisMode =
  | 'suggest-cog'
  | 'validate-cog'
  | 'generate-capabilities'
  | 'generate-requirements'
  | 'generate-vulnerabilities'
  | 'generate-impact'

export interface COGContext {
  objective?: string
  impactGoal?: string
  friendlyForces?: string
  operatingEnvironment?: string
  constraints?: string
  timeframe?: string
  strategicLevel?: string
}

export interface COGData {
  description: string
  actor: string
  domain: string
  rationale?: string
}

export interface CapabilityData {
  capability: string
  description?: string
}

export interface RequirementData {
  requirement: string
  type?: string
  capabilityId?: string
}

// Response types
export interface SuggestedCOG {
  description: string
  actor: string
  domain: string
  rationale: string
}

export interface COGValidationCriteria {
  passes: boolean
  explanation: string
}

export interface COGValidationResult {
  isValid: boolean
  overallAssessment: string
  criteria: {
    criticalDegradation: COGValidationCriteria
    sourceOfPower: COGValidationCriteria
    appropriateLevel: COGValidationCriteria
    exploitable: COGValidationCriteria
  }
  recommendations: string[]
}

export interface GeneratedCapability {
  capability: string
  description: string
}

export interface GeneratedRequirement {
  requirement: string
  type: string
  description: string
}

export interface GeneratedVulnerability {
  vulnerability: string
  type: string
  description: string
  expectedEffect: string
  recommendedActions: string[]
  confidence: 'low' | 'medium' | 'high'
  scoring: {
    impact_on_cog: number
    attainability: number
    follow_up_potential: number
  }
}

export interface GeneratedImpact {
  expectedEffect: string
  cascadingEffects: string[]
  recommendedActions: string[]
  confidence: 'low' | 'medium' | 'high'
  confidenceRationale: string
  timeToEffect: string
  reversibility: string
  riskToFriendlyForces: 'low' | 'medium' | 'high'
  considerations: string[]
}

/**
 * Hook for COG AI assistance
 */
export function useCOGAI() {
  const { enabled, loading: aiLoading } = useAI()
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Suggest potential COGs based on operational context
   */
  const suggestCOGs = useCallback(async (
    context: COGContext
  ): Promise<SuggestedCOG[] | null> => {
    if (!enabled) {
      setError('AI features are not enabled')
      return null
    }

    setAnalyzing(true)
    setError(null)

    try {
      const response = await fetch('/api/ai/cog-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'suggest-cog',
          context
        })
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Failed to suggest COGs' }))
        throw new Error(error.message || 'COG suggestion failed')
      }

      const data = await response.json()
      return data.result as SuggestedCOG[]
    } catch (err) {
      const message = err instanceof Error ? err.message : 'COG suggestion failed'
      setError(message)
      console.error('COG suggestion error:', err)
      return null
    } finally {
      setAnalyzing(false)
    }
  }, [enabled])

  /**
   * Validate a proposed COG against doctrine criteria
   */
  const validateCOG = useCallback(async (
    cog: COGData,
    context?: COGContext
  ): Promise<COGValidationResult | null> => {
    if (!enabled) {
      setError('AI features are not enabled')
      return null
    }

    setAnalyzing(true)
    setError(null)

    try {
      const response = await fetch('/api/ai/cog-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'validate-cog',
          cog,
          context
        })
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Failed to validate COG' }))
        throw new Error(error.message || 'COG validation failed')
      }

      const data = await response.json()
      return data.result as COGValidationResult
    } catch (err) {
      const message = err instanceof Error ? err.message : 'COG validation failed'
      setError(message)
      console.error('COG validation error:', err)
      return null
    } finally {
      setAnalyzing(false)
    }
  }, [enabled])

  /**
   * Generate critical capabilities for a COG
   */
  const generateCapabilities = useCallback(async (
    cog: COGData,
    context?: COGContext
  ): Promise<GeneratedCapability[] | null> => {
    if (!enabled) {
      setError('AI features are not enabled')
      return null
    }

    setAnalyzing(true)
    setError(null)

    try {
      const response = await fetch('/api/ai/cog-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'generate-capabilities',
          cog,
          context
        })
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Failed to generate capabilities' }))
        throw new Error(error.message || 'Capability generation failed')
      }

      const data = await response.json()
      return data.result as GeneratedCapability[]
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Capability generation failed'
      setError(message)
      console.error('Capability generation error:', err)
      return null
    } finally {
      setAnalyzing(false)
    }
  }, [enabled])

  /**
   * Generate critical requirements for a capability
   */
  const generateRequirements = useCallback(async (
    capability: CapabilityData,
    cog?: COGData,
    context?: COGContext
  ): Promise<GeneratedRequirement[] | null> => {
    if (!enabled) {
      setError('AI features are not enabled')
      return null
    }

    setAnalyzing(true)
    setError(null)

    try {
      const response = await fetch('/api/ai/cog-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'generate-requirements',
          capability,
          cog,
          context
        })
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Failed to generate requirements' }))
        throw new Error(error.message || 'Requirements generation failed')
      }

      const data = await response.json()
      return data.result as GeneratedRequirement[]
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Requirements generation failed'
      setError(message)
      console.error('Requirements generation error:', err)
      return null
    } finally {
      setAnalyzing(false)
    }
  }, [enabled])

  /**
   * Generate critical vulnerabilities for a requirement
   */
  const generateVulnerabilities = useCallback(async (
    requirement: RequirementData,
    capability?: CapabilityData,
    cog?: COGData,
    context?: COGContext
  ): Promise<GeneratedVulnerability[] | null> => {
    if (!enabled) {
      setError('AI features are not enabled')
      return null
    }

    setAnalyzing(true)
    setError(null)

    try {
      const response = await fetch('/api/ai/cog-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'generate-vulnerabilities',
          requirement,
          capability,
          cog,
          context
        })
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Failed to generate vulnerabilities' }))
        throw new Error(error.message || 'Vulnerabilities generation failed')
      }

      const data = await response.json()
      return data.result as GeneratedVulnerability[]
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Vulnerabilities generation failed'
      setError(message)
      console.error('Vulnerabilities generation error:', err)
      return null
    } finally {
      setAnalyzing(false)
    }
  }, [enabled])

  /**
   * Generate impact analysis for a vulnerability
   */
  const generateImpact = useCallback(async (
    vulnerability: RequirementData, // Using RequirementData structure for vulnerability
    capabilities: CapabilityData[],
    requirements?: RequirementData[],
    cog?: COGData,
    context?: COGContext
  ): Promise<GeneratedImpact | null> => {
    if (!enabled) {
      setError('AI features are not enabled')
      return null
    }

    setAnalyzing(true)
    setError(null)

    try {
      const response = await fetch('/api/ai/cog-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'generate-impact',
          requirement: vulnerability,
          capabilities,
          requirements,
          cog,
          context
        })
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Failed to generate impact analysis' }))
        throw new Error(error.message || 'Impact analysis failed')
      }

      const data = await response.json()
      return data.result as GeneratedImpact
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Impact analysis failed'
      setError(message)
      console.error('Impact analysis error:', err)
      return null
    } finally {
      setAnalyzing(false)
    }
  }, [enabled])

  return {
    // State
    enabled,
    loading: aiLoading,
    analyzing,
    error,

    // Actions
    suggestCOGs,
    validateCOG,
    generateCapabilities,
    generateRequirements,
    generateVulnerabilities,
    generateImpact
  }
}

/**
 * Hook for AI assistance on a specific COG component
 */
export function useCOGComponentAI(componentType: 'cog' | 'capability' | 'requirement' | 'vulnerability') {
  const { enabled, analyzing, error, suggestCOGs, validateCOG, generateCapabilities, generateRequirements, generateVulnerabilities } = useCOGAI()
  const [preview, setPreview] = useState<any | null>(null)

  /**
   * Generate or enhance component
   */
  const enhanceComponent = useCallback(async (
    data: any,
    context?: any
  ): Promise<any | null> => {
    let result: any = null

    switch (componentType) {
      case 'cog':
        if (data.description) {
          result = await validateCOG(data, context)
        } else {
          const suggestions = await suggestCOGs(context)
          result = suggestions?.[0] || null
        }
        break

      case 'capability':
        result = await generateCapabilities(data.cog, context)
        break

      case 'requirement':
        result = await generateRequirements(data.capability, data.cog, context)
        break

      case 'vulnerability':
        result = await generateVulnerabilities(data.requirement, data.capability, data.cog, context)
        break
    }

    if (result) {
      setPreview(result)
    }

    return result
  }, [componentType, suggestCOGs, validateCOG, generateCapabilities, generateRequirements, generateVulnerabilities])

  /**
   * Clear preview
   */
  const clearPreview = useCallback(() => {
    setPreview(null)
  }, [])

  return {
    enabled,
    analyzing,
    error,
    preview,
    enhanceComponent,
    clearPreview
  }
}
