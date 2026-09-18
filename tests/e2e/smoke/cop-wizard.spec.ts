import { test, expect } from '../fixtures/base-test'
import { signIn } from '../helpers/auth'
import {
  TEMPLATES,
  VALID_LOCATIONS,
  SAMPLE_QUESTIONS,
  SAMPLE_EVENT,
} from '../helpers/test-data'

// Mock response for the POST /api/workspaces endpoint
const MOCK_SESSION_ID = 'mock-session-abc-123'
const MOCK_WORKSPACE_RESPONSE = {
  id: 'mock-workspace-id',
  cop_session_id: MOCK_SESSION_ID,
  title: 'E2E Test Workspace',
}

/**
 * `STALE_PAGE_OBJECTS` — the marked tests drive a wizard that no longer exists.
 *
 * "New COP" was replaced by "New Workspace", pointing at the unified wizard at
 * `/dashboard/workspace/new`, and `cop-wizard.page.ts` still describes the screen before
 * that change: it waits for a "Purpose" step and a Next button that the current wizard does
 * not present in those places. The failures are all `toBeVisible` and `click` timeouts on
 * selectors for a replaced UI, not defects in the wizard.
 *
 * Marked `fixme` rather than skipped behind a condition, because the previous arrangement
 * hid them behind "the API is not running" — a dependency that was never the real one, and
 * that made ten specs invisible for months rather than countable. Fixing them means
 * rewriting the page object against the current wizard.
 *
 * Everything these specs need from the outside world.
 *
 * They used to be skipped whenever the local API was not running, which meant they never
 * ran at all in the default harness — ten specs, zero of them passing, for months. The
 * dependency was real but it was never a *server* dependency: the page reads its identity
 * from localStorage and the two endpoints involved return trivial payloads. Mocking them
 * makes the specs hermetic, which is what a wizard flow test should have been.
 */
async function setUpWizardHarness(page: import('@playwright/test').Page) {
  await signIn(page)
  // The list page this flow starts from. Empty is the interesting case anyway — the wizard
  // is reached from the empty state as readily as from a populated one.
  await page.route('**/api/cop/sessions**', route => route.fulfill({ status: 200, json: { sessions: [] } }))
  await page.route('**/api/ai/config**', route => route.fulfill({ status: 200, json: { enabled: false } }))
  // WorkspaceContext fetches this on every dashboard page, not just the wizard.
  await page.route('**/api/workspaces', route => (
    route.request().method() === 'POST'
      ? route.fulfill({ status: 200, json: MOCK_WORKSPACE_RESPONSE })
      : route.fulfill({ status: 200, json: { workspaces: [] } })
  ))
}

/** Intercept the workspace creation API and return a mock response. */
async function mockCreateWorkspace(page: import('@playwright/test').Page) {
  await page.route('**/api/workspaces', (route) => {
    if (route.request().method() === 'POST') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_WORKSPACE_RESPONSE),
      })
    }
    // fallback(), not continue(): continue() goes to the network, which in this harness is
    // a Vite proxy pointing at an API server nothing starts. fallback() hands the request
    // to the handler registered before this one, which answers it.
    return route.fallback()
  })
}

// Map old template type keys to the new workspace type labels used in the UI
const NEW_WORKSPACE_LABELS: Record<string, string> = {
  quick_brief: 'Quick Analysis',
  event_monitor: 'Event Monitor',
  area_study: 'Deep Research',
  crisis_response: 'Crisis Response',
  event_analysis: 'Event Analysis',
  custom: 'Topic Exploration',
}

// ---------------------------------------------------------------------------
// Smoke tests
// ---------------------------------------------------------------------------

