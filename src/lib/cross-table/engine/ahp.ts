import { ahpWeightsFromMatrix, ahpConsistencyRatio, validateAHPMatrix } from './weighting'

export interface AHPResult {
  weights: number[]
  cr: number
  consistent: boolean
  error?: string
}

/** Run full AHP analysis: validate matrix, compute weights, check consistency */
export function computeAHP(matrix: number[][]): AHPResult {
  const validation = validateAHPMatrix(matrix)
  if (!validation.valid) {
    return {
      weights: [],
      cr: 0,
      consistent: false,
      error: validation.error,
    }
  }

  const weights = ahpWeightsFromMatrix(matrix)
  const cr = ahpConsistencyRatio(matrix, weights)

  return {
    weights,
    cr,
    consistent: cr <= 0.10,
  }
}

/** Create an identity AHP matrix (all equal preferences) for n criteria */
export function createIdentityMatrix(n: number): number[][] {
  return Array.from({ length: n }, () => Array(n).fill(1))
}

/** Set a pairwise comparison and its reciprocal */
export function setComparison(matrix: number[][], i: number, j: number, value: number): number[][] {
  const copy = matrix.map(row => [...row])
  copy[i][j] = value
  copy[j][i] = 1 / value
  return copy
}

/** Count total pairwise comparisons needed for n criteria */
export function pairwiseCount(n: number): number {
  return (n * (n - 1)) / 2
}
