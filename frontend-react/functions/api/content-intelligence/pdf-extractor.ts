/**
 * PDF Extractor for Content Intelligence
 *
 * Downloads and extracts text from PDF URLs
 * Uses pdf.js for text extraction
 */

/**
 * Extract text from PDF URL
 *
 * @param url - PDF URL to extract from
 * @returns Extracted text content
 */
export async function extractPDFText(url: string): Promise<{
  text: string
  metadata?: {
    title?: string
    author?: string
    pageCount?: number
    keywords?: string[]
  }
}> {
  console.log('[PDF Extractor] Downloading PDF from:', url)

  // Download PDF
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; ResearchToolsBot/1.0)'
    }
  })

  if (!response.ok) {
    throw new Error(`Failed to download PDF: ${response.status}`)
  }

  const pdfBuffer = await response.arrayBuffer()
  console.log('[PDF Extractor] Downloaded PDF, size:', (pdfBuffer.byteLength / 1024).toFixed(2), 'KB')

  // For Cloudflare Workers, we'll use a simpler approach:
  // 1. Try pdf-parse package if available
  // 2. Otherwise, send to external PDF extraction service

  try {
    // Try using pdf-parse (Node.js library)
    // Note: This may not work in Cloudflare Workers due to Node.js dependencies
    const pdfParse = require('pdf-parse')
    const pdfData = await pdfParse(Buffer.from(pdfBuffer))

    console.log('[PDF Extractor] Extracted text length:', pdfData.text.length)
    console.log('[PDF Extractor] Page count:', pdfData.numpages)

    return {
      text: pdfData.text,
      metadata: {
        title: pdfData.info?.Title,
        author: pdfData.info?.Author,
        pageCount: pdfData.numpages,
        keywords: pdfData.info?.Keywords?.split(',').map((k: string) => k.trim())
      }
    }
  } catch (nodeError) {
    console.warn('[PDF Extractor] pdf-parse not available, using external service')

    // Fallback: Use external PDF extraction API
    return await extractPDFViaExternalService(pdfBuffer)
  }
}

/**
 * Extract PDF text using external service (fallback for Cloudflare Workers)
 */
async function extractPDFViaExternalService(pdfBuffer: ArrayBuffer): Promise<{
  text: string
  metadata?: any
}> {
  // Option 1: Use pdf.co API (has free tier)
  try {
    console.log('[PDF Extractor] Using pdf.co API for extraction')

    // Upload PDF to pdf.co
    const uploadResponse = await fetch('https://api.pdf.co/v1/file/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'x-api-key': 'YOUR_PDF_CO_API_KEY' // TODO: Get from env
      },
      body: pdfBuffer
    })

    if (!uploadResponse.ok) {
      throw new Error(`PDF upload failed: ${uploadResponse.status}`)
    }

    const uploadData = await uploadResponse.json() as any
    const fileUrl = uploadData.url

    // Extract text
    const extractResponse = await fetch('https://api.pdf.co/v1/pdf/convert/to/text', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'YOUR_PDF_CO_API_KEY' // TODO: Get from env
      },
      body: JSON.stringify({
        url: fileUrl,
        inline: true
      })
    })

    if (!extractResponse.ok) {
      throw new Error(`PDF extraction failed: ${extractResponse.status}`)
    }

    const extractData = await extractResponse.json() as any

    if (!extractData.body) {
      throw new Error('No text extracted from PDF')
    }

    return {
      text: extractData.body,
      metadata: {
        pageCount: extractData.pageCount
      }
    }
  } catch (pdfCoError) {
    console.error('[PDF Extractor] pdf.co API failed:', pdfCoError)

    // Final fallback: Return error
    throw new Error('PDF text extraction failed. The PDF may be encrypted, scanned, or corrupted.')
  }
}

/**
 * Detect if URL is a PDF
 */
export function isPDFUrl(url: string): boolean {
  const urlLower = url.toLowerCase()
  return urlLower.endsWith('.pdf') ||
         urlLower.includes('.pdf?') ||
         urlLower.includes('/pdf/')
}

