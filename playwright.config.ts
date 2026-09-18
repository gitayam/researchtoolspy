import { defineConfig, devices } from '@playwright/test'

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
      name: 'mobile-safari',
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
