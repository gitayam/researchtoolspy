import { test, expect } from '../fixtures/base-test'
import { URLS } from '../helpers/test-data'

// ── Mock data ───────────────────────────────────────────────────────

const SESSION_ID = 'ws-test-001'

const mockWorkspaceSession = {
  id: SESSION_ID,
  name: 'Iran Bus Geoguess',
  template_type: 'event_analysis',
  active_layers: ['places', 'events', 'cop-markers'],
  center_lat: 35.6892,
  center_lon: 51.389,
  zoom: 8,
  key_questions: [
    'Where was the bus photo taken?',
    'Who is @lanaraae?',
  ],
  mission_brief: 'Geoguess the bus and identify persona @lanaraae',
  created_at: '2026-03-06T00:00:00Z',
  updated_at: '2026-03-08T10:00:00Z',
}

const mockStats = {
  evidence_count: 12,
  entity_count: 5,
  relationship_count: 3,
  framework_count: 2,
  open_questions: 4,
  blocker_count: 0,
}

const mockStatsWithBlockers = {
  ...mockStats,
  blocker_count: 2,
}

const mockBlockerRfis = [
  {
    id: 'rfi-blocker-1',
    question: 'Need exact GPS coordinates of the bus stop',
    priority: 'critical',
    status: 'open',
    is_blocker: 1,
    created_at: '2026-03-08T09:00:00Z',
  },
  {
    id: 'rfi-blocker-2',
    question: 'Awaiting OSINT confirmation of persona identity',
    priority: 'high',
    status: 'open',
    is_blocker: 1,
    created_at: '2026-03-08T09:30:00Z',
  },
]

const mockEvidenceItems = [
  {
    id: 'ev-001',
    type: 'evidence',
    evidence_type: 'digital',
    title: 'Bus photo from Twitter post',
    description: 'Photo showing a city bus with Farsi text on the side.',
    url: 'https://example.com/bus-photo.jpg',
    created_at: '2026-03-08T08:00:00Z',
  },
  {
    id: 'ev-002',
    type: 'evidence',
    evidence_type: 'digital',
    title: 'Google Maps street view match',
    description: 'Street view match for intersection near Vali-Asr square.',
    url: 'https://example.com/streetview',
    created_at: '2026-03-08T08:30:00Z',
  },
  {
    id: 'ev-003',
    type: 'url',
    title: 'Twitter profile analysis',
    description: 'Profile @lanaraae shows posts from Tehran area.',
    url: 'https://twitter.com/lanaraae',
    created_at: '2026-03-08T09:00:00Z',
  },
]

const mockPersonas = [
  {
    id: 'persona-001',
    cop_session_id: SESSION_ID,
    display_name: 'LanaRaae',
    platform: 'twitter',
    handle: 'lanaraae',
    profile_url: 'https://twitter.com/lanaraae',
    status: 'active',
    linked_actor_id: null,
    notes: 'Likely based in Tehran. Posts travel content.',
    link_count: 2,
    created_at: '2026-03-07T00:00:00Z',
    updated_at: '2026-03-08T00:00:00Z',
  },
]

function mockGeoJsonCollection(count: number) {
  return {
    type: 'FeatureCollection',
    features: Array.from({ length: count }, (_, i) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [51.389 + i * 0.01, 35.689 + i * 0.01] },
      properties: { id: `feat-${i}`, name: `Feature ${i}` },
    })),
  }
}

// ── Route mocking helpers ───────────────────────────────────────────

interface MockOptions {
  blockers?: boolean
  emptyPersonas?: boolean
  emptyEvidence?: boolean
}

