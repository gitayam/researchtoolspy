import type { Author, CitationFields, SourceType, CitationStyle } from '@/types/citations'

// Format author names for different citation styles
export function formatAuthors(authors: Author[], style: CitationStyle, isInText = false): string {
  if (!authors || authors.length === 0) return 'Anonymous'

  switch (style) {
    case 'apa':
      return formatAuthorsAPA(authors, isInText)
    case 'mla':
      return formatAuthorsMLA(authors, isInText)
    case 'chicago':
      return formatAuthorsChicago(authors, isInText)
    case 'harvard':
      return formatAuthorsHarvard(authors, isInText)
    default:
      return formatAuthorsAPA(authors, isInText)
  }
}

function formatAuthorsAPA(authors: Author[], isInText = false): string {
  if (isInText) {
    if (authors.length === 1) {
      return authors[0].lastName
    } else if (authors.length === 2) {
      return `${authors[0].lastName} & ${authors[1].lastName}`
    } else {
      return `${authors[0].lastName} et al.`
    }
  }

  const formatted = authors.map((author, index) => {
    const initial = author.firstName.charAt(0).toUpperCase()
    const middleInitial = author.middleName ? ` ${author.middleName.charAt(0).toUpperCase()}.` : ''
    return `${author.lastName}, ${initial}.${middleInitial}`
  })

  if (formatted.length === 1) return formatted[0]
  if (formatted.length === 2) return `${formatted[0]}, & ${formatted[1]}`

  const lastAuthor = formatted[formatted.length - 1]
  const otherAuthors = formatted.slice(0, -1).join(', ')
  return `${otherAuthors}, & ${lastAuthor}`
}

function formatAuthorsMLA(authors: Author[], isInText = false): string {
  if (isInText) {
    if (authors.length === 1) {
      return authors[0].lastName
    } else if (authors.length === 2) {
      return `${authors[0].lastName} and ${authors[1].lastName}`
    } else {
      return `${authors[0].lastName} et al.`
    }
  }

  const formatted = authors.map((author, index) => {
    if (index === 0) {
      // First author: Last, First Middle
      const middle = author.middleName ? ` ${author.middleName}` : ''
      return `${author.lastName}, ${author.firstName}${middle}`
    } else {
      // Subsequent authors: First Middle Last
      const middle = author.middleName ? ` ${author.middleName}` : ''
      return `${author.firstName}${middle} ${author.lastName}`
    }
  })

  if (formatted.length === 1) return formatted[0]
  if (formatted.length === 2) return `${formatted[0]}, and ${formatted[1]}`

  const lastAuthor = formatted[formatted.length - 1]
  const otherAuthors = formatted.slice(0, -1).join(', ')
  return `${otherAuthors}, and ${lastAuthor}`
}

function formatAuthorsChicago(authors: Author[], isInText = false): string {
  if (isInText) {
    if (authors.length === 1) {
      return authors[0].lastName
    } else if (authors.length === 2) {
      return `${authors[0].lastName} and ${authors[1].lastName}`
    } else if (authors.length === 3) {
      return `${authors[0].lastName}, ${authors[1].lastName}, and ${authors[2].lastName}`
    } else {
      return `${authors[0].lastName} et al.`
    }
  }

  const formatted = authors.map((author, index) => {
    if (index === 0) {
      const middle = author.middleName ? ` ${author.middleName}` : ''
      return `${author.lastName}, ${author.firstName}${middle}`
    } else {
      const middle = author.middleName ? ` ${author.middleName}` : ''
      return `${author.firstName}${middle} ${author.lastName}`
    }
  })

  if (formatted.length === 1) return formatted[0]
  if (formatted.length === 2) return `${formatted[0]}, and ${formatted[1]}`

  const lastAuthor = formatted[formatted.length - 1]
  const otherAuthors = formatted.slice(0, -1).join(', ')
  return `${otherAuthors}, and ${lastAuthor}`
}

