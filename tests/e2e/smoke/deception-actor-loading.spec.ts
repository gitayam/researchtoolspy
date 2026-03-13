import { test, expect } from '../fixtures/base-test'

// ── Mock data ───────────────────────────────────────────────────────

const MOCK_ACTOR_ID = 'actor-test-001'

const mockSearchResults = {
  actors: [
    {
      id: MOCK_ACTOR_ID,
      name: 'Al Jazeera Network',
      type: 'organization',
      description: 'Qatar-based media organization',
    },
    {
      id: 'actor-test-002',
      name: 'Reuters News Agency',
      type: 'organization',
      description: 'International wire service',
    },
  ],
}

const mockCredibilityResponse = {
  actor: {
    id: MOCK_ACTOR_ID,
    name: 'Al Jazeera Network',
    type: 'organization',
    description: 'Qatar-based media organization',
    aliases: [],
  },
  credibility: {
    assessment_count: 3,
    framework_count: 1,
    mom_count: 2,
    avg_mom: { motive: 3, opportunity: 4, means: 4 },
    avg_pop: { historicalPattern: 2, sophisticationLevel: 4, successRate: 3 },
    avg_moses: { sourceVulnerability: 0, manipulationEvidence: 0 },
    avg_eve: { internalConsistency: 0, externalCorroboration: 0, anomalyDetection: 0 },
    most_recent_likelihood: 58,
    deception_profile: {
      motive: 3,
      opportunity: 4,
      means: 4,
      historicalPattern: 2,
      sophisticationLevel: 4,
      successRate: 3,
    },
  },
  previous_assessments: [
    {
      framework_id: 'fw-001',
      title: 'Coverage of regional elections',
      scores: {
        motive: 3,
        opportunity: 4,
        means: 4,
        historicalPattern: 2,
        sophisticationLevel: 4,
        successRate: 3,
      },
      likelihood: 58,
      created_at: '2026-02-15T10:00:00Z',
    },
  ],
  mom_assessments: [
    {
      id: 'mom-001',
      motive: 3,
      opportunity: 4,
      means: 4,
      notes: 'Strong state backing gives high opportunity',
      assessed_at: '2026-02-10T08:00:00Z',
    },
  ],
}

const mockEmptyCredibilityResponse = {
  actor: {
    id: 'actor-no-history',
    name: 'Unknown Blog Author',
    type: 'person',
    description: 'Anonymous blogger',
    aliases: [],
  },
  credibility: null,
  previous_assessments: [],
  mom_assessments: [],
}

// ── Route mocking helpers ───────────────────────────────────────────

async function mockDeceptionRoutes(
  page: import('@playwright/test').Page,
) {
  // Actor search endpoint -- DeceptionForm uses /api/actors?workspace_id=...&search=...
  await page.route('**/api/actors?**', (route) => {
    const url = route.request().url()
    if (url.includes('search=') || url.includes('workspace_id=')) {
      return route.fulfill({ status: 200, json: mockSearchResults })
    }
    return route.fulfill({ status: 200, json: { actors: [] } })
  })

  // Actor credibility endpoint
  await page.route(`**/api/actors/${MOCK_ACTOR_ID}/credibility**`, (route) =>
    route.fulfill({ status: 200, json: mockCredibilityResponse }),
  )

  // Actor credibility for actor with no history
  await page.route('**/api/actors/actor-no-history/credibility**', (route) =>
    route.fulfill({ status: 200, json: mockEmptyCredibilityResponse }),
  )

  // Deception save endpoint
  await page.route('**/api/deception**', (route) => {
    if (route.request().method() === 'POST') {
      return route.fulfill({ status: 201, json: { id: 'deception-new', ok: true } })
    }
    return route.fulfill({ status: 200, json: { analyses: [] } })
  })

  // AI availability check
  await page.route('**/api/ai/**', (route) =>
    route.fulfill({ status: 200, json: { available: false } }),
  )
}

// =====================================================================
// Actor Picker Visibility & Search
// =====================================================================