async function mockWorkspaceRoutes(
  page: import('@playwright/test').Page,
  opts: MockOptions = {},
) {
  // Session fetch
  await page.route(`**/api/cop/sessions/${SESSION_ID}`, (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ status: 200, json: { session: mockWorkspaceSession } })
    }
    return route.fulfill({ status: 200, json: { ok: true } })
  })

  // Stats endpoint
  await page.route(`**/api/cop/${SESSION_ID}/stats`, (route) =>
    route.fulfill({
      status: 200,
      json: { stats: opts.blockers ? mockStatsWithBlockers : mockStats },
    }),
  )

  // RFIs (used by blocker strip and RFI tab)
  await page.route(`**/api/cop/${SESSION_ID}/rfis`, (route) => {
    if (route.request().method() === 'POST') {
      return route.fulfill({ status: 201, json: { id: 'rfi-new', ok: true } })
    }
    return route.fulfill({
      status: 200,
      json: { rfis: opts.blockers ? mockBlockerRfis : [] },
    })
  })

  // Hypotheses
  await page.route(`**/api/cop/${SESSION_ID}/hypotheses`, (route) => {
    if (route.request().method() === 'POST') {
      return route.fulfill({ status: 201, json: { id: 'hyp-new', ok: true } })
    }
    return route.fulfill({ status: 200, json: { hypotheses: [] } })
  })

  // Personas
  await page.route(`**/api/cop/${SESSION_ID}/personas`, (route) => {
    if (route.request().method() === 'POST') {
      return route.fulfill({ status: 201, json: { id: 'persona-new', ok: true } })
    }
    return route.fulfill({
      status: 200,
      json: { personas: opts.emptyPersonas ? [] : mockPersonas },
    })
  })

  // COP-scoped evidence (capture bar posts here for notes)
  await page.route(`**/api/cop/${SESSION_ID}/evidence**`, (route) => {
    if (route.request().method() === 'POST') {
      return route.fulfill({ status: 201, json: { id: 'ev-new', ok: true } })
    }
    return route.fulfill({
      status: 200,
      json: { evidence: opts.emptyEvidence ? [] : mockEvidenceItems },
    })
  })

  // Global evidence (legacy)
  await page.route(`**/api/evidence**`, (route) => {
    if (route.request().method() === 'POST') {
      return route.fulfill({ status: 201, json: { id: 'ev-new', ok: true } })
    }
    return route.fulfill({
      status: 200,
      json: { evidence: opts.emptyEvidence ? [] : mockEvidenceItems },
    })
  })

  // Content intelligence (URL analysis)
  await page.route('**/api/content-intelligence/analyze-url', (route) =>
    route.fulfill({
      status: 200,
      json: {
        id: 'analysis-new',
        title: 'Analyzed page title',
        summary: 'Summary of the analyzed page.',
      },
    }),
  )

  // Layer data
  await page.route(`**/api/cop/${SESSION_ID}/layers/**`, (route) =>
    route.fulfill({ status: 200, json: mockGeoJsonCollection(3) }),
  )

  // Markers (pin placement)
  await page.route(`**/api/cop/${SESSION_ID}/markers`, (route) =>
    route.fulfill({ status: 201, json: { id: 'marker-new', ok: true } }),
  )

  // Activity
  await page.route(`**/api/cop/${SESSION_ID}/activity`, (route) =>
    route.fulfill({ status: 200, json: { activities: [] } }),
  )

  // CoT export
  await page.route(`**/api/cop/${SESSION_ID}/cot`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/xml', body: '<event/>' }),
  )

  // Relationships endpoint (for entity graph)
  await page.route(`**/api/cop/${SESSION_ID}/layers/relationships`, (route) =>
    route.fulfill({ status: 200, json: { nodes: [], edges: [] } }),
  )

  // Entity endpoints (used by CopEntitiesPanel)
  for (const entity of ['actors', 'sources', 'events', 'places', 'behaviors']) {
    await page.route(`**/api/${entity}**`, (route) =>
      route.fulfill({ status: 200, json: { [entity]: [] } }),
    )
  }

  // Tasks endpoint (used by CopTaskBoard)
  await page.route(`**/api/cop/${SESSION_ID}/tasks**`, (route) =>
    route.fulfill({ status: 200, json: { tasks: [] } }),
  )

  // Block external tile/font requests to prevent networkidle hang
  await page.route(/\.(pbf|mvt|png|jpg|glyphs)(\?.*)?$/, (route) => route.abort())
  await page.route('**/tiles/**', (route) => route.abort())

  // Gap analysis
  await page.route(`**/api/cop/${SESSION_ID}/gap-analysis**`, (route) =>
    route.fulfill({ status: 200, json: { gaps: [] } }),
  )

  // Frameworks (for questions tab)
  await page.route('**/api/frameworks/**', (route) =>
    route.fulfill({ status: 200, json: { questions: [] } }),
  )
}

