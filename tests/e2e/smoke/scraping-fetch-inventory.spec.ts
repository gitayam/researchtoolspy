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
  | 'safe-multi-source'
  | 'safe-image'
  | 'safe-provider'
  | 'unsafe-direct'
  | 'unsafe-enhanced'
  | 'unsafe-shared'
  | 'delegated-unsafe'
  | 'constrained-provider'
  | 'third-party-job'
  | 'bounded-provider-job'

interface InventoryEntry {
  id: string
  file: string
  status: SafetyStatus
  evidence: RegExp
  forbidden?: RegExp[]
  typecheck: 'root' | 'transitive' | 'excluded'
}

const entries: InventoryEntry[] = [
  { id: 'INV-001', file: 'functions/api/web-scraper.ts', status: 'safe-text', evidence: /safeFetchText\(url,/, typecheck: 'root' },
  { id: 'INV-002', file: 'functions/api/tools/scrape-metadata.ts', status: 'safe-text', evidence: /safeFetchText\(validUrl,/, typecheck: 'root' },
  {
    id: 'INV-003',
    file: 'functions/api/tools/analyze-url.ts',
    status: 'safe-multi-source',
    evidence: /safeFetchText\(normalizedUrl,/,
    forbidden: [/enhancedFetch\(/, /web\.archive\.org\/save\//],
    typecheck: 'root',
  },
  { id: 'INV-004', file: 'functions/api/tools/extract.ts', status: 'safe-document', evidence: /safeFetchDocument\(body\.url,/, typecheck: 'root' },
  { id: 'INV-005', file: 'functions/api/tools/extract-claims.ts', status: 'safe-multi-source', evidence: /safeFetchText\(url,/, forbidden: [/enhancedFetch\(/, /await fetch\(/], typecheck: 'root' },
  { id: 'INV-006', file: 'functions/api/tools/extract-timeline.ts', status: 'safe-text', evidence: /safeFetchText\(url,/, forbidden: [/enhancedFetch\(/, /renderArticleFallback/, /BROWSER_RENDERER/], typecheck: 'root' },
  { id: 'INV-007', file: 'functions/api/ai/scrape-url.ts', status: 'safe-multi-source', evidence: /safeFetchText\(normalizedUrl,/, forbidden: [/fetch\(url[,)]/], typecheck: 'root' },
  { id: 'INV-008', file: 'functions/api/content-intelligence/analyze-url.ts', status: 'safe-multi-source', evidence: /safeFetchText\(resolvedUrl,/, typecheck: 'root' },
  { id: 'INV-009', file: 'functions/api/content-intelligence/saved-links.ts', status: 'safe-text', evidence: /safeFetchText\(url,/, typecheck: 'root' },
  { id: 'INV-010', file: 'functions/api/content-intelligence/twitter-image-proxy.ts', status: 'safe-image', evidence: /reserveArchiveWrite\(env\.CACHE, clientId\)/, typecheck: 'root' },
  { id: 'INV-011', file: 'functions/api/tools/rage-check.ts', status: 'safe-multi-source', evidence: /scrapeUrl\(url, context\.env\.APIFY_API_KEY\)/, forbidden: [/BROWSER_RENDERER/, /renderArticleFallback/], typecheck: 'root' },
  { id: 'INV-012', file: 'functions/api/surveys/public/[token]/submit.ts', status: 'safe-multi-source', evidence: /enrichResponseUrls\(/, typecheck: 'root' },
  { id: 'INV-013', file: 'functions/api/cop/public/intake/[token]/submit.ts', status: 'safe-multi-source', evidence: /enrichResponseUrls\(/, typecheck: 'root' },
  { id: 'INV-014', file: 'functions/api/surveys/public/[token]/preview-url.ts', status: 'delegated-safe', evidence: /save_link: false/, forbidden: [/X-User-Hash/, /system-internal/], typecheck: 'root' },
  { id: 'INV-015', file: 'functions/api/tools/batch-process.ts', status: 'delegated-safe', evidence: /headers: internalJsonHeaders\(request\)/, typecheck: 'root' },
  {
    id: 'INV-016',
    file: 'functions/api/frameworks/pmesii-pt/import-url.ts',
    status: 'delegated-safe',
    evidence: /'\/api\/content-intelligence\/analyze-url'/,
    forbidden: [/content-intelligence\/analyze['"`]/, /url: analysis\.url/],
    typecheck: 'root',
  },
  { id: 'INV-017', file: 'functions/api/content-intelligence/starbursting.ts', status: 'delegated-safe', evidence: /\/api\/ai\/scrape-url/, typecheck: 'root' },
  { id: 'INV-018', file: 'functions/api/cop/[id]/scrape.ts', status: 'bounded-provider-job', evidence: /fetchApifyJson\(apiKey,/, forbidden: [/\bfetch\s*\(/], typecheck: 'root' },
  { id: 'INV-019', file: 'functions/api/content-intelligence/social-extract.ts', status: 'safe-provider', evidence: /parseCanonicalFacebookUrl\(url\)/, forbidden: [/function extractYouTubeId/, /function fetchYouTubeTranscript/, /function extractInstagram\(/, /async function extractFacebook\(/, /saveExtraction/, /social_media_extractions/, /instagram_oembed/, /query_hash=/, /__a=1/, /publish\.twitter\.com/, /api\.vxtwitter\.com/, /co\.wuk\.sh/], typecheck: 'root' },
  { id: 'INV-020', file: 'functions/api/content-intelligence/social-media-extract.ts', status: 'constrained-provider', evidence: /parseCanonicalTikTokUrl\(url\)/, forbidden: [/function extractYouTubeVideoId/, /function fetchYouTubeTranscript/, /function extractInstagramVia/, /snapinsta\.app/, /instadp\.com/, /saveinsta\.app/, /api\.instagram\.com\/oembed/, /publish\.twitter\.com/, /api\.vxtwitter\.com/, /co\.wuk\.sh/], typecheck: 'root' },
  {
    id: 'INV-021',
    file: 'functions/api/content-intelligence/git-repository-extract.ts',
    status: 'safe-provider',
    evidence: /fetchFixedProviderJson<T>/,
    forbidden: [/\bfetch\s*\(/, /\bBuffer\b/, /createLogger/],
    typecheck: 'root',
  },
  { id: 'INV-022', file: 'functions/api/tools/geoconfirmed.ts', status: 'safe-provider', evidence: /fetchFixedProviderJson<GCConflict\[\]>/, forbidden: [/\bfetch\s*\(/], typecheck: 'root' },
  { id: 'INV-023', file: 'functions/api/content-intelligence/domain-country.ts', status: 'constrained-provider', evidence: /ip-api\.com\/json/, typecheck: 'root' },
  { id: 'INV-024', file: 'functions/api/content-intelligence/virustotal-lookup.ts', status: 'safe-provider', evidence: /fetchFixedProviderJson<VirusTotalDomainReport>/, forbidden: [/\bfetch\s*\(/], typecheck: 'root' },
  { id: 'INV-025', file: 'functions/api/content-intelligence/pdf-extractor.ts', status: 'safe-pdf', evidence: /safeFetchPdf\(url,/, typecheck: 'root' },
  { id: 'INV-026', file: 'functions/api/_shared/apify-social.ts', status: 'bounded-provider-job', evidence: /fetchApifyJson\(apiKey,/, forbidden: [/\bfetch\s*\(/], typecheck: 'transitive' },
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
      for (const forbidden of entry.forbidden ?? []) {
        expect(source, `${entry.id} forbidden legacy evidence in ${entry.file}`).not.toMatch(forbidden)
      }

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
