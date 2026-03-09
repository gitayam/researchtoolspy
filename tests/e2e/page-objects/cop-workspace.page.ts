import type { Page, Locator } from '@playwright/test'

/**
 * Page Object Model for the COP Workspace Page (/dashboard/cop/:id).
 *
 * Covers the high-velocity workflow panels: header, mode toggle, status strip,
 * blocker strip, command palette, persona panel, evidence feed, and map.
 */
export class CopWorkspacePage {
  readonly page: Page

  // ── Header ────────────────────────────────────────────────────
  readonly backButton: Locator
  readonly sessionName: Locator
  readonly templateBadge: Locator
  readonly progressModeButton: Locator
  readonly monitorModeButton: Locator
  readonly inviteButton: Locator
  readonly shareButton: Locator
  readonly cotExportButton: Locator

  // ── Status strip ──────────────────────────────────────────────
  readonly statusStrip: Locator
  readonly missionBriefText: Locator
  readonly missionBriefEditTrigger: Locator
  readonly missionBriefInput: Locator
  readonly missionBriefSaveButton: Locator

  // ── Blocker strip ─────────────────────────────────────────────
  readonly blockerStrip: Locator
  readonly blockerLabel: Locator
  readonly blockerResolveButtons: Locator

  // ── Quick Capture (Global Capture Bar) ───────────────────────
  readonly captureBar: Locator
  readonly captureInput: Locator
  readonly captureSubmitButton: Locator
  readonly captureTypeLabel: Locator
  readonly captureKeyboardHint: Locator

  // ── Panel grid (Progress mode) ────────────────────────────────
  readonly entityRelationshipsPanel: Locator
  readonly timelinePanel: Locator
  readonly personasPanel: Locator
  readonly questionsPanel: Locator
  readonly analysisPanel: Locator
  readonly evidencePanel: Locator
  readonly activityPanel: Locator
  readonly mapPanel: Locator
  readonly showMapButton: Locator

  // ── Persona panel ─────────────────────────────────────────────
  readonly addPersonaButton: Locator
  readonly personaFormNameInput: Locator
  readonly personaFormPlatformSelect: Locator
  readonly personaFormHandleInput: Locator
  readonly personaFormNotesInput: Locator
  readonly personaFormCreateButton: Locator
  readonly personaFormCancelButton: Locator
  readonly personaCards: Locator
  readonly personaEmptyState: Locator

  // ── Evidence feed ─────────────────────────────────────────────
  readonly evidenceFeedHeader: Locator
  readonly feedViewButton: Locator
  readonly galleryViewButton: Locator
  readonly evidenceUrlInput: Locator
  readonly evidenceSubmitButton: Locator
  readonly evidenceItems: Locator
  readonly evidencePinButtons: Locator
  readonly evidenceTypeFilters: Locator

  // ── States ────────────────────────────────────────────────────
  readonly loadingSpinner: Locator
  readonly errorBanner: Locator

