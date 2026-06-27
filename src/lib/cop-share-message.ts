/**
 * COP "Share link" toast messaging (pure, framework-free).
 *
 * The COP workspace Share button copies the PRIVATE dashboard URL
 * (`/dashboard/cop/:id`) to the clipboard. That URL is correct for the owner
 * and existing collaborators, but for a PRIVATE session (`is_public = 0`) it
 * 403s for anyone without granted access — so the recipient hits a silent
 * dead-end. This helper produces honest, visibility-aware toast copy so the
 * user knows what the copied link will (and won't) do, and is pointed at the
 * explicit Invite collaborators / Share link flow when access must be granted.
 *
 * Kept free of React / DOM imports so it is trivially unit-testable.
 */

export interface ShareLinkToastOptions {
  /** Whether the COP session is publicly viewable (`cop_sessions.is_public`). */
  isPublic: boolean
}

export interface ShareLinkToast {
  title: string
  description: string
}

/**
 * Success-copy toast for the Share button, tailored by session visibility.
 *
 * Does NOT create or imply a public share token — granting access is a
 * deliberate action the user takes via the Invite collaborators / Share link
 * flow. This only sets honest expectations about the link just copied.
 */
export function shareLinkToast({ isPublic }: ShareLinkToastOptions): ShareLinkToast {
  return {
    title: 'Link copied',
    description: isPublic
      ? 'Anyone with this link can view this COP.'
      : 'This session is private — recipients need access. Use Invite collaborators / Share link to grant access.',
  }
}
