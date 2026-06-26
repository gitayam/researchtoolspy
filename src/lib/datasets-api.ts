/**
 * Datasets API client helpers.
 *
 * Root cause this guards against: the frontend called the SINGULAR
 * `fetch('/api/dataset')`, but the only Pages Function that exists is the PLURAL
 * `functions/api/datasets.ts` (→ `/api/datasets`). Cloudflare Pages Functions use
 * exact file-based routing, so `/api/dataset` returned 404 and the Datasets
 * feature silently failed (empty lists, failed create/update/delete).
 *
 * The path now lives in ONE place ({@link DATASETS_API_PATH}) so the singular
 * typo cannot drift back in. Kept free of React / DOM-framework imports so it is
 * trivially unit-testable: `fetchImpl` is injectable (defaulting to the real
 * global) purely so tests can supply a fake. Production callers pass only the
 * data they already passed before — behavior is unchanged apart from the URL.
 */

import type { Dataset } from '@/types/dataset'

/** Single source of truth for the Datasets endpoint path (PLURAL — see header). */
export const DATASETS_API_PATH = '/api/datasets'

/** Minimal `Response` surface these helpers touch. */
export interface DatasetsResponseLike {
  ok: boolean
  status: number
  json: () => Promise<unknown>
}

export type DatasetsFetch = (
  input: string,
  init?: {
    method?: string
    headers?: Record<string, string>
    body?: string
    signal?: AbortSignal
  }
) => Promise<DatasetsResponseLike>

export interface ListDatasetsOptions {
  headers: Record<string, string>
  signal?: AbortSignal
  fetchImpl?: DatasetsFetch
}

export interface CreateDatasetOptions {
  headers: Record<string, string>
  body: unknown
  signal?: AbortSignal
  fetchImpl?: DatasetsFetch
}

/** Shape returned by the list endpoint. `dataset` is the array of records. */
export interface ListDatasetsResult {
  dataset?: Dataset[]
}

/** Shape returned by the create endpoint. */
export interface CreateDatasetResult {
  id?: number | string
  message?: string
}

/**
 * List datasets (GET `/api/datasets`).
 *
 * The endpoint returns `{ dataset: Dataset[] }`; this returns the full parsed
 * JSON object so callers keep reading `data.dataset` exactly as before. Throws
 * on a non-OK response so callers can surface it.
 */
export async function listDatasets({
  headers,
  signal,
  fetchImpl = fetch as unknown as DatasetsFetch,
}: ListDatasetsOptions): Promise<ListDatasetsResult> {
  const res = await fetchImpl(DATASETS_API_PATH, { headers, signal })
  if (!res.ok) {
    throw new Error(`Failed to load datasets (HTTP ${res.status})`)
  }
  return (await res.json()) as ListDatasetsResult
}

/**
 * Create a dataset (POST `/api/datasets`).
 *
 * `body` is sent as JSON. Returns the parsed JSON response (`{ id, message }`).
 * Throws on a non-OK response so callers can surface it.
 */
export async function createDataset({
  headers,
  body,
  signal,
  fetchImpl = fetch as unknown as DatasetsFetch,
}: CreateDatasetOptions): Promise<CreateDatasetResult> {
  const res = await fetchImpl(DATASETS_API_PATH, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal,
  })
  if (!res.ok) {
    throw new Error(`Failed to create dataset (HTTP ${res.status})`)
  }
  return (await res.json()) as CreateDatasetResult
}
