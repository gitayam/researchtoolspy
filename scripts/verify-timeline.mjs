// Run only inside a credential-free validator with dependencies/browser installed.
import { spawnSync } from 'node:child_process'
const contractTests = [
  'timeline-contract', 'extract-timeline-safe-fetch', 'timeline-observability',
  'community-integration-contract', 'community-integration-capabilities',
  'community-service-auth', 'timeline-reference-client', 'timeline-fixtures',
]
const uiTests = ['timeline-tool-ui', 'timeline-workspace-ordering', 'timeline-narrative-ui']
const checks = [
  ['node_modules/typescript/bin/tsc', '-b', '--noEmit'],
  ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.functions.json', '--noEmit'],
  ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.workers.json', '--noEmit'],
  ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.scraping-functions.json', '--noEmit'],
  ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.timeline-client.json'],
  ['node_modules/playwright/cli.js', 'test', '--config=playwright.timeline.config.ts', '--project=chromium', ...contractTests.map(n => n + '.spec.ts')],
  ['node_modules/playwright/cli.js', 'test', '--config=playwright.timeline.config.ts', '--project=chromium', '--project=mobile-safari', ...uiTests.map(n => n + '.spec.ts')],
  ['node_modules/vite/bin/vite.js', 'build'],
]
for (const args of checks) {
  console.log(`Running: node ${args.join(' ')}`)
  const result = spawnSync(process.execPath, args, { stdio: 'inherit', env: process.env })
  if (result.error || result.status !== 0) process.exit(result.status || 1)
}
