// Citations Generator Types

export type CitationStyle = 'apa' | 'mla' | 'chicago' | 'harvard'
export type SourceType = 'website' | 'book' | 'journal' | 'report' | 'news'

export interface Author {
  firstName: string
  lastName: string
  middleName?: string
}

export interface CitationFields {
  // Common fields
  authors: Author[]
  title: string
  year?: string
  month?: string
  day?: string

  // Website specific
  url?: string
  accessDate?: string
  siteName?: string
  publisher?: string

  // Book specific
  edition?: string
  isbn?: string
  place?: string

  // Journal specific
  journalTitle?: string
  volume?: string
  issue?: string
  pages?: string
  doi?: string

  // Report specific
  institution?: string
  reportNumber?: string

  // News specific
  publication?: string
  section?: string
}

export interface Citation {
  id: string
  sourceType: SourceType
  citationStyle: CitationStyle
  citation: string
  inTextCitation?: string
  fields: CitationFields
  datasetId?: number
  createdAt: string
}

// Saved Citation in Library
export interface SavedCitation {
  id: string
  citationStyle: CitationStyle
  sourceType: SourceType
  fields: CitationFields
  citation: string
  inTextCitation: string
  notes?: string
  tags?: string[]
  addedAt: string
}

// Citation Library
export interface CitationLibrary {
  id: string
  userId?: string
  name: string
  description?: string
  citations: SavedCitation[]
  createdAt: string
  updatedAt: string
}

// Sort options
export type CitationSortBy = 'date' | 'author' | 'title' | 'type'
export type SortOrder = 'asc' | 'desc'

export interface CitationRequest {
  sourceType: SourceType
  citationStyle: CitationStyle
  fields: CitationFields
  datasetId?: number
}

export interface CitationResponse {
  id: string
  sourceType: SourceType
  citationStyle: CitationStyle
  citation: string
  inTextCitation?: string
  fields: CitationFields
  datasetId?: number
  createdAt: string
}

export interface ExportFormat {
  format: 'text' | 'bibtex' | 'ris' | 'json'
  content: string
}
