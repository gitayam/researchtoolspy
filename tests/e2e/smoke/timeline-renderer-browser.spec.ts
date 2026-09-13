import { test, expect, type Page, type Locator } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import type { TimelineWorkspaceExport } from '../../../src/types/timeline-workspace'

async function openWorkflowDisclosure(page: Page, label: string) {
  const summary = page.locator('summary').filter({ hasText: new RegExp(`^${label}$`) })
  if (await summary.locator('..').getAttribute('open') === null) await summary.click()
}


const csp = readFileSync('public/_headers', 'utf8').split('\n').find(line => line.trim().startsWith('Content-Security-Policy:'))!.trim().slice('Content-Security-Policy:'.length).trim()
function fixture(count = 4): TimelineWorkspaceExport {
  return { schemaVersion: 'timeline-workspace.v1', exportedAt: '2026-09-12T12:00:00.000Z', source: { schemaVersion: 'timeline-manual.v1', title: 'Renderer fixture' }, analystWorkspace: {
    mode: 'robust', presentation: 'analyst', sortDirection: 'oldest', questions: [], hypotheses: [],
    narrative: { title: 'A changing account', framing: 'Selected events in context.', question: '', intendedUse: 'Review', scope: '', timezone: 'UTC', dataThrough: '', chapters: [{ id: 'reports', title: 'Reports', claim: 'Private chapter claim' }] },
    events: Array.from({ length: count }, (_, index) => ({ id: `event-${index}`, title: index === 0 ? 'Early <report>' : index === 1 ? 'Monthly update' : index === 2 ? 'Latest report' : `Unresolved ${index}`, description: index === 0 ? '<img src="https://attacker.invalid/x" onerror="window.parent.__timelineAttack=1">' : 'A selected account.', category: 'event', importance: 'normal', origin: 'analyst', assessment: 'unreviewed', analystNote: 'Private note never sent to renderer', modified: false, narrativeIncluded: true, narrativeOrder: count - index, chapterId: 'reports', sequenceOrder: index,
      ...(index < 3 || count > 4 ? { eventDate: index === 0 ? '2024' : index === 1 ? '2025-06' : '2026-09-12', datePrecision: index === 0 ? 'year' : index === 1 ? 'month' : 'day', placement: { mode: 'absolute' } } : { placement: { mode: 'position', position: index } }),
    })),
  } }
}
async function start(page: Page, value = fixture()) {
  // A public HTTPS origin exercises opaque-frame loading without Chromium's
  // localhost-only network-access restriction. All bytes come from isolated Vite.
  await page.route('https://timeline.example/**', async route => {
    const url = new URL(route.request().url())
    // The real Vite static proxy can reset a socket during module loading.
    // Playwright retries only ECONNRESET, never HTTP errors; retain the real bytes
    // and fail after one retry. API/mutating requests are never retried here.
    const staticGet = route.request().method() === 'GET' && !url.pathname.startsWith('/api/')
    const response = await route.fetch({ url: `http://127.0.0.1:5189${url.pathname}${url.search}`, maxRetries: staticGet ? 1 : 0 })
    const headers = { ...response.headers() }
    if (url.pathname === '/dashboard/tools/timeline' || url.pathname === '/timelinejs/preview.html') {
      headers['content-security-policy'] = csp
      headers['x-frame-options'] = 'SAMEORIGIN'
      headers['x-content-type-options'] = 'nosniff'
    }
    await route.fulfill({ response, headers })
  })
  await page.route('https://timeline.example/api/**', route => route.fulfill({ status: 200, json: { owned: [], member: [] } }))
  await page.goto('https://timeline.example/dashboard/tools/timeline')
  await expect(page.locator('.timeline-setup')).toHaveAttribute('open', '')
  await openWorkflowDisclosure(page, 'Start or import a timeline'); await page.getByLabel('Import timeline JSON').setInputFiles({ name: 'timeline.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(value)) })
}

async function exported(page: Page) {
  const pending = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export JSON', exact: true }).click()
  return JSON.parse(await readFile((await (await pending).path())!, 'utf8'))
}
async function open(page: Page) {
  await page.getByRole('button', { name: 'Export TimelineJS', exact: true }).click()
  await page.getByRole('button', { name: 'Open presentation', exact: true }).click()
  await expect(page.getByText('TimelineJS presentation loaded', { exact: true })).toBeAttached()
  return page.frameLocator('iframe[title="TimelineJS narrative presentation"]')
}

test.describe('Self-hosted TimelineJS renderer @smoke', () => {
  test('temporary schedule renders equal-date drink steps in order and retimes without rewriting the backup', async ({ page }, info) => {
    test.setTimeout(120_000)
    const value = fixture(4)
    value.analystWorkspace.narrative!.title = 'Four drink purchases'
    value.analystWorkspace.narrative!.chapters = []
    const steps = ['First purchase', 'Second purchase', 'Third purchase', 'Fourth purchase']
    value.analystWorkspace.events = value.analystWorkspace.events.map((event, index) => ({
      ...event, title: 'Buy a drink', description: steps[index], eventDate: undefined, eventTime: undefined, datePrecision: undefined,
      chapterId: undefined, narrativeOrder: index,
      placement: index ? { mode: 'relative' as const, relation: 'after' as const, anchorEventId: `event-${index - 1}` } : { mode: 'position' as const, position: 1 },
    }))
    await start(page, value)
    const before = await exported(page)
    await page.getByRole('button', { name: 'Export TimelineJS', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByLabel('Use presentation schedule', { exact: true })).not.toBeChecked()
    await expect(dialog.getByRole('button', { name: 'Open presentation', exact: true })).toBeDisabled()
    await dialog.getByLabel('Use presentation schedule', { exact: true }).check()
    const today = await page.evaluate(() => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}` })
    await expect(dialog.getByLabel('Default presentation date', { exact: true })).toHaveValue(today)
    await dialog.getByLabel('Default presentation date', { exact: true }).fill('2028-02-29')
    const groups = steps.map((_, index) => dialog.getByRole('group', { name: `${index + 1}. Buy a drink presentation schedule`, exact: true }))
    for (const [index, group] of groups.entries()) {
      await expect(group).toHaveCount(1)
      await expect(group.getByText(steps[index], { exact: true })).toBeVisible()
      await expect(group.getByLabel('Time override', { exact: true })).toHaveValue('')
      await expect(group.getByLabel('Time means', { exact: true })).toHaveValue('action')
    }
    const download = async (name: string) => {
      const pending = page.waitForEvent('download')
      await dialog.getByRole('button', { name, exact: true }).click()
      return JSON.parse(await readFile((await (await pending).path())!, 'utf8'))
    }
    const equalDates = await download('Download TimelineJS JSON')
    expect(equalDates.events.map((event: { unique_id: string }) => event.unique_id)).toEqual(['event-event-0', 'event-event-1', 'event-event-2', 'event-event-3'])
    expect(equalDates.events.map((event: { start_date: unknown }) => event.start_date)).toEqual(Array(4).fill({ year: 2028, month: 2, day: 29 }))
    const companion = await download('Download ResearchTools JSON')
    expect(companion.source).toEqual(before.source)
    expect(companion.analystWorkspace).toEqual(before.analystWorkspace)
    await dialog.getByRole('button', { name: 'Open presentation', exact: true }).click()
    await expect(page.getByText('TimelineJS presentation loaded', { exact: true })).toBeAttached()
    const child = page.frameLocator('iframe[title="TimelineJS narrative presentation"]')
    const expectCompleteStoryText = async (text: Locator) => {
      await expect.poll(async () => text.evaluate(element => {
        const bounds = element.getBoundingClientRect()
        const viewport = element.closest('.tl-storyslider')!.getBoundingClientRect()
        return bounds.height > 0 && bounds.top >= viewport.top - 1 && bounds.bottom <= viewport.bottom + 1
      }), { message: 'Scheduled slide text must fit completely within its story viewport' }).toBe(true)
    }
    for (const description of steps) {
      await child.getByRole('button', { name: 'Next slide', exact: true }).click()
      await expect(child.locator('.tl-storyslider').getByText(description, { exact: true })).toBeInViewport()
    }
    await page.getByText('Accessible event list (4)', { exact: true }).click()
    const accessible = page.getByRole('region', { name: 'TimelineJS presentation', exact: true }).locator('details ol')
    await expect(accessible.locator('li')).toHaveCount(4)
    await expect(accessible.locator('li').nth(1)).toContainText('Relative placement: after “Buy a drink”')
    await expect(accessible.locator('li').first()).toContainText('Sequence position: 1')
    await expect(accessible.locator('li').first()).toContainText('presentation assumption')
    await dialog.getByRole('button', { name: 'Back to export details', exact: true }).click()
    await expect(dialog.getByLabel('Use presentation schedule', { exact: true })).toBeChecked()
    await expect(dialog.getByLabel('Default presentation date', { exact: true })).toHaveValue('2028-02-29')
    await groups[0].getByLabel('Time override', { exact: true }).fill('09:00')
    await groups[0].getByLabel('Time means', { exact: true }).selectOption('start')
    await groups[1].getByLabel('Time override', { exact: true }).fill('10:00')
    await groups[1].getByLabel('Time means', { exact: true }).selectOption('arrive')
    await groups[2].getByLabel('Date override', { exact: true }).fill('2028-03-01')
    await groups[2].getByLabel('Time override', { exact: true }).fill('00:15:07')
    await groups[3].getByLabel('Time override', { exact: true }).fill('10:05')
    const retimed = await download('Download TimelineJS JSON')
    expect(retimed.events.map((event: { start_date: unknown }) => event.start_date)).toEqual([
      { year: 2028, month: 2, day: 29, hour: 9, minute: 0 }, { year: 2028, month: 2, day: 29, hour: 10, minute: 0 },
      { year: 2028, month: 3, day: 1, hour: 0, minute: 15, second: 7 }, { year: 2028, month: 2, day: 29, hour: 10, minute: 5 },
    ])
    expect(retimed.events[0].display_date).toMatch(/^Start:/)
    expect(retimed.events[1].display_date).toMatch(/^Arrive:/)
    expect(await download('Download ResearchTools JSON')).toEqual(companion)
    await dialog.getByLabel('Default presentation date', { exact: true }).fill('')
    await expect(dialog.getByRole('alert')).toContainText('Check the presentation schedule')
    await expect(dialog.getByRole('button', { name: 'Open presentation', exact: true })).toBeDisabled()
    await expect(dialog.getByRole('button', { name: 'Download TimelineJS JSON', exact: true })).toBeDisabled()
    expect(await download('Download ResearchTools JSON')).toEqual(companion)
    await dialog.getByLabel('Default presentation date', { exact: true }).fill('2028-02-29')
    for (const theme of ['light', 'dark']) {
      await page.evaluate(dark => document.documentElement.classList.toggle('dark', dark), theme === 'dark')
      await dialog.getByLabel('Default presentation date', { exact: true }).scrollIntoViewIfNeeded()
      await dialog.screenshot({ path: info.outputPath(`schedule-form-${theme}.png`), animations: 'disabled', scale: 'css' })
      await groups[0].scrollIntoViewIfNeeded()
      for (const label of ['Date override', 'Time override', 'Time means']) await expect(groups[0].getByLabel(label, { exact: true })).toBeInViewport()
      await dialog.screenshot({ path: info.outputPath(`schedule-event-${theme}.png`), animations: 'disabled', scale: 'css' })
      await dialog.getByRole('button', { name: 'Open presentation', exact: true }).click()
      await expect(page.getByText('TimelineJS presentation loaded', { exact: true })).toBeAttached()
      await child.getByRole('button', { name: 'Next slide', exact: true }).click()
      await expect(child.locator('.tl-storyslider').getByText('First purchase', { exact: true })).toBeInViewport()
      const firstSlide = child.locator('.tl-storyslider .tl-slide').filter({ has: child.getByText('First purchase', { exact: true }) })
      await expectCompleteStoryText(firstSlide.locator('.tl-headline'))
      await expectCompleteStoryText(firstSlide.locator('.tl-headline-date'))
      await expect(dialog.getByRole('status').filter({ hasText: /^4 shown · 0 omitted · 4 scheduled$/ })).toBeVisible()
      await dialog.screenshot({ path: info.outputPath(`schedule-slide-${theme}.png`), animations: 'disabled', scale: 'css' })
      await child.getByRole('button', { name: 'Next slide', exact: true }).click()
      await expect(child.locator('.tl-storyslider').getByText('Second purchase', { exact: true })).toBeInViewport()
      const secondSlide = child.locator('.tl-storyslider .tl-slide').filter({ has: child.getByText('Second purchase', { exact: true }) })
      await expectCompleteStoryText(secondSlide.locator('.tl-headline'))
      await expectCompleteStoryText(secondSlide.locator('.tl-headline-date'))
      // Long scheduled slides may scroll. Each provenance paragraph must remain
      // reachable in the actual renderer; short-slide full-bounds checks stay intact.
      for (const phrase of ['Presentation schedule:', 'Original recorded date/time:', 'Relative placement: after']) {
        const paragraph = secondSlide.locator('.tl-text-content p').filter({ hasText: phrase })
        await paragraph.scrollIntoViewIfNeeded()
        await expect(paragraph).toBeInViewport()
        await expectCompleteStoryText(paragraph)
      }
      await expect(secondSlide).toContainText('presentation assumption')
      await expect(secondSlide).toContainText('date not recorded; time not recorded')
      for (const description of ['Fourth purchase', 'Third purchase']) {
        await child.getByRole('button', { name: 'Next slide', exact: true }).click()
        await expect(child.locator('.tl-storyslider').getByText(description, { exact: true })).toBeInViewport()
      }
      await dialog.getByRole('button', { name: 'Back to export details', exact: true }).click()
      await expect(groups[0].getByLabel('Time means', { exact: true })).toHaveValue('start')
      expect(await download('Download ResearchTools JSON')).toEqual(companion)
    }
    await page.keyboard.press('Escape')
    expect((await exported(page)).analystWorkspace).toEqual(before.analystWorkspace)
    await page.getByRole('button', { name: 'Export TimelineJS', exact: true }).click()
    await expect(dialog.getByLabel('Use presentation schedule', { exact: true })).not.toBeChecked()
    await dialog.getByLabel('Use presentation schedule', { exact: true }).check()
    await expect(dialog.getByLabel('Default presentation date', { exact: true })).toHaveValue(today)
    await expect(groups[0].getByLabel('Time override', { exact: true })).toHaveValue('')
    await expect(groups[0].getByLabel('Time means', { exact: true })).toHaveValue('action')
  })

  test('recorded dates on relative and numbered events present without temporary scheduling', async ({ page }) => {
    const value = fixture(2)
    value.analystWorkspace.events[0].placement = { mode: 'position', position: 1 }
    value.analystWorkspace.events[1].placement = { mode: 'relative', relation: 'before', anchorEventId: 'event-0' }
    value.analystWorkspace.events[1].eventDate = '2025-06-07'
    value.analystWorkspace.events[1].datePrecision = 'day'
    value.analystWorkspace.events[1].eventTime = '11:12:13'
    await start(page, value)
    const before = await exported(page)
    await page.getByRole('button', { name: 'Export TimelineJS', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByLabel('Use presentation schedule', { exact: true })).not.toBeChecked()
    await expect(dialog).toContainText('2 exportable · 2 selected · 0 omitted')
    const pending = page.waitForEvent('download')
    await dialog.getByRole('button', { name: 'Download TimelineJS JSON', exact: true }).click()
    const data = JSON.parse(await readFile((await (await pending).path())!, 'utf8'))
    expect(data.events.map((event: { start_date: unknown }) => event.start_date)).toEqual([{ year: 2025, month: 6, day: 7, hour: 11, minute: 12, second: 13 }, { year: 2024 }])
    await dialog.getByRole('button', { name: 'Open presentation', exact: true }).click()
    await expect(page.getByText('TimelineJS presentation loaded', { exact: true })).toBeAttached()
    await page.getByText('Accessible event list (2)', { exact: true }).click()
    const list = page.getByRole('region', { name: 'TimelineJS presentation', exact: true }).locator('details ol')
    await expect(list).toContainText('Relative placement: before “Early <report>”')
    await expect(list).toContainText('This relation is not enforced as chronology')
    await expect(list).not.toContainText('presentation assumption')
    await dialog.getByRole('button', { name: 'Back to export details', exact: true }).click()
    await dialog.getByLabel('Use presentation schedule', { exact: true }).check()
    const retimed = dialog.getByRole('group', { name: '1. Monthly update presentation schedule', exact: true })
    await retimed.getByLabel('Date override', { exact: true }).fill('2028-03-01')
    await retimed.getByLabel('Time override', { exact: true }).fill('06:30')
    await retimed.getByLabel('Time means', { exact: true }).selectOption('arrive')
    await dialog.getByRole('button', { name: 'Open presentation', exact: true }).click()
    await expect(page.getByText('TimelineJS presentation loaded', { exact: true })).toBeAttached()
    await page.getByText('Accessible event list (2)', { exact: true }).click()
    const row = list.locator('li[data-event-id="event-1"]')
    await expect(row).toContainText('Arrive: 2028-03-01 06:30')
    await expect(row).toContainText('presentation assumption')
    const original = row.getByText('Original recorded date/time: 2025-06-07; 11:12:13.', { exact: true })
    await original.scrollIntoViewIfNeeded()
    await expect(original).toBeInViewport()
    await page.keyboard.press('Escape')
    expect((await exported(page)).analystWorkspace).toEqual(before.analystWorkspace)
  })

  test('workflow prioritizes current events and presents a frozen selection with explicit omissions', async ({ page }, info) => {
    test.setTimeout(120_000)
    const requests: string[] = []
    page.on('request', request => { if (/\/api\/|\/timelinejs\/|\/vendor\/timelinejs\//.test(request.url())) requests.push(request.url()) })
    await start(page)
    const setup = page.locator('summary').filter({ hasText: /^Start or import a timeline$/ }).locator('..')
    const contents = page.locator('summary').filter({ hasText: /^Find events and contents$/ }).locator('..')
    await expect(setup).not.toHaveAttribute('open')
    await expect(contents).not.toHaveAttribute('open')
    expect(await page.getByTestId('timeline-results').evaluate(element => Boolean(element.compareDocumentPosition(document.querySelector('.timeline-setup')!) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true)
    await expect(page.getByRole('button', { name: 'Present', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Robust analyst', exact: true })).toBeVisible()
    await expect(page.getByLabel('Sort events', { exact: true })).toBeVisible()
    await page.getByLabel('Narrative title', { exact: true }).fill('Current unsaved account')
    const before = await exported(page)
    const count = requests.length
    await openWorkflowDisclosure(page, 'Find events and contents')
    await page.getByLabel('Find an event', { exact: true }).fill('Monthly')
    await expect(page.getByRole('navigation', { name: 'Timeline events', exact: true }).getByRole('link')).toHaveCount(1)
    await contents.locator('summary').first().click()
    await openWorkflowDisclosure(page, 'Find events and contents')
    await expect(page.getByLabel('Find an event', { exact: true })).toHaveValue('Monthly')
    await page.getByLabel('Find an event', { exact: true }).fill('')
    await contents.locator('summary').first().click()
    await openWorkflowDisclosure(page, 'Start or import a timeline')
    await setup.locator('summary').first().click()
    expect(requests).toHaveLength(count)
    expect((await exported(page)).analystWorkspace).toEqual(before.analystWorkspace)
    for (const theme of ['light', 'dark']) {
      await page.evaluate(dark => document.documentElement.classList.toggle('dark', dark), theme === 'dark')
      await page.getByRole('button', { name: 'Present', exact: true }).evaluate(element => element.scrollIntoView({ block: 'center' }))
      await page.getByRole('button', { name: 'Present', exact: true }).click({ trial: true })
      await page.screenshot({ path: info.outputPath(`workflow-primary-${theme}.png`), animations: 'disabled', scale: 'css' })
      const firstEventAction = page.getByRole('button', { name: 'Actions for Early <report>', exact: true })
      await firstEventAction.evaluate(element => element.scrollIntoView({ block: 'center' }))
      await firstEventAction.click({ trial: true })
      await page.screenshot({ path: info.outputPath(`workflow-event-${theme}.png`), animations: 'disabled', scale: 'css' })
      await openWorkflowDisclosure(page, 'Find events and contents')
      await page.getByLabel('Find an event', { exact: true }).evaluate(element => element.scrollIntoView({ block: 'center' }))
      await page.getByLabel('Find an event', { exact: true }).click({ trial: true })
      await page.screenshot({ path: info.outputPath(`workflow-contents-${theme}.png`), animations: 'disabled', scale: 'css' })
      await contents.locator('summary').first().click()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    }
    await page.getByRole('button', { name: 'Present', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Current timeline presentation', exact: true })
    await expect(dialog).toContainText('Current edits · Selected narrative')
    await expect(dialog).toContainText('3 shown · 1 omitted')
    await expect(dialog.getByRole('status').filter({ hasText: /^3 shown · 1 omitted$/ })).toBeVisible()
    await expect(page.getByText('TimelineJS presentation loaded', { exact: true })).toBeAttached()
    const child = page.frameLocator('iframe[title="TimelineJS narrative presentation"]')
    await expect(child.locator('.tl-headline').filter({ hasText: 'Current unsaved account' })).toBeVisible()
    await expect(child.locator('.tl-timemarker')).toHaveCount(3)
    await dialog.getByRole('button', { name: 'Back to export details', exact: true }).click()
    const details = page.getByRole('dialog', { name: 'TimelineJS export preview', exact: true })
    await expect(details).toContainText('Unresolved 3')
    const pending = page.waitForEvent('download')
    await details.getByRole('button', { name: 'Download ResearchTools JSON', exact: true }).click()
    const companion = JSON.parse(await readFile((await (await pending).path())!, 'utf8'))
    expect(companion.analystWorkspace).toEqual(before.analystWorkspace)
    expect(companion.source).toEqual(before.source)
    await page.keyboard.press('Escape')
    await expect(page.getByRole('button', { name: 'Present', exact: true })).toBeFocused()
    expect((await exported(page)).analystWorkspace).toEqual(before.analystWorkspace)
    await page.getByRole('button', { name: 'Export TimelineJS', exact: true }).click()
    await expect(page.getByRole('dialog', { name: 'TimelineJS export preview', exact: true })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('button', { name: 'Export TimelineJS', exact: true })).toBeFocused()
  })

  test('Present falls back to export details for zero or more than 100 eligible events', async ({ page }) => {
    test.setTimeout(120_000)
    const rendererRequests: string[] = []
    page.on('request', request => { if (/\/timelinejs\/|\/vendor\/timelinejs\//.test(request.url())) rendererRequests.push(request.url()) })
    await start(page, fixture(101))
    await page.getByRole('button', { name: 'Present', exact: true }).click()
    let dialog = page.getByRole('dialog', { name: 'TimelineJS export preview', exact: true })
    await expect(dialog).toContainText('Presentation supports up to 100 dated events')
    await expect(dialog.getByRole('button', { name: 'Open presentation', exact: true })).toBeDisabled()
    const pending = page.waitForEvent('download')
    await dialog.getByRole('button', { name: 'Download TimelineJS JSON', exact: true }).click()
    expect(JSON.parse(await readFile((await (await pending).path())!, 'utf8')).events).toHaveLength(101)
    await page.keyboard.press('Escape')
    const empty = fixture(); empty.analystWorkspace.events.forEach(event => { event.narrativeIncluded = event.id === 'event-3' })
    await openWorkflowDisclosure(page, 'Start or import a timeline')
    await page.getByLabel('Import timeline JSON').setInputFiles({ name: 'zero.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(empty)) })
    await expect(page.locator('.timeline-setup')).not.toHaveAttribute('open')
    await page.getByRole('button', { name: 'Present', exact: true }).click()
    dialog = page.getByRole('dialog', { name: 'TimelineJS export preview', exact: true })
    await expect(dialog).toContainText('Select at least one event with a recorded date, or enable a presentation schedule')
    await expect(dialog.getByRole('button', { name: 'Download TimelineJS JSON', exact: true })).toBeDisabled()
    await expect(dialog.getByRole('button', { name: 'Download ResearchTools JSON', exact: true })).toBeEnabled()
    await expect(page.locator('iframe')).toHaveCount(0)
    expect(rendererRequests).toEqual([])
  })

  test('real pinned renderer is lazy, chronological, isolated and preserves the source', async ({ page }, testInfo) => {
    test.setTimeout(120_000)
    const requests: string[] = []
    page.on('request', request => requests.push(request.url()))
    await start(page)
    const before = await exported(page)
    expect(requests.filter(url => /\/vendor\/timelinejs\/|\/timelinejs\//.test(url))).toEqual([])
    const boundary = requests.length
    const child = await open(page)
    const iframe = page.locator('iframe[title="TimelineJS narrative presentation"]')
    await expect(iframe).toHaveAttribute('sandbox', 'allow-scripts')
    await expect(child.locator('.tl-headline').filter({ hasText: 'A changing account' })).toBeVisible()
    await expect(child.locator('.tl-timemarker')).toHaveCount(3)
    await expect(child.locator('.tl-timenav')).toContainText('Reports')
    await page.getByLabel('Open at', { exact: true }).selectOption('latest')
    await expect(page.getByText('TimelineJS presentation loaded', { exact: true })).toBeAttached()
    await expect(child.locator('.tl-storyslider .tl-slide .tl-headline').filter({ hasText: /^Latest report$/ })).toBeInViewport()
    await page.getByLabel('Open at', { exact: true }).selectOption('beginning')
    await expect(page.getByText('TimelineJS presentation loaded', { exact: true })).toBeAttached()
    const next = child.getByRole('button', { name: 'Next slide', exact: true })
    await next.focus()
    await page.keyboard.press('Enter')
    await expect(child.locator('.tl-storyslider .tl-slide .tl-headline').filter({ hasText: /^Early <report>$/ })).toBeInViewport()
    const frame = page.frames().find(item => item.url().includes('/timelinejs/preview.html'))!
    expect(await frame.evaluate(() => document.fonts.load('16px \"tl-icons\"').then(fonts => fonts.some(font => font.status === 'loaded')))).toBe(true)
    const isolation = await frame.evaluate(() => {
      let parentBlocked = false, storageBlocked = false
      try { void window.parent.document } catch { parentBlocked = true }
      try { void window.localStorage } catch { storageBlocked = true }
      return { parentBlocked, storageBlocked }
    })
    expect(isolation).toEqual({ parentBlocked: true, storageBlocked: true })
    expect(await page.evaluate(() => '__timelineAttack' in window)).toBe(false)
    await expect(child.locator('img[src*="attacker"]')).toHaveCount(0)
    await page.getByText('Accessible event list (3)', { exact: true }).click()
    const list = page.getByRole('region', { name: 'TimelineJS presentation', exact: true }).locator('details ol')
    await expect(list.locator('h3')).toHaveText(['Early <report>', 'Monthly update', 'Latest report'])
    await expect(list).toContainText('2024')
    await expect(list).toContainText('2025-06')
    await page.getByText('Accessible event list (3)', { exact: true }).click()
    for (const theme of ['light', 'dark']) {
      await page.evaluate(value => document.documentElement.classList.toggle('dark', value === 'dark'), theme)
      // Theme changes remount the frame. Select the same event in every capture.
      await page.getByLabel('Open at', { exact: true }).selectOption('latest')
      await expect(page.getByText('TimelineJS presentation loaded', { exact: true })).toBeAttached()
      await page.getByLabel('Open at', { exact: true }).selectOption('beginning')
      await expect(page.getByText('TimelineJS presentation loaded', { exact: true })).toBeAttached()
      await child.getByRole('button', { name: 'Next slide', exact: true }).click()
      await expect(child.locator('.tl-storyslider .tl-slide .tl-headline').filter({ hasText: /^Early <report>$/ })).toBeInViewport()
      const activeSlide = child.locator('.tl-storyslider .tl-slide').filter({ has: child.locator('.tl-headline').filter({ hasText: /^Early <report>$/ }) })
      const headline = activeSlide.locator('.tl-headline')
      const paragraphs = activeSlide.locator('.tl-text-content p')
      await expect(paragraphs).toHaveCount(2)
      // Intersection alone accepts a clipped headline. Require the complete
      // rendered headline and both fixture paragraphs inside the story viewport.
      for (const text of [headline, ...await paragraphs.all()]) {
        await expect.poll(async () => text.evaluate(element => {
          const bounds = element.getBoundingClientRect()
          const story = element.closest('.tl-storyslider')!.getBoundingClientRect()
          return bounds.height > 0 && bounds.top >= story.top - 1 && bounds.bottom <= story.bottom + 1
        }), { message: 'Active slide text must fit fully inside the story viewport' }).toBe(true)
      }
      if (theme === 'dark') {
        const marker = child.locator('.tl-timemarker-active .tl-headline')
        await expect(marker).toHaveCSS('color', 'rgb(248, 250, 252)')
        for (const paragraph of await marker.locator('p').all()) await expect(paragraph).toHaveCSS('color', 'rgb(248, 250, 252)')
      }
      const toolbar = await child.locator('.tl-menubar').boundingBox()
      const story = await child.locator('.tl-storyslider').boundingBox()
      expect(toolbar).not.toBeNull()
      expect(story).not.toBeNull()
      expect(toolbar!.y).toBeGreaterThanOrEqual(story!.y + story!.height - 1)
      const dialog = page.getByRole('dialog', { name: 'Current timeline presentation' })
      expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
      await expect(page.getByText('Accessible event list (3)', { exact: true })).toBeInViewport()
      await expect(child.getByRole('button', { name: 'Next slide', exact: true })).toBeInViewport()
      const path = testInfo.outputPath(`renderer-${theme}.png`)
      await dialog.screenshot({ path, scale: 'css', animations: 'disabled' })
      await testInfo.attach(`Renderer ${theme}`, { path, contentType: 'image/png' })
    }
    expect(requests.slice(boundary).filter(url => new URL(url).origin !== 'https://timeline.example')).toEqual([])
    await page.getByRole('button', { name: 'Back to export details', exact: true }).click()
    await expect(iframe).toHaveCount(0)
    await page.keyboard.press('Escape')
    const after = await exported(page)
    expect(after.analystWorkspace).toEqual(before.analystWorkspace)
    expect(after.source).toEqual(before.source)
  })

  test('search and jump use stable event IDs without changing the presentation or backup', async ({ page }, testInfo) => {
    test.setTimeout(120_000)
    const value = fixture()
    value.analystWorkspace.events[1].title = value.analystWorkspace.events[0].title
    await start(page, value)
    const before = await exported(page)
    const child = await open(page)
    const details = page.getByRole('region', { name: 'TimelineJS presentation', exact: true }).locator('details')
    const summary = page.getByText('Accessible event list (3)', { exact: true })
    await summary.click()
    const search = page.getByLabel('Search presentation events', { exact: true })
    await search.fill('2025-06')
    await expect(details.locator('li')).toHaveCount(1)
    await expect(details.locator('li')).toHaveAttribute('data-event-id', 'event-1')
    const show = details.getByRole('button', { name: 'Show in presentation', exact: true })
    await show.focus()
    await page.keyboard.press('Enter')
    await expect(details).not.toHaveAttribute('open', '')
    await expect(child.locator('#slide-position')).toHaveText('Slide 3 of 4')
    await expect(child.locator('.tl-storyslider .tl-slide .tl-headline').filter({ hasText: /^Early <report>$/ }).last()).toBeInViewport()
    await expect(page.locator('iframe[title="TimelineJS narrative presentation"]')).toBeFocused()
    await expect(child.locator('.tl-timemarker')).toHaveCount(3)
    await summary.click()
    await expect(search).toHaveValue('2025-06')
    await page.getByLabel('Open at', { exact: true }).selectOption('latest')
    await expect(page.getByText('TimelineJS presentation loaded', { exact: true })).toBeAttached()
    await expect(search).toHaveValue('2025-06')
    await expect(child.locator('#slide-position')).toHaveText('Slide 4 of 4')
    await page.getByRole('button', { name: 'Retry presentation', exact: true }).click()
    await expect(page.getByText('TimelineJS presentation loaded', { exact: true })).toBeAttached()
    await expect(search).toHaveValue('2025-06')
    await expect(child.locator('#slide-position')).toHaveText('Slide 4 of 4')
    await search.fill('no matching event')
    await expect(details.locator('li')).toHaveCount(0)
    await expect(details).toContainText('No events match this search')
    await details.getByRole('button', { name: 'Clear search', exact: true }).click()
    await expect(details.locator('li')).toHaveCount(3)
    await search.fill('early <REPORT>')
    await expect(details.locator('li')).toHaveCount(2)
    for (const theme of ['light', 'dark']) {
      await page.evaluate(value => document.documentElement.classList.toggle('dark', value === 'dark'), theme)
      await expect(page.getByText('TimelineJS presentation loaded', { exact: true })).toBeAttached()
      await expect(search).toHaveValue('early <REPORT>')
      await expect(details).toHaveAttribute('open', '')
      await expect(details.locator('li')).toHaveCount(2)
      await expect(child.locator('#slide-position')).toHaveText('Slide 4 of 4')
      const dialog = page.getByRole('dialog', { name: 'Current timeline presentation' })
      const path = testInfo.outputPath(`finder-${theme}.png`)
      await details.scrollIntoViewIfNeeded()
      await dialog.screenshot({ path, scale: 'css', animations: 'disabled' })
      await testInfo.attach(`Finder ${theme}`, { path, contentType: 'image/png' })
    }
    await details.locator('li[data-event-id="event-0"]').getByRole('button', { name: 'Show in presentation' }).click()
    await expect(child.locator('#slide-position')).toHaveText('Slide 2 of 4')
    await page.getByRole('button', { name: 'Back to export details', exact: true }).click()
    await page.keyboard.press('Escape')
    const after = await exported(page)
    expect(after.analystWorkspace).toEqual(before.analystWorkspace)
    expect(after.source).toEqual(before.source)
  })

  test('blocked renderer can retry and stale workspace removes the frame', async ({ page }) => {
    test.setTimeout(90_000)
    await start(page)
    await page.route('**/timelinejs/preview.html*', route => route.abort())
    await page.getByRole('button', { name: 'Export TimelineJS', exact: true }).click()
    await page.getByRole('button', { name: 'Open presentation', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText('Presentation could not load', { timeout: 15000 })
    await page.getByText('Accessible event list (3)', { exact: true }).click()
    await page.getByLabel('Search presentation events', { exact: true }).fill('2025-06')
    await expect(page.getByRole('button', { name: 'Show in presentation', exact: true })).toBeDisabled()
    await expect(page.getByRole('region', { name: 'TimelineJS presentation', exact: true }).locator('details li')).toHaveCount(1)

    await page.unroute('**/timelinejs/preview.html*')
    await page.getByRole('button', { name: 'Retry presentation', exact: true }).click()
    await expect(page.getByText('TimelineJS presentation loaded', { exact: true })).toBeAttached()
    await page.getByRole('button', { name: 'Move Early <report> earlier in narrative', includeHidden: true }).evaluate(element => (element as HTMLButtonElement).click())
    await expect(page.locator('iframe[title="TimelineJS narrative presentation"]')).toHaveCount(0)
    await expect(page.getByRole('alert')).toContainText('workspace changed')
    await expect(page.getByRole('button', { name: 'Open presentation', exact: true })).toBeDisabled()
  })

  test('bounded and empty selections retain export without loading renderer assets', async ({ page }) => {
    await start(page, fixture(101))
    await page.getByRole('button', { name: 'Export TimelineJS', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Open presentation', exact: true })).toBeDisabled()
    await expect(page.getByText('Presentation supports up to 100 dated events.', { exact: false })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Download TimelineJS JSON', exact: true })).toBeEnabled()
    await expect(page.locator('iframe')).toHaveCount(0)
    await page.keyboard.press('Escape')
    const empty = fixture(); empty.analystWorkspace.events.forEach(event => { event.narrativeIncluded = event.id === 'event-3' })
    await openWorkflowDisclosure(page, 'Start or import a timeline'); await page.getByLabel('Import timeline JSON').setInputFiles({ name: 'empty.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(empty)) })
    await page.getByRole('button', { name: 'Export TimelineJS', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Open presentation', exact: true })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Download ResearchTools JSON', exact: true })).toBeEnabled()
  })
})
