import { test, expect } from '../fixtures/base-test'

test.describe('Behavior timeline time domain @smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.clear())
    await page.route('**/api/workspaces**', route => route.fulfill({ status: 200, json: { workspaces: [] } }))
    await page.route('**/api/ai/config**', route => route.fulfill({ status: 200, json: { enabled: false } }))
  })

  test('a declared domain is saved beside the events it applies to', async ({ page }) => {
    let savedPayload: { data: Record<string, unknown> } | undefined
    await page.route('**/api/frameworks?**', async (route) => {
      if (route.request().method() === 'POST') {
        savedPayload = route.request().postDataJSON()
        await route.fulfill({ status: 201, json: { id: 'behavior-domain-1' } })
        return
      }
      await route.fulfill({ status: 200, json: { frameworks: [] } })
    })

    await page.goto('/dashboard/analysis-frameworks/behavior/create')
    await page.getByLabel('Behavior Title *').fill('Shift handover')

    // Relative is the default, matching the convention the generator emits.
    await expect(page.getByLabel('Time domain')).toHaveValue('anchor_relative')
    await page.getByLabel('Time domain').selectOption('ordinal')

    await page.getByRole('button', { name: 'Add Event' }).click()
    await page.getByPlaceholder(/Event label/).fill('Outgoing shift briefs incoming')
    await page.getByRole('button', { name: 'Done', exact: true }).click()

    await page.getByRole('button', { name: 'Save Analysis' }).first().click()
    await expect.poll(() => savedPayload).toBeTruthy()

    expect(savedPayload!.data.timeline_time_domain).toBe('ordinal')
    expect(Array.isArray(savedPayload!.data.timeline)).toBe(true)
  })

  test('a saved domain is honoured on reload rather than falling back to the default', async ({ page }) => {
    await page.route('**/api/frameworks?**', async (route) => {
      const url = new URL(route.request().url())
      if (url.searchParams.get('id') === '77') {
        await route.fulfill({
          status: 200,
          json: {
            id: 77,
            title: 'Saved ordinal behaviour',
            description: 'Sequence without elapsed time.',
            framework_type: 'behavior',
            status: 'active',
            data: {
              timeline_time_domain: 'ordinal',
              timeline: [{ id: 'saved-1', label: 'Outgoing shift briefs incoming' }],
            },
          },
        })
        return
      }
      await route.fulfill({ status: 200, json: { frameworks: [] } })
    })

    await page.goto('/dashboard/analysis-frameworks/behavior/77')
    await expect(page.getByText('Outgoing shift briefs incoming')).toBeVisible()
    // Without persistence this read back as relative and reviewed offsets against a clock
    // the analyst had explicitly opted out of.
    await expect(page.getByLabel('Time domain')).toHaveValue('ordinal')
  })

  test('an unreadable offset is explained at the field under the relative domain', async ({ page }) => {
    await page.route('**/api/frameworks?**', route => route.fulfill({ status: 200, json: { frameworks: [] } }))

    await page.goto('/dashboard/analysis-frameworks/behavior/create')
    await page.getByLabel('Behavior Title *').fill('Enrollment run')
    await expect(page.getByLabel('Time domain')).toHaveValue('anchor_relative')

    await page.getByRole('button', { name: 'Add Event' }).click()
    await page.getByPlaceholder(/Event label/).fill('Resident opens the form')

    // A clock reading is exactly what the old free-text field accepted silently. It is
    // reported twice on purpose: at the field being edited, and in the timing review that
    // summarises the whole timeline.
    const fieldGuidance = page.getByText('Offsets are written from the behaviour start, for example T+30min, T-2h, or T+0.', { exact: true })
    const reviewEntry = page.getByText(/Resident opens the form: Offsets are written from the behaviour start/)

    await page.getByPlaceholder(/Offset from start/).fill('9:00 AM')
    await expect(fieldGuidance).toBeVisible()
    await expect(reviewEntry).toBeVisible()

    await page.getByPlaceholder(/Offset from start/).fill('T+30min')
    await expect(fieldGuidance).toHaveCount(0)
    await expect(reviewEntry).toHaveCount(0)
  })
})
