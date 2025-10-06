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

export type FrequencyPattern = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'semi_annual' | 'annual' | 'biennial' | 'seasonal' | 'one_time' | 'irregular' | 'as_needed'
export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night' | 'any_time'

export interface TemporalContext {
  frequency_pattern?: FrequencyPattern
  time_of_day?: TimeOfDay[]
  duration_typical?: string // Free text: "5 minutes", "1 hour", "ongoing"
  timing_notes?: string
}

export interface EligibilityRequirements {
  has_requirements: boolean
  age_requirements?: string
  legal_requirements?: string // Citizenship, licenses, permits
  skill_requirements?: string // Technical skills, literacy level
  resource_requirements?: string // Money, equipment, transportation
  other_requirements?: string
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

export interface TimelineEvent {
  id: string
  label: string
  time?: string // HH:MM or relative like "T+30min"
  description?: string
  location?: string // Where this step occurs
  is_decision_point?: boolean

  // Nested behavior support - link to existing behavior analysis
  linked_behavior_id?: string        // Link to existing behavior analysis
  linked_behavior_title?: string     // Cache for display
  linked_behavior_type?: BehaviorComplexity  // Cache: complexity level

  sub_steps?: TimelineSubStep[]
  forks?: TimelineFork[]
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
  potential_audiences?: any[]

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
