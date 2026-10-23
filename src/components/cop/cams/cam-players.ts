/** At most this many video players (not still images) run at once in a camera grid. */
export const MAX_LIVE_PLAYERS = 4

/**
 * Was this document loaded on a COP route, whose CSP admits the camera players
 * (public/_headers)? An in-app navigation keeps the CSP of the page first loaded.
 */
export function camPlayersAllowedHere(): boolean {
  if (typeof window === 'undefined') return false
  let path = window.location.pathname
  try {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
    if (nav?.name) path = new URL(nav.name).pathname
  } catch {
    // Fall back to the current path.
  }
  return /^\/(?:dashboard\/cop|public\/cop)\/[^/]+/.test(path)
}
