import type { CrossTableConfig, Score, SensitivityPoint, TornadoEntry, RowResult } from '../types'
import { computeRankings } from './ranking'
import { normalizeWeights } from './weighting'

/**
 * Perform sensitivity analysis by perturbing one criterion's weight at a time.
 * Returns sensitivity points for each perturbation step.
 */
export function sensitivityAnalysis(
  config: CrossTableConfig,
  scores: Score[],
  /** Perturbation steps as fractions, e.g. [-0.5, -0.3, -0.1, 0.1, 0.3, 0.5] */
  steps: number[] = [-0.5, -0.3, -0.1, 0.1, 0.3, 0.5]
): SensitivityPoint[] {
  const { columns } = config
  const points: SensitivityPoint[] = []

  for (const col of columns) {
    for (const step of steps) {
      const perturbedConfig = perturbWeight(config, col.id, step)
      const results = computeRankings(perturbedConfig, scores)

      const colObj = perturbedConfig.columns.find(c => c.id === col.id)!
      points.push({
        col_id: col.id,
        original_weight: col.weight,
        perturbed_weight: colObj.weight,
        scores: Object.fromEntries(results.map(r => [r.row_id, r.weighted_score])),
        ranks: Object.fromEntries(results.map(r => [r.row_id, r.rank])),
      })
    }
  }

  return points
}

/** Create a modified config with one weight perturbed and others re-normalized */
function perturbWeight(config: CrossTableConfig, colId: string, delta: number): CrossTableConfig {
  const columns = config.columns.map(c => ({ ...c }))
  const idx = columns.findIndex(c => c.id === colId)
  if (idx === -1) return config

  const original = columns[idx].weight
  const perturbed = Math.max(0, original * (1 + delta))
  columns[idx].weight = perturbed

  // Re-normalize all weights
  const raw = columns.map(c => c.weight)
  const normalized = normalizeWeights(raw)
  columns.forEach((c, i) => { c.weight = normalized[i] })

  return {
    ...config,
    columns,
    weighting: { ...config.weighting, method: 'manual' },
  }
}

/**
 * Generate tornado chart data for a specific row (alternative).
 * Shows the score swing when each criterion weight is perturbed ± the given fraction.
 */
export function tornadoData(
  config: CrossTableConfig,
  scores: Score[],
  targetRowId: string,
  perturbFraction: number = 0.5
): TornadoEntry[] {
  const baseResults = computeRankings(config, scores)
  const baseResult = baseResults.find(r => r.row_id === targetRowId)
  if (!baseResult) return []

  return config.columns.map(col => {
    const lowConfig = perturbWeight(config, col.id, -perturbFraction)
    const highConfig = perturbWeight(config, col.id, perturbFraction)

    const lowResults = computeRankings(lowConfig, scores)
    const highResults = computeRankings(highConfig, scores)

    const lowScore = lowResults.find(r => r.row_id === targetRowId)?.weighted_score ?? 0
    const highScore = highResults.find(r => r.row_id === targetRowId)?.weighted_score ?? 0

    return {
      col_id: col.id,
      label: col.label,
      low: lowScore,
      high: highScore,
      base: baseResult.weighted_score,
    }
  }).sort((a, b) => (b.high - b.low) - (a.high - a.low))
}

/**
 * Find the break-even weight for a criterion where the top-ranked row changes.
 * Returns the weight fraction at which rank #1 flips, or null if no flip within range.
 */
export function breakEvenWeight(
  config: CrossTableConfig,
  scores: Score[],
  colId: string,
  searchRange: number = 0.99,
  searchSteps: number = 50
): number | null {
  const baseResults = computeRankings(config, scores)
  if (baseResults.length < 2) return null
  const topRowId = baseResults[0].row_id

  for (let i = 1; i <= searchSteps; i++) {
    const delta = (searchRange * i) / searchSteps
    // Check both directions
    for (const d of [-delta, delta]) {
      const perturbed = perturbWeight(config, colId, d)
      const results = computeRankings(perturbed, scores)
      if (results.length > 0 && results[0].row_id !== topRowId) {
        return d
      }
    }
  }

  return null
}
