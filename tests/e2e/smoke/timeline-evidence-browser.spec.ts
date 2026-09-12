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
  test('compact source coverage distinguishes linked roles, retractions and withdrawn ancestry in both views', async ({ page }, testInfo) => {
    test.setTimeout(120_000)
    const value: any = fixture('corroborated')
    const eventId = value.analystWorkspace.events[0].id
    value.analystWorkspace.evidence = {
      schemaVersion: 'timeline-evidence.v1',
      sources: [
        { id: 's1', url: 'https://example.test/report', title: 'First saved source record', publisher: '' },
        { id: 's2', url: 'https://example.test/report', title: 'Duplicate URL saved record', publisher: '' },
        { id: 's3', url: 'https://example.test/context', title: 'Context record', publisher: '' },
      ],
      assertions: ['a', 'b', 'c', 'd', 'e', 'root'].map((id, index) => ({ id, sourceId: ['s1', 's2', 's1', 's2', 's3', 's3'][index], claimText: `Coverage account ${id}`, temporalClaim: '', passage: { id: `p-${id}`, quote: '', locator: 'p1' }, status: id === 'b' || id === 'root' ? 'retracted' : 'active', derivesFrom: id === 'c' ? ['root'] : [] })),
      links: ['a', 'b', 'c', 'd', 'e'].map((assertionId, index) => ({ id: `l-${assertionId}`, eventId, assertionId, relation: index < 3 ? 'supports' : index === 3 ? 'contradicts' : 'context' })), reviews: [],
    }
    await start(page, value)
    const coverage = page.getByRole('region', { name: 'Source coverage for Bridge opened', exact: true })
    async function checkCoverage() {
      await expect(coverage).toContainText('3 recorded sources · 5 linked assertions')
      for (const [label, count] of [['Supports', '3'], ['Contradicts', '1'], ['Context', '1']]) {
        await expect(coverage.locator('dl > div').filter({ has: page.getByText(label, { exact: true }) }).locator('dd')).toHaveText(count)
      }
      await expect(coverage).toContainText('1 active supporting assertion')
      await expect(coverage).toContainText('1 linked assertion is retracted')
      await expect(coverage).toContainText('1 supporting assertion has retracted ancestry')
      await expect(coverage).toContainText('Recorded sources do not imply independent confirmation')
    }
    await checkCoverage()
    expect((await exported(page)).analystWorkspace.evidence).toEqual(value.analystWorkspace.evidence)
    await page.getByRole('button', { name: 'Narrative view', exact: true }).click()
    await checkCoverage()
    for (const theme of ['light', 'dark']) {
      await page.evaluate(theme => document.documentElement.classList.toggle('dark', theme === 'dark'), theme)
      await testInfo.attach(`source-coverage-${theme}`, { body: await coverage.screenshot({ path: testInfo.outputPath(`source-coverage-${theme}.png`), scale: 'css', animations: 'disabled' }), contentType: 'image/png' })
    }
    const unchanged = (await exported(page)).analystWorkspace
    expect(unchanged.evidence).toEqual(value.analystWorkspace.evidence)
    expect(unchanged.events).toEqual(value.analystWorkspace.events)
    const panel = page.getByTestId('evidence-event-evidence')
    await panel.scrollIntoViewIfNeeded()
    await panel.locator('summary').first().click()
    const first = panel.getByRole('article').filter({ has: page.getByText('Coverage account a', { exact: true }) })
    await first.getByRole('button', { name: 'Retract assertion' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Apply change' }).click()
    await expect(coverage).toContainText('No active supporting assertion.')
    await expect(coverage).toContainText('2 linked assertions are retracted')
    const changed = (await exported(page)).analystWorkspace
    expect(changed.events).toEqual(unchanged.events)
    expect(changed.evidence.links).toEqual(unchanged.evidence.links)
    const empty: any = fixture()
    await upload(page, empty)
    await expect(coverage).toContainText('0 recorded sources · 0 linked assertions')
    await expect(coverage).toContainText('No active supporting assertion.')
  })

  test('final support warning covers shared ancestry, cancellation, relation changes and unlinking', async ({ page }, testInfo) => {
    test.setTimeout(120_000)
    const value: any = fixture('corroborated')
    const first = value.analystWorkspace.events[0]
    value.analystWorkspace.events.push({ ...first, id: 'event-hidden', title: 'Downstream access restored', sequenceOrder: 1, narrativeIncluded: false, narrativeOrder: 1 })
    value.analystWorkspace.evidence = {
      schemaVersion: 'timeline-evidence.v1',
      sources: [{ id: 'source-root', url: 'https://example.test/root', title: 'Root report', publisher: '' }],
      assertions: [
        { id: 'root', sourceId: 'source-root', claimText: 'Root account', temporalClaim: '', passage: { id: 'passage-root', quote: 'Root quotation', locator: 'p1' }, status: 'active', derivesFrom: [] },
        { id: 'child', sourceId: 'source-root', claimText: 'Derived account', temporalClaim: '', passage: { id: 'passage-child', quote: 'Derived quotation', locator: 'p2' }, status: 'active', derivesFrom: ['root'] },
      ],
      links: [
        { id: 'link-root', assertionId: 'root', eventId: first.id, relation: 'supports' },
        { id: 'link-child', assertionId: 'child', eventId: 'event-hidden', relation: 'supports' },
      ], reviews: [],
    }
    await start(page, value)
    await page.getByRole('button', { name: 'Narrative view', exact: true }).click()
    const panel = page.getByRole('article', { name: 'Narrative presentation' }).getByTestId('evidence-event-evidence')
    await panel.locator('summary').first().click()
    const retract = panel.getByRole('button', { name: 'Retract assertion', exact: true })
    const before = (await exported(page)).analystWorkspace
    await retract.focus(); await page.keyboard.press('Enter')
    const dialog = page.getByRole('alertdialog', { name: 'Remove the final active support?' })
    await expect(dialog.getByRole('list')).toContainText('Bridge opened')
    await expect(dialog.getByRole('list')).toContainText('Downstream access restored')
    await expect(dialog.getByRole('button', { name: 'Keep support' })).toBeFocused()
    for (const theme of ['light', 'dark']) {
      await page.evaluate(theme => document.documentElement.classList.toggle('dark', theme === 'dark'), theme)
      // Check painted color and alpha; browsers serialize OKLCH with different precision.
      await expect.poll(() => dialog.evaluate((element, dark) => {
        const canvas = document.createElement('canvas'); canvas.width = 1; canvas.height = 1
        const context = canvas.getContext('2d')!
        context.fillStyle = getComputedStyle(element).backgroundColor; context.fillRect(0, 0, 1, 1)
        const rgba = context.getImageData(0, 0, 1, 1).data
        const expected = dark ? [2, 6, 23] : [255, 255, 255]
        return rgba[3] === 255 && expected.every((channel, index) => Math.abs(rgba[index] - channel) <= 2)
      }, theme === 'dark')).toBe(true)
      await testInfo.attach(`support-warning-${theme}`, { body: await dialog.screenshot({ path: testInfo.outputPath(`support-warning-${theme}.png`), scale: 'css', animations: 'disabled' }), contentType: 'image/png' })
    }
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0); await expect(retract).toBeFocused()
    expect((await exported(page)).analystWorkspace).toEqual(before)
    await retract.click(); await dialog.getByRole('button', { name: 'Apply change' }).click()
    const retracted = (await exported(page)).analystWorkspace
    expect(retracted.evidence.assertions[0].status).toBe('retracted')
    expect(retracted.evidence.assertions[1].status).toBe('active')
    expect(retracted.evidence.links).toEqual(before.evidence.links)
    expect(retracted.events).toEqual(before.events)
    await panel.getByRole('button', { name: 'Restore assertion' }).click()
    await expect(dialog).toHaveCount(0)
    await panel.getByLabel('Relation', { exact: true }).selectOption('context')
    await expect(dialog.getByRole('list')).toHaveText('Bridge opened')
    await dialog.getByRole('button', { name: 'Keep support' }).click()
    expect((await exported(page)).analystWorkspace).toEqual(before)
    await panel.getByLabel('Relation', { exact: true }).selectOption('context')
    await dialog.getByRole('button', { name: 'Apply change' }).click()
    await panel.getByLabel('Relation', { exact: true }).selectOption('supports')
    await panel.getByRole('button', { name: 'Unlink assertion' }).click()
    await expect(dialog.getByRole('list')).toHaveText('Bridge opened')
    await dialog.getByRole('button', { name: 'Apply change' }).click()
    const unlinked = (await exported(page)).analystWorkspace
    expect(unlinked.evidence.assertions).toEqual(before.evidence.assertions)
    expect(unlinked.evidence.links).toEqual([before.evidence.links[1]])
    expect(unlinked.events).toEqual(before.events)
  })

  test('a warning refuses stale evidence or event context without overwriting newer edits', async ({ page }) => {
    await page.goto('/dashboard/tools/timeline')
    // A component harness changes props while the modal is open, as an external update would.
    await page.evaluate(async () => {
      const { default: React } = await import('/node_modules/.vite/deps/react.js')
      const { default: ReactDOM } = await import('/node_modules/.vite/deps/react-dom_client.js')
      const { TimelineEvidence } = await import('/src/components/timeline/TimelineEvidence.tsx')
      // Isolate the supplementary prop-race harness from the application's fixed navigation.
      document.getElementById('root')!.style.display = 'none'
      const host = document.createElement('div'); document.body.appendChild(host)
      const root = ReactDOM.createRoot(host)
      const event = { id: 'race-event', title: 'Original title', description: '', assessment: 'corroborated' }
      const evidence = { schemaVersion: 'timeline-evidence.v1', sources: [{ id: 's', url: 'https://example.test', title: 'Report', publisher: '' }], assertions: [{ id: 'a', sourceId: 's', claimText: 'Account', temporalClaim: '', passage: { id: 'p', quote: '', locator: 'p1' }, status: 'active', derivesFrom: [] }], links: [{ id: 'l', eventId: event.id, assertionId: 'a', relation: 'supports' }], reviews: [] }
      const state = { event, evidence, writes: 0 }
      const render = () => root.render(React.createElement(TimelineEvidence, { event: state.event, events: [state.event], evidence: state.evidence, onChange: next => { state.writes++; state.evidence = next; render(); return true } }))
      ;(window as any).warningHarness = { state, render }
      render()
    })
    const panel = page.getByTestId('evidence-race-event')
    await panel.locator('summary').first().click()
    for (const field of ['event', 'evidence']) {
      await panel.getByRole('button', { name: 'Retract assertion' }).click()
      await expect(page.getByRole('alertdialog')).toBeVisible()
      await page.evaluate(field => {
        const h = (window as any).warningHarness
        if (field === 'event') h.state.event = { ...h.state.event, title: 'Newer title' }
        else h.state.evidence = { ...h.state.evidence, sources: h.state.evidence.sources.map(s => ({ ...s, publisher: 'Newer publisher' })) }
        h.render()
      }, field)
      await expect(panel.locator('summary').first()).toContainText('Newer title')
      if (field === 'evidence') await expect(panel.getByText('Publisher: Newer publisher', { exact: true })).toBeVisible()
      await page.getByRole('alertdialog').getByRole('button', { name: 'Apply change' }).click()
      await expect(page.getByRole('alertdialog')).toHaveCount(0)
      await expect(panel.getByRole('alert')).toContainText('Nothing was applied')
      expect(await page.evaluate(() => (window as any).warningHarness.state.writes)).toBe(0)
    }
    await panel.getByRole('button', { name: 'Retract assertion' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Apply change' }).click()
    const state = await page.evaluate(() => (window as any).warningHarness.state)
    expect(state.writes).toBe(1)
    expect(state.event.title).toBe('Newer title')
    expect(state.evidence.sources[0].publisher).toBe('Newer publisher')
    expect(state.evidence.assertions[0].status).toBe('retracted')
  })

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
    await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Corroboration needs a current')
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
    await testInfo.attach('evidence-inspector', { body: await page.screenshot({ path: testInfo.outputPath('evidence-inspector.png'), fullPage: true, scale: 'css' }), contentType: 'image/png' })
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
