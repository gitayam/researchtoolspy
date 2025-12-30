/**
 * Auto-populate ACH from Content Intelligence Analysis
 * Creates ACH with hypotheses and evidence from analyzed content
 */

import { getUserIdOrDefault } from '../_shared/auth-helpers'

interface Env {
  DB: D1Database
  OPENAI_API_KEY: string
}

interface CreateFromContentRequest {
  analysis_id: number
  workspace_id?: string
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const data = await context.request.json() as CreateFromContentRequest
    const userId = await getUserIdOrDefault(context.request, context.env)
    const workspaceId = data.workspace_id || '1'

    if (!data.analysis_id) {
      return new Response(JSON.stringify({
        error: 'analysis_id is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Fetch content analysis
    const analysis = await context.env.DB.prepare(`
      SELECT * FROM content_analysis WHERE id = ? AND user_id = ?
    `).bind(data.analysis_id, userId).first()

    if (!analysis) {
      return new Response(JSON.stringify({
        error: 'Content analysis not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Generate question from content using GPT
    const questionPrompt = `Based on this content analysis, generate ONE intelligence question that would benefit from ACH (Analysis of Competing Hypotheses) methodology.

Title: ${analysis.title}
Summary: ${analysis.summary || 'N/A'}
Domain: ${analysis.domain}
Entities: ${analysis.entities ? Object.keys(JSON.parse(analysis.entities as string)).join(', ') : 'N/A'}

The question should:
1. Be specific and intelligence-relevant
2. Have multiple plausible answers (competing hypotheses)
3. Be answerable with evidence analysis

Return ONLY the question text, no other formatting.`

    const questionResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${context.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are an intelligence analyst creating ACH questions.' },
          { role: 'user', content: questionPrompt }
        ],
        temperature: 0.7,
        max_completion_tokens: 200
      })
    })

    const questionData = await questionResponse.json()
    const question = questionData.choices?.[0]?.message?.content?.trim() || `What are the key implications of: ${analysis.title}?`

    // Generate hypotheses from content
    const hypothesesPrompt = `Based on this content, generate 4-5 competing hypotheses for the question: "${question}"

Content Summary: ${analysis.summary || analysis.extracted_text?.substring(0, 500)}
Topics: ${analysis.topics ? JSON.parse(analysis.topics as string).map((t: any) => t.name).join(', ') : 'N/A'}
Entities: ${analysis.entities ? Object.keys(JSON.parse(analysis.entities as string)).join(', ') : 'N/A'}

Return ONLY a JSON array of hypothesis strings: ["hypothesis 1", "hypothesis 2", ...]`

    const hypothesesResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${context.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are an intelligence analyst using ACH methodology.' },
          { role: 'user', content: hypothesesPrompt }
        ],
        temperature: 0.7,
        max_completion_tokens: 600,
        response_format: { type: 'json_object' }
      })
    })

    const hypothesesData = await hypothesesResponse.json()
    const hypothesesContent = hypothesesData.choices?.[0]?.message?.content

    let hypotheses: string[]
    try {
      const parsed = JSON.parse(hypothesesContent)
      hypotheses = Array.isArray(parsed) ? parsed : (parsed.hypotheses || [])
    } catch (e) {
      // Fallback hypotheses
      hypotheses = [
        'Primary interpretation based on stated objectives',
        'Alternative strategic motivation',
        'Reactive response to external factors',
        'Deception or misdirection'
      ]
    }

    // Create ACH analysis
    const achId = crypto.randomUUID()
    const now = new Date().toISOString()

    await context.env.DB.prepare(`
      INSERT INTO ach_analyses (
        id, user_id, title, description, question, analyst, organization,
        scale_type, status, workspace_id, original_workspace_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      achId,
      userId,
      `ACH: ${analysis.title}`,
      `Auto-generated from Content Intelligence analysis #${analysis.id}`,
      question,
      null,
      null,
      'logarithmic',
      'draft',
      workspaceId,
      workspaceId,
      now,
      now
    ).run()

    // Create hypotheses
    for (let i = 0; i < hypotheses.length; i++) {
      const hypId = crypto.randomUUID()
      await context.env.DB.prepare(`
        INSERT INTO ach_hypotheses (
          id, ach_analysis_id, text, rationale, source, order_num, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        hypId,
        achId,
        hypotheses[i],
        'Generated from content analysis',
        'Content Intelligence + GPT-4o-mini',
        i,
        now
      ).run()
    }

    // Create evidence from content analysis
    const evidenceId = await createEvidenceFromContent(context.env.DB, analysis, userId)

    // Link evidence to ACH
    const linkId = crypto.randomUUID()
    await context.env.DB.prepare(`
      INSERT INTO ach_evidence_links (
        id, ach_analysis_id, evidence_id, created_at
      ) VALUES (?, ?, ?, ?)
    `).bind(linkId, achId, evidenceId, now).run()

    return new Response(JSON.stringify({
      ach_id: achId,
      question,
      hypotheses_count: hypotheses.length,
      evidence_id: evidenceId,
      source_analysis_id: analysis.id
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })
  } catch (error) {
    console.error('[ACH] Auto-population error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to create ACH from content intelligence',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

async function createEvidenceFromContent(db: D1Database, analysis: any, userId: string): Promise<string> {
  const evidenceId = crypto.randomUUID()
  const now = new Date().toISOString()

  // Calculate credibility from domain
  const credibilityMap: Record<string, number> = {
    'news': 3,
    'academic': 5,
    'government': 4,
    'social': 2,
    'blog': 2,
    'other': 3
  }
  const credibility = credibilityMap[analysis.domain as string] || 3

  await db.prepare(`
    INSERT INTO evidence (
      id, user_id, title, description, content, source, date,
      type, category, credibility_score, relevance_score,
      tags, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    evidenceId,
    userId,
    analysis.title || 'Untitled',
    analysis.summary || null,
    analysis.extracted_text?.substring(0, 2000) || null,
    analysis.url,
    analysis.publish_date || now,
    'document',
    'intelligence',
    credibility,
    5, // High relevance since it's the source content
    JSON.stringify([analysis.domain, 'content-intelligence', ...(analysis.is_social_media ? ['social-media'] : [])]),
    now,
    now
  ).run()

  return evidenceId
}

// CORS preflight
export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  })
}
