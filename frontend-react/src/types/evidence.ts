// Evidence System Types

// Source Classification (Primary, Secondary, Tertiary)
export const SourceClassification = {
  PRIMARY: 'primary',           // First-hand, original evidence
  SECONDARY: 'secondary',       // Analysis/interpretation of primary sources
  TERTIARY: 'tertiary',         // Compilations/summaries of secondary sources
} as const

export type SourceClassification = typeof SourceClassification[keyof typeof SourceClassification]

// Source Classification Descriptions
export const SourceClassificationDescriptions: Record<SourceClassification, string> = {
  primary: 'First-hand evidence: Original documents, direct observations, eyewitness accounts, raw data',
  secondary: 'Second-hand evidence: Analysis, interpretation, or discussion of primary sources',
  tertiary: 'Third-hand evidence: Summaries, compilations, or indexes of primary and secondary sources'
}

// Evidence Type (journalist-friendly categories)
export const EvidenceType = {
  // Media & Social
  SOCIAL_MEDIA: 'social_media',
  NEWS_ARTICLE: 'news_article',
  BLOG_POST: 'blog_post',
  VIDEO: 'video',
  PHOTO: 'photo',
  AUDIO: 'audio',

  // Documents
  OFFICIAL_DOCUMENT: 'official_document',
  REPORT: 'report',
  EMAIL: 'email',
  LEAKED_DOCUMENT: 'leaked_document',
  MEMO: 'memo',

  // Human Sources
  INTERVIEW: 'interview',
  ANONYMOUS_SOURCE: 'anonymous_source',
  EYEWITNESS: 'eyewitness',
  EXPERT_OPINION: 'expert_opinion',
  TESTIMONY: 'testimony',

  // Data & Records
  DATASET: 'dataset',
  FINANCIAL_RECORD: 'financial_record',
  GEOSPATIAL_DATA: 'geospatial_data',
  PHYSICAL_EVIDENCE: 'physical_evidence',

  // Legacy/Other
  OTHER: 'other',
} as const

export type EvidenceType = typeof EvidenceType[keyof typeof EvidenceType]

// Evidence Type Descriptions
export const EvidenceTypeDescriptions: Record<EvidenceType, string> = {
  // Media & Social
  social_media: 'Social media post (Twitter/X, Facebook, Instagram, TikTok, LinkedIn)',
  news_article: 'News article (online news, newspaper)',
  blog_post: 'Blog post or opinion piece',
  video: 'Video content (YouTube, news footage, raw video)',
  photo: 'Photo or image',
  audio: 'Audio recording (podcast, interview, phone call)',

  // Documents
  official_document: 'Official document (government, court filing, legal document)',
  report: 'Report (investigation, research, analysis)',
  email: 'Email or message',
  leaked_document: 'Leaked or confidential document',
  memo: 'Memo or letter',

  // Human Sources
  interview: 'Interview (on-record)',
  anonymous_source: 'Anonymous source (confidential, off-record)',
  eyewitness: 'Eyewitness account or observation',
  expert_opinion: 'Expert opinion or analysis',
  testimony: 'Testimony (court, sworn statement)',

  // Data & Records
  dataset: 'Dataset (spreadsheet, database, structured data)',
  financial_record: 'Financial record (transaction, statement, tax document)',
  geospatial_data: 'Geospatial data (satellite imagery, GPS, maps)',
  physical_evidence: 'Physical evidence (artifact, object, material)',

  // Legacy/Other
  other: 'Other type of evidence',
}

// Evidence Type Categories (for organized display)
export const EvidenceTypeCategories = {
  'Media & Social': [
    'social_media',
    'news_article',
    'blog_post',
    'video',
    'photo',
    'audio',
  ],
  'Documents': [
    'official_document',
    'report',
    'email',
    'leaked_document',
    'memo',
  ],
  'Human Sources': [
    'interview',
    'anonymous_source',
    'eyewitness',
    'expert_opinion',
    'testimony',
  ],
  'Data & Records': [
    'dataset',
    'financial_record',
    'geospatial_data',
    'physical_evidence',
  ],
  'Other': ['other'],
} as const

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

// EVE Deception Assessment (from Deception Detection Framework)
export interface EVEAssessment {
  internal_consistency: number      // 0-5 (INVERTED: low score = high deception risk)
  external_corroboration: number    // 0-5 (INVERTED: low score = high deception risk)
  anomaly_detection: number         // 0-5 (high score = high deception risk)
  notes: string
  assessed_at: string
  overall_risk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'  // Calculated risk level
}

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

  // Source Classification (NEW)
  source_classification?: SourceClassification  // Primary, Secondary, or Tertiary
  source_name?: string                          // Name of the source
  source_url?: string                           // URL/reference to source
  source_id?: string                            // Link to Source entity from Entity System

  // Classification
  evidence_type: EvidenceType
  evidence_level: EvidenceLevel
  category?: string      // For framework categorization (PMESII, DIME, etc.)

  // Assessment
  credibility: string    // Credibility rating (A-F scale or 1-6)
  reliability: string    // Reliability rating
  confidence_level: ConfidenceLevel

  // EVE Deception Assessment (NEW - from Deception Framework)
  eve_assessment?: EVEAssessment

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

  // Source Classification (NEW)
  source_classification?: SourceClassification
  source_name?: string
  source_url?: string
  source_id?: string

  evidence_type: EvidenceType
  evidence_level: EvidenceLevel
  category?: string
  credibility: string
  reliability: string
  confidence_level: ConfidenceLevel

  // EVE Assessment (NEW)
  eve_assessment?: {
    internal_consistency: number
    external_corroboration: number
    anomaly_detection: number
    notes: string
  }

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
