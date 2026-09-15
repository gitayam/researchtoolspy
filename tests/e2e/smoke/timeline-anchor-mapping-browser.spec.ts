import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

async function openWorkflowDisclosure(page: Page, label: string) {
  const summary = page.locator('summary').filter({ hasText: new RegExp(`^${label}$`) })
  if (await summary.locator('..').getAttribute('open') === null) await summary.click()
}

async function addEvent(page: Page, title: string, date: string) {
  // Try "Add first event" button (for first event), then "Add event" (for subsequent events)
  if (await page.getByRole('button', { name: 'Add first event' }).count() > 0) {
    await page.getByRole('button', { name: 'Add first event' }).click()
  } else {
    await page.getByRole('button', { name: 'Add event', exact: true }).click()
  }
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Date', { exact: true }).fill(date)
  await dialog.getByLabel('Title', { exact: true }).fill(title)
  await page.getByRole('button', { name: 'Save event' }).click()
  await expect(page.getByRole('heading', { name: title })).toBeVisible()
}

test.describe('Timeline Anchor Mapping panel @smoke', () => {
  test('with no anchors selected, explains the sequence stays on its own T± axis', async ({ page }) => {
    await page.route('**/api/workspaces', route => route.fulfill({ status: 200, json: { owned: [], member: [] } }))
    await page.goto('/dashboard/tools/timeline')
    await page.getByLabel('Investigation or timeline title').fill('Anchor mapping test')
    await page.getByRole('button', { name: 'Create timeline' }).click()

    await page.getByRole('button', { name: 'Add first event' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('Date', { exact: true }).fill('2026-09-01')
    await dialog.getByLabel('Title', { exact: true }).fill('Host event')
    await page.getByRole('button', { name: 'Save event' }).click()
    await expect(page.getByRole('heading', { name: 'Host event' })).toBeVisible()

    await openWorkflowDisclosure(page, 'Map a relative sequence to recorded anchors')

    // Scope to anchor mapping details for the status message
    const anchorMappingDetails = page.locator('details').filter({ has: page.locator('summary').filter({ hasText: 'Map a relative sequence to recorded anchors' }) })
    await expect(anchorMappingDetails.locator('p[role="status"]')).toContainText('A relative sequence stays on its own T± axis until at least one anchor maps it to a host record.')
  })

  test('selecting ONE host event with recorded date resolves T+0 window and shows projected steps', async ({ page }) => {
    await page.route('**/api/workspaces', route => route.fulfill({ status: 200, json: { owned: [], member: [] } }))
    await page.goto('/dashboard/tools/timeline')
    await page.getByLabel('Investigation or timeline title').fill('Single anchor test')
    await page.getByRole('button', { name: 'Create timeline' }).click()

    await addEvent(page, 'First dated event', '2026-09-01')

    await openWorkflowDisclosure(page, 'Map a relative sequence to recorded anchors')

    // Scope to the anchor mapping details element to avoid matching other checkboxes
    const anchorMappingDetails = page.locator('details').filter({ has: page.locator('summary').filter({ hasText: 'Map a relative sequence to recorded anchors' }) })
    const label = anchorMappingDetails.locator('label').filter({ hasText: 'First dated event' })
    await label.locator('input[type="checkbox"]').check()

    // Status message should show mapping result
    await expect(anchorMappingDetails.locator('p[role="status"]')).toContainText('Sequence T+0 falls within')
    // Projected steps should be visible
    await expect(anchorMappingDetails.getByText(/T\+1 hour falls within/)).toBeVisible()
    await expect(anchorMappingDetails.getByText(/T\+1 day falls within/)).toBeVisible()
    await expect(anchorMappingDetails.getByText(/T\+1 week falls within/)).toBeVisible()
    // Should be constrained by the single anchor
    await expect(anchorMappingDetails.locator('p').filter({ hasText: /^Constrained by/ })).toContainText('First dated event')
  })

  test('selecting TWO day-precision events at same offset with different dates surfaces CONFLICT', async ({ page }) => {
    await page.route('**/api/workspaces', route => route.fulfill({ status: 200, json: { owned: [], member: [] } }))
    await page.goto('/dashboard/tools/timeline')
    await page.getByLabel('Investigation or timeline title').fill('Conflict test')
    await page.getByRole('button', { name: 'Create timeline' }).click()

    await addEvent(page, 'First recorded event', '2026-09-01')
    await addEvent(page, 'Second recorded event', '2026-09-05')

    await openWorkflowDisclosure(page, 'Map a relative sequence to recorded anchors')

    // Scope to the anchor mapping details element
    const anchorMappingDetails = page.locator('details').filter({ has: page.locator('summary').filter({ hasText: 'Map a relative sequence to recorded anchors' }) })

    // Select both events with default offset 0
    await anchorMappingDetails.locator('label').filter({ hasText: 'First recorded event' }).locator('input[type="checkbox"]').check()
    await anchorMappingDetails.locator('label').filter({ hasText: 'Second recorded event' }).locator('input[type="checkbox"]').check()

    // Located by its wording, not its styling: a Tailwind class is not behaviour, and
    // the negative assertion below would pass for the wrong reason if the class changed.
    const conflictText = anchorMappingDetails.getByText(/cannot both anchor this sequence/)
    await expect(conflictText).toContainText('First recorded event')
    await expect(conflictText).toContainText('Second recorded event')
    await expect(conflictText).toContainText('cannot both anchor this sequence')

    // Verify NO projected steps (failed state)
    await expect(anchorMappingDetails.getByText(/T\+1 hour falls within/)).not.toBeVisible()
    await expect(anchorMappingDetails.getByText(/T\+1 day falls within/)).not.toBeVisible()
    await expect(anchorMappingDetails.getByText(/T\+1 week falls within/)).not.toBeVisible()

    // Verify NO "Constrained by" message
    await expect(anchorMappingDetails.locator('p').filter({ hasText: /^Constrained by/ })).not.toBeVisible()
  })

  test('two anchors with compatible offsets resolve successfully with both as constraints', async ({ page }) => {
    await page.route('**/api/workspaces', route => route.fulfill({ status: 200, json: { owned: [], member: [] } }))
    await page.goto('/dashboard/tools/timeline')
    await page.getByLabel('Investigation or timeline title').fill('Compatible anchors test')
    await page.getByRole('button', { name: 'Create timeline' }).click()

    await addEvent(page, 'Event at day one', '2026-09-01')
    await addEvent(page, 'Event at day two', '2026-09-02')

    await openWorkflowDisclosure(page, 'Map a relative sequence to recorded anchors')

    // Scope to the anchor mapping details element
    const anchorMappingDetails = page.locator('details').filter({ has: page.locator('summary').filter({ hasText: 'Map a relative sequence to recorded anchors' }) })

    // Select first anchor at offset 0
    await anchorMappingDetails.locator('label').filter({ hasText: 'Event at day one' }).locator('input[type="checkbox"]').check()

    // Select second anchor at offset 1440 (1 day in minutes)
    await anchorMappingDetails.locator('label').filter({ hasText: 'Event at day two' }).locator('input[type="checkbox"]').check()
    await page.getByLabel('Offset in minutes into the sequence for Event at day two').fill('1440')

    // Verify successful mapping
    await expect(anchorMappingDetails.locator('p[role="status"]')).toContainText('Sequence T+0 falls within')
    await expect(anchorMappingDetails.getByText(/T\+1 day falls within/)).toBeVisible()
    // Both constraints named
    await expect(anchorMappingDetails.locator('p').filter({ hasText: /^Constrained by/ })).toContainText('Event at day one and Event at day two')

    // Verify NO conflict. Matching on the wording means a restyled conflict still fails
    // this assertion, where a class-based locator would silently match nothing and pass.
    await expect(anchorMappingDetails.getByText(/cannot both anchor this sequence/)).toHaveCount(0)
  })

  test('recorded events are unchanged after anchor mapping interactions', async ({ page }) => {
    await page.route('**/api/workspaces', route => route.fulfill({ status: 200, json: { owned: [], member: [] } }))
    await page.goto('/dashboard/tools/timeline')
    await page.getByLabel('Investigation or timeline title').fill('Unchanged events test')
    await page.getByRole('button', { name: 'Create timeline' }).click()

    await addEvent(page, 'Original event one', '2026-09-01')
    await addEvent(page, 'Original event two', '2026-09-05')

    // Record initial event list
    const initialHeadings = await page.locator('ol h3').allTextContents()
    expect(initialHeadings).toContain('Original event one')
    expect(initialHeadings).toContain('Original event two')

    // Interact with anchor mapping
    await openWorkflowDisclosure(page, 'Map a relative sequence to recorded anchors')

    // Scope to the anchor mapping details element
    const anchorMappingDetails = page.locator('details').filter({ has: page.locator('summary').filter({ hasText: 'Map a relative sequence to recorded anchors' }) })

    await anchorMappingDetails.locator('label').filter({ hasText: 'Original event one' }).locator('input[type="checkbox"]').check()
    await anchorMappingDetails.locator('label').filter({ hasText: 'Original event two' }).locator('input[type="checkbox"]').check()

    // Verify events are still there and unchanged
    const finalHeadings = await page.locator('ol h3').allTextContents()
    expect(finalHeadings).toContain('Original event one')
    expect(finalHeadings).toContain('Original event two')
    expect(finalHeadings).toEqual(initialHeadings)
  })
})
