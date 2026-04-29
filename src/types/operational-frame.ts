/**
 * Operational Frame Types
 *
 * The Operational Frame sits between the audience-agnostic Behavior Analysis (L1)
 * and the audience-specific COM-B Analysis (L2). It captures the operator's
 * intent — direction (increase/decrease/shift/introduce), the TA's desired
 * behavior (which may differ from L1 reference), baseline rate + measurement
 * method, MOE/MOP indicators, operational so-what, and audience candidates
 * filtered by direction.
 *
 * Sources:
 * - Wiki canon: irregularpedia.org/general/behavior-analysis/
 * - Michie, Atkins & West (2014). The Behaviour Change Wheel — Step 5
 *   considers behavior direction.
 * - Michie's measurement framework: behavior frequency change, COM-B
 *   component shift, outcome change.
 * - DOD JP 5-0 / JP 3-13.2 / TM 3-53.11 — MOE/MOP framework where applicable.
 *
 * Design spec: irregularchat-monorepo/docs/superpowers/specs/2026-04-27-bcw-operational-frame-design.md
 *
 * IMPORTANT: This file defines the SHARED VOCABULARY across consumers
 * (researchtoolspy UI, signal-bot, bcw-mcp, future MCP/HTTP integrations).
 * The signal-bot currently mirrors these types as zod schemas locally; future
 * work will collapse to a single source via a workspace package or codegen.
 */

/**
 * Direction parses from the operator's free-text objective via verb-keyed
 * mapping (see signal-bot's parseDirectionFromObjective).
 *   'increase'  ← increase, raise, encourage, promote, sustain, maintain,
 *                  reinforce, amplify, expand, grow
 *   'decrease'  ← decrease, reduce, suppress, prevent, eliminate, deter,
 *                  lower, discourage, minimize
 *   'shift'     ← shift, redirect, substitute, replace, pivot
 *                  (REQUIRES substitute_for populated)
 *   'introduce' ← introduce, initiate, start, establish, create, launch
 */
export type Direction = 'increase' | 'decrease' | 'shift' | 'introduce'

/**
 * How the TA's desired behavior relates to the L1 reference behavior.
 *   'same'        — same behavior, different rate (↑ informant reporting)
 *   'opposite'    — inverse (↓ resistance during VBSS = compliance with VBSS)
 *   'alternative' — substitute (peaceful protest replacing violent)
 *   'novel'       — introducing where absent (handwashing before meals)
 */
export type DeltaFromReference = 'same' | 'opposite' | 'alternative' | 'novel'

/**
 * Confidence level for baseline rate estimates. Per Michie's behavior-frequency
 * framework — when confidence is low, the operator should invest in baseline
 * collection BEFORE intervening.
 */
export type Confidence = 'high' | 'medium' | 'low' | 'unknown'

/**
 * COM-B sub-components per Michie/Atkins/West 2014. Mirrors the type in
 * `behavior-change-wheel.ts` but re-stated here for self-containment of the
 * Operational Frame surface.
 */
export type ComBComponent =
  | 'physical_capability'
  | 'psychological_capability'
  | 'physical_opportunity'
  | 'social_opportunity'
  | 'reflective_motivation'
  | 'automatic_motivation'

/**
 * The TA's desired behavior — what the audience does if the objective succeeds.
 * Concrete (observable, countable), and may differ from the L1 reference
 * behavior depending on direction.
 */
export interface DesiredBehavior {
  title: string
  description: string
  delta_from_reference: DeltaFromReference
  /** Required when direction='shift' — names the alternative behavior the
   *  audience adopts in place of the original (e.g. peaceful protest). */
  substitute_for?: string
}

/**
 * Audience-agnostic baseline (population at large) — Michie's behavior-
 * frequency framework. Audience-specific baseline lives on COMBAnalysis
 * (per Section C of the spec).
 */
export interface FrameBaseline {
  /** Narrative w/ source if known — e.g. "30% of fishing vessels in Somali
   *  waters resist boarding (CTF-151 reports last 12mo)". */
  current_rate_estimate: string
  /** How the rate is/can be verified — observation, reports, AIS data, etc. */
  measurement_method: string
  confidence: Confidence
}

