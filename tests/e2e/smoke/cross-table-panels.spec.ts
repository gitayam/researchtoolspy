import { test, expect } from '../fixtures/base-test'

/**
 * Cross Table — Panel E2E Tests
 *
 * Tests ResultsPanel, SensitivityPanel, AIInsightsPanel, and ConsensusPanel
 * rendering, interactions, and edge cases.
 */

// ── Shared mock data ────────────────────────────────────────────────

const TABLE_ID = 'ct-panels-001'

const mockTable = {
  id: TABLE_ID,
  user_id: 1,
  title: 'Panel Tests Table',
  description: 'Testing panel rendering',
  template_type: 'coa',
  status: 'scoring',
  config: {
    rows: [
      { id: 'row-1', label: 'Alpha', order: 0 },
      { id: 'row-2', label: 'Bravo', order: 1 },
      { id: 'row-3', label: 'Charlie', order: 2 },
    ],
    columns: [
      { id: 'col-1', label: 'Effectiveness', weight: 4, order: 0 },
      { id: 'col-2', label: 'Feasibility', weight: 3, order: 1 },
      { id: 'col-3', label: 'Risk', weight: 3, order: 2 },
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

// Full score set: all 9 cells scored (3 rows x 3 cols)
const mockScores = [
  { id: 'sc-1', cross_table_id: TABLE_ID, row_id: 'row-1', col_id: 'col-1', user_id: 1, round: 1, score: 9, confidence: 1.0, notes: null },
  { id: 'sc-2', cross_table_id: TABLE_ID, row_id: 'row-1', col_id: 'col-2', user_id: 1, round: 1, score: 7, confidence: 1.0, notes: null },
  { id: 'sc-3', cross_table_id: TABLE_ID, row_id: 'row-1', col_id: 'col-3', user_id: 1, round: 1, score: 6, confidence: 1.0, notes: null },
  { id: 'sc-4', cross_table_id: TABLE_ID, row_id: 'row-2', col_id: 'col-1', user_id: 1, round: 1, score: 5, confidence: 1.0, notes: null },
  { id: 'sc-5', cross_table_id: TABLE_ID, row_id: 'row-2', col_id: 'col-2', user_id: 1, round: 1, score: 8, confidence: 1.0, notes: null },
  { id: 'sc-6', cross_table_id: TABLE_ID, row_id: 'row-2', col_id: 'col-3', user_id: 1, round: 1, score: 4, confidence: 1.0, notes: null },
  { id: 'sc-7', cross_table_id: TABLE_ID, row_id: 'row-3', col_id: 'col-1', user_id: 1, round: 1, score: 3, confidence: 1.0, notes: null },
  { id: 'sc-8', cross_table_id: TABLE_ID, row_id: 'row-3', col_id: 'col-2', user_id: 1, round: 1, score: 6, confidence: 1.0, notes: null },
  { id: 'sc-9', cross_table_id: TABLE_ID, row_id: 'row-3', col_id: 'col-3', user_id: 1, round: 1, score: 5, confidence: 1.0, notes: null },
]

// Multi-scorer scores (2 users) for consensus tests
const mockMultiScorerScores = [
  ...mockScores,
  { id: 'sc-10', cross_table_id: TABLE_ID, row_id: 'row-1', col_id: 'col-1', user_id: 2, round: 1, score: 8, confidence: 0.9, notes: null },
  { id: 'sc-11', cross_table_id: TABLE_ID, row_id: 'row-1', col_id: 'col-2', user_id: 2, round: 1, score: 6, confidence: 0.8, notes: null },
  { id: 'sc-12', cross_table_id: TABLE_ID, row_id: 'row-1', col_id: 'col-3', user_id: 2, round: 1, score: 7, confidence: 0.9, notes: null },
  { id: 'sc-13', cross_table_id: TABLE_ID, row_id: 'row-2', col_id: 'col-1', user_id: 2, round: 1, score: 6, confidence: 1.0, notes: null },
  { id: 'sc-14', cross_table_id: TABLE_ID, row_id: 'row-2', col_id: 'col-2', user_id: 2, round: 1, score: 7, confidence: 0.7, notes: null },
  { id: 'sc-15', cross_table_id: TABLE_ID, row_id: 'row-2', col_id: 'col-3', user_id: 2, round: 1, score: 5, confidence: 0.8, notes: null },
]

// Mock consensus data for ConsensusPanel
const mockConsensus = {
  kendall_w: 0.72,
  high_disagreement_count: 1,
  cell_stats: [
    { row_id: 'row-1', col_id: 'col-1', median: 8.5, iqr: 0.5, min: 8, max: 9, count: 2, high_disagreement: false },
    { row_id: 'row-1', col_id: 'col-2', median: 6.5, iqr: 0.5, min: 6, max: 7, count: 2, high_disagreement: false },
    { row_id: 'row-1', col_id: 'col-3', median: 6.5, iqr: 0.5, min: 6, max: 7, count: 2, high_disagreement: false },
    { row_id: 'row-2', col_id: 'col-1', median: 5.5, iqr: 0.5, min: 5, max: 6, count: 2, high_disagreement: false },
    { row_id: 'row-2', col_id: 'col-2', median: 7.5, iqr: 0.5, min: 7, max: 8, count: 2, high_disagreement: false },
    { row_id: 'row-2', col_id: 'col-3', median: 4.5, iqr: 2.0, min: 4, max: 5, count: 2, high_disagreement: true },
  ],
}

const mockScorers = [
  { id: 'scorer-1', user_id: 1, status: 'submitted', completion_percent: 100 },
  { id: 'scorer-2', user_id: 2, status: 'accepted', completion_percent: 67 },
]

// Mock AI insights response
const mockAIInsights = {
  summary: 'Alpha leads across most criteria with strongest effectiveness scores.',
  challenge: 'Alpha dominance may reflect anchoring bias — Bravo scores higher on feasibility.',
  sensitivity_narrative: 'Reducing Effectiveness weight by 30% would flip the top rank to Bravo.',
  blind_spots: [
    'No environmental sustainability criterion included',
    'Timeline constraints not evaluated',
  ],
  recommendations: [
    'Add a timeline/schedule criterion',
    'Have a second scorer validate the risk assessments',
    'Consider sensitivity analysis on the Effectiveness weight',
  ],
}

const mockCriteriaSuggestions = {
  suggestions: [
    { label: 'Timeline', description: 'Implementation timeline in months', rationale: 'No schedule-related criterion exists' },
    { label: 'Sustainability', description: 'Environmental sustainability impact', rationale: 'Missing from current criteria set' },
  ],
}

const mockScoreSuggestions = {
  suggestions: [
    { row_id: 'row-3', col_id: 'col-1', suggested_score: 4, reasoning: 'Charlie has limited capability in this area' },
    { row_id: 'row-3', col_id: 'col-2', suggested_score: 7, reasoning: 'Charlie shows strong feasibility indicators' },
  ],
}

// ── Route mocking helpers ───────────────────────────────────────────

interface PanelMockOpts {
  scores?: unknown[]
  consensusData?: typeof mockConsensus | null
  scorersData?: typeof mockScorers
  aiInsightsResponse?: unknown
  aiInsightsFail?: boolean
  criteriaSuggestResponse?: unknown
  scoreSuggestResponse?: unknown
}

async function mockPanelRoutes(
  page: import('@playwright/test').Page,
  opts: PanelMockOpts = {},
) {
  const scores = opts.scores ?? mockScores

  // Single table GET
  await page.route(`**/api/cross-table/${TABLE_ID}`, (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        json: { table: mockTable, scores },
      })
    }
    return route.fulfill({ status: 200, json: { ok: true } })
  })

  // Scores batch save
  await page.route(`**/api/cross-table/${TABLE_ID}/scores`, (route) =>
    route.fulfill({ status: 200, json: { scores } }),
  )

  // Share
  await page.route(`**/api/cross-table/${TABLE_ID}/share`, (route) =>
    route.fulfill({ status: 200, json: { url: 'https://example.com/share/test' } }),
  )

  // Scorers
  await page.route(`**/api/cross-table/${TABLE_ID}/scorers`, (route) =>
    route.fulfill({
      status: 200,
      json: { scorers: opts.scorersData ?? [] },
    }),
  )

  // Consensus
  await page.route(`**/api/cross-table/${TABLE_ID}/consensus*`, (route) =>
    route.fulfill({
      status: 200,
      json: { consensus: opts.consensusData ?? null },
    }),
  )

  // AI insights
  await page.route(`**/api/cross-table/${TABLE_ID}/ai/insights`, (route) => {
    if (opts.aiInsightsFail) {
      return route.fulfill({ status: 500, json: { error: 'AI service unavailable' } })
    }
    return route.fulfill({
      status: 200,
      json: opts.aiInsightsResponse ?? mockAIInsights,
    })
  })

  // AI suggest-criteria
  await page.route(`**/api/cross-table/${TABLE_ID}/ai/suggest-criteria`, (route) =>
    route.fulfill({
      status: 200,
      json: opts.criteriaSuggestResponse ?? mockCriteriaSuggestions,
    }),
  )

  // AI score-suggest
  await page.route(`**/api/cross-table/${TABLE_ID}/ai/score-suggest`, (route) =>
    route.fulfill({
      status: 200,
      json: opts.scoreSuggestResponse ?? mockScoreSuggestions,
    }),
  )

  // List (fallback for navigation)
  await page.route('**/api/cross-table', (route) =>
    route.fulfill({ status: 200, json: { tables: [mockTable] } }),
  )
}

