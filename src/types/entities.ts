/**
 * Entity System Types
 * Intelligence entity management with deception detection integration
 */

import type { DeceptionScores, DeceptionAssessment } from '@/lib/deception-scoring'

// ============================================================
// WORKSPACE TYPES
// ============================================================

export type WorkspaceType = 'PERSONAL' | 'TEAM' | 'PUBLIC'
export type WorkspaceRole = 'ADMIN' | 'EDITOR' | 'VIEWER'

export interface Workspace {
  id: string
  name: string
  description?: string
  type: WorkspaceType

  // Ownership
  owner_id: number

  // Settings
  is_public: boolean
  allow_cloning: boolean

  // Statistics
  entity_count: {
    actors: number
    sources: number
    evidence: number
    events: number
    places: number
    behaviors: number
  }

  // Library features (for public workspaces)
  votes?: number
  stars?: number
  forks?: number
  views?: number

  // Metadata
  created_at: string
  updated_at: string
}

export interface WorkspaceMember {
  id: string
  workspace_id: string
  user_id: number
  role: WorkspaceRole
  permissions?: string[] // Fine-grained permissions
  joined_at: string
}

// ============================================================
// ACTOR TYPES
// ============================================================

export type ActorType = 'PERSON' | 'ORGANIZATION' | 'UNIT' | 'GOVERNMENT' | 'GROUP' | 'OTHER'

// ============================================================
// MOM ASSESSMENT TYPES (NEW - Event-Actor Connected)
// ============================================================

export interface MOMAssessment {
  id: string
  actor_id: string           // Required - who is being assessed
  event_id?: string          // Optional - specific event/incident
  scenario_description: string  // Required - what scenario is this

  // MOM Scores (0-5 each)
  motive: number
  opportunity: number
  means: number

  // Context
  notes: string
  assessed_by?: number
  assessed_at: string

  // Metadata
  workspace_id: string
  created_at: string
  updated_at: string
}

// ============================================================
// POP ASSESSMENT TYPES (Enhanced - Actor Connected)
// ============================================================

export interface POPAssessment {
  historical_pattern: number      // 0-5: How consistent are their deception patterns?
  sophistication_level: number    // 0-5: How advanced is their tradecraft?
  success_rate: number            // 0-5: How often do they succeed?
  notes: string
  assessed_at: string
}

export interface POPVariation {
  topic: string                   // e.g., "Cyber Operations", "Financial Fraud"
  assessment: POPAssessment
}

// ============================================================
// LEGACY DECEPTION PROFILE (Deprecated - for backward compatibility)
// ============================================================

/**
 * @deprecated Use separate MOMAssessment entity and Actor.primary_pop instead
 * This structure will be removed in a future version.
 */
export interface ActorDeceptionProfile {
  mom: {
    motive: number // 0-5
    opportunity: number // 0-5
    means: number // 0-5
    notes: string
  }
  pop: {
    historical_pattern: number // 0-5
    sophistication_level: number // 0-5
    success_rate: number // 0-5
    notes: string
  }
  overall_assessment: DeceptionAssessment
  last_updated: string
}

export interface Actor {
  id: string
  type: ActorType

  // Basic Information
  name: string
  aliases: string[]
  description?: string

  // Classification
  category?: string // e.g., "Military", "Political", "Intelligence"
  role?: string // e.g., "Commander", "Minister", "Operative"
  affiliation?: string // e.g., "Russian Federation", "Wagner Group"

  // NEW: POP Assessment (Actor-centric behavioral patterns)
  primary_pop?: POPAssessment         // General deception patterns
  pop_variations?: POPVariation[]     // Topic-specific patterns (e.g., "Cyber Ops", "Social Engineering")

  // LEGACY: Deception Assessment (Deprecated - for backward compatibility)
  /**
   * @deprecated Use primary_pop for POP assessment. MOM assessments are now separate entities.
   * This field will be removed in a future version.
   */
  deception_profile?: ActorDeceptionProfile

  // Framework Links
  causeway_analysis_id?: number
  cog_analysis_id?: number

  // Workspace
  workspace_id: string
  created_by: number
  created_at: string
  updated_at: string

