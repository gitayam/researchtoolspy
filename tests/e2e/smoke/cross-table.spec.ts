import { test, expect } from '../fixtures/base-test'

// ── Mock data ───────────────────────────────────────────────────────

const TABLE_ID = 'ct-test-001'

const mockCrossTable = {
  id: TABLE_ID,
  user_id: 1,
  title: 'COA Comparison Test',
  description: 'Comparing three courses of action',
  template_type: 'coa',
  status: 'scoring',
  config: {
    rows: [
      { id: 'row-1', label: 'COA Alpha', order: 0 },
      { id: 'row-2', label: 'COA Bravo', order: 1 },
      { id: 'row-3', label: 'COA Charlie', order: 2 },
    ],
    columns: [
      { id: 'col-1', label: 'Mission Success', weight: 4, order: 0 },
      { id: 'col-2', label: 'Risk', weight: 3, order: 1 },
      { id: 'col-3', label: 'Logistics', weight: 3, order: 2 },
    ],
    scoring_method: 'numeric',
    numeric_config: { min: 1, max: 10 },
    weighting: { method: 'manual' },
    current_round: 1,
    delphi_enabled: false,
  },
  is_public: false,
  share_token: null,
  created_at: '2026-03-12T00:00:00Z',
  updated_at: '2026-03-12T10:00:00Z',
}

const mockCrossTablesList = [
  {
    ...mockCrossTable,
  },
  {
    id: 'ct-test-002',
    user_id: 1,
    title: 'CARVAR Analysis',
    description: 'Target analysis using CARVAR template',
    template_type: 'carvar',
    status: 'draft',
    config: {
      rows: [
        { id: 'r1', label: 'Target 1' },
        { id: 'r2', label: 'Target 2' },
        { id: 'r3', label: 'Target 3' },
        { id: 'r4', label: 'Target 4' },
      ],
      columns: [
        { id: 'c1', label: 'Criticality', weight: 1 },
        { id: 'c2', label: 'Accessibility', weight: 1 },
        { id: 'c3', label: 'Recuperability', weight: 1 },
        { id: 'c4', label: 'Vulnerability', weight: 1 },
        { id: 'c5', label: 'Effect', weight: 1 },
        { id: 'c6', label: 'Recognizability', weight: 1 },
      ],
      scoring_method: 'numeric',
      scoring_range: { min: 1, max: 5 },
      weighting: { method: 'equal' },
    },
    is_public: false,
    share_token: null,
    created_at: '2026-03-11T00:00:00Z',
    updated_at: '2026-03-11T08:00:00Z',
  },
]

const mockScores = [
  { id: 'sc-1', cross_table_id: TABLE_ID, row_id: 'row-1', col_id: 'col-1', user_id: 1, round: 1, score: 8, confidence: 1.0, notes: null },
  { id: 'sc-2', cross_table_id: TABLE_ID, row_id: 'row-1', col_id: 'col-2', user_id: 1, round: 1, score: 5, confidence: 1.0, notes: null },
  { id: 'sc-3', cross_table_id: TABLE_ID, row_id: 'row-1', col_id: 'col-3', user_id: 1, round: 1, score: 7, confidence: 1.0, notes: null },
  { id: 'sc-4', cross_table_id: TABLE_ID, row_id: 'row-2', col_id: 'col-1', user_id: 1, round: 1, score: 6, confidence: 1.0, notes: null },
  { id: 'sc-5', cross_table_id: TABLE_ID, row_id: 'row-2', col_id: 'col-2', user_id: 1, round: 1, score: 3, confidence: 1.0, notes: null },
  { id: 'sc-6', cross_table_id: TABLE_ID, row_id: 'row-2', col_id: 'col-3', user_id: 1, round: 1, score: 9, confidence: 1.0, notes: null },
]

