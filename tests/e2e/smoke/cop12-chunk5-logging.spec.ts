import { readFileSync } from 'fs'
import { test, expect } from '@playwright/test'
import { execSync } from 'child_process'

const TARGET_FILES = [
  'functions/api/cop/[id]/assets/[assetId]/check-in.ts',
  'functions/api/cop/[id]/assets/[assetId]/log.ts',
  'functions/api/cop/[id]/cot.ts',
  'functions/api/cop/[id]/evidence/batch.ts',
  'functions/api/cop/[id]/exports/[exportId]/download.ts',
  'functions/api/cop/[id]/intake-forms/[formId].ts',
  'functions/api/cop/[id]/marker-changelog.ts',
  'functions/api/cop/[id]/playbooks.ts',
  'functions/api/cop/[id]/playbooks/[pbId]/log.ts',
  'functions/api/cop/[id]/playbooks/[pbId]/test.ts',
  'functions/api/cop/[id]/tasks/[taskId]/reassign.ts',
  'functions/api/cop/[id]/tasks/deploy-template.ts',
  'functions/api/cop/public/[token]/rfis/[rfiId]/answers.ts',
  'functions/api/cop/public/intake/[token].ts',
  'functions/api/cop/public/intake/[token]/submit.ts',
  'functions/api/cop/public/intake/[token]/verify-password.ts',
  'functions/api/cop/public/intake/by-slug/[slug].ts',
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

test('COP-12 COMPLETE — zero console.error across all COP handler files', () => {
  const result = execSync(
    'grep -rn "console\\.error" functions/api/cop/ --include="*.ts" || true',
    { encoding: 'utf8', cwd: process.cwd() }
  )
  expect(result.trim()).toBe('')
})
