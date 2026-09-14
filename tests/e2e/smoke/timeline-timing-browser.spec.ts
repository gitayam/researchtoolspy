import { test, expect, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import type { TimelineWorkspaceExport, TimelineWorkspaceEvent } from '../../../src/types/timeline-workspace'

function fixture(): TimelineWorkspaceExport {
  const event = (id: string, title: string, sequenceOrder: number, extra: Partial<TimelineWorkspaceEvent>): TimelineWorkspaceEvent => ({
    id, title, description: 'Synthetic library scheduling record.', category: 'event', importance: 'normal', origin: 'analyst', assessment: 'unreviewed', analystNote: '', modified: false,
    sequenceOrder, narrativeIncluded: true, narrativeOrder: sequenceOrder, ...extra,
  })
  return {
    schemaVersion: 'timeline-workspace.v1', exportedAt: '2026-09-14T12:00:00.000Z',
    source: { schemaVersion: 'timeline-manual.v1', title: 'Library timing review' },
    analystWorkspace: {
      mode: 'robust', presentation: 'analyst', sortDirection: 'oldest', questions: [], hypotheses: [],
      events: [
        event('monthly', 'Monthly preparation account', 0, { eventDate: '2026-09', datePrecision: 'month', placement: { mode: 'relative', relation: 'before', anchorEventId: 'opening:reference' } }),
        event('repairs', 'Repairs recorded later', 1, { eventDate: '2026-09-20', datePrecision: 'day', placement: { mode: 'relative', relation: 'before', anchorEventId: 'opening:reference' } }),
        event('opening:reference', 'Library opening', 2, { eventDate: '2026-09-15', datePrecision: 'day', placement: { mode: 'absolute' } }),
        event('undated', 'Undated access check', 3, { placement: { mode: 'relative', relation: 'after', anchorEventId: 'opening:reference' } }),
        event('followup', 'Later visitor update', 4, { eventDate: '2026-09-21', datePrecision: 'day', placement: { mode: 'relative', relation: 'after', anchorEventId: 'opening:reference' } }),
      ],
    },
  }
}
async function importWorkspace(page: Page, value: TimelineWorkspaceExport) {
  const summary = page.locator('summary').filter({ hasText: /^Start or import a timeline$/ })
  if (await summary.locator('..').getAttribute('open') === null) await summary.click()
  await page.getByLabel('Import timeline JSON').setInputFiles({ name: 'timing.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(value)) })
}
async function start(page: Page, value = fixture()) {
  await page.route('**/api/**', route => route.fulfill({ status: 200, json: { owned: [], member: [] } }))
  await page.goto('/dashboard/tools/timeline')
  await importWorkspace(page, value)
}
async function exportWorkspace(page: Page): Promise<TimelineWorkspaceExport> {
  const pending = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export JSON', exact: true }).click()
  return JSON.parse(await readFile((await (await pending).path())!, 'utf8'))
}

test.describe('Recorded timeline timing review @smoke', () => {
  test('diagnoses recorded relations, focuses stable events and updates after an explicit date edit', async ({ page }, info) => {
    test.setTimeout(120_000)
    await start(page)
    const original = await exportWorkspace(page)
    const summary = page.locator('summary').filter({ hasText: /^Timing review/ })
    const panel = summary.locator('..')
    await expect(summary).toContainText(/1 disagreement/)
    await expect(summary).toContainText('2 unresolved')
    await summary.click()
    const row = (title: string) => panel.getByRole('listitem', { name: `Timing for ${title}`, exact: true })
    await expect(row('Repairs recorded later')).toContainText('Dates disagree')
    await expect(row('Monthly preparation account')).toContainText('Order unresolved')
    await expect(row('Undated access check')).toContainText('Order unresolved')
    await expect(row('Later visitor update')).toContainText('Dates agree')
    await expect(panel).toContainText(/recorded calendar/i)
    await expect(row('Repairs recorded later')).toContainText('2026-09-20')
    await expect(row('Repairs recorded later')).toContainText('2026-09-15')
    await expect(row('Monthly preparation account')).toContainText('2026-09')
    for (const name of ['Review event Repairs recorded later', 'Review anchor Library opening']) {
      const link = row('Repairs recorded later').getByRole('link', { name, exact: true })
      const href = await link.getAttribute('href')
      expect(href).toMatch(/^#timeline-event-/)
      await link.click()
      await expect.poll(async () => page.evaluate(() => document.activeElement?.id)).toBe(href!.slice(1))
    }
    expect((await exportWorkspace(page)).analystWorkspace).toEqual(original.analystWorkspace)
    for (const theme of ['light', 'dark']) {
      await page.evaluate(dark => document.documentElement.classList.toggle('dark', dark), theme === 'dark')
      await summary.evaluate(node => node.scrollIntoView({ block: 'center' }))
      await expect(panel).toHaveAttribute('open', '')
      expect(await panel.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true)
      await panel.screenshot({ path: info.outputPath(`timing-review-${theme}.png`), animations: 'disabled', scale: 'css' })
    }
    await page.getByRole('button', { name: 'Actions for Repairs recorded later', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Edit event', exact: true }).click()
    const editor = page.getByRole('dialog', { name: 'Edit timeline event', exact: true })
    await editor.getByLabel('Date (optional)', { exact: true }).fill('2026-09-10')
    await editor.getByRole('button', { name: 'Save event', exact: true }).click()
    await expect(editor).toBeHidden()
    await expect(row('Repairs recorded later')).toContainText('Dates agree')
    await expect(summary).toContainText(/0 disagreements?/)
    await expect(summary).toContainText('2 unresolved')
    const changed = await exportWorkspace(page)
    expect(changed.source).toEqual(original.source)
    expect(changed.analystWorkspace.events.map(event => [event.id, event.sequenceOrder, event.placement])).toEqual(original.analystWorkspace.events.map(event => [event.id, event.sequenceOrder, event.placement]))
    expect(changed.analystWorkspace.events.find(event => event.id === 'repairs')!.eventDate).toBe('2026-09-10')
    expect(changed.analystWorkspace.events.filter(event => event.id !== 'repairs')).toEqual(original.analystWorkspace.events.filter(event => event.id !== 'repairs'))
    await importWorkspace(page, changed)
    if (await panel.getAttribute('open') === null) await summary.click()
    await expect(row('Repairs recorded later')).toContainText('Dates agree')
    await expect(row('Monthly preparation account')).toContainText('Order unresolved')
    expect((await exportWorkspace(page)).analystWorkspace).toEqual(changed.analystWorkspace)
  })

  test('omits timing review without relative placements and clears old diagnostics on replacement import', async ({ page }) => {
    await start(page)
    await expect(page.locator('summary').filter({ hasText: /^Timing review/ })).toBeVisible()
    const independent = fixture()
    independent.analystWorkspace.events = independent.analystWorkspace.events.map((event, index) => ({ ...event, placement: { mode: 'position', position: index + 1 } }))
    await importWorkspace(page, independent)
    await expect(page.locator('summary').filter({ hasText: /^Timing review/ })).toHaveCount(0)
    await expect(page.getByRole('listitem', { name: 'Timing for Repairs recorded later', exact: true })).toHaveCount(0)
    expect((await exportWorkspace(page)).analystWorkspace.events).toEqual(independent.analystWorkspace.events)
  })
})
