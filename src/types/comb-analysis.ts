/**
 * COM-B Analysis Types
 *
 * COM-B Analysis is TARGET-AUDIENCE-SPECIFIC assessment of capability,
 * opportunity, and motivation for a specific behavior.
 *
 * Based on Michie, S., van Stralen, M. M., & West, R. (2011).
 * The behaviour change wheel: A new method for characterising and
 * designing behaviour change interventions.
 * Implementation Science, 6(1), 42.
 */

import type { ComBDeficits, InterventionFunction } from './behavior-change-wheel'

export interface TargetAudience {
  name: string
  description: string
  demographics?: string
  psychographics?: string
  current_relationship?: string // Current relationship to the behavior
}

export interface ComBComponentAssessment {
  component: 'physical_capability' | 'psychological_capability' | 'physical_opportunity' | 'social_opportunity' | 'reflective_motivation' | 'automatic_motivation'
  deficit_level: 'adequate' | 'deficit' | 'major_barrier'
  evidence_notes: string // Why did you assess this way?
  supporting_evidence?: string[] // Links to evidence items
}

export interface COMBAnalysis {
  id?: string
  title: string
  description: string
  created_at?: string
  updated_at?: string
  source_url?: string

  // Link to Behavior Analysis
  linked_behavior_id?: string
  linked_behavior_title?: string

  // Target Audience Definition
  target_audience: TargetAudience

  // COM-B Component Assessments (with evidence/notes)
  assessments: {
    physical_capability: ComBComponentAssessment
    psychological_capability: ComBComponentAssessment
    physical_opportunity: ComBComponentAssessment
    social_opportunity: ComBComponentAssessment
    reflective_motivation: ComBComponentAssessment
    automatic_motivation: ComBComponentAssessment
  }

  // BCW Results (auto-generated from assessments)
  com_b_deficits?: ComBDeficits
  selected_interventions?: InterventionFunction[]

  // Additional Analysis
  contextual_factors?: string[] // Environmental/cultural context for this TA
  assumptions?: string[] // Assumptions made during assessment
  limitations?: string[] // Limitations of this analysis
}

export interface BehaviorSelector {
  behavior_id: string
  behavior_title: string
  behavior_description?: string
}
