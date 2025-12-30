/**
 * Framework Entity Usage API
 * Returns all frameworks where a specific entity is used
 */

interface Env {
  DB: D1Database
}

export async function onRequestGet(context: { request: Request; env: Env }) {
  const { request, env } = context

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  try {
    const url = new URL(request.url)
    const entityId = url.searchParams.get('entity_id')
    const entityType = url.searchParams.get('entity_type')

    if (!entityId || !entityType) {
      return new Response(JSON.stringify({ error: 'entity_id and entity_type required' }), {
        status: 400,
        headers: corsHeaders,
      })
    }

    const frameworks: any[] = []

    // Check COG analyses for linked actors
    if (entityType === 'ACTOR') {
      const cogActors = await env.DB.prepare(`
        SELECT DISTINCT
          fs.id,
          fs.framework_name,
          fs.title,
          fs.created_at,
          'cog' as type
        FROM framework_sessions fs
        WHERE fs.framework_name = 'cog'
          AND fs.status != 'deleted'
          AND (
            fs.framework_data LIKE ?
            OR fs.framework_data LIKE ?
          )
        ORDER BY fs.created_at DESC
      `).bind(`%"actor_id":"${entityId}"%`, `%"actor_name":"${entityId}"%`).all()

      frameworks.push(...cogActors.results.map((f: any) => ({
        id: f.id,
        type: 'cog',
        title: f.title || 'Untitled COG Analysis',
        role: 'Referenced Actor',
        created_at: f.created_at,
        url: `/dashboard/analysis-frameworks/cog/${f.id}`
      })))
    }

    // Check ACH analyses for linked evidence/actors
    // ACH doesn't directly link actors yet, but we can check if actor is mentioned in evidence
    const achAnalyses = await env.DB.prepare(`
      SELECT DISTINCT
        a.id,
        a.title,
        a.created_at,
        'ach' as type
      FROM ach_analyses a
      WHERE a.analysis_data LIKE ?
        OR a.title LIKE ?
      ORDER BY a.created_at DESC
      LIMIT 20
    `).bind(`%${entityId}%`, `%${entityId}%`).all()

    frameworks.push(...achAnalyses.results.map((f: any) => ({
      id: f.id,
      type: 'ach',
      title: f.title || 'Untitled ACH Analysis',
      role: 'Related Entity',
      created_at: f.created_at,
      url: `/dashboard/analysis-frameworks/ach-dashboard/${f.id}`
    })))

    // Sort by most recent
    frameworks.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    return new Response(JSON.stringify({ frameworks }), {
      status: 200,
      headers: corsHeaders,
    })

  } catch (error) {
    console.error('Entity usage lookup error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to look up entity usage',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: corsHeaders,
    })
  }
}
