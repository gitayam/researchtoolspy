/**
 * E-11 Drop Spot smoke tests (pure-Node, no browser, no HTTP server).
 *
 * These tests guard the anonymity contract for the journalist tip-line feature.
 * The most important tests verify at source level that the drop-submit endpoint
 * never reads identifying headers and never calls the rate-limit function.
 *
 * All assertions are structural/source checks — no real D1 queries or
 * network calls are made. Mirrors the pattern used by cop16-cot-token-auth.spec.ts.
 */
import { test, expect } from '@playwright/test'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), 'utf-8')
}

function exists(rel: string): boolean {
  return existsSync(join(ROOT, rel))
}

// ---------------------------------------------------------------------------
// Privacy guard — the most important tests
// ---------------------------------------------------------------------------

test.describe('E-11 Drop Spot — privacy source guard @smoke', () => {
  const DROP_SUBMIT = 'functions/api/surveys/public/[token]/drop-submit.ts'

  test('@smoke drop-submit.ts exists', () => {
    expect(exists(DROP_SUBMIT)).toBe(true)
  })

  test('@smoke drop-submit.ts does NOT call headers.get for CF-Connecting-IP', () => {
    const src = read(DROP_SUBMIT)
    // Comments may mention the header name; what must not appear is code accessing it
    expect(src).not.toMatch(/headers\.get\s*\(\s*['"]CF-Connecting-IP['"]\s*\)/)
    expect(src).not.toMatch(/request\.headers\.get\s*\(\s*['"]CF-Connecting-IP['"]\s*\)/)
  })

  test('@smoke drop-submit.ts does NOT call headers.get for X-Forwarded-For', () => {
    const src = read(DROP_SUBMIT)
    expect(src).not.toMatch(/headers\.get\s*\(\s*['"]X-Forwarded-For['"]\s*\)/)
    expect(src).not.toMatch(/request\.headers\.get\s*\(\s*['"]X-Forwarded-For['"]\s*\)/)
  })

  test('@smoke drop-submit.ts does NOT call headers.get for User-Agent', () => {
    const src = read(DROP_SUBMIT)
    expect(src).not.toMatch(/headers\.get\s*\(\s*['"]User-Agent['"]\s*\)/)
    expect(src).not.toMatch(/request\.headers\.get\s*\(\s*['"]User-Agent['"]\s*\)/)
  })

  test('@smoke drop-submit.ts does NOT write ip_hash or submitter_ip_hash to DB', () => {
    const src = read(DROP_SUBMIT)
    // Check that the INSERT statement does not include these columns
    const insertIdx = src.indexOf('INSERT INTO survey_responses')
    const insertBlock = src.slice(insertIdx, insertIdx + 400)
    expect(insertBlock).not.toContain('ip_hash')
    expect(insertBlock).not.toContain('submitter_ip_hash')
  })

  test('@smoke drop-submit.ts does NOT call checkSurveyResponseRateLimit', () => {
    const src = read(DROP_SUBMIT)
    expect(src).not.toContain('checkSurveyResponseRateLimit')
  })

  test('@smoke drop-submit.ts does NOT call hashSubmitterIP', () => {
    const src = read(DROP_SUBMIT)
    expect(src).not.toContain('hashSubmitterIP')
  })

  test('@smoke drop-submit.ts checks TURNSTILE_SECRET (Turnstile path present)', () => {
    const src = read(DROP_SUBMIT)
    expect(src).toContain('TURNSTILE_SECRET')
    expect(src).toContain('turnstile/v0/siteverify')
  })

  test('@smoke drop-submit.ts catch block returns {ok: false} — never a 500 to submitters', () => {
    const src = read(DROP_SUBMIT)
    expect(src).toContain('ok: false')
    // Outer catch must NOT return status 500 to the source
    const catchStart = src.lastIndexOf('catch (error)')
    const catchBlock = src.slice(catchStart)
    expect(catchBlock).not.toContain('status: 500')
  })

  test('@smoke drop-submit.ts intent guard rejects non-drop forms', () => {
    const src = read(DROP_SUBMIT)
    expect(src).toContain("form.intent !== 'drop'")
  })
})

// ---------------------------------------------------------------------------
// Migration file
// ---------------------------------------------------------------------------

test.describe('E-11 Drop Spot — migration @smoke', () => {
  const MIGRATION = 'schema/migrations/112-survey-drops-intent.sql'

  test('@smoke migration file 112-survey-drops-intent.sql exists', () => {
    expect(exists(MIGRATION)).toBe(true)
  })

  test('@smoke migration contains intent column with CHECK constraint', () => {
    const sql = read(MIGRATION)
    expect(sql).toContain('intent')
    expect(sql).toContain("CHECK(intent IN ('survey', 'drop'))")
  })

  test('@smoke migration alters survey_drops table', () => {
    const sql = read(MIGRATION)
    expect(sql).toContain('survey_drops')
    expect(sql).toContain('ALTER TABLE')
  })
})

// ---------------------------------------------------------------------------
// Builder library — intent field
// ---------------------------------------------------------------------------

test.describe('E-11 Drop Spot — research-form-builder @smoke', () => {
  const BUILDER_LIB = 'src/lib/research-form-builder.ts'

  test('@smoke SurveyIntent type is exported', () => {
    const src = read(BUILDER_LIB)
    expect(src).toContain('SurveyIntent')
    expect(src).toContain("'survey' | 'drop'")
  })

  test('@smoke BuilderState includes optional intent field', () => {
    const src = read(BUILDER_LIB)
    expect(src).toContain('intent?: SurveyIntent')
  })

  test('@smoke SurveyPayload includes optional intent field', () => {
    const src = read(BUILDER_LIB)
    // Both BuilderState and SurveyPayload carry intent
    const matches = (src.match(/intent\?: SurveyIntent/g) || []).length
    expect(matches).toBeGreaterThanOrEqual(2)
  })

  test('@smoke buildSurveyPayload sets payload.intent when state.intent is drop', () => {
    const src = read(BUILDER_LIB)
    expect(src).toContain("state.intent === 'drop'")
    expect(src).toContain("payload.intent = 'drop'")
  })
})

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

test.describe('E-11 Drop Spot — route registration @smoke', () => {
  const ROUTES = 'src/routes/index.tsx'

  test('@smoke /drop/:slugOrToken route is registered', () => {
    const src = read(ROUTES)
    expect(src).toContain("path: '/drop/:slugOrToken'")
  })

  test('@smoke PublicDropFormPage is lazy-imported in routes', () => {
    const src = read(ROUTES)
    expect(src).toContain('PublicDropFormPage')
    expect(src).toContain("import('@/pages/PublicDropFormPage')")
  })

  test('@smoke /drop/:slugOrToken route uses PublicDropFormPage', () => {
    const src = read(ROUTES)
    const dropRouteIdx = src.indexOf("path: '/drop/:slugOrToken'")
    const dropRouteBlock = src.slice(dropRouteIdx, dropRouteIdx + 250)
    expect(dropRouteBlock).toContain('PublicDropFormPage')
  })
})

// ---------------------------------------------------------------------------
// PublicDropFormPage
// ---------------------------------------------------------------------------

test.describe('E-11 Drop Spot — PublicDropFormPage @smoke', () => {
  test('@smoke PublicDropFormPage.tsx exists', () => {
    expect(exists('src/pages/PublicDropFormPage.tsx')).toBe(true)
  })

  test('@smoke PublicDropFormPage passes isDropMode to PublicIntakeForm', () => {
    const src = read('src/pages/PublicDropFormPage.tsx')
    expect(src).toContain('isDropMode')
  })

  test('@smoke PublicDropFormPage resolves slugs via by-slug endpoint', () => {
    const src = read('src/pages/PublicDropFormPage.tsx')
    expect(src).toContain('by-slug')
  })
})

// ---------------------------------------------------------------------------
// PublicIntakeForm drop-mode wiring
// ---------------------------------------------------------------------------

test.describe('E-11 Drop Spot — PublicIntakeForm isDropMode @smoke', () => {
  const INTAKE = 'src/components/cop/PublicIntakeForm.tsx'

  test('@smoke PublicIntakeForm accepts isDropMode prop', () => {
    const src = read(INTAKE)
    expect(src).toContain('isDropMode')
  })

  test('@smoke PublicIntakeForm calls drop-submit when isDropMode is true', () => {
    const src = read(INTAKE)
    expect(src).toContain('drop-submit')
  })

  test('@smoke PublicIntakeForm shows "Submit Anonymously" label in drop mode', () => {
    const src = read(INTAKE)
    expect(src).toContain('Submit Anonymously')
  })

  test('@smoke PublicIntakeForm renders anonymous tip-line banner in drop mode', () => {
    const src = read(INTAKE)
    expect(src).toContain('Anonymous Tip Line')
  })

  test('@smoke drop-mode request body is {form_data} only — no submitter_name/contact', () => {
    const src = read(INTAKE)
    // The ternary for isDropMode request body must use only form_data
    expect(src).toContain('? { form_data: formData }')
  })
})

// ---------------------------------------------------------------------------
// surveys/index.ts — intent persisted on creation
// ---------------------------------------------------------------------------

test.describe('E-11 Drop Spot — surveys POST handler @smoke', () => {
  const SURVEYS_INDEX = 'functions/api/surveys/index.ts'

  test('@smoke surveys POST INSERT includes intent column', () => {
    const src = read(SURVEYS_INDEX)
    const insertIdx = src.indexOf('INSERT INTO survey_drops')
    const insertBlock = src.slice(insertIdx, insertIdx + 500)
    expect(insertBlock).toContain('intent')
  })

  test('@smoke surveys POST returns public_path with /drop/ prefix for drop intent', () => {
    const src = read(SURVEYS_INDEX)
    expect(src).toContain("intent === 'drop'")
    expect(src).toContain('/drop/')
    expect(src).toContain('public_path')
  })

  test('@smoke surveys GET list includes intent in SELECT', () => {
    const src = read(SURVEYS_INDEX)
    // The list query must return intent so UI can render correct URL
    const selectIdx = src.indexOf('SELECT id, title')
    const selectBlock = src.slice(selectIdx, selectIdx + 600)
    expect(selectBlock).toContain('intent')
  })
})
