/**
 * Request bodies of the public submission routes (survey submit, evidence-form
 * drop-submit, COP intake submit), read with a size cap BEFORE anything is parsed,
 * decoded or sanitized.
 *
 * The routes' own limit is 64K characters of form data. A JSON body can spend up to
 * 3 bytes per character (non-Latin text), so the byte cap is 3 × 64K plus room for
 * the other fields (name, contact, password, Turnstile token): anything the
 * character limit allows fits, and nothing much larger is ever read.
 */

export const FORM_DATA_MAX_CHARS = 65536
export const SUBMISSION_BODY_MAX_BYTES = 3 * FORM_DATA_MAX_CHARS + 8 * 1024

/** The body as text, or null when it is (or declares it is) over `max` bytes; read with a running count. */
export async function readCappedText(request: Request, max: number): Promise<string | null> {
  const declared = Number(request.headers.get('Content-Length') ?? '')
  if (Number.isFinite(declared) && declared > max) return null
  if (!request.body) return ''
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > max) {
      await reader.cancel().catch(() => {})
      return null
    }
    chunks.push(value)
  }
  const all = new Uint8Array(size)
  let at = 0
  for (const chunk of chunks) {
    all.set(chunk, at)
    at += chunk.byteLength
  }
  return new TextDecoder().decode(all)
}

export type CappedJson<T> =
  | { ok: true; value: T; reason?: undefined }
  | { ok: false; reason: 'too_large' | 'invalid'; value?: undefined }

/** A JSON object body within the cap. */
export async function readCappedJson<T = Record<string, unknown>>(request: Request, max = SUBMISSION_BODY_MAX_BYTES): Promise<CappedJson<T>> {
  const raw = await readCappedText(request, max)
  if (raw === null) return { ok: false, reason: 'too_large' }
  try {
    const value = JSON.parse(raw)
    return value && typeof value === 'object' && !Array.isArray(value) ? { ok: true, value: value as T } : { ok: false, reason: 'invalid' }
  } catch {
    return { ok: false, reason: 'invalid' }
  }
}

/** True when the form answers are over the routes' 64K-character limit. */
export function formDataTooLarge(formData: unknown): boolean {
  return JSON.stringify(formData ?? {}).length > FORM_DATA_MAX_CHARS
}
