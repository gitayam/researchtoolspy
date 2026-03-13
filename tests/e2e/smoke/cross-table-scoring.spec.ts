import { test, expect } from '../fixtures/base-test'

/**
 * Cross Table — Scoring Methods & Weights E2E Tests
 *
 * Tests ScoreCell interactions for each scoring method (traffic, ternary, binary, ACH),
 * WeightsPanel slider/equal/AHP interactions, and full tab navigation flows.
 */

// ── Shared mock helpers ─────────────────────────────────────────────

const TABLE_ID = 'ct-scoring-001'

function buildMockTable(overrides: Record<string, unknown> = {}) {
  return {
    id: TABLE_ID,
    user_id: 1,
    title: 'Scoring Methods Test',
    description: 'Testing all scoring methods',
    template_type: 'coa',
    status: 'scoring',
    config: {
      rows: [
        { id: 'row-1', label: 'Option Alpha', order: 0 },
        { id: 'row-2', label: 'Option Bravo', order: 1 },
      ],
      columns: [
        { id: 'col-1', label: 'Criterion A', weight: 3, order: 0 },
        { id: 'col-2', label: 'Criterion B', weight: 2, order: 1 },
        { id: 'col-3', label: 'Criterion C', weight: 1, order: 2 },
      ],
      scoring_method: 'numeric',
      numeric_config: { min: 1, max: 10 },
      weighting: { method: 'manual' },
      current_round: 1,
      delphi_enabled: false,
      ...overrides,
    },
    is_public: false,
    share_token: null,
    created_at: '2026-03-12T00:00:00Z',
    updated_at: '2026-03-12T10:00:00Z',
  }
}

async function mockEditorRoutes(
  page: import('@playwright/test').Page,
  tableOverrides: Record<string, unknown> = {},
  scores: unknown[] = [],
) {
  const mockTable = buildMockTable(tableOverrides)

  // Single table GET
  await page.route(`**/api/cross-table/${TABLE_ID}`, (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        json: { table: mockTable, scores },
      })
    }
    // PUT — autosave config
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
    route.fulfill({ status: 200, json: { scorers: [] } }),
  )

  // AI
  await page.route(`**/api/cross-table/${TABLE_ID}/ai/**`, (route) =>
    route.fulfill({ status: 200, json: { summary: 'Test', insights: [], blind_spots: [] } }),
  )

  // List (for any navigation back)
  await page.route('**/api/cross-table', (route) =>
    route.fulfill({ status: 200, json: { tables: [mockTable] } }),
  )
}

// =====================================================================
// Traffic Light Scoring (R/A/G)
// =====================================================================

test.describe('Cross Table Scoring -- Traffic Light', () => {
  test.beforeEach(async ({ page }) => {
    await mockEditorRoutes(page, { scoring_method: 'traffic' })
  })

  test('@smoke traffic light cells render three colored circles', async ({ crossTablePage, isMobile }) => {
    test.skip(isMobile, 'Matrix scoring on desktop only')
    await crossTablePage.gotoEditor(TABLE_ID)
    await crossTablePage.waitForLoad()

    // Each score cell should contain R/A/G buttons with title attributes
    const firstScoreCell = crossTablePage.page.locator('table.border-collapse tbody tr').first().locator('td').nth(1)
    await expect(firstScoreCell.locator('button[title="Red"]')).toBeVisible({ timeout: 10000 })
    await expect(firstScoreCell.locator('button[title="Amber"]')).toBeVisible()
    await expect(firstScoreCell.locator('button[title="Green"]')).toBeVisible()
  })

  test('clicking Green highlights it', async ({ crossTablePage, isMobile }) => {
    test.skip(isMobile, 'Matrix scoring on desktop only')
    await crossTablePage.gotoEditor(TABLE_ID)
    await crossTablePage.waitForLoad()

    const firstScoreCell = crossTablePage.page.locator('table.border-collapse tbody tr').first().locator('td').nth(1)
    const greenBtn = firstScoreCell.locator('button[title="Green"]')
    await greenBtn.click()

    // Selected button gets ring-2 and scale-110 classes
    await expect(greenBtn).toHaveClass(/scale-110/)
  })

  test('clicking Red after Green switches selection', async ({ crossTablePage, isMobile }) => {
    test.skip(isMobile, 'Matrix scoring on desktop only')
    await crossTablePage.gotoEditor(TABLE_ID)
    await crossTablePage.waitForLoad()

    const firstScoreCell = crossTablePage.page.locator('table.border-collapse tbody tr').first().locator('td').nth(1)
    const greenBtn = firstScoreCell.locator('button[title="Green"]')
    const redBtn = firstScoreCell.locator('button[title="Red"]')

    await greenBtn.click()
    await redBtn.click()

    // Red should now be selected (scale-110), Green should be deselected (opacity-40)
    await expect(redBtn).toHaveClass(/scale-110/)
    await expect(greenBtn).toHaveClass(/opacity-40/)
  })
})