// =====================================================================
// ResultsPanel
// =====================================================================

test.describe('Cross Table Panels -- Results', () => {
  test.beforeEach(async ({ page }) => {
    await mockPanelRoutes(page)
  })

  test('@smoke results tab shows ranked bar chart', async ({ crossTablePage, isMobile }) => {
    test.skip(isMobile, 'Tab labels hidden on mobile')
    await crossTablePage.gotoEditor(TABLE_ID)
    await crossTablePage.waitForLoad()

    await crossTablePage.switchToTab('Results')

    // Recharts container should render
    const chart = crossTablePage.page.locator('.recharts-responsive-container').first()
    await expect(chart).toBeVisible({ timeout: 10000 })
  })

  test('results tab shows "Ranked Results" heading', async ({ crossTablePage, isMobile }) => {
    test.skip(isMobile, 'Tab labels hidden on mobile')
    await crossTablePage.gotoEditor(TABLE_ID)
    await crossTablePage.waitForLoad()

    await crossTablePage.switchToTab('Results')

    await expect(crossTablePage.page.getByText('Ranked Results').first()).toBeVisible({ timeout: 10000 })
  })

  test('score breakdown table shows all alternatives with ranks', async ({ crossTablePage, isMobile }) => {
    test.skip(isMobile, 'Tab labels hidden on mobile')
    await crossTablePage.gotoEditor(TABLE_ID)
    await crossTablePage.waitForLoad()

    await crossTablePage.switchToTab('Results')

    // Score Breakdown heading
    await expect(crossTablePage.page.getByText('Score Breakdown').first()).toBeVisible({ timeout: 10000 })

    // All three alternatives in the table
    await expect(crossTablePage.page.getByText('Alpha').first()).toBeVisible()
    await expect(crossTablePage.page.getByText('Bravo').first()).toBeVisible()
    await expect(crossTablePage.page.getByText('Charlie').first()).toBeVisible()

    // Rank #1 badge
    await expect(crossTablePage.page.getByText('#1').first()).toBeVisible()
  })

  test('radar chart renders for top alternatives when 3+ criteria', async ({ crossTablePage, isMobile }) => {
    test.skip(isMobile, 'Tab labels hidden on mobile')
    await crossTablePage.gotoEditor(TABLE_ID)
    await crossTablePage.waitForLoad()

    await crossTablePage.switchToTab('Results')

    // "Top X Comparison" heading for radar chart
    await expect(crossTablePage.page.getByText(/Top \d+ Comparison/).first()).toBeVisible({ timeout: 10000 })

    // Recharts renders multiple containers — at least 2 (bar + radar)
    const charts = crossTablePage.page.locator('.recharts-responsive-container')
    await expect(charts).toHaveCount(2, { timeout: 10000 })
  })

  test('results empty state when no scores exist', async ({ page, crossTablePage, isMobile }) => {
    test.skip(isMobile, 'Tab labels hidden on mobile')
    await mockPanelRoutes(page, { scores: [] })

    await crossTablePage.gotoEditor(TABLE_ID)
    await crossTablePage.waitForLoad()

    // Results tab should still be navigable (tab is rendered)
    // but clicking it shows the empty state message
    await crossTablePage.switchToTab('Results')

    await expect(
      crossTablePage.page.getByText(/Score at least one cell/i).first(),
    ).toBeVisible({ timeout: 10000 })
  })
})

