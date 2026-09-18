import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { defineConfig, devices } from '@playwright/test'

/**
 * Which specs actually open a browser.
 *
 * Most of this suite is compute: contract checks, parsers, projection helpers. Playwright
 * only launches a browser for a test that asks for one, so those specs ran a second time
 * under a phone profile and re-executed identical pure assertions — half the suite's work,
 * proving nothing. Scanned rather than listed by hand so a new UI spec gets mobile coverage
 * without anyone remembering to add it; the scan is over ~200 small files and costs nothing.
 *
 * It fails toward "runs once, on desktop" rather than "does not run": chromium takes every
 * spec regardless, so a miss here costs mobile coverage, never coverage.
 */
/**
 * A Playwright fixture destructure in a test or hook callback — `async ({ page }) => …`.
 *
 * Anchored to `async (` rather than matching any `{ … page … }`, because a bare brace match
 * also catches ordinary local destructures (`const { context } = contextFor(url)`) and
 * `browserName`, which tells a test which engine it is on without ever opening a browser.
 * Those three files were being run twice under a phone profile for nothing.
 */
const FIXTURE_DESTRUCTURE = /async\s*\(\s*\{[^}]*\b(?:page|context|browser)\b/

function browserSpecs(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) browserSpecs(path, found)
    else if (entry.name.endsWith('.spec.ts') && FIXTURE_DESTRUCTURE.test(readFileSync(path, 'utf8'))) {
      found.push(entry.name)
    }
  }
  return found
}

const MOBILE_SPECS = new RegExp(
  `(?:${browserSpecs('tests/e2e').map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})$`,
)

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'html',
  timeout: 30_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      // Only the specs that render something. This project caught the command palette
      // trigger being `hidden sm:flex`, which left a phone with no way to reach search at
      // all — worth keeping, and worth keeping narrow.
      name: 'mobile-safari',
      testMatch: MOBILE_SPECS,
      use: { ...devices['iPhone 14'] },
    },
  ],

  webServer: [
    {
      command: 'npm run dev:vite',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      // A second, isolated Vite for the timeline browser specs.
      //
      // Those specs map a fake public origin (https://timeline.example) onto a
      // real server so they can exercise opaque-frame loading without
      // Chromium's localhost-only network restriction, and they proxy to
      // 127.0.0.1:5189. Nothing started it, so seventeen of them failed with
      // ECONNREFUSED on every run — they only ever passed for someone who had
      // started it by hand.
      //
      // `--host 127.0.0.1` is load-bearing, not tidiness. Vite's default binds
      // IPv6 `[::1]` only, so even with the server running those specs still
      // got ECONNREFUSED on the IPv4 address they ask for. Verified both ways
      // before writing this down.
      command: 'npx vite --port 5189 --strictPort --host 127.0.0.1',
      url: 'http://127.0.0.1:5189',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
})
