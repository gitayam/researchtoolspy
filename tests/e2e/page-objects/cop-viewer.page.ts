import type { Page, Locator } from '@playwright/test'

/**
 * Page Object Model for the COP Viewer Page (/dashboard/cop/:id).
 */
export class CopViewerPage {
  readonly page: Page

  // Header
  readonly backButton: Locator
  readonly sessionName: Locator
  readonly templateBadge: Locator
  readonly refreshButton: Locator
  readonly cotExportButton: Locator
  readonly shareButton: Locator

  // Map
  readonly mapContainer: Locator
  readonly mapCanvas: Locator

  // Layer panel (non-event_analysis)
  readonly layerPanelHeader: Locator
  readonly layerToggles: Locator

  // Event sidebar (event_analysis)
  readonly eventSidebar: Locator
  readonly sidebarTabs: Locator

  // KPI footer
  readonly kpiStrip: Locator
  readonly activeLayerCount: Locator
  readonly totalFeatureCount: Locator

  // States
  readonly loadingSpinner: Locator
  readonly errorBanner: Locator

  constructor(page: Page) {
    this.page = page

    // Header — scope to the COP's own header (the one with border-b shrink-0, not the sticky dashboard header)
    const copHeader = page.locator('header.shrink-0').first()
    this.backButton = copHeader.getByRole('button', { name: /Back/i })
    this.sessionName = copHeader.locator('h1')
    // shadcn Badge renders as a <div> with "rounded-full" — no "badge" class
    this.templateBadge = copHeader.locator('div.rounded-full').first()
    this.refreshButton = page.locator('button[title="Refresh all layers"]')
    this.cotExportButton = page.locator('button[title*="Cursor-on-Target"]')
    this.shareButton = page.locator('button[title="Copy share link"]')

    // Map
    this.mapContainer = page.locator('[class*="maplibregl-map"], .maplibregl-map').first()
    this.mapCanvas = page.locator('canvas.maplibregl-canvas').first()

    // Layer panel
    this.layerPanelHeader = page.getByText('Layers', { exact: true }).first()
    this.layerToggles = page.locator('button[role="checkbox"]')

    // Event sidebar
    this.eventSidebar = page.locator('aside.w-72')
    this.sidebarTabs = page.locator('aside.w-72 button[title]')

    // KPI
    this.kpiStrip = page.locator('footer')
    this.activeLayerCount = page.locator('footer').getByText(/active layer/i)
    this.totalFeatureCount = page.locator('footer').getByText(/total feature/i)

    // States
    this.loadingSpinner = page.locator('.animate-spin').first()
    this.errorBanner = page.locator('[class*="bg-destructive"]')
  }

  async goto(sessionId: string) {
    await this.page.goto(`/dashboard/cop/${sessionId}`)
  }

  async waitForLoad() {
    // Wait for DOM content to load (not networkidle — MapLibre tile requests prevent idle)
    await this.page.waitForLoadState('domcontentloaded')
    // Wait for either the session name or an error to appear
    await Promise.race([
      this.sessionName.waitFor({ timeout: 15000 }).catch(() => {}),
      this.errorBanner.waitFor({ timeout: 15000 }).catch(() => {}),
    ])
  }

  async getSessionName(): Promise<string> {
    return (await this.sessionName.textContent()) ?? ''
  }

  async getTemplateBadge(): Promise<string> {
    return (await this.templateBadge.textContent()) ?? ''
  }

  async getActiveLayerCountText(): Promise<string> {
    return (await this.activeLayerCount.textContent()) ?? ''
  }

  async getTotalFeatureCountText(): Promise<string> {
    return (await this.totalFeatureCount.textContent()) ?? ''
  }

  // ── Layer management ───────────────────────────────────────

  async toggleLayer(layerName: string) {
    const layerButton = this.page.locator(`button[role="checkbox"]`).filter({ hasText: layerName })
    await layerButton.click()
  }

  async isLayerActive(layerName: string): Promise<boolean> {
    const layerButton = this.page.locator(`button[role="checkbox"]`).filter({ hasText: layerName })
    const ariaChecked = await layerButton.getAttribute('aria-checked')
    return ariaChecked === 'true'
  }

  async getVisibleLayerCount(): Promise<number> {
    const checked = this.page.locator('button[role="checkbox"][aria-checked="true"]')
    return checked.count()
  }

  // ── Event sidebar tabs ─────────────────────────────────────

  async clickSidebarTab(label: string) {
    await this.page.locator(`aside.w-72 button[title="${label}"]`).click()
  }

  async getSidebarTabCount(): Promise<number> {
    return this.sidebarTabs.count()
  }

  // ── Actions ────────────────────────────────────────────────

  async clickRefresh() {
    await this.refreshButton.click()
  }

  async clickCotExport() {
    await this.cotExportButton.click()
  }

  async clickShare() {
    await this.shareButton.click()
  }

  async clickBack() {
    await this.backButton.click()
  }

  // ── Map assertions ─────────────────────────────────────────

  async isMapVisible(): Promise<boolean> {
    // Check if the map container (canvas or fallback) exists and is visible
    const mapOrFallback = this.page.locator('[data-testid="cop-map"], [data-testid="cop-map-fallback"]').first()
    return mapOrFallback.isVisible().catch(() => false)
  }

  async waitForMapLoad() {
    // Wait for MapLibre canvas or fallback
    await this.page.locator('[data-testid="cop-map"], [data-testid="cop-map-fallback"], canvas').first().waitFor({ timeout: 15000 })
  }
}
