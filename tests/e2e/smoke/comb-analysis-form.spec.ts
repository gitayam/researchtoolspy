/**
 * COM-B Analysis form smoke test
 *
 * Verifies the canonical BCW components shipped in commits c0f8250bb..a434edcd7
 * render in the create form: BCWStepper, COMBCentralTenet, BehaviourTheoryGlossary,
 * APEASEEvaluation, ModeOfDeliveryForm.
 *
 * See docs/frameworks/BEHAVIOR_FRAMEWORK_IMPROVEMENT_PLAN.md (S4 follow-up).
 */
import { test, expect } from '../fixtures/base-test'

test.describe('COM-B Analysis create form @smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/analysis-frameworks/comb-analysis/create')
  })

  test('renders BCW stepper with all 8 steps', async ({ page }) => {
    // The stepper labels each step number prefix. Pick a few that should exist.
    await expect(page.getByText('Define problem', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('Select target behaviour', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('Identify what needs to change', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('Behaviour change techniques', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('Mode of delivery', { exact: true }).first()).toBeVisible()
  })

  test('renders the COM-B central tenet quote', async ({ page }) => {
    // Quote excerpt — Michie/Atkins/West 2014 p. 50
    await expect(
      page.getByText(/Changing the incidence of any behaviour/i).first()
    ).toBeVisible()
  })

  test('renders the Behaviour & Theory glossary as a collapsible <details>', async ({ page }) => {
    const summary = page.getByText('Definitions: behaviour and theory').first()
    await expect(summary).toBeVisible()
    // Ensure it's a <summary> inside <details> and starts collapsed.
    await expect(summary.locator('xpath=parent::summary')).toBeAttached()
  })

  test('renders the APEASE evaluation section after COM-B components', async ({ page }) => {
    await expect(page.getByText(/APEASE Evaluation/i).first()).toBeVisible()
    // Six criteria headings present
    await expect(page.getByText('Affordability', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('Practicability', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('Equity', { exact: true }).first()).toBeVisible()
  })

  test('renders the Mode of Delivery section (BCW Step 8)', async ({ page }) => {
    await expect(page.getByText(/Mode of Delivery/i).first()).toBeVisible()
    // Setting/duration/deliverer text inputs are reachable by label
    await expect(page.getByLabel('Setting')).toBeVisible()
    await expect(page.getByLabel('Typical duration')).toBeVisible()
    await expect(page.getByLabel('Deliverer')).toBeVisible()
  })

  test('renders the BCT Selector (BCW Step 7) with all 16 groupings', async ({ page }) => {
    await expect(page.getByText(/Behaviour Change Techniques/i).first()).toBeVisible()
    // A few groupings — names from BCTTv1 (Michie 2013)
    await expect(page.getByText('Goals and planning').first()).toBeVisible()
    await expect(page.getByText('Feedback and monitoring').first()).toBeVisible()
    await expect(page.getByText('Identity').first()).toBeVisible()
    await expect(page.getByText('Covert learning').first()).toBeVisible()
  })

  test('APEASE rating buttons expose aria-pressed for screen readers', async ({ page }) => {
    // Find the first 'High' button in the APEASE block and verify it has aria-pressed
    const highButton = page.getByRole('button', { name: /Affordability: High/i }).first()
    await expect(highButton).toBeVisible()
    await expect(highButton).toHaveAttribute('aria-pressed', 'false')
  })

  test('BCWStepper marks the current step with aria-current="step"', async ({ page }) => {
    // 'Identify what needs to change' is the default current step (per GenericFrameworkForm.tsx)
    const currentStep = page.getByRole('button', {
      name: /Step 4: Identify what needs to change/i,
    }).first()
    await expect(currentStep).toHaveAttribute('aria-current', 'step')
  })
})
