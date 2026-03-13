import type { Page, Locator } from '@playwright/test'

/**
 * Page Object Model for the Cross Table feature.
 *
 * Routes:
 *   /dashboard/tools/cross-table       — list view
 *   /dashboard/tools/cross-table/new   — template selector
 *   /dashboard/tools/cross-table/:id   — editor
 *   /dashboard/tools/cross-table/:id/score — scorer view (Delphi)
 */
export class CrossTablePage {
  readonly page: Page

  // ── List view ──────────────────────────────────────────────────
  readonly heading: Locator
  readonly createButton: Locator
  readonly tableCards: Locator
  readonly emptyState: Locator

  // ── Template selector ──────────────────────────────────────────
  readonly templateCards: Locator
  readonly templateSelectorHeading: Locator

  // ── Editor shell ───────────────────────────────────────────────
  readonly editorTitle: Locator
  readonly templateBadge: Locator
  readonly statusBadge: Locator
  readonly saveScoresButton: Locator

  // ── Tab navigation ─────────────────────────────────────────────
  readonly matrixTab: Locator
  readonly weightsTab: Locator
  readonly resultsTab: Locator
  readonly sensitivityTab: Locator
  readonly consensusTab: Locator
  readonly aiInsightsTab: Locator

  // ── Matrix grid ────────────────────────────────────────────────
  readonly matrixGrid: Locator
  readonly scoreCells: Locator
  readonly addRowButton: Locator
  readonly addColumnButton: Locator
  readonly rowHeaders: Locator
  readonly columnHeaders: Locator

  // ── Weights panel ──────────────────────────────────────────────
  readonly weightSliders: Locator
  readonly equalWeightsButton: Locator
  readonly ahpWizardButton: Locator

  // ── Results panel ──────────────────────────────────────────────
  readonly resultsChart: Locator
  readonly rankingList: Locator

  // ── Toolbar actions ────────────────────────────────────────────
  readonly exportButton: Locator
  readonly shareButton: Locator

  // ── States ─────────────────────────────────────────────────────
  readonly loadingSpinner: Locator
  readonly errorBanner: Locator

  constructor(page: Page) {
    this.page = page

    // List view — heading is "Cross Tables", cards are Card components
    this.heading = page.getByRole('heading', { name: /Cross Tables/i }).first()
    this.createButton = page.getByRole('button', { name: /New Cross Table/i }).first()
    this.tableCards = page.locator('.grid > .cursor-pointer')
    this.emptyState = page.getByRole('heading', { name: /Create Your First Cross Table/i })

    // Template selector — TemplateSelector.tsx uses Card components, heading "Choose a Template"
    this.templateCards = page.locator('.grid > .cursor-pointer')
    this.templateSelectorHeading = page.getByRole('heading', { name: /Choose a Template/i }).first()

    // Editor shell — CrossTableToolbar renders title as h1, badges as Badge components
    this.editorTitle = page.locator('h1').first()
    this.templateBadge = page.locator('.border-b Badge[variant="outline"]').first()
    this.statusBadge = page.locator('.border-b Badge').last()
    this.saveScoresButton = page.getByRole('button', { name: /Save Scores/i })

    // Tab navigation
    this.matrixTab = page.getByRole('tab', { name: /Matrix/i })
    this.weightsTab = page.getByRole('tab', { name: /Weights/i })
    this.resultsTab = page.getByRole('tab', { name: /Results/i })
    this.sensitivityTab = page.getByRole('tab', { name: /Sensitivity/i })
    this.consensusTab = page.getByRole('tab', { name: /Consensus/i })
    this.aiInsightsTab = page.getByRole('tab', { name: /AI Insights/i })

    // Matrix grid — standard <table> inside ScrollArea
    this.matrixGrid = page.locator('table.border-collapse').first()
    // ScoreCell renders as a div with min-h-[44px] containing score buttons or inputs
    this.scoreCells = this.matrixGrid.locator('td .min-h-\\[44px\\]')
    this.addRowButton = page.getByRole('button', { name: /Add Alternative/i })
    // Add criterion button is in the last <th> with a Plus icon
    this.addColumnButton = this.matrixGrid.locator('thead th:last-child button').first()
    // Row headers: sticky left <td> cells with EditableLabel spans
    this.rowHeaders = this.matrixGrid.locator('tbody td.sticky span[title="Double-click to rename"]')
    // Column headers: <th> cells with EditableLabel spans
    this.columnHeaders = this.matrixGrid.locator('thead th span[title="Double-click to rename"]')

    // Weights panel — Slider components rendered by Radix, no data-testid
    this.weightSliders = page.locator('[role="slider"]')
    this.equalWeightsButton = page.getByRole('button', { name: /Equal/i })
    this.ahpWizardButton = page.getByRole('button', { name: /AHP/i })

    // Results panel — Recharts renders SVG containers; ranking is a <table>
    this.resultsChart = page.locator('.recharts-responsive-container').first()
    this.rankingList = page.locator('table').filter({ hasText: 'Rank' })

    // Toolbar actions
    this.exportButton = page.getByRole('button', { name: /Export/i }).first()
    this.shareButton = page.getByRole('button', { name: /Share/i }).first()

    // States
    this.loadingSpinner = page.locator('.animate-spin').first()
    this.errorBanner = page.locator('[class*="bg-destructive"]')
  }