// =====================================================================
// Navigation & Layout
// =====================================================================

test.describe('COP Workspace -- Navigation & Layout', () => {
  test.beforeEach(async ({ page }) => {
    await mockWorkspaceRoutes(page)
  })

  test('@smoke page loads and shows session name in header', async ({ copWorkspacePage }) => {
    await copWorkspacePage.goto(SESSION_ID)
    await copWorkspacePage.waitForLoad()

    await expect(copWorkspacePage.sessionName).toBeVisible()
    await expect(copWorkspacePage.sessionName).toHaveText(mockWorkspaceSession.name)
  })

  test('@smoke header shows mode toggle, action buttons', async ({ copWorkspacePage }) => {
    await copWorkspacePage.goto(SESSION_ID)
    await copWorkspacePage.waitForLoad()

    // Mode toggle buttons
    await expect(copWorkspacePage.progressModeButton).toBeVisible()
    await expect(copWorkspacePage.monitorModeButton).toBeVisible()

    // Action buttons
    await expect(copWorkspacePage.inviteButton).toBeVisible()
    await expect(copWorkspacePage.shareButton).toBeVisible()
    await expect(copWorkspacePage.cotExportButton).toBeVisible()
  })

  test('@smoke status strip renders with KPI badges', async ({ copWorkspacePage }) => {
    await copWorkspacePage.goto(SESSION_ID)
    await copWorkspacePage.waitForLoad()

    // Mission Brief label should appear
    await expect(copWorkspacePage.page.getByText('Mission Brief:')).toBeVisible()

    // KPI badges from stats -- evidence, entities, relationships, analyses, open questions
    // We check that at least some numeric badges are visible
    await expect(copWorkspacePage.page.getByText('12').first()).toBeVisible({ timeout: 10000 })
  })

  test('@smoke progress mode renders all panels', async ({ copWorkspacePage, isMobile }) => {
    await copWorkspacePage.goto(SESSION_ID)
    await copWorkspacePage.waitForLoad()

    // All panel titles should be visible in progress mode
    const panelTitles = [
      'Entity Relationships',
      'Timeline',
      'Key Questions & RFIs',
      'Analysis & Hypotheses',
      'Evidence & Intel Feed',
      'Activity Log',
    ]

    for (const title of panelTitles) {
      await expect(
        copWorkspacePage.page.getByText(title, { exact: true }).first(),
      ).toBeVisible()
    }

    // "Actors" panel — check h3 heading to avoid matching Entities panel button
    await expect(
      copWorkspacePage.page.getByRole('heading', { name: 'Actors', level: 3 }),
    ).toBeVisible()
  })

  test('switching to Monitor mode changes layout', async ({ copWorkspacePage }) => {
    await copWorkspacePage.goto(SESSION_ID)
    await copWorkspacePage.waitForLoad()

    // Switch to monitor mode
    await copWorkspacePage.switchToMonitorMode()

    // Monitor mode should show Evidence & Intel Feed prominently
    await expect(
      copWorkspacePage.page.getByText('Evidence & Intel Feed').first(),
    ).toBeVisible()

    // Monitor mode should show Intel & Hypotheses (not "Key Questions & RFIs")
    await expect(
      copWorkspacePage.page.getByText('Intel & Hypotheses').first(),
    ).toBeVisible()

    // Entity Relationships panel should NOT be visible in monitor mode
    await expect(
      copWorkspacePage.page.getByText('Entity Relationships', { exact: true }),
    ).not.toBeVisible()
  })

  test('switching back to Progress mode restores full panel grid', async ({ copWorkspacePage }) => {
    await copWorkspacePage.goto(SESSION_ID)
    await copWorkspacePage.waitForLoad()

    await copWorkspacePage.switchToMonitorMode()
    await copWorkspacePage.switchToProgressMode()

    await expect(
      copWorkspacePage.page.getByText('Entity Relationships', { exact: true }),
    ).toBeVisible()
  })

  test('back button navigates to /dashboard/cop', async ({ copWorkspacePage, isMobile }) => {
    test.skip(isMobile, 'Back text is hidden on mobile (md:inline)')

    await copWorkspacePage.goto(SESSION_ID)
    await copWorkspacePage.waitForLoad()

    await copWorkspacePage.backButton.click()
    await copWorkspacePage.page.waitForURL('**/dashboard/cop')
    expect(copWorkspacePage.page.url()).toContain('/dashboard/cop')
  })
})