  // Library
  is_public: boolean
  votes: number
}

// ============================================================
// SOURCE TYPES
// ============================================================

export type SourceType = 'PERSON' | 'DOCUMENT' | 'WEBSITE' | 'DATABASE' | 'MEDIA' | 'SYSTEM' | 'ORGANIZATION' | 'OTHER'
export type SourceAccessLevel = 'EXCLUSIVE' | 'LIMITED' | 'SHARED' | 'OPEN'
export type SourceReliability = 'A' | 'B' | 'C' | 'D' | 'E' | 'F'

export interface MOSESAssessment {
  source_vulnerability: number // 0-5
  manipulation_evidence: number // 0-5
  access_level: SourceAccessLevel
  reliability: SourceReliability
  notes: string
}

export interface Source {
  id: string
  type: SourceType

  // Basic Information
  name: string
  description?: string
  source_type?: string // e.g., "Agent", "Intercept", "Satellite"

  // MOSES Assessment
  moses_assessment?: MOSESAssessment

  // Relationships
  controlled_by?: string // Actor ID

  // Workspace
  workspace_id: string
  created_by: number
  created_at: string
  updated_at: string

  // Library
  is_public: boolean
  votes: number
}

// ============================================================
// EVIDENCE TYPES (Enhanced with EVE)
// ============================================================

export interface EVEAssessment {
  internal_consistency: number // 0-5 (INVERTED - low = high risk)
  external_corroboration: number // 0-5 (INVERTED - low = high risk)
  anomaly_detection: number // 0-5 (high = high risk)
  notes: string
  assessed_at: string
}

// Enhanced Evidence interface (extends existing evidence type)
export interface EnhancedEvidence {
  id: number
  title: string
  description?: string
  content: string
  type: string
  status: string
  tags: string[]
  source: Record<string, unknown>
  metadata: Record<string, unknown>

  // EVE Assessment (NEW)
  eve_assessment?: EVEAssessment

  // Entity Linkage (NEW)
  source_id?: string // Link to Source entity
  event_id?: string // Link to Event entity
  related_actors?: string[] // Actor IDs mentioned/involved

  // Workspace (NEW)
  workspace_id?: string
  is_public: boolean
  votes: number

  // Existing fields
  created_by: string
  created_at: string
  updated_by?: string
  updated_at: string
  version: number
}

// ============================================================
// EVENT TYPES
// ============================================================

export type EventType = 'OPERATION' | 'INCIDENT' | 'MEETING' | 'ACTIVITY' | 'OTHER'
export type EventSignificance = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
export type EventConfidence = 'CONFIRMED' | 'PROBABLE' | 'POSSIBLE' | 'DOUBTFUL'

export interface Event {
  id: string

  // Basic Information
  name: string
  description?: string
  event_type: EventType

  // Temporal
  date_start: string
  date_end?: string
  duration?: number // Duration in minutes

  // Spatial
  location_id?: string // Link to Place entity
  coordinates?: { lat: number; lng: number }

  // Analysis
  significance?: EventSignificance
  confidence?: EventConfidence

  // Framework Links
  timeline_id?: number

  // Workspace
  workspace_id: string
  created_by: number
  created_at: string
  updated_at: string

  // Library
  is_public: boolean
  votes: number
}

// ============================================================
// PLACE TYPES
// ============================================================

export type PlaceType = 'FACILITY' | 'CITY' | 'REGION' | 'COUNTRY' | 'INSTALLATION' | 'OTHER'
export type StrategicImportance = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'

export interface Place {
  id: string

  // Basic Information
  name: string
  description?: string
  place_type: PlaceType

  // Geographic
  coordinates: { lat: number; lng: number }
  address?: string
  country?: string
  region?: string

  // Analysis
  strategic_importance?: StrategicImportance

  // Relationships
  controlled_by?: string // Actor ID

  // Workspace
  workspace_id: string
  created_by: number
  created_at: string
  updated_at: string

  // Library
  is_public: boolean
  votes: number
}

// ============================================================
// BEHAVIOR TYPES
// ============================================================

