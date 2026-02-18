import { getUserIdOrDefault } from '../_shared/auth-helpers'
import { callOpenAIViaGateway } from '../_shared/ai-gateway'

interface Env {
  DB: D1Database
  SESSIONS: KVNamespace
  OPENAI_API_KEY: string
  AI_GATEWAY_ACCOUNT_ID?: string
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  try {
    const userId = await getUserIdOrDefault(request, env)

    // Load all frameworks for this user
    const frameworks = await env.DB.prepare(`
      SELECT id, framework_type, title, data, status, created_at
      FROM framework_sessions
      WHERE user_id = ? AND status != 'archived'
      ORDER BY created_at DESC
      LIMIT 20
    `).bind(userId).all<{
      id: number; framework_type: string; title: string;
      data: string; status: string; created_at: string
    }>()

    const fwResults = frameworks.results || []
    if (fwResults.length === 0) {
      return new Response(JSON.stringify({
        key_findings: [],
        convergence_points: [],
        contradictions: [],
        overall_confidence: 0,
        confidence_breakdown: [],
        generated_at: new Date().toISOString(),
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Prepare framework summaries for LLM
    const frameworkSummaries = fwResults.map(fw => {
      let parsedData: any = {}
      try { parsedData = JSON.parse(fw.data || '{}') } catch { /* skip */ }

      return {
        id: fw.id,
        type: fw.framework_type,
        title: fw.title,
        status: fw.status,
        created_at: fw.created_at,
        data_summary: truncateForLLM(parsedData, fw.framework_type),
      }
    })

    const systemPrompt = `You are an intelligence analyst performing cross-framework synthesis. You are given structured analysis data from multiple analytical frameworks (ACH, COG, SWOT, Deception Detection, etc.) applied to the same subject.

Your job is to synthesize findings across frameworks to identify:
1. Key findings that emerge when combining insights from multiple frameworks
2. Convergence points where multiple frameworks agree
3. Contradictions where frameworks disagree or provide conflicting assessments
4. An overall confidence assessment

Respond ONLY with valid JSON matching this exact schema:
{
  "key_findings": [
    { "finding": "string", "supporting_frameworks": ["framework_type"], "confidence": 0-100, "evidence_count": 0 }
  ],
  "convergence_points": [
    { "description": "string", "frameworks": [{"type": "string", "session_id": "string", "element": "string"}], "strength": "strong|moderate|weak" }
  ],
  "contradictions": [
    { "description": "string", "side_a": {"framework_type": "string", "session_id": "string", "claim": "string"}, "side_b": {"framework_type": "string", "session_id": "string", "claim": "string"}, "severity": "INFO|WARNING|CRITICAL", "suggested_resolution": "string" }
  ],
  "overall_confidence": 0-100,
  "confidence_breakdown": [{ "framework_type": "string", "confidence": 0-100 }]
}`

    const userPrompt = `Analyze these ${frameworkSummaries.length} framework analyses and synthesize findings:

${JSON.stringify(frameworkSummaries, null, 2)}

Identify cross-framework patterns, agreements, contradictions, and provide an overall confidence assessment.`

    const response = await callOpenAIViaGateway(env, {
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3,
      max_completion_tokens: 4000,
      response_format: { type: 'json_object' }
    }, {
      cacheTTL: 300,
      metadata: { endpoint: 'intelligence-synthesis', user_id: String(userId) }
    })

    const content = response.choices?.[0]?.message?.content || '{}'
    let raw: any
    try {
      raw = JSON.parse(content)
    } catch {
      raw = {}
    }

    // Validate and extract only expected fields (never spread raw LLM output)
    const validated = {
      key_findings: Array.isArray(raw.key_findings) ? raw.key_findings : [],
      convergence_points: Array.isArray(raw.convergence_points) ? raw.convergence_points : [],
      contradictions: Array.isArray(raw.contradictions) ? raw.contradictions : [],
      overall_confidence: typeof raw.overall_confidence === 'number' ? raw.overall_confidence : 0,
      confidence_breakdown: Array.isArray(raw.confidence_breakdown) ? raw.confidence_breakdown : [],
      generated_at: new Date().toISOString(),
    }

    return new Response(JSON.stringify(validated), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Intelligence synthesis error:', error)
    return new Response(JSON.stringify({ error: 'Failed to generate synthesis' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

function truncateForLLM(data: any, frameworkType: string): any {
  const MAX_ITEMS = 10

  switch (frameworkType) {
    case 'ach':
      return {
        hypotheses: (data.hypotheses || []).slice(0, MAX_ITEMS).map((h: any) => ({
          name: h.name || h.title,
          score: h.score ?? h.likelihood,
          description: h.description?.substring(0, 200),
        })),
        evidence_count: (data.evidence || []).length,
      }
    case 'swot':
      return {
        strengths: (data.strengths || []).slice(0, MAX_ITEMS).map((s: any) => s.text || s.name || s),
        weaknesses: (data.weaknesses || []).slice(0, MAX_ITEMS).map((s: any) => s.text || s.name || s),
        opportunities: (data.opportunities || []).slice(0, MAX_ITEMS).map((s: any) => s.text || s.name || s),
        threats: (data.threats || []).slice(0, MAX_ITEMS).map((s: any) => s.text || s.name || s),
      }
    case 'cog':
      return {
        centers_of_gravity: (data.cogs || data.centers_of_gravity || []).slice(0, MAX_ITEMS).map((c: any) => ({
          name: c.name,
          actor_category: c.actor_category,
          capabilities: (c.capabilities || []).slice(0, 3),
          vulnerabilities: (c.vulnerabilities || []).slice(0, 3),
        })),
      }
    case 'deception':
      return {
        likelihood: data.deception_likelihood ?? data.likelihood,
        claims: (data.claims || []).slice(0, MAX_ITEMS).map((c: any) => ({
          claim: c.claim?.substring(0, 200),
          risk_level: c.risk_level,
        })),
        mom_summary: data.mom_summary,
      }
    default: {
      const str = JSON.stringify(data)
      if (str.length <= 500) return data
      return { summary: str.substring(0, 500) + '...' }
    }
  }
}
