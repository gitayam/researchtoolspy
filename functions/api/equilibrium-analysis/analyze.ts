/**
 * AI-Powered Equilibrium Analysis
 *
 * POST /api/equilibrium-analysis/analyze
 *
 * Uses GPT to detect equilibrium states from longitudinal data,
 * identify resistors/enablers, and calculate rate deltas.
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
  time_series: Array<{ timestamp: string; rate: number; group?: string }>
  variables: {
    time_column: string
    rate_column: string
    group_column?: string
  }
  behavior_context?: string
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

    if (!body.analysis_id || !body.time_series || body.time_series.length === 0) {
      return new Response(JSON.stringify({
        error: 'Missing required fields: analysis_id, time_series'
      }), { status: 400, headers: corsHeaders })
    }

    const timeSeries = body.time_series
    const rates = timeSeries.map(p => p.rate).filter(r => typeof r === 'number')

    if (rates.length < 3) {
      return new Response(JSON.stringify({
        error: 'Need at least 3 data points for equilibrium analysis'
      }), { status: 400, headers: corsHeaders })
    }

    // Calculate basic statistics
    const currentRate = rates[rates.length - 1]
    const maxRate = Math.max(...rates)
    const minRate = Math.min(...rates)
    const avgRate = rates.reduce((a, b) => a + b, 0) / rates.length

    // Format recent data for AI
    const recentData = timeSeries.slice(-20).map(p =>
      `${p.timestamp}: ${p.rate.toFixed(2)}${p.group ? ` (${p.group})` : ''}`
    ).join('\n')

    // Build AI prompt
    const prompt = `Analyze this longitudinal behavioral data to detect equilibrium states.

Data Summary:
- Variable: ${body.variables.rate_column}
- Time Range: ${timeSeries[0].timestamp} to ${timeSeries[timeSeries.length - 1].timestamp}
- Data Points: ${timeSeries.length}
- Current Rate: ${currentRate.toFixed(2)}
- Historical Max: ${maxRate.toFixed(2)}
- Historical Min: ${minRate.toFixed(2)}
- Average: ${avgRate.toFixed(2)}
${body.behavior_context ? `\nBehavior Context: ${body.behavior_context}` : ''}

Time Series (last 20 points):
${recentData}

Tasks:
1. Identify the EQUILIBRIUM RATE - the highest sustained rate where environmental resistors balanced enablers. Look for periods where the rate stabilized near a peak.
2. Identify the EQUILIBRIUM PERIOD - the start and end dates when the rate was stable at or near equilibrium.
3. Calculate the DELTA between current rate (${currentRate.toFixed(2)}) and equilibrium rate.
4. Determine the TREND - is behavior approaching equilibrium, at equilibrium, departing from equilibrium, or oscillating?
5. Assess STABILITY SCORE (0-100) - how stable is the current rate?
6. List 3-5 RESISTORS - environmental/social factors that likely prevent the rate from going higher.
7. List 3-5 ENABLERS - factors that could push the rate toward or past equilibrium.
8. Apply HAMILTON'S RULE concept: behavior spreads when rB > C is satisfied. What does this equilibrium suggest about the cost-benefit balance?

Return ONLY valid JSON with this exact structure:
{
  "equilibrium_rate": <number>,
  "equilibrium_period": {"start": "<date>", "end": "<date>"},
  "rate_delta": <number (current - equilibrium)>,
  "rate_delta_percent": <number (percentage)>,
  "trend": "<approaching|at_equilibrium|departing|oscillating>",
  "stability_score": <0-100>,
  "resistors": ["<resistor1>", "<resistor2>", ...],
  "enablers": ["<enabler1>", "<enabler2>", ...],
  "hamilton_interpretation": "<1-2 sentences on what this means for rB > C>",
  "ai_explanation": "<2-3 sentence summary of the equilibrium analysis>"
}`


    const aiResponse = await callOpenAIViaGateway(env, {
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert in behavioral economics, game theory, and evolutionary stable strategies. Analyze longitudinal data to detect equilibrium states and provide actionable insights. Always respond with valid JSON only, no markdown.'
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
      console.error('[Equilibrium AI] Failed to parse AI response:', parseError)
      return new Response(JSON.stringify({
        error: 'Failed to parse AI analysis',
        raw_response: aiResponse.choices[0]?.message?.content
      }), { status: 500, headers: corsHeaders })
    }

    // Update the analysis record with AI results
    const now = new Date().toISOString()
    await env.DB.prepare(`
      UPDATE equilibrium_analyses
      SET equilibrium_analysis = ?, updated_at = ?
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
    console.error('[Equilibrium AI] Error:', error)
    return new Response(JSON.stringify({
      error: 'Analysis failed'

    }), { status: 500, headers: corsHeaders })
  }
}

// OPTIONS - CORS preflight
export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: corsHeaders })
}
