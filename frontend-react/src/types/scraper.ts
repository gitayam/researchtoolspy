// Web Scraper Types

export type ExtractionMode = 'metadata' | 'full' | 'summary'

export interface ScrapingRequest {
  url: string
  extract_mode?: ExtractionMode
  create_dataset?: boolean
}

export interface ScrapingMetadata {
  keywords?: string[]
  og_title?: string
  og_description?: string
  og_image?: string
  og_type?: string
  [key: string]: any
}

export interface ScrapingContent {
  text: string
  summary?: string
  word_count: number
}

export interface ScrapingResult {
  url: string
  title?: string
  description?: string
  author?: string
  published_date?: string
  domain?: string
  content?: ScrapingContent
  metadata?: ScrapingMetadata
  reliability_score?: number
  extracted_at: string
  dataset_id?: number
}

export interface ScrapingResponse {
  success: boolean
  data?: ScrapingResult
  error?: string
}

// Entity types (for future entity extraction)
export interface ExtractedEntity {
  type: 'person' | 'place' | 'organization' | 'date' | 'event'
  value: string
  confidence: number
  context?: string
}

export interface ExtractedEntities {
  people?: string[]
  places?: string[]
  organizations?: string[]
  dates?: string[]
  events?: string[]
}

// Citation formats
export type CitationStyle = 'apa' | 'mla' | 'chicago'

export interface FormattedCitation {
  apa?: string
  mla?: string
  chicago?: string
}
