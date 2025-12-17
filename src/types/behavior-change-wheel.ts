/**
 * Behaviour Change Wheel Types
 *
 * Based on Michie, S., van Stralen, M. M., & West, R. (2011).
 * The behaviour change wheel: A new method for characterising and
 * designing behaviour change interventions.
 * Implementation Science, 6(1), 42.
 */

export type ComBComponent =
  | 'physical_capability'
  | 'psychological_capability'
  | 'physical_opportunity'
  | 'social_opportunity'
  | 'reflective_motivation'
  | 'automatic_motivation'

export type DeficitLevel = 'adequate' | 'deficit' | 'major_barrier'

export type InterventionFunction =
  | 'education'
  | 'persuasion'
  | 'incentivisation'
  | 'coercion'
  | 'training'
  | 'restriction'
  | 'environmental_restructuring'
  | 'modelling'
  | 'enablement'

export type PolicyCategory =
  | 'communication_marketing'
  | 'guidelines'
  | 'fiscal_measures'
  | 'regulation'
  | 'legislation'
  | 'environmental_social_planning'
  | 'service_provision'

export interface ComBDeficits {
  physical_capability: DeficitLevel
  psychological_capability: DeficitLevel
  physical_opportunity: DeficitLevel
  social_opportunity: DeficitLevel
  reflective_motivation: DeficitLevel
  automatic_motivation: DeficitLevel
}

export interface InterventionDetail {
  name: InterventionFunction
  priority: 'high' | 'medium' | 'low'
  description: string
  evidence_base: string
  implementation_considerations: string[]
  applicable_policies: PolicyCategory[]
}

export interface InterventionRecommendation {
  component: string // Human-readable component name
  component_code: ComBComponent
  severity: DeficitLevel
  interventions: InterventionDetail[]
}

export interface PolicyRecommendation {
  policy: PolicyCategory
  name: string
  description: string
  suitable_for_interventions: InterventionFunction[]
  examples: string[]
  apease_assessment?: {
    affordability: 'high' | 'medium' | 'low'
    practicability: 'high' | 'medium' | 'low'
    effectiveness: 'high' | 'medium' | 'low'
    acceptability: 'high' | 'medium' | 'low'
    side_effects: 'low' | 'medium' | 'high' // Lower is better
    equity: 'high' | 'medium' | 'low'
  }
}

export interface BehaviorAnalysisWithBCW {
  // Standard framework fields
  id?: string
  title: string
  description: string
  [key: string]: any

  // BCW-specific fields
  com_b_deficits?: ComBDeficits
  intervention_recommendations?: InterventionRecommendation[]
  selected_interventions?: InterventionFunction[]
  policy_recommendations?: PolicyRecommendation[]
}
