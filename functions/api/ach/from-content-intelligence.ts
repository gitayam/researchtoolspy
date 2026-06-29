/**
 * Auto-populate ACH from Content Intelligence Analysis
 * Creates ACH with hypotheses and evidence from analyzed content
 */

import { getUserFromRequest } from '../_shared/auth-helpers'
import { JSON_HEADERS, optionsResponse, safeJsonParse } from '../_shared/api-utils'
import { callOpenAIViaGateway, ANALYST_SYSTEM_PREFIX, REFUSAL_BODY } from '../_shared/ai-gateway'

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
    const userId = await getUserFromRequest(context.request, context.env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: JSON_HEADERS,
      })
    }
    const workspaceId = data.workspace_id || context.request.headers.get('X-Workspace-ID') || null

    if (!data.analysis_id) {
      return new Response(JSON.stringify({
        error: 'analysis_id is required'
      }), {
        status: 400,
        headers: JSON_HEADERS
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
        headers: JSON_HEADERS
      })
    }

    // Generate question from content using GPT
    const questionPrompt = `Based on this content analysis, generate ONE intelligence question that would benefit from ACH (Analysis of Competing Hypotheses) methodology.

Title: ${analysis.title}
Summary: ${analysis.summary || 'N/A'}
Domain: ${analysis.domain}
Entities: ${analysis.entities ? Object.keys(safeJsonParse(analysis.entities, {})).join(', ') : 'N/A'}

The question should:
1. Be specific and intelligence-relevant
2. Have multiple plausible answers (competing hypotheses)
3. Be answerable with evidence analysis

Return ONLY the question text, no other formatting.`

    const questionData = await callOpenAIViaGateway(context.env, {
      model: 'gpt-5.4-mini',
      messages: [
        { role: 'system', content: `${ANALYST_SYSTEM_PREFIX}You are an intelligence analyst creating ACH questions.` },
        { role: 'user', content: questionPrompt }
      ],
      reasoning_effort: 'none',
      temperature: 0.7,
      max_completion_tokens: 200
    }, { metadata: { endpoint: 'ach/from-content-intelligence' }, cacheTTL: 3600 })

    if (questionData?._refusal) {
      return new Response(JSON.stringify(REFUSAL_BODY), { status: 200, headers: JSON_HEADERS })
    }

    const question = questionData.choices?.[0]?.message?.content?.trim() || `What are the key implications of: ${analysis.title}?`

    // Generate hypotheses from content
    const hypothesesPrompt = `Based on this content, generate 4-5 competing hypotheses for the question: "${question}"

Content Summary: ${analysis.summary || analysis.extracted_text?.substring(0, 500)}
Topics: ${analysis.topics ? safeJsonParse(analysis.topics, []).map((t: any) => t.name).join(', ') || 'N/A' : 'N/A'}
Entities: ${analysis.entities ? Object.keys(safeJsonParse(analysis.entities, {})).join(', ') || 'N/A' : 'N/A'}

Return ONLY a JSON array of hypothesis strings: ["hypothesis 1", "hypothesis 2", ...]`

    const hypothesesData = await callOpenAIViaGateway(context.env, {
      model: 'gpt-5.4-mini',
      messages: [
        { role: 'system', content: `${ANALYST_SYSTEM_PREFIX}You are an intelligence analyst using ACH methodology.` },
        { role: 'user', content: hypothesesPrompt }
      ],
      reasoning_effort: 'none',
      temperature: 0.7,
      max_completion_tokens: 600,
      response_format: { type: 'json_object' }
    }, { metadata: { endpoint: 'ach/from-content-intelligence' }, cacheTTL: 3600 })

    if (hypothesesData?._refusal) {
      return new Response(JSON.stringify(REFUSAL_BODY), { status: 200, headers: JSON_HEADERS })
    }

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
        'Content Intelligence + GPT-5.4-mini',
        i,
        now
      ).run()
    }

    // Create evidence from content analysis
    const evidenceId = await createEvidenceFromContent(context.env.DB, analysis, userId, workspaceId)

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
      headers: JSON_HEADERS
    })
  } catch (error) {
    console.error('[ACH] Auto-population error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to create ACH from content intelligence'

    }), {
      status: 500,
      headers: JSON_HEADERS
    })
  }
}

