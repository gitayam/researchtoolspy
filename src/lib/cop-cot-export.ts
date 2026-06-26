/**
 * COP CoT (Cursor-on-Target) export helper.
 *
 * The backend endpoint `GET /api/cop/:id/cot` REQUIRES authentication via the
 * `X-User-Hash` header (and optionally a Bearer token). A plain
 * `window.open('/api/cop/:id/cot')` browser navigation cannot attach those
 * headers, so the request arrives unauthenticated and the server returns 401
 * (owner, no header) or 403 (non-owner). This module downloads the XML via an
 * authenticated `fetch` and saves it as a file blob instead.
 *
 * Kept free of React / DOM-framework imports so it is trivially unit-testable:
 * `fetchImpl`, `documentImpl`, and `urlImpl` are injectable (defaulting to the
 * real globals) purely so tests can supply fakes. Production callers pass only
 * `{ sessionId, headers }`.
 */

/** Minimal anchor surface the download path touches. */
export interface CotAnchorLike {
  href: string
  download: string
  click: () => void
}

/** Minimal `document` surface the download path touches. */
export interface CotDocumentLike {
  createElement: (tagName: 'a') => CotAnchorLike
}

/** Minimal `URL` surface the download path touches. */
export interface CotUrlLike {
  createObjectURL: (obj: Blob) => string
  revokeObjectURL: (url: string) => void
}

export type CotFetch = (
  input: string,
  init?: { headers?: Record<string, string> }
) => Promise<{ ok: boolean; status: number; text: () => Promise<string> }>

export interface DownloadCotExportOptions {
  sessionId: string
  headers: Record<string, string>
  fetchImpl?: CotFetch
  documentImpl?: CotDocumentLike
  urlImpl?: CotUrlLike
}

/**
 * Suggested download filename for a session's CoT export.
 *
 * Session IDs are already prefixed `cop-` (e.g. `cop-abc`), so we don't double
 * the prefix: `cotExportFilename('cop-abc')` → `cop-abc.cot.xml`.
 */
export function cotExportFilename(sessionId: string): string {
  const base = sessionId.startsWith('cop-') ? sessionId : `cop-${sessionId}`
  return `${base}.cot.xml`
}

/**
 * Fetch the CoT XML for a session (authenticated) and trigger a file download.
 *
 * Throws an Error with a useful (status + reason) message on a non-OK response
 * so callers can surface it via a toast.
 */
export async function downloadCotExport({
  sessionId,
  headers,
  fetchImpl = fetch as unknown as CotFetch,
  documentImpl = document as unknown as CotDocumentLike,
  urlImpl = URL as unknown as CotUrlLike,
}: DownloadCotExportOptions): Promise<void> {
  const res = await fetchImpl(`/api/cop/${sessionId}/cot`, { headers })

  if (!res.ok) {
    const reason =
      res.status === 401
        ? 'authentication required'
        : res.status === 403
          ? 'access denied'
          : res.status === 404
            ? 'COP session not found'
            : 'server error'
    throw new Error(`CoT export request failed (HTTP ${res.status}: ${reason})`)
  }

  const xml = await res.text()
  const blob = new Blob([xml], { type: 'application/xml' })
  const objectUrl = urlImpl.createObjectURL(blob)
  try {
    const anchor = documentImpl.createElement('a')
    anchor.href = objectUrl
    anchor.download = cotExportFilename(sessionId)
    anchor.click()
  } finally {
    urlImpl.revokeObjectURL(objectUrl)
  }
}
