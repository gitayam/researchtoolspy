/**
 * Behavior Analysis Types
 *
 * IMPORTANT: Behavior Analysis = BEHAVIOR + LOCATION
 * These analyses document specific behaviors in specific contexts/locations.
 * Designed for public submission, indexing, and querying.
 */

export type GeographicScope = 'local' | 'regional' | 'national' | 'international' | 'global'

export interface LocationContext {
  geographic_scope: GeographicScope
  specific_locations: string[] // City, state, country, region (for indexing)
  location_notes?: string
}

export type BehaviorSettingType = 'in_person' | 'online' | 'hybrid' | 'phone' | 'mail' | 'app'

export interface BehaviorSettings {
  settings: BehaviorSettingType[]
  setting_details?: string
}

export type FrequencyPattern = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'semi_annual' | 'annual' | 'biennial' | 'seasonal' | 'one_time' | 'irregular' | 'as_needed' | 'custom'
export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night' | 'any_time'
export type FrequencyTimeUnit = 'minutes' | 'hours' | 'days' | 'weeks' | 'months' | 'years'

export interface TemporalContext {
  frequency_pattern?: FrequencyPattern
  custom_frequency_number?: number
  custom_frequency_unit?: FrequencyTimeUnit
  time_of_day?: TimeOfDay[]
  duration_typical?: string // Free text: "5 minutes", "1 hour", "ongoing"
  timing_notes?: string
}

export interface EligibilityRequirements {
  has_requirements: boolean
  age_requirements?: string[] // Array of age requirements
  legal_requirements?: string[] // Citizenship, licenses, permits (individual items)
  skill_requirements?: string[] // Technical skills, literacy level (individual items)
  resource_requirements?: string[] // Money, equipment, transportation (individual items)
  other_requirements?: string[] // Other requirements (individual items)
}

export type BehaviorComplexity = 'single_action' | 'simple_sequence' | 'complex_process' | 'ongoing_practice'

// Temporal scale for consequences and outcomes
export type ConsequenceTimeframe = 'immediate' | 'long_term' | 'generational'

// Valence (positive/negative) for consequences
export type ConsequenceValence = 'positive' | 'negative' | 'neutral' | 'mixed'

export interface ConsequenceItem {
  id: string
  consequence: string
  timeframe: ConsequenceTimeframe
  valence: ConsequenceValence
  description?: string
  who_affected?: string // Who experiences this consequence
}

// Symbol types for behavior analysis
export type SymbolType = 'visual' | 'auditory' | 'social' | 'other'

export interface SymbolItem {
  id: string
  name: string // What is this symbol? (e.g., "Red baseball cap", "Victory gesture")
  symbol_type: SymbolType
  description?: string // What does it represent/signify?
  context?: string // When/where is it used?

  // Media support (visual symbols)
  image_url?: string // Uploaded image URL (stored) or external link
  image_data?: string // Base64 image data (temporary, before upload)

  // Media support (auditory symbols) - NEW
  audio_url?: string // Uploaded audio URL (stored) or external link
  audio_data?: string // Base64 audio data (temporary, before upload)

  // Media source mode - NEW
  media_source?: 'upload' | 'link' // How media was provided
}

// Extended TimelineEvent with sub-steps and forks
export interface TimelineSubStep {
  label: string
  description?: string
  duration?: string
}

export interface TimelineFork {
  condition: string // "If X happens", "Alternative path"
  label: string
  path: TimelineEvent[]
}

