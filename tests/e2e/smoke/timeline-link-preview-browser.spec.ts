import { test, expect, type Page } from '@playwright/test'
import type { TimelineWorkspaceExport } from '../../../src/types/timeline-workspace'

const title = 'Library & community <planning> — ' + 'recorded moments and shared context '.repeat(6)
const user = { id: 1, role: 'researcher', is_active: true, username: 'synthetic-preview' }
const token = 'b'.repeat(64)
const workspace: TimelineWorkspaceExport = { schemaVersion: 'timeline-workspace.v1', exportedAt: '2026-09-14T12:00:00.000Z', source: { schemaVersion: 'timeline-manual.v1', title: 'PRIVATE_SOURCE' }, analystWorkspace: { mode: 'robust', presentation: 'analyst', sortDirection: 'oldest', questions: [], hypotheses: [], narrative: { title, framing: 'A plain-language public introduction.', question: 'PRIVATE_QUESTION', intendedUse: '', scope: '', timezone: 'UTC', dataThrough: '', chapters: [] }, events: [{ id: 'opening', title: 'Library opening', description: 'Public narrative.', eventDate: '2026-09-14', datePrecision: 'day', category: 'event', importance: 'normal', origin: 'analyst', assessment: 'unreviewed', analystNote: 'PRIVATE_NOTE', modified: false, placement: { mode: 'absolute' }, sequenceOrder: 0, narrativeIncluded: true, narrativeOrder: 0, whyItMatters: '', transition: '' }] } }
async function setup(page: Page) {
  await page.addInitScript(user => {
    localStorage.setItem('auth-storage', JSON.stringify({ state: { user, isAuthenticated: true }, version: 0 }))
    localStorage.setItem('omnicore_user_hash', 'synthetic-preview-human')
    localStorage.setItem('omnicore_tokens', JSON.stringify({ access_token: 'synthetic-preview-human', token_type: 'bearer' }))
  }, user)
  await page.route('http://127.0.0.1:5189/api/**', route => route.fulfill({ json: new URL(route.request().url()).pathname === '/api/auth/me' ? user : { owned: [], member: [] } }))
}

test('rasterizes the dedicated timeline share artwork @smoke', async ({ page }, info) => {
  test.skip(info.project.name !== 'chromium', 'One Chromium raster is the canonical static PNG.')
  const external: string[] = []
  await page.route('**/*', route => {
    if (new URL(route.request().url()).origin !== 'http://127.0.0.1:5189') { external.push(route.request().url()); return route.abort() }
    return route.continue()
  })
  await page.setViewportSize({ width: 1200, height: 630 })
  await page.goto('/timeline-share-card.svg')
  await expect(page.locator('svg')).toHaveAttribute('viewBox', '0 0 1200 630')
  await expect(page.locator('svg')).toHaveCSS('width', '1200px')
  await expect(page.locator('svg')).toHaveCSS('height', '630px')
  expect(await page.locator('svg').boundingBox()).toEqual({ x: 0, y: 0, width: 1200, height: 630 })
  await page.screenshot({ path: info.outputPath('timeline-share-card.png'), animations: 'disabled', scale: 'css' })
  expect(external).toEqual([])
})

test('reviews bounded plain-text link cards before explicit publication and copy @smoke', async ({ page }, info) => {
  test.setTimeout(120_000)
  await setup(page)
  const publications: string[] = []
  await page.route('http://127.0.0.1:5189/api/timeline-presentations', route => {
    expect(route.request().method()).toBe('POST')
    publications.push(route.request().postData()!)
    return route.fulfill({ json: { schemaVersion: 'timeline-presentation-link.v1', token, createdAt: '2026-09-14T12:00:00.000Z', revoked: false } })
  })
  await page.goto('/dashboard/tools/timeline')
  await expect(page.locator('.timeline-setup')).toHaveAttribute('open', '')
  await page.getByLabel('Import timeline JSON').setInputFiles({ name: 'preview.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(workspace)) })
  await expect(page.locator('.timeline-setup')).not.toHaveAttribute('open', '')
  await page.getByRole('button', { name: 'Export TimelineJS', exact: true }).click()
  await page.getByRole('button', { name: 'Share presentation', exact: true }).click()
  const review = page.getByRole('region', { name: 'Share presentation review' })
  const card = review.getByRole('figure', { name: 'Link card preview' })
  const headline = card.getByTestId('link-preview-title'), description = card.getByTestId('link-preview-description')
  await expect(headline).toContainText('Library & community <planning>')
  expect(Array.from((await headline.textContent())!).length).toBeLessThanOrEqual(150)
  expect(Array.from((await description.textContent())!).length).toBeLessThanOrEqual(240)
  await expect(description).toHaveText(/^1 event/)
  await expect(card).not.toContainText(/PRIVATE_|Unreviewed|2026-09-14/)
  await expect(card.locator('planning, script')).toHaveCount(0)
  await expect(card.getByRole('img')).toHaveAttribute('src', '/timeline-share-card.png')
  await expect.poll(() => card.getByRole('img').evaluate(image => (image as HTMLImageElement).naturalWidth)).toBe(1200)
  expect(publications).toEqual([])
  await expect(review.getByText(/Chat apps may retain cached/)).toBeAttached()
  for (const theme of ['light', 'dark']) {
    await page.evaluate(dark => document.documentElement.classList.toggle('dark', dark), theme === 'dark')
    await card.evaluate(node => node.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' }))
    await expect(card).toBeInViewport({ ratio: 1 })
    await expect(headline).toBeInViewport({ ratio: 1 })
    await expect(description).toBeInViewport({ ratio: 1 })
    await expect.poll(() => card.evaluate(async node => {
      const before = node.getBoundingClientRect()
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
      const after = node.getBoundingClientRect()
      return Math.abs(before.top - after.top) < 0.5 && Math.abs(before.left - after.left) < 0.5
    })).toBe(true)
    expect(await review.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true)
    await card.screenshot({ path: info.outputPath(`share-link-preview-${theme}.png`), animations: 'disabled', scale: 'css' })
  }
  await expect(review.getByRole('button', { name: 'Publish presentation', exact: true })).toBeEnabled()
  expect(publications).toEqual([])
  await review.getByRole('button', { name: 'Publish presentation', exact: true }).click()
  await expect(review.getByLabel('Presentation link', { exact: true })).toHaveValue(`http://127.0.0.1:5189/present/${token}`)
  expect(publications).toHaveLength(1)
  expect(publications[0]).not.toMatch(/PRIVATE_/)
  await review.getByRole('button', { name: 'Copy link', exact: true }).click()
  await expect(review.getByRole('status')).toContainText(/copied|Select the link/)
})
