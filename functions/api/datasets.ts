// Cloudflare Pages Function for Dataset API
import { getUserFromRequest } from './_shared/auth-helpers'
import { CORS_HEADERS, JSON_HEADERS, safeJsonParse } from './_shared/api-utils'

function buildDatasetMetadata(body: any, storedValue?: unknown): Record<string, unknown> {
  const stored = typeof storedValue === 'string'
    ? safeJsonParse(storedValue, {}) as Record<string, unknown>
    : ((storedValue as Record<string, unknown>) || {})
  const requested = typeof body.metadata === 'string'
    ? safeJsonParse(body.metadata, {}) as Record<string, unknown>
    : (body.metadata || {})
  const existing = { ...stored, ...requested }

  return {
    ...existing,
    sats_evaluation: body.sats_evaluation ?? existing.sats_evaluation ?? null,
    frameworks: body.frameworks ?? existing.frameworks ?? [],
    attachments: body.attachments ?? existing.attachments ?? [],
    key_points: body.key_points ?? existing.key_points ?? [],
    contradictions: body.contradictions ?? existing.contradictions ?? [],
    corroborations: body.corroborations ?? existing.corroborations ?? [],
    implications: body.implications ?? existing.implications ?? [],
    version: body.version ?? existing.version ?? 1,
    previous_versions: body.previous_versions ?? existing.previous_versions ?? [],
  }
}

function parseDataset(dataset: any) {
  const metadata = safeJsonParse(dataset.metadata, {}) as Record<string, any>

  return {
    ...dataset,
    tags: safeJsonParse(dataset.tags, []),
    source: safeJsonParse(dataset.source, {}),
    metadata,
    sats_evaluation: metadata.sats_evaluation ?? null,
    frameworks: metadata.frameworks ?? [],
    attachments: metadata.attachments ?? [],
    key_points: metadata.key_points ?? [],
    contradictions: metadata.contradictions ?? [],
    corroborations: metadata.corroborations ?? [],
    implications: metadata.implications ?? [],
    version: metadata.version ?? 1,
    previous_versions: metadata.previous_versions ?? [],
  }
}