/**
 * §2 Behavior Timeline goal-oriented decision typology.
 *
 * Per the Operational Frame spec + BCW Guide + ABC of BCT theories
 * (HAPA #24, TTM #82, PAPM #44, SDT #56, Control Theory #11, PRIME #46).
 * Timeline models the ACTOR'S PSYCHOLOGICAL TRAJECTORY through goal pursuit,
 * not the bureaucratic process. `administrative_gate` events should be a
 * MINORITY — the spine is the actor's choices.
 *
 *   goal_formation     — TTM Precontemplation→Contemplation; HAPA risk perception
 *   intention          — TPB intention; HAPA motivational output; PAPM Decided to act
 *   action_plan        — HAPA volitional planning; Gollwitzer if-then plans
 *   coping_plan        — HAPA coping planning; Relapse Prevention coping response
 *   initiation         — crossing the intention–behavior gap (Temporal Self-Regulation)
 *   persistence        — Control Theory feedback loop; recurring after setbacks
 *   identity           — SDT internalisation; commitment to role identities
 *   maintenance        — TTM Maintenance; habit consolidation (BCW Fig 1.6)
 *   disengagement      — PAPM "Decided not to act" — a destination, not failure
 *   administrative_gate — bureaucratic accept/reject. Should be a MINORITY.
 */
export type DecisionType =
  | 'goal_formation'
  | 'intention'
  | 'action_plan'
  | 'coping_plan'
  | 'initiation'
  | 'persistence'
  | 'identity'
  | 'maintenance'
  | 'disengagement'
  | 'administrative_gate'

/** Transtheoretical Model stages (Prochaska & DiClemente; PAPM "decided_not_to_act"). */
export type TTMStage =
  | 'precontemplation'
  | 'contemplation'
  | 'preparation'
  | 'action'
  | 'maintenance'
  | 'relapse'
  | 'decided_not_to_act'

/** HAPA two-phase split (Schwarzer). */
export type HAPAPhase = 'motivational' | 'volitional'

/** PRIME / dual-process motivation mode at the moment of the event. */
export type MotivationMode = 'reflective_dominant' | 'automatic_dominant' | 'contested'

/** COM-B sub-component as a per-event intervention target — pre-stages L2 work. */
export type COMBTarget =
  | 'physical_capability'
  | 'psychological_capability'
  | 'physical_opportunity'
  | 'social_opportunity'
  | 'reflective_motivation'
  | 'automatic_motivation'

/** Psychological state at a specific timeline event. */
export interface PsychologicalState {
  /** TTM stage. */
  stage: TTMStage
  /** HAPA phase. */
  phase: HAPAPhase
  /** PRIME motivation mode at this moment. */
  motivation_mode: MotivationMode
}

/** Pre-decided obstacle→response pair (HAPA coping planning). */
export interface CopingBranch {
  obstacle: string
  response: string
}

export interface TimelineEvent {
  id: string
  label: string
  time?: string // HH:MM or relative like "T+30min"
  description?: string
  location?: string // Where this step occurs

  /**
   * @deprecated Prefer `decision_type`. Kept for backward compatibility with
   * pre-Operational-Frame timelines. Migration: true → 'goal_formation',
   * false → 'administrative_gate'.
   */
  is_decision_point?: boolean

  /** Goal-oriented decision typology (replaces is_decision_point). */
  decision_type?: DecisionType

  /** Per-event psychological state — TTM stage + HAPA phase + motivation mode. */
  psychological_state?: PsychologicalState

  /** Which COM-B sub-component a future intervention would target to shift
   *  this decision — pre-stages L2 work. */
  com_b_target?: COMBTarget

  /** Pre-decided obstacle→response pairs (HAPA coping planning, typically
   *  on coping_plan events). */
  coping_branches?: CopingBranch[]

  /** Alternative behaviors competing for the actor's attention/effort at
   *  this event (BCW Guide p. 70). */
  competing_behaviours?: string[]

  // Nested behavior support - link to existing behavior analysis
  linked_behavior_id?: string        // Link to existing behavior analysis
  linked_behavior_title?: string     // Cache for display
  linked_behavior_type?: BehaviorComplexity  // Cache: complexity level

  sub_steps?: TimelineSubStep[]
  forks?: TimelineFork[]
}

