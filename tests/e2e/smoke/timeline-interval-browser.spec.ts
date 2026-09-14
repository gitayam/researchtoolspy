import { test, expect, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import type { TimelineWorkspaceExport } from '../../../src/types/timeline-workspace'

function fixture(): TimelineWorkspaceExport {
  return { schemaVersion: 'timeline-workspace.v1', exportedAt: '2026-09-14T12:00:00.000Z', source: { schemaVersion: 'timeline-manual.v1', title: 'Library repair range' }, analystWorkspace: {
    mode: 'robust', presentation: 'analyst', sortDirection: 'oldest', questions: [], hypotheses: [],
    events: ['Repairs documented', 'Opening documented'].map((title, index) => ({ id: `record-${index}`, title, description: 'A synthetic recorded account.', eventDate: index ? '2026-10-01' : '2026-09-10', datePrecision: 'day', category: 'event', importance: 'normal', origin: 'analyst', assessment: 'unreviewed', analystNote: '', modified: false, placement: { mode: 'absolute' }, sequenceOrder: index, narrativeOrder: index, narrativeIncluded: true, whyItMatters: '', transition: '' })),
  } }
}
async function importData(page: Page, data: unknown) {
  const summary = page.locator('summary').filter({ hasText: /^Start or import a timeline$/ })
  if (await summary.locator('..').getAttribute('open') === null) await summary.click()
  await page.getByLabel('Import timeline JSON').setInputFiles({ name: 'interval.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data)) })
  await expect(page.getByRole('button', { name: 'Export JSON', exact: true })).toBeVisible()
}
async function start(page: Page) {
  await page.route('http://127.0.0.1:5189/api/**', route => route.fulfill({ status: 200, json: { owned: [], member: [] } }))
  await page.goto('/dashboard/tools/timeline')
  await expect(page.locator('.timeline-setup')).toHaveAttribute('open', '')
  await importData(page, fixture())
}
async function download(page: Page, name = 'Export JSON'): Promise<TimelineWorkspaceExport> {
  const pending = page.waitForEvent('download')
  await page.getByRole('button', { name, exact: true }).click()
  return JSON.parse(await readFile((await (await pending).path())!, 'utf8'))
}
async function edit(page: Page) {
  await page.getByRole('button', { name: 'Actions for Repairs documented', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Edit event', exact: true }).click()
  return page.getByRole('dialog', { name: 'Edit timeline event', exact: true })
}

test.describe('Local recorded intervals @smoke', () => {
  test('authors a precise interval and preserves v2 through draft reload, import and complete backup', async ({ page }, info) => {
    test.setTimeout(120_000)
    await start(page)
    const original = await download(page)
    const editor = await edit(page)
    await editor.getByLabel('Record an end date', { exact: true }).check()
    await expect(editor.getByLabel('End date', { exact: true })).toHaveValue('')
    await editor.getByLabel('End date', { exact: true }).fill('2026-09-12')
    await editor.getByLabel('End time (optional)', { exact: true }).fill('17:30:59')
    for (const theme of ['light', 'dark']) {
      await page.evaluate(dark => document.documentElement.classList.toggle('dark', dark), theme === 'dark')
      await editor.getByLabel('End date', { exact: true }).scrollIntoViewIfNeeded()
      await expect(editor.getByLabel('End time (optional)', { exact: true })).toBeInViewport()
      expect(await editor.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true)
      await page.screenshot({ path: info.outputPath(`interval-entry-${theme}.png`), animations: 'disabled', scale: 'css' })
    }
    await editor.getByRole('button', { name: 'Save event', exact: true }).click()
    await expect(editor).toBeHidden()
    await expect(page.getByText(/Recorded interval/).first()).toBeVisible()
    const saved = await download(page)
    expect(saved.schemaVersion).toBe('timeline-workspace.v2')
    expect(saved.analystWorkspace.events[0].recordedEnd).toEqual({ date: '2026-09-12', precision: 'day', time: '17:30:59' })
    expect(saved.source).toEqual(original.source)
    expect(saved.analystWorkspace.events[1]).toEqual(original.analystWorkspace.events[1])
    const draft = await page.evaluate(() => JSON.parse(localStorage.getItem('researchtools.timeline.manual-draft.v1')!))
    expect(draft.schemaVersion).toBe('timeline-browser-draft.v2')
    await page.reload()
    const setup = page.locator('summary').filter({ hasText: /^Start or import a timeline$/ })
    if (await setup.locator('..').getAttribute('open') === null) await setup.click()
    await page.getByRole('button', { name: 'Resume saved timeline', exact: true }).click()
    expect((await download(page)).analystWorkspace).toEqual(saved.analystWorkspace)
    await importData(page, saved)
    expect((await download(page)).analystWorkspace).toEqual(saved.analystWorkspace)
    await page.getByRole('button', { name: 'Export TimelineJS', exact: true }).click()
    const preview = page.getByRole('dialog', { name: 'TimelineJS export preview', exact: true })
    await expect(preview).toContainText(/interval/i)
    const pending = page.waitForEvent('download')
    await preview.getByRole('button', { name: 'Download TimelineJS JSON', exact: true }).click()
    const projection = JSON.parse(await readFile((await (await pending).path())!, 'utf8'))
    expect(projection.events.map((event: { unique_id: string }) => event.unique_id)).toEqual(['event-record-1'])
    const complete = await download(page, 'Download ResearchTools JSON')
    expect(complete.schemaVersion).toBe('timeline-workspace.v2')
    expect(complete.analystWorkspace.events).toEqual(saved.analystWorkspace.events)
    expect(complete.source).toEqual(original.source)
  })

  test('rejects blank and reversed ends, cancels edits and removes an interval only on explicit Save', async ({ page }) => {
    test.setTimeout(120_000)
    await start(page)
    const before = await download(page)
    let editor = await edit(page)
    await editor.getByLabel('Record an end date', { exact: true }).check()
    await editor.getByRole('button', { name: 'Save event', exact: true }).click()
    await expect(editor.getByRole('alert')).toBeVisible()
    await editor.getByLabel('End date', { exact: true }).fill('2026-09-09')
    await editor.getByRole('button', { name: 'Save event', exact: true }).click()
    await expect(editor.getByRole('alert')).toBeVisible()
    await expect(editor.getByLabel('End date', { exact: true })).toHaveValue('2026-09-09')
    await editor.getByRole('button', { name: 'Cancel', exact: true }).click()
    expect((await download(page)).analystWorkspace).toEqual(before.analystWorkspace)
    editor = await edit(page)
    await editor.getByLabel('Record an end date', { exact: true }).check()
    await editor.getByLabel('End date', { exact: true }).fill('2026-09')
    await expect(editor).toContainText(/uncertain|overlap/i)
    await editor.getByRole('button', { name: 'Save event', exact: true }).click()
    await expect(editor).toBeHidden()
    const ranged = await download(page)
    expect(ranged.analystWorkspace.events[0].recordedEnd).toEqual({ date: '2026-09', precision: 'month' })
    editor = await edit(page)
    await editor.getByLabel('Record an end date', { exact: true }).uncheck()
    await editor.getByRole('button', { name: 'Cancel', exact: true }).click()
    expect((await download(page)).analystWorkspace).toEqual(ranged.analystWorkspace)
    editor = await edit(page)
    await editor.getByLabel('Record an end date', { exact: true }).uncheck()
    await editor.getByRole('button', { name: 'Save event', exact: true }).click()
    await expect(editor).toBeHidden()
    const single = await download(page)
    expect(single.schemaVersion).toBe('timeline-workspace.v1')
    expect(single.analystWorkspace.events[0].recordedEnd).toBeUndefined()
    expect(single.analystWorkspace.events[0].eventDate).toBe('2026-09-10')
    expect(single.source).toEqual(before.source)
  })
})
