/**
 * System-B retirement guard (pure-Node, no browser/server).
 *
 * E-4b-3+4: the legacy "System B" research-forms code was retired now that the
 * builder/submit/reviewer/promote all run on System A. This source-level guard
 * (modeled on research-forms-route.spec.ts) asserts the dead pages + endpoints
 * stay deleted, the `/submit/:hashId` route shows a graceful notice instead of
 * the deleted page, and CopIntakeFormBuilder's dead `preview` stub is gone.
 *
 * NOTE: this intentionally does NOT touch the `submission_forms` /
 * `form_submissions` D1 tables — they're left in place (dormant test data).
 */
import { test, expect } from '@playwright/test'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

function read(relPath: string): string {
  return readFileSync(resolve(process.cwd(), relPath), 'utf8')
}

const DELETED_FILES = [
  'src/pages/SubmitEvidencePage.tsx',
  'src/pages/CreateSubmissionFormPage.tsx',
  'functions/api/research/submit/[hashId].ts',
  'functions/api/research/forms/create.ts',
]

test('@smoke dead System-B pages and endpoints are deleted', () => {
  for (const f of DELETED_FILES) {
    expect(existsSync(resolve(process.cwd(), f)), `${f} must not exist`).toBe(false)
  }
})

test('@smoke routes no longer import SubmitEvidencePage', () => {
  const routes = read('src/routes/index.tsx')
  expect(routes).not.toContain('SubmitEvidencePage')
})

test('@smoke /submit/:hashId maps to the retired-form notice, not the deleted page', () => {
  const routes = read('src/routes/index.tsx')
  // The route path must still be registered (so the URL doesn't 404).
  expect(routes).toMatch(/path:\s*['"]\/submit\/:hashId['"]/)
  const idx = routes.indexOf("path: '/submit/:hashId'") >= 0
    ? routes.indexOf("path: '/submit/:hashId'")
    : routes.indexOf('path: "/submit/:hashId"')
  expect(idx).toBeGreaterThanOrEqual(0)
  const after = routes.slice(idx, idx + 200)
  // It must render the graceful notice component (not the deleted page).
  expect(after).toContain('SubmissionFormMovedNotice')
  expect(after).not.toContain('SubmitEvidencePage')
})

test('@smoke CopIntakeFormBuilder dead preview toggle is removed', () => {
  const src = read('src/components/cop/CopIntakeFormBuilder.tsx')
  expect(src).not.toContain('setPreview')
})
