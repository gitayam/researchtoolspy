// Cloudflare Pages Function for Dataset API
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
    const datasetId = url.searchParams.get('id')

    // GET - List dataset or get single dataset
    if (request.method === 'GET') {
      if (datasetId) {
        // Get single dataset from D1
        const dataset = await env.DB.prepare(
          'SELECT * FROM datasets WHERE id = ?'
        ).bind(datasetId).first()

        if (!dataset) {
          return new Response(JSON.stringify({ error: 'Dataset not found' }), {
            status: 404,
            headers: corsHeaders,
          })
        }

        // Parse JSON fields
        const parsedDataset = {
          ...dataset,
          tags: JSON.parse(dataset.tags || '[]'),
          source: JSON.parse(dataset.source || '{}'),
          metadata: JSON.parse(dataset.metadata || '{}'),
          sats_evaluation: dataset.sats_evaluation ? JSON.parse(dataset.sats_evaluation) : null,
          frameworks: JSON.parse(dataset.frameworks || '[]'),
          attachments: JSON.parse(dataset.attachments || '[]'),
          key_points: JSON.parse(dataset.key_points || '[]'),
          contradictions: JSON.parse(dataset.contradictions || '[]'),
          corroborations: JSON.parse(dataset.corroborations || '[]'),
          implications: JSON.parse(dataset.implications || '[]'),
          previous_versions: JSON.parse(dataset.previous_versions || '[]'),
        }

        return new Response(JSON.stringify(parsedDataset), {
          status: 200,
          headers: corsHeaders,
        })
      }

      // List all dataset with optional filters
      const type = url.searchParams.get('type')
      const status = url.searchParams.get('status')
      const limit = parseInt(url.searchParams.get('limit') || '50')

      let query = 'SELECT * FROM datasets WHERE 1=1'
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
      const parsedResults = results.results.map((dataset: any) => ({
        ...dataset,
        tags: JSON.parse(dataset.tags || '[]'),
        source: JSON.parse(dataset.source || '{}'),
        metadata: JSON.parse(dataset.metadata || '{}'),
        sats_evaluation: dataset.sats_evaluation ? JSON.parse(dataset.sats_evaluation) : null,
        frameworks: JSON.parse(dataset.frameworks || '[]'),
        attachments: JSON.parse(dataset.attachments || '[]'),
        key_points: JSON.parse(dataset.key_points || '[]'),
        contradictions: JSON.parse(dataset.contradictions || '[]'),
        corroborations: JSON.parse(dataset.corroborations || '[]'),
        implications: JSON.parse(dataset.implications || '[]'),
        previous_versions: JSON.parse(dataset.previous_versions || '[]'),
      }))

      return new Response(JSON.stringify({ dataset: parsedResults }), {
        status: 200,
        headers: corsHeaders,
      })
    }

    // POST - Create new dataset
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
        `INSERT INTO datasets (
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
        message: 'Dataset created successfully'
      }), {
        status: 201,
        headers: corsHeaders,
      })
    }

    // PUT - Update dataset
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
        `UPDATE datasets
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
        datasetId
      ).run()

      return new Response(JSON.stringify({ message: 'Dataset updated successfully' }), {
        status: 200,
        headers: corsHeaders,
      })
    }

    // DELETE - Delete dataset
    if (request.method === 'DELETE') {
      await env.DB.prepare(
        'DELETE FROM datasets WHERE id = ?'
      ).bind(datasetId).run()

      return new Response(JSON.stringify({ message: 'Dataset deleted successfully' }), {
        status: 200,
        headers: corsHeaders,
      })
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: corsHeaders,
    })

  } catch (error: any) {
    console.error('Dataset API error:', error)
    // If table doesn't exist, return empty array for GET requests
    if (request.method === 'GET' && error.message?.includes('no such table')) {
      return new Response(JSON.stringify({ dataset: [] }), {
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
