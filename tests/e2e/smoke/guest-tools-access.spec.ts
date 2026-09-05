import { test, expect } from '@playwright/test'

test.describe('Guest tool access @smoke', () => {
  test('@smoke research questions and cross tables work without login', async ({ page }) => {
    const requestHeaders: Record<string, string>[] = []

    await page.route('**/api/workspaces', async (route) => {
      requestHeaders.push(await route.request().allHeaders())
      await route.fulfill({ status: 200, json: { owned: [], member: [] } })
    })
    await page.route('**/api/research/recommend-questions', async (route) => {
      requestHeaders.push(await route.request().allHeaders())
      await route.fulfill({
        status: 200,
        json: {
          questions: [{
            question: 'How can anonymous research sessions improve access?',
            smartAssessment: {},
            finerAssessment: {},
            nullHypothesis: 'H0: Access does not improve.',
            alternativeHypothesis: 'H1: Access improves.',
            keyVariables: [],
            dataCollectionMethods: [],
            potentialChallenges: [],
            overallScore: 80,
          }],
        },
      })
    })
    await page.route('**/api/cross-table', async (route) => {
      requestHeaders.push(await route.request().allHeaders())
      await route.fulfill({ status: 200, json: { tables: [] } })
    })

    await page.goto('/dashboard/tools/research-question-generator')
    await page.getByPlaceholder(/What do you want to research/i).fill('Anonymous research access')
    await page.getByRole('button', { name: 'Generate Questions' }).click()
    await expect(page.getByText('How can anonymous research sessions improve access?')).toBeVisible()
    await expect(page.getByText(/Session expired/i)).toHaveCount(0)

    await page.goto('/dashboard/tools/cross-table')
    await expect(page.getByRole('heading', { name: /Create Your First Cross Table/i })).toBeVisible()

    const guestRequests = requestHeaders.filter((headers) => headers['x-guest-session'])
    expect(guestRequests.length).toBeGreaterThanOrEqual(3)
    const sessionIds = new Set(guestRequests.map((headers) => headers['x-guest-session']))
    const workspaceIds = new Set(guestRequests.map((headers) => headers['x-workspace-id']))
    expect(sessionIds.size).toBe(1)
    expect(workspaceIds.size).toBe(1)
    expect([...sessionIds][0]).toMatch(/^guest_[0-9a-f-]{36}$/)
    expect([...workspaceIds][0]).toMatch(/^guest-workspace-[0-9a-f-]{36}$/)
  })
})