  constructor(page: Page) {
    this.page = page

    // Header
    const copHeader = page.locator('header.shrink-0').first()
    this.backButton = copHeader.getByRole('button', { name: /Back/i })
    this.sessionName = copHeader.locator('h1')
    this.templateBadge = copHeader.locator('div.rounded-full, span.rounded-full').first()
    this.progressModeButton = page.locator('[data-testid="mode-progress"]')
    this.monitorModeButton = page.locator('[data-testid="mode-monitor"]')
    this.inviteButton = page.locator('button[title="Invite collaborator"]')
    this.shareButton = page.locator('button[title="Copy share link"]')
    this.cotExportButton = page.locator('button[title*="Cursor-on-Target"]')

    // Status strip -- the component that contains "Mission Brief:" and KPI badges
    this.statusStrip = page.locator('div').filter({ hasText: /Mission Brief/i }).first()
    this.missionBriefText = page.getByText('Mission Brief:').locator('..')
    this.missionBriefEditTrigger = page.getByText('Set mission objective so newcomers know what to work on')
    this.missionBriefInput = page.locator('input[placeholder*="e.g. Geoguess"]')
    this.missionBriefSaveButton = page.locator('button').filter({ has: page.locator('svg') }).locator('text=check, path[d*="M20 6"]').first()

    // Blocker strip
    this.blockerStrip = page.locator('[role="alert"]').filter({ hasText: /Blocker/i })
    this.blockerLabel = page.getByText('Blocker', { exact: false })
    this.blockerResolveButtons = page.getByRole('button', { name: 'Go to Blocker' })

    // Quick Capture (Global Capture Bar — always-visible sticky bar)
    this.captureBar = page.locator('.sticky.top-0.z-30').first()
    this.captureInput = this.captureBar.locator('input[type="text"]')
    this.captureSubmitButton = this.captureBar.getByRole('button', { name: /Capture/i })
    this.captureTypeLabel = this.captureBar.locator('span.font-bold.text-gray-300').first()
    this.captureKeyboardHint = page.locator('[data-testid="capture-kbd-hint"]')

    // Panels (identified by their panel expander titles)
    this.entityRelationshipsPanel = page.getByText('Entity Relationships', { exact: true }).locator('..').locator('..')
    this.timelinePanel = page.getByText('Timeline', { exact: true }).locator('..').locator('..')
    this.personasPanel = page.getByText('Personas').first().locator('..').locator('..')
    this.questionsPanel = page.getByText('Key Questions & RFIs', { exact: true }).locator('..').locator('..')
    this.analysisPanel = page.getByText('Analysis & Hypotheses', { exact: true }).locator('..').locator('..')
    this.evidencePanel = page.getByText('Evidence & Intel Feed', { exact: true }).locator('..').locator('..')
    this.activityPanel = page.getByText('Activity Log', { exact: true }).locator('..').locator('..')
    this.mapPanel = page.getByText('Map', { exact: true }).locator('..').locator('..')
    this.showMapButton = page.getByText('Show Map Panel')

    // Persona panel internals
    this.addPersonaButton = page.getByRole('button', { name: /Add Persona/i })
    this.personaFormNameInput = page.locator('input[placeholder="Display name"]')
    this.personaFormPlatformSelect = page.locator('select').filter({ has: page.locator('option[value="twitter"]') })
    this.personaFormHandleInput = page.locator('input[placeholder*="@handle"]')
    this.personaFormNotesInput = page.locator('textarea[placeholder*="Notes"]')
    this.personaFormCreateButton = page.getByRole('button', { name: 'Create' })
    this.personaFormCancelButton = page.getByRole('button', { name: 'Cancel' })
    this.personaCards = page.locator('div.grid div[class*="rounded"][class*="border"]').filter({ has: page.locator('button') })
    this.personaEmptyState = page.getByText('No personas tracked yet.')

    // Evidence feed internals
    this.evidenceFeedHeader = page.getByText('Evidence & Intel Feed', { exact: true }).first()
    this.feedViewButton = page.locator('button[aria-label="Feed view"]')
    this.galleryViewButton = page.locator('button[aria-label="Gallery view"]')
    this.evidenceUrlInput = page.locator('input[placeholder="Paste URL to analyze..."]')
    this.evidenceSubmitButton = this.evidenceUrlInput.locator('..').locator('button')
    this.evidenceItems = page.locator('#evidence-feed-scroll .space-y-1\\.5 > div')
    this.evidencePinButtons = page.locator('button[aria-label="Pin to map"]')
    this.evidenceTypeFilters = page.locator('button').filter({ hasText: /^(All|Evidence|Analysis|Entity|URL Analysis)/ })

    // States
    this.loadingSpinner = page.locator('.animate-spin').first()
    this.errorBanner = page.locator('[class*="bg-destructive"]')
  }

  // ── Navigation ──────────────────────────────────────────────────

  async goto(sessionId: string) {
    await this.page.goto(`/dashboard/cop/${sessionId}`)
  }

  async waitForLoad() {
    await this.page.waitForLoadState('domcontentloaded')
    await Promise.race([
      this.sessionName.waitFor({ timeout: 15000 }).catch(() => {}),
      this.errorBanner.waitFor({ timeout: 15000 }).catch(() => {}),
    ])
  }

  // ── Mode switching ──────────────────────────────────────────────

  async switchToProgressMode() {
    await this.progressModeButton.click()
  }

  async switchToMonitorMode() {
    await this.monitorModeButton.click()
  }

  // ── Keyboard shortcuts ──────────────────────────────────────────

  async pressCommandK() {
    await this.page.keyboard.press('Meta+k')
  }

  async pressCommandM() {
    await this.page.keyboard.press('Meta+m')
  }

  async pressCommand1() {
    await this.page.keyboard.press('Meta+1')
  }

  async pressCommand2() {
    await this.page.keyboard.press('Meta+2')
  }

  async pressEscape() {
    await this.page.keyboard.press('Escape')
  }

  // ── Quick Capture (Global Capture Bar) ──────────────────────────

  async focusCaptureInput() {
    await this.captureInput.click()
  }

  async typeCaptureInput(text: string) {
    await this.captureInput.fill(text)
  }

  async submitCapture() {
    await this.captureSubmitButton.click()
  }

  async clearCaptureInput() {
    await this.captureInput.fill('')
  }

  // ── Persona panel ───────────────────────────────────────────────

  async clickAddPersona() {
    await this.addPersonaButton.click()
  }

  async fillPersonaForm(opts: { name: string; platform?: string; handle?: string; notes?: string }) {
    await this.personaFormNameInput.fill(opts.name)
    if (opts.platform) {
      await this.personaFormPlatformSelect.selectOption(opts.platform)
    }
    if (opts.handle) {
      await this.personaFormHandleInput.fill(opts.handle)
    }
    if (opts.notes) {
      await this.personaFormNotesInput.fill(opts.notes)
    }
  }

  async submitPersonaForm() {
    await this.personaFormCreateButton.click()
  }

  // ── Evidence feed ───────────────────────────────────────────────

  async switchToGalleryView() {
    await this.galleryViewButton.click()
  }

  async switchToFeedView() {
    await this.feedViewButton.click()
  }

  async submitEvidenceUrl(url: string) {
    await this.evidenceUrlInput.fill(url)
    await this.evidenceSubmitButton.click()
  }

  // ── Getters ─────────────────────────────────────────────────────

  async getSessionNameText(): Promise<string> {
    return (await this.sessionName.textContent()) ?? ''
  }

  async getCaptureRoutingLabel(): Promise<string> {
    return (await this.captureTypeLabel.textContent()) ?? ''
  }
}