// These match the actual labels from src/lib/cross-table/engine/templates.ts
const TEMPLATE_LABELS = [
  'CARVER Matrix',
  'Course of Action Analysis',
  'Weighted Decision Matrix',
  'Pugh Matrix',
  'Risk Assessment Matrix',
  'Kepner-Tregoe Decision Analysis',
  'Prioritization Matrix',
  'Blank Matrix',
]

// ── Route mocking helpers ───────────────────────────────────────────

interface MockOptions {
  emptyList?: boolean
  withScores?: boolean
  failFetch?: boolean
}

async function mockCrossTableRoutes(
  page: import('@playwright/test').Page,
  opts: MockOptions = {},
) {
  // Single table fetch — register BEFORE the list route (more specific pattern first)
  await page.route(`**/api/cross-table/${TABLE_ID}`, (route) => {
    if (opts.failFetch) {
      return route.fulfill({ status: 404, json: { error: 'Not found' } })
    }
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        json: {
          table: mockCrossTable,
          scores: opts.withScores ? mockScores : [],
        },
      })
    }
    // PUT — update config
    return route.fulfill({ status: 200, json: { ok: true } })
  })

  // Scores endpoint — batch save
  await page.route(`**/api/cross-table/${TABLE_ID}/scores`, (route) => {
    if (route.request().method() === 'PUT') {
      return route.fulfill({
        status: 200,
        json: { scores: opts.withScores ? mockScores : [] },
      })
    }
    return route.fulfill({ status: 200, json: { scores: opts.withScores ? mockScores : [] } })
  })

  // Scorers endpoint
  await page.route(`**/api/cross-table/${TABLE_ID}/scorers`, (route) =>
    route.fulfill({ status: 200, json: { scorers: [] } }),
  )

  // AI endpoints
  await page.route(`**/api/cross-table/${TABLE_ID}/ai/**`, (route) =>
    route.fulfill({
      status: 200,
      json: {
        summary: 'COA Alpha ranks highest due to strong mission success scores.',
        insights: ['Consider logistics risk for COA Bravo'],
        blind_spots: ['No environmental factors considered'],
      },
    }),
  )

  // Share endpoint
  await page.route(`**/api/cross-table/${TABLE_ID}/share`, (route) =>
    route.fulfill({ status: 200, json: { url: 'https://example.com/share/abc123' } }),
  )

  // List endpoint — registered AFTER specific routes to avoid matching /api/cross-table/:id
  await page.route('**/api/cross-table', (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        json: { tables: opts.emptyList ? [] : mockCrossTablesList },
      })
    }
    // POST — create (NewCrossTableView reads data.table.id)
    return route.fulfill({
      status: 201,
      json: { table: { ...mockCrossTable, id: 'ct-new-001' } },
    })
  })
}

// =====================================================================
// List View
// =====================================================================

