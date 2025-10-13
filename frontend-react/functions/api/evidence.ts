// Cloudflare Pages Function for Evidence API
export async function onRequest(context: any) {
  const { request, env } = context

  console.log('🔵 [EVIDENCE API] ========== REQUEST START ==========')
  console.log('🔵 [EVIDENCE API] Method:', request.method)
  console.log('🔵 [EVIDENCE API] URL:', request.url)
  console.log('🔵 [EVIDENCE API] Headers:', Object.fromEntries(request.headers))

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
  }

  // Handle preflight
  if (request.method === 'OPTIONS') {
    console.log('🔵 [EVIDENCE API] OPTIONS preflight - returning 204')
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  try {
    const url = new URL(request.url)
    const evidenceId = url.searchParams.get('id')
    console.log('🔵 [EVIDENCE API] Evidence ID from params:', evidenceId)

    // GET - List evidence or get single evidence
    if (request.method === 'GET') {
      console.log('🔵 [EVIDENCE API] GET request handler')
      if (evidenceId) {
        console.log('🔵 [EVIDENCE API] Fetching single evidence, ID:', evidenceId)
        // Get single evidence from D1
        const evidence = await env.DB.prepare(
          'SELECT * FROM evidence WHERE id = ?'
        ).bind(evidenceId).first()
        console.log('🔵 [EVIDENCE API] Single evidence result:', evidence ? 'Found' : 'Not found')

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
      console.log('🔵 [EVIDENCE API] Listing all evidence')
      const type = url.searchParams.get('type')
      const status = url.searchParams.get('status')
      const limit = parseInt(url.searchParams.get('limit') || '50')
      console.log('🔵 [EVIDENCE API] Filters - type:', type, 'status:', status, 'limit:', limit)

      let query = 'SELECT * FROM evidence WHERE 1=1'
      const params: any[] = []
      console.log('🔵 [EVIDENCE API] Base query:', query)

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

      console.log('🔵 [EVIDENCE API] Executing query with', params.length, 'params')
      const results = await stmt.all()
      console.log('🔵 [EVIDENCE API] Query returned', results.results?.length || 0, 'results')

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

      console.log('🔵 [EVIDENCE API] Returning', parsedResults.length, 'evidence items')
      return new Response(JSON.stringify({ evidence: parsedResults }), {
        status: 200,
        headers: corsHeaders,
      })
    }

    // POST - Create new evidence
    if (request.method === 'POST') {
      console.log('🔵 [EVIDENCE API] POST request - creating evidence')
      const body = await request.json()
      console.log('🔵 [EVIDENCE API] POST body:', JSON.stringify(body, null, 2))

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
    console.error('🔴 [EVIDENCE API] ========== ERROR ==========')
    console.error('🔴 [EVIDENCE API] Error:', error)
    console.error('🔴 [EVIDENCE API] Error message:', error.message)
    console.error('🔴 [EVIDENCE API] Error stack:', error.stack)
    console.error('🔴 [EVIDENCE API] Request method:', request.method)
    console.error('🔴 [EVIDENCE API] Request URL:', request.url)
    console.error('🔴 [EVIDENCE API] ========== ERROR END ==========')

    // If table doesn't exist, return empty array for GET requests
    if (request.method === 'GET' && error.message?.includes('no such table')) {
      return new Response(JSON.stringify({ evidence: [] }), {
        status: 200,
        headers: corsHeaders,
      })
    }
    return new Response(JSON.stringify({
      error: error.message,
      details: error.stack,
      method: request.method,
      url: request.url
    }), {
      status: 500,
      headers: corsHeaders,
    })
  }
}
