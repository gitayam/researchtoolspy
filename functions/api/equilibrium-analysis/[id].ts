/**
 * Equilibrium Analysis API - Single Item Operations
 *
 * GET    /api/equilibrium-analysis/:id - Get single analysis
 * PUT    /api/equilibrium-analysis/:id - Update analysis
 * DELETE /api/equilibrium-analysis/:id - Delete analysis
 */

import type { PagesFunction } from '@cloudflare/workers-types'
import { getUserIdOrDefault, getUserFromRequest } from '../_shared/auth-helpers'

interface Env {
  DB: D1Database
  OPENAI_API_KEY: string
  SESSIONS?: KVNamespace
}

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash, X-Workspace-ID'
}

// GET - Get single equilibrium analysis
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params } = context
  const id = params.id as string

  try {
    const result = await env.DB.prepare(`
      SELECT
        ea.*,
        b.name as linked_behavior_title
      FROM equilibrium_analyses ea
      LEFT JOIN behaviors b ON ea.linked_behavior_id = b.id
      WHERE ea.id = ?
    `).bind(id).first()

    if (!result) {
      return new Response(JSON.stringify({ error: 'Analysis not found' }), {
        status: 404,
        headers: corsHeaders
      })
    }

    const analysis = {
      ...result,
      data_source: result.data_source ? JSON.parse(result.data_source as string) : null,
      time_series: result.time_series ? JSON.parse(result.time_series as string) : [],
      variables: result.variables ? JSON.parse(result.variables as string) : null,
      equilibrium_analysis: result.equilibrium_analysis ? JSON.parse(result.equilibrium_analysis as string) : null,
      statistics: result.statistics ? JSON.parse(result.statistics as string) : null,
      tags: result.tags ? JSON.parse(result.tags as string) : []
    }

    return new Response(JSON.stringify({ analysis }), { headers: corsHeaders })
  } catch (error) {
    console.error('[Equilibrium API] Get error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to get analysis'

    }), { status: 500, headers: corsHeaders })
  }
}

// PUT - Update equilibrium analysis
export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const id = params.id as string

  try {
    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: { 'Content-Type': 'application/json' },
      })
    }

    const body = await request.json() as any
    const now = new Date().toISOString()

    // Build dynamic update query
    const updates: string[] = ['updated_at = ?']
    const values: any[] = [now]

    if (body.title !== undefined) {
      updates.push('title = ?')
      values.push(body.title)
    }
    if (body.description !== undefined) {
      updates.push('description = ?')
      values.push(body.description)
    }
    if (body.linked_behavior_id !== undefined) {
      updates.push('linked_behavior_id = ?')
      values.push(body.linked_behavior_id)
    }
    if (body.data_source !== undefined) {
      updates.push('data_source = ?')
      values.push(JSON.stringify(body.data_source))
    }
    if (body.time_series !== undefined) {
      updates.push('time_series = ?')
      values.push(JSON.stringify(body.time_series))

      // Auto-calculate statistics when time_series is updated
      if (body.time_series && body.time_series.length > 0) {
        const stats = calculateStatistics(body.time_series)
        updates.push('statistics = ?')
        values.push(JSON.stringify(stats))
      }
    }
    if (body.variables !== undefined) {
      updates.push('variables = ?')
      values.push(JSON.stringify(body.variables))
    }
    if (body.equilibrium_analysis !== undefined) {
      updates.push('equilibrium_analysis = ?')
      values.push(JSON.stringify(body.equilibrium_analysis))
    }
    if (body.statistics !== undefined) {
      updates.push('statistics = ?')
      values.push(JSON.stringify(body.statistics))
    }
    if (body.is_public !== undefined) {
      updates.push('is_public = ?')
      values.push(body.is_public ? 1 : 0)
    }
    if (body.tags !== undefined) {
      updates.push('tags = ?')
      values.push(JSON.stringify(body.tags))
    }

    values.push(id)

    await env.DB.prepare(`
      UPDATE equilibrium_analyses
      SET ${updates.join(', ')}
      WHERE id = ?
    `).bind(...values).run()

    return new Response(JSON.stringify({ message: 'Analysis updated' }), { headers: corsHeaders })
  } catch (error) {
    console.error('[Equilibrium API] Update error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to update analysis'

    }), { status: 500, headers: corsHeaders })
  }
}

// DELETE - Delete equilibrium analysis
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const id = params.id as string

  try {
    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: { 'Content-Type': 'application/json' },
      })
    }

    await env.DB.prepare(`
      DELETE FROM equilibrium_analyses WHERE id = ?
    `).bind(id).run()

    return new Response(JSON.stringify({ message: 'Analysis deleted' }), { headers: corsHeaders })
  } catch (error) {
    console.error('[Equilibrium API] Delete error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to delete analysis'

    }), { status: 500, headers: corsHeaders })
  }
}

// OPTIONS - CORS preflight
export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: corsHeaders })
}

/**
 * Calculate basic statistics from time series data
 */
function calculateStatistics(timeSeries: Array<{ timestamp: string; rate: number }>): any {
  if (!timeSeries || timeSeries.length === 0) {
    return null
  }

  const rates = timeSeries.map(p => p.rate).filter(r => typeof r === 'number' && !isNaN(r))
  if (rates.length === 0) return null

  const n = rates.length
  const sum = rates.reduce((a, b) => a + b, 0)
  const mean = sum / n

  // Sort for median
  const sorted = [...rates].sort((a, b) => a - b)
  const median = n % 2 === 0
    ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
    : sorted[Math.floor(n / 2)]

  // Variance and std deviation
  const squaredDiffs = rates.map(r => Math.pow(r - mean, 2))
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / n
  const std_deviation = Math.sqrt(variance)

  // Linear regression for trend coefficient
  const xMean = (n - 1) / 2
  let numerator = 0
  let denominator = 0
  for (let i = 0; i < n; i++) {
    numerator += (i - xMean) * (rates[i] - mean)
    denominator += Math.pow(i - xMean, 2)
  }
  const trend_coefficient = denominator !== 0 ? numerator / denominator : 0

  // R-squared
  const predictedRates = rates.map((_, i) => mean + trend_coefficient * (i - xMean))
  const ssRes = rates.reduce((sum, r, i) => sum + Math.pow(r - predictedRates[i], 2), 0)
  const ssTot = rates.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0)
  const r_squared = ssTot !== 0 ? 1 - (ssRes / ssTot) : 0

  // Time span
  let time_span_days: number | undefined
  if (timeSeries.length >= 2) {
    const first = new Date(timeSeries[0].timestamp)
    const last = new Date(timeSeries[timeSeries.length - 1].timestamp)
    time_span_days = Math.round((last.getTime() - first.getTime()) / (1000 * 60 * 60 * 24))
  }

  return {
    mean: Math.round(mean * 1000) / 1000,
    median: Math.round(median * 1000) / 1000,
    std_deviation: Math.round(std_deviation * 1000) / 1000,
    variance: Math.round(variance * 1000) / 1000,
    min: Math.min(...rates),
    max: Math.max(...rates),
    trend_coefficient: Math.round(trend_coefficient * 10000) / 10000,
    r_squared: Math.round(r_squared * 1000) / 1000,
    data_points: n,
    time_span_days
  }
}