// =====================================================================
// Command Palette (Quick Capture)
// =====================================================================

test.describe('COP Workspace -- Command Palette', () => {
  test.beforeEach(async ({ page }) => {
    await mockWorkspaceRoutes(page)
  })

  test('@smoke capture bar is visible with input and submit button', async ({ copWorkspacePage }) => {
    await copWorkspacePage.goto(SESSION_ID)
    await copWorkspacePage.waitForLoad()

    // The global capture bar should always be visible
    await expect(copWorkspacePage.captureBar).toBeVisible()
    await expect(copWorkspacePage.captureInput).toBeVisible()
    await expect(copWorkspacePage.captureSubmitButton).toBeVisible()
  })

  test('Cmd/Ctrl+K focuses the capture input', async ({ copWorkspacePage }) => {
    await copWorkspacePage.goto(SESSION_ID)
    await copWorkspacePage.waitForLoad()

    // Press Cmd+K to focus the capture bar input
    await copWorkspacePage.pressCommandK()
    await expect(copWorkspacePage.captureInput).toBeFocused()
  })

  test('Escape blurs the capture input', async ({ copWorkspacePage }) => {
    await copWorkspacePage.goto(SESSION_ID)
    await copWorkspacePage.waitForLoad()

    // Focus the input first
    await copWorkspacePage.focusCaptureInput()
    await expect(copWorkspacePage.captureInput).toBeFocused()

    // Escape should blur the input
    await copWorkspacePage.pressEscape()
    await expect(copWorkspacePage.captureInput).not.toBeFocused()
  })

  test('capture bar shows keyboard hint when input is empty', async ({ copWorkspacePage }) => {
    await copWorkspacePage.goto(SESSION_ID)
    await copWorkspacePage.waitForLoad()

    // Keyboard hint is hidden on mobile (< sm breakpoint) — only test on desktop
    const viewport = copWorkspacePage.page.viewportSize()
    if (viewport && viewport.width < 640) return

    // When input is empty, the Cmd+K keyboard hint should be visible
    await expect(copWorkspacePage.captureKeyboardHint).toBeVisible()

    // When input has text, the hint should be hidden
    await copWorkspacePage.typeCaptureInput('some text')
    await expect(copWorkspacePage.captureKeyboardHint).not.toBeVisible()

    // Clearing input should bring the hint back
    await copWorkspacePage.clearCaptureInput()
    await expect(copWorkspacePage.captureKeyboardHint).toBeVisible()
  })

  test('typing a URL shows "Evidence Feed (URL Analysis)" routing', async ({ copWorkspacePage }) => {
    await copWorkspacePage.goto(SESSION_ID)
    await copWorkspacePage.waitForLoad()

    await copWorkspacePage.typeCaptureInput('https://example.com/article')

    // Should show routing label for URL analysis
    await expect(
      copWorkspacePage.captureBar.getByText('Evidence Feed (URL Analysis)'),
    ).toBeVisible()
  })

  test('typing hypothesis: prefix shows "Hypothesis Ledger" routing', async ({ copWorkspacePage }) => {
    await copWorkspacePage.goto(SESSION_ID)
    await copWorkspacePage.waitForLoad()

    await copWorkspacePage.typeCaptureInput('Hypothesis: The bus is on Vali-Asr avenue')

    // Should show routing label for hypothesis
    await expect(
      copWorkspacePage.captureBar.getByText('Hypothesis Ledger'),
    ).toBeVisible()
  })

  test('typing free text shows "Evidence Feed (Quick Note)" routing', async ({ copWorkspacePage }) => {
    await copWorkspacePage.goto(SESSION_ID)
    await copWorkspacePage.waitForLoad()

    await copWorkspacePage.typeCaptureInput('Farsi signage visible on bus')

    // Should show routing label for quick note
    await expect(
      copWorkspacePage.captureBar.getByText('Evidence Feed (Quick Note)'),
    ).toBeVisible()
  })

  test('submitting a note clears the input', async ({ copWorkspacePage }) => {
    await copWorkspacePage.goto(SESSION_ID)
    await copWorkspacePage.waitForLoad()

    await copWorkspacePage.typeCaptureInput('Bus has blue paint')
    await copWorkspacePage.submitCapture()

    // After successful submission, input should be cleared
    await expect(copWorkspacePage.captureInput).toHaveValue('', { timeout: 5000 })
  })

  test('routing hint shows Cmd+Enter to send', async ({ copWorkspacePage }) => {
    await copWorkspacePage.goto(SESSION_ID)
    await copWorkspacePage.waitForLoad()

    await copWorkspacePage.typeCaptureInput('Some intel note')

    // Should show Cmd+Enter hint when text is present
    await expect(
      copWorkspacePage.captureBar.getByText('Cmd+Enter to send'),
    ).toBeVisible()
  })
})

