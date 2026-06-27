/**
 * Classify a fetch rejection as a transient/non-actionable error (COP-15).
 *
 * Background pollers (COP workspace stats every 60s, playbook panel every 30s)
 * fire fetches that get torn down when the user navigates away or the component
 * unmounts mid-flight. In WebKit/Safari an aborted or dropped fetch surfaces as
 * `TypeError: Load failed` (NOT a DOMException AbortError), so a naive
 * `err.name !== 'AbortError'` guard still logs it — spamming the console with
 * non-actionable "Failed to fetch workspace stats: TypeError: Load failed"
 * noise on every navigation, even though the next poll recovers cleanly.
 *
 * This returns true for the cases a poller should swallow quietly:
 *  - DOMException AbortError (explicit abort via AbortController)
 *  - network-level fetch rejections: WebKit "Load failed", Chrome
 *    "Failed to fetch" / "NetworkError when attempting to fetch resource".
 * Genuine application errors (non-TypeError, e.g. a thrown `Error('...')` from
 * a bad response) are NOT transient and should still be logged.
 */
export function isTransientFetchError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as { name?: string; message?: string }
  if (e.name === 'AbortError') return true
  // Network-layer rejections from fetch() are TypeErrors across browsers.
  if (e.name === 'TypeError' && typeof e.message === 'string') {
    return /load failed|failed to fetch|networkerror|network request failed/i.test(e.message)
  }
  return false
}
