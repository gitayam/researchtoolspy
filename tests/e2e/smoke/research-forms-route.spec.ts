/**
 * Research forms-list route guard (pure-Node, no browser/server).
 *
 * E-2: `/dashboard/research/forms` was unregistered (404) — the 4 "back to forms"
 * buttons in CreateSubmissionFormPage navigated there and dead-ended, and the only
 * list page (SubmissionFormsPage) was orphaned + had the COP-14 no-auth-headers bug.
 * It now redirects to the working `/dashboard/research/submissions` (which has a
 * Forms tab). This guards against the 404 regressing and the dead page returning.
 */
import { test, expect } from '@playwright/test'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

test('@smoke /research/forms is registered and redirects to research/submissions', () => {
  const routes = readFileSync(resolve(process.cwd(), 'src/routes/index.tsx'), 'utf8')
  // The redirect route must exist (path 'research/forms' → Navigate to the submissions page).
  expect(routes).toMatch(/path:\s*['"]research\/forms['"]/)
  const idx = routes.indexOf("'research/forms'") >= 0
    ? routes.indexOf("'research/forms'")
    : routes.indexOf('"research/forms"')
  const after = routes.slice(idx, idx + 200)
  expect(after).toContain('Navigate')
  expect(after).toContain('/dashboard/research/submissions')
})

test('@smoke the orphaned SubmissionFormsPage is gone (dead code removed)', () => {
  expect(existsSync(resolve(process.cwd(), 'src/pages/SubmissionFormsPage.tsx'))).toBe(false)
})