function formatAuthorsHarvard(authors: Author[], isInText = false): string {
  if (isInText) {
    if (authors.length === 1) {
      return authors[0].lastName
    } else if (authors.length === 2) {
      return `${authors[0].lastName} and ${authors[1].lastName}`
    } else {
      return `${authors[0].lastName} et al.`
    }
  }

  const formatted = authors.map((author) => {
    const firstInitial = author.firstName.charAt(0).toUpperCase()
    const middleInitial = author.middleName ? author.middleName.charAt(0).toUpperCase() + '.' : ''
    return `${author.lastName}, ${firstInitial}.${middleInitial}`
  })

  if (formatted.length === 1) return formatted[0]
  if (formatted.length === 2) return `${formatted[0]} and ${formatted[1]}`

  const lastAuthor = formatted[formatted.length - 1]
  const otherAuthors = formatted.slice(0, -1).join(', ')
  return `${otherAuthors} and ${lastAuthor}`
}

// Format dates
export function formatDate(year?: string, month?: string, day?: string, style?: CitationStyle): string {
  if (!year) return ''

  if (style === 'mla' && month && day) {
    const monthNames = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.']
    return `${day} ${monthNames[parseInt(month) - 1]} ${year}`
  }

  if (month && day) {
    return `${year}, ${month} ${day}`
  }

  return year
}

// Generate full citation
export function generateCitation(
  fields: CitationFields,
  sourceType: SourceType,
  style: CitationStyle
): { citation: string; inTextCitation: string } {
  switch (style) {
    case 'apa':
      return generateAPACitation(fields, sourceType)
    case 'mla':
      return generateMLACitation(fields, sourceType)
    case 'chicago':
      return generateChicagoCitation(fields, sourceType)
    case 'harvard':
      return generateHarvardCitation(fields, sourceType)
    default:
      return generateAPACitation(fields, sourceType)
  }
}

// APA 7th Edition
function generateAPACitation(fields: CitationFields, sourceType: SourceType): { citation: string; inTextCitation: string } {
  const authors = formatAuthors(fields.authors, 'apa')
  const inTextAuthors = formatAuthors(fields.authors, 'apa', true)
  const year = fields.year || 'n.d.'
  const title = fields.title

  let citation = ''

  switch (sourceType) {
    case 'website':
      const siteName = fields.siteName || ''
      const url = fields.url || ''
      const date = formatDate(fields.year, fields.month, fields.day)
      citation = `${authors} (${date || year}). ${title}. ${siteName}. ${url}`
      break

    case 'book':
      const edition = fields.edition ? ` (${fields.edition})` : ''
      const publisher = fields.publisher || ''
      citation = `${authors} (${year}). ${title}${edition}. ${publisher}.`
      break

    case 'journal':
      const journal = fields.journalTitle || ''
      const volume = fields.volume || ''
      const issue = fields.issue ? `(${fields.issue})` : ''
      const pages = fields.pages || ''
      const doi = fields.doi ? ` https://doi.org/${fields.doi}` : ''
      citation = `${authors} (${year}). ${title}. ${journal}, ${volume}${issue}, ${pages}.${doi}`
      break

    case 'report':
      const institution = fields.institution || ''
      const reportNum = fields.reportNumber ? ` (Report No. ${fields.reportNumber})` : ''
      citation = `${authors} (${year}). ${title}${reportNum}. ${institution}.`
      break

    case 'news':
      const publication = fields.publication || ''
      const newsDate = formatDate(fields.year, fields.month, fields.day)
      const newsUrl = fields.url || ''
      citation = `${authors} (${newsDate || year}). ${title}. ${publication}. ${newsUrl}`
      break
  }

  const inTextCitation = `(${inTextAuthors}, ${year})`

  return { citation, inTextCitation }
}

// MLA 9th Edition
function generateMLACitation(fields: CitationFields, sourceType: SourceType): { citation: string; inTextCitation: string } {
  const authors = formatAuthors(fields.authors, 'mla')
  const inTextAuthors = formatAuthors(fields.authors, 'mla', true)
  const title = `"${fields.title}"`

  let citation = ''

  switch (sourceType) {
    case 'website':
      const siteName = fields.siteName || ''
      const date = formatDate(fields.year, fields.month, fields.day, 'mla')
      const url = fields.url || ''
      citation = `${authors}. ${title} ${siteName}, ${date}, ${url}.`
      break

    case 'book':
      const publisher = fields.publisher || ''
      const year = fields.year || ''
      citation = `${authors}. ${fields.title}. ${publisher}, ${year}.`
      break

    case 'journal':
      const journal = fields.journalTitle || ''
      const volume = fields.volume ? `, vol. ${fields.volume}` : ''
      const issue = fields.issue ? `, no. ${fields.issue}` : ''
      const yearJ = fields.year || ''
      const pages = fields.pages ? `, pp. ${fields.pages}` : ''
      citation = `${authors}. ${title} ${journal}${volume}${issue}, ${yearJ}${pages}.`
      break

    case 'report':
      const institution = fields.institution || ''
      const yearR = fields.year || ''
      citation = `${authors}. ${fields.title}. ${institution}, ${yearR}.`
      break

    case 'news':
      const publication = fields.publication || ''
      const newsDate = formatDate(fields.year, fields.month, fields.day, 'mla')
      const newsUrl = fields.url || ''
      citation = `${authors}. ${title} ${publication}, ${newsDate}, ${newsUrl}.`
      break
  }

  const inTextCitation = `(${inTextAuthors})`

  return { citation, inTextCitation }
}

