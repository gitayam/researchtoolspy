/**
 * Roadmap #17 — window.open auth-API audit source guard (pure-Node, no browser).
 *
 * Guards against future regressions where a `window.open('/api/…')` or bare
 * `<a href="/api/…">` is added for an auth-required endpoint without the
 * fetch+Blob+getCopHeaders pattern.
 *
 * The COP CoT export (COP-1, v0.22.17) was the only instance that required
 * fixing.  This spec asserts the codebase is clean after that fix.
 *
 * Strategy: read every .ts/.tsx source file under src/ and reject any pattern
 * that suggests a raw browser navigation to /api/:
 *   - window.open(…'/api/…')  — browser nav that can't set X-User-Hash
 *   - window.open(`/api/…`)   — template-literal variant
 *
 * Carve-outs:
 *   - src/lib/cop-cot-export.ts  — comment-only reference (the guard module itself)
 *   - /api/auth/oidc/login       — intentional browser redirect to start OAuth flow
 */
import { test, expect } from '@playwright/test'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'

const SRC_DIR = join(process.cwd(), 'src')

/** Recursively collect all .ts / .tsx files under a directory. */
function collectSourceFiles(dir: string): string[] {
  const results: string[] = []
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry)
    const stat = statSync(fullPath)
    if (stat.isDirectory()) {
      results.push(...collectSourceFiles(fullPath))
    } else {
      const ext = extname(entry)
      if (ext === '.ts' || ext === '.tsx') {
        results.push(fullPath)
      }
    }
  }
  return results
}

/** Check a source file for raw window.open('/api/…') calls. */
function findWindowOpenApiCalls(src: string): string[] {
  const violations: string[] = []
  const lines = src.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    // Skip comment lines
    if (line.trimStart().startsWith('//') || line.trimStart().startsWith('*')) continue
    // Detect window.open with a literal or template string starting with /api/
    // Patterns: window.open('/api/...')  window.open(`/api/...`)  window.open("/api/...")
    if (/window\.open\s*\(\s*['"`]\/api\//.test(line)) {
      violations.push(`line ${i + 1}: ${line.trim()}`)
    }
  }
  return violations
}

test.describe('Roadmap #17 — window.open auth-API audit @smoke', () => {
  const files = collectSourceFiles(SRC_DIR)

  const CARVE_OUTS = [
    // This file only mentions the pattern in a JSDoc comment explaining why it was removed
    join(SRC_DIR, 'lib', 'cop-cot-export.ts'),
  ]

  test('@smoke no src file contains window.open with a bare /api/ path', () => {
    const allViolations: string[] = []

    for (const file of files) {
      if (CARVE_OUTS.includes(file)) continue
      const content = readFileSync(file, 'utf8')
      const violations = findWindowOpenApiCalls(content)
      if (violations.length > 0) {
        allViolations.push(`\n${file}:\n  ${violations.join('\n  ')}`)
      }
    }

    expect(
      allViolations,
      `Found auth-required window.open('/api/…') calls that need the fetch+Blob+getCopHeaders pattern:\n${allViolations.join('\n')}`
    ).toHaveLength(0)
  })

  test('@smoke cop-cot-export.ts does NOT contain a live window.open call (only documentation comment)', () => {
    const cotExportPath = join(SRC_DIR, 'lib', 'cop-cot-export.ts')
    const content = readFileSync(cotExportPath, 'utf8')
    const liveLines = content.split('\n').filter((line) => {
      const trimmed = line.trimStart()
      // Skip comment lines
      if (trimmed.startsWith('//') || trimmed.startsWith('*')) return false
      return /window\.open\s*\(/.test(line)
    })
    expect(
      liveLines,
      'cop-cot-export.ts should not have any live window.open() calls — only documentation comments'
    ).toHaveLength(0)
  })

  test('@smoke SurveyDetailPage uses fetch+getCopHeaders not bare href for /api/surveys export', () => {
    const surveyPage = join(SRC_DIR, 'pages', 'SurveyDetailPage.tsx')
    const content = readFileSync(surveyPage, 'utf8')
    // The page must use getCopHeaders (auth pattern)
    expect(content).toContain('getCopHeaders()')
    // The page must use e.preventDefault() to intercept the link
    expect(content).toContain('preventDefault()')
    // The page must not rely on a bare href download (window.open or unguarded navigation)
    // We confirm fetch is present in the export context
    expect(content).toMatch(/fetch\(`\/api\/surveys\/\$\{surveyId\}\/export/)
  })

  test('@smoke CopWorkspacePage uses downloadCotExport not window.open for CoT export', () => {
    const copWorkspace = join(SRC_DIR, 'pages', 'CopWorkspacePage.tsx')
    const content = readFileSync(copWorkspace, 'utf8')
    expect(content).toContain('downloadCotExport')
    expect(content).toContain('getCopHeaders()')
    // Must not have a raw window.open to the cot endpoint
    expect(content).not.toMatch(/window\.open\s*\(.*\/api\/cop.*cot/)
  })

  test('@smoke CopPage uses downloadCotExport not window.open for CoT export', () => {
    const copPage = join(SRC_DIR, 'pages', 'CopPage.tsx')
    const content = readFileSync(copPage, 'utf8')
    expect(content).toContain('downloadCotExport')
    expect(content).toContain('getCopHeaders()')
    // Must not have a raw window.open to the cot endpoint
    expect(content).not.toMatch(/window\.open\s*\(.*\/api\/cop.*cot/)
  })
})
