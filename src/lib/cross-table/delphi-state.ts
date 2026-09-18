/**
 * Whether a cross table is being run as a Delphi process.
 *
 * This is one function rather than an inline check because getting it wrong is invisible:
 * the only symptom is that the matrix quietly stops offering to add a row, and nothing
 * anywhere says why.
 */

import type { CrossTableConfig } from './types'

/** The shape that predates `config.delphi` entirely. */
interface LegacyDelphiFields {
  delphi_enabled?: boolean
  current_round?: number
}

/**
 * Three generations of config have to answer the same question.
 *
 * - **Current**: `delphi.enabled` is a real boolean, set by a facilitator. Believe it.
 * - **Interim** (`delphi` present, no `enabled`): there is no record of anyone choosing
 *   Delphi, because there was nothing to choose with — the round counter was seeded to 1
 *   by the template. So the only admissible evidence that a Delphi process actually
 *   started is a round past the first, or results released. A table sitting at round 1 is
 *   an ordinary matrix that was never asked.
 * - **Legacy** (no `delphi`): `delphi_enabled` was the explicit flag. Believe it.
 */
export function isDelphiActive(config: CrossTableConfig): boolean {
  const delphi = config.delphi
  if (delphi) {
    if (typeof delphi.enabled === 'boolean') return delphi.enabled
    return delphi.current_round > 1 || delphi.results_released === true
  }
  const legacy = config as CrossTableConfig & LegacyDelphiFields
  return Boolean(legacy.delphi_enabled && (legacy.current_round ?? 1) > 0)
}

/** The round to read scores and consensus for, whether or not Delphi is running. */
export function currentDelphiRound(config: CrossTableConfig): number {
  return config.delphi?.current_round ?? 1
}
