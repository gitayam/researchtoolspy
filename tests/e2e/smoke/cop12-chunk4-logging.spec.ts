import { readFileSync } from 'fs'
import { test, expect } from '@playwright/test'

const TARGET_FILES = [
  'functions/api/cop/[id]/alerts.ts',
  'functions/api/cop/[id]/task-templates.ts',
  'functions/api/cop/[id]/poo-estimates.ts',
  'functions/api/cop/[id]/playbooks/[pbId]/rules.ts',
  'functions/api/cop/[id]/assets.ts',
  'functions/api/cop/[id]/task-dependencies.ts',
  'functions/api/cop/[id]/rfis/[rfiId]/answers.ts',
  'functions/api/cop/[id]/playbooks/[pbId].ts',
  'functions/api/cop/[id]/evidence-tags.ts',
  'functions/api/cop/[id]/rfis/[rfiId].ts',
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
