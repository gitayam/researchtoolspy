/**
 * Dataset Management Types
 * For collecting, organizing, and sharing dataset across frameworks
 */

export const DatasetType = {
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

export type DatasetType = typeof DatasetType[keyof typeof DatasetType]

export const DatasetStatus = {
  PENDING: 'PENDING',
  VERIFIED: 'VERIFIED',
  REJECTED: 'REJECTED',
  NEEDS_REVIEW: 'NEEDS_REVIEW'
} as const

export type DatasetStatus = typeof DatasetStatus[keyof typeof DatasetStatus]

export const CredibilityLevel = {
  VERY_HIGH: 'VERY_HIGH',
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
  VERY_LOW: 'VERY_LOW',
  UNKNOWN: 'UNKNOWN'
} as const

export type CredibilityLevel = typeof CredibilityLevel[keyof typeof CredibilityLevel]

export interface DatasetSource {
  name: string
  url?: string
  date?: string
  author?: string
  organization?: string
  credibility: CredibilityLevel
}

export interface DatasetMetadata {
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

export interface Dataset {
  id: string
  title: string
  description?: string
  content: string
  type: DatasetType
  status: DatasetStatus
  tags: string[]
  source: DatasetSource
  metadata: DatasetMetadata
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

export interface DatasetFilter {
  type?: DatasetType
  status?: DatasetStatus
  credibility?: CredibilityLevel
  tags?: string[]
  date_from?: string
  date_to?: string
  frameworks?: string[]
  has_sats_evaluation?: boolean
}

export interface DatasetStatistics {
  total: number
  verified: number
  pending: number
  rejected: number
  by_type: Record<DatasetType, number>
  by_credibility: Record<CredibilityLevel, number>
}

export interface DatasetCollection {
  id: string
  name: string
  description: string
  dataset_ids: string[]
  tags: string[]
  created_at: string
  updated_at: string
  created_by: string
  shared_with?: string[]
}
