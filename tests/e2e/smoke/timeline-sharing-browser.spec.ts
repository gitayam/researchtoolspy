import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import type { TimelineWorkspaceExport } from '../../../src/types/timeline-workspace'

const token = 'a'.repeat(64), createdAt = '2026-09-14T12:00:00.000Z'
const user = { id: 1, role: 'researcher', is_active: true, username: 'synthetic' }
const projection = { schemaVersion: 'timeline-presentation.v1', timeline: { scale: 'human', title: { unique_id: 'narrative-title', autolink: false, text: { headline: 'Shared library plan', text: '<p>A public framing.</p>' } }, events: [
  { unique_id: 'event-repairs', autolink: false, start_date: { year: 2026, month: 9, day: 10, hour: 9, minute: 0 }, end_date: { year: 2026, month: 9, day: 10, hour: 17, minute: 0 }, display_date: 'Recorded interval: 2026-09-10 09:00 through 2026-09-10 17:00 (inclusive recorded units)', text: { headline: 'Repair session', text: '<p>A library record.</p><p><strong>Assessment:</strong> Unreviewed</p>' } },
  { unique_id: 'event-followup', autolink: false, start_date: { year: 2026, month: 9, day: 10, hour: 17, minute: 15 }, display_date: 'Arrive: 2026-09-10 17:15 (presentation assumption; temporary)', text: { headline: 'Follow-up check', text: '<p>Schedule assumption, not a recorded time.</p>' } },
] } }
const workspace: TimelineWorkspaceExport = { schemaVersion: 'timeline-workspace.v2', exportedAt: createdAt, source: { schemaVersion: 'timeline-manual.v1', title: 'PRIVATE_SOURCE_MARKER' }, analystWorkspace: { mode: 'robust', presentation: 'analyst', sortDirection: 'oldest', questions: [], hypotheses: [], narrative: { title: 'Shared library plan', framing: 'A public framing.', question: 'PRIVATE_QUESTION_MARKER', intendedUse: '', scope: '', timezone: 'UTC', dataThrough: '', chapters: [] }, events: [{ id: 'repairs', title: 'Repair session', description: 'A library record.', eventDate: '2026-09-10', eventTime: '09:00', datePrecision: 'day', recordedEnd: { date: '2026-09-10', time: '17:00' }, category: 'event', importance: 'normal', origin: 'analyst', assessment: 'unreviewed', analystNote: 'PRIVATE_NOTE_MARKER', modified: false, placement: { mode: 'absolute' }, narrativeIncluded: true, narrativeOrder: 0, sequenceOrder: 0, whyItMatters: '', transition: '' }] } }
const csp = readFileSync('public/_headers', 'utf8').split('\n').find(line => line.trim().startsWith('Content-Security-Policy:'))!.trim().slice('Content-Security-Policy:'.length).trim()
async function setup(page: Page, signedIn = true) {
  if (signedIn) await page.addInitScript(user => {
    localStorage.setItem('auth-storage', JSON.stringify({ state: { user, isAuthenticated: true }, version: 0 }))
    localStorage.setItem('omnicore_user_hash', 'synthetic-sharing-human')
  }, user)
  await page.route('https://timeline.example/**', async route => {
    const url = new URL(route.request().url())
    const response = await route.fetch({ url: `http://127.0.0.1:5189${url.pathname}${url.search}`, maxRetries: route.request().method() === 'GET' && !url.pathname.startsWith('/api/') ? 1 : 0 })
    const headers = { ...response.headers() }
    if (url.pathname === '/timelinejs/preview.html') { headers['content-security-policy'] = csp; headers['x-frame-options'] = 'SAMEORIGIN'; headers['x-content-type-options'] = 'nosniff' }
    await route.fulfill({ response, headers })
  })
  await page.route('https://timeline.example/api/**', route => {
    const path = new URL(route.request().url()).pathname
    return route.fulfill({ json: path === '/api/auth/me' ? { user } : { owned: [], member: [] } })
  })
}
async function editor(page: Page) {
  await page.goto('https://timeline.example/dashboard/tools/timeline')
  await expect(page.locator('.timeline-setup')).toHaveAttribute('open', '')
  await page.getByLabel('Import timeline JSON').setInputFiles({ name: 'private.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(workspace)) })
  await page.getByRole('button', { name: 'Export TimelineJS', exact: true }).click()
}
async function originalExport(page: Page) {
  const pending = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export JSON', exact: true }).click()
  return JSON.parse(await readFile((await (await pending).path())!, 'utf8'))
}

test.describe('Direct presentation sharing @smoke', () => {
  test('publishes only explicitly with stable retry and manages revocation without changing the workspace', async ({ page }, info) => {
    test.setTimeout(120_000)
    await setup(page)
    const posts: Array<{ body: string; key: string }> = []; let lists = 0, revoked = false
    await page.route('https://timeline.example/api/timeline-presentations', async route => {
      if (route.request().method() === 'POST') {
        posts.push({ body: route.request().postData()!, key: route.request().headers()['idempotency-key'] })
        if (posts.length === 1) return route.abort('failed')
        return route.fulfill({ status: 200, json: { schemaVersion: 'timeline-presentation-link.v1', token, createdAt, revoked: false } })
      }
      lists++; return route.fulfill({ json: { schemaVersion: 'timeline-presentation-links.v1', links: revoked ? [] : [{ token, createdAt, title: 'Shared library plan' }] } })
    })
    await page.route(`https://timeline.example/api/timeline-presentations/${token}`, route => { revoked = true; return route.fulfill({ status: 204, body: '' }) })
    await editor(page)
    expect(posts).toHaveLength(0); expect(lists).toBe(0)
    await page.getByRole('button', { name: 'Share presentation', exact: true }).click()
    const review = page.getByRole('region', { name: 'Share presentation review' })
    await expect(review).toContainText('Anyone with the link')
    expect(posts).toHaveLength(0); expect(lists).toBe(0)
    await review.getByRole('button', { name: 'Publish presentation', exact: true }).click()
    await expect(review.getByRole('alert')).toBeVisible()
    await page.getByRole('button', { name: 'Open presentation', exact: true }).click()
    await expect(review.getByRole('button', { name: 'Retry publication', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Back to export details', exact: true }).click()
    await review.getByRole('button', { name: 'Retry publication', exact: true }).click()
    await expect(review.getByLabel('Presentation link', { exact: true })).toHaveValue(`https://timeline.example/present/${token}`)
    await review.screenshot({ path: info.outputPath('share-review-published.png'), animations: 'disabled', scale: 'css' })
    expect(posts).toHaveLength(2); expect(posts[1]).toEqual(posts[0]); expect(posts[0].key).toMatch(/^[a-f0-9-]{36}$/)
    const sent = JSON.parse(posts[0].body)
    expect(Object.keys(sent).sort()).toEqual(['schemaVersion', 'timeline'])
    expect(sent.schemaVersion).toBe('timeline-presentation.v1')
    expect(sent.timeline.events[0].end_date).toEqual({ year: 2026, month: 9, day: 10, hour: 17, minute: 0 })
    expect(posts[0].body).not.toMatch(/PRIVATE_|analystWorkspace|recordedEnd/)
    await review.getByRole('button', { name: 'Copy link', exact: true }).click()
    await expect(review.getByRole('status')).toContainText(/copied|Select the link/)
    await review.getByRole('button', { name: 'Manage links', exact: true }).click()
    await expect(review.getByRole('region', { name: 'Your active presentation links' })).toContainText('Shared library plan')
    expect(lists).toBe(1)
    await review.getByRole('region', { name: 'Your active presentation links' }).getByRole('button', { name: 'Revoke link', exact: true }).click()
    await expect(review).toContainText('Link revoked')
    await expect(review.getByLabel('Presentation link', { exact: true })).toHaveCount(0)
    expect(revoked).toBe(true)
    await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click()
    expect((await originalExport(page)).analystWorkspace).toEqual(workspace.analystWorkspace)
  })

  test('anonymous public interval renderer preserves plain-text access and clears after revocation or malformed refresh', async ({ page }, info) => {
    test.setTimeout(120_000)
    await setup(page, false)
    const apiRequests: Array<{ path: string; method: string }> = []
    page.on('request', request => {
      const path = new URL(request.url()).pathname
      if (path.startsWith('/api/')) apiRequests.push({ path, method: request.method() })
    })
    let unavailable = false, malformed = false; const reads: Array<Record<string, string>> = []
    await page.route(`https://timeline.example/api/timeline-presentations/${token}`, route => {
      reads.push(route.request().headers())
      return unavailable ? route.fulfill({ status: 404, json: { schemaVersion: 'timeline-presentation-error.v1', error: { code: 'unavailable' } } }) : route.fulfill({ json: malformed ? { ...projection, private: true } : projection })
    })
    await page.goto(`https://timeline.example/present/${token}`)
    await expect(page.getByRole('heading', { name: 'Shared library plan', exact: true })).toBeVisible()
    await expect(page.getByText('TimelineJS presentation loaded', { exact: true })).toBeAttached()
    const child = page.frameLocator('iframe[title="TimelineJS narrative presentation"]')
    for (const theme of ['light', 'dark']) {
      await page.evaluate(dark => document.documentElement.classList.toggle('dark', dark), theme === 'dark')
      await expect(child.locator('html')).toHaveAttribute('data-theme', theme)
      await expect(page.getByText('TimelineJS presentation loaded', { exact: true })).toBeAttached()
      await child.getByRole('button', { name: 'Next slide', exact: true }).click()
      await expect(child.locator('#slide-position')).toHaveText('Slide 2 of 3')
      await expect(child.locator('.tl-storyslider .tl-headline-date')).toContainText(['Recorded interval: 2026-09-10 09:00 through 2026-09-10 17:00 (inclusive recorded units)'])
      await page.screenshot({ path: info.outputPath(`shared-presentation-${theme}.png`), scale: 'css', animations: 'disabled' })
    }
    await page.getByText('Accessible event list (2)', { exact: true }).click()
    await page.getByLabel('Search presentation events', { exact: true }).fill('assumption')
    const list = page.getByRole('region', { name: 'TimelineJS presentation', exact: true }).locator('details')
    await expect(list.locator('li')).toHaveCount(1)
    await expect(list).toContainText('Arrive: 2026-09-10 17:15')
    await list.getByRole('button', { name: 'Show in presentation', exact: true }).click()
    await expect(child.locator('#slide-position')).toHaveText('Slide 3 of 3')
    expect(reads.every(headers => !headers.authorization && !headers['x-user-hash'])).toBe(true)
    await expect(page.getByRole('button', { name: 'Export JSON', exact: true })).toHaveCount(0)
    malformed = true
    await page.getByRole('button', { name: 'Refresh', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText('unavailable')
    await expect(page.locator('iframe')).toHaveCount(0)
    malformed = false; unavailable = true
    await page.getByRole('button', { name: 'Retry', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText('unavailable')
    expect(apiRequests.length).toBeGreaterThanOrEqual(3)
    expect(apiRequests).toEqual(apiRequests.map(() => ({ path: `/api/timeline-presentations/${token}`, method: 'GET' })))
  })

  test('sign-out discards an in-flight publication and stale previews cannot publish', async ({ page }) => {
    test.setTimeout(90_000)
    await setup(page)
    let release!: () => void; const held = new Promise<void>(resolve => { release = resolve }); let started = false
    await page.route('https://timeline.example/api/timeline-presentations', async route => { started = true; await held; await route.fulfill({ status: 201, json: { schemaVersion: 'timeline-presentation-link.v1', token, createdAt, revoked: false } }) })
    await editor(page)
    await page.getByRole('button', { name: 'Share presentation', exact: true }).click()
    await page.getByRole('button', { name: 'Publish presentation', exact: true }).click()
    await expect.poll(() => started).toBe(true)
    await page.evaluate(async () => { const { useAuthStore } = await import('/src/stores/auth.ts'); useAuthStore.setState({ isAuthenticated: false, user: null }) })
    release()
    await page.getByRole('button', { name: 'Share presentation', exact: true }).click()
    await expect(page.getByRole('region', { name: 'Share presentation review' })).toContainText('Sign in')
    await expect(page.getByLabel('Presentation link', { exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Publish presentation', exact: true })).toBeDisabled()
    await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click()
    await page.evaluate(async user => { const { useAuthStore } = await import('/src/stores/auth.ts'); useAuthStore.setState({ isAuthenticated: true, user: user as never }) }, user)
    await page.getByRole('button', { name: 'Export TimelineJS', exact: true }).click()
    await page.getByRole('button', { name: 'Share presentation', exact: true }).click()
    // Trigger the existing parent stale-preview boundary with a real narrative edit.
    await page.getByLabel('Narrative title', { exact: true }).evaluate(node => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
      setter.call(node, 'Changed after preview')
      node.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await page.getByRole('button', { name: 'Share presentation', exact: true }).click()
    await expect(page.getByRole('region', { name: 'Share presentation review' }).getByRole('alert')).toContainText('stale')
    await expect(page.getByRole('button', { name: 'Publish presentation', exact: true })).toBeDisabled()
  })
})
