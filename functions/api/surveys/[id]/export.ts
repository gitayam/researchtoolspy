/**
 * Survey/Drop Export API
 *
 * GET /api/surveys/:id/export?format=csv|json|stix
 *
 * Exports all responses with enrichment data in analyst-friendly formats.
 */
import type { PagesFunction } from '@cloudflare/workers-types'
import { getUserFromRequest } from '../../_shared/auth-helpers'
import { JSON_HEADERS, safeJsonParse } from '../../_shared/api-utils'

interface Env {
  DB: D1Database
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const surveyId = params.id as string

  try {
    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: JSON_HEADERS,
      })
    }

    const survey = await env.DB.prepare(
      'SELECT id, title, form_schema, facts, changelog FROM survey_drops WHERE id = ? AND created_by = ?'
    ).bind(surveyId, userId).first<{ id: string; title: string; form_schema: string; facts: string; changelog: string }>()

    if (!survey) {
      return new Response(JSON.stringify({ error: 'Drop not found' }), {
        status: 404, headers: JSON_HEADERS,
      })
    }

    const url = new URL(request.url)
    const format = url.searchParams.get('format') || 'json'
    const statusFilter = url.searchParams.get('status') // pending, accepted, rejected

    let query = `SELECT id, form_data, submitter_name, submitter_contact,
                        lat, lon, submitter_country, submitter_city, status, created_at
                 FROM survey_responses WHERE survey_id = ?`
    const bindings: unknown[] = [surveyId]

    if (statusFilter && ['pending', 'accepted', 'rejected'].includes(statusFilter)) {
      query += ' AND status = ?'
      bindings.push(statusFilter)
    }
    query += ' ORDER BY created_at DESC LIMIT 1000'

    const result = await env.DB.prepare(query).bind(...bindings).all()
    const rows = result.results || []

    let formSchema: { name: string; type: string; label: string }[] = []
    try { formSchema = survey.form_schema ? JSON.parse(survey.form_schema) : [] } catch { /* */ }

    // Parse all rows with enrichment data
    const parsed = rows.map((row: any) => {
      const data = safeJsonParse(row.form_data, {})
      const tags = data._tags || []
      const enrichments: Record<string, unknown>[] = []

      // Collect _enriched_* fields
      for (const [key, val] of Object.entries(data)) {
        if (key.startsWith('_enriched_') && val && typeof val === 'object') {
          enrichments.push(val as Record<string, unknown>)
        }
      }

      // Clean form data (strip internal fields)
      const cleanData: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(data)) {
        if (!k.startsWith('_')) cleanData[k] = v
      }

      return {
        id: row.id,
        status: row.status,
        submitter_name: row.submitter_name,
        submitter_country: row.submitter_country,
        submitter_city: row.submitter_city,
        lat: row.lat,
        lon: row.lon,
        created_at: row.created_at,
        form_data: cleanData,
        tags,
        enrichments,
      }
    })

    if (format === 'csv') {
      return buildCsvResponse(survey.title, formSchema, parsed)
    }

    if (format === 'stix') {
      return buildStixResponse(survey, formSchema, parsed)
    }

    // Default: JSON
    return new Response(JSON.stringify({
      drop: {
        id: survey.id,
        title: survey.title,
        facts: safeJsonParse(survey.facts, []),
        changelog: safeJsonParse(survey.changelog, []),
      },
      fields: formSchema,
      total: parsed.length,
      responses: parsed,
      exported_at: new Date().toISOString(),
    }, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${slugify(survey.title)}-export.json"`,
      },
    })
  } catch (error) {
    console.error('[Drop Export] Error:', error)
    return new Response(JSON.stringify({ error: 'Export failed' }), {
      status: 500, headers: JSON_HEADERS,
    })
  }
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').substring(0, 50)
}

