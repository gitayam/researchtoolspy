// RETIRED (D-E8-4): the singular /api/evidence endpoint formerly ran full CRUD
// against the legacy `evidence` table (0 rows in prod). As part of making
// `evidence_items` the single canonical evidence store (D-E8), every read/write
// path has been repointed to `evidence_items` and this endpoint has no callers
// (no frontend or backend code fetches /api/evidence). It now returns 410 Gone
// so any stray client is told, unambiguously, to use the canonical endpoint —
// and so the `evidence` table can be safely dropped (D-E8-5) without a live
// reader/writer left behind. Use /api/evidence-items instead.
import type { PagesFunction } from '@cloudflare/workers-types'
import { CORS_HEADERS, JSON_HEADERS } from './_shared/api-utils'

const CANONICAL_ENDPOINT = '/api/evidence-items'

export const onRequest: PagesFunction = async (context) => {
  const { request } = context

  // Handle preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  // Everything else: this resource is permanently gone — point to the canonical store.
  return new Response(
    JSON.stringify({
      error: 'Gone',
      message:
        'The /api/evidence endpoint has been retired. Evidence now lives in the canonical ' +
        'evidence_items store. Use /api/evidence-items instead.',
      canonical_endpoint: CANONICAL_ENDPOINT,
    }),
    {
      status: 410,
      headers: { ...JSON_HEADERS, Link: `<${CANONICAL_ENDPOINT}>; rel="successor-version"` },
    }
  )
}
