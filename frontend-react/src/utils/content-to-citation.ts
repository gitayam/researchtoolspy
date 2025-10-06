/**
 * Content Intelligence to Citation Generator Integration
 *
 * Converts analyzed content data into citation-ready format
 */

import type { CitationFields, Author, SourceType } from '@/types/citations'
import type { ContentAnalysis } from '@/types/content-intelligence'

export interface CitationData {
  sourceType: SourceType
  fields: CitationFields
}

/**
 * Extract citation-ready data from content analysis
 */
export function extractCitationData(analysis: ContentAnalysis, url?: string): CitationData {
  // Determine source type from domain or social media flag
  const sourceType = determineSourceType(analysis)

  // Parse author name
  const authors: Author[] = parseAuthors(analysis.author)

  // Extract date parts
  const { year, month, day } = parseDate(analysis.publish_date)

  // Build citation fields
  const fields: CitationFields = {
    authors,
    title: analysis.title || 'Untitled',
    year,
    month,
    day,
    url: url || analysis.url,
    siteName: analysis.domain,
    accessDate: new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  // Add source-specific fields
  if (sourceType === 'news') {
    fields.publication = analysis.domain
  }

  return {
    sourceType,
    fields
  }
}

/**
 * Determine citation source type from analysis
 */
function determineSourceType(analysis: ContentAnalysis): SourceType {
  // Check if it's social media
  if (analysis.is_social_media) {
    return 'website' // Social media posts are typically cited as websites
  }

  // Check domain for news outlets (basic heuristic)
  const newsIndicators = ['news', 'times', 'post', 'guardian', 'reuters', 'cnn', 'bbc', 'npr']
  const domainLower = analysis.domain.toLowerCase()

  if (newsIndicators.some(indicator => domainLower.includes(indicator))) {
    return 'news'
  }

  // Check for academic/journal indicators
  const journalIndicators = ['journal', 'academic', '.edu', 'research', 'pubmed', 'scholar']
  if (journalIndicators.some(indicator => domainLower.includes(indicator))) {
    return 'journal'
  }

  // Check for government/institutional reports
  const reportIndicators = ['.gov', '.org', 'report', 'whitepaper']
  if (reportIndicators.some(indicator => domainLower.includes(indicator))) {
    return 'report'
  }

  // Default to website
  return 'website'
}

/**
 * Parse author name into structured format
 */
function parseAuthors(authorString?: string): Author[] {
  if (!authorString || authorString.trim() === '') {
    return [{ firstName: '', lastName: '', middleName: '' }]
  }

  // Handle "Last, First" format
  if (authorString.includes(',')) {
    const parts = authorString.split(',').map(p => p.trim())
    return [{
      firstName: parts[1] || '',
      lastName: parts[0] || '',
      middleName: ''
    }]
  }

  // Handle "First Middle Last" format
  const nameParts = authorString.trim().split(/\s+/)

  if (nameParts.length === 1) {
    return [{ firstName: '', lastName: nameParts[0], middleName: '' }]
  }

  if (nameParts.length === 2) {
    return [{
      firstName: nameParts[0],
      lastName: nameParts[1],
      middleName: ''
    }]
  }

  // 3+ parts: First Middle... Last
  return [{
    firstName: nameParts[0],
    middleName: nameParts.slice(1, -1).join(' '),
    lastName: nameParts[nameParts.length - 1]
  }]
}

/**
 * Parse date string into year, month, day components
 */
function parseDate(dateString?: string): { year?: string, month?: string, day?: string } {
  if (!dateString) {
    return {}
  }

  try {
    const date = new Date(dateString)

    if (isNaN(date.getTime())) {
      // Try to extract year from string manually
      const yearMatch = dateString.match(/\b(19|20)\d{2}\b/)
      return yearMatch ? { year: yearMatch[0] } : {}
    }

    return {
      year: date.getFullYear().toString(),
      month: (date.getMonth() + 1).toString().padStart(2, '0'),
      day: date.getDate().toString().padStart(2, '0')
    }
  } catch {
    return {}
  }
}

/**
 * Create URL parameters for citation generator navigation
 */
export function createCitationParams(citationData: CitationData): URLSearchParams {
  const params = new URLSearchParams()

  params.set('sourceType', citationData.sourceType)
  params.set('title', citationData.fields.title)

  if (citationData.fields.url) {
    params.set('url', citationData.fields.url)
  }

  if (citationData.fields.siteName) {
    params.set('siteName', citationData.fields.siteName)
  }

  if (citationData.fields.year) {
    params.set('year', citationData.fields.year)
  }

  if (citationData.fields.month) {
    params.set('month', citationData.fields.month)
  }

  if (citationData.fields.day) {
    params.set('day', citationData.fields.day)
  }

  if (citationData.fields.accessDate) {
    params.set('accessDate', citationData.fields.accessDate)
  }

  // Author data
  if (citationData.fields.authors && citationData.fields.authors.length > 0) {
    const author = citationData.fields.authors[0]
    if (author.firstName) params.set('firstName', author.firstName)
    if (author.lastName) params.set('lastName', author.lastName)
    if (author.middleName) params.set('middleName', author.middleName)
  }

  // Source-specific fields
  if (citationData.fields.publication) {
    params.set('publication', citationData.fields.publication)
  }

  if (citationData.fields.publisher) {
    params.set('publisher', citationData.fields.publisher)
  }

  return params
}
