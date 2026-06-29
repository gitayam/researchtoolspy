/**
 * Shared URL-enrichment for public form submissions (System A surveys + COP intake).
 *
 * Both `surveys/public/:token/submit` and `cop/public/intake/:token/submit` write
 * to the same `survey_responses` table. After responding, each one runs a background
 * enrichment pass (via `context.waitUntil`) over any `url`-type fields: it scrapes the
 * URL for a title/excerpt, runs a quick content analysis through the internal
 * `analyze-url` endpoint, and stores the result under `_enriched_<field>` back into
 * `survey_responses.form_data`.
 *
 * This module is the single source of truth for that logic (DRY) so the two intakes
 * stay in lock-step. All enrichment work is wrapped in try/catch guards so it can
 * never throw into the request path — callers pass it to `context.waitUntil(...)`.
 */
import { scrapeUrl, type ScrapedContent } from './scraper-utils'

/** Env bindings the enrichment needs. Mirror these in each caller's Env. */
export interface UrlEnrichmentEnv {
  DB: D1Database
  APIFY_API_KEY?: string
  SYSTEM_USER_HASH?: string
}

/** A single field definition out of a form schema. */
interface FormField {
  name: string
  type?: string
  [k: string]: unknown
}

/**
 * Pure: return the names of every `url`-type field in a form schema.
 * Tolerates a non-array / undefined schema (returns []).
 */
export function urlFieldsFromSchema(formSchema: unknown): string[] {
  if (!Array.isArray(formSchema)) return []
  return formSchema
    .filter((f): f is FormField => !!f && typeof f === 'object' && (f as FormField).type === 'url' && typeof (f as FormField).name === 'string')
    .map((f) => f.name)
}

/** Shape of the content-analysis JSON we read fields out of. */
interface AnalysisResult {
  id?: string
  analysis_id?: string
  summary?: string
  word_count?: number
  content_source?: string
}

/**
 * Pure: build the `_enriched_<field>` record from a scrape result and an optional
 * analysis result. Tolerates missing scrape/analysis fields — only sets what exists.
 * Matches the surveys-submit shape byte-for-byte:
 *   { field, url, title, excerpt, fetched_at, [analysis_id, summary, word_count, content_source] }
 */
export function enrichmentRecord(
  field: string,
  url: string,
  scraped: ScrapedContent,
  analysis?: AnalysisResult | null,
): Record<string, unknown> {
  const record: Record<string, unknown> = {
    field,
    url,
    title: scraped.title,
    excerpt: scraped.content?.substring(0, 500),
    fetched_at: new Date().toISOString(),
  }
  if (analysis) {
    record.analysis_id = analysis.id ?? analysis.analysis_id
    record.summary = analysis.summary?.substring(0, 300)
    record.word_count = analysis.word_count
    record.content_source = analysis.content_source
  }
  return record
}

interface EnrichResponseUrlsArgs {
  env: UrlEnrichmentEnv
  /** Request origin, e.g. `new URL(request.url).origin`, used for the internal analyze-url call. */
  origin: string
  /** The `survey_responses.id` to enrich in place. */
  responseId: string
  /** Parsed form schema (array of field defs). */
  formSchema: unknown
  /** Submitted form data (object). */
  formData: Record<string, unknown>
}

/**
 * Enrich any url-type fields in a submitted response. Designed to run in the
 * background via `context.waitUntil(...)`. Never throws (every step is guarded).
 *
 * Behavior is identical to the previously-inline surveys-submit block:
 * for each url-type field with an http(s) value, scrape it, run a quick content
 * analysis, then re-read the current form_data and write `_enriched_<field>` back.
 */
export async function enrichResponseUrls({
  env,
  origin,
  responseId,
  formSchema,
  formData,
}: EnrichResponseUrlsArgs): Promise<void> {
  try {
    const urlFields = urlFieldsFromSchema(formSchema)
    for (const fieldName of urlFields) {
      const url = formData[fieldName]
      if (!url || typeof url !== 'string' || !url.startsWith('http')) continue

      try {
        // Quick scrape for title/excerpt
        const scraped = await scrapeUrl(url, env.APIFY_API_KEY)

        // Full content analysis via internal API call (entities, claims, sentiment, topics)
        let analysis: AnalysisResult | null = null
        try {
          const analysisRes = await fetch(`${origin}/api/content-intelligence/analyze-url`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-User-Hash': env.SYSTEM_USER_HASH || 'system-internal' },
            body: JSON.stringify({ url, mode: 'quick' }),
            signal: AbortSignal.timeout(25000),
          })
          if (analysisRes.ok) {
            analysis = await analysisRes.json() as AnalysisResult
          } else {
            console.warn(`[URL Enrichment] Content analysis returned ${analysisRes.status} for ${url}`)
          }
        } catch (e) {
          console.error(`[URL Enrichment] Content analysis failed for ${url}:`, e)
        }

        const enrichment = enrichmentRecord(fieldName, url, scraped, analysis)

        // Store enrichment alongside the response
        const currentData = await env.DB.prepare(
          'SELECT form_data FROM survey_responses WHERE id = ?'
        ).bind(responseId).first<{ form_data: string }>()

        if (currentData) {
          const data = JSON.parse(currentData.form_data)
          data[`_enriched_${fieldName}`] = enrichment
          await env.DB.prepare(
            'UPDATE survey_responses SET form_data = ? WHERE id = ?'
          ).bind(JSON.stringify(data), responseId).run()
        }
      } catch (e) {
        console.error(`[URL Enrichment] URL enrichment failed for ${url}:`, e)
      }
    }
  } catch (e) {
    console.error('[URL Enrichment] Enrichment failed:', e)
  }
}