test.describe('Cross Table -- List View', () => {
  test.beforeEach(async ({ page }) => {
    await mockCrossTableRoutes(page)
  })

  test('@smoke list page loads with heading and create button', async ({ crossTablePage }) => {
    await crossTablePage.gotoList()
    await crossTablePage.waitForLoad()

    await expect(crossTablePage.heading).toBeVisible()
    await expect(crossTablePage.createButton).toBeVisible()
  })

  test('@smoke list shows existing cross tables', async ({ crossTablePage }) => {
    await crossTablePage.gotoList()
    await crossTablePage.waitForLoad()

    // Should show the two mock tables
    await expect(crossTablePage.page.getByText('COA Comparison Test').first()).toBeVisible({ timeout: 10000 })
    await expect(crossTablePage.page.getByText('CARVAR Analysis').first()).toBeVisible()
  })

  test('empty list shows empty state with create prompt', async ({ page, crossTablePage }) => {
    await mockCrossTableRoutes(page, { emptyList: true })

    await crossTablePage.gotoList()
    await crossTablePage.waitForLoad()

    await expect(crossTablePage.emptyState).toBeVisible()
    // Empty state also has a "New Cross Table" button
    await expect(crossTablePage.createButton).toBeVisible()
  })

  test('list shows template type badges', async ({ crossTablePage }) => {
    await crossTablePage.gotoList()
    await crossTablePage.waitForLoad()

    // TEMPLATE_LABELS maps 'coa' -> 'COA', 'carvar' -> 'CARVER'
    await expect(crossTablePage.page.getByText('COA').first()).toBeVisible({ timeout: 10000 })
    await expect(crossTablePage.page.getByText('CARVER').first()).toBeVisible()
  })

  test('list shows status indicators', async ({ crossTablePage }) => {
    await crossTablePage.gotoList()
    await crossTablePage.waitForLoad()

    // Status rendered as raw value from table.status
    await expect(crossTablePage.page.getByText('scoring').first()).toBeVisible({ timeout: 10000 })
    await expect(crossTablePage.page.getByText('draft').first()).toBeVisible()
  })

  test('list cards show criteria and alternative counts', async ({ crossTablePage }) => {
    await crossTablePage.gotoList()
    await crossTablePage.waitForLoad()

    // COA Comparison: 3 columns -> "3 criteria", 3 rows -> "3 alts"
    await expect(crossTablePage.page.getByText('3 criteria').first()).toBeVisible({ timeout: 10000 })
    await expect(crossTablePage.page.getByText('3 alts').first()).toBeVisible()
  })
})

// =====================================================================
// Template Selection
// =====================================================================

test.describe('Cross Table -- Template Selection', () => {
  test.beforeEach(async ({ page }) => {
    await mockCrossTableRoutes(page)
  })

  test('@smoke template selector shows all templates', async ({ crossTablePage }) => {
    await crossTablePage.gotoNew()
    await crossTablePage.waitForLoad()

    await expect(crossTablePage.templateSelectorHeading).toBeVisible()

    // Should show all 8 template labels from the engine
    for (const label of TEMPLATE_LABELS) {
      await expect(
        crossTablePage.page.getByText(label, { exact: false }).first(),
      ).toBeVisible()
    }
  })

  test('template cards show descriptions and scoring badges', async ({ crossTablePage }) => {
    await crossTablePage.gotoNew()
    await crossTablePage.waitForLoad()

    // CARVER description mentions "Criticality"
    await expect(
      crossTablePage.page.getByText('Criticality', { exact: false }).first(),
    ).toBeVisible()
    // Scoring method badges should be visible (e.g. "Numeric", "Traffic Light")
    await expect(
      crossTablePage.page.getByText('Numeric').first(),
    ).toBeVisible()
  })

  test('clicking template creates table and navigates to editor', async ({ crossTablePage }) => {
    await crossTablePage.gotoNew()
    await crossTablePage.waitForLoad()

    await crossTablePage.selectTemplate('Course of Action Analysis')

    // Should navigate to editor for newly created table
    await crossTablePage.page.waitForURL(/cross-table\/[a-f0-9-]+/, { timeout: 10000 })
  })
})

// =====================================================================
// Editor Shell & Tab Navigation
// =====================================================================

