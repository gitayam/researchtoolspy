/**
 * Research submission-forms API client helpers.
 *
 * Root cause this guards against: the two READ fetches on
 * `src/pages/EvidenceSubmissionsPage.tsx` (`loadForms`, `loadSubmissions`) sent
 * NO auth headers, while both endpoints (`/api/research/forms/list`,
 * `/api/research/submissions/list`) hard-401 via `getUserFromRequest`. The page
 * therefore showed "Authentication required" on every load even though the
 * SAME component's mutations already attached auth via `getCopHeaders()`. The
 * request-building now lives in one place so the auth omission cannot drift
 * back in.
 *
 * Kept free of React / DOM-framework imports — and crucially, it does NOT read
 * `localStorage` / call `getCopHeaders()` itself: the caller passes `headers`
 * IN. That keeps the module trivially unit-testable (`fetchImpl` is injectable,
 * defaulting to the real global). Mirrors `datasets-api.ts`.
 */

/** Single source of truth for the forms-list endpoint path. */
export const RESEARCH_FORMS_LIST_PATH = '/api/research/forms/list'

/** Single source of truth for the submissions-list endpoint path. */
export const RESEARCH_SUBMISSIONS_LIST_PATH = '/api/research/submissions/list'

/** Minimal `Response` surface these helpers touch. */
export interface ResearchResponseLike {
  ok: boolean
  status: number
  json: () => Promise<unknown>
}

export type ResearchFetch = (
  input: string,
  init?: {
    method?: string
    headers?: Record<string, string>
    body?: string
    signal?: AbortSignal
  }
) => Promise<ResearchResponseLike>

export interface ListResearchFormsOptions {
  /** Workspace to scope the forms query to (may be ''; preserves prior behavior). */
  workspaceId: string
  headers: Record<string, string>
  signal?: AbortSignal
  fetchImpl?: ResearchFetch
}

export interface ListResearchSubmissionsOptions {
  /**
   * Query params the page already builds (e.g. a `URLSearchParams` with
   * `status`). Anything with a `toString()` that yields a query string works;
   * pass a plain string to send a pre-built query.
   */
  params: URLSearchParams | string
  headers: Record<string, string>
  signal?: AbortSignal
  fetchImpl?: ResearchFetch
}

/** Shape returned by the forms-list endpoint. `forms` is the array of records. */
export interface ListResearchFormsResult {
  success?: boolean
  forms?: unknown[]
  count?: number
  error?: string
}

/** Shape returned by the submissions-list endpoint. `submissions` is the array. */
export interface ListResearchSubmissionsResult {
  success?: boolean
  submissions?: unknown[]
  count?: number
  error?: string
}

/**
 * List submission forms (GET `/api/research/forms/list?workspaceId=...`).
 *
 * Returns the full parsed JSON so callers keep reading `data.forms` exactly as
 * before. Throws on a non-OK response, including the endpoint's `error` message
 * when present (so the page's existing `data.error || 'Failed…'` semantics are
 * preserved at the call site).
 */
export async function listResearchForms({
  workspaceId,
  headers,
  signal,
  fetchImpl = fetch as unknown as ResearchFetch,
}: ListResearchFormsOptions): Promise<ListResearchFormsResult> {
  const url = `${RESEARCH_FORMS_LIST_PATH}?workspaceId=${encodeURIComponent(workspaceId)}`
  const res = await fetchImpl(url, { headers, signal })
  const data = (await res.json()) as ListResearchFormsResult
  if (!res.ok) {
    throw new Error(data?.error || `Failed to load forms (HTTP ${res.status})`)
  }
  return data
}

/**
 * List submissions for review (GET `/api/research/submissions/list?<params>`).
 *
 * `params` is the query the page already constructs (status filter, etc.).
 * Returns the full parsed JSON so callers keep reading `data.submissions`.
 * Throws on a non-OK response, surfacing the endpoint's `error` when present.
 */
export async function listResearchSubmissions({
  params,
  headers,
  signal,
  fetchImpl = fetch as unknown as ResearchFetch,
}: ListResearchSubmissionsOptions): Promise<ListResearchSubmissionsResult> {
  const query = typeof params === 'string' ? params : params.toString()
  const url = query ? `${RESEARCH_SUBMISSIONS_LIST_PATH}?${query}` : RESEARCH_SUBMISSIONS_LIST_PATH
  const res = await fetchImpl(url, { headers, signal })
  const data = (await res.json()) as ListResearchSubmissionsResult
  if (!res.ok) {
    throw new Error(data?.error || `Failed to load submissions (HTTP ${res.status})`)
  }
  return data
}