// =====================================================================
// Keyboard Shortcuts
// =====================================================================

test.describe('COP Workspace -- Keyboard Shortcuts', () => {
  test.beforeEach(async ({ page }) => {
    await mockWorkspaceRoutes(page)
  })

  test('Cmd/Ctrl+M toggles map panel visibility in monitor mode', async ({ copWorkspacePage }) => {
    await copWorkspacePage.goto(SESSION_ID)
    await copWorkspacePage.waitForLoad()

    // Map is always visible in Progress mode
    await expect(copWorkspacePage.page.getByText('Map', { exact: true }).first()).toBeVisible()

    // Switch to Monitor mode where map toggle works
    await copWorkspacePage.switchToMonitorMode()

    // Toggle map off
    await copWorkspacePage.pressCommandM()
    // "Show Map Panel" placeholder button should now appear in monitor mode
    await expect(copWorkspacePage.showMapButton).toBeVisible()

    // Toggle map back on
    await copWorkspacePage.pressCommandM()
    await expect(copWorkspacePage.showMapButton).not.toBeVisible()
  })

  test('Cmd/Ctrl+1 switches to Progress mode', async ({ copWorkspacePage }) => {
    await copWorkspacePage.goto(SESSION_ID)
    await copWorkspacePage.waitForLoad()

    // First switch to monitor mode via click
    await copWorkspacePage.switchToMonitorMode()
    await expect(
      copWorkspacePage.page.getByText('Entity Relationships', { exact: true }),
    ).not.toBeVisible()

    // Press Cmd+1 to switch back to progress
    await copWorkspacePage.pressCommand1()
    await expect(
      copWorkspacePage.page.getByText('Entity Relationships', { exact: true }),
    ).toBeVisible()
  })

  test('Cmd/Ctrl+2 switches to Monitor mode', async ({ copWorkspacePage }) => {
    await copWorkspacePage.goto(SESSION_ID)
    await copWorkspacePage.waitForLoad()

    // Should be in progress mode by default
    await expect(
      copWorkspacePage.page.getByText('Entity Relationships', { exact: true }),
    ).toBeVisible()

    // Press Cmd+2 to switch to monitor
    await copWorkspacePage.pressCommand2()
    await expect(
      copWorkspacePage.page.getByText('Entity Relationships', { exact: true }),
    ).not.toBeVisible()
    await expect(
      copWorkspacePage.page.getByText('Intel & Hypotheses').first(),
    ).toBeVisible()
  })
})

// =====================================================================
// Blocker Strip
// =====================================================================

