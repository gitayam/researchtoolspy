// Cloudflare Pages Function for Evidence Citations API
import { getUserFromRequest } from './_shared/auth-helpers'
import { CORS_HEADERS, JSON_HEADERS, safeJsonParse } from './_shared/api-utils'

export async function onRequest(context: any) {
  const { request, env } = context

  // Handle preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  try {
    const url = new URL(request.url)
    const evidenceId = url.searchParams.get('evidence_id')
    const datasetId = url.searchParams.get('dataset_id')

    // All methods require authentication
    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: JSON_HEADERS,
      })
    }
    const workspaceId = request.headers.get('X-Workspace-ID') || null
    if (!workspaceId) {
      return new Response(JSON.stringify({ error: 'X-Workspace-ID header is required' }), {
        status: 400, headers: JSON_HEADERS,
      })
    }

    // GET - Get citations for evidence or dataset
    if (request.method === 'GET') {
      if (evidenceId) {
        // Get all citations for an evidence item
        const citations = await env.DB.prepare(`
          SELECT
            ec.*,
            ec.citation_format as citation_style,
            d.id as dataset_id,
            d.title as dataset_title,
            d.description as dataset_description,
            d.type as dataset_type,
            d.source as dataset_source
          FROM evidence_citations ec
          JOIN datasets d ON ec.dataset_id = d.id
          JOIN evidence_items e ON ec.evidence_id = e.id
          WHERE ec.evidence_id = ?
            AND ((e.created_by = ? AND e.workspace_id = ?) OR e.is_public = 1)
          ORDER BY ec.relevance_score DESC
          LIMIT 500
        `).bind(evidenceId, userId, workspaceId).all()

        const parsedCitations = (citations.results || []).map((c: any) => ({
          ...c,
          dataset: {
            id: c.dataset_id,
            title: c.dataset_title,
            description: c.dataset_description,
            type: c.dataset_type,
            source: safeJsonParse(c.dataset_source, {}),
          }
        }))

        return new Response(JSON.stringify({ citations: parsedCitations }), {
          status: 200,
          headers: JSON_HEADERS,
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
            AND ((e.created_by = ? AND e.workspace_id = ?) OR e.is_public = 1)
          ORDER BY ec.created_at DESC
          LIMIT 500
        `).bind(datasetId, userId, workspaceId).all()

        return new Response(JSON.stringify({ citations: citations.results }), {
          status: 200,
          headers: JSON_HEADERS,
        })
      }

      return new Response(JSON.stringify({ error: 'evidence_id or dataset_id required' }), {
        status: 400,
        headers: JSON_HEADERS,
      })
    }

    // POST - Create citation(s)
    if (request.method === 'POST') {
      const body = await request.json()

      if (!body.evidence_id || !Array.isArray(body.dataset_ids) || body.dataset_ids.length === 0) {
        return new Response(JSON.stringify({
          error: 'evidence_id and dataset_ids (array) are required'
        }), {
          status: 400,
          headers: JSON_HEADERS,
        })
      }

      const ownedEvidence = await env.DB.prepare(`
        SELECT id FROM evidence_items
        WHERE id = ? AND created_by = ? AND workspace_id = ?
      `).bind(body.evidence_id, userId, workspaceId).first()
      if (!ownedEvidence) {
        return new Response(JSON.stringify({ error: 'Evidence not found or access denied' }), {
          status: 404, headers: JSON_HEADERS,
        })
      }

      const uniqueDatasetIds = [...new Set(body.dataset_ids.map(String))]
      for (const candidateDatasetId of uniqueDatasetIds) {
        const dataset = await env.DB.prepare(`
          SELECT id FROM datasets
          WHERE id = ? AND (created_by = ? OR is_public = 1)
        `).bind(candidateDatasetId, userId).first()
        if (!dataset) {
          return new Response(JSON.stringify({
            error: `Dataset ${candidateDatasetId} not found or access denied`
          }), {
            status: 404, headers: JSON_HEADERS,
          })
        }
      }

      const statements: D1PreparedStatement[] = []
      for (const candidateDatasetId of uniqueDatasetIds) {
        statements.push(env.DB.prepare(`
            INSERT INTO evidence_citations (
              evidence_id, dataset_id, citation_type,
              page_number, quote, context,
              citation_format, relevance_score, notes,
              created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            body.evidence_id,
            candidateDatasetId,
            body.citation_type || 'primary',
            body.page_number || null,
            body.quote || null,
            body.context || null,
            body.citation_style || body.citation_format || 'apa',
            body.relevance_score || 5,
            body.notes || null,
            userId
          ))
      }
      await env.DB.batch(statements)
      const results = uniqueDatasetIds.map((candidateDatasetId) => ({
        dataset_id: candidateDatasetId,
        success: true,
      }))

      return new Response(JSON.stringify({
        message: 'Citations created successfully',
        results
      }), {
        status: 201,
        headers: JSON_HEADERS,
      })
    }

    // DELETE - Remove citation
    if (request.method === 'DELETE') {
      if (!evidenceId || !datasetId) {
        return new Response(JSON.stringify({
          error: 'evidence_id and dataset_id are required'
        }), {
          status: 400,
          headers: JSON_HEADERS,
        })
      }

      // Verify evidence ownership before removing citation
      const ev = await env.DB.prepare(
        'SELECT id FROM evidence_items WHERE id = ? AND created_by = ? AND workspace_id = ?'
      ).bind(evidenceId, userId, workspaceId).first()
      if (!ev) {
        return new Response(JSON.stringify({ error: 'Evidence not found or access denied' }), {
          status: 404, headers: JSON_HEADERS,
        })
      }

      await env.DB.prepare(
        'DELETE FROM evidence_citations WHERE evidence_id = ? AND dataset_id = ?'
      ).bind(evidenceId, datasetId).run()

      return new Response(JSON.stringify({ message: 'Citation removed successfully' }), {
        status: 200,
        headers: JSON_HEADERS,
      })
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: JSON_HEADERS,
    })

  } catch (error: any) {
    console.error('Evidence Citations API error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: JSON_HEADERS,
    })
  }
}