/**
 * Intelligent document chunking for large PDFs (>2000 words)
 *
 * Strategy:
 * 1. Detect table of contents or chapter markers
 * 2. Extract first and last ~200 words of each chapter
 * 3. Generate questions about the content
 * 4. Search full text for answers
 * 5. Create precise summary using Opus model
 */
export async function intelligentPDFSummary(
  fullText: string,
  wordCount: number,
  openaiApiKey: string
): Promise<{
  summary: string
  chapters?: string[]
  keyPoints?: string[]
  questions?: Array<{ question: string; answer: string }>
}> {
  if (wordCount <= 2000) {
    // Small document - use standard summarization
    return {
      summary: await generateStandardSummary(fullText, openaiApiKey)
    }
  }

  console.log('[PDF Intelligent Summary] Large document detected:', wordCount, 'words')

  // Step 1: Detect chapters/sections
  const chapters = detectChapters(fullText)
  console.log('[PDF Intelligent Summary] Detected chapters:', chapters.length)

  // Step 2: Extract chapter summaries (first + last 200 words)
  const chapterSummaries = chapters.map(chapter => {
    const words = chapter.text.split(/\s+/)
    const firstPart = words.slice(0, 200).join(' ')
    const lastPart = words.slice(-200).join(' ')
    return {
      title: chapter.title,
      excerpt: firstPart + '\n\n[...]\n\n' + lastPart,
      wordCount: words.length
    }
  })

  // Step 3: Generate questions using GPT-4o
  const questions = await generateQuestions(chapterSummaries, openaiApiKey)
  console.log('[PDF Intelligent Summary] Generated questions:', questions.length)

  // Step 4: Search full text for answers
  const qa = await answerQuestions(questions, fullText, openaiApiKey)

  // Step 5: Generate final summary using GPT-4o (will use Opus when available)
  const summary = await generateIntelligentSummary(chapterSummaries, qa, openaiApiKey)

  return {
    summary,
    chapters: chapters.map(c => c.title),
    keyPoints: extractKeyPoints(summary),
    questions: qa
  }
}

function detectChapters(text: string): Array<{ title: string; text: string }> {
  // Common chapter markers
  const chapterPatterns = [
    /^chapter\s+\d+[:\.\s]+(.+)$/gim,
    /^\d+\.\s+(.+)$/gm,
    /^section\s+\d+[:\.\s]+(.+)$/gim,
    /^part\s+\d+[:\.\s]+(.+)$/gim
  ]

  const chapters: Array<{ title: string; text: string; startIndex: number }> = []

  for (const pattern of chapterPatterns) {
    let match
    while ((match = pattern.exec(text)) !== null) {
      chapters.push({
        title: match[1].trim(),
        text: '', // Will be filled later
        startIndex: match.index
      })
    }

    if (chapters.length > 0) break // Use first successful pattern
  }

  // If no chapters detected, split by sections
  if (chapters.length === 0) {
    // Split into 5 equal parts
    const chunkSize = Math.floor(text.length / 5)
    for (let i = 0; i < 5; i++) {
      chapters.push({
        title: `Section ${i + 1}`,
        text: text.slice(i * chunkSize, (i + 1) * chunkSize),
        startIndex: i * chunkSize
      })
    }
  } else {
    // Extract text for each chapter
    chapters.sort((a, b) => a.startIndex - b.startIndex)
    for (let i = 0; i < chapters.length; i++) {
      const start = chapters[i].startIndex
      const end = chapters[i + 1]?.startIndex || text.length
      chapters[i].text = text.slice(start, end)
    }
  }

  return chapters
}

