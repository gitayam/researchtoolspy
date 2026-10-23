/**
 * Edits to tasks, claims and hypotheses carry the `updated_at` the editor saw
 * (`if_updated_at`). If someone else saved in between, the server answers
 * 409 `{ code: 'STALE_WRITE', current }` instead of overwriting their change.
 * The UI then shows `StaleWriteNotice` (components/cop/CopStaleWrite).
 */
import { getCopHeaders } from '@/lib/cop-auth'

export type PreconditionResult =
  | { kind: 'ok'; data: unknown }
  | { kind: 'stale'; current: unknown }
  | { kind: 'error'; status: number; message: string }

export async function copPutWithPrecondition(
  url: string,
  body: Record<string, unknown>,
  seenUpdatedAt: string | null | undefined,
  init: { method?: 'PUT' | 'PATCH'; headers?: Record<string, string> } = {},
): Promise<PreconditionResult> {
  const payload = seenUpdatedAt ? { ...body, if_updated_at: seenUpdatedAt } : body
  let res: Response
  try {
    res = await fetch(url, {
      method: init.method ?? 'PUT',
      headers: { ...getCopHeaders(), ...(init.headers ?? {}) },
      body: JSON.stringify(payload),
    })
  } catch {
    return { kind: 'error', status: 0, message: 'Could not reach the server. Check your connection.' }
  }
  const data = await res.json().catch(() => null) as Record<string, unknown> | null
  if (res.status === 409 && data?.code === 'STALE_WRITE') return { kind: 'stale', current: data.current ?? null }
  if (!res.ok) {
    const message = typeof data?.error === 'string' ? data.error.slice(0, 200) : `The change was not saved (HTTP ${res.status}).`
    return { kind: 'error', status: res.status, message }
  }
  return { kind: 'ok', data }
}