test.describe('COP Workspace -- Blocker Strip', () => {
  test('blocker strip does NOT render when no blockers exist', async ({ page, copWorkspacePage }) => {
    await mockWorkspaceRoutes(page, { blockers: false })

    await copWorkspacePage.goto(SESSION_ID)
    await copWorkspacePage.waitForLoad()

    // Wait for data to load, then assert no blocker strip
    await copWorkspacePage.page.waitForTimeout(1000)
    await expect(copWorkspacePage.blockerStrip).not.toBeVisible()
  })

  test('blocker strip renders when blocker RFIs exist', async ({ page, copWorkspacePage }) => {
    await mockWorkspaceRoutes(page, { blockers: true })

    await copWorkspacePage.goto(SESSION_ID)
    await copWorkspacePage.waitForLoad()

    // Blocker strip should appear
    await expect(copWorkspacePage.blockerStrip).toBeVisible({ timeout: 10000 })

    // Should show "Blocker" label (exact match to avoid matching "Go to Blocker" buttons)
    await expect(copWorkspacePage.blockerStrip.getByText('Blocker', { exact: true })).toBeVisible()

    // Should show the blocker question text
    await expect(
      copWorkspacePage.blockerStrip.getByText('Need exact GPS coordinates', { exact: false }),
    ).toBeVisible()

    // Should show Go to Blocker button(s)
    await expect(copWorkspacePage.blockerResolveButtons.first()).toBeVisible()
  })

  test('blocker strip shows aria-label with blocker count', async ({ page, copWorkspacePage }) => {
    await mockWorkspaceRoutes(page, { blockers: true })

    await copWorkspacePage.goto(SESSION_ID)
    await copWorkspacePage.waitForLoad()

    await expect(copWorkspacePage.blockerStrip).toBeVisible({ timeout: 10000 })
    await expect(copWorkspacePage.blockerStrip).toHaveAttribute(
      'aria-label',
      /2 active blockers/,
    )
  })
})

// =====================================================================
// Evidence Feed
// =====================================================================

test.describe('COP Workspace -- Evidence Feed', () => {
  test.beforeEach(async ({ page }) => {
    await mockWorkspaceRoutes(page)
  })

  test('@smoke evidence feed loads with items', async ({ copWorkspacePage }) => {
    await copWorkspacePage.goto(SESSION_ID)
    await copWorkspacePage.waitForLoad()

    // Evidence panel title
    await expect(copWorkspacePage.evidenceFeedHeader).toBeVisible()

    // Should show evidence items (wait for fetch to complete)
    // .first() because three-column layout renders Evidence Feed twice
    await expect(
      copWorkspacePage.page.getByText('Bus photo from Twitter post').first(),
    ).toBeVisible({ timeout: 10000 })
  })

  test('gallery/feed view toggles change layout', async ({ copWorkspacePage }) => {
    await copWorkspacePage.goto(SESSION_ID)
    await copWorkspacePage.waitForLoad()

    // Feed view button should have active styling by default
    await expect(copWorkspacePage.feedViewButton).toBeVisible()
    await expect(copWorkspacePage.galleryViewButton).toBeVisible()

    // Click gallery view
    await copWorkspacePage.switchToGalleryView()
    // Gallery view renders a grid inside the evidence panel; scope to evidence panel
    const evidenceSection = copWorkspacePage.page.locator('[data-panel="evidence"]').or(
      copWorkspacePage.page.getByText('Evidence & Intel Feed').locator('..').locator('..').locator('..')
    ).first()
    const galleryGrid = evidenceSection.locator('div.grid.grid-cols-2').first()
    const galleryEmpty = evidenceSection.getByText('No visual evidence yet')
    await expect(galleryGrid.or(galleryEmpty)).toBeVisible()

    // Switch back to feed view
    await copWorkspacePage.switchToFeedView()
    // Should show evidence items again in list layout (.first() for dual-render)
    await expect(
      copWorkspacePage.page.getByText('Bus photo from Twitter post').first(),
    ).toBeVisible()
  })

  test('evidence type filter buttons are present', async ({ copWorkspacePage }) => {
    await copWorkspacePage.goto(SESSION_ID)
    await copWorkspacePage.waitForLoad()

    // Filter buttons: All, Evidence, Analysis, Entity, URL Analysis
    const filterLabels = ['All', 'Evidence', 'Analysis', 'Entity', 'URL Analysis']
    for (const label of filterLabels) {
      await expect(
        copWorkspacePage.page.getByRole('button', { name: new RegExp(label, 'i') }).first(),
      ).toBeVisible()
    }
  })

  test('pin to map buttons appear on evidence items', async ({ copWorkspacePage }) => {
    await copWorkspacePage.goto(SESSION_ID)
    await copWorkspacePage.waitForLoad()

    // Evidence items should have MapPin buttons
    const pinButtons = copWorkspacePage.page.locator('button[title="Pin to map"]')
    // At least one pin button should be visible
    await expect(pinButtons.first()).toBeVisible({ timeout: 10000 })
  })

  test('URL input field exists for evidence submission', async ({ copWorkspacePage }) => {
    await copWorkspacePage.goto(SESSION_ID)
    await copWorkspacePage.waitForLoad()

    await expect(copWorkspacePage.evidenceUrlInput).toBeVisible()
    await expect(copWorkspacePage.evidenceUrlInput).toHaveAttribute(
      'placeholder',
      /Paste URL to analyze/,
    )
  })
})