/**
 * §8 Audience candidate per the direction-leverage analysis.
 * L1 stays direction-agnostic — this labels WHERE the behaviour's distribution
 * creates intervention leverage in either direction. The operator decides
 * direction at Frame time. An audience can appear in BOTH lists if its
 * behaviour distribution within that group is mixed.
 */
export interface AudienceCandidate {
  name: string
  rationale: string
  /** Suspected primary COM-B component for this audience (preview of L2). */
  com_b_hypothesis?: string
}

/**
 * §8 Potential Target Audiences — direction-leverage analysis.
 *
 * Replaces the older legacy shape `{currently_performs, could_but_doesnt}`
 * which mapped audience-state to direction-leverage 1:1:
 *   currently_performs → decrease_leverage (audiences who DO it have ↓ leverage)
 *   could_but_doesnt   → increase_leverage (audiences who DON'T have ↑ leverage)
 *
 * The new shape is the canonical going-forward form; UIs should accept both
 * via a normalizer for backward compatibility (signal-bot mirrors this).
 */
export interface PotentialAudiences {
  /** Audiences with leverage IF the goal becomes to INCREASE the behavior.
   *  Typically: behavior is absent, rare, or contested in this group. */
  increase_leverage: AudienceCandidate[]
  /** Audiences with leverage IF the goal becomes to DECREASE the behavior.
   *  Typically: behavior is present, frequent, or entrenched in this group. */
  decrease_leverage: AudienceCandidate[]
}

/**
 * Legacy §8 shape for backward compatibility. New analyses should produce
 * `PotentialAudiences` (above); old analyses with this shape are migrated by
 * the consumer's normalizer.
 *
 * @deprecated — use PotentialAudiences instead.
 */
export interface LegacyPotentialAudiences {
  currently_performs?: AudienceCandidate[]
  could_but_doesnt?: AudienceCandidate[]
}

// Main Behavior Analysis structure with enhanced fields
export interface BehaviorAnalysis {
  id?: string
  title: string
  description: string
  source_url?: string
  created_at?: string
  updated_at?: string
  workspace_id?: string

  // ENHANCED: Structured context fields for indexing/querying
  location_context: LocationContext
  behavior_settings: BehaviorSettings
  temporal_context: TemporalContext
  eligibility: EligibilityRequirements
  complexity: BehaviorComplexity

  // Timeline with enhanced features
  timeline?: TimelineEvent[]

  // Framework sections (arrays of items)
  environmental_factors?: any[]
  social_context?: any[]
  consequences?: ConsequenceItem[]
  symbols?: SymbolItem[]
  observed_patterns?: any[]
  /** §8 audiences. Canonical shape is PotentialAudiences (direction-leverage
   *  split). LegacyPotentialAudiences accepted on read for backward compat;
   *  consumer normalizer maps to the canonical shape. */
  potential_audiences?: PotentialAudiences | LegacyPotentialAudiences

  // Metadata for public submissions
  is_public?: boolean
  tags?: string[] // For categorization
  category?: string // Health, Civic, Economic, Social, Environmental, etc.
}

// For AI Timeline Generation
export interface TimelineGenerationRequest {
  behavior_title: string
  behavior_description: string
  location_context: LocationContext
  behavior_settings: BehaviorSettings
  temporal_context: TemporalContext
  complexity: BehaviorComplexity
  existing_timeline?: TimelineEvent[]
}

// For indexing/searching public behaviors
export interface BehaviorSearchFilters {
  geographic_scope?: GeographicScope
  locations?: string[]
  settings?: BehaviorSettingType[]
  frequency?: FrequencyPattern
  complexity?: BehaviorComplexity
  category?: string
  tags?: string[]
  has_timeline?: boolean
}

// Display metadata for public catalog
export interface BehaviorMetadata {
  id: string
  title: string
  description: string
  location_context: LocationContext
  settings: BehaviorSettingType[]
  complexity: BehaviorComplexity
  category?: string
  tags?: string[]
  created_at: string
  upvotes?: number
  usage_count?: number // How many COM-B analyses link to it
}
