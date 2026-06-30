import { readFileSync } from 'fs'
import { test, expect } from '@playwright/test'

const TARGET_FILES = [
  'functions/api/cop/[id]/personas.ts',
  'functions/api/cop/[id]/collaborators.ts',
  'functions/api/cop/[id]/shares.ts',
  'functions/api/cop/[id]/events.ts',
  'functions/api/cop/[id]/activity.ts',
  'functions/api/cop/[id]/export.ts',
  'functions/api/cop/[id]/exports.ts',
  'functions/api/cop/[id]/submissions.ts',
  'functions/api/cop/[id]/intake-forms.ts',
  'functions/api/cop/public/[token].ts',
]

for (const filePath of TARGET_FILES) {
  test(`${filePath} — no bare console.error`, () => {
    const src = readFileSync(filePath, 'utf8')
    expect(src).not.toMatch(/console\.error/)
  })

  test(`${filePath} — imports logEvent`, () => {
    const src = readFileSync(filePath, 'utf8')
    expect(src).toMatch(/import.*logEvent.*from/)
  })
}
