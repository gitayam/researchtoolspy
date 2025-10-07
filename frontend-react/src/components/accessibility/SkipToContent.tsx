/**
 * Skip to Content Link
 *
 * Provides keyboard users a way to skip navigation and jump directly to main content.
 * WCAG 2.1 AA Requirement: 2.4.1 Bypass Blocks
 */

export function SkipToContent() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-4 focus:left-4 focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded-md focus:shadow-lg focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
    >
      Skip to main content
    </a>
  )
}
