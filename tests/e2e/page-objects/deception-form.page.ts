import type { Page, Locator } from '@playwright/test'
import { URLS } from '../helpers/test-data'

/**
 * Page Object Model for the Deception Detection Form page.
 * Covers the actor picker, credibility card, and scoring sections.
 */
export class DeceptionFormPage {
  readonly page: Page

  // -- Navigation --
  readonly backButton: Locator
  readonly pageTitle: Locator

  // -- Basic Info --
  readonly titleInput: Locator
  readonly descriptionInput: Locator

  // -- Actor Picker --
  readonly actorPickerLabel: Locator
  readonly actorSearchInput: Locator
  readonly actorDropdown: Locator
  readonly actorDropdownItems: Locator
  readonly actorSearchLoading: Locator
  readonly actorNoResults: Locator
  readonly selectedActorDisplay: Locator
  readonly clearActorButton: Locator

  // -- Credibility Card --
  readonly credibilityCard: Locator
  readonly credibilityCardTitle: Locator
  readonly credibilityAssessmentCount: Locator
  readonly preFillScoresButton: Locator
  readonly credibilityEmptyState: Locator
  readonly credibilityLoading: Locator

  // -- Tabs --
  readonly scenarioTab: Locator
  readonly momTab: Locator
  readonly assessmentTab: Locator

  // -- Scoring --
  readonly scoringSection: Locator

  // -- Actions --
  readonly saveButton: Locator
  readonly aiAnalysisButton: Locator

  // -- States --
  readonly errorAlert: Locator

  constructor(page: Page) {
    this.page = page

    // Navigation
    this.backButton = page.getByRole('button', { name: /Back to Analyses/i })
    this.pageTitle = page.getByRole('heading', { level: 1 })

    // Basic Info
    this.titleInput = page.locator('#title')
    this.descriptionInput = page.locator('#description')

    // Actor Picker -- matches DeceptionForm.tsx inline actor picker
    this.actorPickerLabel = page.getByText('Subject Actor')
    this.actorSearchInput = page.getByPlaceholder('Search for an actor to assess...').first()
    this.actorDropdown = page.locator('.absolute.z-50').first()
    this.actorDropdownItems = this.actorDropdown.locator('button')
    this.actorSearchLoading = page.getByText('Searching...')
    this.actorNoResults = page.getByText('No actors found. Try a different search term.')
    this.selectedActorDisplay = page.locator('.bg-accent').filter({ hasText: /.+/ }).first()
    this.clearActorButton = this.selectedActorDisplay.getByRole('button')

    // Credibility Card -- glassmorphism card with .backdrop-blur-sm
    this.credibilityCard = page.locator('.backdrop-blur-sm').filter({ hasText: /Credibility Profile/i }).first()
    this.credibilityCardTitle = page.getByText('Credibility Profile')
    this.credibilityAssessmentCount = page.getByText(/previous assessment/i).first()
    this.preFillScoresButton = page.getByRole('button', { name: /Pre-fill from profile/i })
    this.credibilityEmptyState = page.getByText('No previous assessments for this actor').first()
    this.credibilityLoading = page.getByText('Loading credibility data...')

    // Tabs
    this.scenarioTab = page.getByRole('tab', { name: /scenario/i })
    this.momTab = page.getByRole('tab', { name: /mom/i })
    this.assessmentTab = page.getByRole('tab', { name: /assessment/i })

    // Scoring
    this.scoringSection = page.getByText('Scoring', { exact: false }).locator('..').locator('..')

    // Actions
    this.saveButton = page.getByRole('button', { name: /save/i })
    this.aiAnalysisButton = page.getByRole('button', { name: /ai.*analy/i })

    // States
    this.errorAlert = page.locator('[class*="destructive"]')
  }

  // -- Navigation --

  async goto() {
    await this.page.goto(URLS.deceptionCreate)
  }

  async waitForLoad() {
    await this.page.waitForLoadState('domcontentloaded')
    await this.pageTitle.waitFor({ timeout: 15000 })
  }

  // -- Actor Picker interactions --

  async searchForActor(query: string) {
    await this.actorSearchInput.fill(query)
  }

  async selectActorFromDropdown(index = 0) {
    await this.actorDropdownItems.nth(index).click()
  }

  async clearSelectedActor() {
    await this.clearActorButton.click()
  }

  // -- Form interactions --

  async fillBasicInfo(title: string, description?: string) {
    await this.titleInput.fill(title)
    if (description) {
      await this.descriptionInput.fill(description)
    }
  }

  async clickPreFillScores() {
    await this.preFillScoresButton.click()
  }

  async clickSave() {
    await this.saveButton.click()
  }
}
