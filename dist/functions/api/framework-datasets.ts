// Cloudflare Pages Function for Framework-Dataset Linking API
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
    const frameworkId = url.searchParams.get('framework_id')
    const datasetId = url.searchParams.get('dataset_id')

    // GET - Get linked dataset for a framework or frameworks for an dataset
    if (request.method === 'GET') {
      if (frameworkId) {
        // Get all dataset linked to this framework
        const links = await env.DB.prepare(`
          SELECT
            fe.*,
            e.id as dataset_id,
            e.title,
            e.description,
            e.type,
            e.status,
            e.source,
            e.tags
          FROM framework_datasets fe
          JOIN datasets e ON fe.dataset_id = e.id
          WHERE fe.framework_id = ?
          ORDER BY fe.created_at DESC
        `).bind(frameworkId).all()

        const parsedLinks = links.results.map((link: any) => ({
          ...link,
          source: JSON.parse(link.source || '{}'),
          tags: JSON.parse(link.tags || '[]')
        }))

        return new Response(JSON.stringify({ links: parsedLinks }), {
          status: 200,
          headers: corsHeaders,
        })
      } else if (datasetId) {
        // Get all frameworks this dataset is linked to
        const links = await env.DB.prepare(`
          SELECT
            fe.*,
            f.id as framework_id,
            f.framework_type,
            f.title,
            f.status
          FROM framework_datasets fe
          JOIN framework_sessions f ON fe.framework_id = f.id
          WHERE fe.dataset_id = ?
          ORDER BY fe.created_at DESC
        `).bind(datasetId).all()

        return new Response(JSON.stringify({ links: links.results }), {
          status: 200,
          headers: corsHeaders,
        })
      }

      return new Response(JSON.stringify({ error: 'framework_id or dataset_id required' }), {
        status: 400,
        headers: corsHeaders,
      })
    }

    // POST - Link dataset to framework
    if (request.method === 'POST') {
      const body = await request.json()

      if (!body.framework_id || !body.dataset_ids || !Array.isArray(body.dataset_ids)) {
        return new Response(JSON.stringify({
          error: 'framework_id and dataset_ids (array) are required'
        }), {
          status: 400,
          headers: corsHeaders,
        })
      }

      // Link each dataset to the framework
      const results = []
      for (const datasetId of body.dataset_ids) {
        try {
          const result = await env.DB.prepare(`
            INSERT OR REPLACE INTO framework_datasets
            (framework_id, dataset_id, section_key, relevance_note, created_by)
            VALUES (?, ?, ?, ?, ?)
          `).bind(
            body.framework_id,
            datasetId,
            body.section_key || null,
            body.relevance_note || null,
            body.created_by || 1
          ).run()

          results.push({ dataset_id: datasetId, success: true })
        } catch (error: any) {
          results.push({ dataset_id: datasetId, success: false, error: error.message })
        }
      }

      return new Response(JSON.stringify({
        message: 'Dataset linked successfully',
        results
      }), {
        status: 201,
        headers: corsHeaders,
      })
    }

    // DELETE - Unlink dataset from framework
    if (request.method === 'DELETE') {
      if (!frameworkId || !datasetId) {
        return new Response(JSON.stringify({
          error: 'framework_id and dataset_id are required'
        }), {
          status: 400,
          headers: corsHeaders,
        })
      }

      const sectionKey = url.searchParams.get('section_key')

      let query = 'DELETE FROM framework_datasets WHERE framework_id = ? AND dataset_id = ?'
      const params = [frameworkId, datasetId]

      if (sectionKey) {
        query += ' AND section_key = ?'
        params.push(sectionKey)
      }

      await env.DB.prepare(query).bind(...params).run()

      return new Response(JSON.stringify({ message: 'Dataset unlinked successfully' }), {
        status: 200,
        headers: corsHeaders,
      })
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: corsHeaders,
    })

  } catch (error: any) {
    console.error('Framework-Dataset API error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: corsHeaders,
    })
  }
}
