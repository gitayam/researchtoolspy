/** At most this many video players (not still images) run at once in a camera grid. */
export const MAX_LIVE_PLAYERS = 4

/** Paths whose CSP admits the camera players (public/_headers). */
const COP_PLAYER_PATH = /^\/(?:dashboard\/cop|public\/cop)\/[^/]+/

// The document's own path, captured when this module first loads. The COP route
// gate imports it eagerly, so that is app start, before any in-app navigation.
const INITIAL_DOCUMENT_PATH = typeof window === 'undefined' ? '' : window.location.pathname

/**
 * Was this document loaded on a COP route, whose CSP admits the camera players?
 * An in-app navigation keeps the CSP of the page first loaded.
 */
export function camPlayersAllowedHere(): boolean {
  if (typeof window === 'undefined') return false
  let path = INITIAL_DOCUMENT_PATH
  try {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
    if (nav?.name) path = new URL(nav.name).pathname
  } catch {
    // Keep the path captured at app start.
  }
  return COP_PLAYER_PATH.test(path)
}
