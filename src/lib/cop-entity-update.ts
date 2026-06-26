/**
 * COP entity update helper (PUT).
 *
 * Wires the COP entity drawer's "Edit" button to the existing per-type PUT
 * endpoints (`functions/api/<type>/[id].ts`, each exporting `onRequestPut`).
 *
 * The drawer tracks entity types by their PLURAL tab key
 * (`actors | sources | events | places | behaviors`), which already matches the
 * Pages Function route segment one-to-one. {@link ENTITY_TYPE_TO_PATH} is the
 * single source of truth for that mapping so a route-segment typo cannot drift
 * in (mirrors the rationale behind `DATASETS_API_PATH` in `datasets-api.ts`).
 *
 * Kept free of React / DOM / localStorage: `headers` are passed IN (callers use
 * `getCopHeaders()` from `cop-auth.ts`) and `fetchImpl` is injectable, defaulting
 * to the real global, so this is trivially unit-testable with a fake.
 */

/** The drawer's plural entity-type keys — identical to the API route segment. */
export type CopEntityType = 'actors' | 'sources' | 'events' | 'places' | 'behaviors'

/**
 * Single source of truth mapping a drawer entity-type to its API route segment.
 * They happen to be identical today, but routing through this map means callers
 * never hand-build `/api/<type>/<id>` strings and the segment cannot silently
 * drift (compare `DATASETS_API_PATH`).
 */
export const ENTITY_TYPE_TO_PATH: Record<CopEntityType, string> = {
  actors: 'actors',
  sources: 'sources',
  events: 'events',
  places: 'places',
  behaviors: 'behaviors',
}

/** Minimal `Response` surface this helper touches. */
export interface CopEntityResponseLike {
  ok: boolean
  status: number
  json: () => Promise<unknown>
}

export type CopEntityFetch = (
  input: string,
  init?: {
    method?: string
    headers?: Record<string, string>
    body?: string
    signal?: AbortSignal
  }
) => Promise<CopEntityResponseLike>

export interface UpdateCopEntityOptions {
  /** Drawer tab key / entity type (plural). Maps to the route segment. */
  entityType: CopEntityType
  /** The entity's TEXT id. */
  id: string
  /** Fields to update — shape matches the type's PUT handler body. */
  body: unknown
  /** Auth + content headers (e.g. from `getCopHeaders()`). Passed in for testability. */
  headers: Record<string, string>
  signal?: AbortSignal
  fetchImpl?: CopEntityFetch
}

/**
 * Build the PUT path for a given entity type + id. Exported so callers and tests
 * share one definition of the route shape.
 */
export function copEntityPath(entityType: CopEntityType, id: string): string {
  const segment = ENTITY_TYPE_TO_PATH[entityType]
  if (!segment) {
    throw new Error(`Unknown COP entity type: ${entityType}`)
  }
  return `/api/${segment}/${id}`
}

/**
 * Update a COP entity (PUT `/api/<entityType>/<id>`).
 *
 * `body` is sent as JSON. Returns the parsed JSON response (the updated entity).
 * Throws on a non-OK response, surfacing the endpoint's `error` message when
 * present so the UI can show it.
 */
export async function updateCopEntity({
  entityType,
  id,
  body,
  headers,
  signal,
  fetchImpl = fetch as unknown as CopEntityFetch,
}: UpdateCopEntityOptions): Promise<unknown> {
  const res = await fetchImpl(copEntityPath(entityType, id), {
    method: 'PUT',
    headers,
    body: JSON.stringify(body),
    signal,
  })

  if (!res.ok) {
    let message = `Failed to update ${entityType.slice(0, -1)} (HTTP ${res.status})`
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
