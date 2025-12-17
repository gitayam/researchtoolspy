/**
 * Framework-Evidence Integration Types
 *
 * Defines how evidence (Data, Actors, Sources, Events) can be linked to
 * analysis frameworks like ACH, SWOT, COG, etc.
 */

import type { EvidenceItem } from './evidence'
import type { Actor, Source, Event } from './entities'

// Framework types that support evidence linking
export type FrameworkType =
  | 'ach'              // Analysis of Competing Hypotheses
  | 'cog'              // Center of Gravity
  | 'pmesii'           // PMESII-PT
  | 'deception'        // Deception Detection
  | 'behavioral'       // Behavioral Analysis
  | 'stakeholder'      // Stakeholder Analysis
  | 'surveillance'     // Surveillance Framework
  | 'causeway'         // Causeway
  | 'trend'            // Trend Analysis
  | 'swot'             // SWOT Analysis
  | 'dotmlpf'          // DOTMLPF
  | 'dime'             // DIME Framework

// Entity types that can be linked as evidence
export type EvidenceEntityType = 'data' | 'actor' | 'source' | 'event'

// How evidence relates to the framework item
export type EvidenceLinkRelation =
  | 'supports'         // Evidence supports this hypothesis/claim
  | 'contradicts'      // Evidence contradicts this hypothesis/claim
  | 'neutral'          // Evidence is neutral/informational
  | 'contextual'       // Provides context/background
  | 'referenced'       // Simply referenced, no explicit stance

// Framework-Evidence Link (database model)
export interface FrameworkEvidenceLink {
  id: string

  // Framework reference
  framework_type: FrameworkType
  framework_id: string           // ID of the specific analysis (ACH analysis ID, SWOT ID, etc.)
  framework_item_id?: string     // Optional: ID of specific item within framework (hypothesis ID, quadrant item ID)

  // Evidence reference
  entity_type: EvidenceEntityType
  entity_id: string | number

  // Link metadata
  relation?: EvidenceLinkRelation
  relevance_score?: number       // 1-10 how relevant this evidence is
  notes?: string                 // User notes about why this evidence is linked
  tags?: string[]                // Additional tags for organization

  // Audit
  created_at: string
  created_by: number
  updated_at?: string
  updated_by?: number

  // Workspace
  workspace_id: string
}

// Linked evidence with full entity data (for display)
export interface LinkedEvidence {
  // Link metadata
  link_id?: string
  framework_item_id?: string     // Section/item within framework (for grouping)
  entity_type: EvidenceEntityType
  entity_id: string | number
  relation?: EvidenceLinkRelation
  relevance_score?: number
  notes?: string
  tags?: string[]

  // Full entity data (loaded via join)
  entity_data: EvidenceItem | Actor | Source | Event

  // Timestamps
  linked_at?: string
  linked_by?: number
}

// API Request/Response types
export interface LinkEvidenceRequest {
  framework_type: FrameworkType
  framework_id: string
  framework_item_id?: string

  links: {
    entity_type: EvidenceEntityType
    entity_id: string | number
    relation?: EvidenceLinkRelation
    relevance_score?: number
    notes?: string
    tags?: string[]
  }[]

  workspace_id: string
}

export interface LinkEvidenceResponse {
  success: boolean
  links_created: number
  links: FrameworkEvidenceLink[]
}

export interface GetLinkedEvidenceRequest {
  framework_type: FrameworkType
  framework_id: string
  framework_item_id?: string
  entity_types?: EvidenceEntityType[]  // Filter by type
  relation?: EvidenceLinkRelation      // Filter by relation
}

export interface GetLinkedEvidenceResponse {
  success: boolean
  total: number
  evidence: LinkedEvidence[]
  breakdown: {
    data: number
    actor: number
    source: number
    event: number
  }
}

export interface UnlinkEvidenceRequest {
  framework_type: FrameworkType
  framework_id: string
  entity_type: EvidenceEntityType
  entity_id: string | number
}

// Evidence statistics for framework
export interface FrameworkEvidenceStats {
  total_linked: number
  by_type: Record<EvidenceEntityType, number>
  by_relation: Record<EvidenceLinkRelation, number>
  avg_relevance: number
  risk_summary: {
    low: number
    medium: number
    high: number
    critical: number
  }
}

// Hook return type for using evidence linking
export interface UseFrameworkEvidence {
  linkedEvidence: LinkedEvidence[]
  stats: FrameworkEvidenceStats
  loading: boolean
  error: string | null

  // Actions
  linkEvidence: (links: { entity_type: EvidenceEntityType; entity_id: string | number; relation?: EvidenceLinkRelation }[]) => Promise<void>
  unlinkEvidence: (entity_type: EvidenceEntityType, entity_id: string | number) => Promise<void>
  updateLink: (link_id: string, updates: Partial<FrameworkEvidenceLink>) => Promise<void>
  reload: () => Promise<void>
}
