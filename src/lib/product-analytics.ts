import { getCopHeaders } from './cop-auth'
import {
  classifyProductPage,
  type BrowserProductEvent,
  type ProductAction,
  type ProductFeature,
} from './product-analytics-contract'

let started = false
let lastPageKey = ''

interface AnalyticsRouter {
  state: { location: { pathname: string } }
  subscribe: (listener: (state: { location: { pathname: string } }) => void) => () => void
}

function trackingAllowed(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false
  const privacyNavigator = navigator as Navigator & { globalPrivacyControl?: boolean }
  return navigator.doNotTrack !== '1' && privacyNavigator.globalPrivacyControl !== true
}

export function trackProductEvent(event: BrowserProductEvent): void {
  if (!trackingAllowed()) return
  try {
    void fetch('/api/analytics/events', {
      method: 'POST',
      headers: getCopHeaders(),
      credentials: 'same-origin',
      keepalive: true,
      body: JSON.stringify({ events: [event] }),
    }).catch(() => {})
  } catch {
    // Product telemetry is intentionally non-blocking.
  }
}

export function trackProductIntent(feature: ProductFeature, action: ProductAction): void {
  trackProductEvent({ event: 'intent', feature, action })
}

/** Start one page-view stream for initial load and SPA navigations. */
export function startProductAnalytics(router: AnalyticsRouter): () => void {
  if (started) return () => {}
  started = true

  const trackLocation = (pathname: string) => {
    const classification = classifyProductPage(pathname)
    if (!classification) return
    const pageKey = `${classification.feature}:${pathname}`
    if (pageKey === lastPageKey) return
    lastPageKey = pageKey
    trackProductEvent({ event: 'page_view', ...classification })
  }

  trackLocation(router.state.location.pathname)
  const unsubscribe = router.subscribe(state => trackLocation(state.location.pathname))
  return () => {
    unsubscribe()
    started = false
    lastPageKey = ''
  }
}
