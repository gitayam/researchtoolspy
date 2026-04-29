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
import type {
  AudienceBaseline,
  BehaviorDelta,
  ComBComponent as FrameComBComponent,
  Direction,
  DirectionAwareLeverage,
} from './operational-frame'

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
  /** Optional evidence source typing per BCW Guide Box 1.9 (COM-B-D form).
   *  P2-5 — see docs/BEHAVIOR_FRAMEWORK_IMPROVEMENT_PLAN.md.
   */
  evidence_sources?: Array<{
    type: 'rct' | 'observational_study' | 'interview' | 'focus_group' | 'literature_review' | 'theoretical_analysis' | 'expert_judgement' | 'other'
    description: string
  }>
  facilitators?: string[] // Strengths / factors that support this component
  barriers?: string[] // Weaknesses / factors that hinder this component
}

export interface COMBAnalysis {
  id?: string
  title: string
  description: string
  created_at?: string
  updated_at?: string
  source_url?: string

  // Link to Behavior Analysis (P1-4 — see docs/BEHAVIOR_FRAMEWORK_IMPROVEMENT_PLAN.md. Canon: irregularpedia.org/general/behavior-analysis/)
  linked_behavior_id: string
  linked_behavior_title: string

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

  // ───────────────────────────────────────────────────────────────────────
  // Operational Frame integration (Spec Section C — direction-aware diagnosis)
  // ───────────────────────────────────────────────────────────────────────
  // All fields are OPTIONAL — analyses authored before Operational Frame
  // existed (or via UI flows that don't elicit direction) keep working
  // unchanged. Consumers should treat absence as "direction-blind diagnosis,
  // legacy shape" and not assume any default direction.
  //
  // Design spec: irregularchat-monorepo:docs/superpowers/specs/2026-04-27-bcw-operational-frame-design.md

  /** Anchor to the Operational Frame this COM-B was diagnosed under. */
  linked_frame_id?: string

  /** Denormalized direction (from the linked Frame) for query efficiency.
   *  Always derivable from linked_frame_id but stored to avoid join. */
  direction?: Direction

  /** Concrete restatement of what the audience does if the objective
   *  succeeds — copied from the Frame's desired_behavior for self-containment. */
  desired_behavior?: string

  /** Audience-specific baseline — Michie's behavior-frequency framework
   *  specialized to THIS audience (narrower than the Frame's population
   *  baseline). */
  audience_baseline?: AudienceBaseline

  /** Concrete gap between the audience's current and desired behavior. */
  behavior_delta?: BehaviorDelta

  /** Direction-aware interpretation of the deficits map per BCW Guide Box 2.6.
   *  The deficits stay objective (audience's COM-B state); this layer flips
   *  the intervention IMPLICATION by direction. */
  direction_aware_leverage?: DirectionAwareLeverage[]

  /** Audience-specific MOE candidates (specialization of the Frame's
   *  general MOEs to this audience's profile). */
  audience_specific_moe?: string[]
}

/** COM-B component name as used by both COMBAnalysis.assessments keys and
 *  the Frame's DirectionAwareLeverage. Re-exported here for callers that
 *  only import from comb-analysis.ts. */
export type COMBAnalysisComponent = FrameComBComponent

export type ComBAssessmentsMap = COMBAnalysis['assessments']

export interface BehaviorSelector {
  behavior_id: string
  behavior_title: string
  behavior_description?: string
}
