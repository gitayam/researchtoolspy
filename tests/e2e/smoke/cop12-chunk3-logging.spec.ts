import { readFileSync } from 'fs'
import { test, expect } from '@playwright/test'

const TARGET_FILES = [
  'functions/api/cop/[id]/layers/markers.ts',
  'functions/api/cop/[id]/layers/events.ts',
  'functions/api/cop/[id]/layers/actors.ts',
  'functions/api/cop/[id]/layers/places.ts',
  'functions/api/cop/[id]/layers/relationships.ts',
  'functions/api/cop/[id]/layers/analysis.ts',
  'functions/api/cop/[id]/layers/assets.ts',
  'functions/api/cop/[id]/layers/acled.ts',
  'functions/api/cop/[id]/layers/gdelt.ts',
  'functions/api/cop/[id]/layers/poo-estimates.ts',
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
