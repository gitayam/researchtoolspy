import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'
import { calculateMetadataCompletenessScore } from '../../../functions/api/web-scraper'

const root = process.cwd()

test.describe('web scraper metadata completeness contract @smoke', () => {
  test('@smoke scores extraction coverage on a 0-100 scale', () => {
    expect(calculateMetadataCompletenessScore({}, {})).toBe(0)
    expect(calculateMetadataCompletenessScore({ title: 'Article' }, {})).toBe(20)
    expect(calculateMetadataCompletenessScore({
      title: 'Article',
      description: 'Summary',
      author: 'Reporter',
    }, {
      keywords: ['research'],
      og_title: 'Article',
      og_description: 'Summary',
      og_image: 'https://cdn.example/image.jpg',
      og_type: 'article',
    })).toBe(100)
  })

  test('@smoke does not present metadata coverage as source reliability', () => {
    const files = [
      'functions/api/web-scraper.ts',
      'src/pages/WebScraperPage.tsx',
      'src/types/scraper.ts',
      'src/locales/en/scraper.json',
      'src/locales/es/scraper.json',
    ].map(file => readFileSync(resolve(root, file), 'utf8')).join('\n')

    expect(files).not.toContain('reliability_score')
    expect(files).not.toContain('reliability_rating')
    expect(files).not.toMatch(/reliableDomains|High Reliability|Reliability Score/)
    expect(files).toContain('metadata_completeness_score')
    expect(files).toContain('not source credibility')
  })

  test('@smoke consumes the datasets API response contract', () => {
    const page = readFileSync(resolve(root, 'src/pages/WebScraperPage.tsx'), 'utf8')
    expect(page).toContain("as { id?: string | number }")
    expect(page).not.toMatch(/dataset\.id/)
  })
})
