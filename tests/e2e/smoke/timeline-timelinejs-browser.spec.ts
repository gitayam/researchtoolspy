import { test, expect, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import type { TimelineWorkspaceExport } from '../../../src/types/timeline-workspace'

function fixture(): TimelineWorkspaceExport {
  return {
    schemaVersion: 'timeline-workspace.v1', exportedAt: '2026-09-12T12:00:00.000Z',
    source: { schemaVersion: 'timeline-manual.v1', title: 'Export fixture' },
    analystWorkspace: {
      mode: 'robust', presentation: 'analyst', sortDirection: 'oldest', questions: [], hypotheses: [],
      narrative: { title: 'How the account changed', framing: 'A curated <account>.', question: 'What changed?', intendedUse: 'Review', scope: 'Synthetic example', timezone: 'UTC', dataThrough: '', chapters: [{ id: 'chapter-one', title: 'Early reports', claim: 'Private chapter claim' }] },
      events: [
        { id: 'first', title: 'First <report>', eventDate: '2024', datePrecision: 'year', description: '<img src=x onerror=alert(1)>', category: 'event', importance: 'normal', origin: 'analyst', assessment: 'unreviewed', analystNote: 'Private analyst note', modified: false, placement: { mode: 'absolute' }, sequenceOrder: 0, narrativeIncluded: true, narrativeOrder: 1, chapterId: 'chapter-one', whyItMatters: 'Establishes the record.' },
        { id: 'later', title: 'Later report', eventDate: '2026-09-12', datePrecision: 'day', eventTime: '14:30:59', description: 'An update.', category: 'event', importance: 'high', origin: 'analyst', assessment: 'disputed', analystNote: '', modified: false, placement: { mode: 'absolute' }, sequenceOrder: 1, narrativeIncluded: true, narrativeOrder: 0 },
        { id: 'unknown', title: 'Date still unresolved', description: null, category: 'event', importance: 'normal', origin: 'analyst', assessment: 'hypothesis', analystNote: '', modified: false, placement: { mode: 'relative', relation: 'after', anchorEventId: 'later' }, sequenceOrder: 2, narrativeIncluded: true, narrativeOrder: 2 },
        { id: 'excluded', title: 'Unselected private record', eventDate: '2026-09-13', datePrecision: 'day', description: null, category: 'event', importance: 'normal', origin: 'analyst', assessment: 'unreviewed', analystNote: '', modified: false, placement: { mode: 'absolute' }, sequenceOrder: 3, narrativeIncluded: false },
      ],
    },
  }
}
async function start(page: Page, data = fixture()) {
  await page.route('**/api/workspaces', route => route.fulfill({ status: 200, json: { owned: [], member: [] } }))
  await page.goto('/dashboard/tools/timeline')
  await page.getByLabel('Import timeline JSON').setInputFiles({ name: 'timeline.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data)) })
}
async function download(page: Page, name: string) {
  const pending = page.waitForEvent('download')
  await page.getByRole('button', { name, exact: true }).click()
  const file = await pending
  return { name: file.suggestedFilename(), value: JSON.parse(await readFile((await file.path())!, 'utf8')) }
}

test.describe('TimelineJS presentation export @smoke', () => {
  test('selected presentation and matching companion preserve source with explicit losses', async ({ page }, testInfo) => {
    const external: string[] = []
    await page.route(/https?:\/\/(?!localhost|127\.0\.0\.1)/, route => { external.push(route.request().url()); return route.abort() })
    await start(page)
    const before = (await download(page, 'Export JSON')).value
    await page.getByRole('button', { name: 'Narrative view', exact: true }).click()
    // Compare the current view as well as data; presentation mode is part of the companion.
    const current = (await download(page, 'Export JSON')).value
    await page.getByRole('button', { name: 'Export TimelineJS', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'TimelineJS export preview' })
    await expect(dialog).toContainText('2 exportable · 3 selected · 1 omitted')
    await expect(dialog).toContainText('Date still unresolved')
    await expect(dialog).toContainText('including unselected events, evidence and review history')
    await expect(dialog.locator('img')).toHaveCount(0)
    for (const theme of ['light', 'dark']) {
      await page.evaluate(value => document.documentElement.classList.toggle('dark', value === 'dark'), theme)
      await expect(dialog).toBeVisible()
      await expect(dialog.getByRole('button', { name: 'Download TimelineJS JSON', exact: true })).toBeInViewport()
      await expect(dialog.getByRole('button', { name: 'Download ResearchTools JSON', exact: true })).toBeInViewport()
      expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
      const path = testInfo.outputPath(`timelinejs-${theme}.png`)
      await dialog.screenshot({ path, animations: 'disabled', scale: 'css' })
      await testInfo.attach(`TimelineJS ${theme}`, { path, contentType: 'image/png' })
    }
    const presentation = await download(page, 'Download TimelineJS JSON')
    const companion = await download(page, 'Download ResearchTools JSON')
    expect(presentation.name.replace('timelinejs', 'researchtools')).toBe(companion.name)
    expect(presentation.value.events.map((event: { unique_id: string }) => event.unique_id)).toEqual(['event-later', 'event-first'])
    expect(presentation.value.events[1].start_date).toEqual({ year: 2024 })
    expect(presentation.value.events[0].start_date).toEqual({ year: 2026, month: 9, day: 12, hour: 14, minute: 30, second: 59 })
    expect(presentation.value.events[1].text.headline).toBe('First &lt;report&gt;')
    expect(JSON.stringify(presentation.value)).not.toContain('<img')
    expect(JSON.stringify(presentation.value)).not.toContain('Unselected private record')
    expect(JSON.stringify(presentation.value)).not.toContain('Private analyst note')
    expect(companion.value.analystWorkspace).toEqual(current.analystWorkspace)
    expect(companion.value.source).toEqual(before.source)
    await page.keyboard.press('Escape')
    await expect(dialog).not.toBeVisible()
    await expect(page.getByRole('button', { name: 'Export TimelineJS', exact: true })).toBeFocused()
    const after = (await download(page, 'Export JSON')).value
    expect(after.analystWorkspace).toEqual(current.analystWorkspace)
    expect(after.source).toEqual(before.source)
    expect(external.filter(url => /knightlab|timelinejs/i.test(url))).toEqual([])
  })

  test('empty eligible selection disables presentation but retains complete backup', async ({ page }) => {
    const data = fixture()
    data.analystWorkspace.events.forEach(event => { event.narrativeIncluded = event.id === 'unknown' })
    await start(page, data)
    await page.getByRole('button', { name: 'Export TimelineJS', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'TimelineJS export preview' })
    await expect(dialog).toContainText('0 exportable · 1 selected · 1 omitted')
    await expect(dialog.getByRole('button', { name: 'Download TimelineJS JSON', exact: true })).toBeDisabled()
    const backup = await download(page, 'Download ResearchTools JSON')
    expect(backup.value.analystWorkspace.events).toHaveLength(4)
    expect(backup.value.analystWorkspace.events.find((event: { id: string }) => event.id === 'unknown').eventDate).toBeUndefined()
  })

  test('a changed workspace blocks both stale downloads until preview refresh', async ({ page }) => {
    await start(page)
    await page.getByRole('button', { name: 'Export TimelineJS', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'TimelineJS export preview' })
    // Simulate a background state update while the modal prevents user interaction.
    await page.getByRole('button', { name: 'Move First <report> earlier in narrative', includeHidden: true }).evaluate(element => (element as HTMLButtonElement).click())
    await expect(dialog.getByRole('alert')).toContainText('workspace changed')
    await expect(dialog.getByRole('button', { name: 'Download TimelineJS JSON', exact: true })).toBeDisabled()
    await expect(dialog.getByRole('button', { name: 'Download ResearchTools JSON', exact: true })).toBeDisabled()
    await dialog.getByRole('button', { name: 'Refresh export preview' }).click()
    await expect(dialog.getByRole('alert')).toHaveCount(0)
    const result = await download(page, 'Download TimelineJS JSON')
    expect(result.value.events.map((event: { unique_id: string }) => event.unique_id)).toEqual(['event-first', 'event-later'])
  })
})
