import { test } from '@playwright/test'

/**
 * Guards for specs that cannot run against the default harness.
 *
 * Two distinct dependencies, both verified rather than assumed:
 *
 * 1. **The API.** `playwright.config.ts` starts `dev:vite` — Vite alone. Vite
 *    proxies `/api` to localhost:8788, which only `npm run dev` starts. Without
 *    it a page that calls a real endpoint renders "Server responded with 500"
 *    and every assertion after it times out. Specs that mock their endpoints
 *    with `page.route` do not need this guard.
 *
 * 2. **A signed-in session** — diagnosed but NOT guarded here, deliberately.
 *    `/dashboard/workspace/new` redirects to `/login?redirect=...`, and the
 *    suite has no auth fixture: no `storageState`, no sign-in step. So the
 *    wizard specs were written against a session nothing provides. A guard for
 *    it is not in this file because I could not demonstrate one firing before
 *    those specs time out for other reasons, and a skip that silently does
 *    nothing is worse than a visible failure. Closing that gap means adding an
 *    auth fixture, not another guard.
 *
 * A declared skip is not a fix and is not meant to read as one. It is here
 * because a spec that fails on every run tells you nothing about itself AND
 * drowns the signal of the suite around it — sixty-five such failures are how
 * an `allow_failure: true` on the CI job stopped being noticed. Naming the
 * dependency makes the gap countable, and says what would close it.
 */

let apiCached: boolean | null = null

export async function apiAvailable(): Promise<boolean> {
  if (apiCached !== null) return apiCached
  try {
    const response = await fetch('http://localhost:8788/', { signal: AbortSignal.timeout(2000) })
    apiCached = response.ok
  } catch {
    apiCached = false
  }
  return apiCached
}

/** For specs that call the real API. Use in `test.beforeEach`. */
export async function skipWithoutApi() {
  test.skip(
    !(await apiAvailable()),
    'Needs the local API. Run `npm run dev` (vite + wrangler on :8788), not `dev:vite`.',
  )
}
