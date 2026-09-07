import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'

const root = process.cwd()

test.describe('content intelligence API documentation contract @smoke', () => {
  const apiIndex = readFileSync(resolve(root, 'docs/api/API.md'), 'utf8')
  const integrationApi = readFileSync(resolve(root, 'docs/api/COMMUNITY-INTEGRATIONS-API.md'), 'utf8')
  const analysisApi = readFileSync(resolve(root, 'docs/api/CONTENT-INTELLIGENCE-API.md'), 'utf8')
  const analyzeRoute = readFileSync(
    resolve(root, 'functions/api/content-intelligence/analyze-url.ts'),
    'utf8',
  )
  const middleware = readFileSync(resolve(root, 'functions/api/_middleware.ts'), 'utf8')

  test('@smoke API index links the detailed analysis reference', () => {
    expect(apiIndex).toContain('POST /api/content-intelligence/analyze-url')
    expect(apiIndex).toContain('[`CONTENT-INTELLIGENCE-API.md`](CONTENT-INTELLIGENCE-API.md)')
    expect(integrationApi).toContain('[`CONTENT-INTELLIGENCE-API.md`](CONTENT-INTELLIGENCE-API.md)')
  })

  test('@smoke separates identity, rate classification, and persistence', () => {
    expect(analysisApi).toContain('`X-Service-Key` grants no identity, scope, workspace access, or persistence')
    expect(analysisApi).toContain('An `rt_svc_` bearer therefore does not make')
    expect(analysisApi).toContain('`content_text` legal')
    expect(analysisApi).toContain('Do not use a hard-coded workspace such as `1`')
    expect(analyzeRoute).toContain('if (body.content_text !== undefined && !userId)')
    expect(analyzeRoute).toContain("const canPersist = userId !== null && workspaceId !== null")
  })

  test('@smoke documents the supplied-content and bounded rate contracts', () => {
    expect(analysisApi).toContain('at least 150 words')
    expect(analysisApi).toContain('100 KiB')
    expect(analysisApi).toContain('12 requests per hour per source IP')
    expect(analysisApi).toContain('600 requests per hour')
    expect(analyzeRoute).toContain("slice(0, 100 * 1024)")
    expect(analyzeRoute).toContain("wordCount >= 150")
    expect(middleware).toContain('const DEFAULT_SERVICE_ANALYSIS_LIMIT = 600')
    expect(middleware).toContain('content-analysis:${clientIp}`, 12, 60 * 60')
  })

  test('@smoke documents provenance-aware 422 handling for Signal and RSS', () => {
    expect(analysisApi).toContain('When a `422` includes a non-empty `fallback_attempts`')
    expect(analysisApi).toContain('must not submit those same')
    expect(analysisApi).toContain('successful provenance will be `bot-scrape`')
    expect(analyzeRoute).toContain("code: 'INSUFFICIENT_CONTENT'")
    expect(analyzeRoute).toContain("source: 'bot-scrape' as const")
    expect(analyzeRoute).toContain("fallback_attempts: ['bot-scrape']")
  })

  test('@smoke records the legacy response and save semantics honestly', () => {
    expect(analysisApi).toContain('legacy, unversioned JSON')
    expect(analysisApi).toContain('`normal` and `full` analyses persist an analysis row')
    expect(analysisApi).toContain('`save_link` controls a')
    expect(analysisApi).toContain('separate library link')
    expect(analysisApi).toContain('`claim_analysis`')
    expect(analysisApi).toContain('currently `null`')
    expect(analyzeRoute).toContain('let claimAnalysis = null')
    expect(analyzeRoute).toContain('is_persisted: analysisId !== undefined')
  })
})
