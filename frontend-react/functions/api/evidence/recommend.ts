/**
 * Evidence Recommendation API
 * Suggests relevant evidence when creating framework analyses
 */

interface Env {
  DB: D1Database
}

interface RecommendRequest {
  framework_type: 'ach' | 'cog' | 'swot' | 'pest' | 'dime' | 'comb' | 'other'
  context: {
    title?: string
    description?: string
    entities?: string[]  // Actor IDs or names
    keywords?: string[]
    timeframe?: { start: string; end: string }
  }
  workspace_id?: string
}

interface EvidenceRecommendation {
  id: number
  title: string
  description: string
  who: string
  what: string
  when_occurred: string
  where_location: string
  evidence_type: string
  evidence_level: string
  credibility: string
  reliability: string
  priority: string
  tags: string[]
  relevance_score: number
  match_reasons: string[]
  entity_match_count: number
  keyword_match_count: number
}

export async function onRequestPost(context: { request: Request; env: Env }) {
  const { request, env } = context

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  try {
    const body: RecommendRequest = await request.json()
    const { framework_type, context: ctx, workspace_id = '1' } = body

    const allEvidence: any[] = []
    const matchReasons = new Map<number, string[]>()

    // 1. Find evidence mentioning entities (if entities provided)
    if (ctx.entities && ctx.entities.length > 0) {
      try {
        // Try to find evidence linked via evidence_actors table
        const entityEvidence = await env.DB.prepare(`
          SELECT DISTINCT e.*, ea.relevance
          FROM evidence_items e
          LEFT JOIN evidence_actors ea ON e.id = ea.evidence_id
          WHERE ea.actor_id IN (${ctx.entities.map(() => '?').join(',')})
          LIMIT 20
        `).bind(...ctx.entities).all()

        allEvidence.push(...entityEvidence.results)

        entityEvidence.results.forEach((ev: any) => {
          if (!matchReasons.has(ev.id)) matchReasons.set(ev.id, [])
          matchReasons.get(ev.id)!.push('Mentions related actor')
        })
      } catch (error) {
        console.log('No evidence_actors table or error:', error)
      }

      // Also search in who/what/description fields
      for (const entityId of ctx.entities) {
        const textEvidence = await env.DB.prepare(`
          SELECT * FROM evidence_items
          WHERE (who LIKE ? OR what LIKE ? OR description LIKE ?)
          LIMIT 20
        `).bind(`%${entityId}%`, `%${entityId}%`, `%${entityId}%`).all()

        textEvidence.results.forEach((ev: any) => {
          if (!allEvidence.find(e => e.id === ev.id)) {
            allEvidence.push(ev)
          }
          if (!matchReasons.has(ev.id)) matchReasons.set(ev.id, [])
          matchReasons.get(ev.id)!.push('Text mentions entity')
        })
      }
    }

    // 2. Find evidence with keyword overlap (if keywords provided)
    if (ctx.keywords && ctx.keywords.length > 0) {
      for (const keyword of ctx.keywords.slice(0, 5)) { // Limit to 5 keywords
        const keywordEvidence = await env.DB.prepare(`
          SELECT * FROM evidence_items
          WHERE title LIKE ? OR description LIKE ? OR what LIKE ? OR tags LIKE ?
          LIMIT 15
        `).bind(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`).all()

        keywordEvidence.results.forEach((ev: any) => {
          if (!allEvidence.find(e => e.id === ev.id)) {
            allEvidence.push(ev)
          }
          if (!matchReasons.has(ev.id)) matchReasons.set(ev.id, [])
          matchReasons.get(ev.id)!.push(`Keyword: "${keyword}"`)
        })
      }
    }

    // 3. Find evidence from similar timeframe (if provided)
    if (ctx.timeframe) {
      try {
        const timeframeEvidence = await env.DB.prepare(`
          SELECT * FROM evidence_items
          WHERE when_occurred BETWEEN ? AND ?
          LIMIT 20
        `).bind(ctx.timeframe.start, ctx.timeframe.end).all()

        timeframeEvidence.results.forEach((ev: any) => {
          if (!allEvidence.find(e => e.id === ev.id)) {
            allEvidence.push(ev)
          }
          if (!matchReasons.has(ev.id)) matchReasons.set(ev.id, [])
          matchReasons.get(ev.id)!.push('Matching timeframe')
        })
      } catch (error) {
        console.log('Timeframe search error:', error)
      }
    }

    // 4. If we have title or description, search by text similarity
    const searchText = [ctx.title, ctx.description].filter(Boolean).join(' ')
    if (searchText) {
      const words = searchText.toLowerCase().split(/\s+/).filter(w => w.length > 3).slice(0, 10)

      for (const word of words) {
        const textEvidence = await env.DB.prepare(`
          SELECT * FROM evidence_items
          WHERE LOWER(title) LIKE ? OR LOWER(description) LIKE ? OR LOWER(what) LIKE ?
          LIMIT 10
        `).bind(`%${word}%`, `%${word}%`, `%${word}%`).all()

        textEvidence.results.forEach((ev: any) => {
          if (!allEvidence.find(e => e.id === ev.id)) {
            allEvidence.push(ev)
          }
          if (!matchReasons.has(ev.id)) matchReasons.set(ev.id, [])
          if (!matchReasons.get(ev.id)!.includes('Context match')) {
            matchReasons.get(ev.id)!.push('Context match')
          }
        })
      }
    }

    // 5. If still no results, get recent high-quality evidence
    if (allEvidence.length === 0) {
      const recentEvidence = await env.DB.prepare(`
        SELECT * FROM evidence_items
        WHERE status = 'verified'
        ORDER BY created_at DESC
        LIMIT 10
      `).all()

      allEvidence.push(...recentEvidence.results)

      recentEvidence.results.forEach((ev: any) => {
        if (!matchReasons.has(ev.id)) matchReasons.set(ev.id, [])
        matchReasons.get(ev.id)!.push('Recent verified evidence')
      })
    }

    // 6. Score and rank recommendations
    const recommendations: EvidenceRecommendation[] = allEvidence.map((ev: any) => {
      const relevanceScore = calculateRelevance(ev, ctx, matchReasons.get(ev.id) || [])

      return {
        id: ev.id,
        title: ev.title,
        description: ev.description || '',
        who: ev.who || '',
        what: ev.what || '',
        when_occurred: ev.when_occurred || '',
        where_location: ev.where_location || '',
        evidence_type: ev.evidence_type || '',
        evidence_level: ev.evidence_level || '',
        credibility: ev.credibility || '',
        reliability: ev.reliability || '',
        priority: ev.priority || '',
        tags: ev.tags ? JSON.parse(ev.tags) : [],
        relevance_score: relevanceScore,
        match_reasons: matchReasons.get(ev.id) || [],
        entity_match_count: (matchReasons.get(ev.id) || []).filter(r => r.includes('entity') || r.includes('actor')).length,
        keyword_match_count: (matchReasons.get(ev.id) || []).filter(r => r.includes('Keyword')).length,
      }
    })

    // Sort by relevance score and return top 20
    const sortedRecommendations = recommendations
      .sort((a, b) => b.relevance_score - a.relevance_score)
      .slice(0, 20)

    return new Response(JSON.stringify({
      recommendations: sortedRecommendations,
      total_found: allEvidence.length,
      breakdown: {
        entity_matches: sortedRecommendations.filter(r => r.entity_match_count > 0).length,
        keyword_matches: sortedRecommendations.filter(r => r.keyword_match_count > 0).length,
        high_relevance: sortedRecommendations.filter(r => r.relevance_score >= 70).length,
      }
    }), {
      status: 200,
      headers: corsHeaders,
    })

  } catch (error) {
    console.error('Evidence recommendation error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to generate evidence recommendations',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: corsHeaders,
    })
  }
}

function calculateRelevance(
  evidence: any,
  context: RecommendRequest['context'],
  matchReasons: string[]
): number {
  let score = 0

  // Entity mentions +30 points each
  const entityMatches = matchReasons.filter(r => r.includes('entity') || r.includes('actor')).length
  score += entityMatches * 30

  // Keyword overlap +10 points each
  const keywordMatches = matchReasons.filter(r => r.includes('Keyword')).length
  score += keywordMatches * 10

  // Timeframe match +15 points
  if (matchReasons.some(r => r.includes('timeframe'))) {
    score += 15
  }

  // Context/text match +5 points
  if (matchReasons.some(r => r.includes('Context'))) {
    score += 5
  }

  // Recent evidence bonus (up to +20 points)
  if (evidence.created_at) {
    try {
      const daysOld = (Date.now() - new Date(evidence.created_at).getTime()) / (1000 * 60 * 60 * 24)
      score += Math.max(0, Math.min(20, 20 - daysOld))
    } catch (e) {
      // Ignore date parse errors
    }
  }

  // High credibility +10 points
  const credibilityScore = parseCredibility(evidence.credibility)
  if (credibilityScore >= 4) {
    score += 10
  }

  // Verified status +15 points
  if (evidence.status === 'verified') {
    score += 15
  }

  // High priority +5 points
  if (evidence.priority === 'high' || evidence.priority === 'critical') {
    score += 5
  }

  return Math.min(score, 100) // Cap at 100
}

function parseCredibility(credibility: string): number {
  if (!credibility) return 3

  // Handle A-F scale
  const letterGrade = credibility.toUpperCase().charAt(0)
  const gradeMap: Record<string, number> = {
    'A': 5,
    'B': 4,
    'C': 3,
    'D': 2,
    'E': 1,
    'F': 0
  }

  if (letterGrade in gradeMap) {
    return gradeMap[letterGrade]
  }

  // Try parsing as number
  const num = parseInt(credibility)
  return isNaN(num) ? 3 : num
}