  // ── Navigation ──────────────────────────────────────────────────

  async gotoList() {
    await this.page.goto('/dashboard/tools/cross-table')
  }

  async gotoNew() {
    await this.page.goto('/dashboard/tools/cross-table/new')
  }

  async gotoEditor(id: string) {
    await this.page.goto(`/dashboard/tools/cross-table/${id}`)
  }

  async gotoScorerView(id: string) {
    await this.page.goto(`/dashboard/tools/cross-table/${id}/score`)
  }

  async waitForLoad() {
    await this.page.waitForLoadState('domcontentloaded')
    await Promise.race([
      this.heading.waitFor({ timeout: 15000 }).catch(() => {}),
      this.editorTitle.waitFor({ timeout: 15000 }).catch(() => {}),
      this.templateSelectorHeading.waitFor({ timeout: 15000 }).catch(() => {}),
      this.errorBanner.waitFor({ timeout: 15000 }).catch(() => {}),
    ])
  }

  // ── Template selection ──────────────────────────────────────────

  async selectTemplate(name: string) {
    // TemplateSelector uses Card components with template label as CardTitle
    await this.templateCards.filter({ hasText: name }).first().click()
  }

  // ── Tab navigation ──────────────────────────────────────────────

  async switchToTab(tab: 'Matrix' | 'Weights' | 'Results' | 'Sensitivity' | 'Consensus' | 'AI Insights') {
    await this.page.getByRole('tab', { name: new RegExp(tab, 'i') }).click()
  }

  // ── Matrix interactions ─────────────────────────────────────────

  async clickScoreCell(rowIndex: number, colIndex: number) {
    // Each row in tbody; skip header row. Columns: first td is row header, rest are scores
    const row = this.matrixGrid.locator('tbody tr').nth(rowIndex)
    // +1 to skip the sticky row header td
    await row.locator('td').nth(colIndex + 1).locator('button').first().click()
  }

  async setNumericScore(rowIndex: number, colIndex: number, value: number) {
    // For numeric scoring: click the cell button to enter edit mode, type value, press Enter
    await this.clickScoreCell(rowIndex, colIndex)
    const input = this.page.locator('input[type="number"]').first()
    await input.fill(String(value))
    await input.press('Enter')
  }

  async addRow(name: string) {
    await this.addRowButton.click()
    const input = this.page.locator('input[placeholder*="row"]').last()
    await input.fill(name)
    await input.press('Enter')
  }

  async addColumn(name: string) {
    await this.addColumnButton.click()
    const input = this.page.locator('input[placeholder*="column"], input[placeholder*="criterion"]').last()
    await input.fill(name)
    await input.press('Enter')
  }

  // ── Weights interactions ────────────────────────────────────────

  async setEqualWeights() {
    await this.equalWeightsButton.click()
  }

  // ── Getters ─────────────────────────────────────────────────────

  async getRowCount(): Promise<number> {
    return this.rowHeaders.count()
  }

  async getColumnCount(): Promise<number> {
    return this.columnHeaders.count()
  }

  async getScoreCellCount(): Promise<number> {
    return this.scoreCells.count()
  }
}
