import { test, expect, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import type { TimelineWorkspaceExport, TimelineWorkspaceEvent } from '../../../src/types/timeline-workspace'

function fixture(interval = true, many = false): TimelineWorkspaceExport {
  const event = (id: string, title: string, sequenceOrder: number, extra: Partial<TimelineWorkspaceEvent>): TimelineWorkspaceEvent => ({ id, title, sequenceOrder, description: 'Synthetic recorded calendar comparison.', category: 'event', importance: 'normal', origin: 'analyst', assessment: 'unreviewed', analystNote: '', modified: false, narrativeIncluded: true, narrativeOrder: sequenceOrder, whyItMatters: '', transition: '', placement: { mode: 'position', position: sequenceOrder + 1 }, ...extra })
  return { schemaVersion: interval ? 'timeline-workspace.v2' : 'timeline-workspace.v1', exportedAt: '2026-09-14T12:00:00.000Z', source: { schemaVersion: 'timeline-manual.v1', title: 'Overlap review fixture' }, analystWorkspace: { mode: 'robust', presentation: 'analyst', sortDirection: 'oldest', questions: [], hypotheses: [], events: [
    event('anchor:recorded', 'Library opening', 0, { eventDate: '2026-09-15', datePrecision: 'day' }),
    event('monthly', 'Monthly preparation with a deliberately long descriptive title that wraps within a narrow mobile comparison card', 1, { eventDate: '2026-09', datePrecision: 'month' }),
    event('range', 'Maintenance window', 2, { eventDate: '2026-09-14', datePrecision: 'day', ...(interval ? { recordedEnd: { date: '2026-09-16' } } : {}) }),
    event('later', 'Later visitor update', 3, { eventDate: '2026-09-21', datePrecision: 'day' }),
    event('unknown', 'Undated access check', 4, {}),
    ...(many ? Array.from({ length: 23 }, (_, index) => event(`extra-${index}`, `Additional recorded event ${index + 1}`, index + 5, { eventDate: '2026-09-15', datePrecision: 'day' })) : []),
  ] } }
}
async function imported(page: Page, value: TimelineWorkspaceExport) {
  const summary = page.locator('summary').filter({ hasText: /^Start or import a timeline$/ })
  if (await summary.locator('..').getAttribute('open') === null) await summary.click()
  await page.getByLabel('Import timeline JSON').setInputFiles({ name: 'overlap.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(value)) })
  await expect(summary.locator('..')).not.toHaveAttribute('open', '')
  await expect(page.getByRole('button', { name: 'Export JSON', exact: true })).toBeVisible()
}
async function start(page: Page, value: TimelineWorkspaceExport) {
  const mutations: string[] = []
  await page.route('http://127.0.0.1:5189/api/**', route => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(route.request().method())) mutations.push(route.request().url())
    return route.fulfill({ status: 200, json: { owned: [], member: [] } })
  })
  await page.goto('/dashboard/tools/timeline')
  await expect(page.locator('.timeline-setup')).toHaveAttribute('open', '')
  await imported(page, value)
  mutations.length = 0
  return mutations
}
async function exported(page: Page): Promise<TimelineWorkspaceExport> {
  const pending = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export JSON', exact: true }).click()
  return JSON.parse(await readFile((await (await pending).path())!, 'utf8'))
}
const content = (value: TimelineWorkspaceExport) => { const { exportedAt: _time, ...rest } = value; return rest }

test.describe('Recorded overlap finder @smoke', () => {
  test('compares partial and interval dates, follows stable links and preserves complete exports', async ({ page }, info) => {
    test.setTimeout(120_000)
    const mutations = await start(page, fixture())
    const original = await exported(page)
    const summary = page.locator('summary').filter({ hasText: /^Find overlapping dates$/ })
    const panel = summary.locator('..')
    await expect(panel).not.toHaveAttribute('open', '')
    await summary.click()
    await expect(panel.getByRole('status')).toHaveText('Choose an event to compare.')
    await panel.getByLabel('Compare recorded dates for', { exact: true }).selectOption('anchor:recorded')
    await expect(panel.getByRole('status')).toHaveText('2 potential overlaps · 1 cannot compare · 1 separate dates')
    await expect(panel.getByRole('listitem')).toHaveCount(2)
    const guidance = panel.locator('summary').filter({ hasText: /^How dates are compared$/ })
    await guidance.click()
    await expect(panel.getByText(/Recorded clocks are not timezone-normalized/)).toBeVisible()
    await guidance.click()
    await expect(panel).toContainText('2026-09-16')
    for (const theme of ['light', 'dark']) {
      await page.evaluate(dark => document.documentElement.classList.toggle('dark', dark), theme === 'dark')
      await summary.evaluate(node => window.scrollBy({ top: node.getBoundingClientRect().top - 110, behavior: 'instant' }))
      await expect(summary).toBeInViewport({ ratio: 1 })
      await expect(panel.getByLabel('Compare recorded dates for', { exact: true })).toBeInViewport({ ratio: 1 })
      await expect.poll(() => summary.evaluate(async node => {
        const before = node.getBoundingClientRect(); await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
        return Math.abs(node.getBoundingClientRect().top - before.top) < 0.5
      })).toBe(true)
      expect(await panel.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true)
      await page.screenshot({ path: info.outputPath(`overlap-${theme}.png`), animations: 'disabled', scale: 'css' })
      const firstResult = panel.getByRole('listitem').first()
      await firstResult.evaluate(node => window.scrollBy({ top: node.getBoundingClientRect().top - 110, behavior: 'instant' }))
      await expect(firstResult).toBeInViewport({ ratio: 1 })
      await expect.poll(() => firstResult.evaluate(async node => {
        const before = node.getBoundingClientRect(); await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
        return Math.abs(node.getBoundingClientRect().top - before.top) < 0.5
      })).toBe(true)
      await page.screenshot({ path: info.outputPath(`overlap-result-${theme}.png`), animations: 'disabled', scale: 'css' })
    }
    await panel.getByLabel('Show date comparisons', { exact: true }).selectOption('unresolved')
    await expect(panel.getByRole('listitem')).toContainText('Undated access check')
    await panel.getByLabel('Show date comparisons', { exact: true }).selectOption('disjoint')
    const link = panel.getByRole('link', { name: 'Review event Later visitor update', exact: true })
    const href = await link.getAttribute('href'); await link.click()
    await expect.poll(() => page.evaluate(() => document.activeElement?.id)).toBe(href!.slice(1))
    await panel.getByLabel('Show date comparisons', { exact: true }).selectOption('all')
    await expect(panel.getByRole('listitem')).toHaveCount(4)
    expect(content(await exported(page))).toEqual(content(original))
    await panel.getByLabel('Compare recorded dates for', { exact: true }).selectOption('unknown')
    await expect(panel.getByRole('status')).toHaveText('The selected event has no recorded date.')
    await expect(panel.getByRole('listitem')).toHaveCount(0)
    await panel.getByRole('button', { name: 'Clear query', exact: true }).click()
    await expect(panel.getByLabel('Compare recorded dates for', { exact: true })).toHaveValue('')
    expect(content(await exported(page))).toEqual(content(original))
    expect(mutations).toEqual([])
  })

  test('pages results, recomputes after edits and clears deleted or replaced anchors without changing v1 data', async ({ page }) => {
    test.setTimeout(120_000)
    const mutations = await start(page, fixture(false, true))
    const original = await exported(page)
    const summary = page.locator('summary').filter({ hasText: /^Find overlapping dates$/ }); const panel = summary.locator('..')
    await summary.click()
    await panel.getByLabel('Compare recorded dates for', { exact: true }).selectOption('anchor:recorded')
    await expect(panel.getByRole('listitem')).toHaveCount(20)
    await panel.getByRole('button', { name: 'Show more', exact: true }).click()
    await expect(panel.getByRole('listitem')).toHaveCount(24)
    expect(content(await exported(page))).toEqual(content(original))
    await page.getByRole('button', { name: 'Actions for Library opening', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Edit event', exact: true }).click()
    const editor = page.getByRole('dialog', { name: 'Edit timeline event', exact: true })
    await editor.getByLabel('Date (optional)', { exact: true }).fill('2026-10-01')
    await editor.getByRole('button', { name: 'Save event', exact: true }).click()
    await expect(editor).toBeHidden()
    await expect(panel.getByRole('status')).toHaveText('0 potential overlaps · 1 cannot compare · 26 separate dates')
    const edited = await exported(page)
    expect(edited.schemaVersion).toBe('timeline-workspace.v1')
    expect(edited.source).toEqual(original.source)
    expect(edited.analystWorkspace.events.filter(event => event.id !== 'anchor:recorded')).toEqual(original.analystWorkspace.events.filter(event => event.id !== 'anchor:recorded'))
    await page.getByRole('button', { name: 'Actions for Library opening', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Remove from timeline', exact: true }).click()
    await expect(panel.getByRole('status')).toHaveText('Choose an event to compare.')
    await expect(panel.getByRole('listitem')).toHaveCount(0)
    await panel.getByLabel('Compare recorded dates for', { exact: true }).selectOption('monthly')
    await imported(page, original)
    await expect(panel).not.toHaveAttribute('open', '')
    await summary.click()
    await expect(panel.getByLabel('Compare recorded dates for', { exact: true })).toHaveValue('')
    expect(content(await exported(page))).toEqual(content(original))
    expect(mutations).toEqual([])
  })
})
