/**
 * Evidence Management Types
 * For collecting, organizing, and sharing evidence across frameworks
 */

export enum EvidenceType {
  DOCUMENT = 'document',
  URL = 'url',
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
  TEXT = 'text',
  SOCIAL_MEDIA = 'social_media',
  EMAIL = 'email',
  REPORT = 'report',
  OTHER = 'other'
}

export enum EvidenceStatus {
  DRAFT = 'draft',
  VERIFIED = 'verified',
  DISPUTED = 'disputed',
  ARCHIVED = 'archived'
}

export enum CredibilityLevel {
  VERY_HIGH = 'very_high',
  HIGH = 'high',
  MODERATE = 'moderate',
  LOW = 'low',
  VERY_LOW = 'very_low',
  UNKNOWN = 'unknown'
}

export interface EvidenceSource {
  name: string
  url?: string
  date?: Date
  author?: string
  organization?: string
  credibility?: CredibilityLevel
}

export interface EvidenceMetadata {
  collectionDate: Date
  collectionMethod?: string
  chain_of_custody?: string[]
  classification?: string
  handling_instructions?: string
  expiry_date?: Date
  geo_location?: {
    lat: number
    lng: number
    accuracy?: number
    place_name?: string
  }
}

export interface SATSEvaluation {
  // Based on SATS criteria
  reliability: number // 1-5
  credibility: number // 1-5
  validity: number // 1-5
  relevance: number // 1-5
  significance: number // 1-5
  timeliness: number // 1-5
  accuracy: number // 1-5
  completeness: number // 1-5
  overall_score: number // Calculated
  evaluation_date: Date
  evaluator?: string
  notes?: string
}

export interface Evidence {
  id: string
  title: string
  description: string
  content: string // Rich text content
  type: EvidenceType
  status: EvidenceStatus
  tags: string[]
  source: EvidenceSource
  metadata: EvidenceMetadata
  sats_evaluation?: SATSEvaluation
  
  // Framework associations
  frameworks: {
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
  created_at: Date
  updated_at: Date
  created_by: string
  updated_by?: string
  
  // Analysis
  key_points?: string[]
  contradictions?: string[]
  corroborations?: string[]
  implications?: string[]
  
  // Versioning
  version: number
  previous_versions?: string[] // IDs of previous versions
}

export interface EvidenceFilter {
  search?: string
  types?: EvidenceType[]
  status?: EvidenceStatus[]
  tags?: string[]
  credibility?: CredibilityLevel[]
  date_from?: Date
  date_to?: Date
  frameworks?: string[]
  has_sats_evaluation?: boolean
}

export interface EvidenceCollection {
  id: string
  name: string
  description: string
  evidence_ids: string[]
  tags: string[]
  created_at: Date
  updated_at: Date
  created_by: string
  shared_with?: string[]
}

export interface EvidenceImportOptions {
  auto_tag?: boolean
  auto_evaluate?: boolean
  extract_metadata?: boolean
  ocr_images?: boolean
  translate?: boolean
  target_language?: string
}

export interface EvidenceExportOptions {
  format: 'json' | 'csv' | 'excel' | 'pdf' | 'word'
  include_attachments?: boolean
  include_sats?: boolean
  include_metadata?: boolean
  include_analysis?: boolean
}

// For evidence relationship mapping
export interface EvidenceRelationship {
  id: string
  evidence_id_1: string
  evidence_id_2: string
  relationship_type: 'supports' | 'contradicts' | 'related' | 'derived_from' | 'supersedes'
  strength: 'strong' | 'moderate' | 'weak'
  notes?: string
  created_at: Date
  created_by: string
}

// For batch operations
export interface EvidenceBatchOperation {
  operation: 'tag' | 'status' | 'evaluate' | 'export' | 'delete' | 'archive'
  evidence_ids: string[]
  parameters?: any
}

// Statistics for dashboard
export interface EvidenceStatistics {
  total_count: number
  by_type: Record<EvidenceType, number>
  by_status: Record<EvidenceStatus, number>
  by_credibility: Record<CredibilityLevel, number>
  recent_additions: number
  pending_evaluation: number
  expiring_soon: number
  most_used_tags: { tag: string; count: number }[]
  framework_usage: { framework: string; count: number }[]
}