export type BehaviorType = 'TTP' | 'PATTERN' | 'TACTIC' | 'TECHNIQUE' | 'PROCEDURE'
export type BehaviorFrequency = 'CONTINUOUS' | 'FREQUENT' | 'OCCASIONAL' | 'RARE'
export type BehaviorSophistication = 'ADVANCED' | 'INTERMEDIATE' | 'BASIC'
export type BehaviorEffectiveness = 'HIGHLY_EFFECTIVE' | 'EFFECTIVE' | 'MODERATELY_EFFECTIVE' | 'INEFFECTIVE'

export interface Behavior {
  id: string

  // Basic Information
  name: string
  description?: string
  behavior_type: BehaviorType

  // Pattern Details
  indicators: string[] // Observable indicators
  frequency?: BehaviorFrequency
  first_observed?: string
  last_observed?: string

  // Analysis
  sophistication?: BehaviorSophistication
  effectiveness?: BehaviorEffectiveness

  // Framework Links
  behavior_analysis_id?: number

  // Workspace
  workspace_id: string
  created_by: number
  created_at: string
  updated_at: string

  // Library
  is_public: boolean
  votes: number
}

// ============================================================
// RELATIONSHIP TYPES
// ============================================================

export type RelationshipType =
  | 'CONTROLS'
  | 'REPORTS_TO'
  | 'ALLIED_WITH'
  | 'ADVERSARY_OF'
  | 'MEMBER_OF'
  | 'LOCATED_AT'
  | 'PARTICIPATED_IN'
  | 'PROVIDED_BY'
  | 'EXHIBITS'
  | 'CORROBORATES'
  | 'CONTRADICTS'
  | 'DEPENDS_ON'
  | 'ASSESSED_FOR'
  | 'PERFORMED'
  | 'TARGETED'
  | 'USED'
  | 'CUSTOM'

export type RelationshipConfidence = 'CONFIRMED' | 'PROBABLE' | 'POSSIBLE' | 'SUSPECTED'

export type RelationshipValidationStatus = 'PENDING' | 'VALIDATED' | 'REJECTED'

export type RelationshipGenerationSource =
  | 'MANUAL'
  | 'MOM_ASSESSMENT'
  | 'COG_ANALYSIS'
  | 'CAUSEWAY_ANALYSIS'
  | 'FRAMEWORK_INFERENCE'

export interface Relationship {
  id: string

  // Entities
  source_entity_id: string
  source_entity_type: EntityType
  target_entity_id: string
  target_entity_type: EntityType

  // Relationship
  relationship_type: RelationshipType
  description?: string
  weight: number // Relationship strength 0.0-1.0

  // Temporal
  start_date?: string
  end_date?: string

  // Confidence
  confidence?: RelationshipConfidence

  // Supporting Evidence
  evidence_ids?: number[] // Evidence IDs supporting this relationship

  // NEW: Auto-generation tracking
  auto_generated: boolean
  generation_source: RelationshipGenerationSource
  inference_confidence?: number // 0-1 for inferred relationships

  // NEW: Validation
  validation_status: RelationshipValidationStatus
  validated_by?: number // User ID who validated
  validated_at?: string

  // NEW: Conflict detection
  conflicts_with?: string[] // IDs of contradictory relationships
  conflict_reason?: string

  // Workspace
  workspace_id: string
  created_by: number
  created_at: string
  updated_at: string
}

// ============================================================
// LIBRARY TYPES
// ============================================================

export type EntityType = 'ACTOR' | 'SOURCE' | 'EVIDENCE' | 'EVENT' | 'PLACE' | 'BEHAVIOR'
export type LibraryItemStatus = 'PENDING' | 'APPROVED' | 'FLAGGED' | 'REJECTED'

export interface LibraryItem {
  id: string

  entity_id: string
  entity_type: EntityType

  // Publishing
  published_by: number
  published_at: string
  workspace_id: string

  // Quality
  votes: number
  stars: number // Average star rating 0.0-5.0
  views: number
  clones: number

  // Moderation
  status: LibraryItemStatus
  reviewed_by?: number
  reviewed_at?: string

  // Discovery
  tags: string[]
  categories: string[]

  // Attribution
  original_creator: number
  contributors: number[]
  license?: string
}

// ============================================================
// JUNCTION TABLE TYPES
// ============================================================

