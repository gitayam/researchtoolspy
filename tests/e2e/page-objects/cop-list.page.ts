import type { Page, Locator } from '@playwright/test'

/**
 * Page Object Model for the COP Session List Page (/dashboard/cop).
 *
 * The "New COP" button was replaced by "New Workspace" which navigates
 * to /dashboard/workspace/new (the unified workspace wizard).
 */
export class CopListPage {
  readonly page: Page
  readonly heading: Locator
  readonly newWorkspaceButton: Locator
  readonly sessionCards: Locator
  readonly loadingSpinner: Locator
  readonly emptyState: Locator
  readonly errorBanner: Locator

  constructor(page: Page) {
    this.page = page
    this.heading = page.getByRole('heading', { name: 'Operating Pictures' })
    this.newWorkspaceButton = page.getByRole('button', { name: /New Workspace/i })
    this.sessionCards = page.locator('[class*="cursor-pointer"][class*="hover:shadow"]')
    this.loadingSpinner = page.locator('.animate-spin')
    this.emptyState = page.getByText('Create Your First COP')
    this.errorBanner = page.locator('[class*="bg-destructive"]')
  }

  async goto() {
    await this.page.goto('/dashboard/cop')
  }

  async waitForLoad() {
    await this.page.waitForLoadState('networkidle')
    // Wait for either sessions, empty state, or error
    await Promise.race([
      this.heading.waitFor({ timeout: 15000 }).catch(() => {}),
      this.emptyState.waitFor({ timeout: 15000 }).catch(() => {}),
      this.errorBanner.waitFor({ timeout: 15000 }).catch(() => {}),
    ])
  }

  /** Click "New Workspace" which navigates to /dashboard/workspace/new */
  async clickNewCop() {
    await this.newWorkspaceButton.click()
    // Wait for navigation to the workspace wizard page
    await this.page.waitForURL('**/dashboard/workspace/new')
  }

  async clickSession(index: number) {
    await this.sessionCards.nth(index).click()
  }

  async getSessionCount(): Promise<number> {
    return this.sessionCards.count()
  }

  async getSessionName(index: number): Promise<string> {
    const card = this.sessionCards.nth(index)
    const title = card.locator('[class*="font-semibold"][class*="truncate"]')
    return title.textContent() ?? ''
  }
}