// =====================================================================
// Ternary Scoring (+/0/-)
// =====================================================================

test.describe('Cross Table Scoring -- Ternary', () => {
  test.beforeEach(async ({ page }) => {
    await mockEditorRoutes(page, { scoring_method: 'ternary' })
  })

  test('@smoke ternary cells render +/0/- buttons', async ({ crossTablePage, isMobile }) => {
    test.skip(isMobile, 'Matrix scoring on desktop only')
    await crossTablePage.gotoEditor(TABLE_ID)
    await crossTablePage.waitForLoad()

    const firstScoreCell = crossTablePage.page.locator('table.border-collapse tbody tr').first().locator('td').nth(1)
    await expect(firstScoreCell.locator('button[title="Better"]')).toBeVisible({ timeout: 10000 })
    await expect(firstScoreCell.locator('button[title="Same"]')).toBeVisible()
    await expect(firstScoreCell.locator('button[title="Worse"]')).toBeVisible()
  })

  test('clicking + highlights it with brand color', async ({ crossTablePage, isMobile }) => {
    test.skip(isMobile, 'Matrix scoring on desktop only')
    await crossTablePage.gotoEditor(TABLE_ID)
    await crossTablePage.waitForLoad()

    const firstScoreCell = crossTablePage.page.locator('table.border-collapse tbody tr').first().locator('td').nth(1)
    const betterBtn = firstScoreCell.locator('button[title="Better"]')
    await betterBtn.click()

    // Selected gets bg-[#4F5BFF] text-white
    await expect(betterBtn).toHaveClass(/bg-\[#4F5BFF\]/)
  })

  test('clicking - after + switches selection', async ({ crossTablePage, isMobile }) => {
    test.skip(isMobile, 'Matrix scoring on desktop only')
    await crossTablePage.gotoEditor(TABLE_ID)
    await crossTablePage.waitForLoad()

    const firstScoreCell = crossTablePage.page.locator('table.border-collapse tbody tr').first().locator('td').nth(1)
    const betterBtn = firstScoreCell.locator('button[title="Better"]')
    const worseBtn = firstScoreCell.locator('button[title="Worse"]')

    await betterBtn.click()
    await worseBtn.click()

    await expect(worseBtn).toHaveClass(/bg-\[#4F5BFF\]/)
    await expect(betterBtn).toHaveClass(/bg-slate-100/)
  })
})

// =====================================================================
// Binary Scoring (Yes/No)
// =====================================================================

test.describe('Cross Table Scoring -- Binary', () => {
  test.beforeEach(async ({ page }) => {
    await mockEditorRoutes(page, { scoring_method: 'binary' })
  })

  test('@smoke binary cells render Yes/No buttons', async ({ crossTablePage, isMobile }) => {
    test.skip(isMobile, 'Matrix scoring on desktop only')
    await crossTablePage.gotoEditor(TABLE_ID)
    await crossTablePage.waitForLoad()

    const firstScoreCell = crossTablePage.page.locator('table.border-collapse tbody tr').first().locator('td').nth(1)
    await expect(firstScoreCell.getByRole('button', { name: 'Yes' })).toBeVisible({ timeout: 10000 })
    await expect(firstScoreCell.getByRole('button', { name: 'No' })).toBeVisible()
  })

  test('clicking Yes highlights with green', async ({ crossTablePage, isMobile }) => {
    test.skip(isMobile, 'Matrix scoring on desktop only')
    await crossTablePage.gotoEditor(TABLE_ID)
    await crossTablePage.waitForLoad()

    const firstScoreCell = crossTablePage.page.locator('table.border-collapse tbody tr').first().locator('td').nth(1)
    const yesBtn = firstScoreCell.getByRole('button', { name: 'Yes' })
    await yesBtn.click()

    await expect(yesBtn).toHaveClass(/bg-green-600/)
  })

  test('clicking No highlights with red', async ({ crossTablePage, isMobile }) => {
    test.skip(isMobile, 'Matrix scoring on desktop only')
    await crossTablePage.gotoEditor(TABLE_ID)
    await crossTablePage.waitForLoad()

    const firstScoreCell = crossTablePage.page.locator('table.border-collapse tbody tr').first().locator('td').nth(1)
    const noBtn = firstScoreCell.getByRole('button', { name: 'No' })
    await noBtn.click()

    await expect(noBtn).toHaveClass(/bg-red-600/)
  })

  test('switching Yes to No changes color', async ({ crossTablePage, isMobile }) => {
    test.skip(isMobile, 'Matrix scoring on desktop only')
    await crossTablePage.gotoEditor(TABLE_ID)
    await crossTablePage.waitForLoad()

    const firstScoreCell = crossTablePage.page.locator('table.border-collapse tbody tr').first().locator('td').nth(1)
    const yesBtn = firstScoreCell.getByRole('button', { name: 'Yes' })
    const noBtn = firstScoreCell.getByRole('button', { name: 'No' })

    await yesBtn.click()
    await expect(yesBtn).toHaveClass(/bg-green-600/)

    await noBtn.click()
    await expect(noBtn).toHaveClass(/bg-red-600/)
    await expect(yesBtn).toHaveClass(/bg-slate-100/)
  })
})

// =====================================================================
// ACH Scoring (CC/C/N/I/II)
// =====================================================================

test.describe('Cross Table Scoring -- ACH', () => {
  test.beforeEach(async ({ page }) => {
    await mockEditorRoutes(page, { scoring_method: 'ach' })
  })

  test('@smoke ACH cells render 5 consistency buttons', async ({ crossTablePage, isMobile }) => {
    test.skip(isMobile, 'Matrix scoring on desktop only')
    await crossTablePage.gotoEditor(TABLE_ID)
    await crossTablePage.waitForLoad()

    const firstScoreCell = crossTablePage.page.locator('table.border-collapse tbody tr').first().locator('td').nth(1)
    await expect(firstScoreCell.locator('button[title="Strongly Consistent"]')).toBeVisible({ timeout: 10000 })
    await expect(firstScoreCell.locator('button[title="Consistent"]')).toBeVisible()
    await expect(firstScoreCell.locator('button[title="Neutral"]')).toBeVisible()
    await expect(firstScoreCell.locator('button[title="Inconsistent"]')).toBeVisible()
    await expect(firstScoreCell.locator('button[title="Strongly Inconsistent"]')).toBeVisible()
  })

  test('clicking CC highlights it', async ({ crossTablePage, isMobile }) => {
    test.skip(isMobile, 'Matrix scoring on desktop only')
    await crossTablePage.gotoEditor(TABLE_ID)
    await crossTablePage.waitForLoad()

    const firstScoreCell = crossTablePage.page.locator('table.border-collapse tbody tr').first().locator('td').nth(1)
    const ccBtn = firstScoreCell.locator('button[title="Strongly Consistent"]')
    await ccBtn.click()

    await expect(ccBtn).toHaveClass(/bg-\[#4F5BFF\]/)
  })
})

// =====================================================================
// Weights Panel
// =====================================================================

test.describe('Cross Table -- Weights Panel', () => {
  test.beforeEach(async ({ page }) => {
    await mockEditorRoutes(page)
  })

  test('@smoke weights tab shows criterion labels and sliders', async ({ crossTablePage, isMobile }) => {
    test.skip(isMobile, 'Tab labels hidden on mobile')
    await crossTablePage.gotoEditor(TABLE_ID)
    await crossTablePage.waitForLoad()

    await crossTablePage.switchToTab('Weights')

    // Should show all criterion labels
    await expect(crossTablePage.page.getByText('Criterion A').first()).toBeVisible({ timeout: 10000 })
    await expect(crossTablePage.page.getByText('Criterion B').first()).toBeVisible()
    await expect(crossTablePage.page.getByText('Criterion C').first()).toBeVisible()

    // Should show percentage values
    await expect(crossTablePage.page.getByText(/%/).first()).toBeVisible()
  })

  test('weighting method badge is visible', async ({ crossTablePage, isMobile }) => {
    test.skip(isMobile, 'Tab labels hidden on mobile')
    await crossTablePage.gotoEditor(TABLE_ID)
    await crossTablePage.waitForLoad()

    await crossTablePage.switchToTab('Weights')

    // Should show "Manual Weights" badge (default for this mock)
    await expect(crossTablePage.page.getByText('Manual Weights').first()).toBeVisible({ timeout: 10000 })
  })

  test('Equal button is visible and clickable', async ({ crossTablePage, isMobile }) => {
    test.skip(isMobile, 'Tab labels hidden on mobile')
    await crossTablePage.gotoEditor(TABLE_ID)
    await crossTablePage.waitForLoad()

    await crossTablePage.switchToTab('Weights')

    const equalBtn = crossTablePage.page.getByRole('button', { name: /Equal/i })
    await expect(equalBtn).toBeVisible()

    // Click Equal — method badge should change to "Equal Weights"
    await equalBtn.click()
    await expect(crossTablePage.page.getByText('Equal Weights').first()).toBeVisible({ timeout: 5000 })
  })

  test('AHP Wizard button is visible', async ({ crossTablePage, isMobile }) => {
    test.skip(isMobile, 'Tab labels hidden on mobile')
    await crossTablePage.gotoEditor(TABLE_ID)
    await crossTablePage.waitForLoad()

    await crossTablePage.switchToTab('Weights')

    const ahpBtn = crossTablePage.page.getByRole('button', { name: /AHP Wizard/i })
    await expect(ahpBtn).toBeVisible()
    // Should be enabled (3 criteria < 12 limit)
    await expect(ahpBtn).toBeEnabled()
  })

  test('normalization note is visible', async ({ crossTablePage, isMobile }) => {
    test.skip(isMobile, 'Tab labels hidden on mobile')
    await crossTablePage.gotoEditor(TABLE_ID)
    await crossTablePage.waitForLoad()

    await crossTablePage.switchToTab('Weights')

    await expect(
      crossTablePage.page.getByText('automatically normalized to sum to 100%'),
    ).toBeVisible()
  })
})

// =====================================================================
// Tab Navigation Flow
// =====================================================================

test.describe('Cross Table -- Tab Navigation Flow', () => {
  const mockScores = [
    { id: 'sc-1', cross_table_id: TABLE_ID, row_id: 'row-1', col_id: 'col-1', user_id: 1, round: 1, score: 8, confidence: 1.0, notes: null },
    { id: 'sc-2', cross_table_id: TABLE_ID, row_id: 'row-1', col_id: 'col-2', user_id: 1, round: 1, score: 5, confidence: 1.0, notes: null },
    { id: 'sc-3', cross_table_id: TABLE_ID, row_id: 'row-2', col_id: 'col-1', user_id: 1, round: 1, score: 6, confidence: 1.0, notes: null },
  ]

  test.beforeEach(async ({ page }) => {
    await mockEditorRoutes(page, {}, mockScores)
  })

  test('Matrix -> Weights -> Results tab navigation', async ({ crossTablePage, isMobile }) => {
    test.skip(isMobile, 'Tab labels hidden on mobile')
    await crossTablePage.gotoEditor(TABLE_ID)
    await crossTablePage.waitForLoad()

    // Starts on Matrix tab
    await expect(crossTablePage.matrixTab).toHaveAttribute('aria-selected', 'true')
    // Matrix content visible
    await expect(crossTablePage.page.getByText('Option Alpha').first()).toBeVisible({ timeout: 10000 })

    // Switch to Weights
    await crossTablePage.switchToTab('Weights')
    await expect(crossTablePage.weightsTab).toHaveAttribute('aria-selected', 'true')
    // Weights content visible
    await expect(crossTablePage.page.getByText('Criterion A').first()).toBeVisible({ timeout: 10000 })

    // Switch to Results (visible because scores exist)
    await crossTablePage.switchToTab('Results')
    await expect(crossTablePage.resultsTab).toHaveAttribute('aria-selected', 'true')

    // Switch back to Matrix
    await crossTablePage.switchToTab('Matrix')
    await expect(crossTablePage.matrixTab).toHaveAttribute('aria-selected', 'true')
    await expect(crossTablePage.page.getByText('Option Alpha').first()).toBeVisible()
  })

  test('Sensitivity tab visible with scores and 2+ weighted criteria', async ({ crossTablePage, isMobile }) => {
    test.skip(isMobile, 'Tab labels hidden on mobile')
    await crossTablePage.gotoEditor(TABLE_ID)
    await crossTablePage.waitForLoad()

    // Sensitivity tab should be visible (scores exist + 3 weighted criteria)
    await expect(crossTablePage.sensitivityTab).toBeVisible()
  })

  test('Consensus tab hidden with single scorer', async ({ crossTablePage, isMobile }) => {
    test.skip(isMobile, 'Tab labels hidden on mobile')
    await crossTablePage.gotoEditor(TABLE_ID)
    await crossTablePage.waitForLoad()

    // Consensus requires 2+ scorers — only 1 scorer in mock data
    await expect(crossTablePage.consensusTab).not.toBeVisible()
  })

  test('AI Insights tab always visible', async ({ crossTablePage, isMobile }) => {
    test.skip(isMobile, 'Tab labels hidden on mobile')
    await crossTablePage.gotoEditor(TABLE_ID)
    await crossTablePage.waitForLoad()

    await expect(crossTablePage.aiInsightsTab).toBeVisible()
  })
})

// =====================================================================
// Numeric Scoring (click-to-edit)
// =====================================================================

test.describe('Cross Table Scoring -- Numeric Click-to-Edit', () => {
  test.beforeEach(async ({ page }) => {
    await mockEditorRoutes(page, {
      scoring_method: 'numeric',
      numeric_config: { min: 1, max: 10 },
    })
  })

  test('empty numeric cells show "--" placeholder', async ({ crossTablePage, isMobile }) => {
    test.skip(isMobile, 'Matrix scoring on desktop only')
    await crossTablePage.gotoEditor(TABLE_ID)
    await crossTablePage.waitForLoad()

    // Unscored cells display "--"
    const firstRow = crossTablePage.page.locator('table.border-collapse tbody tr').first()
    await expect(firstRow.getByText('--').first()).toBeVisible({ timeout: 10000 })
  })

  test('clicking "--" opens number input, typing value commits on Enter', async ({ crossTablePage, isMobile }) => {
    test.skip(isMobile, 'Matrix scoring on desktop only')
    await crossTablePage.gotoEditor(TABLE_ID)
    await crossTablePage.waitForLoad()

    // Click the "--" button in the first score cell
    const firstRow = crossTablePage.page.locator('table.border-collapse tbody tr').first()
    await firstRow.locator('td').nth(1).locator('button').first().click()

    // Number input should appear
    const numInput = crossTablePage.page.locator('input[type="number"]').first()
    await expect(numInput).toBeVisible()

    // Type a value and commit
    await numInput.fill('7')
    await numInput.press('Enter')

    // Should now show "7" instead of "--"
    await expect(firstRow.locator('td').nth(1).getByText('7')).toBeVisible({ timeout: 5000 })
  })
})
