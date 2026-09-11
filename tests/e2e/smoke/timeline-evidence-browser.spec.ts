import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'

function fixture(assessment = 'unreviewed', omitPlacement = false) {
  return { schemaVersion: 'timeline-workspace.v1', exportedAt: '2026-09-11T00:00:00.000Z', source: { schemaVersion: 'timeline-manual.v1', title: 'Evidence investigation' }, analystWorkspace: {
    mode: 'robust', presentation: 'analyst', sortDirection: 'oldest', questions: [], hypotheses: [],
    events: [{ id: 'event-evidence', eventDate: '2026-09-01', datePrecision: 'day', title: 'Bridge opened', description: 'Opening reported.', category: 'event', importance: 'normal', origin: 'analyst', assessment, analystNote: '', modified: false, sequenceOrder: 0, ...(omitPlacement ? {} : { placement: { mode: 'absolute' } }), narrativeIncluded: true, narrativeOrder: 0, narrativeRole: 'context', whyItMatters: 'Establishes access.', transition: '' }],
    narrative: { title: 'Access changed', framing: 'Recorded claims.', question: '', intendedUse: '', scope: '', timezone: 'UTC', dataThrough: '', chapters: [] },
  } }
}
async function upload(page: Page, value: unknown) {
  await page.getByLabel('Import timeline JSON').setInputFiles({ name: 'evidence.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(value)) })
}
async function exported(page: Page) {
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export JSON', exact: true }).click()
  return JSON.parse(await readFile((await (await download).path())!, 'utf8'))
}
async function start(page: Page, value = fixture()) {
  await page.route('**/api/workspaces', route => route.fulfill({ status: 200, json: { owned: [], member: [] } }))
  await page.goto('/dashboard/tools/timeline')
  await upload(page, value)
}
async function addEvidence(page: Page) {
  const panel = page.getByTestId('evidence-event-evidence')
  await panel.locator('summary').first().click()
  await panel.getByText('Add or edit source', { exact: true }).click()
  await panel.getByText('Add or edit assertion', { exact: true }).click()
  for (const [name,url,claim] of [['City record','https://city.example/record','City records opening'],['Observer report','https://observer.example/report','Observer saw opening']]) {
    await panel.getByLabel('Source URL', { exact: true }).fill(url)
    await panel.getByLabel('Source title', { exact: true }).fill(name)
    await panel.getByLabel('Publisher', { exact: true }).fill(name)
    await panel.getByRole('button', { name: 'Add source', exact: true }).click()
    await panel.getByLabel('Source claim', { exact: true }).fill(claim)
    await panel.getByLabel('Temporal wording', { exact: true }).fill('Opened on 1 September')
    await panel.getByLabel('Quoted passage', { exact: true }).fill(`Original quotation: ${claim}`)
    await panel.getByLabel('Passage locator', { exact: true }).fill('Paragraph 2')
    await panel.getByRole('button', { name: 'Add assertion', exact: true }).click()
  }
  return panel
}

test.describe('timeline inspectable evidence @smoke', () => {
  test('add independent assertions, review, export/import, stale review and known common origin', async ({ page }, testInfo) => {
    // Complete two-source authoring, multiple downloads and visual inspection on mobile.
    test.setTimeout(120_000)
    await start(page, fixture('unreviewed', true))
    const panel = await addEvidence(page)
    await panel.getByLabel('Independence', { exact: true }).selectOption('independent')
    await panel.getByLabel('Compatibility', { exact: true }).selectOption('compatible')
    await panel.getByLabel('Review rationale', { exact: true }).fill('Separate direct observations with compatible timing; no known shared origin.')
    await panel.getByRole('button', { name: 'Record review' }).click()
    await page.getByRole('button', { name: 'Actions for Bridge opened' }).click()
    await page.getByRole('menuitem', { name: 'Edit event', exact: true }).click()
    await page.getByLabel('Assessment', { exact: true }).selectOption('corroborated')
    await page.getByRole('dialog').getByLabel('Title', { exact: true }).fill('Changed event claim')
    await page.getByRole('button', { name: 'Save event', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText('Corroboration needs a current')
    await page.getByRole('dialog').getByLabel('Title', { exact: true }).fill('Bridge opened')
    await page.getByRole('button', { name: 'Save event', exact: true }).click()
    const saved = await exported(page)
    expect(saved.analystWorkspace.evidence.sources).toHaveLength(2)
    expect(saved.analystWorkspace.evidence.assertions[0].passage.quote).toBe('Original quotation: City records opening')
    expect(saved.analystWorkspace.evidence.reviews[0].basis).toContain('Bridge opened')
    expect(saved.analystWorkspace.events[0].assessment).toBe('corroborated')
    expect(saved.analystWorkspace.events[0].placement).toBeUndefined()
    await expect(page.getByText('Corroboration needs review', { exact: true })).toHaveCount(0)
    await upload(page, saved)
    expect((await exported(page)).analystWorkspace.evidence).toEqual(saved.analystWorkspace.evidence)
    await page.getByTestId('evidence-event-evidence').locator('summary').first().click()
    await expect(page.getByTestId('evidence-event-evidence')).toContainText('Original quotation: Observer saw opening')
    await testInfo.attach('evidence-inspector', { body: await page.screenshot({ path: testInfo.outputPath('evidence-inspector.png'), fullPage: true }), contentType: 'image/png' })
    // Editing source content retains the recorded basis rather than silently renewing it.
    const reopened = page.getByTestId('evidence-event-evidence')
    await reopened.getByText('Add or edit source', { exact: true }).click()
    await reopened.getByLabel('Source to edit', { exact: true }).selectOption({ label: 'Observer report' })
    await reopened.getByLabel('Source URL', { exact: true }).fill('https://city.example/record#syndicated')
    await reopened.getByRole('button', { name: 'Save source changes' }).click()
    await expect(page.getByText('Corroboration needs review', { exact: true })).toBeVisible()
    const changed = await exported(page)
    expect(changed.analystWorkspace.evidence.reviews[0]).toEqual(saved.analystWorkspace.evidence.reviews[0])
    await reopened.getByLabel('Independence', { exact: true }).selectOption('independent')
    await reopened.getByLabel('Compatibility', { exact: true }).selectOption('compatible')
    await reopened.getByLabel('Review rationale', { exact: true }).fill('A review cannot erase the known common origin.')
    await reopened.getByRole('button', { name: 'Record review' }).click()
    await expect(page.getByText('Corroboration needs review', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Narrative view', exact: true }).click()
    const narrative = page.getByRole('article', { name: 'Narrative presentation' })
    await expect(narrative).toContainText('Corroboration needs review')
    await narrative.getByTestId('evidence-event-evidence').locator('summary').first().click()
    await expect(narrative.getByTestId('evidence-event-evidence')).toContainText('Paragraph 2')
  })

  test('AI review qualifies unsupported imported assessment without rewriting saved data', async ({ page }) => {
    let submitted: any
    await page.route('**/api/tools/timeline-assist', async route => {
      submitted = route.request().postDataJSON()
      await route.fulfill({ status: 200, json: { schemaVersion: 'timeline-assist.v1', requestId: 'evidence-assist', action: submitted.action, outcome: 'no_suggestions', suggestions: [], model: { name: 'fixture', status: 'no_suggestions', rejectedSuggestionCount: 0 } } })
    })
    await start(page, fixture('corroborated'))
    await page.getByRole('button', { name: 'Run AI review', exact: true }).click()
    await expect(page.getByText('The AI review did not identify a useful suggestion for this timeline.', { exact: true })).toBeVisible()
    expect(submitted.events[0].assessment).toBe('unreviewed')
    expect((await exported(page)).analystWorkspace.events[0].assessment).toBe('corroborated')
  })

  test('legacy assessment is qualified; relation/retraction/unlink/delete preserve records and local draft', async ({ page }) => {
    await start(page, fixture('corroborated'))
    await expect(page.getByText('Corroboration needs review', { exact: true })).toBeVisible()
    const panel = await addEvidence(page)
    const support = panel.getByRole('region', { name: 'supports assertions' })
    // Native sections are regions because each has an accessible name.
    await support.getByRole('article').first().getByLabel('Relation', { exact: true }).selectOption('contradicts')
    const contrary = panel.getByRole('region', { name: 'contradicts assertions' })
    await expect(contrary).toContainText('City records opening')
    await contrary.getByRole('button', { name: 'Retract assertion' }).click()
    await expect(contrary).toContainText('retracted')
    await contrary.getByRole('button', { name: 'Unlink assertion' }).click()
    const before = await exported(page)
    expect(before.analystWorkspace.evidence.assertions).toHaveLength(2)
    expect(before.analystWorkspace.evidence.links).toHaveLength(1)
    await page.getByRole('button', { name: 'Actions for Bridge opened' }).click()
    await page.getByRole('menuitem', { name: 'Remove from timeline', exact: true }).click()
    const removed = await exported(page)
    expect(removed.analystWorkspace.events).toHaveLength(0)
    expect(removed.analystWorkspace.evidence.assertions).toEqual(before.analystWorkspace.evidence.assertions)
    expect(removed.analystWorkspace.evidence.links).toEqual([])
    expect(removed.analystWorkspace.evidence.reviews).toEqual([])
    await page.reload()
    await page.getByRole('button', { name: 'Resume saved timeline' }).click()
    expect((await exported(page)).analystWorkspace.evidence).toEqual(removed.analystWorkspace.evidence)
  })
})
