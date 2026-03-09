import type { Page, Locator } from '@playwright/test'

/**
 * Page Object Model for the Workspace Creation Wizard (/dashboard/workspace/new).
 *
 * The wizard is a full-page component (NewWorkspacePage) with these flows:
 *   Standard:       Purpose -> Details -> Location -> Time Window -> Key Questions  (5 steps)
 *   Event Analysis: Purpose -> Details -> Event Details -> Location -> Time Window -> Key Questions  (6 steps)
 *
 * The old COP wizard was a 4-step dialog; this replaces it as a unified workspace wizard.
 */
export class CopWizardPage {
  readonly page: Page
  readonly title: Locator
  readonly nextButton: Locator
  readonly backButton: Locator
  readonly cancelButton: Locator
  readonly createButton: Locator
  readonly errorBanner: Locator
  readonly loadingSpinner: Locator

  constructor(page: Page) {
    this.page = page
    this.title = page.getByRole('heading', { name: 'Create Workspace' })
    // Scope buttons to the wizard container
    const wizardContainer = page.locator('.max-w-2xl').first()
    this.nextButton = wizardContainer.getByRole('button', { name: /Next/i })
    // The wizard footer has a "Back" button inside a border-t navigation bar
    // Use .last() to skip the top-of-page "Back" link and get the wizard nav button
    this.backButton = wizardContainer.getByRole('button', { name: /^Back$/i }).last()
    this.cancelButton = wizardContainer.getByRole('button', { name: /Cancel/i })
    this.createButton = wizardContainer.getByRole('button', { name: /Create Workspace/i })
    this.errorBanner = page.locator('[class*="bg-destructive"]')
    this.loadingSpinner = page.locator('.animate-spin')
  }

  async waitForWizard() {
    await this.title.waitFor({ timeout: 10000 })
  }

  // ── Step 0: Purpose ────────────────────────────────────────

  async selectTemplate(label: string) {
    await this.page.getByText(label, { exact: false }).locator('..').locator('..').first().click()
  }

  /**
   * Select a workspace type by its legacy template key.
   *
   * The new wizard uses unified workspace types (e.g. "quick_analysis"
   * instead of "quick_brief"), but the E2E tests pass old template keys.
   * This mapping bridges the gap.
   */
  async selectTemplateByType(type: string) {
    // Map old COP template keys -> new workspace type labels
    const templateLabels: Record<string, string> = {
      quick_brief: 'Quick Analysis',
      event_monitor: 'Event Monitor',
      area_study: 'Deep Research',
      crisis_response: 'Crisis Response',
      event_analysis: 'Event Analysis',
      custom: 'Topic Exploration',
    }
    const label = templateLabels[type] ?? type
    const button = this.page.locator('button').filter({ hasText: label }).first()
    await button.click()
  }

  // ── Step 1: Details ────────────────────────────────────────

  async fillTitle(text: string) {
    await this.page.locator('#ws-title').fill(text)
  }

  async fillDescription(text: string) {
    await this.page.locator('#ws-description').fill(text)
  }

  /** Fill the required title field with a default value and advance */
  async completeDetailsStep(title?: string) {
    await this.fillTitle(title ?? 'E2E Test Workspace')
    await this.clickNext()
  }

  // ── Event Details step (event_analysis only) ───────────────

  async selectEventType(type: string) {
    await this.page.locator('#event-type').selectOption(type)
  }

  async fillEventDescription(text: string) {
    await this.page.locator('#event-desc').fill(text)
  }

  async fillInitialUrls(urls: string[]) {
    await this.page.locator('#initial-urls').fill(urls.join('\n'))
  }

  // ── Location step ──────────────────────────────────────────

  async fillLocation(text: string) {
    const input = this.page.getByPlaceholder(/Iran, Donbas/i)
    await input.fill(text)
  }

  // ── Time Window step ───────────────────────────────────────

  async selectTimeWindow(label: string) {
    const button = this.page.locator('button').filter({ hasText: label }).first()
    await button.click()
  }

  // ── Key Questions step ─────────────────────────────────────

  async addQuestion(text: string) {
    const input = this.page.getByPlaceholder(/intelligence question/i)
    await input.fill(text)
    await this.page.getByRole('button', { name: /Add/i }).click()
  }

  async getQuestionCount(): Promise<number> {
    return this.page.locator('[class*="bg-muted/50"]').count()
  }

  async removeQuestion(index: number) {
    const removeButtons = this.page.locator('button[title="Remove question"]')
    await removeButtons.nth(index).click()
  }

  // ── Navigation ─────────────────────────────────────────────

  async clickNext() {
    await this.nextButton.click()
  }

  async clickBack() {
    await this.backButton.click()
  }

  async clickCreate() {
    await this.createButton.click()
  }

  async isNextDisabled(): Promise<boolean> {
    return this.nextButton.isDisabled()
  }

  // ── Full flow helpers ──────────────────────────────────────

  async createQuickBrief(location: string) {
    await this.selectTemplateByType('quick_brief')
    await this.clickNext()
    await this.fillTitle('Quick Brief')
    await this.clickNext()
    await this.fillLocation(location)
    await this.clickNext()
    await this.selectTimeWindow('1h')
    await this.clickNext()
    await this.clickCreate()
  }

  async createEventAnalysis(options: {
    eventType: string
    description: string
    location: string
    timeWindow: string
    questions?: string[]
  }) {
    await this.selectTemplateByType('event_analysis')
    await this.clickNext()
    await this.fillTitle('Event Analysis')
    await this.clickNext()
    await this.selectEventType(options.eventType)
    await this.fillEventDescription(options.description)
    await this.clickNext()
    await this.fillLocation(options.location)
    await this.clickNext()
    await this.selectTimeWindow(options.timeWindow)
    await this.clickNext()
    if (options.questions) {
      for (const q of options.questions) {
        await this.addQuestion(q)
      }
    }
    await this.clickCreate()
  }
}