/**
 * Map a domain string to a credibility value on the Admiralty 1–6 scale
 * (1 = most credible, 6 = least credible). Returns a string because the
 * canonical `evidence_items.credibility` column is TEXT.
 */
function credibilityForDomain(domain: unknown): string {
  const credibilityMap: Record<string, string> = {
    academic: '2',
    government: '2',
    news: '3',
    blog: '4',
    social: '5',
    other: '4',
  }
  return credibilityMap[domain as string] || '4'
}

/**
 * Convert a 0–1 credibility/confidence float into a credibility value on the
 * Admiralty 1–6 scale (1 = most credible, 6 = least credible) as a TEXT string
 * to match the `evidence_items.credibility` column.
 *
 * Mapping: round(6 - score*5), clamped to 1..6. So 1.0 -> '1' (most credible),
 * 0.0 -> '6' (least credible), 0.5 -> '4'. Non-finite / non-number input returns
 * `undefined` so the caller can fall back to a domain-derived value or omit it.
 *
 * Pure + exported for unit testing (tests/e2e/smoke/de8-evidence-mapping.spec.ts).
 */
export function credibilityScoreToAdmiralty(score: unknown): string | undefined {
  if (typeof score !== 'number' || !Number.isFinite(score)) return undefined
  const clamped = Math.min(1, Math.max(0, score))
  const admiralty = Math.round(6 - clamped * 5)
  return String(Math.min(6, Math.max(1, admiralty)))
}

async function createEvidenceFromContent(
  db: D1Database,
  analysis: any,
  userId: number,
  workspaceId: string | null
): Promise<string> {
  const now = new Date().toISOString()

  // Credibility on the Admiralty 1–6 scale (TEXT). Prefer an explicit 0–1
  // content-credibility score if present, else derive from the source domain.
  const credibility =
    credibilityScoreToAdmiralty(analysis.credibility_score) ?? credibilityForDomain(analysis.domain)

  const contentExcerpt = analysis.extracted_text?.substring(0, 2000) || null
  // description is NOT NULL — coalesce summary -> title -> ''
  const description = analysis.summary || analysis.title || ''
  const tags = [
    analysis.domain,
    'content-intelligence',
    ...(analysis.is_social_media ? ['social-media'] : []),
  ].filter(Boolean)

  // Fields with no canonical column of their own are stashed in `metadata`
  // (migration 110) rather than dropped, preserving provenance.
  const metadata = JSON.stringify({
    source: analysis.url ?? null,
    date: analysis.publish_date ?? null,
    category: 'intelligence',
    relevance_score: 1, // highest relevance — this is the source content
    raw_credibility_score: typeof analysis.credibility_score === 'number' ? analysis.credibility_score : null,
    source_analysis_id: analysis.id ?? null,
    domain: analysis.domain ?? null,
  })

  // evidence_items PK is INTEGER AUTOINCREMENT — capture it via last_row_id and
  // stringify for the TEXT ach_evidence_links.evidence_id column (mirrors ach/evidence.ts).
  const result = await db.prepare(`
    INSERT INTO evidence_items (
      title, description, summary, what_happened, when_occurred,
      source_url, evidence_type, category,
      credibility, reliability, confidence_level,
      tags, status, metadata,
      created_by, workspace_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    analysis.title || 'Untitled',
    description,
    analysis.summary || null,
    contentExcerpt,
    analysis.publish_date || now,
    analysis.url || null,
    'document', // evidence_type — NOT NULL
    'intelligence',
    credibility, // NOT NULL (TEXT '1'-'6')
    'unknown', // reliability — NOT NULL (A-F); unknown for auto-generated content
    'medium', // confidence_level
    JSON.stringify(tags),
    'verified', // surfaced into ACH as a usable source
    metadata,
    userId, // created_by (INTEGER) — NOT user_id
    workspaceId,
    now,
    now
  ).run()

  return String(result.meta.last_row_id)
}

// Reject GET requests (POST-only endpoint)
export const onRequestGet: PagesFunction = async () => {
  return new Response(JSON.stringify({ error: 'Method not allowed. Use POST.' }), {
    status: 405, headers: JSON_HEADERS,
  })
}

// CORS preflight
export const onRequestOptions: PagesFunction = async () => {
  return optionsResponse()
}
