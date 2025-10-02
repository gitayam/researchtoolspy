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
