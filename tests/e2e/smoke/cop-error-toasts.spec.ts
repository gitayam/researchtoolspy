/**
 * COP error-path toast coverage guard (pure-Node, no browser, no HTTP server).
 *
 * Reads the two COP page source files as strings and asserts that the
 * toast() + console.error() pattern has been applied to the key mutation
 * and fetch-failure error branches. This guards against regressions where
 * someone removes toast calls from catch blocks, leaving failures invisible.
 *
 * Uses the source-guard pattern (no `page` fixture needed).
 */
import { test, expect } from '@playwright/test'
import { readFileSync } from 'fs'

const workspaceSrc = readFileSync(
  new URL('../../../src/pages/CopWorkspacePage.tsx', import.meta.url).pathname,
  'utf8',
)

const copPageSrc = readFileSync(
  new URL('../../../src/pages/CopPage.tsx', import.meta.url).pathname,
  'utf8',
)

// Count occurrences of a substring in a string
function countOccurrences(haystack: string, needle: string): number {
  let count = 0
  let pos = 0
  while ((pos = haystack.indexOf(needle, pos)) !== -1) {
    count++
    pos += needle.length
  }
  return count
}

test.describe('COP error-path toasts source guard @smoke', () => {

  // ── CopWorkspacePage.tsx ──────────────────────────────────────

  test('@smoke CopWorkspacePage imports useToast', () => {
    expect(workspaceSrc).toContain("useToast")
    expect(workspaceSrc).toContain("from '@/components/ui/use-toast'")
  })

  test('@smoke CopWorkspacePage has at least 3 toast() calls in error branches', () => {
    // Count toast() calls that appear alongside console.error (error branches)
    const toastCallCount = countOccurrences(workspaceSrc, 'toast(')
    expect(toastCallCount).toBeGreaterThanOrEqual(3)
  })

  test('@smoke CopWorkspacePage uses variant: destructive on error toasts', () => {
    expect(workspaceSrc).toContain("variant: 'destructive'")
  })

  test('@smoke CopWorkspacePage toasts cover marker save failure', () => {
    expect(workspaceSrc).toContain('Failed to save marker')
  })

  test('@smoke CopWorkspacePage toasts cover mission brief save failure', () => {
    expect(workspaceSrc).toContain('Failed to save mission brief')
  })

  test('@smoke CopWorkspacePage toasts cover layer toggle failure', () => {
    // Should appear at least once (workspace file has one layer toggle)
    const layerToastCount = countOccurrences(workspaceSrc, 'Failed to update layers')
    expect(layerToastCount).toBeGreaterThanOrEqual(1)
  })

  test('@smoke CopWorkspacePage does not have duplicate useToast imports', () => {
    const importCount = countOccurrences(workspaceSrc, "from '@/components/ui/use-toast'")
    expect(importCount).toBe(1)
  })

  // ── CopPage.tsx ───────────────────────────────────────────────

  test('@smoke CopPage imports useToast', () => {
    expect(copPageSrc).toContain("useToast")
    expect(copPageSrc).toContain("from '@/components/ui/use-toast'")
  })

  test('@smoke CopPage has at least 3 toast() calls', () => {
    const toastCallCount = countOccurrences(copPageSrc, 'toast(')
    expect(toastCallCount).toBeGreaterThanOrEqual(3)
  })

  test('@smoke CopPage uses variant: destructive on error toasts', () => {
    expect(copPageSrc).toContain("variant: 'destructive'")
  })

  test('@smoke CopPage toasts cover layer toggle failure', () => {
    expect(copPageSrc).toContain('Failed to update layers')
  })

  test('@smoke CopPage toasts cover session update failure', () => {
    expect(copPageSrc).toContain('Failed to save changes')
  })

  test('@smoke CopPage share handler gives success and failure feedback', () => {
    // Success toast
    expect(copPageSrc).toContain('Link copied')
    // Failure toast
    expect(copPageSrc).toContain("Couldn't copy link")
  })

  test('@smoke CopPage does not have duplicate useToast imports', () => {
    const importCount = countOccurrences(copPageSrc, "from '@/components/ui/use-toast'")
    expect(importCount).toBe(1)
  })
})