/**
 * Measurement plan — Michie-primary three-layer framework with DOD JP 5-0
 * MOE/MOP framing layered on top where applicable.
 */
export interface FrameMeasurement {
  /** Behavior frequency change — countable signals of the target behavior
   *  performed (Michie layer 1). */
  behavior_indicators: string[]
  /** COM-B component shift — what capability/opportunity/motivation
   *  measurement would predict the behavior change (Michie layer 2). Each
   *  indicator must anchor to a specific COM-B component. */
  com_b_shift_indicators: string[]
  /** Outcome change — downstream operational effects of the behavior change
   *  (Michie layer 3). */
  outcome_indicators: string[]
  /** DOD MOE — observable change indicators framed for ops reporting. Subset
   *  of behavior_indicators framed for SITREP-level visibility. */
  moe_candidates: string[]
  /** DOD MOP — output quantities (products delivered, broadcasts received,
   *  leaflets distributed, % audience reached). Necessary but not sufficient. */
  mop_candidates: string[]
}

/**
 * Audience candidate filtered by direction. Carries a COM-B hypothesis as
 * a preview of the L2 work — which component is the suspected primary driver
 * for THIS audience under THIS direction.
 */
export interface AudienceCandidate {
  name: string
  rationale: string
  /** Suspected primary COM-B component (preview of L2 work). */
  com_b_hypothesis: string
  /** Which direction this audience is leverage for. */
  direction_leverage?: Direction
}

/**
 * Operational Frame — the structured artifact between L1 (Behavior Analysis)
 * and L2 (COM-B Diagnosis). One Frame per (behavior, objective) pair.
 */
export interface OperationalFrame {
  id?: string
  workspace_id?: string
  created_at?: string
  updated_at?: string

  /** Anchors to a stored BehaviorAnalysis. */
  linked_behavior_id?: string

  /** Operator's raw input. */
  objective_text: string
  /** Cleaned-up form. */
  objective_restated: string

  direction: Direction
  desired_behavior: DesiredBehavior
  baseline: FrameBaseline
  measurement: FrameMeasurement

  /** Causal chain from PSYOP behavior change to maneuver CDR's intent.
   *  1-3 sentences. Must name a tactical/operational outcome (not "improve
   *  security" or "reduce risk" — those are non-statements). */
  operational_so_what: string

  /** Audiences from L1 §8 leverage analysis filtered by direction. */
  filtered_audience_candidates: AudienceCandidate[]

  /** Non-actionable objective flags, ROE concerns, language-mismatch hints,
   *  shift-without-substitute warnings, etc. */
  warnings: string[]
}

/**
 * Audience-specific baseline (Section C of the spec) — Michie's behavior-
 * frequency framework specialized to ONE specific audience, narrower than
 * the population baseline on the Frame.
 */
export interface AudienceBaseline {
  estimated_rate: string
  measurement_method: string
  confidence: Confidence
}

/**
 * Behavior delta — concrete gap between current and desired audience behavior.
 */
export interface BehaviorDelta {
  current_state: string
  desired_state: string
  gap_description: string
}

/**
 * Direction-aware leverage interpretation per COM-B component. Per BCW Guide
 * Box 2.6: the deficits map describes the audience's COM-B state OBJECTIVELY,
 * but the intervention IMPLICATION flips by direction:
 *   ↑ direction: major_barrier=HIGH (gap to close), adequate=LOW (no leverage)
 *   ↓ direction: adequate=HIGH (entrenched, target via restriction),
 *                major_barrier=LOW (already blocked)
 *   shift: composite (high on what enables original OR blocks substitute)
 *   introduce: like ↑ but emphasis on education/modelling/training
 */
export interface DirectionAwareLeverage {
  component: ComBComponent
  /** 1 sentence: what THIS deficit/adequacy level means for THIS direction. */
  intervention_implication: string
  /** Per BCW Guide Box 2.6 mapping. */
  intervention_priority: 'high' | 'medium' | 'low'
  /** 1 sentence naming a SPECIFIC intervention lever (not a generic claim). */
  hypothesized_lever: string
}

/**
 * Frame search filters (parallels BehaviorSearchFilters).
 */
export interface OperationalFrameSearchFilters {
  direction?: Direction
  linked_behavior_id?: string
  workspace_id?: string
}
