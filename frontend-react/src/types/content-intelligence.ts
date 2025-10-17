// Content Intelligence Tool Types

// ========================================
// Saved Links Library
// ========================================

export interface SavedLink {
  id: number
  user_id: number
  url: string
  title?: string
  note?: string
  tags: string[] // Parsed from JSON
  reminder_date?: string // ISO 8601

  // Quick metadata
  domain?: string
  is_social_media: boolean
  social_platform?: 'twitter' | 'facebook' | 'instagram' | 'linkedin' | 'tiktok' | 'youtube'

  // Processing status
  is_processed: boolean
  analysis_id?: number

  // Timestamps
  created_at: string
  updated_at: string
  accessed_at?: string
}

export interface SavedLinkFormData {
  url: string
  title?: string
  note?: string
  tags?: string[]
  reminder_date?: string
}

// ========================================
// Content Analysis
// ========================================

export interface ContentAnalysisRequest {
  url: string
  mode?: 'quick' | 'full' | 'forensic'
  save_link?: boolean // If true, also save to link library
  link_note?: string
  link_tags?: string[]
}

export interface WordFrequencyItem {
  phrase: string
  count: number
  percentage: number
}

export interface EntityMention {
  name: string
  type: 'person' | 'organization' | 'location'
  count: number
  contexts: string[] // Sample sentences where entity appears
}

export interface EntitiesData {
  people: EntityMention[]
  organizations: EntityMention[]
  locations: EntityMention[]
  dates?: EntityMention[]
  money?: EntityMention[]
  events?: EntityMention[]
  products?: EntityMention[]
  percentages?: EntityMention[]
  emails?: Array<{ email: string; count: number }>
}

export interface ArchiveUrls {
  wayback?: string
  archive_is?: string
  screenshot?: string
}

export interface BypassUrls {
  '12ft': string
  wayback?: string
  archive_is?: string
}

export interface LinkInfo {
  url: string
  anchor_text: string[] // All different anchor texts used for this URL
  count: number // How many times this link appears
  domain: string
  is_external: boolean
}

export interface ContentAnalysis {
  id: number
  user_id: number
  saved_link_id?: number

  // Source
  url: string
  url_normalized: string
  content_hash: string

  // Metadata
  title?: string
  author?: string
  publish_date?: string
  domain: string
  is_social_media: boolean
  social_platform?: string

  // Content
  extracted_text: string
  summary?: string
  word_count: number

  // Word Analysis
  word_frequency: Record<string, number> // { "phrase": count }
  top_phrases: WordFrequencyItem[] // Top 10 2-10 word phrases

  // Keyphrase Extraction (TextRank-style)
  keyphrases?: Array<{
    phrase: string
    score: number // 0.0 to 1.0 importance
    category: 'technology' | 'concept' | 'event' | 'location' | 'other'
    relevance: 'high' | 'medium' | 'low'
  }>

  // Topic Modeling (LDA-style)
  topics?: Array<{
    name: string
    keywords: string[]
    coherence: number // 0.0 to 1.0
    coverage: number // 0.0 to 1.0
    description: string
  }>

  // Entity Extraction
  entities: EntitiesData

  // Link Analysis (helps researchers discover sources and references)
  links_analysis?: LinkInfo[]

  // Sentiment Analysis
  sentiment_analysis?: {
    overall: 'positive' | 'negative' | 'neutral' | 'mixed'
    score: number // -1.0 to +1.0
    confidence: number // 0.0 to 1.0
    emotions: {
      joy: number
      anger: number
      fear: number
      sadness: number
      surprise: number
    }
    controversialClaims: Array<{
      text: string
      sentiment: string
      reason: string
    }>
    keyInsights: string[]
  }

  // Claim Analysis & Deception Detection
  claim_analysis?: {
    claims: Array<{
      claim: string
      category: string
      source?: string
      deception_analysis: {
        overall_risk: 'low' | 'medium' | 'high'
        risk_score: number
        methods: {
          internal_consistency: { score: number; reasoning: string }
          source_credibility: { score: number; reasoning: string }
          evidence_quality: { score: number; reasoning: string }
          logical_coherence: { score: number; reasoning: string }
          temporal_consistency: { score: number; reasoning: string }
          specificity: { score: number; reasoning: string }
        }
        red_flags: string[]
        confidence_assessment: string
      }
    }>
    summary: {
      total_claims: number
      high_risk_claims: number
      medium_risk_claims: number
      low_risk_claims: number
      most_concerning_claim?: string
      overall_content_credibility: number
    }
  }

