import type { Score, CrossTableConfig, DelphiCellStats, DelphiConsensus } from '../types'
import { normalizeScore, getColumnScoringMethod, getColumnNormConfig } from './scoring'

/** Compute Delphi statistics for a specific round */
export function computeDelphiConsensus(
  config: CrossTableConfig,
  scores: Score[],
  round: number
): DelphiConsensus {
  const roundScores = scores.filter(s => s.round === round)
  const { rows, columns } = config

  const cellStats: DelphiCellStats[] = []
  // For Kendall's W we need per-scorer rankings
  const scorerIds = Array.from(new Set(roundScores.map(s => s.user_id)))

  for (const row of rows) {
    for (const col of columns) {
      const method = getColumnScoringMethod(col, config.scoring.method)
      const normConfig = getColumnNormConfig(col, {
        min: config.scoring.scale?.min,
        max: config.scoring.scale?.max,
        likert_labels: config.scoring.labels ?? undefined,
      })

      const cellScores = roundScores
        .filter(s => s.row_id === row.id && s.col_id === col.id && s.score !== null)
        .map(s => normalizeScore(s.score, method, normConfig))

      if (cellScores.length === 0) {
        cellStats.push({
          row_id: row.id,
          col_id: col.id,
          round,
          median: 0,
          iqr: 0,
          min: 0,
          max: 0,
          count: 0,
          high_disagreement: false,
        })
        continue
      }

      const sorted = [...cellScores].sort((a, b) => a - b)
      const median = computeMedian(sorted)
      const q1 = computeQuantile(sorted, 0.25)
      const q3 = computeQuantile(sorted, 0.75)
      const iqr = q3 - q1
      // IQR > 1.5 on a 0-5 scale → threshold on 0-1 is 0.3
      const iqrOn5 = iqr * 5

      cellStats.push({
        row_id: row.id,
        col_id: col.id,
        round,
        median,
        iqr,
        min: sorted[0],
        max: sorted[sorted.length - 1],
        count: sorted.length,
        high_disagreement: iqrOn5 > 1.5,
      })
    }
  }

  const kendall_w = computeKendallW(config, roundScores, scorerIds)
  const high_disagreement_count = cellStats.filter(c => c.high_disagreement).length

  return {
    kendall_w,
    round,
    cell_stats: cellStats,
    high_disagreement_count,
  }
}

/** Compute median of a sorted array */
function computeMedian(sorted: number[]): number {
  const n = sorted.length
  if (n === 0) return 0
  const mid = Math.floor(n / 2)
  return n % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

/** Compute quantile of a sorted array (linear interpolation) */
function computeQuantile(sorted: number[], q: number): number {
  const n = sorted.length
  if (n === 0) return 0
  if (n === 1) return sorted[0]
  const pos = q * (n - 1)
  const lower = Math.floor(pos)
  const upper = Math.ceil(pos)
  if (lower === upper) return sorted[lower]
  return sorted[lower] + (pos - lower) * (sorted[upper] - sorted[lower])
}

/**
 * Compute Kendall's W (coefficient of concordance).
 * W = 12 * S / (k² * (n³ - n))
 * where k = number of scorers, n = number of items (rows),
 * S = sum of squared deviations of rank sums from mean rank sum.
 */
function computeKendallW(
  config: CrossTableConfig,
  roundScores: Score[],
  scorerIds: number[]
): number {
  const k = scorerIds.length
  const n = config.rows.length
  if (k < 2 || n < 2) return 0

  // For each scorer, compute total weighted score per row, then rank
  const scorerRankings: number[][] = []

  for (const userId of scorerIds) {
    const userScores = roundScores.filter(s => s.user_id === userId)
    const rowTotals: { row_id: string; total: number }[] = config.rows.map(row => {
      let total = 0
      for (const col of config.columns) {
        const method = getColumnScoringMethod(col, config.scoring.method)
        const normConfig = getColumnNormConfig(col, {
          min: config.scoring.scale?.min,
          max: config.scoring.scale?.max,
          likert_labels: config.scoring.labels ?? undefined,
        })
        const s = userScores.find(sc => sc.row_id === row.id && sc.col_id === col.id)
        if (s?.score !== null && s?.score !== undefined) {
          total += normalizeScore(s.score, method, normConfig)
        }
      }
      return { row_id: row.id, total }
    })

    // Rank (1 = highest total)
    const sorted = [...rowTotals].sort((a, b) => b.total - a.total)
    const ranks = new Array(n).fill(0)
    sorted.forEach((item, idx) => {
      const rowIdx = config.rows.findIndex(r => r.id === item.row_id)
      ranks[rowIdx] = idx + 1
    })
    scorerRankings.push(ranks)
  }

  // Compute rank sums for each row
  const rankSums = new Array(n).fill(0)
  for (let i = 0; i < n; i++) {
    for (const ranking of scorerRankings) {
      rankSums[i] += ranking[i]
    }
  }

  const meanRankSum = rankSums.reduce((a, b) => a + b, 0) / n
  const S = rankSums.reduce((sum, rs) => sum + (rs - meanRankSum) ** 2, 0)

  const W = (12 * S) / (k * k * (n * n * n - n))
  return Math.max(0, Math.min(1, W))
}

/** Compare two Delphi rounds to measure convergence */
export function compareRounds(
  prev: DelphiConsensus,
  current: DelphiConsensus
): { improved: boolean; kendall_delta: number; disagreement_delta: number } {
  return {
    improved: current.kendall_w > prev.kendall_w,
    kendall_delta: current.kendall_w - prev.kendall_w,
    disagreement_delta: current.high_disagreement_count - prev.high_disagreement_count,
  }
}
