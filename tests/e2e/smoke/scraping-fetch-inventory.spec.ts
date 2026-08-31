/**
 * Static contract for docs/operations/SCRAPING_FETCH_INVENTORY.md.
 *
 * The assertions deliberately preserve unsafe labels for legacy adapters. They
 * do not make network requests or claim that a route is safe; they make source
 * changes visible so the inventory and adapter migration must move together.
 */
import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

type SafetyStatus =
  | 'safe-text'
  | 'safe-document'
  | 'safe-pdf'
  | 'unsafe-direct'
  | 'unsafe-enhanced'
  | 'unsafe-shared'
  | 'delegated-unsafe'
  | 'constrained-provider'
  | 'third-party-job'

interface InventoryEntry {
  id: string
  file: string
  status: SafetyStatus
  evidence: RegExp
  typecheck: 'root' | 'transitive' | 'excluded'
}

const entries: InventoryEntry[] = [
  { id: 'INV-001', file: 'functions/api/web-scraper.ts', status: 'safe-text', evidence: /safeFetchText\(url,/, typecheck: 'root' },
  { id: 'INV-002', file: 'functions/api/tools/scrape-metadata.ts', status: 'safe-text', evidence: /safeFetchText\(validUrl,/, typecheck: 'root' },
  { id: 'INV-003', file: 'functions/api/tools/analyze-url.ts', status: 'unsafe-enhanced', evidence: /enhancedFetch\(normalizedUrl/, typecheck: 'root' },
  { id: 'INV-004', file: 'functions/api/tools/extract.ts', status: 'safe-document', evidence: /safeFetchDocument\(body\.url,/, typecheck: 'root' },
  { id: 'INV-005', file: 'functions/api/tools/extract-claims.ts', status: 'unsafe-direct', evidence: /enhancedFetch\(url/, typecheck: 'root' },
  { id: 'INV-006', file: 'functions/api/tools/extract-timeline.ts', status: 'unsafe-enhanced', evidence: /renderArticleFallback\(context\.env\.BROWSER_RENDERER, url\)/, typecheck: 'root' },
  { id: 'INV-007', file: 'functions/api/ai/scrape-url.ts', status: 'unsafe-direct', evidence: /response = await fetch\(url/, typecheck: 'root' },
  { id: 'INV-008', file: 'functions/api/content-intelligence/analyze-url.ts', status: 'unsafe-direct', evidence: /fetch\(resolvedUrl/, typecheck: 'excluded' },
  { id: 'INV-009', file: 'functions/api/content-intelligence/saved-links.ts', status: 'unsafe-direct', evidence: /fetch\(url,/, typecheck: 'excluded' },
  { id: 'INV-010', file: 'functions/api/content-intelligence/twitter-image-proxy.ts', status: 'unsafe-direct', evidence: /fetch\(imageUrl,/, typecheck: 'root' },
  { id: 'INV-011', file: 'functions/api/tools/rage-check.ts', status: 'unsafe-shared', evidence: /scrapeUrl\(url,/, typecheck: 'root' },
  { id: 'INV-012', file: 'functions/api/surveys/public/[token]/submit.ts', status: 'unsafe-shared', evidence: /enrichResponseUrls\(/, typecheck: 'root' },
  { id: 'INV-013', file: 'functions/api/cop/public/intake/[token]/submit.ts', status: 'unsafe-shared', evidence: /enrichResponseUrls\(/, typecheck: 'root' },
  { id: 'INV-014', file: 'functions/api/surveys/public/[token]/preview-url.ts', status: 'delegated-unsafe', evidence: /\/api\/content-intelligence\/analyze-url/, typecheck: 'root' },
  { id: 'INV-015', file: 'functions/api/tools/batch-process.ts', status: 'delegated-unsafe', evidence: /endpoint = '\/api\/tools\/extract'/, typecheck: 'root' },
  { id: 'INV-016', file: 'functions/api/frameworks/pmesii-pt/import-url.ts', status: 'delegated-unsafe', evidence: /body: JSON\.stringify\(\{\s*url: body\.url/s, typecheck: 'root' },
  { id: 'INV-017', file: 'functions/api/content-intelligence/starbursting.ts', status: 'delegated-unsafe', evidence: /\/api\/ai\/scrape-url/, typecheck: 'root' },
  { id: 'INV-018', file: 'functions/api/cop/[id]/scrape.ts', status: 'third-party-job', evidence: /canonicalizeScrapeRequestUrl\(value\)/, typecheck: 'root' },
  { id: 'INV-019', file: 'functions/api/content-intelligence/social-extract.ts', status: 'constrained-provider', evidence: /youtube\.com\/oembed/, typecheck: 'root' },
  { id: 'INV-020', file: 'functions/api/content-intelligence/social-media-extract.ts', status: 'constrained-provider', evidence: /selectedTrack\.baseUrl/, typecheck: 'root' },
  { id: 'INV-021', file: 'functions/api/content-intelligence/git-repository-extract.ts', status: 'constrained-provider', evidence: /api\.github\.com\/repos/, typecheck: 'excluded' },
  { id: 'INV-022', file: 'functions/api/tools/geoconfirmed.ts', status: 'constrained-provider', evidence: /GC_API = 'https:\/\/geoconfirmed\.org\/api'/, typecheck: 'root' },
  { id: 'INV-023', file: 'functions/api/content-intelligence/domain-country.ts', status: 'constrained-provider', evidence: /ip-api\.com\/json/, typecheck: 'root' },
  { id: 'INV-024', file: 'functions/api/content-intelligence/virustotal-lookup.ts', status: 'constrained-provider', evidence: /www\.virustotal\.com\/api\/v3\/domains/, typecheck: 'root' },
  { id: 'INV-025', file: 'functions/api/content-intelligence/pdf-extractor.ts', status: 'safe-pdf', evidence: /safeFetchPdf\(url,/, typecheck: 'root' },
  { id: 'INV-026', file: 'functions/api/_shared/apify-social.ts', status: 'third-party-job', evidence: /APIFY_BASE.*api\.apify\.com\/v2/, typecheck: 'transitive' },
]

const repositoryRoot = process.cwd()
const inventoryPath = resolve(repositoryRoot, 'docs/operations/SCRAPING_FETCH_INVENTORY.md')
const inventory = readFileSync(inventoryPath, 'utf8')
const tsconfig = JSON.parse(readFileSync(resolve(repositoryRoot, 'tsconfig.scraping-functions.json'), 'utf8')) as {
  files: string[]
}

test.describe('scraping outbound-fetch inventory @smoke', () => {
  test('@smoke every documented entry remains tied to its current source adapter and safety label', () => {
    const documentedRows = inventory.match(/^\| INV-\d{3} \|/gm) || []
    expect(documentedRows).toHaveLength(entries.length)

    for (const entry of entries) {
      const source = readFileSync(resolve(repositoryRoot, entry.file), 'utf8')
      expect(source, `${entry.id} source evidence in ${entry.file}`).toMatch(entry.evidence)

      const escapedFile = entry.file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const escapedStatus = entry.status.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      expect(inventory, `${entry.id} documented file and safety status`).toMatch(
        new RegExp('^\\| ' + entry.id + ' \\|.*' + escapedFile + '.*\\|.*`' + escapedStatus + '`', 'm'),
      )
    }
  })

  test('@smoke type-check roots and exclusions agree with the inventory', () => {
    for (const entry of entries) {
      if (entry.typecheck === 'root') {
        expect(tsconfig.files, `${entry.id} must be an explicit type-check root`).toContain(entry.file)
      } else if (entry.typecheck === 'excluded') {
        expect(tsconfig.files, `${entry.id} is documented as excluded`).not.toContain(entry.file)
        expect(inventory).toContain(`| \`${entry.file}\` |`)
      }
    }

    expect(inventory).toContain('It is intentionally named for the inventoried scraping surface')
    expect(inventory).toContain('it is not a claim that every Pages Function compiles')
  })
})
