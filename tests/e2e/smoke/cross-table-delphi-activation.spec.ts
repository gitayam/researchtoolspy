import { test, expect } from '@playwright/test'
import { isDelphiActive } from '../../../src/lib/cross-table/delphi-state'
import { TEMPLATES } from '../../../src/lib/cross-table/engine/templates'
import type { CrossTableConfig } from '../../../src/lib/cross-table/types'

/**
 * Why this exists: `MatrixGrid` decided a table was a Delphi process from
 * `config.delphi.current_round > 0`, and every template seeds `current_round: 1`. So every
 * cross table ever created rendered in facilitator mode, which hides add/remove/reorder for
 * both rows and columns. Both tables in production were in that state, neither by choice —
 * the config shape simply had nowhere to record the choice.
 *
 * The failure was silent in the worst way: the matrix looked finished rather than locked.
 */

function config(delphi: unknown, extra: Record<string, unknown> = {}): CrossTableConfig {
  return { rows: [], columns: [], delphi, ...extra } as unknown as CrossTableConfig
}

test.describe('cross-table Delphi activation @smoke', () => {
  test('a freshly templated table is an ordinary matrix, not a Delphi panel', () => {
    for (const [name, template] of Object.entries(TEMPLATES)) {
      expect(template.delphi, name).toBeDefined()
      expect(isDelphiActive(config(template.delphi)), name).toBe(false)
    }
  })

  test('an explicit flag is believed in both directions', () => {
    expect(isDelphiActive(config({ enabled: true, current_round: 1, results_released: false }))).toBe(true)
    // Including against the old inference: round 4 with the process stopped is stopped.
    expect(isDelphiActive(config({ enabled: false, current_round: 4, results_released: true }))).toBe(false)
  })

  test('a config written before the flag is read from what a facilitator actually did', () => {
    // The exact shape stored for both production tables: the template default, untouched.
    expect(isDelphiActive(config({ current_round: 1, results_released: false }))).toBe(false)
    // Rounds only advance when someone advances them, and results only release on request.
    expect(isDelphiActive(config({ current_round: 2, results_released: false }))).toBe(true)
    expect(isDelphiActive(config({ current_round: 1, results_released: true }))).toBe(true)
  })

  test('the pre-config.delphi shape keeps its own explicit flag', () => {
    expect(isDelphiActive(config(undefined, { delphi_enabled: true, current_round: 1 }))).toBe(true)
    expect(isDelphiActive(config(undefined, { delphi_enabled: false, current_round: 3 }))).toBe(false)
    expect(isDelphiActive(config(undefined))).toBe(false)
  })
})
