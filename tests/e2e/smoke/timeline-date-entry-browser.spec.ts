import { test, expect, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import type { TimelineWorkspaceExport } from '../../../src/types/timeline-workspace'

const source = {
  schemaVersion: 'timeline-analysis.v1', requestId: 'date-entry-fixture', outcome: 'events',
  article: { url: 'https://publisher.example/library', title: 'Library update', domain: 'publisher.example', publishedAt: '2026-09-14' },
  events: [{ eventDate: '2026-09-10', datePrecision: 'day', title: 'Library repairs recorded', description: 'A synthetic source account.', category: 'event', importance: 'normal' }],
  extraction: { contentSource: 'content-intelligence', sourceMode: 'supplied', method: 'caller-supplied', wordCount: 540, quality: { version: 'analysis-candidate.v1', score: 100, accepted: true }, fallbackAttempts: ['content-intelligence'] },
  model: { name: 'fixture-model', status: 'ok', rejectedEventCount: 0 },
}
async function importData(page: Page, data: unknown) {
  const summary = page.locator('summary').filter({ hasText: /^Start or import a timeline$/ })
  if (await summary.locator('..').getAttribute('open') === null) await summary.click()
  await page.getByLabel('Import timeline JSON').setInputFiles({ name: 'dates.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data)) })
}
async function start(page: Page, data: unknown) {
  await page.route('http://127.0.0.1:5189/api/**', route => route.fulfill({ status: 200, json: { owned: [], member: [] } }))
  await page.goto('/dashboard/tools/timeline')
  await expect(page.locator('.timeline-setup')).toHaveAttribute('open', '')
  await importData(page, data)
}
async function downloaded(page: Page): Promise<TimelineWorkspaceExport> {
  const pending = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export JSON', exact: true }).click()
  return JSON.parse(await readFile((await (await pending).path())!, 'utf8'))
}
async function edit(page: Page, title: string) {
  await page.getByRole('button', { name: `Actions for ${title}`, exact: true }).click()
  await page.getByRole('menuitem', { name: 'Edit event', exact: true }).click()
  return page.getByRole('dialog', { name: 'Edit timeline event', exact: true })
}

test.describe('Recorded date entry @smoke', () => {
  test('explicit day month and year choices preserve precision and the original extraction', async ({ page }, info) => {
    test.setTimeout(120_000)
    await start(page, source)
    const initial = await downloaded(page)
    let dialog = await edit(page, 'Library repairs recorded')
    await dialog.locator('summary').filter({ hasText: /^Date picker$/ }).click()
    await expect(dialog.getByLabel('Select date precision', { exact: true })).toHaveValue('day')
    await expect(dialog.getByLabel('Pick a recorded day', { exact: true })).toHaveValue('2026-09-10')
    await dialog.getByLabel('Select date precision', { exact: true }).selectOption('month')
    await expect(dialog.getByLabel('Pick a recorded month', { exact: true })).toHaveValue('')
    await expect(dialog.getByLabel('Date', { exact: true })).toHaveValue('2026-09-10')
    await dialog.getByLabel('Select date precision', { exact: true }).selectOption('year')
    await dialog.getByLabel('Enter a recorded year', { exact: true }).fill('20')
    await expect(dialog.getByLabel('Date', { exact: true })).toHaveValue('2026-09-10')
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
    expect((await downloaded(page)).analystWorkspace).toEqual(initial.analystWorkspace)
    expect((await downloaded(page)).source).toEqual(initial.source)
    dialog = await edit(page, 'Library repairs recorded')
    await dialog.locator('summary').filter({ hasText: /^Date picker$/ }).click()
    await dialog.getByLabel('Select date precision', { exact: true }).selectOption('month')
    await dialog.getByRole('button', { name: 'Save event', exact: true }).click()
    await expect(dialog).toBeHidden()
    const unchangedDate = await downloaded(page)
    expect(unchangedDate.analystWorkspace.events[0].eventDate).toBe(initial.analystWorkspace.events[0].eventDate)
    expect(unchangedDate.analystWorkspace.events[0].datePrecision).toBe(initial.analystWorkspace.events[0].datePrecision)
    expect(unchangedDate.source).toEqual(initial.source)
    for (const choice of [
      { mode: 'day', label: 'Pick a recorded day', value: '2028-02-29', precision: 'day', status: 'Day recorded' },
      { mode: 'month', label: 'Pick a recorded month', value: '2028-02', precision: 'month', status: 'Month only' },
      { mode: 'year', label: 'Enter a recorded year', value: '2028', precision: 'year', status: 'Year only' },
    ]) {
      dialog = await edit(page, 'Library repairs recorded')
      await dialog.locator('summary').filter({ hasText: /^Date picker$/ }).click()
      await dialog.getByLabel('Select date precision', { exact: true }).selectOption(choice.mode)
      await dialog.getByLabel(choice.label, { exact: true }).fill(choice.value)
      await expect(dialog.getByLabel('Date', { exact: true })).toHaveValue(choice.value)
      await expect(dialog).toContainText(choice.status)
      if (choice.mode === 'month') {
        for (const theme of ['light', 'dark']) {
          await page.evaluate(dark => document.documentElement.classList.toggle('dark', dark), theme === 'dark')
          const control = dialog.getByLabel(choice.label, { exact: true })
          await control.scrollIntoViewIfNeeded()
          await expect(control).toBeInViewport()
          expect(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true)
          await page.screenshot({ path: info.outputPath(`date-entry-${theme}.png`), animations: 'disabled', scale: 'css' })
        }
      }
      await dialog.getByRole('button', { name: 'Save event', exact: true }).click()
      await expect(dialog).toBeHidden()
      const result = await downloaded(page)
      expect(result.source).toEqual(initial.source)
      expect(result.analystWorkspace.events[0].eventDate).toBe(choice.value)
      expect(result.analystWorkspace.events[0].datePrecision).toBe(choice.precision)
      expect(result.analystWorkspace.events[0].original).toMatchObject(source.events[0])
    }
    const final = await downloaded(page)
    await importData(page, final)
    expect((await downloaded(page)).analystWorkspace).toEqual(final.analystWorkspace)
  })

  test('partial recorded date retains its clock and clearing or invalid typing never fabricates a day', async ({ page }) => {
    test.setTimeout(90_000)
    const value: TimelineWorkspaceExport = {
      schemaVersion: 'timeline-workspace.v1', exportedAt: '2026-09-14T12:00:00.000Z', source: { schemaVersion: 'timeline-manual.v1', title: 'Partial date account' },
      analystWorkspace: { mode: 'robust', presentation: 'analyst', sortDirection: 'oldest', questions: [], hypotheses: [], events: [{
        id: 'partial-clock', title: 'Monthly repair note', description: 'Clock supplied without a known day.', eventDate: '2026-09', eventTime: '11:12:13', datePrecision: 'month', category: 'event', importance: 'normal', origin: 'analyst', assessment: 'unreviewed', analystNote: '', modified: false, placement: { mode: 'absolute' }, sequenceOrder: 0, narrativeIncluded: true, narrativeOrder: 0, whyItMatters: '', transition: '',
      }] },
    }
    await start(page, value)
    const original = await downloaded(page)
    let dialog = await edit(page, 'Monthly repair note')
    await expect(dialog).toContainText('Month only')
    await expect(dialog).toContainText(/clock.*retained/i)
    await dialog.locator('summary').filter({ hasText: /^Date picker$/ }).click()
    await expect(dialog.getByLabel('Select date precision', { exact: true })).toHaveValue('month')
    await dialog.getByLabel('Select date precision', { exact: true }).selectOption('day')
    await expect(dialog.getByLabel('Pick a recorded day', { exact: true })).toHaveValue('')
    await expect(dialog.getByLabel('Date', { exact: true })).toHaveValue('2026-09')
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
    expect((await downloaded(page)).analystWorkspace).toEqual(original.analystWorkspace)
    dialog = await edit(page, 'Monthly repair note')
    await dialog.getByLabel('Date', { exact: true }).fill('2026-02-31')
    await expect(dialog).toContainText('Invalid recorded date')
    await dialog.getByRole('button', { name: 'Save event', exact: true }).click()
    await expect(dialog.getByRole('alert')).toContainText('Use a real date')
    await expect(dialog.getByLabel('Date', { exact: true })).toHaveValue('2026-02-31')
    await dialog.locator('summary').filter({ hasText: /^Date picker$/ }).click()
    await dialog.getByRole('button', { name: 'Clear recorded date', exact: true }).click()
    await expect(dialog.getByLabel('Date', { exact: true })).toHaveValue('')
    await expect(dialog).toContainText('No recorded date')
    await dialog.getByRole('button', { name: 'Save event', exact: true }).click()
    await expect(dialog).toBeHidden()
    const cleared = await downloaded(page)
    expect(cleared.source).toEqual(original.source)
    expect(cleared.analystWorkspace.events[0].eventDate).toBeUndefined()
    expect(cleared.analystWorkspace.events[0].datePrecision).toBeUndefined()
    expect(cleared.analystWorkspace.events[0].eventTime).toBe('11:12:13')
    await importData(page, cleared)
    expect((await downloaded(page)).analystWorkspace).toEqual(cleared.analystWorkspace)
  })
})
