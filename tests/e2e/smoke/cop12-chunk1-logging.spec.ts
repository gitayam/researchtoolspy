import { readFileSync } from 'fs'
import { test, expect } from '@playwright/test'

const TARGET_FILES = [
  'functions/api/cop/sessions.ts',
  'functions/api/cop/sessions/[id].ts',
  'functions/api/cop/[id]/evidence.ts',
  'functions/api/cop/[id]/markers.ts',
  'functions/api/cop/[id]/hypotheses.ts',
  'functions/api/cop/[id]/tasks.ts',
  'functions/api/cop/[id]/rfis.ts',
  'functions/api/cop/[id]/timeline.ts',
  'functions/api/cop/[id]/claims.ts',
  'functions/api/cop/[id]/stats.ts',
]

for (const filePath of TARGET_FILES) {
  test(`${filePath} — no bare console.error in catch blocks`, () => {
    const src = readFileSync(filePath, 'utf8')
    // No console.error should remain
    expect(src).not.toMatch(/console\.error/)
  })

  test(`${filePath} — imports logEvent`, () => {
    const src = readFileSync(filePath, 'utf8')
    expect(src).toMatch(/import.*logEvent.*from/)
  })
}
