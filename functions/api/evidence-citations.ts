// Cloudflare Pages Function for Evidence Citations API
export async function onRequest(context: any) {
  const { request, env } = context

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
  }

  // Handle preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  try {
    const url = new URL(request.url)
    const evidenceId = url.searchParams.get('evidence_id')
    const datasetId = url.searchParams.get('dataset_id')

    // GET - Get citations for evidence or dataset
    if (request.method === 'GET') {
      if (evidenceId) {
        // Get all citations for an evidence item
        const citations = await env.DB.prepare(`
          SELECT
            ec.*,
            d.id as dataset_id,
            d.title as dataset_title,
            d.description as dataset_description,
            d.type as dataset_type,
            d.source as dataset_source
          FROM evidence_citations ec
          JOIN datasets d ON ec.dataset_id = d.id
          WHERE ec.evidence_id = ?
          ORDER BY ec.relevance_score DESC
        `).bind(evidenceId).all()

        const parsedCitations = citations.results.map((c: any) => ({
          ...c,
          dataset: {
            id: c.dataset_id,
            title: c.dataset_title,
            description: c.dataset_description,
            type: c.dataset_type,
            source: JSON.parse(c.dataset_source || '{}'),
          }
        }))

        return new Response(JSON.stringify({ citations: parsedCitations }), {
          status: 200,
          headers: corsHeaders,
        })
      } else if (datasetId) {
        // Get all evidence items that cite this dataset
        const citations = await env.DB.prepare(`
          SELECT
            ec.*,
            e.id as evidence_id,
            e.title as evidence_title,
            e.evidence_type,
            e.evidence_level,
            e.status
          FROM evidence_citations ec
          JOIN evidence_items e ON ec.evidence_id = e.id
          WHERE ec.dataset_id = ?
          ORDER BY ec.created_at DESC
        `).bind(datasetId).all()

        return new Response(JSON.stringify({ citations: citations.results }), {
          status: 200,
          headers: corsHeaders,
        })
      }

      return new Response(JSON.stringify({ error: 'evidence_id or dataset_id required' }), {
        status: 400,
        headers: corsHeaders,
      })
    }

    // POST - Create citation(s)
    if (request.method === 'POST') {
      const body = await request.json()

      if (!body.evidence_id || !body.dataset_ids || !Array.isArray(body.dataset_ids)) {
        return new Response(JSON.stringify({
          error: 'evidence_id and dataset_ids (array) are required'
        }), {
          status: 400,
          headers: corsHeaders,
        })
      }

      // Create citations for each dataset
      const results = []
      for (const datasetId of body.dataset_ids) {
        try {
          const result = await env.DB.prepare(`
            INSERT OR REPLACE INTO evidence_citations (
              evidence_id, dataset_id, citation_type,
              page_number, quote, context,
              citation_style, relevance_score, notes,
              created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            body.evidence_id,
            datasetId,
            body.citation_type || 'primary',
            body.page_number || null,
            body.quote || null,
            body.context || null,
            body.citation_style || 'apa',
            body.relevance_score || 5,
            body.notes || null,
            body.created_by || 1
          ).run()

          results.push({ dataset_id: datasetId, success: true })
        } catch (error: any) {
          results.push({ dataset_id: datasetId, success: false, error: error.message })
        }
      }

      return new Response(JSON.stringify({
        message: 'Citations created successfully',
        results
      }), {
        status: 201,
        headers: corsHeaders,
      })
    }

    // DELETE - Remove citation
    if (request.method === 'DELETE') {
      if (!evidenceId || !datasetId) {
        return new Response(JSON.stringify({
          error: 'evidence_id and dataset_id are required'
        }), {
          status: 400,
          headers: corsHeaders,
        })
      }

      await env.DB.prepare(
        'DELETE FROM evidence_citations WHERE evidence_id = ? AND dataset_id = ?'
      ).bind(evidenceId, datasetId).run()

      return new Response(JSON.stringify({ message: 'Citation removed successfully' }), {
        status: 200,
        headers: corsHeaders,
      })
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: corsHeaders,
    })

  } catch (error: any) {
    console.error('Evidence Citations API error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: corsHeaders,
    })
  }
}
