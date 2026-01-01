import { getUserFromRequest, requireAuth } from '../_shared/auth-helpers'

interface Env {
  DB: D1Database
  JWT_SECRET?: string
}

interface StarburstingRequest {
  analysis_ids: number[]
  title?: string
  use_ai_questions?: boolean
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash'
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const userId = await requireAuth(request, env)
    
    // Get user hash for legacy association and cross-API calls
    const userResult = await env.DB.prepare('SELECT user_hash FROM users WHERE id = ?').bind(userId).first()
    const userHash = userResult?.user_hash as string

    if (!userHash) {
      return new Response(JSON.stringify({ error: 'User hash not found' }), {
        status: 404,
        headers: corsHeaders
      })
    }

    const body = await request.json() as StarburstingRequest
    const { analysis_ids, title, use_ai_questions = true } = body

    if (!analysis_ids || analysis_ids.length === 0) {
      return new Response(JSON.stringify({
        error: 'At least one analysis_id is required'
      }), {
        status: 400,
        headers: corsHeaders
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
        error: 'No content analyses found with provided IDs',
        provided_ids: analysis_ids
      }), {
        status: 404,
        headers: corsHeaders
      })
    }

    const analyses = results.results

    // Build Starbursting data
    const primaryAnalysis = analyses[0]
    const centralTopic = title || (primaryAnalysis.title as string) || 'Content Analysis'

    // Forward auth headers
    const authHeader = request.headers.get('Authorization')

    const contextParts: string[] = []

    analyses.forEach((analysis, index) => {
      let entities: any = {}
      try {
        entities = JSON.parse(analysis.entities as string || '{}')
      } catch (e) {
        console.warn(`[Starbursting] Failed to parse entities for analysis ${analysis.id}:`, e)
      }

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

    const contextContent = contextParts.join('\n\n---\n\n')

    // Extract full Q&A using AI if enabled
    let extractedData: any = {}

    if (use_ai_questions && primaryAnalysis.url) {
      const scrapeEndpoint = `${new URL(request.url).origin}/api/ai/scrape-url`
      
      const aiContext = {
        url: primaryAnalysis.url,
        framework: 'starbursting',
        title: primaryAnalysis.title,
        summary: primaryAnalysis.summary,
        extracted_text: primaryAnalysis.extracted_text ? (primaryAnalysis.extracted_text as string).substring(0, 8000) : '',
        entities: contextContent,
        central_topic: centralTopic
      }

      try {
        const scrapeResponse = await fetch(scrapeEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(authHeader && { 'Authorization': authHeader })
          },
          body: JSON.stringify(aiContext)
        })

        if (scrapeResponse.ok) {
          extractedData = await scrapeResponse.json()
        }
      } catch (error) {
        console.error('[Starbursting] AI extraction error:', error)
      }
    }

    // Fallback: Extract initial questions from content if AI fails
    const initialQuestions = extractInitialQuestions(analyses, centralTopic)

    // Determine the Q&A structure to use
    let qaData
    if (extractedData.who) {
      qaData = extractedData
    } else {
      qaData = categorizeFlatQuestions(initialQuestions)
    }

    // Create Starbursting session via framework API
    const frameworksEndpoint = `${new URL(request.url).origin}/api/frameworks`

    const starburstingPayload = {
      title: centralTopic,
      framework_type: 'starbursting',
      status: 'draft',
      data: {
        central_topic: centralTopic,
        context: contextContent.substring(0, 5000),
        ...qaData,
        source_url: primaryAnalysis.url,
        source_title: primaryAnalysis.title
      },
      workspace_id: '1'
    }

    const starburstingResponse = await fetch(frameworksEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader && { 'Authorization': authHeader }),
        'X-User-Hash': userHash
      },
      body: JSON.stringify(starburstingPayload)
    })

    if (!starburstingResponse.ok) {
      const errorText = await starburstingResponse.text()
      throw new Error(`Framework API error: ${starburstingResponse.status} - ${errorText}`)
    }

    const starburstingData = await starburstingResponse.json() as { id: string }
    const sessionId = starburstingData.id

    // Link content analyses to Starbursting session
    for (const analysisId of analysis_ids) {
      await env.DB.prepare(`
        INSERT INTO starbursting_sources (session_id, content_analysis_id)
        VALUES (?, ?)
      `).bind(sessionId, analysisId).run()
    }

    const fullFrameworkData = {
      id: sessionId,
      title: centralTopic,
      framework_type: 'starbursting',
      data: starburstingPayload.data,
      created_at: new Date().toISOString()
    }

    const responsePayload = {
      session_id: sessionId,
      redirect_url: `/dashboard/analysis-frameworks/starbursting/${sessionId}/view`,
      central_topic: centralTopic,
      sources_count: analyses.length,
      ai_questions_generated: use_ai_questions,
      framework_data: fullFrameworkData
    }

    return new Response(JSON.stringify(responsePayload), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    if (error instanceof Response) return error
    console.error('[Starbursting] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to create Starbursting session',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: corsHeaders
    })
  }
}

