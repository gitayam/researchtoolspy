/**
 * useBehaviorAI Hook
 *
 * React hook for AI-powered COM-B behavior analysis.
 * Supports two contexts: "intelligence" (adversary analysis) and "product" (user/stakeholder analysis).
 */

import { useState, useCallback } from 'react'
import { getCopHeaders } from '@/lib/cop-auth'

export type BehaviorAnalysisContext = 'intelligence' | 'product'
export type BehaviorAnalysisMode = 'diagnose-comb' | 'suggest-interventions' | 'analyze-motivation' | 'full-analysis'

export interface BehaviorInput {
  description: string
  actor?: string
  setting?: string
  frequency?: string
  consequences?: string
}

export interface CombDimension {
  deficit_level: 'adequate' | 'deficit' | 'major_barrier'
  evidence_notes: string
  confidence: 'low' | 'medium' | 'high'
  indicators: string[]
}

export interface CombDiagnosis {
  physical_capability: CombDimension
  psychological_capability: CombDimension
  physical_opportunity: CombDimension
  social_opportunity: CombDimension
  reflective_motivation: CombDimension
  automatic_motivation: CombDimension
  summary: string
  key_findings: string[]
}

export interface InterventionItem {
  intervention: string
  target_component: string
  priority: 'high' | 'medium' | 'low'
  description: string
  rationale: string
  implementation_steps: string[]
  expected_impact: string
}

export interface MotivationAnalysis {
  reflective_analysis: {
    goals: string[]
    beliefs: string[]
    identity_factors: string[]
    decision_process: string
  }
  automatic_analysis: {
    habits: string[]
    emotional_drivers: string[]
    conditioning_factors: string[]
    triggers: string[]
  }
  motivation_summary: string
  leverage_points: string[]
}

export interface FullAnalysisResult {
  diagnosis: CombDiagnosis
  interventions: InterventionItem[]
  motivation_insights?: {
    primary_driver: string
    leverage_points: string[]
  }
  overall_assessment: string
}

export function useBehaviorAI() {
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const analyze = useCallback(async <T = any>(
    mode: BehaviorAnalysisMode,
    context: BehaviorAnalysisContext,
    behavior: BehaviorInput,
    extra?: {
      combAssessment?: any
      additionalContext?: string
    }
  ): Promise<T | null> => {
    setAnalyzing(true)
    setError(null)

    try {
      const response = await fetch('/api/ai/behavior-analysis', {
        method: 'POST',
        headers: getCopHeaders(),
        body: JSON.stringify({
          mode,
          context,
          behavior,
          ...extra,
        })
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Analysis failed' }))
        throw new Error(err.error || 'Analysis failed')
      }

      const data = await response.json()
      return data.result as T
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Behavior analysis failed'
      setError(message)
      return null
    } finally {
      setAnalyzing(false)
    }
  }, [])

  const diagnoseComb = useCallback(
    (ctx: BehaviorAnalysisContext, behavior: BehaviorInput, additionalContext?: string) =>
      analyze<CombDiagnosis>('diagnose-comb', ctx, behavior, { additionalContext }),
    [analyze]
  )

  const suggestInterventions = useCallback(
    (ctx: BehaviorAnalysisContext, behavior: BehaviorInput, combAssessment: any) =>
      analyze<InterventionItem[]>('suggest-interventions', ctx, behavior, { combAssessment }),
    [analyze]
  )

  const analyzeMotivation = useCallback(
    (ctx: BehaviorAnalysisContext, behavior: BehaviorInput, additionalContext?: string) =>
      analyze<MotivationAnalysis>('analyze-motivation', ctx, behavior, { additionalContext }),
    [analyze]
  )

  const fullAnalysis = useCallback(
    (ctx: BehaviorAnalysisContext, behavior: BehaviorInput, additionalContext?: string) =>
      analyze<FullAnalysisResult>('full-analysis', ctx, behavior, { additionalContext }),
    [analyze]
  )

  return {
    analyzing,
    error,
    diagnoseComb,
    suggestInterventions,
    analyzeMotivation,
    fullAnalysis,
  }
}