// =====================================================================
// SensitivityPanel
// =====================================================================

test.describe('Cross Table Panels -- Sensitivity', () => {
  test.beforeEach(async ({ page }) => {
    await mockPanelRoutes(page)
  })

  test('@smoke sensitivity tab shows tornado diagram', async ({ crossTablePage, isMobile }) => {
    test.skip(isMobile, 'Tab labels hidden on mobile')
    await crossTablePage.gotoEditor(TABLE_ID)
    await crossTablePage.waitForLoad()

    await crossTablePage.switchToTab('Sensitivity')

    await expect(crossTablePage.page.getByText('Tornado Diagram').first()).toBeVisible({ timeout: 10000 })

    // Recharts container
    const chart = crossTablePage.page.locator('.recharts-responsive-container').first()
    await expect(chart).toBeVisible()
  })

  test('tornado diagram shows top alternative badge', async ({ crossTablePage, isMobile }) => {
    test.skip(isMobile, 'Tab labels hidden on mobile')
    await crossTablePage.gotoEditor(TABLE_ID)
    await crossTablePage.waitForLoad()

    await crossTablePage.switchToTab('Sensitivity')

    // Badge next to "Tornado Diagram" shows the top-ranked alternative name
    // Alpha should rank #1 with our mock scores (highest weighted total)
    await expect(crossTablePage.page.getByText('Alpha').first()).toBeVisible({ timeout: 10000 })
  })

  test('sensitivity description text is visible', async ({ crossTablePage, isMobile }) => {
    test.skip(isMobile, 'Tab labels hidden on mobile')
    await crossTablePage.gotoEditor(TABLE_ID)
    await crossTablePage.waitForLoad()

    await crossTablePage.switchToTab('Sensitivity')

    await expect(
      crossTablePage.page.getByText(/perturbed by/).first(),
    ).toBeVisible({ timeout: 10000 })
  })

  test('break-even analysis table shows all criteria', async ({ crossTablePage, isMobile }) => {
    test.skip(isMobile, 'Tab labels hidden on mobile')
    await crossTablePage.gotoEditor(TABLE_ID)
    await crossTablePage.waitForLoad()

    await crossTablePage.switchToTab('Sensitivity')

    // Break-Even Analysis heading
    await expect(crossTablePage.page.getByText('Break-Even Analysis').first()).toBeVisible({ timeout: 10000 })

    // All three criteria in the table
    await expect(crossTablePage.page.getByText('Effectiveness').first()).toBeVisible()
    await expect(crossTablePage.page.getByText('Feasibility').first()).toBeVisible()
    await expect(crossTablePage.page.getByText('Risk').first()).toBeVisible()

    // Stability badges
    await expect(crossTablePage.page.getByText(/Stable|Sensitive/).first()).toBeVisible()
  })

  test('sensitivity empty state with insufficient criteria', async ({ page, crossTablePage, isMobile }) => {
    test.skip(isMobile, 'Tab labels hidden on mobile')

    // Table with only 1 weighted criterion — sensitivity tab may not be visible
    // but if navigated to, shows the empty state
    const singleColTable = {
      ...mockTable,
      config: {
        ...mockTable.config,
        columns: [
          { id: 'col-1', label: 'Only Criterion', weight: 5, order: 0 },
        ],
      },
    }
    const singleColScores = [
      { id: 'sc-1', cross_table_id: TABLE_ID, row_id: 'row-1', col_id: 'col-1', user_id: 1, round: 1, score: 8, confidence: 1.0, notes: null },
    ]

    await page.route(`**/api/cross-table/${TABLE_ID}`, (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({ status: 200, json: { table: singleColTable, scores: singleColScores } })
      }
      return route.fulfill({ status: 200, json: { ok: true } })
    })
    await page.route(`**/api/cross-table/${TABLE_ID}/scorers`, (route) =>
      route.fulfill({ status: 200, json: { scorers: [] } }),
    )
    await page.route(`**/api/cross-table/${TABLE_ID}/scores`, (route) =>
      route.fulfill({ status: 200, json: { scores: singleColScores } }),
    )
    await page.route('**/api/cross-table', (route) =>
      route.fulfill({ status: 200, json: { tables: [singleColTable] } }),
    )

    await crossTablePage.gotoEditor(TABLE_ID)
    await crossTablePage.waitForLoad()

    // Sensitivity tab should not be visible (needs 2+ weighted criteria)
    await expect(crossTablePage.sensitivityTab).not.toBeVisible()
  })
})

