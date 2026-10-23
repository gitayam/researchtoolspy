/**
 * JSON requests to the COP API that keep the server's error `code`.
 *
 * The input contract's routes (tags, suggest, geocode, uploads) ship in the same
 * release as the UI but may land after it, so a 404 or 405 from one of them
 * (`newRoute: true`) is reported as `NOT_AVAILABLE` and the caller says "not
 * available yet" instead of failing. For the long-standing routes a 404 means
 * what it says (no such COP or item) and keeps its status.
 */
import { getCopAuthHeaders, getCopHeaders } from '@/lib/cop-auth'
import type { CopEntityType } from '@/types/cop'

export type CopRequestResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; code: string | null; error: string | null }

export const NOT_AVAILABLE = 'NOT_AVAILABLE'

export async function copRequest<T>(
  url: string,
  init: RequestInit & { json?: unknown; newRoute?: boolean } = {},
): Promise<CopRequestResult<T>> {
  const { json, newRoute, ...rest } = init
  const isForm = typeof FormData !== 'undefined' && rest.body instanceof FormData
  let res: Response
  try {
    res = await fetch(url, {
      ...rest,
      headers: { ...(isForm ? getCopAuthHeaders() : getCopHeaders()), ...(rest.headers as Record<string, string> | undefined) },
      ...(json !== undefined ? { body: JSON.stringify(json) } : {}),
    })
  } catch {
    return { ok: false, status: 0, code: null, error: null }
  }
  const body = await res.json().catch(() => null) as Record<string, unknown> | null
  if (res.ok) return { ok: true, status: res.status, data: (body ?? {}) as T }
  if (newRoute && (res.status === 404 || res.status === 405)) {
    return { ok: false, status: res.status, code: NOT_AVAILABLE, error: null }
  }
  return {
    ok: false,
    status: res.status,
    code: typeof body?.code === 'string' ? body.code : null,
    error: typeof body?.error === 'string' ? body.error.slice(0, 300) : null,
  }
}

/** The window event panels listen to for "something of these kinds changed". */
export const COP_CHANGED_EVENT = 'cop:changed'

/** Tell the open COP page that items of these kinds changed (contract: `cop:changed`). */
export function notifyCopChanged(types: CopEntityType[]): void {
  if (typeof window === 'undefined' || types.length === 0) return
  window.dispatchEvent(new CustomEvent(COP_CHANGED_EVENT, { detail: { types } }))
}

/**
 * The id of the item a create call made. The routes answer differently:
 * `{ id }` (evidence, markers, tasks, RFIs, hypotheses), `{ ids: [...] }`
 * (timeline) and, for a duplicate link, `{ evidence: { id }, duplicate: true }`.
 */
export function createdItemId(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null
  const d = data as Record<string, unknown>
  const direct = d.id ?? (Array.isArray(d.ids) ? d.ids[0] : undefined)
  const nested = ['evidence', 'marker', 'task', 'rfi', 'hypothesis', 'entry']
    .map(key => (d[key] && typeof d[key] === 'object' ? (d[key] as Record<string, unknown>).id : undefined))
    .find(v => v !== undefined && v !== null)
  const id = direct ?? nested
  if (typeof id === 'number' && Number.isFinite(id) && id > 0) return String(id)
  if (typeof id === 'string' && id.trim() && id.length <= 100) return id
  return null
}
