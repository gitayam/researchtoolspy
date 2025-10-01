/**
 * Evidence Management Types
 * For collecting, organizing, and sharing evidence across frameworks
 */

export const EvidenceType = {
  DOCUMENT: 'DOCUMENT',
  WEB_PAGE: 'WEB_PAGE',
  IMAGE: 'IMAGE',
  VIDEO: 'VIDEO',
  AUDIO: 'AUDIO',
  SOCIAL_MEDIA: 'SOCIAL_MEDIA',
  EMAIL: 'EMAIL',
  DATABASE: 'DATABASE',
  API: 'API',
  GOVERNMENT: 'GOVERNMENT'
} as const

export type EvidenceType = typeof EvidenceType[keyof typeof EvidenceType]

export const EvidenceStatus = {
  PENDING: 'PENDING',
  VERIFIED: 'VERIFIED',
  REJECTED: 'REJECTED',
  NEEDS_REVIEW: 'NEEDS_REVIEW'
} as const

export type EvidenceStatus = typeof EvidenceStatus[keyof typeof EvidenceStatus]

export const CredibilityLevel = {
  VERY_HIGH: 'VERY_HIGH',
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
  VERY_LOW: 'VERY_LOW',
  UNKNOWN: 'UNKNOWN'
} as const

export type CredibilityLevel = typeof CredibilityLevel[keyof typeof CredibilityLevel]

export interface EvidenceSource {
  name: string
  url?: string
  date?: string
  author?: string
  organization?: string
  credibility: CredibilityLevel
}

export interface EvidenceMetadata {
  collection_date: string
  collection_method?: string
  chain_of_custody?: string[]
  classification?: string
  handling_instructions?: string
  expiry_date?: string
  geo_location?: {
    lat: number
    lng: number
    accuracy?: number
    place_name?: string
  }
}

export interface SATSEvaluation {
  reliability: number // 1-5
  credibility: number // 1-5
  validity: number // 1-5
  relevance: number // 1-5
  significance: number // 1-5
  timeliness: number // 1-5
  accuracy: number // 1-5
  completeness: number // 1-5
  overall_score: number
  evaluation_date: string
  evaluator?: string
  notes?: string
}

export interface Evidence {
  id: string
  title: string
  description?: string
  content: string
  type: EvidenceType
  status: EvidenceStatus
  tags: string[]
  source: EvidenceSource
  metadata: EvidenceMetadata
  sats_evaluation?: SATSEvaluation

  // Framework associations
  frameworks?: {
    framework_type: string
    framework_id: string
    usage_context?: string
  }[]

  // Files and attachments
  attachments?: {
    id: string
    filename: string
    url: string
    size: number
    mime_type: string
  }[]

  // Timestamps
  created_at: string
  updated_at: string
  created_by: string
  updated_by?: string

  // Analysis
  key_points?: string[]
  contradictions?: string[]
  corroborations?: string[]
  implications?: string[]

  // Versioning
  version: number
  previous_versions?: string[]
}

export interface EvidenceFilter {
  type?: EvidenceType
  status?: EvidenceStatus
  credibility?: CredibilityLevel
  tags?: string[]
  date_from?: string
  date_to?: string
  frameworks?: string[]
  has_sats_evaluation?: boolean
}

export interface EvidenceStatistics {
  total: number
  verified: number
  pending: number
  rejected: number
  by_type: Record<EvidenceType, number>
  by_credibility: Record<CredibilityLevel, number>
}

export interface EvidenceCollection {
  id: string
  name: string
  description: string
  evidence_ids: string[]
  tags: string[]
  created_at: string
  updated_at: string
  created_by: string
  shared_with?: string[]
}
