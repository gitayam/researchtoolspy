import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { extractArticle, type ArticleExtraction } from '../../../functions/api/_shared/article-extractor'
import {
  READABILITY_CANDIDATE_VERSION,
  extractWithReadability,
  type ReadabilityCandidateResult,
} from '../../../benchmarks/scraping/readability-candidate'

interface CorpusFixture {
  id: string
  file: string
  url: string
  pageClass: string
  expectedAccepted: boolean
  expectedTitle: string
  requiredText: string[]
  forbiddenText: string[]
}

interface CorpusManifest {
  schemaVersion: 'scrape-corpus.v1'
  fixtures: CorpusFixture[]
}

interface ExtractorCandidate {
  id: string
  extract(html: string, url: string): ArticleExtraction | ReadabilityCandidateResult
}

const corpusDirectory = resolve(process.cwd(), 'benchmarks/scraping/corpus-v1')
const manifest = JSON.parse(
  readFileSync(resolve(corpusDirectory, 'manifest.json'), 'utf8'),
) as CorpusManifest

const candidates: ExtractorCandidate[] = [
  { id: 'heuristic.v2', extract: extractArticle },
  { id: READABILITY_CANDIDATE_VERSION, extract: extractWithReadability },
]

test.describe('versioned scraping extractor benchmark', () => {
  test('manifest and control candidate remain reproducible', () => {
    expect(manifest.schemaVersion).toBe('scrape-corpus.v1')
    expect(manifest.fixtures.length).toBeGreaterThanOrEqual(4)
    expect(new Set(manifest.fixtures.map(fixture => fixture.id)).size).toBe(manifest.fixtures.length)
    expect(candidates.map(candidate => candidate.id)).toContain('heuristic.v2')
  })

  for (const candidate of candidates) {
    test(`${candidate.id} produces a paired scorecard`, async ({ browserName }, testInfo) => {
      const results = manifest.fixtures.map((fixture) => {
        const html = readFileSync(resolve(corpusDirectory, fixture.file), 'utf8')
        const result = candidate.extract(html, fixture.url)
        expect(result.extractorVersion).toBe(candidate.id)
        const checks = {
          title: result.title === fixture.expectedTitle,
          acceptance: result.qualitySignals.accepted === fixture.expectedAccepted,
          requiredText: fixture.requiredText.every(required => result.text.includes(required)),
          forbiddenText: fixture.forbiddenText.every(forbidden => !result.text.includes(forbidden)),
        }
        return {
          id: fixture.id,
          pageClass: fixture.pageClass,
          checks,
          perfect: Object.values(checks).every(Boolean),
        }
      })
      const scorecard = {
        schemaVersion: 'scrape-benchmark-result.v1',
        candidate: candidate.id,
        browserName,
        fixtures: results.length,
        perfectFixtures: results.filter(result => result.perfect).length,
        acceptanceCorrect: results.filter(result => result.checks.acceptance).length,
        results,
      }
      await testInfo.attach(`${candidate.id}.json`, {
        body: JSON.stringify(scorecard, null, 2),
        contentType: 'application/json',
      })
      if (candidate.id === 'heuristic.v2') expect(scorecard.perfectFixtures).toBe(results.length)
      else {
        expect(scorecard.acceptanceCorrect, JSON.stringify(results)).toBe(results.length)
        expect(scorecard.perfectFixtures).toBe(3)
      }
    })
  }
})