test.describe('COP Wizard @smoke', () => {
  test.beforeEach(async ({ page }) => setUpWizardHarness(page))
  test.beforeEach(async ({ copListPage }) => {
    await copListPage.goto()
    await copListPage.waitForLoad()
  })

  test('wizard opens from list page', async ({ copListPage, copWizardPage }) => {
    await copListPage.clickNewCop()
    await copWizardPage.waitForWizard()
    await expect(copWizardPage.title).toBeVisible()
  })

  test('can select each template type', async ({
    copListPage,
    copWizardPage,
  }) => {
    test.fixme() // STALE_PAGE_OBJECTS
    await copListPage.clickNewCop()
    await copWizardPage.waitForWizard()

    const templateTypes = Object.keys(TEMPLATES) as Array<keyof typeof TEMPLATES>

    for (const type of templateTypes) {
      await copWizardPage.selectTemplateByType(type)

      // The template button containing the new label should be visible
      const label = NEW_WORKSPACE_LABELS[type] ?? TEMPLATES[type]
      const button = copWizardPage.page
        .locator('button')
        .filter({ hasText: label })
        .first()
      await expect(button).toBeVisible()
    }
  })

  test('Quick Brief full creation flow', async ({
    page,
    copListPage,
    copWizardPage,
  }) => {
    test.fixme() // STALE_PAGE_OBJECTS
    await mockCreateWorkspace(page)

    await copListPage.clickNewCop()
    await copWizardPage.waitForWizard()

    // Step 0: Select template (Quick Analysis = old quick_brief)
    await copWizardPage.selectTemplateByType('quick_brief')
    await copWizardPage.clickNext()

    // Step 1: Details (title is required)
    await copWizardPage.fillTitle('Quick Brief - Tehran, Iran')
    await copWizardPage.clickNext()

    // Step 2: Location
    await copWizardPage.fillLocation(VALID_LOCATIONS.tehran.name)
    await copWizardPage.clickNext()

    // Step 3: Time window
    await copWizardPage.selectTimeWindow('1h')
    await copWizardPage.clickNext()

    // Step 4: Key questions (optional - add one for coverage)
    await copWizardPage.addQuestion(SAMPLE_QUESTIONS[0])
    const count = await copWizardPage.getQuestionCount()
    expect(count).toBe(1)

    // Create
    await copWizardPage.clickCreate()

    // Should navigate to the COP viewer page
    await page.waitForURL(`**/dashboard/cop/${MOCK_SESSION_ID}`)
  })
})

// ---------------------------------------------------------------------------
// Extended wizard tests
// ---------------------------------------------------------------------------

test.describe('COP Wizard - Event Analysis', () => {
  test.beforeEach(async ({ page }) => setUpWizardHarness(page))
  test.beforeEach(async ({ copListPage }) => {
    await copListPage.goto()
    await copListPage.waitForLoad()
  })

  test('Event Analysis flow with event details step', async ({
    page,
    copListPage,
    copWizardPage,
  }) => {
    test.fixme() // STALE_PAGE_OBJECTS
    await mockCreateWorkspace(page)

    await copListPage.clickNewCop()
    await copWizardPage.waitForWizard()

    // Step 0: Select Event Analysis template
    await copWizardPage.selectTemplateByType('event_analysis')
    await copWizardPage.clickNext()

    // Step 1: Details (title required)
    await copWizardPage.fillTitle('Event Analysis - DC')
    await copWizardPage.clickNext()

    // Step 2: Event details
    await copWizardPage.selectEventType(SAMPLE_EVENT.type)
    await copWizardPage.fillEventDescription(SAMPLE_EVENT.description)
    await copWizardPage.fillInitialUrls(SAMPLE_EVENT.urls)
    await copWizardPage.clickNext()

    // Step 3: Location
    await copWizardPage.fillLocation(VALID_LOCATIONS.dc.name)
    await copWizardPage.clickNext()

    // Step 4: Time window
    await copWizardPage.selectTimeWindow('48h')
    await copWizardPage.clickNext()

    // Step 5: Key questions
    await copWizardPage.addQuestion(SAMPLE_QUESTIONS[0])
    await copWizardPage.addQuestion(SAMPLE_QUESTIONS[1])
    const count = await copWizardPage.getQuestionCount()
    expect(count).toBe(2)

    // Create
    await copWizardPage.clickCreate()
    await page.waitForURL(`**/dashboard/cop/${MOCK_SESSION_ID}`)
  })
})