// =====================================================================
// Persona Panel
// =====================================================================

test.describe('COP Workspace -- Actors Panel', () => {
  test.beforeEach(async ({ page }) => {
    await mockWorkspaceRoutes(page)
  })

  test('@smoke actors panel renders in progress layout', async ({ copWorkspacePage }) => {
    await copWorkspacePage.goto(SESSION_ID)
    await copWorkspacePage.waitForLoad()

    // "Actors" panel h3 heading visible (not the Entities panel button)
    await expect(
      copWorkspacePage.page.getByRole('heading', { name: 'Actors', level: 3 }),
    ).toBeVisible()
  })

  test('persona panel shows existing personas', async ({ copWorkspacePage }) => {
    await copWorkspacePage.goto(SESSION_ID)
    await copWorkspacePage.waitForLoad()

    // Should show the mock persona name (use role to scope to the persona button)
    await expect(
      copWorkspacePage.page.getByRole('button', { name: /LanaRaae/ }).first(),
    ).toBeVisible({ timeout: 10000 })

    // Should show the handle within the persona button
    await expect(
      copWorkspacePage.page.getByRole('button', { name: /lanaraae/ }).first(),
    ).toBeVisible()
  })

  test('Add Persona button opens inline form', async ({ copWorkspacePage }) => {
    await copWorkspacePage.goto(SESSION_ID)
    await copWorkspacePage.waitForLoad()

    // Click Add Persona
    await copWorkspacePage.clickAddPersona()

    // Form fields should appear
    await expect(copWorkspacePage.personaFormNameInput).toBeVisible()
    await expect(copWorkspacePage.personaFormHandleInput).toBeVisible()
    await expect(copWorkspacePage.personaFormCreateButton).toBeVisible()
    await expect(copWorkspacePage.personaFormCancelButton).toBeVisible()
  })

  test('persona form can be filled and has create/cancel buttons', async ({ copWorkspacePage }) => {
    await copWorkspacePage.goto(SESSION_ID)
    await copWorkspacePage.waitForLoad()

    await copWorkspacePage.clickAddPersona()

    // Fill the form
    await copWorkspacePage.fillPersonaForm({
      name: 'TestUser',
      platform: 'telegram',
      handle: 'testuser',
      notes: 'A test persona for E2E',
    })

    // Verify fields have values
    await expect(copWorkspacePage.personaFormNameInput).toHaveValue('TestUser')
    await expect(copWorkspacePage.personaFormHandleInput).toHaveValue('testuser')
    await expect(copWorkspacePage.personaFormNotesInput).toHaveValue('A test persona for E2E')

    // Create button should be enabled
    await expect(copWorkspacePage.personaFormCreateButton).toBeEnabled()
  })

  test('cancel button hides the persona form', async ({ copWorkspacePage }) => {
    await copWorkspacePage.goto(SESSION_ID)
    await copWorkspacePage.waitForLoad()

    await copWorkspacePage.clickAddPersona()
    await expect(copWorkspacePage.personaFormNameInput).toBeVisible()

    await copWorkspacePage.personaFormCancelButton.click()
    await expect(copWorkspacePage.personaFormNameInput).not.toBeVisible()
  })

  test('empty persona panel shows placeholder text', async ({ page, copWorkspacePage }) => {
    await mockWorkspaceRoutes(page, { emptyPersonas: true })

    await copWorkspacePage.goto(SESSION_ID)
    await copWorkspacePage.waitForLoad()

    await expect(copWorkspacePage.personaEmptyState).toBeVisible({ timeout: 10000 })
  })
})

