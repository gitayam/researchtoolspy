import type { CrossTableColumn, WeightingConfig } from '../types'

/** Distribute equal weights across all columns */
export function equalWeights(columns: CrossTableColumn[]): number[] {
  const n = columns.length
  if (n === 0) return []
  const w = 1 / n
  return columns.map(() => w)
}

/** Normalize an array of weights so they sum to 1 */
export function normalizeWeights(weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0)
  if (sum === 0) return weights.map(() => 1 / weights.length)
  return weights.map(w => w / sum)
}

/** Get weights from columns based on the weighting config */
export function getWeights(
  columns: CrossTableColumn[],
  config: WeightingConfig
): number[] {
  switch (config.method) {
    case 'equal':
      return equalWeights(columns)
    case 'manual':
      return normalizeWeights(columns.map(c => c.weight))
    case 'ahp':
      if (config.ahp_matrix) {
        return ahpWeightsFromMatrix(config.ahp_matrix)
      }
      return normalizeWeights(columns.map(c => c.weight))
    default:
      return equalWeights(columns)
  }
}

/** Extract weights from an AHP pairwise comparison matrix using eigenvalue approximation */
export function ahpWeightsFromMatrix(matrix: number[][]): number[] {
  const n = matrix.length
  if (n === 0) return []

  // Normalize each column
  const colSums = new Array(n).fill(0)
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      colSums[j] += matrix[i][j]
    }
  }

  const normalized: number[][] = matrix.map(row =>
    row.map((val, j) => (colSums[j] === 0 ? 0 : val / colSums[j]))
  )

  // Average each row for the priority vector
  const weights = normalized.map(row =>
    row.reduce((a, b) => a + b, 0) / n
  )

  return weights
}

/** Calculate AHP consistency ratio */
export function ahpConsistencyRatio(matrix: number[][], weights: number[]): number {
  const n = matrix.length
  if (n <= 2) return 0 // Always consistent for 1-2 criteria

  // Random index table (Saaty)
  const RI: Record<number, number> = {
    3: 0.58, 4: 0.90, 5: 1.12, 6: 1.24, 7: 1.32,
    8: 1.41, 9: 1.45, 10: 1.49, 11: 1.51, 12: 1.48,
  }

  // Compute Aw (matrix × weight vector)
  const aw = matrix.map(row =>
    row.reduce((sum, val, j) => sum + val * weights[j], 0)
  )

  // Lambda max
  const lambdaMax = aw.reduce((sum, val, i) =>
    sum + (weights[i] === 0 ? 0 : val / weights[i]), 0
  ) / n

  const ci = (lambdaMax - n) / (n - 1)
  const ri = RI[n] ?? 1.49
  return ri === 0 ? 0 : ci / ri
}

/** Validate that an AHP matrix is well-formed */
export function validateAHPMatrix(matrix: number[][]): { valid: boolean; error?: string } {
  const n = matrix.length
  if (n > 12) return { valid: false, error: 'AHP supports at most 12 criteria (66 pairwise comparisons)' }
  if (n === 0) return { valid: false, error: 'Matrix is empty' }

  for (let i = 0; i < n; i++) {
    if (matrix[i].length !== n) return { valid: false, error: `Row ${i} has ${matrix[i].length} entries, expected ${n}` }
    if (matrix[i][i] !== 1) return { valid: false, error: `Diagonal entry [${i}][${i}] must be 1` }
    for (let j = i + 1; j < n; j++) {
      const val = matrix[i][j]
      if (val < 1 / 9 || val > 9) return { valid: false, error: `Entry [${i}][${j}] = ${val} is outside 1/9 to 9 range` }
      const reciprocal = matrix[j][i]
      const expected = 1 / val
      if (Math.abs(reciprocal - expected) > 0.001) {
        return { valid: false, error: `Reciprocal mismatch: [${j}][${i}] = ${reciprocal}, expected ${expected.toFixed(4)}` }
      }
    }
  }
  return { valid: true }
}
