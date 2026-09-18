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
    const input = page.getByPlaceholder('Search frameworks, tools, features, and pages...')

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

  test('the palette lists the caller\'s own content, below the catalogue', async ({ page }) => {
    await page.route('**/api/workspaces', route => route.fulfill({ status: 200, json: { owned: [], member: [] } }))
    await page.route('**/api/discovery/search**', route => route.fulfill({
      status: 200,
      json: {
        results: [
          { kind: 'framework', id: '10', title: 'Harbour access analysis', detail: 'starbursting',
            href: '/dashboard/analysis-frameworks/starbursting/10/view' },
          { kind: 'cop', id: 'cop-1', title: 'Harbour watch', detail: 'Live picture',
            href: '/dashboard/cop/cop-1' },
        ],
      },
    }))

    await page.goto('/dashboard/tools')
    await page.getByRole('button', { name: /Open command palette/ }).click()
    await page.getByPlaceholder('Search frameworks, tools, features, and pages...').fill('harbour')

    await expect(page.getByRole('option', { name: /Harbour access analysis/ })).toBeVisible()
    await expect(page.getByRole('option', { name: /Harbour watch/ })).toBeVisible()
  })

  test('a framework the catalogue knows still outranks content that merely mentions it', async ({ page }) => {
    // The ordering the request asked for: frameworks and their acronyms first, then
    // everything else including the caller's own work.
    await page.route('**/api/workspaces', route => route.fulfill({ status: 200, json: { owned: [], member: [] } }))
    await page.route('**/api/discovery/search**', route => route.fulfill({
      status: 200,
      json: { results: [{ kind: 'framework', id: '99', title: 'ACH on the port incident', detail: 'ach', href: '/dashboard/analysis-frameworks/ach-dashboard/99' }] },
    }))

    await page.goto('/dashboard/tools')
    await page.getByRole('button', { name: /Open command palette/ }).click()
    await page.getByPlaceholder('Search frameworks, tools, features, and pages...').fill('ach')

    const options = page.getByRole('option')
    await expect(options.first()).toContainText(/Analysis of Competing Hypotheses|ACH/)
    // The caller's own analysis is present, but after the tool itself.
    await expect(page.getByRole('option', { name: /ACH on the port incident/ })).toBeVisible()
  })

  test('the palette still works when the content search fails', async ({ page }) => {
    // It asks on every keystroke; a signed-out or erroring caller must still get the
    // catalogue rather than a broken panel.
    await page.route('**/api/workspaces', route => route.fulfill({ status: 200, json: { owned: [], member: [] } }))
    await page.route('**/api/discovery/search**', route => route.fulfill({ status: 500, json: { error: 'nope' } }))

    await page.goto('/dashboard/tools')
    await page.getByRole('button', { name: /Open command palette/ }).click()
    await page.getByPlaceholder('Search frameworks, tools, features, and pages...').fill('timeline')
    await expect(page.getByRole('option', { name: /Timeline Analysis/ })).toBeVisible()
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