test.describe('Cross Table -- Editor', () => {
  test.beforeEach(async ({ page }) => {
    await mockCrossTableRoutes(page, { withScores: true })
  })

  test('@smoke editor loads with title and template badge', async ({ crossTablePage, isMobile }) => {
    test.skip(isMobile, 'Editor title check on desktop only')
    await crossTablePage.gotoEditor(TABLE_ID)
    await crossTablePage.waitForLoad()

    // Toolbar shows table title
    await expect(crossTablePage.page.getByText('COA Comparison Test').first()).toBeVisible({ timeout: 10000 })
    // Template badge shows 'COA' (from TEMPLATE_LABELS mapping)
    await expect(crossTablePage.page.getByText('COA').first()).toBeVisible()
  })

  test('@smoke tab navigation is visible', async ({ crossTablePage, isMobile }) => {
    test.skip(isMobile, 'Tab labels hidden on mobile — icons only')
    await crossTablePage.gotoEditor(TABLE_ID)
    await crossTablePage.waitForLoad()

    // Matrix and Weights tabs should always be visible
    await expect(crossTablePage.matrixTab).toBeVisible()
    await expect(crossTablePage.weightsTab).toBeVisible()
    // AI Insights tab is always visible
    await expect(crossTablePage.aiInsightsTab).toBeVisible()
  })

  test('Matrix tab is active by default', async ({ crossTablePage, isMobile }) => {
    test.skip(isMobile, 'Tab labels hidden on mobile')
    await crossTablePage.gotoEditor(TABLE_ID)
    await crossTablePage.waitForLoad()

    await expect(crossTablePage.matrixTab).toHaveAttribute('aria-selected', 'true')
  })

  test('switching tabs changes active content', async ({ crossTablePage, isMobile }) => {
    test.skip(isMobile, 'Tab labels hidden on mobile')
    await crossTablePage.gotoEditor(TABLE_ID)
    await crossTablePage.waitForLoad()

    // Switch to Weights tab
    await crossTablePage.switchToTab('Weights')
    await expect(crossTablePage.weightsTab).toHaveAttribute('aria-selected', 'true')

    // Weights tab content should be visible
    await expect(crossTablePage.page.getByText('Weights').first()).toBeVisible({ timeout: 10000 })
  })

  test('Results tab shows when scores exist', async ({ crossTablePage, isMobile }) => {
    test.skip(isMobile, 'Tab labels hidden on mobile')
    await crossTablePage.gotoEditor(TABLE_ID)
    await crossTablePage.waitForLoad()

    // Results tab should be visible since we have scores
    await expect(crossTablePage.resultsTab).toBeVisible()

    await crossTablePage.switchToTab('Results')
    await expect(crossTablePage.resultsTab).toHaveAttribute('aria-selected', 'true')
  })
})

// =====================================================================
// Matrix Scoring
// =====================================================================

test.describe('Cross Table -- Matrix Scoring', () => {
  test.beforeEach(async ({ page }) => {
    await mockCrossTableRoutes(page, { withScores: true })
  })

  test('@smoke matrix grid renders rows and columns', async ({ crossTablePage, isMobile }) => {
    test.skip(isMobile, 'Matrix grid test on desktop only')
    await crossTablePage.gotoEditor(TABLE_ID)
    await crossTablePage.waitForLoad()

    // Should show row labels from the matrix grid
    await expect(crossTablePage.page.getByText('COA Alpha').first()).toBeVisible({ timeout: 10000 })
    await expect(crossTablePage.page.getByText('COA Bravo').first()).toBeVisible()
    await expect(crossTablePage.page.getByText('COA Charlie').first()).toBeVisible()

    // Should show column headers
    await expect(crossTablePage.page.getByText('Mission Success').first()).toBeVisible()
    await expect(crossTablePage.page.getByText('Risk').first()).toBeVisible()
    await expect(crossTablePage.page.getByText('Logistics').first()).toBeVisible()
  })

  test('score cells display existing scores', async ({ crossTablePage, isMobile }) => {
    test.skip(isMobile, 'Score cells test on desktop only')
    await crossTablePage.gotoEditor(TABLE_ID)
    await crossTablePage.waitForLoad()

    // Numeric score cells show score values as button text
    // COA Alpha / Mission Success = 8
    const firstRow = crossTablePage.matrixGrid.locator('tbody tr').first()
    await expect(firstRow.getByText('8').first()).toBeVisible({ timeout: 10000 })
    // COA Alpha / Risk = 5
    await expect(firstRow.getByText('5').first()).toBeVisible()
  })

  test('add alternative and add criterion buttons are visible', async ({ crossTablePage, isMobile }) => {
    test.skip(isMobile, 'Matrix controls test on desktop only')
    await crossTablePage.gotoEditor(TABLE_ID)
    await crossTablePage.waitForLoad()

    // "Add Alternative" button at the bottom of the matrix
    await expect(crossTablePage.addRowButton).toBeVisible()
    // "Add criterion" button (Plus icon) in the last column header
    await expect(crossTablePage.addColumnButton).toBeVisible()
  })
})

