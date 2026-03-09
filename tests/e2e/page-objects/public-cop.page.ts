import type { Page, Locator } from '@playwright/test'

/**
 * Page Object Model for the Public COP Share Page (/public/cop/:token).
 */
export class PublicCopPage {
  readonly page: Page

  readonly sessionName: Locator
  readonly templateBadge: Locator
  readonly mapContainer: Locator
  readonly mapCanvas: Locator
  readonly panels: Locator
  readonly rfiSection: Locator
  readonly eventSection: Locator
  readonly footer: Locator
  readonly loadingSpinner: Locator
  readonly errorBanner: Locator
  readonly notFoundMessage: Locator

  constructor(page: Page) {
    this.page = page
    this.sessionName = page.locator('h1').first()
    this.templateBadge = page.locator('[class*="badge"]').first()
    this.mapContainer = page.locator('.maplibregl-map').first()
    this.mapCanvas = page.locator('canvas.maplibregl-canvas').first()
    this.panels = page.locator('aside')
    this.rfiSection = page.getByText(/RFI/i).first()
    this.eventSection = page.getByText(/Event/i).first()
    this.footer = page.locator('footer')
    this.loadingSpinner = page.locator('.animate-spin').first()
    this.errorBanner = page.locator('[class*="bg-red"]')
    this.notFoundMessage = page.getByText(/not found|invalid/i)
  }

  async goto(token: string) {
    await this.page.goto(`/public/cop/${token}`)
  }

  async waitForLoad() {
    await this.page.waitForLoadState('networkidle')
    await Promise.race([
      this.sessionName.waitFor({ timeout: 15000 }).catch(() => {}),
      this.errorBanner.waitFor({ timeout: 15000 }).catch(() => {}),
      this.notFoundMessage.waitFor({ timeout: 15000 }).catch(() => {}),
    ])
  }

  async getSessionName(): Promise<string> {
    return (await this.sessionName.textContent()) ?? ''
  }

  async isMapVisible(): Promise<boolean> {
    return this.page.locator('canvas').first().isVisible().catch(() => false)
  }

  // ── RFI Answer submission ──────────────────────────────────

  async submitRfiAnswer(options: {
    rfiId: string
    answer: string
    name?: string
    sourceUrl?: string
  }) {
    // Find the answer textarea within the RFI section
    const answerInput = this.page.getByPlaceholder(/answer|response/i)
    await answerInput.fill(options.answer)

    if (options.name) {
      const nameInput = this.page.getByPlaceholder(/your name/i)
      await nameInput.fill(options.name)
    }

    if (options.sourceUrl) {
      const urlInput = this.page.getByPlaceholder(/source.*url/i)
      await urlInput.fill(options.sourceUrl)
    }

    await this.page.getByRole('button', { name: /submit/i }).click()
  }
}
