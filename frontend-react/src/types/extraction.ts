// Content Extraction Types

export type ExtractionSourceType = 'file' | 'url'
export type FileType = 'pdf' | 'html' | 'txt' | 'docx' | 'unknown'

export interface ExtractionOptions {
  extractImages?: boolean
  extractTables?: boolean
  analyzeText?: boolean
  ocrEnabled?: boolean
}

export interface ExtractionRequest {
  file?: File
  url?: string
  options?: ExtractionOptions
}

export interface SourceInfo {
  type: ExtractionSourceType
  name?: string
  url?: string
  size?: number
  mimeType?: string
  fileType?: FileType
}

export interface ContentData {
  text: string
  html?: string
  pages?: number
  wordCount: number
  charCount: number
  lineCount?: number
}

export interface MetadataInfo {
  title?: string
  author?: string
  date?: string
  language?: string
  keywords?: string[]
  description?: string
  publisher?: string
  // Open Graph / Twitter Cards
  ogTitle?: string
  ogDescription?: string
  ogImage?: string
  twitterCard?: string
}

export interface ReadabilityScore {
  fleschKincaid: number
  grade: string
  difficulty: 'very-easy' | 'easy' | 'fairly-easy' | 'standard' | 'fairly-difficult' | 'difficult' | 'very-difficult'
}

export interface EntityData {
  people?: string[]
  places?: string[]
  organizations?: string[]
  dates?: string[]
  emails?: string[]
  urls?: string[]
  phoneNumbers?: string[]
}

export interface KeywordData {
  word: string
  frequency: number
  percentage: number
}

export interface AnalysisData {
  readability?: ReadabilityScore
  entities?: EntityData
  keywords?: KeywordData[]
  sentiment?: {
    score: number
    label: 'positive' | 'negative' | 'neutral'
  }
  topics?: string[]
}

export interface ImageData {
  url: string
  alt?: string
  width?: number
  height?: number
  title?: string
}

export interface TableData {
  rows: number
  columns: number
  data: string[][]
  caption?: string
}

export interface ExtractionResult {
  id: string
  source: SourceInfo
  content: ContentData
  metadata: MetadataInfo
  analysis?: AnalysisData
  images?: ImageData[]
  tables?: TableData[]
  links?: string[]
  extractedAt: string
  processingTime: number
  error?: string
}

export interface ExtractionProgress {
  status: 'idle' | 'uploading' | 'processing' | 'analyzing' | 'complete' | 'error'
  progress: number // 0-100
  message?: string
}