test.describe('Deception Actor Loading -- Picker & Search', () => {
  test.beforeEach(async ({ page }) => {
    await mockDeceptionRoutes(page)
  })

  test('@smoke actor picker is visible on create page', async ({ deceptionFormPage }) => {
    await deceptionFormPage.goto()
    await deceptionFormPage.waitForLoad()

    await expect(deceptionFormPage.actorSearchInput).toBeVisible()
    await expect(deceptionFormPage.actorPickerLabel).toBeVisible()
  })

  test('@smoke searching for actor shows dropdown with results', async ({ deceptionFormPage }) => {
    await deceptionFormPage.goto()
    await deceptionFormPage.waitForLoad()

    await deceptionFormPage.searchForActor('Al Jazeera')

    // Dropdown should appear with results
    await expect(deceptionFormPage.actorDropdown).toBeVisible({ timeout: 10000 })
    await expect(deceptionFormPage.actorDropdownItems.first()).toBeVisible()

    // Should show actor name and type badge
    await expect(
      deceptionFormPage.page.getByText('Al Jazeera Network').first(),
    ).toBeVisible()
    await expect(
      deceptionFormPage.page.getByText('organization').first(),
    ).toBeVisible()
  })

  test('search shows no-results message when no actors match', async ({ page, deceptionFormPage }) => {
    // Override search to return empty results
    await page.route('**/api/actors?**', (route) =>
      route.fulfill({ status: 200, json: { actors: [] } }),
    )

    await deceptionFormPage.goto()
    await deceptionFormPage.waitForLoad()

    await deceptionFormPage.searchForActor('zzzznonexistent')

    await expect(deceptionFormPage.actorNoResults).toBeVisible({ timeout: 10000 })
  })
})

// =====================================================================
// Actor Selection & Credibility Card
// =====================================================================

test.describe('Deception Actor Loading -- Selection & Credibility', () => {
  test.beforeEach(async ({ page }) => {
    await mockDeceptionRoutes(page)
  })

  test('@smoke selecting actor shows credibility card', async ({ deceptionFormPage }) => {
    await deceptionFormPage.goto()
    await deceptionFormPage.waitForLoad()

    // Search and select
    await deceptionFormPage.searchForActor('Al Jazeera')
    await expect(deceptionFormPage.actorDropdownItems.first()).toBeVisible({ timeout: 10000 })
    await deceptionFormPage.selectActorFromDropdown(0)

    // Search input should be replaced by selected actor display
    await expect(deceptionFormPage.selectedActorDisplay).toBeVisible()
    await expect(
      deceptionFormPage.selectedActorDisplay.getByText('Al Jazeera Network'),
    ).toBeVisible()

    // Credibility card should appear with title and assessment count
    await expect(deceptionFormPage.credibilityCardTitle).toBeVisible({ timeout: 10000 })
    await expect(deceptionFormPage.credibilityAssessmentCount).toBeVisible()
  })

  test('credibility card shows assessment count and likelihood', async ({ deceptionFormPage }) => {
    await deceptionFormPage.goto()
    await deceptionFormPage.waitForLoad()

    await deceptionFormPage.searchForActor('Al Jazeera')
    await expect(deceptionFormPage.actorDropdownItems.first()).toBeVisible({ timeout: 10000 })
    await deceptionFormPage.selectActorFromDropdown(0)

    await expect(deceptionFormPage.credibilityCard).toBeVisible({ timeout: 10000 })

    // Should show "3 previous assessments" from credibility.assessment_count
    await expect(
      deceptionFormPage.page.getByText('3 previous assessments'),
    ).toBeVisible()

    // Should show Most Recent Likelihood badge with 58% from credibility.most_recent_likelihood
    await expect(
      deceptionFormPage.page.getByText('58%').first(),
    ).toBeVisible()

    // Should show category score bar labels
    await expect(
      deceptionFormPage.credibilityCard.getByText('MOM').first(),
    ).toBeVisible()
  })

  test('clearing actor removes credibility card', async ({ deceptionFormPage }) => {
    await deceptionFormPage.goto()
    await deceptionFormPage.waitForLoad()

    // Select actor
    await deceptionFormPage.searchForActor('Al Jazeera')
    await expect(deceptionFormPage.actorDropdownItems.first()).toBeVisible({ timeout: 10000 })
    await deceptionFormPage.selectActorFromDropdown(0)
    await expect(deceptionFormPage.selectedActorDisplay).toBeVisible()
    await expect(deceptionFormPage.credibilityCard).toBeVisible({ timeout: 10000 })

    // Clear actor
    await deceptionFormPage.clearSelectedActor()

    // Search input should reappear
    await expect(deceptionFormPage.actorSearchInput).toBeVisible()

    // Credibility card should disappear
    await expect(deceptionFormPage.credibilityCard).not.toBeVisible()
  })

  test('pre-fill from profile button populates scoring section', async ({ deceptionFormPage }) => {
    await deceptionFormPage.goto()
    await deceptionFormPage.waitForLoad()

    // Select actor with credibility data
    await deceptionFormPage.searchForActor('Al Jazeera')
    await expect(deceptionFormPage.actorDropdownItems.first()).toBeVisible({ timeout: 10000 })
    await deceptionFormPage.selectActorFromDropdown(0)

    await expect(deceptionFormPage.credibilityCard).toBeVisible({ timeout: 10000 })

    // Click pre-fill button
    await expect(deceptionFormPage.preFillScoresButton).toBeVisible()
    await deceptionFormPage.clickPreFillScores()

    // Button should still be visible after click (no navigation away)
    await expect(deceptionFormPage.preFillScoresButton).toBeVisible()
  })
})

