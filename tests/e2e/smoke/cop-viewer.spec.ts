import { test, expect } from '../fixtures/base-test'
import { URLS, TEMPLATES } from '../helpers/test-data'

// ── Mock data ───────────────────────────────────────────────────────

const MOCK_SESSION_ID = 'test-session-001'

const mockEventMonitorSession = {
  id: MOCK_SESSION_ID,
  name: 'Test Event Monitor',
  template_type: 'event_monitor',
  active_layers: ['places', 'events', 'acled'],
  center_lat: 35.6892,
  center_lon: 51.389,
  zoom: 8,
  key_questions: ['What is the current threat level?', 'Who are the key actors?'],
  created_at: '2026-03-01T00:00:00Z',
  updated_at: '2026-03-01T00:00:00Z',
}

const mockEventAnalysisSession = {
  ...mockEventMonitorSession,
  id: 'test-session-002',
  name: 'Test Event Analysis',
  template_type: 'event_analysis',
  active_layers: ['places', 'events', 'acled', 'cop-markers'],
}

function mockGeoJsonCollection(featureCount: number) {
  return {
    type: 'FeatureCollection',
    features: Array.from({ length: featureCount }, (_, i) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [51.389 + i * 0.01, 35.689 + i * 0.01] },
      properties: { id: `feat-${i}`, name: `Feature ${i}` },
    })),
  }
}

// ── Route mocking helper ────────────────────────────────────────────

async function mockCopRoutes(
  page: import('@playwright/test').Page,
  session: typeof mockEventMonitorSession,
) {
  // Session fetch
  await page.route(`**/api/cop/sessions/${session.id}`, (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ status: 200, json: { session } })
    }
    // PUT for layer toggle persistence
    return route.fulfill({ status: 200, json: { ok: true } })
  })

  // Layer data endpoints
  await page.route(`**/api/cop/${session.id}/layers/**`, (route) =>
    route.fulfill({ status: 200, json: mockGeoJsonCollection(3) }),
  )

  // RFI list (for event_analysis sidebar)
  await page.route(`**/api/cop/${session.id}/rfis`, (route) =>
    route.fulfill({ status: 200, json: { rfis: [] } }),
  )

  // CoT export
  await page.route(`**/api/cop/${session.id}/cot`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/xml',
      body: '<event/>',
    }),
  )

  // Block external tile/font requests to prevent networkidle hang
  await page.route(/\.(pbf|mvt|png|jpg|glyphs)(\?.*)?$/, (route) => route.abort())
  await page.route('**/tiles/**', (route) => route.abort())
}

// ── Event Monitor tests ─────────────────────────────────────────────

test.describe('COP Viewer — Event Monitor', () => {
  test.beforeEach(async ({ page }) => {
    await mockCopRoutes(page, mockEventMonitorSession)
  })

  test('@smoke page loads and shows session name', async ({ copViewerPage }) => {
    await copViewerPage.goto(MOCK_SESSION_ID)
    await copViewerPage.waitForLoad()

    await expect(copViewerPage.sessionName).toBeVisible()
    await expect(copViewerPage.sessionName).toHaveText(mockEventMonitorSession.name)
  })

  test('@smoke map container renders', async ({ copViewerPage }) => {
    await copViewerPage.goto(MOCK_SESSION_ID)
    await copViewerPage.waitForLoad()

    // MapLibre renders canvas, or fallback div if WebGL unavailable
    const mapElement = copViewerPage.page.locator('[data-testid="cop-map"], [data-testid="cop-map-fallback"], canvas').first()
    await expect(mapElement).toBeAttached({ timeout: 15000 })
  })

  test('@smoke header shows template badge', async ({ copViewerPage, isMobile }) => {
    test.skip(isMobile, 'Badge is hidden on mobile (sm:inline-flex)')
    await copViewerPage.goto(MOCK_SESSION_ID)
    await copViewerPage.waitForLoad()

    await expect(copViewerPage.templateBadge).toBeVisible()
    const badgeText = await copViewerPage.getTemplateBadge()
    expect(badgeText).toBe(TEMPLATES.event_monitor)
  })

  test.skip('layer panel shows categories — route now serves CopWorkspacePage (see cop-workspace.spec.ts)', () => {})
  test.skip('toggling a layer updates aria-checked state — route now serves CopWorkspacePage', () => {})
  test.skip('KPI strip shows layer and feature counts — route now uses status strip (see cop-workspace.spec.ts)', () => {})

  test('back button navigates to /dashboard/cop', async ({ copViewerPage, isMobile }) => {
    test.skip(isMobile, 'Back text is hidden on mobile (md:inline)')
    await copViewerPage.goto(MOCK_SESSION_ID)
    await copViewerPage.waitForLoad()

    await expect(copViewerPage.backButton).toBeVisible()
    await copViewerPage.clickBack()

    await copViewerPage.page.waitForURL('**/dashboard/cop')
    expect(copViewerPage.page.url()).toContain('/dashboard/cop')
  })

  test.skip('refresh button exists and is clickable — route now serves CopWorkspacePage', () => {})

  test('CoT export button opens /api/cop/:id/cot', async ({ copViewerPage, isMobile }) => {
    test.skip(isMobile, 'CoT export button is hidden on mobile (sm:inline-flex)')
    await copViewerPage.goto(MOCK_SESSION_ID)
    await copViewerPage.waitForLoad()

    await expect(copViewerPage.cotExportButton).toBeVisible()

    // The button calls window.open — intercept the popup
    const popupPromise = copViewerPage.page.waitForEvent('popup')
    await copViewerPage.clickCotExport()
    const popup = await popupPromise
    expect(popup.url()).toContain(`/api/cop/${MOCK_SESSION_ID}/cot`)
  })

  test('share button exists and is clickable', async ({ copViewerPage }) => {
    await copViewerPage.goto(MOCK_SESSION_ID)
    await copViewerPage.waitForLoad()

    await expect(copViewerPage.shareButton).toBeVisible()
    await expect(copViewerPage.shareButton).toBeEnabled()
    await copViewerPage.clickShare()
  })
})

// ── Event Analysis tests ────────────────────────────────────────────
// NOTE: Route /dashboard/cop/:id now serves CopWorkspacePage instead of CopPage.
// The old sidebar-based event analysis tests no longer apply.
// See cop-workspace.spec.ts for comprehensive workspace UI tests.

test.describe('COP Viewer — Event Analysis sidebar', () => {
  test.skip('event analysis sessions show tabbed sidebar — route now serves CopWorkspacePage', () => {})
  test.skip('clicking sidebar tabs switches content — route now serves CopWorkspacePage', () => {})
})