// =====================================================================
// AIInsightsPanel
// =====================================================================

test.describe('Cross Table Panels -- AI Insights', () => {
  test.beforeEach(async ({ page }) => {
    await mockPanelRoutes(page)
  })

  test('@smoke AI Insights tab shows action buttons', async ({ crossTablePage, isMobile }) => {
    test.skip(isMobile, 'Tab labels hidden on mobile')
    await crossTablePage.gotoEditor(TABLE_ID)
    await crossTablePage.waitForLoad()

    await crossTablePage.switchToTab('AI Insights')

    // Three action buttons
    await expect(crossTablePage.page.getByRole('button', { name: /Generate Analysis/i })).toBeVisible({ timeout: 10000 })
    await expect(crossTablePage.page.getByRole('button', { name: /Suggest Criteria/i })).toBeVisible()
    await expect(crossTablePage.page.getByRole('button', { name: /Suggest Scores/i })).toBeVisible()
  })

  test('Generate Analysis fetches and displays insight cards', async ({ crossTablePage, isMobile }) => {
    test.skip(isMobile, 'Tab labels hidden on mobile')
    await crossTablePage.gotoEditor(TABLE_ID)
    await crossTablePage.waitForLoad()

    await crossTablePage.switchToTab('AI Insights')

    await crossTablePage.page.getByRole('button', { name: /Generate Analysis/i }).click()

    // Wait for insights to load — summary card
    await expect(crossTablePage.page.getByText('Analysis Summary').first()).toBeVisible({ timeout: 10000 })
    await expect(crossTablePage.page.getByText(/Alpha leads/).first()).toBeVisible()

    // Devil's Advocate card
    await expect(crossTablePage.page.getByText("Devil's Advocate").first()).toBeVisible()
    await expect(crossTablePage.page.getByText(/anchoring bias/).first()).toBeVisible()

    // Sensitivity Insights card
    await expect(crossTablePage.page.getByText('Sensitivity Insights').first()).toBeVisible()

    // Blind Spots section
    await expect(crossTablePage.page.getByText('Blind Spots').first()).toBeVisible()
    await expect(crossTablePage.page.getByText(/environmental sustainability/).first()).toBeVisible()

    // Recommendations section
    await expect(crossTablePage.page.getByText('Recommendations').first()).toBeVisible()
    await expect(crossTablePage.page.getByText(/timeline/).first()).toBeVisible()
  })

  test('button changes to "Refresh Analysis" after first load', async ({ crossTablePage, isMobile }) => {
    test.skip(isMobile, 'Tab labels hidden on mobile')
    await crossTablePage.gotoEditor(TABLE_ID)
    await crossTablePage.waitForLoad()

    await crossTablePage.switchToTab('AI Insights')

    await crossTablePage.page.getByRole('button', { name: /Generate Analysis/i }).click()
    await expect(crossTablePage.page.getByText('Analysis Summary').first()).toBeVisible({ timeout: 10000 })

    // Button text should now be "Refresh Analysis"
    await expect(crossTablePage.page.getByRole('button', { name: /Refresh Analysis/i })).toBeVisible()
  })

  test('Suggest Criteria fetches and displays suggestions', async ({ crossTablePage, isMobile }) => {
    test.skip(isMobile, 'Tab labels hidden on mobile')
    await crossTablePage.gotoEditor(TABLE_ID)
    await crossTablePage.waitForLoad()

    await crossTablePage.switchToTab('AI Insights')

    await crossTablePage.page.getByRole('button', { name: /Suggest Criteria/i }).click()

    // "Suggested Criteria" card
    await expect(crossTablePage.page.getByText('Suggested Criteria').first()).toBeVisible({ timeout: 10000 })
    await expect(crossTablePage.page.getByText('Timeline').first()).toBeVisible()
    await expect(crossTablePage.page.getByText('Sustainability').first()).toBeVisible()
    // Rationale text
    await expect(crossTablePage.page.getByText(/schedule-related/).first()).toBeVisible()
  })

  test('Suggest Scores fetches and displays score suggestions', async ({ crossTablePage, isMobile }) => {
    test.skip(isMobile, 'Tab labels hidden on mobile')
    await crossTablePage.gotoEditor(TABLE_ID)
    await crossTablePage.waitForLoad()

    await crossTablePage.switchToTab('AI Insights')

    await crossTablePage.page.getByRole('button', { name: /Suggest Scores/i }).click()

    // "Suggested Scores" card
    await expect(crossTablePage.page.getByText('Suggested Scores').first()).toBeVisible({ timeout: 10000 })
    await expect(crossTablePage.page.getByText('2 suggestions').first()).toBeVisible()
    // Alternative names from mock data
    await expect(crossTablePage.page.getByText('Charlie').first()).toBeVisible()
  })

  test('Generate Analysis shows error with retry on failure', async ({ page, crossTablePage, isMobile }) => {
    test.skip(isMobile, 'Tab labels hidden on mobile')
    await mockPanelRoutes(page, { aiInsightsFail: true })

    await crossTablePage.gotoEditor(TABLE_ID)
    await crossTablePage.waitForLoad()

    await crossTablePage.switchToTab('AI Insights')

    await crossTablePage.page.getByRole('button', { name: /Generate Analysis/i }).click()

    // Error message
    await expect(
      crossTablePage.page.locator('[class*="bg-destructive"]').first(),
    ).toBeVisible({ timeout: 10000 })

    // Retry button (RefreshCw icon button)
    await expect(
      crossTablePage.page.locator('[class*="bg-destructive"]').getByRole('button').first(),
    ).toBeVisible()
  })

  test('Generate Analysis and Suggest Scores disabled without scores', async ({ page, crossTablePage, isMobile }) => {
    test.skip(isMobile, 'Tab labels hidden on mobile')
    await mockPanelRoutes(page, { scores: [] })

    await crossTablePage.gotoEditor(TABLE_ID)
    await crossTablePage.waitForLoad()

    await crossTablePage.switchToTab('AI Insights')

    // "Generate Analysis" and "Suggest Scores" should be disabled
    await expect(
      crossTablePage.page.getByRole('button', { name: /Generate Analysis/i }),
    ).toBeDisabled({ timeout: 10000 })
    await expect(
      crossTablePage.page.getByRole('button', { name: /Suggest Scores/i }),
    ).toBeDisabled()

    // "Suggest Criteria" should still be enabled (doesn't require scores)
    await expect(
      crossTablePage.page.getByRole('button', { name: /Suggest Criteria/i }),
    ).toBeEnabled()

    // Helper text about needing scores
    await expect(
      crossTablePage.page.getByText(/Score at least one cell to enable/i).first(),
    ).toBeVisible()
  })

  test('loading skeleton shows during analysis fetch', async ({ page, crossTablePage, isMobile }) => {
    test.skip(isMobile, 'Tab labels hidden on mobile')

    // Delay the AI response so we can observe the skeleton
    await mockPanelRoutes(page, {
      aiInsightsResponse: undefined, // will be overridden below
    })

    // Override with delayed response
    await page.route(`**/api/cross-table/${TABLE_ID}/ai/insights`, async (route) => {
      await new Promise((r) => setTimeout(r, 500))
      return route.fulfill({ status: 200, json: mockAIInsights })
    })

    await crossTablePage.gotoEditor(TABLE_ID)
    await crossTablePage.waitForLoad()

    await crossTablePage.switchToTab('AI Insights')

    await crossTablePage.page.getByRole('button', { name: /Generate Analysis/i }).click()

    // Spinner icon should appear on the button while loading
    await expect(crossTablePage.page.locator('.animate-spin').first()).toBeVisible()

    // Eventually the insight cards appear
    await expect(crossTablePage.page.getByText('Analysis Summary').first()).toBeVisible({ timeout: 10000 })
  })
})

