// Cloudflare Pages Function for Evidence API
export async function onRequest(context: any) {
  const { request, env } = context

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
  }

  // Handle preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  try {
    const url = new URL(request.url)
    const evidenceId = url.searchParams.get('id')

    // GET - List evidence or get single evidence
    if (request.method === 'GET') {
      if (evidenceId) {
        // Get single evidence from D1
        const evidence = await env.DB.prepare(
          'SELECT * FROM evidence WHERE id = ?'
        ).bind(evidenceId).first()

        if (!evidence) {
          return new Response(JSON.stringify({ error: 'Evidence not found' }), {
            status: 404,
            headers: corsHeaders,
          })
        }

        // Parse JSON fields
        const parsedEvidence = {
          ...evidence,
          tags: JSON.parse(evidence.tags || '[]'),
          source: JSON.parse(evidence.source || '{}'),
          metadata: JSON.parse(evidence.metadata || '{}'),
          sats_evaluation: evidence.sats_evaluation ? JSON.parse(evidence.sats_evaluation) : null,
          frameworks: JSON.parse(evidence.frameworks || '[]'),
          attachments: JSON.parse(evidence.attachments || '[]'),
          key_points: JSON.parse(evidence.key_points || '[]'),
          contradictions: JSON.parse(evidence.contradictions || '[]'),
          corroborations: JSON.parse(evidence.corroborations || '[]'),
          implications: JSON.parse(evidence.implications || '[]'),
          previous_versions: JSON.parse(evidence.previous_versions || '[]'),
        }

        return new Response(JSON.stringify(parsedEvidence), {
          status: 200,
          headers: corsHeaders,
        })
      }

      // List all evidence with optional filters
      const type = url.searchParams.get('type')
      const status = url.searchParams.get('status')
      const limit = parseInt(url.searchParams.get('limit') || '50')

      let query = 'SELECT * FROM evidence WHERE 1=1'
      const params: any[] = []

      if (type) {
        query += ' AND type = ?'
        params.push(type)
      }
      if (status) {
        query += ' AND status = ?'
        params.push(status)
      }

      query += ' ORDER BY updated_at DESC LIMIT ?'
      params.push(limit)

      let stmt = env.DB.prepare(query)
      for (let i = 0; i < params.length; i++) {
        stmt = stmt.bind(params[i])
      }

      const results = await stmt.all()

      // Parse JSON fields for all results
      const parsedResults = results.results.map((evidence: any) => ({
        ...evidence,
        tags: JSON.parse(evidence.tags || '[]'),
        source: JSON.parse(evidence.source || '{}'),
        metadata: JSON.parse(evidence.metadata || '{}'),
        sats_evaluation: evidence.sats_evaluation ? JSON.parse(evidence.sats_evaluation) : null,
        frameworks: JSON.parse(evidence.frameworks || '[]'),
        attachments: JSON.parse(evidence.attachments || '[]'),
        key_points: JSON.parse(evidence.key_points || '[]'),
        contradictions: JSON.parse(evidence.contradictions || '[]'),
        corroborations: JSON.parse(evidence.corroborations || '[]'),
        implications: JSON.parse(evidence.implications || '[]'),
        previous_versions: JSON.parse(evidence.previous_versions || '[]'),
      }))

      return new Response(JSON.stringify({ evidence: parsedResults }), {
        status: 200,
        headers: corsHeaders,
      })
    }

    // POST - Create new evidence
    if (request.method === 'POST') {
      const body = await request.json()

      // Build source object from separate fields or existing source object
      const source = body.source || {
        type: body.source_type || body.type,
        name: body.source_name || '',
        url: body.source_url || null,
        credibility: body.credibility || '6',
        reliability: body.reliability || 'F'
      }

      const result = await env.DB.prepare(
        `INSERT INTO evidence (
          title, description, content, type, status, tags,
          source, metadata, sats_evaluation, frameworks, attachments,
          created_by, created_at, updated_at,
          key_points, contradictions, corroborations, implications,
          version, previous_versions
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), ?, ?, ?, ?, ?, ?)`
      ).bind(
        body.title,
        body.description || '',
        body.content || '',
        body.type,
        body.status || 'pending',
        typeof body.tags === 'string' ? body.tags : JSON.stringify(body.tags || []),
        JSON.stringify(source),
        JSON.stringify(body.metadata || {}),
        body.sats_evaluation ? JSON.stringify(body.sats_evaluation) : null,
        JSON.stringify(body.frameworks || []),
        JSON.stringify(body.attachments || []),
        body.created_by || 1,
        JSON.stringify(body.key_points || []),
        JSON.stringify(body.contradictions || []),
        JSON.stringify(body.corroborations || []),
        JSON.stringify(body.implications || []),
        body.version || 1,
        JSON.stringify(body.previous_versions || [])
      ).run()

      return new Response(JSON.stringify({
        id: result.meta.last_row_id,
        message: 'Evidence created successfully'
      }), {
        status: 201,
        headers: corsHeaders,
      })
    }

    // PUT - Update evidence
    if (request.method === 'PUT') {
      const body = await request.json()

      // Build source object from separate fields or existing source object
      const source = body.source || {
        type: body.source_type || body.type,
        name: body.source_name || '',
        url: body.source_url || null,
        credibility: body.credibility || '6',
        reliability: body.reliability || 'F'
      }

      await env.DB.prepare(
        `UPDATE evidence
         SET title = ?, description = ?, content = ?, type = ?, status = ?,
             tags = ?, source = ?, metadata = ?, sats_evaluation = ?,
             frameworks = ?, attachments = ?, updated_at = datetime('now'),
             updated_by = ?, key_points = ?, contradictions = ?,
             corroborations = ?, implications = ?, version = ?, previous_versions = ?
         WHERE id = ?`
      ).bind(
        body.title,
        body.description || '',
        body.content || '',
        body.type,
        body.status,
        typeof body.tags === 'string' ? body.tags : JSON.stringify(body.tags || []),
        JSON.stringify(source),
        JSON.stringify(body.metadata || {}),
        body.sats_evaluation ? JSON.stringify(body.sats_evaluation) : null,
        JSON.stringify(body.frameworks || []),
        JSON.stringify(body.attachments || []),
        body.updated_by || 1,
        JSON.stringify(body.key_points || []),
        JSON.stringify(body.contradictions || []),
        JSON.stringify(body.corroborations || []),
        JSON.stringify(body.implications || []),
        body.version || 1,
        JSON.stringify(body.previous_versions || []),
        evidenceId
      ).run()

      return new Response(JSON.stringify({ message: 'Evidence updated successfully' }), {
        status: 200,
        headers: corsHeaders,
      })
    }

    // DELETE - Delete evidence
    if (request.method === 'DELETE') {
      await env.DB.prepare(
        'DELETE FROM evidence WHERE id = ?'
      ).bind(evidenceId).run()

      return new Response(JSON.stringify({ message: 'Evidence deleted successfully' }), {
        status: 200,
        headers: corsHeaders,
      })
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: corsHeaders,
    })

  } catch (error: any) {
    console.error('Evidence API error:', error)
    // If table doesn't exist, return empty array for GET requests
    if (request.method === 'GET' && error.message?.includes('no such table')) {
      return new Response(JSON.stringify({ evidence: [] }), {
        status: 200,
        headers: corsHeaders,
      })
    }
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: corsHeaders,
    })
  }
}