// CORS preflight
export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash'
    }
  })
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

  } catch (error: any) {
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

// CORS preflight
export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  })
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
// Convert flat questions array to categorized structure
// ========================================
function categorizeFlatQuestions(questions: any[]): {
  who: any[]
  what: any[]
  where: any[]
  when: any[]
  why: any[]
  how: any[]
} {
  const categorized = {
    who: [] as any[],
    what: [] as any[],
    where: [] as any[],
    when: [] as any[],
    why: [] as any[],
    how: [] as any[]
  }

  questions.forEach(q => {
    const category = q.category as keyof typeof categorized
    if (category in categorized) {
      categorized[category].push(q)
    }
  })

  return categorized
}

// ========================================
// Extract initial 5W1H questions from content
// ========================================
function extractInitialQuestions(analyses: any[], centralTopic: string): any[] {
  const questions: any[] = []

  // Extract from first analysis (primary source)
  if (analyses.length > 0) {
    const primary = analyses[0]
    const entities = JSON.parse(primary.entities as string || '{}')
    const fullText = (primary.extracted_text as string || '').toLowerCase()
    const summary = (primary.summary as string || '')

    // Helper function to search text for answer
    const searchForAnswer = (searchTerms: string[]): string => {
      for (const term of searchTerms) {
        const regex = new RegExp(`[^.]*${term.toLowerCase()}[^.]*\\.`, 'i')
        const match = fullText.match(regex)
        if (match) {
          return match[0].trim().substring(0, 300)
        }
      }
      return ''
    }

    // WHO questions - specific people
    if (entities.people && entities.people.length > 0) {
      const primaryPerson = entities.people[0]
      const peopleList = entities.people.slice(0, 5).map((p: any) => {
        if (p.description) {
          return `${p.name} (${p.description})`
        }
        return p.name
      }).join(', ')

      questions.push({
        id: 'who_1',
        category: 'who',
        question: `Who is ${primaryPerson.name}${primaryPerson.description ? ' (' + primaryPerson.description + ')' : ''} and what is their role?`,
        answer: primaryPerson.description || peopleList,
        priority: 5,
        source: 'Entity extraction',
        status: primaryPerson.description ? 'answered' : 'partial'
      })

      // Ask about other people if there are multiple
      if (entities.people.length > 1) {
        const otherPeople = entities.people.slice(1, 3).map((p: any) => p.name).join(' and ')
        questions.push({
          id: 'who_2',
          category: 'who',
          question: `Who are ${otherPeople} and what is their involvement?`,
          answer: searchForAnswer([otherPeople, entities.people[1].name]),
          priority: 4,
          source: fullText ? 'Text search' : 'Entity extraction',
          status: searchForAnswer([otherPeople, entities.people[1].name]) ? 'answered' : 'pending'
        })
      }
    }

    // WHAT questions - specific actions/events from summary
    if (summary) {
      // Extract first sentence or key phrase from summary
      const firstSentence = summary.split(/[.!?]/)[0].trim()
      questions.push({
        id: 'what_1',
        category: 'what',
        question: `What specifically happened: "${firstSentence}"?`,
        answer: summary.substring(0, 300),
        priority: 5,
        source: 'Content summary',
        status: 'answered'
      })
    }

    // Additional WHAT about organizations' actions
    if (entities.organizations && entities.organizations.length > 0) {
      const primaryOrg = entities.organizations[0].name
      const orgAction = searchForAnswer([primaryOrg, 'announced', 'stated', 'reported', 'confirmed'])
      questions.push({
        id: 'what_2',
        category: 'what',
        question: `What actions did ${primaryOrg} take or announce?`,
        answer: orgAction,
        priority: 4,
        source: orgAction ? 'Text search' : 'Requires investigation',
        status: orgAction ? 'answered' : 'pending'
      })
    }

    // WHERE questions - specific locations and their relevance
    if (entities.locations && entities.locations.length > 0) {
      const primaryLocation = entities.locations[0].name
      const locationContext = searchForAnswer([primaryLocation])

      questions.push({
        id: 'where_1',
        category: 'where',
        question: `Where in ${primaryLocation} did these events occur and what is the significance of this location?`,
        answer: locationContext,
        priority: 4,
        source: locationContext ? 'Text search' : 'Entity extraction',
        status: locationContext ? 'answered' : 'partial'
      })

      // If multiple locations, ask about relationship
      if (entities.locations.length > 1) {
        const secondLocation = entities.locations[1].name
        questions.push({
          id: 'where_2',
          category: 'where',
          question: `How are ${primaryLocation} and ${secondLocation} connected in these events?`,
          answer: searchForAnswer([primaryLocation, secondLocation, 'between', 'and']),
          priority: 3,
          source: 'Requires analysis',
          status: 'pending'
        })
      }
    }

    // WHEN questions - specific dates and timeline
    if (primary.publish_date && primary.publish_date !== primary.title) {
      questions.push({
        id: 'when_1',
        category: 'when',
        question: `When did these events occur? (Published: ${primary.publish_date})`,
        answer: primary.publish_date,
        priority: 4,
        source: 'Metadata',
        status: 'answered'
      })
    }

    // Look for specific dates in text
    const datePattern = /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{1,2},?\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2}/gi
    const dates = fullText.match(datePattern)
    if (dates && dates.length > 0) {
      questions.push({
        id: 'when_2',
        category: 'when',
        question: `What happened on ${dates[0]} and what is the timeline of events?`,
        answer: searchForAnswer([dates[0]]),
        priority: 3,
        source: fullText ? 'Text search' : 'Requires investigation',
        status: searchForAnswer([dates[0]]) ? 'answered' : 'pending'
      })
    }

    // WHY questions - specific motivations and causes
    if (entities.people && entities.people.length > 0) {
      const person = entities.people[0].name
      const whyAnswer = searchForAnswer([person, 'because', 'reason', 'due to', 'in order to'])
      questions.push({
        id: 'why_1',
        category: 'why',
        question: `Why is ${person} involved and what are their stated motivations or objectives?`,
        answer: whyAnswer,
        priority: 5,
        source: whyAnswer ? 'Text search' : 'Requires deeper analysis',
        status: whyAnswer ? 'partial' : 'pending'
      })
    }

    // WHY about the situation/conflict
    if (entities.organizations && entities.organizations.length > 0 || entities.locations && entities.locations.length > 0) {
      const subject = entities.organizations?.[0]?.name || entities.locations?.[0]?.name
      questions.push({
        id: 'why_2',
        category: 'why',
        question: `Why is ${subject} significant in this context and what are the underlying causes?`,
        answer: '',
        priority: 4,
        source: 'Requires context analysis',
        status: 'pending'
      })
    }

    // HOW questions - specific mechanisms and processes
    if (entities.people && entities.people.length > 0 && entities.organizations && entities.organizations.length > 0) {
      const person = entities.people[0].name
      const org = entities.organizations[0].name
      const howAnswer = searchForAnswer([person, org, 'through', 'by', 'using', 'via'])
      questions.push({
        id: 'how_1',
        category: 'how',
        question: `How is ${person} connected to ${org} and what mechanisms are involved?`,
        answer: howAnswer,
        priority: 4,
        source: howAnswer ? 'Text search' : 'Requires investigation',
        status: howAnswer ? 'partial' : 'pending'
      })
    }

    // HOW about the process or method
    if (summary.toLowerCase().includes('how') || summary.toLowerCase().includes('process') || summary.toLowerCase().includes('method')) {
      const howAnswer = searchForAnswer(['process', 'method', 'mechanism', 'approach', 'strategy'])
      questions.push({
        id: 'how_2',
        category: 'how',
        question: `How are these events unfolding and what are the specific methods or processes being used?`,
        answer: howAnswer,
        priority: 4,
        source: howAnswer ? 'Text search' : 'Requires investigation',
        status: howAnswer ? 'partial' : 'pending'
      })
    } else if (entities.organizations && entities.organizations.length > 0) {
      const org = entities.organizations[0].name
      questions.push({
        id: 'how_2',
        category: 'how',
        question: `How does ${org} operate or influence the situation described?`,
        answer: '',
        priority: 4,
        source: 'Requires context analysis',
        status: 'pending'
      })
    }
  }

  // If multiple sources, add comparative questions
  if (analyses.length > 1) {
    questions.push({
      id: 'what_multi',
      category: 'what',
      question: `What are the different perspectives or facts reported across the ${analyses.length} sources analyzed?`,
      priority: 3,
      source: 'Multi-source comparison needed',
      status: 'pending'
    })
  }

  return questions
}
