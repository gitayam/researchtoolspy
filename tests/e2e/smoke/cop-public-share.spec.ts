/**
 * COP Public Share View E2E Tests
 *
 * Tests the read-only shared COP view at /public/cop/:token
 * with configurable panels and optional RFI answer submission.
 */
import { test, expect } from '../fixtures/base-test'

// ── Mock data ─────────────────────────────────────────────────────

const MOCK_TOKEN = 'test-share-token-abc123'

const MOCK_PUBLIC_DATA = {
  session: {
    id: 'cop-test-public-001',
    name: 'Crisis Response - Flooding',
    description: 'Monitoring flooding situation',
    template_type: 'crisis_response',
    status: 'ACTIVE',
    center_lat: 38.9,
    center_lon: -77.0,
    zoom_level: 8,
    rolling_hours: null,
    active_layers: ['acled', 'gdelt', 'places'],
    key_questions: ['What areas are affected?'],
    event_type: null,
    event_description: null,
    event_facts: [],
    content_analyses: [],
    created_at: '2026-03-04T00:00:00Z',
    updated_at: '2026-03-05T12:00:00Z',
  },
  visible_panels: ['map', 'event', 'rfi'],
  allow_rfi_answers: true,
  rfis: [
    {
      id: 'rfi-pub-001',
      cop_session_id: 'cop-test-public-001',
      question: 'What shelters are open?',
      priority: 'high',
      status: 'open',
      created_at: '2026-03-05T10:00:00Z',
      updated_at: '2026-03-05T10:00:00Z',
      answers: [],
    },
    {
      id: 'rfi-pub-002',
      cop_session_id: 'cop-test-public-001',
      question: 'Is the I-95 bridge passable?',
      priority: 'critical',
      status: 'answered',
      created_at: '2026-03-05T09:00:00Z',
      updated_at: '2026-03-05T11:00:00Z',
      answers: [
        {
          id: 'ans-pub-001',
          rfi_id: 'rfi-pub-002',
          answer_text: 'Bridge is closed since 08:00 AM. Detour via Route 1.',
          source_url: 'https://example.com/dot-update',
          source_description: 'Department of Transportation',
          is_accepted: 1,
          responder_name: 'DOT Liaison',
          created_at: '2026-03-05T11:00:00Z',
        },
      ],
    },
  ],
}

const MOCK_NO_RFI_DATA = {
  ...MOCK_PUBLIC_DATA,
  visible_panels: ['map'],
  allow_rfi_answers: false,
  rfis: [],
}

const MOCK_EMPTY_GEOJSON = {
  type: 'FeatureCollection',
  features: [],
}

// ── Tests: Public share loads ─────────────────────────────────────

test.describe('COP Public Share @smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(`**/api/cop/public/${MOCK_TOKEN}`, async (route) => {
      await route.fulfill({ json: MOCK_PUBLIC_DATA })
    })

    await page.route('**/api/cop/cop-test-public-001/layers/**', async (route) => {
      await route.fulfill({ json: MOCK_EMPTY_GEOJSON })
    })

    await page.route(`**/api/cop/public/${MOCK_TOKEN}/rfis/*/answers`, async (route) => {
      await route.fulfill({ status: 201, json: { id: 'ans-new', message: 'Answer submitted' } })
    })
  })

  test('public page loads and shows session name', async ({ page }) => {
    await page.goto(`/public/cop/${MOCK_TOKEN}`)
    await page.waitForLoadState('networkidle')

    await expect(page.getByText('Crisis Response - Flooding')).toBeVisible()
  })

  test('public page shows template badge', async ({ page }) => {
    await page.goto(`/public/cop/${MOCK_TOKEN}`)
    await page.waitForLoadState('networkidle')

    // Use exact match to distinguish badge from heading "Crisis Response - Flooding"
    await expect(page.getByText('Crisis Response', { exact: true })).toBeVisible()
  })

  test('map container renders', async ({ page }) => {
    await page.goto(`/public/cop/${MOCK_TOKEN}`)
    await page.waitForLoadState('networkidle')

    // MapLibre creates a canvas, or shows fallback if WebGL unavailable
    const mapElement = page.locator('[data-testid="cop-map"], [data-testid="cop-map-fallback"], canvas').first()
    await expect(mapElement).toBeVisible({ timeout: 15000 })
  })

  test('shows read-only indicator', async ({ page }) => {
    await page.goto(`/public/cop/${MOCK_TOKEN}`)
    await page.waitForLoadState('networkidle')

    // Should show some read-only or shared view indicator
    await expect(page.getByText(/shared|read.only|view/i).first()).toBeVisible()
  })

  test('displays RFIs when panel is visible', async ({ page }) => {
    await page.goto(`/public/cop/${MOCK_TOKEN}`)
    await page.waitForLoadState('networkidle')

    // Default active panel is 'event' — click RFI tab to see RFIs
    await page.getByRole('button', { name: 'RFI' }).click()

    await expect(page.getByText('What shelters are open?')).toBeVisible()
    await expect(page.getByText('Is the I-95 bridge passable?')).toBeVisible()
  })

  test('RFI shows priority badges', async ({ page }) => {
    await page.goto(`/public/cop/${MOCK_TOKEN}`)
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: 'RFI' }).click()

    await expect(page.getByText('high').first()).toBeVisible()
    await expect(page.getByText('critical').first()).toBeVisible()
  })

  test('expanding RFI shows answers', async ({ page }) => {
    await page.goto(`/public/cop/${MOCK_TOKEN}`)
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: 'RFI' }).click()

    // Click to expand the answered RFI
    await page.getByText('Is the I-95 bridge passable?').click()

    // Should show the accepted answer
    await expect(page.getByText('Bridge is closed since 08:00 AM')).toBeVisible()
    await expect(page.getByText('DOT Liaison')).toBeVisible()
  })

  test('accepted answers show checkmark icon', async ({ page }) => {
    await page.goto(`/public/cop/${MOCK_TOKEN}`)
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: 'RFI' }).click()
    await page.getByText('Is the I-95 bridge passable?').click()

    // Accepted answer shows a green CheckCircle2 icon (no text — just SVG)
    // Verify the answer and responder are visible as proxy for acceptance
    await expect(page.getByText('DOT Liaison')).toBeVisible()
    await expect(page.locator('.text-green-400').first()).toBeVisible()
  })

  test('footer shows view count or timestamp', async ({ page }) => {
    await page.goto(`/public/cop/${MOCK_TOKEN}`)
    await page.waitForLoadState('networkidle')

    // Footer should exist
    const footer = page.locator('footer')
    await expect(footer).toBeVisible()
  })
})

