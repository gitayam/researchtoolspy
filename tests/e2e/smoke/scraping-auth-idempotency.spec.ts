import { test, expect } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { buildScrapeImportKey } from '../../../functions/api/cop/[id]/_scrape-idempotency'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '../../..')

test.describe('scraping authorization and idempotency contracts @smoke', () => {
  test('@smoke stable import keys deduplicate repeated logical items within a COP', async () => {
    const first = await buildScrapeImportKey('cop-1', 'twitter', {
      title: 'First title',
      content: 'First content',
      url: 'HTTPS://Example.com:443/post/42#thread',
    })
    const repeated = await buildScrapeImportKey('cop-1', 'twitter', {
      title: 'Changed presentation title',
      content: 'Changed engagement counters',
      url: 'https://example.com/post/42',
    })
    const anotherCop = await buildScrapeImportKey('cop-2', 'twitter', {
      title: 'First title',
      content: 'First content',
      url: 'https://example.com/post/42',
    })

    expect(first).toBe(repeated)
    expect(first).not.toBe(anotherCop)
    expect(first).toMatch(/^scrape:v1:[a-f0-9]{64}$/)
  })

  test('@smoke URL-less items use content identity', async () => {
    const first = await buildScrapeImportKey('cop-1', 'tiktok', {
      title: 'A', content: 'same body', url: '',
    })
    const changed = await buildScrapeImportKey('cop-1', 'tiktok', {
      title: 'A', content: 'different body', url: '',
    })

    expect(first).not.toBe(changed)
  })

  test('@smoke cached analyses are owner/workspace scoped', () => {
    const source = fs.readFileSync(
      path.join(root, 'functions/api/content-intelligence/analyze-url.ts'),
      'utf8',
    )

    expect(source).toContain('AND user_id = ?')
    expect(source).toContain("AND (? IS NULL OR COALESCE(workspace_id, '') = ?)")
    expect(source).toContain('FROM content_analysis_cache')
    expect(source).toContain('WHERE content_hash = ? AND user_id = ? AND workspace_key = ?')
    expect(source).not.toContain('FROM content_deduplication\n      WHERE content_hash = ?')
  })

  test('@smoke COP polling binds run identity to auth and schema enforces import keys', () => {
    const source = fs.readFileSync(
      path.join(root, 'functions/api/cop/[id]/scrape.ts'),
      'utf8',
    )
    const migration = fs.readFileSync(
      path.join(root, 'schema/migrations/114-scraping-auth-idempotency.sql'),
      'utf8',
    )

    expect(source).toContain('requested_by, scraper_type')
    expect(source).toContain('AND requested_by = ?')
    expect(source).not.toContain('body.user_id')
    expect(source).toContain('INSERT OR IGNORE INTO evidence_items')
    expect(migration).toContain('CREATE UNIQUE INDEX IF NOT EXISTS idx_evidence_items_scrape_import_key')
    expect(migration).toContain("json_extract(metadata, '$.scrape_import_key')")
  })
})
