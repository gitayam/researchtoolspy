/**
 * AI-Powered Hamilton Rule Network Analysis
 *
 * POST /api/hamilton-rule/analyze
 *
 * Uses GPT to analyze a network of relationships and predict
 * cooperation/defection outcomes based on Hamilton's Rule.
 */

import type { PagesFunction } from '@cloudflare/workers-types'
import { getUserFromRequest } from '../_shared/auth-helpers'
import { callOpenAIViaGateway } from '../_shared/ai-gateway'

interface Env {
  DB: D1Database
  OPENAI_API_KEY: string
  AI_GATEWAY_ACCOUNT_ID?: string
}

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash, X-Workspace-ID'
}

interface AnalyzeRequest {
  analysis_id: string
  behavior_description: string
  actors: Array<{
    id: string
    name: string
    type: string
    role?: string
  }>
  relationships: Array<{
    id: string
    actor_id: string
    recipient_id: string
    relatedness: number
    benefit: number
    cost: number
    hamilton_score: number
    passes_rule: boolean
    behavior_description?: string
  }>
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  try {
    const authUserId = await getUserFromRequest(request, env)
    if (!authUserId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: corsHeaders,
      })
    }

    const body = await request.json() as AnalyzeRequest

    if (!body.analysis_id || !body.relationships || body.relationships.length === 0) {
      return new Response(JSON.stringify({
        error: 'Missing required fields: analysis_id, relationships'
      }), { status: 400, headers: corsHeaders })
    }

    // Build actor name map
    const actorMap = new Map(body.actors.map(a => [a.id, a]))

    // Format relationships for AI
    const relationshipsText = body.relationships.map(rel => {
      const actor = actorMap.get(rel.actor_id)
      const recipient = actorMap.get(rel.recipient_id)
      return `- ${actor?.name || rel.actor_id} → ${recipient?.name || rel.recipient_id}: r=${rel.relatedness.toFixed(2)}, B=${rel.benefit}, C=${rel.cost}, Score=${rel.hamilton_score.toFixed(2)} (${rel.passes_rule ? 'COOPERATE' : 'DEFECT'})${rel.behavior_description ? ` [${rel.behavior_description}]` : ''}`
    }).join('\n')

    // Format actors list
    const actorsText = body.actors.map(a =>
      `- ${a.name} (${a.type})${a.role ? `: ${a.role}` : ''}`
    ).join('\n')

    // Calculate summary stats
    const cooperators = body.relationships.filter(r => r.passes_rule).length
    const defectors = body.relationships.length - cooperators
    const avgScore = body.relationships.reduce((sum, r) => sum + r.hamilton_score, 0) / body.relationships.length

    // Build AI prompt
    const prompt = `Analyze this network of relationships for cooperation/defection predictions using Hamilton's Rule.

Behavior Being Analyzed: ${body.behavior_description || 'General cooperation'}

HAMILTON'S RULE: A behavior is evolutionarily favored when rB > C
- r = relatedness (social/genetic closeness, 0-1)
- B = benefit to recipient
- C = cost to actor
- Score = rB - C (positive = cooperate, negative = defect)

ACTORS (${body.actors.length}):
${actorsText}

RELATIONSHIPS (${body.relationships.length}):
${relationshipsText}

SUMMARY:
- Predicted Cooperators: ${cooperators}
- Predicted Defectors: ${defectors}
- Average Hamilton Score: ${avgScore.toFixed(2)}

ANALYSIS TASKS:
1. COOPERATION LIKELIHOOD (0-100): Overall probability the network maintains cooperation
2. KEY DRIVERS: Which 2-3 relationships most strongly influence network dynamics?
3. VULNERABILITIES: What could disrupt the current cooperation pattern?
4. RECOMMENDATIONS: What interventions could increase cooperation?
5. SPITE RISK: Is there potential for spiteful behavior (harming others at cost to self)?
6. STABILITY: Will this network remain stable, transition, or collapse?

Consider:
- Kin competition effects (local competition can negate cooperation benefits)
- Scale of competition (population vs local)
- Transitivity (if A cooperates with B, and B with C, what about A-C?)

Return ONLY valid JSON with this exact structure:
{
  "cooperation_likelihood": <0-100>,
  "key_drivers": ["<relationship description>", ...],
  "vulnerabilities": ["<vulnerability>", ...],
  "recommendations": ["<recommendation>", ...],
  "spite_risk": "<low|medium|high>: <brief explanation>",
  "kin_competition_factor": <0-1 scale of how much local competition affects outcomes>,
  "stability": "<stable|transitional|unstable>",
  "summary": "<2-3 sentence analysis summary>"
}`


    const aiResponse = await callOpenAIViaGateway(env, {
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert in evolutionary game theory, Hamilton\'s Rule, and kin selection. Analyze relationship networks to predict cooperation and defection patterns. Always respond with valid JSON only, no markdown.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 1500
    })

    // Parse AI response
    let analysisResult: any
    try {
      const content = aiResponse.choices[0]?.message?.content || ''
      // Remove any markdown code fences if present
      const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      analysisResult = JSON.parse(cleanContent)
    } catch (parseError) {
      console.error('[Hamilton AI] Failed to parse AI response:', parseError)
      return new Response(JSON.stringify({
        error: 'Failed to parse AI analysis',
        raw_response: aiResponse.choices[0]?.message?.content
      }), { status: 500, headers: corsHeaders })
    }

    // Update the analysis record with AI results
    const now = new Date().toISOString()
    await env.DB.prepare(`
      UPDATE hamilton_rule_analyses
      SET ai_analysis = ?, updated_at = ?
      WHERE id = ?
    `).bind(
      JSON.stringify(analysisResult),
      now,
      body.analysis_id
    ).run()

    return new Response(JSON.stringify({
      success: true,
      analysis: analysisResult
    }), { headers: corsHeaders })

  } catch (error) {
    console.error('[Hamilton AI] Error:', error)
    return new Response(JSON.stringify({
      error: 'Analysis failed'

    }), { status: 500, headers: corsHeaders })
  }
}

// OPTIONS - CORS preflight
export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: corsHeaders })
}
