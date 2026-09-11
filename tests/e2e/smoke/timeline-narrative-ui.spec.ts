import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { decodeTimelineWorkspace, TIMELINE_IMPORT_MAX_BYTES } from '../../../src/lib/timeline-workspace-codec'
import type { TimelineWorkspaceExport, TimelineWorkspaceEvent } from '../../../src/types/timeline-workspace'

const source = {
  schemaVersion: 'timeline-analysis.v1' as const,
  requestId: 'narrative-fixture', outcome: 'events' as const,
  article: { url: 'https://publisher.example/report', title: 'Frozen source', domain: 'publisher.example' },
  events: [
    { eventDate: '2026-09-01', datePrecision: 'day' as const, title: 'First event', description: 'Original first claim.', category: 'event' as const, importance: 'critical' as const },
    { eventDate: '2026-09-03', datePrecision: 'day' as const, title: 'Later event', description: null, category: 'event' as const, importance: 'normal' as const },
  ],
  extraction: { contentSource: 'publisher-feed', sourceMode: 'supplied' as const, wordCount: 1000, quality: { version: 'fixture.v1', score: 100, accepted: true }, fallbackAttempts: ['publisher-feed'] },
  model: { name: 'synthetic-fixture', status: 'ok' as const, rejectedEventCount: 0 },
}
function fixture(): TimelineWorkspaceExport {
  return {
    schemaVersion: 'timeline-workspace.v1', exportedAt: '2026-09-11T12:00:00.000Z', source,
    analystWorkspace: {
      mode: 'robust', sortDirection: 'oldest', presentation: 'analyst',
      events: [
        ...source.events.map((event, index): TimelineWorkspaceEvent => ({ ...event, id: `source-narrative-fixture-${index}`, original: { ...event }, origin: 'source', assessment: index === 1 ? 'disputed' : 'unreviewed', analystNote: '', modified: false, sequenceOrder: index, placement: { mode: 'absolute' }, narrativeIncluded: true, narrativeOrder: index, narrativeRole: index === 0 ? 'context' : 'turning_point', whyItMatters: 'Explains the transition.', transition: '', chapterId: 'chapter-one' })),
        { id: 'unknown-event', title: 'Unknown date event', description: null, category: 'event', importance: 'normal', origin: 'analyst', assessment: 'hypothesis', analystNote: 'Date not established.', modified: false, sequenceOrder: 2, placement: { mode: 'relative', relation: 'after', anchorEventId: 'source-narrative-fixture-1' }, narrativeIncluded: false, narrativeOrder: 2, whyItMatters: '', transition: '' },
      ],
      questions: [{ id: 'question-one', afterEventId: 'source-narrative-fixture-0', question: 'What happened between reports?', status: 'open', answer: '', sources: [{ id: 'ref-one', url: 'https://evidence.example/document', title: 'Reference' }] }],
      hypotheses: [],
      narrative: { title: 'An evolving account', framing: 'A synthetic investigation fixture.', question: 'What changed?', intendedUse: 'Review', scope: 'September', timezone: 'UTC', dataThrough: '2026-09-11', chapters: [{ id: 'chapter-one', title: 'The change', claim: 'Reporting shifted.' }] },
    },
  }
}
async function importFile(page: Page, value: unknown) {
  await page.getByLabel('Import timeline JSON').setInputFiles({ name: 'timeline.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(value)) })
}
async function exported(page: Page): Promise<TimelineWorkspaceExport> {
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export JSON', exact: true }).click()
  return JSON.parse(await readFile((await (await download).path())!, 'utf8'))
}

test.describe('Timeline narrative and import @smoke', () => {
  test('legacy defaults preserve unknown dates, original extraction and sequence', () => {
    const original = fixture()
    delete original.analystWorkspace.narrative
    delete original.analystWorkspace.presentation
    delete original.analystWorkspace.sortDirection
    original.analystWorkspace.events = original.analystWorkspace.events.map(({ chapterId: _chapter, narrativeIncluded: _included, narrativeOrder: _order, narrativeRole: _role, whyItMatters: _why, transition: _transition, ...event }) => event)
    const result = decodeTimelineWorkspace(JSON.stringify(original))
    expect(result.source).toEqual(source)
    expect(result.analystWorkspace.events.map(event => [event.id, event.eventDate, event.sequenceOrder])).toEqual(original.analystWorkspace.events.map(event => [event.id, event.eventDate, event.sequenceOrder]))
    expect(result.analystWorkspace.events[2].eventDate).toBeUndefined()
    expect(result.analystWorkspace.narrative?.title).toBe('Frozen source')
    expect(result.analystWorkspace.sortDirection).toBe('oldest')
    expect(result.analystWorkspace.events[0].narrativeRole).toBeUndefined()
  })

  test('import rejects invalid identity, references, dates, URLs and unsupported fields', () => {
    const invalid = [
      (value: TimelineWorkspaceExport) => { value.analystWorkspace.events[1].id = value.analystWorkspace.events[0].id },
      (value: TimelineWorkspaceExport) => { value.analystWorkspace.events[0].chapterId = 'absent' },
      (value: TimelineWorkspaceExport) => { value.analystWorkspace.questions[0].afterEventId = 'absent' },
      (value: TimelineWorkspaceExport) => { value.analystWorkspace.events[0].eventDate = '2026-02-30' },
      (value: TimelineWorkspaceExport) => { value.analystWorkspace.events[2].eventTime = '12:30:60' },
      (value: TimelineWorkspaceExport) => { value.analystWorkspace.events[2].eventTime = '24:00:00' },
      (value: TimelineWorkspaceExport) => { value.analystWorkspace.questions[0].sources![0].url = 'javascript:alert(1)' },
      (value: TimelineWorkspaceExport) => { Object.assign(value.analystWorkspace, { secretExtraField: true }) },
      (value: TimelineWorkspaceExport) => { Object.assign(value.analystWorkspace.events[0], { narrativeRole: 'watershed' }) },
      (value: TimelineWorkspaceExport) => { value.analystWorkspace.events[2].placement = { mode: 'relative', relation: 'after', anchorEventId: 'absent' } },
    ]
    for (const mutate of invalid) {
      const value = structuredClone(fixture())
      mutate(value)
      expect(() => decodeTimelineWorkspace(JSON.stringify(value))).toThrow(/Invalid timeline JSON/)
    }
    expect(() => decodeTimelineWorkspace('x'.repeat(TIMELINE_IMPORT_MAX_BYTES + 1))).toThrow(/4 MiB/)
    expect(() => decodeTimelineWorkspace('{')).toThrow(/not valid JSON/)
  })

  test('legacy seconds-bearing draft survives reload and export/import without changing unknown dates', async ({ page }) => {
    const legacy = fixture()
    legacy.source = { schemaVersion: 'timeline-manual.v1', title: 'Seconds precision legacy draft' }
    legacy.analystWorkspace.events = [{
      id: 'seconds-event', title: 'Time recorded without a date', eventTime: '14:30:59',
      description: null, category: 'event', importance: 'normal', origin: 'analyst',
      assessment: 'unreviewed', analystNote: '', modified: false, sequenceOrder: 0,
      placement: { mode: 'position', position: 1 },
    }]
    legacy.analystWorkspace.questions = []
    delete legacy.analystWorkspace.narrative
    delete legacy.analystWorkspace.presentation
    delete legacy.analystWorkspace.sortDirection
    expect(decodeTimelineWorkspace(JSON.stringify(legacy)).analystWorkspace.events[0].eventTime).toBe('14:30:59')
    await page.route('**/api/workspaces', route => route.fulfill({ status: 200, json: { owned: [], member: [] } }))
    await page.goto('/dashboard/tools/timeline')
    await page.evaluate(workspace => {
      localStorage.setItem('researchtools.timeline.manual-draft.v1', JSON.stringify({
        schemaVersion: 'timeline-browser-draft.v1', expiresAt: new Date(Date.now() + 86400000).toISOString(),
        result: { schemaVersion: 'timeline-analysis.v1', requestId: 'manual-legacy-seconds', outcome: 'no_events',
          article: { title: 'Seconds precision legacy draft', url: '', domain: '' }, events: [],
          extraction: { contentSource: 'analyst-input', sourceMode: 'supplied', method: 'manual', wordCount: 0,
            quality: { version: 'manual-entry.v1', score: 100, accepted: true }, fallbackAttempts: ['analyst-input'] },
          model: { name: 'manual-entry', status: 'no_events', rejectedEventCount: 0 } },
        workspace,
      }))
    }, legacy.analystWorkspace)
    await page.reload()
    await page.getByRole('button', { name: 'Resume saved timeline' }).click()
    await expect(page.locator('#timeline-event-seconds-event')).toContainText('14:30:59 (date unknown)')
    const before = await exported(page)
    expect(before.analystWorkspace.events[0].eventTime).toBe('14:30:59')
    expect(before.analystWorkspace.events[0].eventDate).toBeUndefined()
    await importFile(page, before)
    const after = await exported(page)
    expect(after.analystWorkspace).toEqual(before.analystWorkspace)
    expect(after.source).toEqual(before.source)
    await page.reload()
    await page.getByRole('button', { name: 'Resume saved timeline' }).click()
    await expect(page.locator('#timeline-event-seconds-event')).toContainText('14:30:59 (date unknown)')
  })

  test('reader links, narrative order and JSON restore preserve the ledger and source', async ({ page }, testInfo) => {
    let extractionRequests = 0
    await page.route('**/api/workspaces', route => route.fulfill({ status: 200, json: { owned: [], member: [] } }))
    await page.route('**/api/tools/extract-timeline', route => { extractionRequests += 1; return route.abort() })
    await page.goto('/dashboard/tools/timeline')
    await importFile(page, fixture())
    await expect(page.getByLabel('Narrative title')).toHaveValue('An evolving account')
    await page.getByLabel('Narrative title').fill('Reviewed account')
    await page.getByLabel('Sort events').selectOption('latest')
    const first = page.getByTestId('narrative-edit-source-narrative-fixture-0')
    await first.locator('summary').click()
    await first.getByLabel('Why it matters').fill('The first report establishes the initial conditions.')
    await page.getByRole('button', { name: 'Move Later event earlier in narrative' }).click()
    await expect(page.getByText('Narrative order departs from chronological order. Analyst placement is unchanged.')).toBeVisible()
    await expect(page.getByText('Add context or buildup before the turning point.')).toBeVisible()
    await page.getByRole('button', { name: 'Narrative view', exact: true }).click()
    const reader = page.getByRole('article', { name: 'Narrative presentation' })
    await expect(reader.getByRole('heading', { level: 2 })).toHaveText('Reviewed account')
    await expect(reader.locator('ol > li > h3')).toHaveText(['Later event', 'First event'])
    const screenshot = testInfo.outputPath('narrative-reader.png')
    await page.screenshot({ path: screenshot, fullPage: true, animations: 'disabled' })
    await testInfo.attach('Narrative reader', { path: screenshot, contentType: 'image/png' })
    await expect(page.getByRole('navigation', { name: 'Narrative outline' }).getByRole('link', { name: 'The change' })).toHaveAttribute('href', '#timeline-chapter-chapter-one')
    const evidenceLink = reader.getByRole('link', { name: 'Inspect evidence for First event' })
    await evidenceLink.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('button', { name: 'Analyst view', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator('#timeline-event-source-narrative-fixture-0')).toBeFocused()
    await page.locator('#timeline-event-source-narrative-fixture-0').getByText('Original extraction and source').click()
    await expect(page.locator('#timeline-event-source-narrative-fixture-0').getByRole('link', { name: 'Open extraction source' })).toHaveAttribute('href', source.article.url)
    const before = await exported(page)
    expect(before.source).toEqual(source)
    expect(before.analystWorkspace.events.map(event => [event.id, event.eventDate, event.sequenceOrder])).toEqual(fixture().analystWorkspace.events.map(event => [event.id, event.eventDate, event.sequenceOrder]))
    expect(before.analystWorkspace.sortDirection).toBe('latest')
    await importFile(page, before)
    const after = await exported(page)
    expect(after.analystWorkspace).toEqual(before.analystWorkspace)
    expect(after.source).toEqual(before.source)
    await page.reload()
    await page.getByRole('button', { name: 'Resume saved timeline' }).click()
    await expect(page.getByLabel('Sort events')).toHaveValue('latest')
    await expect(page.getByLabel('Narrative title')).toHaveValue('Reviewed account')
    expect(extractionRequests).toBe(0)
  })

  test('initial selection is bounded, additional selections warn and malformed import preserves the open draft', async ({ page }) => {
    await page.route('**/api/workspaces', route => route.fulfill({ status: 200, json: { owned: [], member: [] } }))
    const value = fixture()
    value.source = { schemaVersion: 'timeline-manual.v1', title: 'Manual legacy corpus' }
    delete value.analystWorkspace.narrative
    value.analystWorkspace.questions = []
    value.analystWorkspace.events = Array.from({ length: 23 }, (_, index) => ({ id: `manual-${index}`, title: `Manual event ${index}`, description: null, category: 'event', importance: 'normal', origin: 'analyst', assessment: 'unreviewed', analystNote: '', modified: false, sequenceOrder: index }))
    await page.goto('/dashboard/tools/timeline')
    await importFile(page, value)
    expect((await exported(page)).analystWorkspace.events.filter(event => event.narrativeIncluded)).toHaveLength(20)
    const editor = page.getByTestId('narrative-edit-manual-20')
    await editor.locator('summary').click()
    await editor.getByLabel('Include Manual event 20 in narrative').check()
    await expect(page.getByText(/More than 20 events selected/)).toBeVisible()
    const invalid = structuredClone(value)
    invalid.analystWorkspace.events[0].id = 'bad id'
    await importFile(page, invalid)
    await expect(page.getByText(/Invalid timeline JSON/)).toBeVisible()
    expect((await exported(page)).analystWorkspace.events.filter(event => event.narrativeIncluded)).toHaveLength(21)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.getByRole('button', { name: 'Narrative view', exact: true }).click()
    await expect(page.getByRole('article', { name: 'Narrative presentation' }).locator('ol > li')).toHaveCount(21)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  })

  test('inserting and deleting ledger events preserves links; removing a chapter clears membership', async ({ page }) => {
    await page.route('**/api/workspaces', route => route.fulfill({ status: 200, json: { owned: [], member: [] } }))
    await page.goto('/dashboard/tools/timeline')
    await importFile(page, fixture())
    const link = page.getByLabel('Timeline events').getByRole('link', { name: /Later event/ })
    const href = await link.getAttribute('href')
    await page.getByRole('button', { name: 'Add event', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('Date', { exact: true }).fill('2026-08-01')
    await dialog.getByLabel('Title', { exact: true }).fill('Inserted earlier')
    await dialog.getByRole('button', { name: 'Save event' }).click()
    await expect(link).toHaveAttribute('href', href!)
    await page.getByRole('button', { name: 'Actions for Inserted earlier' }).click()
    await page.getByRole('menuitem', { name: 'Remove from timeline' }).click()
    await expect(link).toHaveAttribute('href', href!)
    await page.getByRole('button', { name: 'Remove chapter The change' }).click()
    const snapshot = await exported(page)
    expect(snapshot.analystWorkspace.narrative?.chapters).toEqual([])
    expect(snapshot.analystWorkspace.events.every(event => !event.chapterId)).toBe(true)
    expect(snapshot.source).toEqual(source)
  })

  test('editor-created seconds round trip and credential-bearing source URLs are rejected', async ({ page }) => {
    await page.route('**/api/workspaces', route => route.fulfill({ status: 200, json: { owned: [], member: [] } }))
    await page.goto('/dashboard/tools/timeline')
    await page.getByLabel('Investigation or timeline title').fill('Editor seconds case')
    await page.getByRole('button', { name: 'Create timeline', exact: true }).click()
    await page.getByRole('button', { name: 'Add first event' }).click()
    let dialog = page.getByRole('dialog')
    await dialog.getByLabel('Time', { exact: true }).fill('14:30:59')
    await dialog.getByLabel('Title', { exact: true }).fill('Observed time without a date')
    await dialog.getByRole('button', { name: 'Save event' }).click()
    const before = await exported(page)
    expect(before.analystWorkspace.events[0].eventTime).toBe('14:30:59')
    expect(before.analystWorkspace.events[0].eventDate).toBeUndefined()
    await importFile(page, before)
    expect((await exported(page)).analystWorkspace).toEqual(before.analystWorkspace)
    await page.reload()
    await page.getByRole('button', { name: 'Resume saved timeline' }).click()
    await expect(page.locator('#timeline-sequence')).toContainText('14:30:59 (date unknown)')
    await page.getByRole('button', { name: 'Add question', exact: true }).click()
    dialog = page.getByRole('dialog')
    await dialog.getByRole('textbox', { name: 'Question', exact: true }).fill('Which source confirms the time?')
    await dialog.getByLabel('Source URL (optional)').fill('https://user:password@publisher.example/report')
    await dialog.getByRole('button', { name: 'Save question' }).click()
    await expect(dialog.getByRole('alert')).toContainText('without a username or password')
    await dialog.getByLabel('Source URL (optional)').fill('https://publisher.example/report')
    await dialog.getByRole('button', { name: 'Save question' }).click()
    const complete = await exported(page)
    expect(decodeTimelineWorkspace(JSON.stringify(complete)).analystWorkspace).toEqual(complete.analystWorkspace)
  })

  test('unreadable nonexpired draft is preserved byte-for-byte for recovery after replacement and reload', async ({ page }) => {
    await page.route('**/api/workspaces', route => route.fulfill({ status: 200, json: { owned: [], member: [] } }))
    await page.goto('/dashboard/tools/timeline')
    const raw = JSON.stringify({ schemaVersion: 'timeline-browser-draft.v1', expiresAt: '2099-01-01T00:00:00.000Z', result: { schemaVersion: 'timeline-analysis.v1', article: { title: 'Future draft' } }, workspace: { mode: 'robust', events: [{ id: 'future-event', futureField: 'preserve me' }], questions: [], hypotheses: [] } }, null, 2)
    await page.evaluate(value => localStorage.setItem('researchtools.timeline.manual-draft.v1', value), raw)
    await page.reload()
    await expect(page.getByText(/A saved timeline could not be read by this version/)).toBeVisible()
    expect(await page.evaluate(() => localStorage.getItem('researchtools.timeline.manual-draft.v1'))).toBe(raw)
    const recoveryDownload = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Download recovery JSON', exact: true }).click()
    expect(await readFile((await (await recoveryDownload).path())!, 'utf8')).toBe(raw)
    await page.getByLabel('Investigation or timeline title').fill('Replacement draft')
    await page.getByRole('button', { name: 'Create timeline', exact: true }).click()
    await page.reload()
    const secondDownload = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Download recovery JSON', exact: true }).click()
    expect(await readFile((await (await secondDownload).path())!, 'utf8')).toBe(raw)
    await page.getByRole('button', { name: 'Resume saved timeline' }).click()
    await expect(page.getByLabel('Narrative title')).toHaveValue('Replacement draft')
  })
})
