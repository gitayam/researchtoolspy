import type { CrossTableConfig, Score, RowResult } from '../types'
import { normalizeScore, getColumnScoringMethod, getColumnNormConfig } from './scoring'
import { getWeights } from './weighting'

/** Compute weighted scores and rankings for all rows */
export function computeRankings(
  config: CrossTableConfig,
  scores: Score[]
): RowResult[] {
  const { rows, columns, weighting } = config
  const weights = getWeights(columns, weighting)

  const results: RowResult[] = rows.map(row => {
    const normalizedScores: Record<string, number> = {}
    let weightedScore = 0

    columns.forEach((col, colIdx) => {
      const method = getColumnScoringMethod(col, config.scoring.method)
      const normConfig = getColumnNormConfig(col, {
        min: config.scoring.scale?.min,
        max: config.scoring.scale?.max,
        likert_labels: config.scoring.labels ?? undefined,
      })

      // Find all scores for this cell (may be multiple users)
      const cellScores = scores.filter(
        s => s.row_id === row.id && s.col_id === col.id && s.score !== null
      )

      let normalized = 0
      if (cellScores.length > 0) {
        // Average across scorers, each normalized individually
        const norms = cellScores.map(s => normalizeScore(s.score, method, normConfig))
        normalized = norms.reduce((a, b) => a + b, 0) / norms.length
      }

      normalizedScores[col.id] = normalized
      weightedScore += normalized * weights[colIdx]
    })

    return {
      row_id: row.id,
      weighted_score: weightedScore,
      rank: 0, // assigned below
      normalized_scores: normalizedScores,
    }
  })

  // Sort by weighted score descending, assign ranks
  results.sort((a, b) => b.weighted_score - a.weighted_score)
  assignRanks(results)

  return results
}

/** Assign ranks handling ties (same score = same rank) */
function assignRanks(results: RowResult[]): void {
  if (results.length === 0) return

  let currentRank = 1
  results[0].rank = 1

  for (let i = 1; i < results.length; i++) {
    if (Math.abs(results[i].weighted_score - results[i - 1].weighted_score) < 1e-9) {
      results[i].rank = results[i - 1].rank
    } else {
      results[i].rank = i + 1
    }
  }
}

/** Check if row A dominates row B (A >= B on all criteria, A > B on at least one) */
export function dominates(
  a: Record<string, number>,
  b: Record<string, number>,
  colIds: string[]
): boolean {
  let strictlyBetter = false
  for (const id of colIds) {
    const aVal = a[id] ?? 0
    const bVal = b[id] ?? 0
    if (aVal < bVal - 1e-9) return false
    if (aVal > bVal + 1e-9) strictlyBetter = true
  }
  return strictlyBetter
}

/** Find all dominated rows */
export function findDominatedRows(results: RowResult[]): Set<string> {
  const dominated = new Set<string>()
  const colIds = results.length > 0
    ? Object.keys(results[0].normalized_scores)
    : []

  for (let i = 0; i < results.length; i++) {
    for (let j = 0; j < results.length; j++) {
      if (i === j) continue
      if (dominates(results[i].normalized_scores, results[j].normalized_scores, colIds)) {
        dominated.add(results[j].row_id)
      }
    }
  }
  return dominated
}
