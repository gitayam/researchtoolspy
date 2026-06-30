/**
 * COP playbook execution log fetch helper.
 *
 * Framework-free, injectable fetch — mirrors the pattern used by
 * `cop-persona-api.ts` and `cop-entity-update.ts`.  Callers pass
 * `headers` in (e.g. from `getCopHeaders()`) and may inject a fake
 * `fetchImpl` for unit tests.
 *
 * Route: GET /api/cop/<sessionId>/playbooks/<playbookId>/log
 */

export interface PlaybookLogEntry {
  id: string
  rule_id: string
  rule_name: string | null
  trigger_event: string
  trigger_event_id: string | null
  actions_taken: Array<{
    action: string
    result?: Record<string, unknown>
    error?: string
  }>
  status: 'success' | 'partial' | 'failed'
  error_message: string | null
  duration_ms: number | null
  created_at: string
}

export interface PlaybookLogResponse {
  log: PlaybookLogEntry[]
  total: number
  limit: number
  offset: number
}

export interface PlaybookLogResponseLike {
  ok: boolean
  status: number
  json: () => Promise<unknown>
}

export type PlaybookLogFetch = (
  input: string,
  init?: {
    headers?: Record<string, string>
    signal?: AbortSignal
  }
) => Promise<PlaybookLogResponseLike>

/**
 * Build the log endpoint path for a playbook. Exported so callers and
 * tests share one definition of the route shape.
 */
export function copPlaybookLogPath(sessionId: string, playbookId: string): string {
  return `/api/cop/${sessionId}/playbooks/${playbookId}/log`
}

export interface FetchPlaybookLogOptions {
  sessionId: string
  playbookId: string
  /** Auth headers (e.g. from `getCopHeaders()`). Passed in for testability. */
  headers: Record<string, string>
  limit?: number
  offset?: number
  statusFilter?: 'success' | 'partial' | 'failed' | ''
  signal?: AbortSignal
  fetchImpl?: PlaybookLogFetch
}

/**
 * Fetch execution log entries for a specific playbook.
 *
 * Returns `{ log, total, limit, offset }`. Throws on non-OK responses,
 * surfacing the endpoint's `error` message when present.
 */
export async function fetchPlaybookLog({
  sessionId,
  playbookId,
  headers,
  limit = 50,
  offset = 0,
  statusFilter = '',
  signal,
  fetchImpl = fetch as unknown as PlaybookLogFetch,
}: FetchPlaybookLogOptions): Promise<PlaybookLogResponse> {
  let url = `${copPlaybookLogPath(sessionId, playbookId)}?limit=${limit}&offset=${offset}`
  if (statusFilter) url += `&status=${statusFilter}`

  const res = await fetchImpl(url, { headers, signal })

  if (!res.ok) {
    let message = `Failed to fetch playbook log (HTTP ${res.status})`
    try {
      const errData = (await res.json()) as { error?: string } | null
      if (errData?.error) message = errData.error
    } catch {
      // Non-JSON error body — keep the generic message.
    }
    throw new Error(message)
  }

  const data = (await res.json()) as PlaybookLogResponse
  return {
    log: data.log ?? [],
    total: data.total ?? 0,
    limit: data.limit ?? limit,
    offset: data.offset ?? offset,
  }
}
