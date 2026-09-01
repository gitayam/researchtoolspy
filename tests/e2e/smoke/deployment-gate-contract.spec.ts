import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

test.describe('production deployment gate contract @smoke', () => {
  test('@smoke pins the canonical Cloudflare account for non-interactive releases', () => {
    const config = readFileSync(resolve(process.cwd(), 'wrangler.toml'), 'utf8')
    expect(config).toContain('account_id = "04eac09ae835290383903273f68c79b0"')
  })

  test('@smoke an unavailable schema snapshot cannot be reported as missing objects', () => {
    const script = readFileSync(resolve(process.cwd(), 'scripts/pre-deployment-check.sh'), 'utf8')
    expect(script).toContain('SCHEMA_SNAPSHOT_AVAILABLE=false')
    expect(script).toContain('if [ "$SCHEMA_SNAPSHOT_AVAILABLE" = true ]; then')
    expect(script).toContain('Schema object checks skipped because the remote snapshot was unavailable.')
  })
})
