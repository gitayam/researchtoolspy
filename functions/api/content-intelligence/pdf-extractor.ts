/**
 * PDF Extractor for Content Intelligence
 *
 * Primary: unpdf (serverless-edge pdf.js fork, runs in-Worker, no external API).
 * Optional fallback: pdf.co — only attempted when PDF_CO_API_KEY is set and unpdf failed.
 */
import { extractText, getDocumentProxy, getMeta } from 'unpdf'

type PdfMetadata = {
  title?: string
  author?: string
  pageCount?: number
  keywords?: string[]
}

/**
 * Extract text from PDF URL.
 *
 * @param url - PDF URL to extract from
 * @param pdfCoApiKey - optional; if set, used as a fallback when in-Worker extraction fails
 */
export async function extractPDFText(url: string, pdfCoApiKey?: string): Promise<{
  text: string
  metadata?: PdfMetadata
}> {
  // Realistic UA — observed that some hosts (e.g. w3.org) 403 the default Workers fetch
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'application/pdf,*/*;q=0.8'
    },
    signal: AbortSignal.timeout(30000)
  })

  if (!response.ok) {
    throw new Error(`Failed to download PDF: ${response.status}`)
  }

  const pdfBuffer = await response.arrayBuffer()

  try {
    return await extractViaUnpdf(pdfBuffer)
  } catch (unpdfError) {
    const reason = unpdfError instanceof Error ? unpdfError.message : String(unpdfError)
    console.warn('[PDF Extractor] unpdf failed:', reason)

    if (pdfCoApiKey) {
      return await extractPDFViaExternalService(pdfBuffer, pdfCoApiKey)
    }

    throw new Error(`PDF text extraction failed (${reason}). The PDF may be encrypted, scanned, or image-only.`)
  }
}

/**
 * In-Worker extraction via unpdf. Handles standard text-based PDFs without any external service.
 * Image-only / scanned PDFs return empty text — caller falls back to pdf.co if configured.
 */
async function extractViaUnpdf(pdfBuffer: ArrayBuffer): Promise<{ text: string; metadata?: PdfMetadata }> {
  const pdf = await getDocumentProxy(new Uint8Array(pdfBuffer))
  const [textResult, metaResult] = await Promise.all([
    extractText(pdf, { mergePages: true }),
    getMeta(pdf).catch(() => null)
  ])

  const text = Array.isArray(textResult.text) ? textResult.text.join('\n\n') : textResult.text

  if (!text || text.trim().length === 0) {
    throw new Error('No text extracted (PDF may be image-only or scanned)')
  }

  const info: any = metaResult?.info ?? {}
  const keywordsRaw = typeof info.Keywords === 'string' ? info.Keywords : undefined

  return {
    text,
    metadata: {
      title: typeof info.Title === 'string' ? info.Title : undefined,
      author: typeof info.Author === 'string' ? info.Author : undefined,
      pageCount: textResult.totalPages,
      keywords: keywordsRaw ? keywordsRaw.split(/[,;]\s*/).filter(Boolean) : undefined
    }
  }
}

/**
 * pdf.co fallback — only invoked when unpdf failed and the API key is configured.
 * Handles scanned/image-only PDFs via OCR.
 */
async function extractPDFViaExternalService(pdfBuffer: ArrayBuffer, pdfCoApiKey: string): Promise<{
  text: string
  metadata?: PdfMetadata
}> {
  try {
    const uploadResponse = await fetch('https://api.pdf.co/v1/file/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'x-api-key': pdfCoApiKey,
      },
      body: pdfBuffer,
      signal: AbortSignal.timeout(30000)
    })

    if (!uploadResponse.ok) {
      throw new Error(`PDF upload failed: ${uploadResponse.status}`)
    }

    const uploadData = await uploadResponse.json() as any
    const fileUrl = uploadData.url

    const extractResponse = await fetch('https://api.pdf.co/v1/pdf/convert/to/text', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': pdfCoApiKey,
      },
      body: JSON.stringify({ url: fileUrl, inline: true }),
      signal: AbortSignal.timeout(30000)
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
      metadata: { pageCount: extractData.pageCount }
    }
  } catch (pdfCoError) {
    const reason = pdfCoError instanceof Error ? pdfCoError.message : String(pdfCoError)
    console.error('[PDF Extractor] pdf.co fallback failed:', reason)
    throw new Error(`PDF text extraction failed via fallback (${reason}). The PDF may be encrypted, scanned, or corrupted.`)
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


  // Step 1: Detect chapters/sections
  const chapters = detectChapters(fullText)

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

  // Step 3: Generate questions using AI
  const questions = await generateQuestions(chapterSummaries, openaiApiKey)

  // Step 4: Search full text for answers
  const qa = await answerQuestions(questions, fullText, openaiApiKey)

  // Step 5: Generate final summary
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
      model: 'gpt-5.4-mini',
      reasoning_effort: 'none',
      temperature: 0.7,
      messages: [
        { role: 'system', content: 'You are an expert analyst who generates insightful questions about documents.' },
        { role: 'user', content: prompt }
      ]
    }),
    signal: AbortSignal.timeout(30000)
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
      model: 'gpt-5.4-nano',
      reasoning_effort: 'none',
      temperature: 0.3,
      max_completion_tokens: 150,
      messages: [
        { role: 'system', content: 'You are a precise analyst who answers questions based only on provided evidence.' },
        { role: 'user', content: prompt }
      ]
    }),
    signal: AbortSignal.timeout(30000)
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
      model: 'gpt-5.4-nano',
      reasoning_effort: 'none',
      temperature: 0.5,
      max_completion_tokens: 500,
      messages: [
        {
          role: 'system',
          content: 'You are an expert analyst who creates precise, insightful summaries of complex documents.'
        },
        { role: 'user', content: prompt }
      ]
    }),
    signal: AbortSignal.timeout(30000)
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
      model: 'gpt-5.4-nano',
      reasoning_effort: 'none',
      temperature: 0.5,
      max_completion_tokens: 400,
      messages: [
        { role: 'system', content: 'You are an expert at creating concise, informative summaries.' },
        { role: 'user', content: `Summarize this text in 250 words:\n\n${text.slice(0, 8000)}` }
      ]
    }),
    signal: AbortSignal.timeout(30000)
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