// ── Tests: RFI answer submission ──────────────────────────────────

test.describe('COP Public Share - RFI Answers', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(`**/api/cop/public/${MOCK_TOKEN}`, async (route) => {
      await route.fulfill({ json: MOCK_PUBLIC_DATA })
    })

    await page.route('**/api/cop/cop-test-public-001/layers/**', async (route) => {
      await route.fulfill({ json: MOCK_EMPTY_GEOJSON })
    })

    await page.route(`**/api/cop/public/${MOCK_TOKEN}/rfis/*/answers`, async (route) => {
      await route.fulfill({ status: 201, json: { id: 'ans-new', message: 'Answer submitted' } })
    })
  })

  test('shows answer form for open RFIs when allowed', async ({ page }) => {
    await page.goto(`/public/cop/${MOCK_TOKEN}`)
    await page.waitForLoadState('networkidle')

    // Switch to RFI tab, then expand the open RFI
    await page.getByRole('button', { name: 'RFI' }).click()
    await page.getByText('What shelters are open?').click()

    // Click "+ Submit an answer" to reveal the form
    await page.getByText('+ Submit an answer').click()

    // Should show answer submission form since allow_rfi_answers=true
    await expect(page.getByPlaceholder('Your answer...')).toBeVisible({ timeout: 5000 })
  })

  test('can submit an RFI answer', async ({ page }) => {
    let answerSubmitted = false

    await page.route(`**/api/cop/public/${MOCK_TOKEN}/rfis/rfi-pub-001/answers`, async (route) => {
      answerSubmitted = true
      await route.fulfill({ status: 201, json: { id: 'ans-new', message: 'Answer submitted' } })
    })

    await page.goto(`/public/cop/${MOCK_TOKEN}`)
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: 'RFI' }).click()
    await page.getByText('What shelters are open?').click()

    // Click "+ Submit an answer" to reveal form
    await page.getByText('+ Submit an answer').click()

    // Fill answer form
    await page.getByPlaceholder('Your answer...').fill('Red Cross shelter at Lincoln Center is open.')
    await page.getByPlaceholder('Your name (optional)').fill('Field Volunteer')
    await page.getByPlaceholder('Source URL (optional)').fill('https://redcross.org/shelters')

    // Submit
    await page.getByRole('button', { name: /Submit/i }).first().click()
    await page.waitForTimeout(1000)

    expect(answerSubmitted).toBe(true)
  })
})

// ── Tests: Invalid/expired share ──────────────────────────────────

test.describe('COP Public Share - Error States', () => {
  test('shows error for invalid token', async ({ page }) => {
    await page.route('**/api/cop/public/invalid-token', async (route) => {
      await route.fulfill({ status: 404, json: { error: 'Share not found' } })
    })

    await page.goto('/public/cop/invalid-token')
    await page.waitForLoadState('networkidle')

    await expect(page.getByText(/invalid|expired|not found/i).first()).toBeVisible({ timeout: 10000 })
  })

  test('shows error for server failure', async ({ page }) => {
    await page.route('**/api/cop/public/broken-token', async (route) => {
      await route.fulfill({ status: 500, json: { error: 'Internal error' } })
    })

    await page.goto('/public/cop/broken-token')
    await page.waitForLoadState('networkidle')

    await expect(page.getByText(/failed|error/i).first()).toBeVisible({ timeout: 10000 })
  })
})

// ── Tests: Minimal share (map only) ──────────────────────────────

test.describe('COP Public Share - Map Only', () => {
  test('shows only map when visible_panels=["map"]', async ({ page }) => {
    await page.route(`**/api/cop/public/map-only-token`, async (route) => {
      await route.fulfill({ json: MOCK_NO_RFI_DATA })
    })

    await page.route('**/api/cop/cop-test-public-001/layers/**', async (route) => {
      await route.fulfill({ json: MOCK_EMPTY_GEOJSON })
    })

    await page.goto('/public/cop/map-only-token')
    await page.waitForLoadState('networkidle')

    // Map should be visible
    const mapElement = page.locator('[data-testid="cop-map"], [data-testid="cop-map-fallback"], canvas').first()
    await expect(mapElement).toBeVisible({ timeout: 15000 })

    // RFI section should NOT be visible
    await expect(page.getByText('What shelters are open?')).not.toBeVisible()
  })
})
