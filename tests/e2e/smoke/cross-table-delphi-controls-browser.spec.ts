import { test, expect } from '../fixtures/base-test'

/**
 * The rendered half of the Delphi fix.
 *
 * `cross-table-delphi-activation.spec.ts` pins `isDelphiActive` as a function. This pins the
 * consequence, because the bug was never visible as a wrong boolean — it was visible as a
 * matrix that had quietly stopped offering to add a row, with nothing anywhere saying why.
 *
 * The config below is the exact shape both production tables store: `current_round: 1`,
 * `results_released: false`, and no `enabled` key, because they were written before the flag
 * existed. That combination is what used to switch facilitator mode on for every table ever
 * created from a template.
 */

const TABLE_ID = 'ct-delphi-controls-001'

/** Precisely what production has. Do not "tidy" this by adding `enabled` — that is the point. */
const STORED_DELPHI_BEFORE_THE_FLAG = { current_round: 1, results_released: false }

function buildTable(delphi: unknown) {
  return {
    id: TABLE_ID,
    user_id: 1,
    title: 'Location',
    description: 'Production-shaped table',
    template_type: 'carvar',
    status: 'scoring',
    config: {
      rows: [
        { id: 'row-1', label: 'Target 1', order: 0 },
        { id: 'row-2', label: 'Target 2', order: 1 },
      ],
      columns: [
        { id: 'col-1', label: 'Criticality', weight: 1, order: 0 },
        { id: 'col-2', label: 'Accessibility', weight: 1, order: 1 },
      ],
      scoring: { method: 'numeric', scale: { min: 1, max: 5 }, labels: null },
      weighting: { method: 'manual' },
      display: { show_totals: true, sort_by_score: false, color_scale: 'red-green' },
      delphi,
    },
    is_public: false,
    share_token: null,
    created_at: '2026-03-12T00:00:00Z',
    updated_at: '2026-03-12T10:00:00Z',
  }
}

async function openTable(page: import('@playwright/test').Page, delphi: unknown) {
  const table = buildTable(delphi)
  await page.route('**/api/workspaces**', route => route.fulfill({ status: 200, json: { workspaces: [] } }))
  await page.route(`**/api/cross-table/${TABLE_ID}/scores**`, route => route.fulfill({ status: 200, json: { scores: [] } }))
  await page.route(`**/api/cross-table/${TABLE_ID}/scorers**`, route => route.fulfill({ status: 200, json: { scorers: [] } }))
  await page.route(`**/api/cross-table/${TABLE_ID}**`, route => route.fulfill({ status: 200, json: { table, scores: [] } }))
  await page.goto(`/dashboard/tools/cross-table/${TABLE_ID}`)
}

test.describe('cross-table Delphi controls @smoke', () => {
  test('@smoke a production-shaped table offers Add row and Add criterion', async ({ page }) => {
    await openTable(page, STORED_DELPHI_BEFORE_THE_FLAG)

    // Both were hidden on every table in production, because presence of the delphi object
    // was read as "facilitator mode on".
    await expect(page.getByRole('button', { name: 'Add Alternative' })).toBeVisible()
    // Addressable by name only since this pass: the add-criterion control is an icon-only
    // button whose words lived in a sibling Tooltip, so assistive tech announced it as
    // "button". Writing this test is what surfaced that.
    await expect(page.getByRole('button', { name: 'Add criterion' })).toBeVisible()
  })

  test('@smoke a table with Delphi explicitly on hides structural edits', async ({ page }) => {
    // The other direction matters as much: if this passed regardless, the test would be
    // asserting nothing about Delphi at all.
    await openTable(page, { enabled: true, current_round: 2, results_released: false })

    await expect(page.getByRole('button', { name: 'Add criterion' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Add Alternative' })).toHaveCount(0)
  })
})