  // Archive/Bypass Links (generated immediately)
  archive_urls: ArchiveUrls
  bypass_urls: BypassUrls

  // Processing metadata
  processing_mode: 'quick' | 'full' | 'forensic'
  processing_duration_ms: number
  gpt_model_used?: string

  // Timestamps
  created_at: string
  updated_at: string

  // Expiration & Sharing
  expires_at?: string | null // Auto-delete after 7 days if not saved
  is_saved?: boolean // If true, saved permanently
  share_token?: string // For public sharing
  dime_analysis?: DIMEAnalysis | null // DIME framework analysis
}

export interface DIMEQuestionAnswer {
  question: string
  answer: string
}

export interface DIMEAnalysis {
  diplomatic: DIMEQuestionAnswer[]
  information: DIMEQuestionAnswer[]
  military: DIMEQuestionAnswer[]
  economic: DIMEQuestionAnswer[]
  summary: string
}

// ========================================
// Question & Answer
// ========================================

export interface QuestionRequest {
  analysis_id: number
  question: string
}

export interface SourceExcerpt {
  text: string
  paragraph: number
  relevance: number // 0.0 to 1.0
}

export interface QuestionAnswer {
  id: number
  content_analysis_id: number
  user_id: number

  question: string
  answer?: string
  confidence_score?: number // 0.0 to 1.0

  source_excerpts: SourceExcerpt[]

  has_complete_answer: boolean
  missing_data_notes?: string

  search_method: 'semantic' | 'regex' | 'hybrid'

  created_at: string
}

// ========================================
// Starbursting Integration
// ========================================

export interface StarburstingRequest {
  analysis_ids: number[] // One or more content analyses to use as source
  title?: string
}

export interface StarburstingSource {
  id: number
  session_id: number
  content_analysis_id: number
  created_at: string
}

// ========================================
// UI State Types
// ========================================

export type ProcessingStatus =
  | 'idle'
  | 'extracting'
  | 'analyzing_words'
  | 'extracting_entities'
  | 'generating_summary'
  | 'complete'
  | 'error'

export interface ProcessingProgress {
  status: ProcessingStatus
  progress: number // 0-100
  current_step?: string
  error_message?: string
}

export type AnalysisTab =
  | 'overview'
  | 'word-analysis'
  | 'sentiment'
  | 'entities'
  | 'links'
  | 'claims'
  | 'qa'
  | 'starbursting'

// ========================================
// Social Media Detection
// ========================================

export interface SocialMediaInfo {
  platform: 'twitter' | 'facebook' | 'instagram' | 'linkedin' | 'tiktok' | 'youtube' | 'reddit'
  post_id?: string
  username?: string
  profile_url?: string
}

export function detectSocialMedia(url: string): SocialMediaInfo | null {
  const urlLower = url.toLowerCase()

  if (urlLower.includes('twitter.com') || urlLower.includes('x.com')) {
    return { platform: 'twitter' }
  }
  if (urlLower.includes('facebook.com')) {
    return { platform: 'facebook' }
  }
  if (urlLower.includes('instagram.com')) {
    return { platform: 'instagram' }
  }
  if (urlLower.includes('linkedin.com')) {
    return { platform: 'linkedin' }
  }
  if (urlLower.includes('tiktok.com')) {
    return { platform: 'tiktok' }
  }
  if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be')) {
    return { platform: 'youtube' }
  }
  if (urlLower.includes('reddit.com')) {
    return { platform: 'reddit' }
  }

  return null
}

// ========================================
// Export Types
// ========================================

export interface ExportFormat {
  type: 'json' | 'csv' | 'pdf' | 'txt'
  include_metadata?: boolean
  include_entities?: boolean
  include_qa?: boolean
}