// =====================================================================
// Pin to Map
// =====================================================================

test.describe('COP Workspace -- Pin to Map', () => {
  test.beforeEach(async ({ page }) => {
    await mockWorkspaceRoutes(page)
  })

  test('clicking Pin to Map ensures map panel is visible', async ({ copWorkspacePage }) => {
    await copWorkspacePage.goto(SESSION_ID)
    await copWorkspacePage.waitForLoad()

    // In Progress mode, map is always visible — verify it's there
    await expect(copWorkspacePage.page.getByText('Map', { exact: true }).first()).toBeVisible()

    // Click a pin-to-map button on evidence
    const pinButton = copWorkspacePage.page.locator('button[title="Pin to map"]').first()
    await expect(pinButton).toBeVisible({ timeout: 10000 })
    await pinButton.click()

    // Map panel should still be visible after pin action
    await expect(copWorkspacePage.page.getByText('Map', { exact: true }).first()).toBeVisible()
  })
})

// =====================================================================
// Mission Brief (Status Strip)
// =====================================================================

test.describe('COP Workspace -- Mission Brief', () => {
  test.beforeEach(async ({ page }) => {
    await mockWorkspaceRoutes(page)
  })

  test('mission brief text is displayed in status strip', async ({ copWorkspacePage }) => {
    await copWorkspacePage.goto(SESSION_ID)
    await copWorkspacePage.waitForLoad()

    // The mission brief from mock data should be visible
    await expect(
      copWorkspacePage.page.getByText('Geoguess the bus', { exact: false }),
    ).toBeVisible({ timeout: 10000 })
  })

  test('clicking mission brief opens edit mode', async ({ copWorkspacePage }) => {
    await copWorkspacePage.goto(SESSION_ID)
    await copWorkspacePage.waitForLoad()

    // Click on the mission brief text area to trigger edit
    const briefArea = copWorkspacePage.page.getByText('Geoguess the bus', { exact: false })
    await briefArea.click()

    // Should switch to input mode
    await expect(copWorkspacePage.missionBriefInput).toBeVisible({ timeout: 5000 })
  })
})

// =====================================================================
// Error & Edge Cases
// =====================================================================

test.describe('COP Workspace -- Error Handling', () => {
  test('shows error state when session fetch fails', async ({ page, copWorkspacePage }) => {
    await page.route(`**/api/cop/sessions/bad-session`, (route) =>
      route.fulfill({ status: 404, json: { error: 'Not found' } }),
    )

    await copWorkspacePage.goto('bad-session')
    await copWorkspacePage.waitForLoad()

    // Error banner should appear
    await expect(copWorkspacePage.errorBanner).toBeVisible()
  })

  test('shows loading spinner during session fetch', async ({ page, copWorkspacePage }) => {
    // Delay the session response
    await page.route(`**/api/cop/sessions/${SESSION_ID}`, async (route) => {
      await new Promise((r) => setTimeout(r, 2000))
      return route.fulfill({ status: 200, json: { session: mockWorkspaceSession } })
    })

    await copWorkspacePage.goto(SESSION_ID)

    // Loading spinner should be visible briefly
    await expect(copWorkspacePage.loadingSpinner).toBeVisible({ timeout: 3000 })
  })
})
