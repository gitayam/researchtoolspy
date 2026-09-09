import { test, expect } from '../fixtures/base-test'

test.describe('Behavior decision-sequence editor @smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.clear())
    await page.route('**/api/workspaces**', route => route.fulfill({ status: 200, json: { workspaces: [] } }))
    await page.route('**/api/ai/config**', route => route.fulfill({ status: 200, json: { enabled: false } }))
  })

  test('authors and saves advanced event fields in the canonical schema', async ({ page }) => {
    let savedPayload: { data: { timeline: Array<Record<string, unknown>> } } | undefined
    await page.route('**/api/frameworks?**', async (route) => {
      if (route.request().method() === 'POST') {
        savedPayload = route.request().postDataJSON()
        await route.fulfill({ status: 201, json: { id: 'behavior-test-1' } })
        return
      }
      await route.fulfill({ status: 200, json: { frameworks: [] } })
    })

    await page.goto('/dashboard/analysis-frameworks/behavior/create')
    await page.getByLabel('Behavior Title *').fill('Community warning enrollment')
    await page.getByRole('button', { name: 'Add Event' }).click()
    await page.getByPlaceholder(/Event label/).fill('Resident decides to enroll')
    await page.getByPlaceholder(/Description \(optional\)/).fill('Resident evaluates whether alerts are useful.')
    await page.getByRole('button', { name: 'Done', exact: true }).click()
    await page.getByRole('button', { name: 'Show decision details' }).click()

    const details = page.locator('[data-testid^="event-details-"]').first()
    await expect(details).toBeVisible()

    await page.getByLabel('Decision role').click()
    await page.getByRole('option', { name: 'Intention', exact: true }).click()

    await page.getByLabel('COM-B target hypothesis').click()
    await page.getByRole('option', { name: 'Reflective motivation', exact: true }).click()

    await details.getByRole('button', { name: 'Add state' }).click()
    await page.getByLabel('TTM stage').click()
    await page.getByRole('option', { name: 'Preparation', exact: true }).click()
    await page.getByLabel('HAPA phase').click()
    await page.getByRole('option', { name: 'Volitional', exact: true }).click()
    await page.getByLabel('Motivation mode').click()
    await page.getByRole('option', { name: 'Reflective dominant', exact: true }).click()

    const copingRow = details.getByLabel('New coping obstacle').locator('..')
    await details.getByLabel('New coping obstacle').fill('Enrollment site is unavailable')
    await details.getByLabel('New coping response').fill('Use the phone enrollment option')
    await copingRow.getByRole('button', { name: 'Add', exact: true }).click()

    const competingRow = details.getByLabel('New competing behavior').locator('..')
    await details.getByLabel('New competing behavior').fill('Rely on social media updates')
    await competingRow.getByRole('button', { name: 'Add', exact: true }).click()

    const subStepRow = details.getByLabel('New sub-step label').locator('..')
    await details.getByLabel('New sub-step label').fill('Compare alert channels')
    await details.getByLabel('New sub-step duration').fill('5 minutes')
    await subStepRow.getByRole('button', { name: 'Add', exact: true }).click()

    const forkRow = details.getByLabel('New fork condition').locator('..')
    await details.getByLabel('New fork condition').fill('If privacy concerns remain')
    await details.getByLabel('New fork outcome').fill('Defer enrollment')
    await forkRow.getByRole('button', { name: 'Add', exact: true }).click()

    await expect(page.getByText('Decision: Intention')).toBeVisible()
    await expect(page.getByText('COM-B hypothesis: Reflective motivation')).toBeVisible()
    await expect(page.getByText('1 coping plan')).toBeVisible()
    await expect(page.getByText('1 competing behavior')).toBeVisible()

    await page.getByRole('button', { name: 'Save Analysis' }).first().click()
    await expect.poll(() => savedPayload).toBeTruthy()

    const event = savedPayload!.data.timeline[0]
    expect(event).toMatchObject({
      label: 'Resident decides to enroll',
      decision_type: 'intention',
      is_decision_point: true,
      psychological_state: {
        stage: 'preparation',
        phase: 'volitional',
        motivation_mode: 'reflective_dominant',
      },
      com_b_target: 'reflective_motivation',
      coping_branches: [{
        obstacle: 'Enrollment site is unavailable',
        response: 'Use the phone enrollment option',
      }],
      competing_behaviours: ['Rely on social media updates'],
      sub_steps: [{ label: 'Compare alert channels', duration: '5 minutes' }],
      forks: [{ condition: 'If privacy concerns remain', label: 'Defer enrollment', path: [] }],
    })
  })

  test('renders saved decision details in the read-only analysis view', async ({ page }) => {
    await page.route('**/api/frameworks?**', async (route) => {
      const url = new URL(route.request().url())
      if (url.searchParams.get('id') === '42') {
        await route.fulfill({
          status: 200,
          json: {
            id: 42,
            title: 'Saved behavior analysis',
            description: 'A saved behavior with a rich decision sequence.',
            framework_type: 'behavior',
            status: 'active',
            data: {
              timeline: [{
                id: 'saved-event-1',
                label: 'Resident prepares to enroll',
                decision_type: 'action_plan',
                is_decision_point: true,
                psychological_state: {
                  stage: 'preparation',
                  phase: 'volitional',
                  motivation_mode: 'reflective_dominant',
                },
                com_b_target: 'reflective_motivation',
                coping_branches: [{ obstacle: 'Website outage', response: 'Use phone enrollment' }],
                competing_behaviours: ['Ignore the prompt'],
              }],
            },
          },
        })
        return
      }
      await route.fulfill({ status: 200, json: { frameworks: [] } })
    })

    await page.goto('/dashboard/analysis-frameworks/behavior/42')
    await expect(page.getByText('Resident prepares to enroll')).toBeVisible()
    await expect(page.getByText('Decision: Action plan')).toBeVisible()
    await expect(page.getByText('COM-B hypothesis: Reflective motivation')).toBeVisible()

    await page.getByRole('button', { name: 'Show decision details' }).click()
    await expect(page.getByText('Preparation · Volitional · Reflective dominant')).toBeVisible()
    await expect(page.getByText('If Website outage, then Use phone enrollment')).toBeVisible()
    await expect(page.getByText('Ignore the prompt')).toBeVisible()
  })
})