// =====================================================================
// Weight Adjustment
// =====================================================================

test.describe('Cross Table -- Weights', () => {
  test.beforeEach(async ({ page }) => {
    await mockCrossTableRoutes(page, { withScores: true })
  })

  test('@smoke weights tab shows weight content', async ({ crossTablePage, isMobile }) => {
    test.skip(isMobile, 'Tab labels hidden on mobile')
    await crossTablePage.gotoEditor(TABLE_ID)
    await crossTablePage.waitForLoad()

    await crossTablePage.switchToTab('Weights')

    // Should see "Weights" heading or content in the tab panel
    await expect(crossTablePage.page.getByText('Weights').first()).toBeVisible({ timeout: 10000 })
  })
})

// =====================================================================
// Results Display
// =====================================================================

test.describe('Cross Table -- Results', () => {
  test.beforeEach(async ({ page }) => {
    await mockCrossTableRoutes(page, { withScores: true })
  })

  test('@smoke results tab shows content', async ({ crossTablePage, isMobile }) => {
    test.skip(isMobile, 'Tab labels hidden on mobile')
    await crossTablePage.gotoEditor(TABLE_ID)
    await crossTablePage.waitForLoad()

    // Results tab should be visible when scores exist
    await expect(crossTablePage.resultsTab).toBeVisible()

    await crossTablePage.switchToTab('Results')

    // Should show "Results" content area
    await expect(crossTablePage.page.getByText('Results').first()).toBeVisible({ timeout: 10000 })
  })
})

// =====================================================================
// Error Handling
// =====================================================================

test.describe('Cross Table -- Error Handling', () => {
  test('shows error when list fetch fails', async ({ page, crossTablePage }) => {
    // Override the list endpoint to fail
    await page.route('**/api/cross-table', (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({ status: 500, json: { error: 'Internal server error' } })
      }
      return route.fulfill({ status: 200 })
    })

    await crossTablePage.gotoList()
    await crossTablePage.waitForLoad()

    // Error banner with bg-destructive styling
    await expect(crossTablePage.errorBanner).toBeVisible()
    // Retry button should be available
    await expect(crossTablePage.page.getByRole('button', { name: /Retry/i })).toBeVisible()
  })
})

// =====================================================================
// Mobile Viewport
// =====================================================================

test.describe('Cross Table -- Mobile', () => {
  test.beforeEach(async ({ page }) => {
    await mockCrossTableRoutes(page)
  })

  test('@smoke list page is usable on mobile', async ({ crossTablePage, isMobile }) => {
    test.skip(!isMobile, 'Mobile-only test')

    await crossTablePage.gotoList()
    await crossTablePage.waitForLoad()

    await expect(crossTablePage.heading).toBeVisible()
    await expect(crossTablePage.createButton).toBeVisible()
    await expect(crossTablePage.page.getByText('COA Comparison Test').first()).toBeVisible({ timeout: 10000 })
  })

  test('@smoke editor is usable on mobile', async ({ page, crossTablePage, isMobile }) => {
    test.skip(!isMobile, 'Mobile-only test')
    await mockCrossTableRoutes(page, { withScores: true })

    await crossTablePage.gotoEditor(TABLE_ID)
    await crossTablePage.waitForLoad()

    // Tab bar should be visible (icons shown on mobile even without labels)
    const tabList = crossTablePage.page.getByRole('tablist')
    await expect(tabList).toBeVisible()

    // Matrix content should render with row/column labels
    await expect(crossTablePage.page.getByText('COA Alpha').first()).toBeVisible({ timeout: 10000 })
  })
})
