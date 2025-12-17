import { Env } from '../types'

interface ExtractionResult {
  id: string
  source: {
    type: 'file' | 'url'
    name?: string
    url?: string
    size?: number
    mimeType?: string
    fileType?: string
  }
  content: {
    text: string
    html?: string
    pages?: number
    wordCount: number
    charCount: number
    lineCount?: number
  }
  metadata: {
    title?: string
    author?: string
    date?: string
    language?: string
    keywords?: string[]
    description?: string
  }
  analysis?: {
    readability?: {
      fleschKincaid: number
      grade: string
      difficulty: string
    }
    keywords?: Array<{
      word: string
      frequency: number
      percentage: number
    }>
  }
  extractedAt: string
  processingTime: number
}

// Helper function to extract text from PDF
async function extractFromPDF(arrayBuffer: ArrayBuffer): Promise<{ text: string; pages: number }> {
  // Simple PDF text extraction - looking for text objects
  const uint8Array = new Uint8Array(arrayBuffer)
  const pdfText = new TextDecoder('utf-8').decode(uint8Array)

  // Extract text between BT (Begin Text) and ET (End Text) operators
  const textRegex = /BT\s+(.*?)\s+ET/gs
  const matches = pdfText.matchAll(textRegex)

  let extractedText = ''
  for (const match of matches) {
    // Extract text from Tj operators
    const tjRegex = /\((.*?)\)\s*Tj/g
    const textMatches = match[1].matchAll(tjRegex)
    for (const textMatch of textMatches) {
      extractedText += textMatch[1].replace(/\\n/g, '\n').replace(/\\r/g, '') + ' '
    }
  }

  // Count pages
  const pageCount = (pdfText.match(/\/Type\s*\/Page[^s]/g) || []).length

  // If no text extracted, try alternate method
  if (!extractedText.trim()) {
    const streamRegex = /stream\s+(.*?)\s+endstream/gs
    const streamMatches = pdfText.matchAll(streamRegex)
    for (const match of streamMatches) {
      const cleanText = match[1]
        .replace(/[^\x20-\x7E\n]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      if (cleanText.length > 10) {
        extractedText += cleanText + ' '
      }
    }
  }

  return {
    text: extractedText.trim() || 'Unable to extract text from PDF. This may be a scanned document requiring OCR.',
    pages: pageCount || 1
  }
}

// Helper function to extract text from HTML
function extractFromHTML(html: string): { text: string; metadata: any } {
  // Remove script and style tags
  let cleanHtml = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
  cleanHtml = cleanHtml.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')

  // Extract metadata
  const metadata: any = {}

  const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i)
  if (titleMatch) metadata.title = titleMatch[1].trim()

  const metaTags = html.matchAll(/<meta\s+([^>]+)>/gi)
  for (const tag of metaTags) {
    const attrs = tag[1]
    const nameMatch = attrs.match(/name=["']([^"']+)["']/i)
    const propertyMatch = attrs.match(/property=["']([^"']+)["']/i)
    const contentMatch = attrs.match(/content=["']([^"']+)["']/i)

    if (contentMatch) {
      const content = contentMatch[1]
      if (nameMatch) {
        const name = nameMatch[1].toLowerCase()
        if (name === 'author') metadata.author = content
        if (name === 'description') metadata.description = content
        if (name === 'keywords') metadata.keywords = content.split(',').map((k: string) => k.trim())
      }
      if (propertyMatch) {
        const prop = propertyMatch[1].toLowerCase()
        if (prop === 'og:title') metadata.ogTitle = content
        if (prop === 'og:description') metadata.ogDescription = content
      }
    }
  }

  // Extract text content
  let text = cleanHtml
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()

  return { text, metadata }
}

// Helper function to extract text from plain text
function extractFromText(text: string): string {
  return text.trim()
}

