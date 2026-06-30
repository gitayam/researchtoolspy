import { test, expect } from '@playwright/test'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const root = resolve(__dirname, '../../..')

function read(relPath: string) {
  return readFileSync(resolve(root, relPath), 'utf-8')
}

test.describe('nav-search-cmdK source guards', () => {
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