export async function onRequest(context: any) {
  const { request, env } = context

  // Handle preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  try {
    const url = new URL(request.url)
    const datasetId = url.searchParams.get('id')

    // GET - List dataset or get single dataset
    if (request.method === 'GET') {
      const userId = await getUserFromRequest(request, env)
      if (!userId) {
        return new Response(JSON.stringify({ error: 'Authentication required' }), {
          status: 401, headers: JSON_HEADERS,
        })
      }
      if (datasetId) {
        // Get single dataset from D1
        const dataset = await env.DB.prepare(
          'SELECT * FROM datasets WHERE id = ? AND (created_by = ? OR is_public = 1)'
        ).bind(datasetId, userId).first()

        if (!dataset) {
          return new Response(JSON.stringify({ error: 'Dataset not found' }), {
            status: 404,
            headers: JSON_HEADERS,
          })
        }

        // Parse JSON fields
        const parsedDataset = parseDataset(dataset)

        return new Response(JSON.stringify(parsedDataset), {
          status: 200,
          headers: JSON_HEADERS,
        })
      }

      // List all dataset with optional filters
      const type = url.searchParams.get('type')
      const status = url.searchParams.get('status')
      const publicOnly = url.searchParams.get('public') === 'true'
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '50') || 50, 500)

      let query = 'SELECT * FROM datasets WHERE 1=1'
      const params: any[] = []

      // Scope: show user's own datasets + public datasets
      if (publicOnly) {
        query += ' AND is_public = 1'
      } else {
        query += ' AND (created_by = ? OR is_public = 1)'
        params.push(userId)
      }

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

      const results = await env.DB.prepare(query).bind(...params).all()

      // Parse JSON fields for all results
      const parsedResults = (results.results || []).map(parseDataset)

      return new Response(JSON.stringify({ dataset: parsedResults }), {
        status: 200,
        headers: JSON_HEADERS,
      })
    }

    // POST - Create new dataset
    if (request.method === 'POST') {
      const authUserId = await getUserFromRequest(request, env)
      if (!authUserId) {
        return new Response(JSON.stringify({ error: 'Authentication required' }), {
          status: 401, headers: JSON_HEADERS,
        })
      }
      const body = await request.json()

      if (!body.title || !body.type) {
        return new Response(JSON.stringify({ error: 'title and type are required' }), {
          status: 400,
          headers: JSON_HEADERS,
        })
      }

      // Build source object from separate fields or existing source object
      const source = body.source || {
        type: body.source_type || body.type,
        name: body.source_name || '',
        url: body.source_url || null,
        credibility: body.credibility || '6',
        reliability: body.reliability || 'F'
      }
      const metadata = buildDatasetMetadata(body)

      const result = await env.DB.prepare(
        `INSERT INTO datasets (
          title, description, content, type, status, tags,
          source, metadata,
          created_by, created_at, updated_at,
          source_name, source_url, author, organization,
          publication_date, access_date, reliability_rating,
          is_public, shared_by_user_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        body.title,
        body.description || '',
        body.content || '',
        body.type,
        body.status || 'pending',
        typeof body.tags === 'string' ? body.tags : JSON.stringify(body.tags || []),
        JSON.stringify(source),
        JSON.stringify(metadata),
        authUserId,
        body.source_name || source.name || null,
        body.source_url || source.url || null,
        body.author || null,
        body.organization || null,
        body.publication_date || null,
        body.access_date || null,
        body.reliability_rating || body.reliability || source.reliability || null,
        body.is_public ? 1 : 0,
        body.shared_by_user_id || null
      ).run()

      return new Response(JSON.stringify({
        id: result.meta.last_row_id,
        message: 'Dataset created successfully'
      }), {
        status: 201,
        headers: JSON_HEADERS,
      })
    }

    // PUT - Update dataset
    if (request.method === 'PUT') {
      const authUserId = await getUserFromRequest(request, env)
      if (!authUserId) {
        return new Response(JSON.stringify({ error: 'Authentication required' }), {
          status: 401, headers: JSON_HEADERS,
        })
      }
      const body = await request.json()

      const currentDataset = await env.DB.prepare(
        'SELECT * FROM datasets WHERE id = ? AND created_by = ?'
      ).bind(datasetId, authUserId).first<Record<string, any>>()
      if (!currentDataset) {
        return new Response(JSON.stringify({ error: 'Dataset not found or access denied' }), {
          status: 404,
          headers: JSON_HEADERS,
        })
      }

      // Build source object from separate fields or existing source object
      const storedSource = safeJsonParse(currentDataset.source, {})
      const source = body.source || {
        ...storedSource,
        type: body.source_type ?? body.type ?? storedSource.type,
        name: body.source_name ?? currentDataset.source_name ?? storedSource.name ?? '',
        url: body.source_url ?? currentDataset.source_url ?? storedSource.url ?? null,
        credibility: body.credibility ?? storedSource.credibility ?? '6',
        reliability: body.reliability ?? currentDataset.reliability_rating ?? storedSource.reliability ?? 'F'
      }
      const metadata = buildDatasetMetadata(body, currentDataset.metadata)

      const updateResult = await env.DB.prepare(
        `UPDATE datasets
         SET title = ?, description = ?, content = ?, type = ?, status = ?,
             tags = ?, source = ?, metadata = ?, updated_at = datetime('now'),
             source_name = ?, source_url = ?, author = ?, organization = ?,
             publication_date = ?, access_date = ?, reliability_rating = ?,
             is_public = ?, shared_by_user_id = ?
         WHERE id = ? AND created_by = ?`
      ).bind(
        body.title ?? currentDataset.title,
        body.description ?? currentDataset.description ?? '',
        body.content ?? currentDataset.content ?? '',
        body.type ?? currentDataset.type,
        body.status ?? currentDataset.status,
        body.tags === undefined
          ? currentDataset.tags
          : (typeof body.tags === 'string' ? body.tags : JSON.stringify(body.tags)),
        JSON.stringify(source),
        JSON.stringify(metadata),
        body.source_name ?? currentDataset.source_name ?? source.name ?? null,
        body.source_url ?? currentDataset.source_url ?? source.url ?? null,
        body.author ?? currentDataset.author ?? null,
        body.organization ?? currentDataset.organization ?? null,
        body.publication_date ?? currentDataset.publication_date ?? null,
        body.access_date ?? currentDataset.access_date ?? null,
        body.reliability_rating ?? body.reliability ?? currentDataset.reliability_rating ?? source.reliability ?? null,
        body.is_public === undefined ? currentDataset.is_public : (body.is_public ? 1 : 0),
        body.shared_by_user_id ?? currentDataset.shared_by_user_id ?? null,
        datasetId,
        authUserId
      ).run()

      if (!updateResult.meta.changes || updateResult.meta.changes === 0) {
        return new Response(JSON.stringify({ error: 'Dataset not found or access denied' }), {
          status: 404, headers: JSON_HEADERS,
        })
      }

      return new Response(JSON.stringify({ message: 'Dataset updated successfully' }), {
        status: 200,
        headers: JSON_HEADERS,
      })
    }

    // DELETE - Delete dataset
    if (request.method === 'DELETE') {
      const authUserId = await getUserFromRequest(request, env)
      if (!authUserId) {
        return new Response(JSON.stringify({ error: 'Authentication required' }), {
          status: 401, headers: JSON_HEADERS,
        })
      }
      const delResult = await env.DB.prepare(
        'DELETE FROM datasets WHERE id = ? AND created_by = ?'
      ).bind(datasetId, authUserId).run()

      if (!delResult.meta.changes || delResult.meta.changes === 0) {
        return new Response(JSON.stringify({ error: 'Dataset not found or access denied' }), {
          status: 404, headers: JSON_HEADERS,
        })
      }

      return new Response(JSON.stringify({ message: 'Dataset deleted successfully' }), {
        status: 200,
        headers: JSON_HEADERS,
      })
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: JSON_HEADERS,
    })

  } catch (error: any) {
    console.error('Dataset API error:', error)
    // If table doesn't exist, return empty array for GET requests
    if (request.method === 'GET' && error.message?.includes('no such table')) {
      return new Response(JSON.stringify({ dataset: [] }), {
        status: 200,
        headers: JSON_HEADERS,
      })
    }
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: JSON_HEADERS,
    })
  }
}
