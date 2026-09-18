import type { Page } from '@playwright/test'

/**
 * Give a page a signed-in identity before it loads.
 *
 * The suite has no auth fixture, which is why the COP wizard specs were quarantined: several
 * dashboard pages call `isUserAuthenticated()` in an effect and redirect to `/login` when it
 * returns false, so every assertion after the first navigation timed out.
 *
 * The important finding behind this helper is that the check is **entirely client-side**.
 * `getAuthIdentifier()` reads `omnicore_user_hash` out of localStorage; nothing is validated
 * against a server. So the missing dependency was never a session — running the API would
 * not have fixed it, and for a while the quarantine note said it might.
 *
 * `addInitScript` rather than an explicit `localStorage.setItem` after navigation, because
 * the redirect fires from a mount effect: by the time a test could set the value, the page
 * has already left.
 */

/** Sixteen digits, the shape `generateAccountHash()` produces. Never 'default' or 'guest' — `getAuthIdentifier()` rejects both. */
export const TEST_USER_HASH = '1234567890123456'

export async function signIn(page: Page, hash: string = TEST_USER_HASH): Promise<void> {
  await page.addInitScript((value) => {
    localStorage.setItem('omnicore_user_hash', value)
  }, hash)
}
