import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * ScrollToTop component that scrolls to the top of the page on route change
 * This ensures that navigating between pages always starts at the top,
 * providing a better user experience.
 */
export function ScrollToTop() {
  const { pathname } = useLocation()

  useEffect(() => {
    // Scroll to top when pathname changes
    window.scrollTo(0, 0)
  }, [pathname])

  return null
}