function buildCsvResponse(
  title: string,
  schema: { name: string; label: string }[],
  rows: any[]
): Response {
  const fieldNames = schema.map(f => f.name)
  const headers = [
    'id', 'status', 'submitter_name', 'country', 'city', 'lat', 'lon', 'created_at',
    ...schema.map(f => f.label || f.name),
    'tags', 'enrichment_urls', 'enrichment_summaries',
  ]

  const csvRows = [headers.join(',')]
  for (const row of rows) {
    const vals = [
      esc(row.id), esc(row.status), esc(row.submitter_name || ''),
      esc(row.submitter_country || ''), esc(row.submitter_city || ''),
      row.lat ?? '', row.lon ?? '', esc(row.created_at || ''),
      ...fieldNames.map(fn => esc(String(row.form_data[fn] ?? ''))),
      esc((row.tags || []).join('; ')),
      esc((row.enrichments || []).map((e: any) => e.url).filter(Boolean).join('; ')),
      esc((row.enrichments || []).map((e: any) => e.summary).filter(Boolean).join(' | ')),
    ]
    csvRows.push(vals.join(','))
  }

  return new Response(csvRows.join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${slugify(title)}-export.csv"`,
    },
  })
}

function esc(s: string): string {
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function buildStixResponse(
  survey: { id: string; title: string },
  _schema: { name: string; label: string }[],
  rows: any[]
): Response {
  const bundle: any = {
    type: 'bundle',
    id: `bundle--${crypto.randomUUID()}`,
    objects: [],
  }

  // Report object for the drop itself
  const reportId = `report--${crypto.randomUUID()}`
  bundle.objects.push({
    type: 'report',
    spec_version: '2.1',
    id: reportId,
    name: survey.title,
    created: new Date().toISOString(),
    modified: new Date().toISOString(),
    report_types: ['threat-report'],
    object_refs: [],
  })

  for (const row of rows) {
    // Each response becomes an observed-data
    const obsId = `observed-data--${crypto.randomUUID()}`
    bundle.objects.push({
      type: 'observed-data',
      spec_version: '2.1',
      id: obsId,
      created: row.created_at || new Date().toISOString(),
      modified: row.created_at || new Date().toISOString(),
      first_observed: row.created_at,
      last_observed: row.created_at,
      number_observed: 1,
      object_refs: [],
    })
    bundle.objects[0].object_refs.push(obsId)

    // URLs from enrichments become URL SCOs
    for (const enrichment of (row.enrichments || [])) {
      if (enrichment.url) {
        const urlId = `url--${crypto.randomUUID()}`
        bundle.objects.push({
          type: 'url',
          spec_version: '2.1',
          id: urlId,
          value: enrichment.url,
        })
        bundle.objects.find((o: any) => o.id === obsId).object_refs.push(urlId)
      }
    }

    // Geolocations
    if (row.lat != null && row.lon != null) {
      const locId = `location--${crypto.randomUUID()}`
      bundle.objects.push({
        type: 'location',
        spec_version: '2.1',
        id: locId,
        latitude: row.lat,
        longitude: row.lon,
        country: row.submitter_country || undefined,
      })
      bundle.objects.find((o: any) => o.id === obsId).object_refs.push(locId)
    }

    // Tags become labels on the observed-data
    if (row.tags?.length > 0) {
      bundle.objects.find((o: any) => o.id === obsId).labels = row.tags
    }

    // Note for the actual text content
    const formText = Object.entries(row.form_data)
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n')
    if (formText) {
      const noteId = `note--${crypto.randomUUID()}`
      bundle.objects.push({
        type: 'note',
        spec_version: '2.1',
        id: noteId,
        content: formText,
        created: row.created_at,
        object_refs: [obsId],
        authors: row.submitter_name ? [row.submitter_name] : undefined,
      })
    }
  }

  return new Response(JSON.stringify(bundle, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${slugify(survey.title)}-stix.json"`,
    },
  })
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: JSON_HEADERS })
}
