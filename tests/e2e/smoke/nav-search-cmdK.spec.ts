import { test, expect } from '@playwright/test'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { DISCOVERY_ENTRIES, discoverySearchText } from '../../../src/config/discovery-catalog'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const root = resolve(__dirname, '../../..')

function read(relPath: string) {
  return readFileSync(resolve(root, relPath), 'utf-8')
}

test.describe('nav-search-cmdK discovery @smoke', () => {
  test('CommandPalette.tsx exists and contains keyboard handler (k + metaKey + ctrlKey)', () => {
    const src = read('src/components/CommandPalette.tsx')
    expect(src).toContain("'k'")
    expect(src).toContain('metaKey')
    expect(src).toContain('ctrlKey')
  })

  test('CommandPalette.tsx exports CommandPalette function', () => {
    const src = read('src/components/CommandPalette.tsx')
    expect(src).toContain('export function CommandPalette')
  })

  test('dashboard-sidebar.tsx contains email-header-analyzer route', () => {
    const src = read('src/components/layout/dashboard-sidebar.tsx')
    expect(src).toContain('/dashboard/tools/email-header-analyzer')
  })

  test('dashboard-sidebar.tsx contains behavior-analysis route', () => {
    const src = read('src/components/layout/dashboard-sidebar.tsx')
    expect(src).toContain('/dashboard/tools/behavior-analysis')
  })

  test('dashboard-sidebar.tsx contains cross-table route', () => {
    const src = read('src/components/layout/dashboard-sidebar.tsx')
    expect(src).toContain('/dashboard/tools/cross-table')
  })

  test('ToolsPage.tsx contains content-intelligence route', () => {
    const src = read('src/pages/ToolsPage.tsx')
    expect(src).toContain('/dashboard/tools/content-intelligence')
  })

  test('timeline is registered across tools navigation surfaces', () => {
    expect(read('src/pages/ToolsPage.tsx')).toContain('/dashboard/tools/timeline')
    expect(read('src/components/layout/dashboard-sidebar.tsx')).toContain('/dashboard/tools/timeline')
    expect(read('src/config/discovery-catalog.ts')).toContain('/dashboard/tools/timeline')
    expect(read('src/components/CommandPalette.tsx')).toContain('DISCOVERY_ENTRIES')
    expect(read('src/routes/index.tsx')).toContain("path: 'tools/timeline'")
  })

  test('discovery catalog indexes recent tools, frameworks, aliases, and capabilities', () => {
    const labels = new Set(DISCOVERY_ENTRIES.map(entry => entry.label))
    const hrefs = new Set(DISCOVERY_ENTRIES.map(entry => entry.href))
    expect(labels.size).toBe(DISCOVERY_ENTRIES.length)
    expect(hrefs.size).toBe(DISCOVERY_ENTRIES.length)

    const searchable = (label: string) => discoverySearchText(
      DISCOVERY_ENTRIES.find(entry => entry.label === label)!,
    ).toLocaleLowerCase('en-US')

    expect(searchable('Timeline Analysis')).toContain('relative event')
    expect(searchable('Behavior Decision Analysis')).toContain('coping branch')
    expect(searchable('COM-B & Behaviour Change Wheel')).toContain('behavior change wheel')
    expect(searchable('Web Scraping')).toContain('safe fetch')
    expect(labels).toContain('RAGE Check')
    expect(labels).toContain('Research Form Builder')
  })

  test('header search finds features and navigates to their owning surface', async ({ page }) => {
    await page.route('**/api/workspaces', route => route.fulfill({ status: 200, json: { owned: [], member: [] } }))
    await page.goto('/dashboard/tools')
    await page.getByRole('button', { name: /Open command palette/ }).click()
    const input = page.getByPlaceholder('Search tools, frameworks, features, and pages...')

    await input.fill('relative event')
    await expect(page.getByRole('option', { name: /Timeline Analysis/ })).toBeVisible()

    await input.fill('coping branch')
    await expect(page.getByRole('option', { name: /Behavior Decision Analysis/ })).toBeVisible()

    await input.fill('behavior wheel')
    await expect(page.getByRole('option', { name: /COM-B & Behaviour Change Wheel/ })).toBeVisible()

    await input.fill('safe fetch')
    await expect(page.getByRole('option', { name: /Web Scraping/ })).toBeVisible()

    await input.fill('timeline')
    await page.getByRole('option', { name: /Timeline Analysis/ }).click()
    await expect(page).toHaveURL(/\/dashboard\/tools\/timeline$/)
    await expect(page.getByRole('heading', { name: 'Timeline Analysis' })).toBeVisible()
  })

  test('tools-page search includes features and catalog aliases', async ({ page }) => {
    await page.route('**/api/workspaces', route => route.fulfill({ status: 200, json: { owned: [], member: [] } }))
    await page.goto('/dashboard/tools')
    const input = page.getByPlaceholder('Search tools...')

    await input.fill('positional event')
    await expect(page.getByRole('heading', { name: 'Timeline Analysis' })).toBeVisible()

    await input.fill('safe fetch')
    await expect(page.getByRole('heading', { name: 'Web Scraping' })).toBeVisible()

    await input.fill('coping branch')
    await expect(page.getByText('Use the header search to find analysis frameworks and other pages.')).toBeVisible()
  })

  test('ToolsPage.tsx contains equilibrium-analysis route', () => {
    const src = read('src/pages/ToolsPage.tsx')
    expect(src).toContain('/dashboard/tools/equilibrium-analysis')
  })

  test('ToolsPage.tsx contains collection route (agentic research)', () => {
    const src = read('src/pages/ToolsPage.tsx')
    expect(src).toContain('/dashboard/tools/collection')
  })

  test('DashboardLayout.tsx imports and renders CommandPalette', () => {
    const src = read('src/layouts/DashboardLayout.tsx')
    expect(src).toContain("import { CommandPalette } from '@/components/CommandPalette'")
    expect(src).toContain('<CommandPalette />')
  })

  test('dashboard-header.tsx contains openCommandPalette trigger', () => {
    const src = read('src/components/layout/dashboard-header.tsx')
    expect(src).toContain('openCommandPalette')
  })
})
