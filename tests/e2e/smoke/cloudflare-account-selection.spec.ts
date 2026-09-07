import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'

const root = process.cwd()

function read(path: string): string {
  return readFileSync(resolve(root, path), 'utf8')
}

test.describe('Cloudflare account selection @smoke', () => {
  const helper = read('scripts/cloudflare-account.sh')
  const accountConsumers = [
    'deploy.sh',
    'scripts/pre-deployment-check.sh',
    'scripts/list-managed-migrations.sh',
    'scripts/audit-d1-indexes.sh',
  ]

  test('@smoke keeps one repository-owned account source', () => {
    expect(helper).toContain('RESEARCHTOOLSPY_CLOUDFLARE_ACCOUNT_ID=')
    expect(helper).toContain('export CLOUDFLARE_ACCOUNT_ID=')

    for (const path of accountConsumers) {
      expect(read(path), path).toContain('source ./scripts/cloudflare-account.sh')
    }
  })

  test('@smoke standalone production scripts load account selection', () => {
    const indexAudit = read('scripts/audit-d1-indexes.sh')
    const packageJson = read('package.json')
    expect(packageJson).toContain('"migrate:list:prod": "./scripts/list-managed-migrations.sh --remote"')
    expect(packageJson).toContain('"audit:indexes:prod": "./scripts/audit-d1-indexes.sh --remote"')
    expect(packageJson).toContain('"wrangler:deploy": "./deploy.sh"')
    expect(packageJson).toContain("\"migrate:prod\": \"bash -c 'source ./scripts/cloudflare-account.sh")
    expect(read('scripts/list-managed-migrations.sh')).toContain('source ./scripts/cloudflare-account.sh')
    expect(indexAudit).toContain('source ./scripts/cloudflare-account.sh')
    expect(indexAudit).toContain('grep -Ein')
    expect(indexAudit).not.toContain('rg -n')
  })

  test('@smoke runbook records the independent repository boundary', () => {
    const runbook = read('docs/operations/SCRAPING_DEPLOYMENT.md')
    expect(runbook).toContain('The monorepo root `./deploy.sh workers` command contains')
    expect(runbook).toContain('two explicit')
    expect(runbook).toContain('two deployment receipts separately')
  })
})