// Chicago 17th Edition (Author-Date)
function generateChicagoCitation(fields: CitationFields, sourceType: SourceType): { citation: string; inTextCitation: string } {
  const authors = formatAuthors(fields.authors, 'chicago')
  const inTextAuthors = formatAuthors(fields.authors, 'chicago', true)
  const year = fields.year || 'n.d.'
  const title = fields.title

  let citation = ''

  switch (sourceType) {
    case 'website':
      const siteName = fields.siteName || ''
      const url = fields.url || ''
      const accessDate = fields.accessDate ? ` Accessed ${fields.accessDate}.` : ''
      citation = `${authors}. ${year}. "${title}" ${siteName}.${accessDate} ${url}.`
      break

    case 'book':
      const place = fields.place || ''
      const publisher = fields.publisher || ''
      citation = `${authors}. ${year}. ${title}. ${place}: ${publisher}.`
      break

    case 'journal':
      const journal = fields.journalTitle || ''
      const volume = fields.volume || ''
      const issue = fields.issue ? ` (${fields.issue})` : ''
      const pages = fields.pages || ''
      citation = `${authors}. ${year}. "${title}" ${journal} ${volume}${issue}: ${pages}.`
      break

    case 'report':
      const institution = fields.institution || ''
      citation = `${authors}. ${year}. ${title}. ${institution}.`
      break

    case 'news':
      const publication = fields.publication || ''
      const date = formatDate(fields.year, fields.month, fields.day)
      citation = `${authors}. ${date || year}. "${title}" ${publication}.`
      break
  }

  const inTextCitation = `(${inTextAuthors} ${year})`

  return { citation, inTextCitation }
}

// Harvard
function generateHarvardCitation(fields: CitationFields, sourceType: SourceType): { citation: string; inTextCitation: string } {
  const authors = formatAuthors(fields.authors, 'harvard')
  const inTextAuthors = formatAuthors(fields.authors, 'harvard', true)
  const year = fields.year || 'n.d.'
  const title = `'${fields.title}'`

  let citation = ''

  switch (sourceType) {
    case 'website':
      const siteName = fields.siteName || ''
      const url = fields.url || ''
      const accessDate = fields.accessDate ? ` (Accessed: ${fields.accessDate})` : ''
      citation = `${authors} (${year}) ${title}, ${siteName}. Available at: ${url}${accessDate}.`
      break

    case 'book':
      const edition = fields.edition ? ` ${fields.edition}.` : ''
      const place = fields.place || ''
      const publisher = fields.publisher || ''
      citation = `${authors} (${year}) ${fields.title}.${edition} ${place}: ${publisher}.`
      break

    case 'journal':
      const journal = fields.journalTitle || ''
      const volume = fields.volume || ''
      const issue = fields.issue ? `(${fields.issue})` : ''
      const pages = fields.pages ? `, pp. ${fields.pages}` : ''
      citation = `${authors} (${year}) ${title}, ${journal}, ${volume}${issue}${pages}.`
      break

    case 'report':
      const institution = fields.institution || ''
      citation = `${authors} (${year}) ${fields.title}. ${institution}.`
      break

    case 'news':
      const publication = fields.publication || ''
      const date = formatDate(fields.year, fields.month, fields.day)
      citation = `${authors} (${date || year}) ${title}, ${publication}.`
      break
  }

  const inTextCitation = `(${inTextAuthors}, ${year})`

  return { citation, inTextCitation }
}