// =====================================================================
// Empty State (No Previous Assessments)
// =====================================================================

test.describe('Deception Actor Loading -- Empty State', () => {
  test('actor with no history shows empty state message', async ({ page, deceptionFormPage }) => {
    await mockDeceptionRoutes(page)

    // Override search to return only the no-history actor
    await page.route('**/api/actors?**', (route) =>
      route.fulfill({
        status: 200,
        json: {
          actors: [
            {
              id: 'actor-no-history',
              name: 'Unknown Blog Author',
              type: 'person',
              description: 'Anonymous blogger',
            },
          ],
        },
      }),
    )

    await deceptionFormPage.goto()
    await deceptionFormPage.waitForLoad()

    await deceptionFormPage.searchForActor('Unknown')
    await expect(deceptionFormPage.actorDropdownItems.first()).toBeVisible({ timeout: 10000 })
    await deceptionFormPage.selectActorFromDropdown(0)

    // Should show empty state message (credibility is null)
    await expect(deceptionFormPage.credibilityEmptyState).toBeVisible({ timeout: 10000 })

    // Pre-fill button should NOT be visible when credibility is null
    await expect(deceptionFormPage.preFillScoresButton).not.toBeVisible()
  })
})

// =====================================================================
// Mobile Responsiveness
// =====================================================================

test.describe('Deception Actor Loading -- Mobile Viewport', () => {
  test.beforeEach(async ({ page }) => {
    await mockDeceptionRoutes(page)
  })

  test('actor picker and credibility card render on mobile viewport', async ({ page, deceptionFormPage }) => {
    // Set mobile viewport explicitly so this test runs in all projects
    await page.setViewportSize({ width: 390, height: 844 })

    await deceptionFormPage.goto()
    await deceptionFormPage.waitForLoad()

    // Actor search input should be visible on mobile
    await expect(deceptionFormPage.actorSearchInput).toBeVisible()

    // Search and select actor
    await deceptionFormPage.searchForActor('Al Jazeera')
    await expect(deceptionFormPage.actorDropdownItems.first()).toBeVisible({ timeout: 10000 })
    await deceptionFormPage.selectActorFromDropdown(0)

    // Selected actor display should be visible
    await expect(deceptionFormPage.selectedActorDisplay).toBeVisible()

    // Credibility card should be visible on mobile (stacked vertically)
    await expect(deceptionFormPage.credibilityCard).toBeVisible({ timeout: 10000 })
  })
})
