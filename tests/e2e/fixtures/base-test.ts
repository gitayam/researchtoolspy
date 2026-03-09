/**
 * Extended Playwright test with COP page object fixtures.
 *
 * Import { test, expect } from this file instead of @playwright/test
 * to get typed page object fixtures automatically.
 */
import { test as base, expect } from '@playwright/test'
import { CopListPage } from '../page-objects/cop-list.page'
import { CopWizardPage } from '../page-objects/cop-wizard.page'
import { CopViewerPage } from '../page-objects/cop-viewer.page'
import { CopWorkspacePage } from '../page-objects/cop-workspace.page'
import { PublicCopPage } from '../page-objects/public-cop.page'

export interface Fixtures {
  copListPage: CopListPage
  copWizardPage: CopWizardPage
  copViewerPage: CopViewerPage
  copWorkspacePage: CopWorkspacePage
  publicCopPage: PublicCopPage
}

export const test = base.extend<Fixtures>({
  copListPage: async ({ page }, use) => {
    await use(new CopListPage(page))
  },
  copWizardPage: async ({ page }, use) => {
    await use(new CopWizardPage(page))
  },
  copViewerPage: async ({ page }, use) => {
    await use(new CopViewerPage(page))
  },
  copWorkspacePage: async ({ page }, use) => {
    await use(new CopWorkspacePage(page))
  },
  publicCopPage: async ({ page }, use) => {
    await use(new PublicCopPage(page))
  },
})

export { expect }
