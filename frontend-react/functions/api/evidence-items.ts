// Cloudflare Pages Function for Evidence Items API
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

    // GET - Get evidence item(s)
    if (request.method === 'GET') {
      if (evidenceId) {
        // Get single evidence item with citations
        const evidence = await env.DB.prepare(`
          SELECT * FROM evidence_items WHERE id = ?
        `).bind(evidenceId).first()

        if (!evidence) {
          return new Response(JSON.stringify({ error: 'Evidence not found' }), {
            status: 404,
            headers: corsHeaders,
          })
        }

        // Get citations for this evidence
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

        // Parse JSON fields
        const parsedEvidence = {
          ...evidence,
          tags: JSON.parse(evidence.tags || '[]'),
          citations: citations.results.map((c: any) => ({
            ...c,
            dataset: {
              id: c.dataset_id,
              title: c.dataset_title,
              description: c.dataset_description,
              type: c.dataset_type,
              source: JSON.parse(c.dataset_source || '{}'),
            }
          }))
        }

        return new Response(JSON.stringify(parsedEvidence), {
          status: 200,
          headers: corsHeaders,
        })
      }

      // Get list of evidence items with filters
      let query = 'SELECT * FROM evidence_items WHERE 1=1'
      const params: any[] = []

      // Apply filters
      const type = url.searchParams.get('type')
      const level = url.searchParams.get('level')
      const status = url.searchParams.get('status')
      const priority = url.searchParams.get('priority')
      const confidence = url.searchParams.get('confidence_level')
      const category = url.searchParams.get('category')
      const publicOnly = url.searchParams.get('public') === 'true'

      // Filter by public access if requested
      if (publicOnly) {
        query += ' AND is_public = 1'
      }

      if (type) {
        query += ' AND evidence_type = ?'
        params.push(type)
      }
      if (level) {
        query += ' AND evidence_level = ?'
        params.push(level)
      }
      if (status) {
        query += ' AND status = ?'
        params.push(status)
      }
      if (priority) {
        query += ' AND priority = ?'
        params.push(priority)
      }
      if (confidence) {
        query += ' AND confidence_level = ?'
        params.push(confidence)
      }
      if (category) {
        query += ' AND category = ?'
        params.push(category)
      }

      query += ' ORDER BY created_at DESC LIMIT 100'

      const result = await env.DB.prepare(query).bind(...params).all()

      // Parse JSON fields
      const evidence = result.results.map((item: any) => ({
        ...item,
        tags: JSON.parse(item.tags || '[]')
      }))

      return new Response(JSON.stringify({ evidence }), {
        status: 200,
        headers: corsHeaders,
      })
    }

    // POST - Create new evidence item
    if (request.method === 'POST') {
      const body = await request.json()

      if (!body.title || !body.evidence_type) {
        return new Response(JSON.stringify({
          error: 'title and evidence_type are required'
        }), {
          status: 400,
          headers: corsHeaders,
        })
      }

      // Insert evidence item
      const result = await env.DB.prepare(`
        INSERT INTO evidence_items (
          title, description,
          who, what, when_occurred, where_location, why_purpose, how_method,
          evidence_type, evidence_level, category,
          credibility, reliability, confidence_level,
          tags, status, priority,
          created_by, is_public, shared_by_user_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        body.title,
        body.description || null,
        body.who || null,
        body.what || null,
        body.when_occurred || null,
        body.where_location || null,
        body.why_purpose || null,
        body.how_method || null,
        body.evidence_type,
        body.evidence_level || 'tactical',
        body.category || null,
        body.credibility || 'unknown',
        body.reliability || 'unknown',
        body.confidence_level || 'low',
        JSON.stringify(body.tags || []),
        body.status || 'pending',
        body.priority || 'normal',
        body.created_by || 1,
        body.is_public ? 1 : 0,
        body.shared_by_user_id || null
      ).run()

      const evidenceId = result.meta.last_row_id

      // If citations provided, create them
      if (body.citations && Array.isArray(body.citations)) {
        for (const citation of body.citations) {
          await env.DB.prepare(`
            INSERT INTO evidence_citations (
              evidence_id, dataset_id, citation_type,
              page_number, quote, context,
              citation_style, relevance_score, notes,
              created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            evidenceId,
            citation.dataset_id,
            citation.citation_type || 'primary',
            citation.page_number || null,
            citation.quote || null,
            citation.context || null,
            citation.citation_style || 'apa',
            citation.relevance_score || 5,
            citation.notes || null,
            body.created_by || 1
          ).run()
        }
      }

      return new Response(JSON.stringify({
        message: 'Evidence created successfully',
        id: evidenceId
      }), {
        status: 201,
        headers: corsHeaders,
      })
    }

    // PUT - Update evidence item
    if (request.method === 'PUT') {
      if (!evidenceId) {
        return new Response(JSON.stringify({ error: 'Evidence ID required' }), {
          status: 400,
          headers: corsHeaders,
        })
      }

      const body = await request.json()

      await env.DB.prepare(`
        UPDATE evidence_items
        SET
          title = ?,
          description = ?,
          who = ?,
          what = ?,
          when_occurred = ?,
          where_location = ?,
          why_purpose = ?,
          how_method = ?,
          evidence_type = ?,
          evidence_level = ?,
          category = ?,
          credibility = ?,
          reliability = ?,
          confidence_level = ?,
          tags = ?,
          status = ?,
          priority = ?,
          updated_at = datetime('now'),
          updated_by = ?,
          is_public = ?,
          shared_by_user_id = ?
        WHERE id = ?
      `).bind(
        body.title,
        body.description || null,
        body.who || null,
        body.what || null,
        body.when_occurred || null,
        body.where_location || null,
        body.why_purpose || null,
        body.how_method || null,
        body.evidence_type,
        body.evidence_level,
        body.category || null,
        body.credibility,
        body.reliability,
        body.confidence_level,
        JSON.stringify(body.tags || []),
        body.status,
        body.priority,
        body.updated_by || 1,
        body.is_public ? 1 : 0,
        body.shared_by_user_id || null,
        evidenceId
      ).run()

      return new Response(JSON.stringify({ message: 'Evidence updated successfully' }), {
        status: 200,
        headers: corsHeaders,
      })
    }

    // DELETE - Delete evidence item
    if (request.method === 'DELETE') {
      if (!evidenceId) {
        return new Response(JSON.stringify({ error: 'Evidence ID required' }), {
          status: 400,
          headers: corsHeaders,
        })
      }

      // Delete citations first
      await env.DB.prepare('DELETE FROM evidence_citations WHERE evidence_id = ?')
        .bind(evidenceId)
        .run()

      // Delete evidence
      await env.DB.prepare('DELETE FROM evidence_items WHERE id = ?')
        .bind(evidenceId)
        .run()

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
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: corsHeaders,
    })
  }
}
