/**
 * COP Workspace E2E Tests
 *
 * Tests the workspace page that renders for /dashboard/cop/:id,
 * including Key Questions & RFIs panel, Evidence feed, and panel structure.
 *
 * NOTE: The old sidebar-based CopPage was replaced by CopWorkspacePage,
 * which uses a multi-panel grid layout with CopPanelExpander components.
 */
import { test, expect } from '../fixtures/base-test'

// ── Mock data ─────────────────────────────────────────────────────

const MOCK_SESSION = {
  session: {
    id: 'cop-test-event-001',
    name: 'Event Analysis - Test Earthquake',
    description: 'Testing event analysis workspace',
    template_type: 'event_analysis',
    status: 'ACTIVE',
    center_lat: 35.69,
    center_lon: 51.39,
    zoom_level: 6,
    rolling_hours: 48,
    active_layers: [],
    key_questions: ['What areas are affected?', 'How many casualties?'],
    event_type: 'natural_disaster',
    event_description: 'Major 7.2 earthquake struck the region at 02:15 local time.',
    event_facts: [
      { time: '02:15', text: 'Epicenter at 35.6N 51.4E' },
      { time: '02:20', text: 'Initial magnitude 7.2' },
    ],
    content_analyses: [],
    workspace_id: 'ws-test-001',
    created_at: '2026-03-05T00:00:00Z',
    updated_at: '2026-03-05T03:00:00Z',
  },
}

const MOCK_RFIS = {
  rfis: [
    {
      id: 'rfi-001',
      cop_session_id: 'cop-test-event-001',
      question: 'What are the latest casualty figures?',
      priority: 'high',
      status: 'open',
      created_by: 1,
      assigned_to: null,
      is_blocker: 0,
      created_at: '2026-03-05T03:00:00Z',
      updated_at: '2026-03-05T03:00:00Z',
      answers: [],
    },
    {
      id: 'rfi-002',
      cop_session_id: 'cop-test-event-001',
      question: 'Are roads to the epicenter passable?',
      priority: 'critical',
      status: 'answered',
      created_by: 1,
      assigned_to: null,
      is_blocker: 0,
      created_at: '2026-03-05T02:30:00Z',
      updated_at: '2026-03-05T04:00:00Z',
      answers: [
        {
          id: 'ans-001',
          rfi_id: 'rfi-002',
          answer_text: 'Highway 7 is blocked by debris. Route 12 is open.',
          source_url: 'https://example.com/roads',
          source_description: 'Transport ministry update',
          is_accepted: 0,
          responder_name: 'Field Agent A',
          created_at: '2026-03-05T04:00:00Z',
        },
      ],
    },
  ],
}

const MOCK_STATS = {
  evidence_count: 0,
  entity_count: 0,
  relationship_count: 0,
  hypothesis_count: 0,
  rfi_open_count: 1,
  completeness_pct: 15,
  blockers: [],
}

const MOCK_EMPTY_EVIDENCE = { items: [], total: 0 }

// ── Test setup ────────────────────────────────────────────────────

