import type { ScoringMethod, ACHValue, TrafficValue, TernaryValue, BinaryValue, CrossTableColumn } from '../types'

/** Normalize a raw score to 0-1 based on the scoring method */
export function normalizeScore(
  value: number | string | null,
  method: ScoringMethod,
  config?: { min?: number; max?: number; likert_labels?: string[] }
): number {
  if (value === null || value === undefined) return 0

  switch (method) {
    case 'numeric': {
      const min = config?.min ?? 0
      const max = config?.max ?? 10
      if (max === min) return 0.5
      return Math.max(0, Math.min(1, (Number(value) - min) / (max - min)))
    }
    case 'likert': {
      const labels = config?.likert_labels ?? ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree']
      const max = labels.length - 1
      if (max === 0) return 0.5
      return Math.max(0, Math.min(1, Number(value) / max))
    }
    case 'traffic':
      return normalizeTraffic(value as TrafficValue)
    case 'ternary':
      return normalizeTernary(value as TernaryValue)
    case 'binary':
      return normalizeBinary(value as BinaryValue)
    case 'ach':
      return normalizeACH(value as ACHValue)
    default:
      return 0
  }
}

function normalizeTraffic(value: TrafficValue | string): number {
  switch (value) {
    case 'R': return 0
    case 'A': return 0.5
    case 'G': return 1
    default: return 0
  }
}

function normalizeTernary(value: TernaryValue | string): number {
  switch (value) {
    case '-': return 0
    case '0': return 0.5
    case '+': return 1
    default: return 0.5
  }
}

function normalizeBinary(value: BinaryValue | string): number {
  return value === 'yes' ? 1 : 0
}

function normalizeACH(value: ACHValue | string): number {
  switch (value) {
    case 'II': return 0
    case 'I': return 0.25
    case 'N': return 0.5
    case 'C': return 0.75
    case 'CC': return 1
    default: return 0.5
  }
}

/** Get the effective scoring method for a column (handles per-column overrides) */
export function getColumnScoringMethod(
  column: CrossTableColumn,
  matrixMethod: ScoringMethod
): ScoringMethod {
  return column.scoring_override ?? matrixMethod
}

/** Get the normalization config for a column */
export function getColumnNormConfig(
  column: CrossTableColumn,
  matrixConfig?: { min?: number; max?: number; likert_labels?: string[] }
): { min?: number; max?: number; likert_labels?: string[] } {
  return {
    min: column.numeric_config?.min ?? matrixConfig?.min,
    max: column.numeric_config?.max ?? matrixConfig?.max,
    likert_labels: column.likert_labels ?? matrixConfig?.likert_labels,
  }
}

/** Aggregate multiple scores for a single cell (mean) */
export function aggregateScores(scores: number[]): number {
  if (scores.length === 0) return 0
  return scores.reduce((a, b) => a + b, 0) / scores.length
}

/** Convert a normalized 0-1 score back to a display scale */
export function denormalize(
  normalized: number,
  method: ScoringMethod,
  config?: { min?: number; max?: number; likert_labels?: string[] }
): number {
  switch (method) {
    case 'numeric': {
      const min = config?.min ?? 0
      const max = config?.max ?? 10
      return normalized * (max - min) + min
    }
    case 'likert': {
      const labels = config?.likert_labels ?? ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree']
      return normalized * (labels.length - 1)
    }
    default:
      return normalized
  }
}