// =====================================================================
// ConsensusPanel
// =====================================================================

test.describe('Cross Table Panels -- Consensus', () => {
  test.beforeEach(async ({ page }) => {
    await mockPanelRoutes(page, {
      scores: mockMultiScorerScores,
      consensusData: mockConsensus,
      scorersData: mockScorers,
    })
  })

  test('@smoke consensus tab shows Kendall W gauge', async ({ crossTablePage, isMobile }) => {
    test.skip(isMobile, 'Tab labels hidden on mobile')
    await crossTablePage.gotoEditor(TABLE_ID)
    await crossTablePage.waitForLoad()

    await crossTablePage.switchToTab('Consensus')

    // Kendall's W label and value
    await expect(crossTablePage.page.getByText("Kendall's W").first()).toBeVisible({ timeout: 10000 })
    await expect(crossTablePage.page.getByText('0.720').first()).toBeVisible()

    // Agreement strength label
    await expect(crossTablePage.page.getByText('Strong agreement').first()).toBeVisible()
  })

  test('consensus shows round selector', async ({ crossTablePage, isMobile }) => {
    test.skip(isMobile, 'Tab labels hidden on mobile')
    await crossTablePage.gotoEditor(TABLE_ID)
    await crossTablePage.waitForLoad()

    await crossTablePage.switchToTab('Consensus')

    // Round indicator
    await expect(crossTablePage.page.getByText(/Round 1 of 1/).first()).toBeVisible({ timeout: 10000 })
  })

  test('consensus IQR heatmap shows alternatives and criteria', async ({ crossTablePage, isMobile }) => {
    test.skip(isMobile, 'Tab labels hidden on mobile')
    await crossTablePage.gotoEditor(TABLE_ID)
    await crossTablePage.waitForLoad()

    await crossTablePage.switchToTab('Consensus')

    // Alternative labels in the heatmap rows
    await expect(crossTablePage.page.getByText('Alpha').first()).toBeVisible({ timeout: 10000 })
    await expect(crossTablePage.page.getByText('Bravo').first()).toBeVisible()

    // Criterion headers
    await expect(crossTablePage.page.getByText('Effectiveness').first()).toBeVisible()
    await expect(crossTablePage.page.getByText('Feasibility').first()).toBeVisible()
    await expect(crossTablePage.page.getByText('Risk').first()).toBeVisible()

    // Median values from cell stats
    await expect(crossTablePage.page.getByText('8.50').first()).toBeVisible()
  })

  test('consensus shows summary badges', async ({ crossTablePage, isMobile }) => {
    test.skip(isMobile, 'Tab labels hidden on mobile')
    await crossTablePage.gotoEditor(TABLE_ID)
    await crossTablePage.waitForLoad()

    await crossTablePage.switchToTab('Consensus')

    // "X cells scored" badge
    await expect(crossTablePage.page.getByText(/\d+ cells scored/).first()).toBeVisible({ timeout: 10000 })

    // High disagreement badge (1 cell in our mock data)
    await expect(crossTablePage.page.getByText(/1 high disagreement/).first()).toBeVisible()

    // Active scorers badge
    await expect(crossTablePage.page.getByText(/\d+ active scorers/).first()).toBeVisible()
  })

  test('consensus shows scorer progress bars', async ({ crossTablePage, isMobile }) => {
    test.skip(isMobile, 'Tab labels hidden on mobile')
    await crossTablePage.gotoEditor(TABLE_ID)
    await crossTablePage.waitForLoad()

    await crossTablePage.switchToTab('Consensus')

    // "Scorer Progress" section heading
    await expect(crossTablePage.page.getByText('Scorer Progress').first()).toBeVisible({ timeout: 10000 })

    // Status badges for each scorer
    await expect(crossTablePage.page.getByText('submitted').first()).toBeVisible()
    await expect(crossTablePage.page.getByText('accepted').first()).toBeVisible()

    // Completion percentages
    await expect(crossTablePage.page.getByText('100%').first()).toBeVisible()
    await expect(crossTablePage.page.getByText('67%').first()).toBeVisible()
  })

  test('consensus tab hidden with single scorer', async ({ page, crossTablePage, isMobile }) => {
    test.skip(isMobile, 'Tab labels hidden on mobile')

    // Single scorer — consensus tab should not be visible
    await mockPanelRoutes(page, { scores: mockScores })

    await crossTablePage.gotoEditor(TABLE_ID)
    await crossTablePage.waitForLoad()

    await expect(crossTablePage.consensusTab).not.toBeVisible()
  })

  test('consensus loading state shows spinner', async ({ page, crossTablePage, isMobile }) => {
    test.skip(isMobile, 'Tab labels hidden on mobile')

    // Override consensus with delayed response
    await mockPanelRoutes(page, {
      scores: mockMultiScorerScores,
      scorersData: mockScorers,
    })
    await page.route(`**/api/cross-table/${TABLE_ID}/consensus*`, async (route) => {
      await new Promise((r) => setTimeout(r, 500))
      return route.fulfill({ status: 200, json: { consensus: mockConsensus } })
    })

    await crossTablePage.gotoEditor(TABLE_ID)
    await crossTablePage.waitForLoad()

    await crossTablePage.switchToTab('Consensus')

    // Spinner while loading
    await expect(crossTablePage.page.locator('.animate-spin').first()).toBeVisible()

    // Eventually content appears
    await expect(crossTablePage.page.getByText("Kendall's W").first()).toBeVisible({ timeout: 10000 })
  })

  test('consensus error state shows message', async ({ page, crossTablePage, isMobile }) => {
    test.skip(isMobile, 'Tab labels hidden on mobile')

    await mockPanelRoutes(page, { scores: mockMultiScorerScores, scorersData: mockScorers })
    await page.route(`**/api/cross-table/${TABLE_ID}/consensus*`, (route) =>
      route.fulfill({ status: 500, json: { error: 'Server error' } }),
    )

    await crossTablePage.gotoEditor(TABLE_ID)
    await crossTablePage.waitForLoad()

    await crossTablePage.switchToTab('Consensus')

    // Error message with destructive styling
    await expect(
      crossTablePage.page.locator('[class*="bg-destructive"]').first(),
    ).toBeVisible({ timeout: 10000 })
  })
})
