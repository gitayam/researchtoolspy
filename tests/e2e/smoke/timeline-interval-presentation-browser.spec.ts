import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import type { TimelineWorkspaceEvent, TimelineWorkspaceExport } from '../../../src/types/timeline-workspace'

const csp = readFileSync('public/_headers', 'utf8').split('\n').find(line => line.trim().startsWith('Content-Security-Policy:'))!.trim().slice('Content-Security-Policy:'.length).trim()
function event(id: string, title: string, extra: Partial<TimelineWorkspaceEvent>): TimelineWorkspaceEvent {
  return { id, title, description: 'A synthetic library record.', category: 'event', importance: 'normal', origin: 'analyst', assessment: 'unreviewed', analystNote: '', modified: false, placement: { mode: 'absolute' }, narrativeIncluded: true, whyItMatters: '', transition: '', ...extra }
}
function fixture(events: TimelineWorkspaceEvent[]): TimelineWorkspaceExport {
  return { schemaVersion: 'timeline-workspace.v2', exportedAt: '2026-09-14T12:00:00.000Z', source: { schemaVersion: 'timeline-manual.v1', title: 'Library interval presentation' }, analystWorkspace: {
    mode: 'robust', presentation: 'analyst', sortDirection: 'oldest', questions: [], hypotheses: [],
    narrative: { title: 'Library work and follow-up', framing: '', question: '', intendedUse: '', scope: '', timezone: 'UTC', dataThrough: '', chapters: [] },
    events: events.map((value, index) => ({ ...value, sequenceOrder: index, narrativeOrder: index })),
  } }
}
async function start(page: Page, data: TimelineWorkspaceExport) {
  await page.route('https://timeline.example/**', async route => {
    const url = new URL(route.request().url())
    const staticGet = route.request().method() === 'GET' && !url.pathname.startsWith('/api/')
    const response = await route.fetch({ url: `http://127.0.0.1:5189${url.pathname}${url.search}`, maxRetries: staticGet ? 1 : 0 })
    const headers = { ...response.headers() }
    if (url.pathname === '/dashboard/tools/timeline' || url.pathname === '/timelinejs/preview.html') {
      headers['content-security-policy'] = csp; headers['x-frame-options'] = 'SAMEORIGIN'; headers['x-content-type-options'] = 'nosniff'
    }
    await route.fulfill({ response, headers })
  })
  await page.route('https://timeline.example/api/**', route => route.fulfill({ status: 200, json: { owned: [], member: [] } }))
  await page.goto('https://timeline.example/dashboard/tools/timeline')
  await expect(page.locator('.timeline-setup')).toHaveAttribute('open', '')
  await page.getByLabel('Import timeline JSON').setInputFiles({ name: 'ranges.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data)) })
  await expect(page.getByRole('button', { name: 'Export JSON', exact: true })).toBeVisible()
}
async function download(page: Page, name: string) {
  const pending = page.waitForEvent('download')
  await page.getByRole('button', { name, exact: true }).click()
  return JSON.parse(await readFile((await (await pending).path())!, 'utf8'))
}

test.describe('Recorded interval presentations @smoke', () => {
  test('presents both recorded endpoints and locks them while scheduling a following undated step', async ({ page }, info) => {
    test.setTimeout(120_000)
    const data = fixture([
      event('repair', 'Library repair session', { eventDate: '2026-09-10', eventTime: '09:00:05', datePrecision: 'day', recordedEnd: { date: '2026-09-10', precision: 'day', time: '17:30:59' } }),
      event('followup', 'Check completed repairs', { placement: { mode: 'relative', relation: 'after', anchorEventId: 'repair' } }),
    ])
    await start(page, data)
    const before = await download(page, 'Export JSON')
    await page.getByRole('button', { name: 'Export TimelineJS', exact: true }).click()
    const dialog = page.getByRole('dialog')
    const initial = await download(page, 'Download TimelineJS JSON')
    expect(initial.events).toHaveLength(1)
    expect(initial.events[0].start_date).toEqual({ year: 2026, month: 9, day: 10, hour: 9, minute: 0, second: 5 })
    expect(initial.events[0].end_date).toEqual({ year: 2026, month: 9, day: 10, hour: 17, minute: 30, second: 59 })
    await dialog.getByLabel('Use presentation schedule', { exact: true }).check()
    await dialog.getByLabel('Default presentation date', { exact: true }).fill('2028-02-29')
    const fixed = dialog.getByRole('group', { name: '1. Library repair session presentation schedule', exact: true })
    await expect(fixed).toContainText('2026-09-10')
    await expect(fixed).toContainText('17:30:59')
    await expect(fixed.getByLabel('Presentation time', { exact: true })).toHaveCount(0)
    await expect(fixed.getByLabel('Time means', { exact: true })).toHaveCount(0)
    await expect(fixed.getByLabel('Date override', { exact: true })).toHaveCount(0)
    const following = dialog.getByRole('group', { name: '2. Check completed repairs presentation schedule', exact: true })
    await expect(following.getByLabel('Presentation time', { exact: true })).toHaveValue('17:45:59')
    const scheduled = await download(page, 'Download TimelineJS JSON')
    expect(scheduled.events[0]).toEqual(initial.events[0])
    expect(scheduled.events[1].start_date).toEqual({ year: 2026, month: 9, day: 10, hour: 17, minute: 45, second: 59 })
    const companion = await download(page, 'Download ResearchTools JSON')
    expect(companion.schemaVersion).toBe('timeline-workspace.v2')
    expect(companion.analystWorkspace).toEqual(before.analystWorkspace)
    expect(companion.source).toEqual(before.source)
    await dialog.getByRole('button', { name: 'Open presentation', exact: true }).click()
    const child = page.frameLocator('iframe[title="TimelineJS narrative presentation"]')
    for (const theme of ['light', 'dark']) {
      await page.evaluate(dark => document.documentElement.classList.toggle('dark', dark), theme === 'dark')
      await expect(page.getByText('TimelineJS presentation loaded', { exact: true })).toBeAttached()
      await expect(child.locator('html')).toHaveAttribute('data-theme', theme)
      await child.getByRole('button', { name: 'Next slide', exact: true }).click()
      await expect(child.locator('#slide-position')).toHaveText('Slide 2 of 3')
      const slide = child.locator('.tl-storyslider .tl-slide').filter({ has: child.locator('.tl-headline').filter({ hasText: /^Library repair session$/ }) })
      await expect(slide.locator('.tl-headline')).toBeInViewport()
      await expect(slide.getByText('A synthetic library record.', { exact: true })).toBeInViewport()
      await expect(slide.locator('.tl-headline-date')).toContainText('09:00:05')
      await expect(slide.locator('.tl-headline-date')).toContainText('17:30:59')
      for (const selector of ['.tl-headline-date', '.tl-headline']) {
        await expect.poll(async () => slide.locator(selector).evaluate(node => {
          const box = node.getBoundingClientRect(), story = node.closest('.tl-storyslider')!.getBoundingClientRect()
          return box.height > 0 && box.top >= story.top - 1 && box.bottom <= story.bottom + 1 && box.left >= story.left - 1 && box.right <= story.right + 1
        }), { message: 'Complete recorded range and title fit in the initial story viewport' }).toBe(true)
      }
      await expect(child.getByRole('button', { name: 'Next slide', exact: true })).toBeInViewport()
      await dialog.screenshot({ path: info.outputPath(`interval-presentation-${theme}.png`), animations: 'disabled', scale: 'css' })
    }
    await page.getByText('Accessible event list (2)', { exact: true }).click()
    const list = page.getByRole('region', { name: 'TimelineJS presentation', exact: true }).locator('details')
    await expect(list).toContainText('09:00:05')
    await expect(list).toContainText('17:30:59')
    await list.locator('li[data-event-id="followup"]').getByRole('button', { name: 'Show in presentation', exact: true }).click()
    await expect(child.locator('#slide-position')).toHaveText('Slide 3 of 3')
    await expect(child.locator('.tl-storyslider .tl-headline').filter({ hasText: /^Check completed repairs$/ })).toBeInViewport()
    await dialog.getByRole('button', { name: 'Back to export details', exact: true }).click()
    expect(await download(page, 'Download ResearchTools JSON')).toEqual(companion)
    await dialog.getByRole('button', { name: 'Close', exact: true }).click()
    await expect(dialog).toBeHidden()
    expect((await download(page, 'Export JSON')).analystWorkspace).toEqual(before.analystWorkspace)
  })

  test('renders overlapping precision as a labeled slide while preserving month and year spans', async ({ page }) => {
    test.setTimeout(120_000)
    await start(page, fixture([
      event('overlap', 'An uncertain recorded range', { eventDate: '2026-09-14', datePrecision: 'day', recordedEnd: { date: '2026', precision: 'year' } }),
      event('month', 'Autumn library work', { eventDate: '2026-10', datePrecision: 'month', recordedEnd: { date: '2026-12', precision: 'month' } }),
      event('year', 'Longer library program', { eventDate: '2027', datePrecision: 'year', recordedEnd: { date: '2028', precision: 'year' } }),
    ]))
    const before = await download(page, 'Export JSON')
    await page.getByRole('button', { name: 'Export TimelineJS', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText(/overlap|precision|geometry/i)
    const result = await download(page, 'Download TimelineJS JSON')
    expect(result.events).toHaveLength(3)
    expect(result.events[0]).not.toHaveProperty('end_date')
    expect(result.events[0].display_date).toContain('2026-09-14')
    expect(result.events[0].display_date).toContain('2026')
    expect(result.events[1].end_date).toEqual({ year: 2026, month: 12 })
    expect(result.events[2].end_date).toEqual({ year: 2028 })
    await dialog.getByRole('button', { name: 'Open presentation', exact: true }).click()
    await expect(page.getByText('TimelineJS presentation loaded', { exact: true })).toBeAttached()
    const child = page.frameLocator('iframe[title="TimelineJS narrative presentation"]')
    await child.getByRole('button', { name: 'Next slide', exact: true }).click()
    await expect(child.locator('#slide-position')).toHaveText('Slide 2 of 4')
    const first = child.locator('.tl-storyslider .tl-slide').filter({ has: child.locator('.tl-headline').filter({ hasText: /^An uncertain recorded range$/ }) })
    await expect(first.locator('.tl-headline-date')).toContainText('2026-09-14')
    await expect(first.locator('.tl-headline-date')).toContainText('2026')
    await page.getByText('Accessible event list (3)', { exact: true }).click()
    const list = page.getByRole('region', { name: 'TimelineJS presentation', exact: true }).locator('details')
    await expect(list.locator('li[data-event-id="month"]')).toContainText('2026-12')
    await expect(list.locator('li[data-event-id="year"]')).toContainText('2028')
    await list.locator('li[data-event-id="year"]').getByRole('button', { name: 'Show in presentation', exact: true }).click()
    await expect(child.locator('#slide-position')).toHaveText('Slide 4 of 4')
    await dialog.getByRole('button', { name: 'Back to export details', exact: true }).click()
    expect((await download(page, 'Download ResearchTools JSON')).analystWorkspace).toEqual(before.analystWorkspace)
  })
})
