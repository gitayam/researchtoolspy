import type { EvidenceItem } from '@/types/evidence'
import type { SavedCitation, SourceType, CitationFields, Author } from '@/types/citations'
import { generateCitation } from './citation-formatters'
import { generateCitationId } from './citation-library'

// Map evidence type to citation source type
function mapEvidenceTypeToSourceType(evidenceType: string): SourceType {
  switch (evidenceType) {
    case 'news_article':
    case 'blog_post':
    case 'social_media':
      return 'website'
    case 'official_document':
    case 'report':
    case 'leaked_document':
    case 'memo':
      return 'report'
    case 'testimony':
    case 'eyewitness':
    case 'interview':
    case 'expert_opinion':
    case 'anonymous_source':
      return 'report'
    case 'video':
    case 'audio':
    case 'photo':
      return 'website'
    default:
      return 'website'
  }
}

// Parse author string into Author objects
function parseAuthors(who?: string): Author[] {
  if (!who || !who.trim()) {
    return [{ firstName: '', lastName: 'Unknown', middleName: '' }]
  }

  // Handle multiple authors separated by commas, semicolons, or "and"
  const authorStrings = who
    .split(/[,;]|\sand\s/i)
    .map(s => s.trim())
    .filter(s => s.length > 0)

  return authorStrings.map(authorStr => {
    const parts = authorStr.split(/\s+/)

    if (parts.length === 0) {
      return { firstName: '', lastName: 'Unknown', middleName: '' }
    } else if (parts.length === 1) {
      return { firstName: '', lastName: parts[0], middleName: '' }
    } else if (parts.length === 2) {
      return { firstName: parts[0], lastName: parts[1], middleName: '' }
    } else {
      // First Middle Last or First Last (multiple words)
      return {
        firstName: parts[0],
        middleName: parts.slice(1, -1).join(' '),
        lastName: parts[parts.length - 1]
      }
    }
  })
}

// Parse date from when_occurred field
function parseDate(whenOccurred?: string): { year?: string; month?: string; day?: string } {
  if (!whenOccurred) return {}

  // Try parsing ISO format (YYYY-MM-DD)
  const isoMatch = whenOccurred.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (isoMatch) {
    return {
      year: isoMatch[1],
      month: isoMatch[2],
      day: isoMatch[3]
    }
  }

  // Try parsing year only
  const yearMatch = whenOccurred.match(/(\d{4})/)
  if (yearMatch) {
    return { year: yearMatch[1] }
  }

  return {}
}

/**
 * Convert an evidence item to a citation
 * @param evidence The evidence item to convert
 * @param citationStyle The citation style to use (default: 'apa')
 * @returns A SavedCitation object ready to be added to the library
 */
export function evidenceToCitation(
  evidence: EvidenceItem,
  citationStyle: 'apa' | 'mla' | 'chicago' | 'harvard' = 'apa'
): SavedCitation {
  // Parse authors from "who" field
  const authors = parseAuthors(evidence.who)

  // Determine source type based on evidence type
  const sourceType = mapEvidenceTypeToSourceType(evidence.evidence_type)

  // Parse date
  const dateInfo = parseDate(evidence.when_occurred)

  // Build citation fields
  const fields: CitationFields = {
    authors,
    title: evidence.title || 'Untitled Evidence',
    ...dateInfo,
    url: evidence.where_location,
    accessDate: new Date().toISOString().split('T')[0]
  }

  // Add type-specific fields based on evidence type
  if (evidence.evidence_type === 'news_article' || evidence.evidence_type === 'blog_post' || evidence.evidence_type === 'social_media') {
    fields.siteName = evidence.category || undefined
  }

  if (evidence.evidence_type === 'testimony' || evidence.evidence_type === 'eyewitness' || evidence.evidence_type === 'interview') {
    fields.institution = evidence.category || undefined
  }

  // Generate the citation
  const { citation, inTextCitation } = generateCitation(fields, sourceType, citationStyle)

  // Create the saved citation object
  const savedCitation: SavedCitation = {
    id: generateCitationId(),
    citationStyle,
    sourceType,
    fields,
    citation,
    inTextCitation,
    addedAt: new Date().toISOString(),
    notes: `Generated from evidence: ${evidence.title}${evidence.what ? `\nClaim: ${evidence.what}` : ''}`,
    tags: evidence.tags || []
  }

  return savedCitation
}

/**
 * Batch convert multiple evidence items to citations
 * @param evidenceItems Array of evidence items
 * @param citationStyle The citation style to use
 * @returns Array of SavedCitation objects
 */
export function evidenceArrayToCitations(
  evidenceItems: EvidenceItem[],
  citationStyle: 'apa' | 'mla' | 'chicago' | 'harvard' = 'apa'
): SavedCitation[] {
  return evidenceItems.map(evidence => evidenceToCitation(evidence, citationStyle))
}
