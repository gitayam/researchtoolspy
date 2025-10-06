/**
 * Question-Answering System with Hybrid Search
 *
 * Combines:
 * 1. Regex pattern matching for exact keyword extraction
 * 2. Semantic search with GPT for contextual understanding
 * 3. Source excerpt extraction with relevance scoring
 * 4. Missing data detection
 */

import type { PagesFunction } from '@cloudflare/workers-types'

interface Env {
  DB: D1Database
  OPENAI_API_KEY: string
}

interface QuestionRequest {
  analysis_id: number
  question: string
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  try {
    const body = await request.json() as QuestionRequest
    const { analysis_id, question } = body

    if (!analysis_id || !question) {
      return new Response(JSON.stringify({
        error: 'analysis_id and question are required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log(`[Q&A] Processing question for analysis ${analysis_id}: ${question}`)

    // Fetch content analysis
    const analysis = await env.DB.prepare(`
      SELECT * FROM content_analysis WHERE id = ?
    `).bind(analysis_id).first()

    if (!analysis) {
      return new Response(JSON.stringify({ error: 'Analysis not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const content = analysis.extracted_text as string
    const entities = JSON.parse(analysis.entities as string || '{}')
    const summary = analysis.summary as string || ''

    // Step 1: Regex keyword extraction
    const regexResults = extractWithRegex(content, question)

    // Step 2: Semantic search with GPT
    const semanticResults = await semanticSearch(
      content,
      summary,
      entities,
      question,
      env.OPENAI_API_KEY
    )

    // Step 3: Combine results
    const combinedAnswer = combineResults(regexResults, semanticResults)

    // Step 4: Extract source excerpts
    const sourceExcerpts = extractRelevantExcerpts(
      content,
      combinedAnswer.answer || '',
      combinedAnswer.keywords
    )

    // Step 5: Detect missing data
    const missingData = detectMissingData(
      combinedAnswer.answer || '',
      semanticResults.confidence
    )

    // Save Q&A to database
    const qaResult = await env.DB.prepare(`
      INSERT INTO content_qa (
        content_analysis_id, user_id, question, answer, confidence_score,
        source_excerpts, has_complete_answer, missing_data_notes, search_method
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      analysis_id,
      1, // TODO: Get actual user_id from auth
      question,
      combinedAnswer.answer,
      combinedAnswer.confidence,
      JSON.stringify(sourceExcerpts),
      combinedAnswer.has_complete_answer ? 1 : 0,
      missingData,
      'hybrid'
    ).run()

    const qaId = qaResult.meta.last_row_id as number

    return new Response(JSON.stringify({
      id: qaId,
      content_analysis_id: analysis_id,
      question,
      answer: combinedAnswer.answer,
      confidence_score: combinedAnswer.confidence,
      source_excerpts: sourceExcerpts,
      has_complete_answer: combinedAnswer.has_complete_answer,
      missing_data_notes: missingData,
      search_method: 'hybrid',
      regex_matches: regexResults.matches.length,
      semantic_confidence: semanticResults.confidence
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('[Q&A] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to answer question',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// ========================================
// Regex-based keyword extraction
// ========================================
function extractWithRegex(content: string, question: string): {
  matches: string[]
  keywords: string[]
  contexts: string[]
} {
  // Extract keywords from question
  const keywords = question
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !isStopWord(w))

  const matches: string[] = []
  const contexts: string[] = []

  // Search for each keyword in content
  keywords.forEach(keyword => {
    const regex = new RegExp(`\\b${keyword}\\w*\\b`, 'gi')
    const found = content.match(regex)
    if (found) {
      matches.push(...found)

      // Extract context (100 chars before and after)
      const contentLower = content.toLowerCase()
      const index = contentLower.indexOf(keyword.toLowerCase())
      if (index !== -1) {
        const start = Math.max(0, index - 100)
        const end = Math.min(content.length, index + keyword.length + 100)
        contexts.push(content.substring(start, end).trim())
      }
    }
  })

  return { matches, keywords, contexts }
}

// ========================================
// Semantic search with GPT
// ========================================
async function semanticSearch(
  content: string,
  summary: string,
  entities: any,
  question: string,
  apiKey: string
): Promise<{
  answer: string
  confidence: number
  sources: string[]
}> {
  // Truncate content for GPT (max 8000 chars)
  const truncatedContent = content.substring(0, 8000)

  const prompt = `Based on the following content, answer this question. If the answer is not in the content, say "Information not available in the provided content."

Question: ${question}

Summary: ${summary}

Content: ${truncatedContent}

Entities:
- People: ${entities.people?.map((p: any) => p.name).join(', ') || 'None'}
- Organizations: ${entities.organizations?.map((o: any) => o.name).join(', ') || 'None'}
- Locations: ${entities.locations?.map((l: any) => l.name).join(', ') || 'None'}

Return ONLY valid JSON:
{
  "answer": "Direct answer to the question",
  "confidence": 0.85,
  "sources": ["Relevant excerpt 1", "Relevant excerpt 2"]
}`

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: 'gpt-5-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a question-answering assistant. Extract precise answers from provided content. Return ONLY valid JSON.'
          },
          { role: 'user', content: prompt }
        ],
        max_completion_tokens: 600
      })
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`)
    }

    const data = await response.json() as any

    if (!data.choices?.[0]?.message?.content) {
      throw new Error('Invalid API response')
    }

    const jsonText = data.choices[0].message.content
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()

    const result = JSON.parse(jsonText)

    return {
      answer: result.answer || 'Unable to extract answer',
      confidence: result.confidence || 0.5,
      sources: result.sources || []
    }

  } catch (error) {
    console.error('[Semantic Search] Error:', error)
    return {
      answer: 'Error processing question with AI',
      confidence: 0,
      sources: []
    }
  }
}

// ========================================
// Combine regex and semantic results
// ========================================
function combineResults(
  regexResults: { matches: string[], keywords: string[], contexts: string[] },
  semanticResults: { answer: string, confidence: number, sources: string[] }
): {
  answer: string
  confidence: number
  has_complete_answer: boolean
  keywords: string[]
} {
  // If semantic search has high confidence, use it
  if (semanticResults.confidence > 0.7) {
    return {
      answer: semanticResults.answer,
      confidence: semanticResults.confidence,
      has_complete_answer: !semanticResults.answer.toLowerCase().includes('not available'),
      keywords: regexResults.keywords
    }
  }

  // If regex found matches, combine with semantic
  if (regexResults.matches.length > 0) {
    const combinedAnswer = semanticResults.answer.includes('not available')
      ? `Found ${regexResults.matches.length} keyword matches. Context: ${regexResults.contexts[0]}`
      : semanticResults.answer

    return {
      answer: combinedAnswer,
      confidence: Math.max(0.5, semanticResults.confidence),
      has_complete_answer: !combinedAnswer.includes('not available'),
      keywords: regexResults.keywords
    }
  }

  // No good results
  return {
    answer: semanticResults.answer,
    confidence: semanticResults.confidence,
    has_complete_answer: false,
    keywords: regexResults.keywords
  }
}

// ========================================
// Extract relevant excerpts from content
// ========================================
function extractRelevantExcerpts(
  content: string,
  answer: string,
  keywords: string[]
): Array<{ text: string, paragraph: number, relevance: number }> {
  const excerpts: Array<{ text: string, paragraph: number, relevance: number }> = []

  // Split content into paragraphs
  const paragraphs = content.split(/\n\n+/).filter(p => p.trim().length > 50)

  // Extract answer keywords
  const answerKeywords = answer
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !isStopWord(w))

  // Score each paragraph by relevance
  paragraphs.forEach((para, index) => {
    const paraLower = para.toLowerCase()
    let score = 0

    // Score based on question keywords
    keywords.forEach(kw => {
      if (paraLower.includes(kw.toLowerCase())) score += 0.3
    })

    // Score based on answer keywords
    answerKeywords.forEach(kw => {
      if (paraLower.includes(kw)) score += 0.5
    })

    if (score > 0.5) {
      excerpts.push({
        text: para.substring(0, 300).trim() + (para.length > 300 ? '...' : ''),
        paragraph: index + 1,
        relevance: Math.min(1.0, score)
      })
    }
  })

  // Sort by relevance and return top 3
  return excerpts
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, 3)
}

// ========================================
// Detect missing data
// ========================================
function detectMissingData(answer: string, confidence: number): string | null {
  const answerLower = answer.toLowerCase()

  if (confidence < 0.5) {
    return 'Low confidence answer - content may not contain sufficient information to fully answer the question.'
  }

  if (answerLower.includes('not available') || answerLower.includes('not found')) {
    return 'The requested information was not found in the analyzed content.'
  }

  if (answerLower.includes('unclear') || answerLower.includes('ambiguous')) {
    return 'The information in the content is unclear or ambiguous for this question.'
  }

  // Check for partial answers
  const partialIndicators = ['some', 'partial', 'limited', 'incomplete']
  if (partialIndicators.some(indicator => answerLower.includes(indicator))) {
    return 'Only partial information available - some details may be missing.'
  }

  return null
}

// ========================================
// Check if word is a stop word
// ========================================
function isStopWord(word: string): boolean {
  const stopWords = new Set([
    'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i',
    'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
    'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she',
    'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what',
    'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me',
    'when', 'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know', 'take',
    'into', 'year', 'your', 'some', 'could', 'them', 'see', 'other', 'than',
    'then', 'now', 'look', 'only', 'come', 'its', 'over', 'think', 'also',
    'back', 'after', 'use', 'two', 'how', 'our', 'work', 'first', 'well', 'way',
    'even', 'new', 'want', 'because', 'any', 'these', 'give', 'day', 'most', 'us'
  ])

  return stopWords.has(word.toLowerCase())
}

// ========================================
// GET - Retrieve Q&A history for analysis
// ========================================
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params } = context
  const url = new URL(context.request.url)
  const analysisId = url.searchParams.get('analysis_id')

  if (!analysisId) {
    return new Response(JSON.stringify({
      error: 'analysis_id query parameter required'
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  try {
    const results = await env.DB.prepare(`
      SELECT * FROM content_qa
      WHERE content_analysis_id = ?
      ORDER BY created_at DESC
    `).bind(Number(analysisId)).all()

    const qaHistory = results.results?.map(row => ({
      ...row,
      source_excerpts: JSON.parse(row.source_excerpts as string || '[]'),
      has_complete_answer: Boolean(row.has_complete_answer)
    })) || []

    return new Response(JSON.stringify({ qa_history: qaHistory }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('[Q&A] Get history error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to retrieve Q&A history',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