async function generateQuestions(
  chapterSummaries: Array<{ title: string; excerpt: string }>,
  apiKey: string
): Promise<string[]> {
  const prompt = `Based on these chapter summaries from a document, generate 5-10 insightful questions that would help understand the key themes and arguments:

${chapterSummaries.map((c, i) => `Chapter ${i + 1}: ${c.title}\n${c.excerpt}`).join('\n\n---\n\n')}

Generate questions that:
1. Focus on main themes and arguments
2. Connect ideas across chapters
3. Identify key evidence and claims
4. Are answerable from the document

Return ONLY a JSON array of questions, nothing else.
Example: ["What is the main argument?", "What evidence supports this?"]`

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.7,
      messages: [
        { role: 'system', content: 'You are an expert analyst who generates insightful questions about documents.' },
        { role: 'user', content: prompt }
      ]
    })
  })

  const data = await response.json() as any
  const content = data.choices[0].message.content

  try {
    // Try to parse JSON
    const jsonMatch = content.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
  } catch {
    // Fallback: split by lines
    return content.split('\n').filter((q: string) => q.trim().length > 0).slice(0, 10)
  }

  return []
}

async function answerQuestions(
  questions: string[],
  fullText: string,
  apiKey: string
): Promise<Array<{ question: string; answer: string }>> {
  const qa: Array<{ question: string; answer: string }> = []

  for (const question of questions) {
    // Search for relevant excerpts in full text
    const excerpts = extractRelevantExcerpts(question, fullText)

    // Use GPT to answer based on excerpts
    const answer = await generateAnswer(question, excerpts, apiKey)
    qa.push({ question, answer })
  }

  return qa
}

function extractRelevantExcerpts(question: string, text: string, maxExcerpts: number = 3): string[] {
  // Simple keyword-based search
  const keywords = question.toLowerCase().split(/\s+/).filter(w => w.length > 3)
  const paragraphs = text.split(/\n\n+/)

  const scored = paragraphs.map(para => {
    const paraLower = para.toLowerCase()
    const score = keywords.reduce((sum, kw) => sum + (paraLower.includes(kw) ? 1 : 0), 0)
    return { para, score }
  })

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, maxExcerpts)
    .map(s => s.para)
}

async function generateAnswer(question: string, excerpts: string[], apiKey: string): Promise<string> {
  const prompt = `Answer this question based on the provided excerpts:

Question: ${question}

Excerpts:
${excerpts.join('\n\n---\n\n')}

Provide a concise, evidence-based answer (2-3 sentences max).`

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.3,
      max_tokens: 150,
      messages: [
        { role: 'system', content: 'You are a precise analyst who answers questions based only on provided evidence.' },
        { role: 'user', content: prompt }
      ]
    })
  })

  const data = await response.json() as any
  return data.choices[0].message.content.trim()
}

async function generateIntelligentSummary(
  chapterSummaries: Array<{ title: string; excerpt: string }>,
  qa: Array<{ question: string; answer: string }>,
  apiKey: string
): Promise<string> {
  const prompt = `Create a comprehensive summary of this document using:

1. Chapter Summaries:
${chapterSummaries.map((c, i) => `${c.title}: ${c.excerpt.slice(0, 300)}...`).join('\n\n')}

2. Key Q&A:
${qa.map(item => `Q: ${item.question}\nA: ${item.answer}`).join('\n\n')}

Generate a 250-word summary that:
- Captures main themes and arguments
- Highlights key evidence
- Maintains logical flow
- Uses specific details from the document`

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o', // Use GPT-4o for higher quality (will upgrade to Opus when available)
      temperature: 0.5,
      max_tokens: 500,
      messages: [
        {
          role: 'system',
          content: 'You are an expert analyst who creates precise, insightful summaries of complex documents.'
        },
        { role: 'user', content: prompt }
      ]
    })
  })

  const data = await response.json() as any
  return data.choices[0].message.content.trim()
}

async function generateStandardSummary(text: string, apiKey: string): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.5,
      max_tokens: 400,
      messages: [
        { role: 'system', content: 'You are an expert at creating concise, informative summaries.' },
        { role: 'user', content: `Summarize this text in 250 words:\n\n${text.slice(0, 8000)}` }
      ]
    })
  })

  const data = await response.json() as any
  return data.choices[0].message.content.trim()
}

function extractKeyPoints(summary: string): string[] {
  // Extract sentences that start with strong indicators
  const sentences = summary.match(/[^.!?]+[.!?]+/g) || []
  return sentences
    .filter(s => /\b(key|main|important|significant|critical|essential|primary)\b/i.test(s))
    .map(s => s.trim())
    .slice(0, 5)
}
