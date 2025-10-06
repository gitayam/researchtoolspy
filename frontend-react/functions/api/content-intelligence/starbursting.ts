/**
 * Starbursting Framework Integration
 *
 * Launch Starbursting analysis from content intelligence:
 * - Single link → auto-populate framework
 * - Multiple links → prompt user to select or use all
 * - Pre-fill central_topic and context from analyzed content
 * - Call existing /api/starbursting endpoint
 */

import type { PagesFunction } from '@cloudflare/workers-types'

interface Env {
  DB: D1Database
}

interface StarburstingRequest {
  analysis_ids: number[]
  title?: string
  use_ai_questions?: boolean
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  try {
    const body = await request.json() as StarburstingRequest
    const { analysis_ids, title, use_ai_questions = true } = body

    if (!analysis_ids || analysis_ids.length === 0) {
      return new Response(JSON.stringify({
        error: 'At least one analysis_id is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log(`[Starbursting] Creating session from ${analysis_ids.length} content analysis(es)`)

    // Fetch content analyses
    const placeholders = analysis_ids.map(() => '?').join(',')
    const results = await env.DB.prepare(`
      SELECT
        id, url, title, summary, extracted_text, entities, publish_date, author
      FROM content_analysis
      WHERE id IN (${placeholders})
      ORDER BY created_at DESC
    `).bind(...analysis_ids).all()

    if (!results.results || results.results.length === 0) {
      return new Response(JSON.stringify({
        error: 'No content analyses found with provided IDs'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const analyses = results.results

    // Build Starbursting data
    const primaryAnalysis = analyses[0]
    const centralTopic = title || (primaryAnalysis.title as string) || 'Content Analysis'

    // Build context from all analyses
    const contextParts: string[] = []

    analyses.forEach((analysis, index) => {
      const entities = JSON.parse(analysis.entities as string || '{}')

      let analysisSummary = `Source ${index + 1}: ${analysis.title || analysis.url}\n`

      if (analysis.author) {
        analysisSummary += `Author: ${analysis.author}\n`
      }
      if (analysis.publish_date) {
        analysisSummary += `Published: ${analysis.publish_date}\n`
      }

      analysisSummary += `\nSummary: ${analysis.summary || 'No summary available'}\n`

      // Add key entities
      if (entities.people && entities.people.length > 0) {
        analysisSummary += `\nKey People: ${entities.people.slice(0, 5).map((p: any) => p.name).join(', ')}`
      }
      if (entities.organizations && entities.organizations.length > 0) {
        analysisSummary += `\nOrganizations: ${entities.organizations.slice(0, 5).map((o: any) => o.name).join(', ')}`
      }
      if (entities.locations && entities.locations.length > 0) {
        analysisSummary += `\nLocations: ${entities.locations.slice(0, 5).map((l: any) => l.name).join(', ')}`
      }

      contextParts.push(analysisSummary)
    })

    const context = contextParts.join('\n\n---\n\n')

    // Extract initial questions from content (5W1H)
    const initialQuestions = extractInitialQuestions(analyses)

    // Call existing Starbursting API
    const starburstingEndpoint = `${new URL(request.url).origin}/api/starbursting/create`

    const starburstingPayload = {
      title: centralTopic,
      central_topic: centralTopic,
      context: context.substring(0, 5000), // Limit context size
      initial_questions: initialQuestions,
      request_ai_questions: use_ai_questions
    }

    console.log('[Starbursting] Calling Starbursting API:', starburstingPayload)

    const starburstingResponse = await fetch(starburstingEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // TODO: Forward auth headers
      },
      body: JSON.stringify(starburstingPayload)
    })

    if (!starburstingResponse.ok) {
      const errorText = await starburstingResponse.text()
      throw new Error(`Starbursting API error: ${starburstingResponse.status} - ${errorText}`)
    }

    const starburstingData = await starburstingResponse.json()
    const sessionId = starburstingData.session_id

    console.log('[Starbursting] Session created:', sessionId)

    // Link content analyses to Starbursting session
    for (const analysisId of analysis_ids) {
      await env.DB.prepare(`
        INSERT INTO starbursting_sources (session_id, content_analysis_id)
        VALUES (?, ?)
      `).bind(sessionId, analysisId).run()
    }

    return new Response(JSON.stringify({
      session_id: sessionId,
      redirect_url: `/frameworks/starbursting/${sessionId}`,
      central_topic: centralTopic,
      sources_count: analyses.length,
      ai_questions_generated: use_ai_questions,
      starbursting_data: starburstingData
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('[Starbursting] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to create Starbursting session',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// ========================================
// GET - Retrieve Starbursting sessions for analysis
// ========================================
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env } = context
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
      SELECT
        ss.session_id,
        ss.created_at,
        fs.title,
        fs.status,
        fs.data
      FROM starbursting_sources ss
      LEFT JOIN framework_sessions fs ON ss.session_id = fs.id
      WHERE ss.content_analysis_id = ?
      ORDER BY ss.created_at DESC
    `).bind(Number(analysisId)).all()

    const sessions = results.results?.map(row => ({
      session_id: row.session_id,
      title: row.title,
      status: row.status,
      created_at: row.created_at,
      data: row.data ? JSON.parse(row.data as string) : null
    })) || []

    return new Response(JSON.stringify({ sessions }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('[Starbursting] Get sessions error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to retrieve Starbursting sessions',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// ========================================
// Extract initial 5W1H questions from content
// ========================================
function extractInitialQuestions(analyses: any[]): any[] {
  const questions: any[] = []

  // Extract from first analysis (primary source)
  if (analyses.length > 0) {
    const primary = analyses[0]
    const entities = JSON.parse(primary.entities as string || '{}')

    // WHO questions
    if (entities.people && entities.people.length > 0) {
      questions.push({
        id: 'who_1',
        category: 'who',
        question: `Who are the key people involved? (${entities.people.slice(0, 3).map((p: any) => p.name).join(', ')})`,
        answer: entities.people.slice(0, 5).map((p: any) => p.name).join(', '),
        priority: 5,
        source: 'Content analysis',
        status: 'answered'
      })
    }

    // WHAT questions
    if (primary.summary) {
      questions.push({
        id: 'what_1',
        category: 'what',
        question: 'What is the main topic or event?',
        answer: primary.summary.substring(0, 200),
        priority: 5,
        source: 'Content summary',
        status: 'answered'
      })
    }

    // WHERE questions
    if (entities.locations && entities.locations.length > 0) {
      questions.push({
        id: 'where_1',
        category: 'where',
        question: `Where did this occur or where is this relevant? (${entities.locations.slice(0, 3).map((l: any) => l.name).join(', ')})`,
        answer: entities.locations.slice(0, 5).map((l: any) => l.name).join(', '),
        priority: 4,
        source: 'Content analysis',
        status: 'answered'
      })
    }

    // WHEN questions
    if (primary.publish_date) {
      questions.push({
        id: 'when_1',
        category: 'when',
        question: 'When was this published or when did this occur?',
        answer: primary.publish_date,
        priority: 4,
        source: 'Metadata',
        status: 'answered'
      })
    }

    // WHY questions (open for AI)
    questions.push({
      id: 'why_1',
      category: 'why',
      question: 'Why is this significant or why did this happen?',
      priority: 5,
      source: 'User input needed',
      status: 'pending'
    })

    // HOW questions (open for AI)
    questions.push({
      id: 'how_1',
      category: 'how',
      question: 'How did this occur or how should this be interpreted?',
      priority: 4,
      source: 'User input needed',
      status: 'pending'
    })

    // Additional WHO question about organizations
    if (entities.organizations && entities.organizations.length > 0) {
      questions.push({
        id: 'who_2',
        category: 'who',
        question: `What organizations are involved? (${entities.organizations.slice(0, 3).map((o: any) => o.name).join(', ')})`,
        answer: entities.organizations.slice(0, 5).map((o: any) => o.name).join(', '),
        priority: 4,
        source: 'Content analysis',
        status: 'answered'
      })
    }
  }

  // If multiple sources, add comparative questions
  if (analyses.length > 1) {
    questions.push({
      id: 'what_2',
      category: 'what',
      question: `What are the different perspectives across ${analyses.length} sources?`,
      priority: 3,
      source: 'Multi-source comparison',
      status: 'pending'
    })
  }

  return questions
}
