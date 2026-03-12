/**
 * Equilibrium Analysis API - List and Create
 *
 * GET  /api/equilibrium-analysis - List all analyses
 * POST /api/equilibrium-analysis - Create new analysis
 */

import type { PagesFunction } from '@cloudflare/workers-types'
import { getUserIdOrDefault } from './_shared/auth-helpers'

interface Env {
  DB: D1Database
  OPENAI_API_KEY: string
  SESSIONS?: KVNamespace
}

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash, X-Workspace-ID'
}

function generateId(): string {
  return `eq-${crypto.randomUUID().slice(0, 12)}`
}

// GET - List all equilibrium analyses
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  const url = new URL(request.url)

  try {
    const workspaceId = request.headers.get('X-Workspace-ID') || url.searchParams.get('workspace_id') || '1'

    const results = await env.DB.prepare(`
      SELECT
        ea.*,
        b.name as linked_behavior_title
      FROM equilibrium_analyses ea
      LEFT JOIN behaviors b ON ea.linked_behavior_id = b.id
      WHERE ea.workspace_id = ?
      ORDER BY ea.updated_at DESC
    `).bind(workspaceId).all()

    const analyses = results.results.map((row: any) => ({
      ...row,
      data_source: row.data_source ? JSON.parse(row.data_source) : null,
      variables: row.variables ? JSON.parse(row.variables) : null,
      equilibrium_analysis: row.equilibrium_analysis ? JSON.parse(row.equilibrium_analysis) : null,
      statistics: row.statistics ? JSON.parse(row.statistics) : null,
      tags: row.tags ? JSON.parse(row.tags) : [],
      // Don't return full time_series in list view
      time_series_count: row.time_series ? JSON.parse(row.time_series).length : 0
    }))

    return new Response(JSON.stringify({ analyses }), { headers: corsHeaders })
  } catch (error) {
    console.error('[Equilibrium API] List error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to list analyses'

    }), { status: 500, headers: corsHeaders })
  }
}

// POST - Create new equilibrium analysis
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  const url = new URL(request.url)

  try {
    const userId = await getUserIdOrDefault(request, env)
    const workspaceId = request.headers.get('X-Workspace-ID') || url.searchParams.get('workspace_id') || '1'
    const body = await request.json() as any

    if (!body.title) {
      return new Response(JSON.stringify({ error: 'Title is required' }), {
        status: 400,
        headers: corsHeaders
      })
    }

    const id = generateId()
    const now = new Date().toISOString()

    await env.DB.prepare(`
      INSERT INTO equilibrium_analyses (
        id, title, description, linked_behavior_id,
        data_source, time_series, variables,
        workspace_id, created_by, created_at, updated_at,
        is_public, tags
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      body.title,
      body.description || null,
      body.linked_behavior_id || null,
      body.data_source ? JSON.stringify(body.data_source) : null,
      body.time_series ? JSON.stringify(body.time_series) : '[]',
      body.variables ? JSON.stringify(body.variables) : null,
      workspaceId,
      userId,
      now,
      now,
      body.is_public ? 1 : 0,
      body.tags ? JSON.stringify(body.tags) : '[]'
    ).run()

    return new Response(JSON.stringify({ id, message: 'Analysis created' }), {
      status: 201,
      headers: corsHeaders
    })
  } catch (error) {
    console.error('[Equilibrium API] Create error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to create analysis'

    }), { status: 500, headers: corsHeaders })
  }
}

// OPTIONS - CORS preflight
export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: corsHeaders })
}
