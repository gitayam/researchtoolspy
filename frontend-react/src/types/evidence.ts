// Evidence System Types

// Evidence Type (what kind of evidence)
export const EvidenceType = {
  OBSERVATION: 'observation',
  DOCUMENT: 'document',
  TESTIMONY: 'testimony',
  PHYSICAL: 'physical',
  DIGITAL: 'digital',
  INTERCEPTED: 'intercepted',
  OPEN_SOURCE: 'open_source',
  CLASSIFIED: 'classified',
  FINANCIAL: 'financial',
  GEOSPATIAL: 'geospatial',
  BIOMETRIC: 'biometric',
  TECHNICAL: 'technical',
} as const

export type EvidenceType = typeof EvidenceType[keyof typeof EvidenceType]

// Evidence Level (tactical, operational, strategic)
export const EvidenceLevel = {
  TACTICAL: 'tactical',
  OPERATIONAL: 'operational',
  STRATEGIC: 'strategic',
} as const

export type EvidenceLevel = typeof EvidenceLevel[keyof typeof EvidenceLevel]

// Evidence Status
export const EvidenceStatus = {
  PENDING: 'pending',
  VERIFIED: 'verified',
  REJECTED: 'rejected',
  NEEDS_REVIEW: 'needs_review',
  ARCHIVED: 'archived',
} as const

export type EvidenceStatus = typeof EvidenceStatus[keyof typeof EvidenceStatus]

// Confidence Level
export const ConfidenceLevel = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CONFIRMED: 'confirmed',
} as const

export type ConfidenceLevel = typeof ConfidenceLevel[keyof typeof ConfidenceLevel]

// Priority Level
export const PriorityLevel = {
  LOW: 'low',
  NORMAL: 'normal',
  HIGH: 'high',
  CRITICAL: 'critical',
} as const

export type PriorityLevel = typeof PriorityLevel[keyof typeof PriorityLevel]

// Citation Type
export const CitationType = {
  PRIMARY: 'primary',
  SECONDARY: 'secondary',
  SUPPORTING: 'supporting',
} as const

export type CitationType = typeof CitationType[keyof typeof CitationType]

// Citation Style
export const CitationStyle = {
  APA: 'apa',
  MLA: 'mla',
  CHICAGO: 'chicago',
  BLUEBOOK: 'bluebook',
  VANCOUVER: 'vancouver',
} as const

export type CitationStyle = typeof CitationStyle[keyof typeof CitationStyle]

// Main Evidence Item Interface
export interface EvidenceItem {
  id: number
  title: string
  description?: string

  // 5 W's + How
  who?: string           // Person, entity, or actor involved
  what?: string          // What happened or what is it
  when_occurred?: string // When it happened (timestamp or date range)
  where_location?: string// Where it occurred (location, coordinates, place)
  why_purpose?: string   // Why it happened or purpose
  how_method?: string    // How it happened or method used

  // Classification
  evidence_type: EvidenceType
  evidence_level: EvidenceLevel
  category?: string      // For framework categorization (PMESII, DIME, etc.)

  // Assessment
  credibility: string    // Credibility rating (A-F scale or 1-6)
  reliability: string    // Reliability rating
  confidence_level: ConfidenceLevel

  // Metadata
  tags: string[]
  status: EvidenceStatus
  priority: PriorityLevel

  // Timestamps
  created_at: string
  updated_at: string
  created_by: number
  updated_by: number

  // Related data (loaded from joins)
  citations?: EvidenceCitation[]
}

// Evidence Citation Interface
export interface EvidenceCitation {
  id: number
  evidence_id: number
  dataset_id: number

  // Citation details
  citation_type: CitationType
  page_number?: string
  quote?: string
  context?: string
  citation_style: CitationStyle
  formatted_citation?: string

  // Metadata
  relevance_score: number  // 1-10
  notes?: string

  // Timestamps
  created_at: string
  created_by: number

  // Joined dataset information
  dataset?: {
    id: number
    title: string
    description?: string
    type: string
    source: {
      name: string
      url?: string
      author?: string
      organization?: string
    }
  }
}

// Filter Interface
export interface EvidenceFilter {
  type?: EvidenceType
  level?: EvidenceLevel
  status?: EvidenceStatus
  priority?: PriorityLevel
  confidence?: ConfidenceLevel
  category?: string
  created_after?: string
  created_before?: string
}

// Statistics Interface
export interface EvidenceStatistics {
  total: number
  verified: number
  pending: number
  rejected: number
  by_type: Record<EvidenceType, number>
  by_level: Record<EvidenceLevel, number>
  by_priority: Record<PriorityLevel, number>
}

// Form Data Interface
export interface EvidenceFormData {
  title: string
  description?: string
  who?: string
  what?: string
  when_occurred?: string
  where_location?: string
  why_purpose?: string
  how_method?: string
  evidence_type: EvidenceType
  evidence_level: EvidenceLevel
  category?: string
  credibility: string
  reliability: string
  confidence_level: ConfidenceLevel
  tags: string[]
  priority: PriorityLevel
  citations?: {
    dataset_id: number
    citation_type: CitationType
    page_number?: string
    quote?: string
    context?: string
  }[]
}