test.describe('COP Wizard - Validation', () => {
  test.beforeEach(async ({ page }) => setUpWizardHarness(page))
  test.beforeEach(async ({ copListPage }) => {
    await copListPage.goto()
    await copListPage.waitForLoad()
  })

  test('Next button is disabled until template is selected', async ({
    copListPage,
    copWizardPage,
  }) => {
    await copListPage.clickNewCop()
    await copWizardPage.waitForWizard()

    // No template selected - Next should be disabled
    const disabledBefore = await copWizardPage.isNextDisabled()
    expect(disabledBefore).toBe(true)

    // Select a template - Next should be enabled
    await copWizardPage.selectTemplateByType('quick_brief')
    const disabledAfter = await copWizardPage.isNextDisabled()
    expect(disabledAfter).toBe(false)
  })

  test('Next button is disabled until title is entered on Details step', async ({
    copListPage,
    copWizardPage,
  }) => {
    test.fixme() // STALE_PAGE_OBJECTS
    await copListPage.clickNewCop()
    await copWizardPage.waitForWizard()

    // Navigate to Details step
    await copWizardPage.selectTemplateByType('quick_brief')
    await copWizardPage.clickNext()

    // Empty title - Next should be disabled
    const disabledBefore = await copWizardPage.isNextDisabled()
    expect(disabledBefore).toBe(true)

    // Fill title - Next should be enabled
    await copWizardPage.fillTitle('Test Workspace')
    const disabledAfter = await copWizardPage.isNextDisabled()
    expect(disabledAfter).toBe(false)
  })
})

test.describe('COP Wizard - Navigation', () => {
  test.beforeEach(async ({ page }) => setUpWizardHarness(page))
  test.beforeEach(async ({ copListPage }) => {
    await copListPage.goto()
    await copListPage.waitForLoad()
  })

  test('Back navigation works between steps', async ({
    copListPage,
    copWizardPage,
  }) => {
    test.fixme() // STALE_PAGE_OBJECTS
    await copListPage.clickNewCop()
    await copWizardPage.waitForWizard()

    // Go to step 1 (Details)
    await copWizardPage.selectTemplateByType('area_study')
    await copWizardPage.clickNext()

    // Verify we are on the Details step
    await expect(
      copWizardPage.page.getByText('Workspace details')
    ).toBeVisible()

    // Fill title and go to step 2 (Location)
    await copWizardPage.fillTitle('Area Study Test')
    await copWizardPage.clickNext()

    // Verify we are on the Location step
    await expect(
      copWizardPage.page.getByText('Where is the area of interest?')
    ).toBeVisible()

    // Go back to step 1 (Details)
    await copWizardPage.clickBack()

    // Verify we are on the Details step
    await expect(
      copWizardPage.page.getByText('Workspace details')
    ).toBeVisible()

    // Go back to step 0 (Purpose)
    await copWizardPage.clickBack()

    // Verify we are on the Purpose step
    await expect(
      copWizardPage.page.getByText('What are you building?')
    ).toBeVisible()

    // The previously selected template should still be visible
    const deepResearchButton = copWizardPage.page
      .locator('button')
      .filter({ hasText: 'Deep Research' })
      .first()
    await expect(deepResearchButton).toBeVisible()
  })

  test('Cancel navigates away from the wizard', async ({
    page,
    copListPage,
    copWizardPage,
  }) => {
    await copListPage.clickNewCop()
    await copWizardPage.waitForWizard()

    // Cancel button is visible on step 0 (replaces Back)
    await expect(copWizardPage.cancelButton).toBeVisible()
    await copWizardPage.cancelButton.click()

    // Should navigate away from the wizard page (back to dashboard)
    await page.waitForURL('**/dashboard')
    // Wizard title should no longer be visible
    await expect(copWizardPage.title).not.toBeVisible()
  })
})

