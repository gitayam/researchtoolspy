/**
 * COP persona update / soft-delete helpers.
 *
 * Wires the persona panel's "Edit" and "Delete" controls to the existing persona
 * endpoint (`functions/api/cop/[id]/personas.ts`). That endpoint is action-routed
 * through a single POST: a body containing `{ id, ...fields }` performs an UPDATE
 * (`UPDATE cop_personas SET ... WHERE id = ? AND cop_session_id = ?`). There is no
 * separate PUT/DELETE handler — and we deliberately do NOT add one:
 *
 *   - {@link updateCopPersona} reuses the existing update path (POST `{ id, ... }`).
 *   - {@link deleteCopPersona} is a SOFT delete — it reuses the same update path to
 *     set `status: 'deleted'`. The `status` enum already includes `'deleted'`, so
 *     this is reversible and matches the schema (no hard SQL DELETE).
 *
 * Kept free of React / DOM / localStorage: `headers` are passed IN (callers use
 * `getCopHeaders()` from `cop-auth.ts`) and `fetchImpl` is injectable, defaulting
 * to the real global, so this is trivially unit-testable with a fake. Mirrors
 * `cop-entity-update.ts` / `datasets-api.ts`.
 */

/** Status value used for a soft delete. Single source of truth. */
export const PERSONA_DELETED_STATUS = 'deleted' as const

/** Minimal `Response` surface these helpers touch. */
export interface CopPersonaResponseLike {
  ok: boolean
  status: number
  json: () => Promise<unknown>
}

export type CopPersonaFetch = (
  input: string,
  init?: {
    method?: string
    headers?: Record<string, string>
    body?: string
    signal?: AbortSignal
  }
) => Promise<CopPersonaResponseLike>

/**
 * Build the personas endpoint path for a session. Exported so callers and tests
 * share one definition of the route shape. The endpoint is action-routed by body
 * (an `{ id, ... }` body performs the UPDATE), so update and soft-delete both POST
 * here — there is no per-id URL segment.
 */
export function copPersonaPath(sessionId: string): string {
  return `/api/cop/${sessionId}/personas`
}

/** Fields the persona UPDATE path accepts (matches the endpoint's allow-list). */
export interface CopPersonaUpdateBody {
  display_name?: string
  platform?: string
  handle?: string | null
  profile_url?: string | null
  status?: 'active' | 'suspended' | 'deleted' | 'unknown'
  linked_actor_id?: string | null
  notes?: string | null
}

export interface UpdateCopPersonaOptions {
  /** The COP session id (`cop-...`). */
  sessionId: string
  /** The persona's TEXT id (`per-...`). */
  id: string
  /** Fields to update — shape matches the endpoint's update allow-list. */
  body: CopPersonaUpdateBody
  /** Auth + content headers (e.g. from `getCopHeaders()`). Passed in for testability. */
  headers: Record<string, string>
  signal?: AbortSignal
  fetchImpl?: CopPersonaFetch
}

export interface DeleteCopPersonaOptions {
  /** The COP session id (`cop-...`). */
  sessionId: string
  /** The persona's TEXT id (`per-...`). */
  id: string
  /** Auth + content headers (e.g. from `getCopHeaders()`). Passed in for testability. */
  headers: Record<string, string>
  signal?: AbortSignal
  fetchImpl?: CopPersonaFetch
}

async function postPersona(
  sessionId: string,
  body: Record<string, unknown>,
  headers: Record<string, string>,
  fetchImpl: CopPersonaFetch,
  signal: AbortSignal | undefined,
  failVerb: string,
): Promise<unknown> {
  const res = await fetchImpl(copPersonaPath(sessionId), {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal,
  })

  if (!res.ok) {
    let message = `Failed to ${failVerb} persona (HTTP ${res.status})`
    try {
      const errData = (await res.json()) as { error?: string } | null
      if (errData?.error) message = errData.error
    } catch {
      // Non-JSON error body — keep the generic message.
    }
    throw new Error(message)
  }

  return res.json()
}

/**
 * Update a COP persona (POST `/api/cop/<sessionId>/personas` with `{ id, ...body }`).
 *
 * Reuses the endpoint's existing action-routed update path. Returns the parsed
 * JSON response. Throws on a non-OK response, surfacing the endpoint's `error`
 * message when present so the UI can show it.
 */
export async function updateCopPersona({
  sessionId,
  id,
  body,
  headers,
  signal,
  fetchImpl = fetch as unknown as CopPersonaFetch,
}: UpdateCopPersonaOptions): Promise<unknown> {
  return postPersona(sessionId, { id, ...body }, headers, fetchImpl, signal, 'update')
}

/**
 * Soft-delete a COP persona by setting `status: 'deleted'` via the update path
 * (POST `/api/cop/<sessionId>/personas` with `{ id, status: 'deleted' }`).
 *
 * Reversible (status can be set back to 'active') and matches the schema enum —
 * no hard SQL DELETE. Returns the parsed JSON response. Throws on a non-OK
 * response, surfacing the endpoint's `error` message when present.
 */
export async function deleteCopPersona({
  sessionId,
  id,
  headers,
  signal,
  fetchImpl = fetch as unknown as CopPersonaFetch,
}: DeleteCopPersonaOptions): Promise<unknown> {
  return postPersona(
    sessionId,
    { id, status: PERSONA_DELETED_STATUS },
    headers,
    fetchImpl,
    signal,
    'delete',
  )
}
