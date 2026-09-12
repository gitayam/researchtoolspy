import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import type { TimelineWorkspaceExport } from '../../../src/types/timeline-workspace'

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
    const response = await route.fetch({ url: `http://127.0.0.1:5189${url.pathname}${url.search}` })
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
  await page.getByLabel('Import timeline JSON').setInputFiles({ name: 'timeline.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(value)) })
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
      const dialog = page.getByRole('dialog', { name: 'TimelineJS export preview' })
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
      const dialog = page.getByRole('dialog', { name: 'TimelineJS export preview' })
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
    await page.getByLabel('Import timeline JSON').setInputFiles({ name: 'empty.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(empty)) })
    await page.getByRole('button', { name: 'Export TimelineJS', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Open presentation', exact: true })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Download ResearchTools JSON', exact: true })).toBeEnabled()
  })
})