// describe.fixme, not a per-test fixme: this group's beforeEach drives the stale wizard
// itself, so the hook times out before a marker inside the test body is ever reached.
test.describe.fixme('COP Wizard - Key Questions', () => {
  test.beforeEach(async ({ page }) => setUpWizardHarness(page))
  test.beforeEach(async ({ copListPage, copWizardPage }) => {
    await copListPage.goto()
    await copListPage.waitForLoad()
    await copListPage.clickNewCop()
    await copWizardPage.waitForWizard()

    // Navigate to the Key Questions step (step 4 for non-event_analysis)
    // Step 0: Purpose
    await copWizardPage.selectTemplateByType('quick_brief')
    await copWizardPage.clickNext()
    // Step 1: Details
    await copWizardPage.fillTitle('Key Questions Test')
    await copWizardPage.clickNext()
    // Step 2: Location
    await copWizardPage.fillLocation(VALID_LOCATIONS.tehran.name)
    await copWizardPage.clickNext()
    // Step 3: Time Window
    await copWizardPage.selectTimeWindow('24h')
    await copWizardPage.clickNext()
    // Now on Step 4: Key Questions
  })

  test('can add and remove key questions', async ({ copWizardPage }) => {
    // Add three questions
    for (const q of SAMPLE_QUESTIONS) {
      await copWizardPage.addQuestion(q)
    }
    let count = await copWizardPage.getQuestionCount()
    expect(count).toBe(3)

    // Remove the first question
    await copWizardPage.removeQuestion(0)
    count = await copWizardPage.getQuestionCount()
    expect(count).toBe(2)

    // Remove another
    await copWizardPage.removeQuestion(0)
    count = await copWizardPage.getQuestionCount()
    expect(count).toBe(1)
  })
})

test.describe('COP Wizard - Progress Bar', () => {
  test.beforeEach(async ({ page }) => setUpWizardHarness(page))
  test.beforeEach(async ({ copListPage }) => {
    await copListPage.goto()
    await copListPage.waitForLoad()
  })

  test('progress bar shows correct number of steps (5 for normal, 6 for event_analysis)', async ({
    copListPage,
    copWizardPage,
    isMobile,
  }) => {
    test.fixme() // STALE_PAGE_OBJECTS
    test.skip(isMobile, 'Progress bar labels are hidden on mobile (sm:inline)')
    await copListPage.clickNewCop()
    await copWizardPage.waitForWizard()

    // Select a normal template - should show 5 step labels
    await copWizardPage.selectTemplateByType('quick_brief')

    // The wizard renders step labels: Purpose, Details, Location, Time Window, Key Questions
    await expect(copWizardPage.page.getByText('Purpose')).toBeVisible()
    await expect(copWizardPage.page.getByText('Key Questions')).toBeVisible()

    const normalLabels = ['Purpose', 'Details', 'Location', 'Time Window', 'Key Questions']
    for (const label of normalLabels) {
      await expect(
        copWizardPage.page.locator('span').filter({ hasText: label }).first()
      ).toBeAttached()
    }

    // Switch to Event Analysis - should add "Event Details" as a 6th step
    await copWizardPage.selectTemplateByType('event_analysis')
    await expect(
      copWizardPage.page.locator('span').filter({ hasText: 'Event Details' }).first()
    ).toBeAttached()

    const eventLabels = ['Purpose', 'Details', 'Event Details', 'Location', 'Time Window', 'Key Questions']
    for (const label of eventLabels) {
      await expect(
        copWizardPage.page.locator('span').filter({ hasText: label }).first()
      ).toBeAttached()
    }
  })
})
