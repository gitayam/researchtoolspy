import type { SavedCitation, CitationLibrary, CitationSortBy, SortOrder } from '@/types/citations'
import { generateCitation } from './citation-formatters'

const LIBRARY_KEY = 'citations-library'

// Get the current library from localStorage
export function getLibrary(): CitationLibrary {
  try {
    const stored = localStorage.getItem(LIBRARY_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch (error) {
    console.error('Failed to load citation library:', error)
  }

  // Return default library
  return {
    id: 'default',
    name: 'My Citations',
    citations: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
}

// Save library to localStorage
export function saveLibrary(library: CitationLibrary): void {
  try {
    library.updatedAt = new Date().toISOString()
    localStorage.setItem(LIBRARY_KEY, JSON.stringify(library))
  } catch (error) {
    console.error('Failed to save citation library:', error)
  }
}

// Add citation to library
export function addCitation(citation: SavedCitation): void {
  const library = getLibrary()
  library.citations.push(citation)
  saveLibrary(library)
}

// Update citation in library
export function updateCitation(id: string, updates: Partial<SavedCitation>): void {
  const library = getLibrary()
  const index = library.citations.findIndex(c => c.id === id)
  if (index !== -1) {
    const existing = library.citations[index]
    const updated = { ...existing, ...updates }

    // Regenerate citation if fields, style, or source type changed
    if (updates.fields || updates.citationStyle || updates.sourceType) {
      const { citation, inTextCitation } = generateCitation(
        updated.fields,
        updated.sourceType,
        updated.citationStyle
      )
      updated.citation = citation
      updated.inTextCitation = inTextCitation
    }

    library.citations[index] = updated
    saveLibrary(library)
  }
}

// Delete citation from library
export function deleteCitation(id: string): void {
  const library = getLibrary()
  library.citations = library.citations.filter(c => c.id !== id)
  saveLibrary(library)
}

// Delete multiple citations
export function deleteCitations(ids: string[]): void {
  const library = getLibrary()
  library.citations = library.citations.filter(c => !ids.includes(c.id))
  saveLibrary(library)
}

// Clear entire library
export function clearLibrary(): void {
  const library = getLibrary()
  library.citations = []
  saveLibrary(library)
}

// Sort citations
export function sortCitations(
  citations: SavedCitation[],
  sortBy: CitationSortBy,
  order: SortOrder = 'asc'
): SavedCitation[] {
  const sorted = [...citations].sort((a, b) => {
    let aValue: string | number
    let bValue: string | number

    switch (sortBy) {
      case 'date':
        aValue = new Date(a.addedAt).getTime()
        bValue = new Date(b.addedAt).getTime()
        break
      case 'author':
        aValue = a.fields.authors[0]?.lastName.toLowerCase() || ''
        bValue = b.fields.authors[0]?.lastName.toLowerCase() || ''
        break
      case 'title':
        aValue = a.fields.title?.toLowerCase() || ''
        bValue = b.fields.title?.toLowerCase() || ''
        break
      case 'type':
        aValue = a.sourceType
        bValue = b.sourceType
        break
      default:
        return 0
    }

    if (aValue < bValue) return order === 'asc' ? -1 : 1
    if (aValue > bValue) return order === 'asc' ? 1 : -1
    return 0
  })

  return sorted
}

// Filter citations by search term
export function filterCitations(
  citations: SavedCitation[],
  searchTerm: string
): SavedCitation[] {
  if (!searchTerm.trim()) return citations

  const term = searchTerm.toLowerCase()
  return citations.filter(citation => {
    // Search in citation text
    if (citation.citation.toLowerCase().includes(term)) return true

    // Search in title
    if (citation.fields.title?.toLowerCase().includes(term)) return true

    // Search in author names
    const authorMatch = citation.fields.authors.some(author =>
      `${author.firstName} ${author.lastName}`.toLowerCase().includes(term)
    )
    if (authorMatch) return true

    // Search in notes
    if (citation.notes?.toLowerCase().includes(term)) return true

    // Search in tags
    if (citation.tags?.some(tag => tag.toLowerCase().includes(term))) return true

    return false
  })
}

// Export to plain text bibliography
export function exportToText(
  citations: SavedCitation[],
  style: string
): string {
  return citations.map((c, i) => `${i + 1}. ${c.citation}`).join('\n\n')
}

// Export to BibTeX format
export function exportToBibTeX(citations: SavedCitation[]): string {
  return citations.map(c => {
    const type = c.sourceType === 'journal' ? 'article' :
                 c.sourceType === 'book' ? 'book' : 'misc'
    const key = `${c.fields.authors[0]?.lastName || 'unknown'}${c.fields.year || ''}`

    let bibtex = `@${type}{${key},\n`
    bibtex += `  author = {${c.fields.authors.map(a => `${a.firstName} ${a.lastName}`).join(' and ')}},\n`
    bibtex += `  title = {${c.fields.title}},\n`
    if (c.fields.year) bibtex += `  year = {${c.fields.year}},\n`
    if (c.sourceType === 'journal' && c.fields.journalTitle) {
      bibtex += `  journal = {${c.fields.journalTitle}},\n`
      if (c.fields.volume) bibtex += `  volume = {${c.fields.volume}},\n`
      if (c.fields.issue) bibtex += `  number = {${c.fields.issue}},\n`
      if (c.fields.pages) bibtex += `  pages = {${c.fields.pages}},\n`
    }
    if (c.sourceType === 'book' && c.fields.publisher) {
      bibtex += `  publisher = {${c.fields.publisher}},\n`
    }
    if (c.fields.url) bibtex += `  url = {${c.fields.url}},\n`
    if (c.fields.doi) bibtex += `  doi = {${c.fields.doi}},\n`
    bibtex += '}\n'

    return bibtex
  }).join('\n')
}

// Export to RIS format (for EndNote, Zotero, Mendeley)
export function exportToRIS(citations: SavedCitation[]): string {
  return citations.map(c => {
    const type = c.sourceType === 'journal' ? 'JOUR' :
                 c.sourceType === 'book' ? 'BOOK' :
                 c.sourceType === 'news' ? 'NEWS' : 'GEN'

    let ris = `TY  - ${type}\n`
    c.fields.authors.forEach(author => {
      ris += `AU  - ${author.lastName}, ${author.firstName}\n`
    })
    ris += `TI  - ${c.fields.title}\n`
    if (c.fields.year) {
      ris += `PY  - ${c.fields.year}\n`
    }
    if (c.sourceType === 'journal' && c.fields.journalTitle) {
      ris += `JO  - ${c.fields.journalTitle}\n`
      if (c.fields.volume) ris += `VL  - ${c.fields.volume}\n`
      if (c.fields.issue) ris += `IS  - ${c.fields.issue}\n`
      if (c.fields.pages) ris += `SP  - ${c.fields.pages.split('-')[0]}\n`
    }
    if (c.sourceType === 'book' && c.fields.publisher) {
      ris += `PB  - ${c.fields.publisher}\n`
    }
    if (c.fields.url) ris += `UR  - ${c.fields.url}\n`
    if (c.fields.doi) ris += `DO  - ${c.fields.doi}\n`
    ris += 'ER  - \n\n'

    return ris
  }).join('')
}

// Export to CSV
export function exportToCSV(citations: SavedCitation[]): string {
  const headers = ['ID', 'Type', 'Style', 'Authors', 'Title', 'Year', 'Citation', 'Added']
  const rows = citations.map(c => [
    c.id,
    c.sourceType,
    c.citationStyle,
    c.fields.authors.map(a => `${a.firstName} ${a.lastName}`).join('; '),
    c.fields.title || '',
    c.fields.year || '',
    c.citation,
    c.addedAt
  ])

  return [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n')
}

// Generate unique ID for citation
export function generateCitationId(): string {
  return `cit-${Date.now()}-${Math.random().toString(36).substring(7)}`
}