test.describe('COP Workspace Panels @smoke', () => {
  test.beforeEach(async ({ page }) => {
    // Mock the session endpoint
    await page.route('**/api/cop/sessions/cop-test-event-001', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({ json: MOCK_SESSION })
      } else {
        await route.fulfill({ json: { ok: true } })
      }
    })

    // Mock RFI endpoints
    await page.route('**/api/cop/cop-test-event-001/rfis', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({ json: MOCK_RFIS })
      } else {
        await route.fulfill({ status: 201, json: { id: 'rfi-new', message: 'RFI created' } })
      }
    })

    await page.route('**/api/cop/cop-test-event-001/rfis/*/answers', async (route) => {
      await route.fulfill({ status: 201, json: { id: 'ans-new', message: 'Answer submitted' } })
    })

    // Mock workspace stats
    await page.route('**/api/cop/cop-test-event-001/stats', async (route) => {
      await route.fulfill({ json: MOCK_STATS })
    })

    // Mock activity endpoint
    await page.route('**/api/cop/cop-test-event-001/activity', async (route) => {
      await route.fulfill({ json: { activity: [] } })
    })

    // Mock evidence endpoint
    await page.route('**/api/cop/cop-test-event-001/evidence**', async (route) => {
      await route.fulfill({ json: MOCK_EMPTY_EVIDENCE })
    })

    // Mock hypotheses endpoint
    await page.route('**/api/cop/cop-test-event-001/hypotheses**', async (route) => {
      await route.fulfill({ json: { hypotheses: [] } })
    })

    // Mock tasks endpoint
    await page.route('**/api/cop/cop-test-event-001/tasks**', async (route) => {
      await route.fulfill({ json: { tasks: [] } })
    })

    // Mock personas endpoint
    await page.route('**/api/cop/cop-test-event-001/personas**', async (route) => {
      await route.fulfill({ json: { personas: [] } })
    })

    // Mock gap analysis endpoint
    await page.route('**/api/cop/cop-test-event-001/gap-analysis**', async (route) => {
      await route.fulfill({ json: { gaps: [] } })
    })

    // Mock layer endpoints
    await page.route('**/api/cop/cop-test-event-001/layers/**', async (route) => {
      await route.fulfill({ json: { type: 'FeatureCollection', features: [] } })
    })

    // Mock relationships endpoint
    await page.route('**/api/cop/cop-test-event-001/relationships**', async (route) => {
      await route.fulfill({ json: { relationships: [] } })
    })

    // Mock timeline endpoint
    await page.route('**/api/cop/cop-test-event-001/timeline**', async (route) => {
      await route.fulfill({ json: { events: [] } })
    })

    // Mock analysis endpoint
    await page.route('**/api/cop/cop-test-event-001/analysis**', async (route) => {
      await route.fulfill({ json: {} })
    })

    // Mock entity endpoints (actors, events, places, sources, behaviors)
    await page.route('**/api/actors**', async (route) => {
      await route.fulfill({ json: { actors: [] } })
    })
    await page.route('**/api/events**', async (route) => {
      await route.fulfill({ json: { events: [] } })
    })
    await page.route('**/api/places**', async (route) => {
      await route.fulfill({ json: { places: [] } })
    })
    await page.route('**/api/sources**', async (route) => {
      await route.fulfill({ json: { sources: [] } })
    })
    await page.route('**/api/behaviors**', async (route) => {
      await route.fulfill({ json: { behaviors: [] } })
    })

    // Mock markers endpoint
    await page.route('**/api/cop/cop-test-event-001/markers**', async (route) => {
      await route.fulfill({ json: { markers: [] } })
    })

    // Mock blockers (no active blockers)
    await page.route('**/api/cop/cop-test-event-001/blockers**', async (route) => {
      await route.fulfill({ json: { blockers: [] } })
    })

    // Mock frameworks endpoint (for Questions tab starbursting)
    await page.route('**/api/frameworks/**', async (route) => {
      await route.fulfill({ json: { questions: [] } })
    })

    // Block external tile/font requests to prevent networkidle hang
    await page.route(/\.(pbf|mvt|png|jpg|glyphs)(\?.*)?$/, (route) => route.abort())
    await page.route('**/tiles/**', (route) => route.abort())
  })

  test('shows workspace header with session name and template badge', async ({ page }) => {
    await page.goto('/dashboard/cop/cop-test-event-001')
    await page.waitForLoadState('domcontentloaded')
    await page.getByText('Event Analysis - Test Earthquake').waitFor({ timeout: 10000 }).catch(() => {})

    // Session name should be visible in the header
    await expect(page.getByText('Event Analysis - Test Earthquake')).toBeVisible()

    // Template badge is hidden on mobile (< sm breakpoint) — only check on desktop viewports
    const viewport = page.viewportSize()
    if (viewport && viewport.width >= 640) {
      await expect(page.getByText('Event Analysis', { exact: true })).toBeVisible()
    }
  })

  test('shows Key Questions & RFIs panel', async ({ page }) => {
    await page.goto('/dashboard/cop/cop-test-event-001')
    await page.waitForLoadState('domcontentloaded')
    await page.getByText('Event Analysis - Test Earthquake').waitFor({ timeout: 10000 }).catch(() => {})

    // The panel title "Key Questions & RFIs" should be visible
    await expect(page.getByText('Key Questions & RFIs')).toBeVisible()
  })

  test('shows RFI list within the panel', async ({ page }) => {
    await page.goto('/dashboard/cop/cop-test-event-001')
    await page.waitForLoadState('domcontentloaded')
    await page.getByText('Event Analysis - Test Earthquake').waitFor({ timeout: 10000 }).catch(() => {})

    // The RFI header within the panel should show
    await expect(page.getByText('Requests for Information')).toBeVisible()

    // Both mock RFIs should be visible
    await expect(page.getByText('What are the latest casualty figures?')).toBeVisible()
    await expect(page.getByText('Are roads to the epicenter passable?')).toBeVisible()
  })

  test('RFI list shows priority and status badges', async ({ page }) => {
    await page.goto('/dashboard/cop/cop-test-event-001')
    await page.waitForLoadState('domcontentloaded')
    await page.getByText('Event Analysis - Test Earthquake').waitFor({ timeout: 10000 }).catch(() => {})

    // Wait for the RFIs to load
    await expect(page.getByText('What are the latest casualty figures?')).toBeVisible()

    // Check priority badges exist — scope to the RFI section to avoid matching "Nodal & Critical Point Analysis"
    const rfiSection = page.getByText('Requests for Information').locator('..')
    await expect(rfiSection.getByText('critical').first()).toBeVisible()
    await expect(rfiSection.getByText('high').first()).toBeVisible()

    // Check status badges
    await expect(rfiSection.getByText('open').first()).toBeVisible()
    await expect(rfiSection.getByText('answered').first()).toBeVisible()
  })

  test('RFI open count badge is visible', async ({ page }) => {
    await page.goto('/dashboard/cop/cop-test-event-001')
    await page.waitForLoadState('domcontentloaded')
    await page.getByText('Event Analysis - Test Earthquake').waitFor({ timeout: 10000 }).catch(() => {})

    // The RFI header should have a badge showing the open count
    // CopRfiTab renders a bg-blue-500 badge next to "RFI" header with open count
    const rfiBadge = page.locator('.bg-blue-500').filter({ hasText: '1' })
    await expect(rfiBadge.first()).toBeVisible()
  })

  test('New RFI form opens and submits', async ({ page }) => {
    await page.goto('/dashboard/cop/cop-test-event-001')
    await page.waitForLoadState('domcontentloaded')
    await page.getByText('Event Analysis - Test Earthquake').waitFor({ timeout: 10000 }).catch(() => {})

    // Click New RFI button
    await page.getByRole('button', { name: /New RFI/i }).click()

    // Fill the form -- CopRfiTab uses a textarea with placeholder "What do you need to know?"
    await page.getByPlaceholder('What do you need to know?').fill('Are helicopters available for rescue?')
    await page.locator('select').first().selectOption('critical')

    // Submit
    await page.getByRole('button', { name: /Submit/i }).click()

    // Form should close after submit
    await page.waitForTimeout(500)
  })

  test('expanding RFI shows answers', async ({ page }) => {
    await page.goto('/dashboard/cop/cop-test-event-001')
    await page.waitForLoadState('domcontentloaded')
    await page.getByText('Event Analysis - Test Earthquake').waitFor({ timeout: 10000 }).catch(() => {})

    // Click on the RFI that has an answer to expand it
    await page.getByText('Are roads to the epicenter passable?').click()

    // Should show the answer text
    await expect(page.getByText('Highway 7 is blocked by debris')).toBeVisible()
    await expect(page.getByText('Field Agent A')).toBeVisible()
  })

  test('shows Questions section with 5W1H or placeholder', async ({ page }) => {
    await page.goto('/dashboard/cop/cop-test-event-001')
    await page.waitForLoadState('domcontentloaded')
    await page.getByText('Event Analysis - Test Earthquake').waitFor({ timeout: 10000 }).catch(() => {})

    // The Questions tab renders its own header "Questions"
    // and shows either 5W1H categories or a "No starbursting session linked" message
    await expect(page.getByText('Questions', { exact: true }).first()).toBeVisible()
  })

  test('shows Evidence & Intel Feed panel', async ({ page }) => {
    await page.goto('/dashboard/cop/cop-test-event-001')
    await page.waitForLoadState('domcontentloaded')
    await page.getByText('Event Analysis - Test Earthquake').waitFor({ timeout: 10000 }).catch(() => {})

    // .first() because three-column layout renders Evidence Feed twice (inline + sidebar)
    await expect(page.getByText('Evidence & Intel Feed').first()).toBeVisible()
  })

  test('shows Entity Relationships panel', async ({ page }) => {
    await page.goto('/dashboard/cop/cop-test-event-001')
    await page.waitForLoadState('domcontentloaded')
    await page.getByText('Event Analysis - Test Earthquake').waitFor({ timeout: 10000 }).catch(() => {})

    await expect(page.getByRole('heading', { name: 'Entity Relationships' })).toBeVisible()
  })

  test('shows Analysis & Hypotheses panel', async ({ page }) => {
    await page.goto('/dashboard/cop/cop-test-event-001')
    await page.waitForLoadState('domcontentloaded')
    await page.getByText('Event Analysis - Test Earthquake').waitFor({ timeout: 10000 }).catch(() => {})

    await expect(page.getByText('Analysis & Hypotheses')).toBeVisible()
  })

  test('mode toggle between Progress and Monitor works', async ({ page }) => {
    await page.goto('/dashboard/cop/cop-test-event-001')
    await page.waitForLoadState('domcontentloaded')
    await page.getByText('Event Analysis - Test Earthquake').waitFor({ timeout: 10000 }).catch(() => {})

    // Progress mode should be active by default
    const progressBtn = page.locator('[data-testid="mode-progress"]')
    const monitorBtn = page.locator('[data-testid="mode-monitor"]')

    await expect(progressBtn).toBeVisible()
    await expect(monitorBtn).toBeVisible()

    // Switch to Monitor mode
    await monitorBtn.click()

    // Monitor mode hides some panels (Entity Relationships, Analysis & Hypotheses)
    // and shows "Intel & Hypotheses" instead
    await expect(page.getByText('Intel & Hypotheses')).toBeVisible()
  })

  test('Entities panel shows entity type cards', async ({ page }) => {
    await page.goto('/dashboard/cop/cop-test-event-001')
    await page.waitForLoadState('domcontentloaded')
    await page.getByText('Event Analysis - Test Earthquake').waitFor({ timeout: 10000 }).catch(() => {})

    // CopEntitiesPanel renders entity type buttons with counts
    // Use heading to find the Entities panel title
    await expect(page.getByRole('heading', { name: 'Entities' }).first()).toBeVisible()
    // Entity type buttons show as "Actors —" or "Actors 0", etc.
    const entityTypes = ['Actors', 'Events', 'Places', 'Sources', 'Behaviors']
    for (const type of entityTypes) {
      await expect(page.getByRole('button', { name: new RegExp(type) }).first()).toBeVisible()
    }
  })
})
