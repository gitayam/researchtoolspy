// Run only inside a credential-free validator with dependencies/browser installed.
import { spawnSync } from 'node:child_process'
const contractTests = [
  'timeline-contract', 'extract-timeline-safe-fetch', 'timeline-observability',
  'community-integration-contract', 'community-integration-capabilities',
  'community-service-auth', 'timeline-reference-client', 'timeline-fixtures',
  'timeline-artifact-contract', 'timeline-artifact-auth', 'timeline-artifact-d1',
  'timeline-artifact-cors', 'timeline-evidence-contract', 'timeline-judgments-contract', 'timeline-source-import-d1', 'timeline-chunk-import-d1', 'timeline-service-d1', 'timeline-artifact-migrations', 'timeline-workspace-snapshot-d1',
]
const uiTests = ['timeline-tool-ui', 'timeline-workspace-ordering', 'timeline-narrative-ui', 'timeline-durable-browser', 'timeline-evidence-browser', 'timeline-judgments-browser']
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
