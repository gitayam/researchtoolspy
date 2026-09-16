/**
 * React.lazy that survives a deploy happening under an open tab.
 *
 * Vite emits content-hashed chunks (index-D9oWDZgb.js). A tab opened before a
 * deploy holds an entry bundle that names the OLD hashes, so the first
 * navigation afterwards requests a chunk that no longer exists. Cloudflare Pages
 * answers a missing asset with the SPA fallback -- index.html, served as
 * text/html -- and the browser refuses it:
 *
 *   TypeError: 'text/html' is not a valid JavaScript MIME type.
 *
 * React Router catches that during render and shows the error boundary, so the
 * user sees a full-page crash for what is really just a stale tab. The fix that
 * matches the cause is to fetch the page again: one reload pulls the new entry
 * bundle and the correct chunk names.
 *
 * The reload is guarded by a timestamp in sessionStorage so a genuinely broken
 * deploy degrades to the normal error boundary instead of a reload loop.
 */

import { lazy, type ComponentType } from 'react'

const RELOAD_KEY = 'researchtools.chunk-reload.v1'
const RELOAD_COOLDOWN_MS = 10_000

/** Browsers disagree on the wording, so match the whole family. */
function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
  return /Loading chunk|Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|not a valid JavaScript MIME type|ChunkLoadError/i.test(message)
}

function reloadedRecently(): boolean {
  try {
    const previous = Number(sessionStorage.getItem(RELOAD_KEY))
    return Number.isFinite(previous) && previous > 0 && Date.now() - previous < RELOAD_COOLDOWN_MS
  } catch {
    // No sessionStorage (private mode): assume not, and accept one reload.
    return false
  }
}

function markReloaded(): void {
  try { sessionStorage.setItem(RELOAD_KEY, String(Date.now())) } catch { /* non-fatal */ }
}

function clearReloadMark(): void {
  try { sessionStorage.removeItem(RELOAD_KEY) } catch { /* non-fatal */ }
}

export function lazyWithReload<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
) {
  return lazy(async () => {
    try {
      const module = await factory()
      clearReloadMark()
      return module
    } catch (error) {
      if (isChunkLoadError(error) && !reloadedRecently()) {
        markReloaded()
        window.location.reload()
        // The document is being replaced; never resolve, so nothing renders
        // against a module we could not load.
        return new Promise<never>(() => {})
      }
      throw error
    }
  })
}