export interface ActorEvent {
  actor_id: string
  event_id: string
  role?: string // e.g., "Participant", "Organizer", "Target"
}

export interface EvidenceActor {
  evidence_id: number
  actor_id: string
  relevance?: string // e.g., "Mentioned", "Involved", "Author"
}

export interface SourceEvidence {
  source_id: string
  evidence_id: number
}

export interface ActorBehavior {
  actor_id: string
  behavior_id: string
  frequency?: string
  last_exhibited?: string
}

export interface EventEvidence {
  event_id: string
  evidence_id: number
  relevance?: string
}

// ============================================================
// NETWORK VISUALIZATION TYPES
// ============================================================

export interface NetworkNode {
  id: string
  type: EntityType
  label: string

  // Visual properties
  size: number // Based on importance/connections
  color: string // Based on deception risk or type
  icon?: string // Icon representing entity type

  // Deception coloring
  deception_risk?: number // 0-100 for actors/sources

  // Metadata
  data: Actor | Source | EnhancedEvidence | Event | Place | Behavior
}

export interface NetworkEdge {
  id: string
  source: string // Node ID
  target: string // Node ID
  type: RelationshipType

  // Visual properties
  weight: number // Relationship strength
  color: string
  style: 'solid' | 'dashed' | 'dotted'
  label?: string

  // Temporal
  start_date?: string
  end_date?: string

  // Metadata
  confidence?: RelationshipConfidence
  evidence_supporting?: number[] // Evidence IDs
}

export interface NetworkGraph {
  nodes: NetworkNode[]
  edges: NetworkEdge[]
}

// ============================================================
// API REQUEST/RESPONSE TYPES
// ============================================================

export interface CreateActorRequest {
  name: string
  type: ActorType
  aliases?: string[]
  description?: string
  category?: string
  role?: string
  affiliation?: string
  workspace_id: string
}

export interface CreateSourceRequest {
  name: string
  type: SourceType
  description?: string
  source_type?: string
  workspace_id: string
}

export interface CreateEventRequest {
  name: string
  event_type: EventType
  date_start: string
  description?: string
  workspace_id: string
}

export interface CreatePlaceRequest {
  name: string
  place_type: PlaceType
  coordinates: { lat: number; lng: number }
  description?: string
  workspace_id: string
}

export interface CreateBehaviorRequest {
  name: string
  behavior_type: BehaviorType
  description?: string
  indicators?: string[]
  workspace_id: string
}

export interface CreateRelationshipRequest {
  source_entity_id: string
  source_entity_type: EntityType
  target_entity_id: string
  target_entity_type: EntityType
  relationship_type: RelationshipType
  description?: string
  weight?: number
  confidence?: RelationshipConfidence
  start_date?: string
  end_date?: string
  evidence_ids?: number[]
  workspace_id: string
}

export interface UpdateRelationshipRequest {
  relationship_type?: RelationshipType
  description?: string
  weight?: number
  confidence?: RelationshipConfidence
  start_date?: string
  end_date?: string
  evidence_ids?: number[]
}

export interface BulkCreateRelationshipsRequest {
  relationships: CreateRelationshipRequest[]
  workspace_id: string
}

export interface CreateMOMAssessmentRequest {
  actor_id: string
  event_id?: string
  scenario_description: string
  motive: number
  opportunity: number
  means: number
  notes?: string
  workspace_id: string
}

export interface UpdateMOMAssessmentRequest {
  scenario_description?: string
  motive?: number
  opportunity?: number
  means?: number
  notes?: string
}

// ============================================================
// QUERY FILTERS
// ============================================================

export interface EntityQueryFilters {
  workspace_id?: string
  entity_types?: EntityType[]
  deception_risk_min?: number
  deception_risk_max?: number
  is_public?: boolean
  search?: string
  limit?: number
  offset?: number
  sort_by?: 'created_at' | 'updated_at' | 'name' | 'votes'
  sort_order?: 'asc' | 'desc'
}

export interface NetworkQueryFilters extends EntityQueryFilters {
  depth?: number // How many relationship hops to include
  include_types?: EntityType[]
  exclude_types?: EntityType[]
}
