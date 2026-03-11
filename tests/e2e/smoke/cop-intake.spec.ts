/**
 * COP Intake Forms & Submissions E2E Tests
 *
 * Tests the public intake form at /public/intake/:token,
 * form field rendering, required field validation,
 * and triage queue functionality.
 */
import { test, expect } from '../fixtures/base-test'

// ── Mock data ─────────────────────────────────────────────────────

const MOCK_TOKEN = 'abc123def456abc123def456abc12345'

const MOCK_FORM_SCHEMA = {
  title: 'Report an Incident',
  description: 'Please provide details about the incident you witnessed.',
  form_schema: [
    { name: 'what_happened', type: 'textarea', label: 'What happened?', required: true, placeholder: 'Describe the incident...' },
    { name: 'incident_type', type: 'select', label: 'Incident type', required: true, options: ['Fire', 'Flood', 'Earthquake', 'Other'] },
    { name: 'num_people', type: 'number', label: 'Number of people affected', required: false },
    { name: 'when', type: 'datetime', label: 'When did it happen?', required: false },
    { name: 'urgent', type: 'checkbox', label: 'Is this urgent?', required: false },
  ],
  require_location: false,
  require_contact: false,
}

const MOCK_FORM_WITH_REQUIREMENTS = {
  ...MOCK_FORM_SCHEMA,
  require_location: true,
  require_contact: true,
}

const MOCK_SUBMISSIONS = {
  submissions: [
    {
      id: 'sub-test-001',
      intake_form_id: 'ifm-test-001',
      cop_session_id: 'cop-test-intake-001',
      form_data: { what_happened: 'Large fire near warehouse', incident_type: 'Fire' },
      submitter_name: 'Jane Doe',
      submitter_contact: 'jane@example.com',
      lat: 38.9,
      lon: -77.0,
      status: 'pending',
      triaged_by: null,
      rejection_reason: null,
      linked_evidence_id: null,
      linked_task_id: null,
      created_at: '2026-03-10T12:00:00Z',
    },
    {
      id: 'sub-test-002',
      intake_form_id: 'ifm-test-001',
      cop_session_id: 'cop-test-intake-001',
      form_data: { what_happened: 'Minor flooding', incident_type: 'Flood' },
      submitter_name: null,
      submitter_contact: null,
      lat: null,
      lon: null,
      status: 'accepted',
      triaged_by: 1,
      rejection_reason: null,
      linked_evidence_id: null,
      linked_task_id: null,
      created_at: '2026-03-09T08:00:00Z',
    },
  ],
}

// ── Tests: Public form renders ────────────────────────────────────

test.describe('COP Public Intake Form @smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(`**/api/cop/public/intake/${MOCK_TOKEN}`, async (route) => {
      await route.fulfill({ json: MOCK_FORM_SCHEMA })
    })

    await page.route(`**/api/cop/public/intake/${MOCK_TOKEN}/submit`, async (route) => {
      await route.fulfill({ status: 201, json: { id: 'sub-new-001', message: 'Submission received. Thank you.' } })
    })
  })

  test('public form loads and shows title', async ({ page }) => {
    await page.goto(`/public/intake/${MOCK_TOKEN}`)
    await page.waitForLoadState('networkidle')

    await expect(page.getByText('Report an Incident')).toBeVisible()
    await expect(page.getByText('Please provide details about the incident')).toBeVisible()
  })

  test('renders all form field types', async ({ page }) => {
    await page.goto(`/public/intake/${MOCK_TOKEN}`)
    await page.waitForLoadState('networkidle')

    // Textarea
    await expect(page.getByText('What happened?')).toBeVisible()
    await expect(page.getByPlaceholder('Describe the incident...')).toBeVisible()

    // Select
    await expect(page.getByText('Incident type')).toBeVisible()

    // Number
    await expect(page.getByText('Number of people affected')).toBeVisible()

    // Datetime
    await expect(page.getByText('When did it happen?')).toBeVisible()

    // Checkbox
    await expect(page.getByText('Is this urgent?')).toBeVisible()
  })

  test('shows required field indicators', async ({ page }) => {
    await page.goto(`/public/intake/${MOCK_TOKEN}`)
    await page.waitForLoadState('networkidle')

    // Required fields have a red asterisk
    const requiredMarkers = page.locator('.text-red-400')
    await expect(requiredMarkers.first()).toBeVisible()
  })

  test('submit button is visible', async ({ page }) => {
    await page.goto(`/public/intake/${MOCK_TOKEN}`)
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('button', { name: /Submit/i })).toBeVisible()
  })

  test('successful submission shows thank you message', async ({ page }) => {
    await page.goto(`/public/intake/${MOCK_TOKEN}`)
    await page.waitForLoadState('networkidle')

    // Fill required fields
    await page.getByPlaceholder('Describe the incident...').fill('Test incident report')
    const selectEl = page.locator('select').first()
    await selectEl.selectOption('Fire')

    // Submit
    await page.getByRole('button', { name: /Submit/i }).click()

    await expect(page.getByText('Submission received. Thank you.')).toBeVisible({ timeout: 5000 })
  })

  test('name field is always optional', async ({ page }) => {
    await page.goto(`/public/intake/${MOCK_TOKEN}`)
    await page.waitForLoadState('networkidle')

    await expect(page.getByText('Your name (optional)')).toBeVisible()
  })
})

// ── Tests: Form with required location/contact ────────────────────

test.describe('COP Public Intake - Required Fields @smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(`**/api/cop/public/intake/${MOCK_TOKEN}`, async (route) => {
      await route.fulfill({ json: MOCK_FORM_WITH_REQUIREMENTS })
    })
  })

  test('shows location button when require_location is true', async ({ page }) => {
    await page.goto(`/public/intake/${MOCK_TOKEN}`)
    await page.waitForLoadState('networkidle')

    await expect(page.getByText('Share my location')).toBeVisible()
  })

  test('shows required contact field when require_contact is true', async ({ page }) => {
    await page.goto(`/public/intake/${MOCK_TOKEN}`)
    await page.waitForLoadState('networkidle')

    await expect(page.getByText('Contact (email or phone)')).toBeVisible()
  })
})

// ── Tests: Closed form ────────────────────────────────────────────

test.describe('COP Public Intake - Closed Form @smoke', () => {
  test('shows error for closed form', async ({ page }) => {
    await page.route(`**/api/cop/public/intake/${MOCK_TOKEN}`, async (route) => {
      await route.fulfill({ status: 403, json: { error: 'This form is not currently accepting submissions' } })
    })

    await page.goto(`/public/intake/${MOCK_TOKEN}`)
    await page.waitForLoadState('networkidle')

    await expect(page.getByText(/form closed|not found/i).first()).toBeVisible({ timeout: 10000 })
  })

  test('shows error for invalid token', async ({ page }) => {
    await page.route('**/api/cop/public/intake/bad-token', async (route) => {
      await route.fulfill({ status: 404, json: { error: 'Form not found' } })
    })

    await page.goto('/public/intake/bad-token')
    await page.waitForLoadState('networkidle')

    await expect(page.getByText(/not found/i).first()).toBeVisible({ timeout: 10000 })
  })
})