// Helper function to analyze text
function analyzeText(text: string) {
  const words = text.toLowerCase().match(/\b[a-z]+\b/g) || []
  const wordCount = words.length
  const charCount = text.length
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0)
  const sentenceCount = sentences.length
  const lineCount = text.split('\n').length

  // Calculate syllables (approximate)
  const syllables = words.reduce((sum, word) => {
    const vowels = word.match(/[aeiou]/g)
    return sum + (vowels ? vowels.length : 1)
  }, 0)

  // Flesch-Kincaid Grade Level
  let fleschKincaid = 0
  if (wordCount > 0 && sentenceCount > 0) {
    const avgWordsPerSentence = wordCount / sentenceCount
    const avgSyllablesPerWord = syllables / wordCount
    fleschKincaid = 0.39 * avgWordsPerSentence + 11.8 * avgSyllablesPerWord - 15.59
  }

  // Grade level
  let grade = 'Unknown'
  let difficulty = 'standard'
  if (fleschKincaid < 6) {
    grade = '5th-6th'
    difficulty = 'very-easy'
  } else if (fleschKincaid < 8) {
    grade = '7th-8th'
    difficulty = 'easy'
  } else if (fleschKincaid < 10) {
    grade = '9th-10th'
    difficulty = 'fairly-easy'
  } else if (fleschKincaid < 12) {
    grade = '11th-12th'
    difficulty = 'standard'
  } else if (fleschKincaid < 14) {
    grade = 'College'
    difficulty = 'fairly-difficult'
  } else if (fleschKincaid < 16) {
    grade = 'College Graduate'
    difficulty = 'difficult'
  } else {
    grade = 'Professional'
    difficulty = 'very-difficult'
  }

  // Keyword extraction (top 10 most frequent words, excluding common words)
  const stopWords = new Set([
    'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i',
    'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
    'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she',
    'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what'
  ])

  const wordFreq: { [key: string]: number } = {}
  words.forEach(word => {
    if (!stopWords.has(word) && word.length > 3) {
      wordFreq[word] = (wordFreq[word] || 0) + 1
    }
  })

  const keywords = Object.entries(wordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word, frequency]) => ({
      word,
      frequency,
      percentage: (frequency / wordCount) * 100
    }))

  return {
    content: {
      wordCount,
      charCount,
      lineCount
    },
    analysis: {
      readability: {
        fleschKincaid: Math.round(fleschKincaid * 10) / 10,
        grade,
        difficulty
      },
      keywords
    }
  }
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  const startTime = Date.now()

  try {
    const contentType = request.headers.get('content-type') || ''

    let extractionData: {
      text: string
      pages?: number
      metadata?: any
      source: any
    } = {
      text: '',
      source: {}
    }

    // Handle file upload (multipart/form-data)
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      const file = formData.get('file') as File

      if (!file) {
        return new Response(JSON.stringify({ error: 'No file provided' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      const arrayBuffer = await file.arrayBuffer()
      const mimeType = file.type
      const size = file.size

      // Check file size (max 10MB)
      if (size > 10 * 1024 * 1024) {
        return new Response(JSON.stringify({ error: 'File size exceeds 10MB limit' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      extractionData.source = {
        type: 'file',
        name: file.name,
        size,
        mimeType,
        fileType: file.name.split('.').pop()?.toLowerCase() || 'unknown'
      }

      // Extract based on file type
      if (mimeType === 'application/pdf' || file.name.endsWith('.pdf')) {
        const { text, pages } = await extractFromPDF(arrayBuffer)
        extractionData.text = text
        extractionData.pages = pages
      } else if (mimeType === 'text/html' || file.name.endsWith('.html') || file.name.endsWith('.htm')) {
        const html = new TextDecoder().decode(arrayBuffer)
        const { text, metadata } = extractFromHTML(html)
        extractionData.text = text
        extractionData.metadata = metadata
      } else if (mimeType === 'text/plain' || file.name.endsWith('.txt')) {
        const text = new TextDecoder().decode(arrayBuffer)
        extractionData.text = extractFromText(text)
      } else {
        return new Response(JSON.stringify({ error: 'Unsupported file type. Supported: PDF, HTML, TXT' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
      }
    }
    // Handle URL extraction (application/json)
    else if (contentType.includes('application/json')) {
      const body = await request.json() as { url: string }

      if (!body.url) {
        return new Response(JSON.stringify({ error: 'No URL provided' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      // Fetch URL content
      const response = await fetch(body.url, {
        headers: {
          'User-Agent': 'ResearchToolsPy Content Extractor/1.0'
        }
      })

      if (!response.ok) {
        return new Response(JSON.stringify({ error: `Failed to fetch URL: ${response.statusText}` }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      const html = await response.text()
      const { text, metadata } = extractFromHTML(html)

      extractionData.text = text
      extractionData.metadata = metadata
      extractionData.source = {
        type: 'url',
        url: body.url
      }
    } else {
      return new Response(JSON.stringify({ error: 'Invalid content type. Use multipart/form-data for files or application/json for URLs' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Analyze the extracted text
    const analysis = analyzeText(extractionData.text)

    // Build result
    const result: ExtractionResult = {
      id: `ext_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      source: extractionData.source,
      content: {
        text: extractionData.text,
        pages: extractionData.pages,
        ...analysis.content
      },
      metadata: extractionData.metadata || {},
      analysis: analysis.analysis,
      extractedAt: new Date().toISOString(),
      processingTime: Date.now() - startTime
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })

  } catch (error) {
    console.error('Extraction error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to extract content',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Handle OPTIONS requests for CORS
export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  })
}
