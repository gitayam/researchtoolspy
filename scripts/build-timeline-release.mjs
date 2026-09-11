// Execute only in the credential-free release validator. Publishing is separate.
import { spawnSync } from 'node:child_process'
const checks = [
  ['scripts/verify-timeline.mjs'],
  ['node_modules/wrangler/bin/wrangler.js', 'pages', 'functions', 'build', 'functions',
    '--outdir', 'dist/_worker.js', '--build-output-directory', 'dist',
    '--compatibility-date', '2025-09-30', '--compatibility-flags', 'nodejs_compat'],
  ['scripts/verify-timeline-release.mjs'],
]
for (const args of checks) {
  console.log(`Release check: node ${args.join(' ')}`)
  const result = spawnSync(process.execPath, args, { stdio: 'inherit', env: process.env })
  if (result.error || result.status !== 0) process.exit(result.status || 1)
}
