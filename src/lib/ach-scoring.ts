/**
 * ACH (Analysis of Competing Hypotheses) scoring scale options.
 *
 * This module defines ONLY the scoring scale presets — the logarithmic
 * (Fibonacci) and linear option lists shown in the ACH matrix UI.
 *
 * The canonical hypothesis ranking/diagnosticity logic lives in
 * `ach-diagnosticity.ts` (consumed by `components/ach/ACHMatrix.tsx`).
 * Do NOT re-add a scoring/ranking engine here — there must be exactly one
 * scoring definition. A previous net-sum engine lived here and was removed
 * because it reintroduced the diagnosticity-inversion bug fixed elsewhere.
 */

export interface ScoreOption {
  label: string
  value: number
  color: string
  description: string
}

// Logarithmic scale (Fibonacci sequence) - matches human perception
export const LOGARITHMIC_SCORES: ScoreOption[] = [
  { label: 'Strongly Supports', value: 13, color: 'text-green-800 bg-green-100 dark:text-green-100 dark:bg-green-800', description: 'Evidence strongly confirms hypothesis' },
  { label: 'Moderately Supports', value: 8, color: 'text-green-700 bg-green-50 dark:text-green-200 dark:bg-green-700', description: 'Evidence moderately confirms hypothesis' },
  { label: 'Slightly Supports', value: 5, color: 'text-green-600 bg-green-50 dark:text-green-200 dark:bg-green-600', description: 'Evidence slightly confirms hypothesis' },
  { label: 'Weakly Supports', value: 3, color: 'text-green-500 bg-green-50 dark:text-green-200 dark:bg-green-500', description: 'Evidence weakly confirms hypothesis' },
  { label: 'Very Weakly Supports', value: 1, color: 'text-green-400 bg-green-50 dark:text-green-200 dark:bg-green-400', description: 'Evidence very weakly confirms hypothesis' },
  { label: 'Neutral', value: 0, color: 'text-gray-600 bg-gray-100 dark:text-gray-200 dark:bg-gray-600', description: 'Evidence neither supports nor contradicts' },
  { label: 'Very Weakly Contradicts', value: -1, color: 'text-red-400 bg-red-50 dark:text-red-200 dark:bg-red-400', description: 'Evidence very weakly contradicts hypothesis' },
  { label: 'Weakly Contradicts', value: -3, color: 'text-red-500 bg-red-50 dark:text-red-200 dark:bg-red-500', description: 'Evidence weakly contradicts hypothesis' },
  { label: 'Slightly Contradicts', value: -5, color: 'text-red-600 bg-red-50 dark:text-red-200 dark:bg-red-600', description: 'Evidence slightly contradicts hypothesis' },
  { label: 'Moderately Contradicts', value: -8, color: 'text-red-700 bg-red-50 dark:text-red-200 dark:bg-red-700', description: 'Evidence moderately contradicts hypothesis' },
  { label: 'Strongly Contradicts', value: -13, color: 'text-red-800 bg-red-100 dark:text-red-100 dark:bg-red-800', description: 'Evidence strongly contradicts hypothesis' },
]

// Linear scale - for organizational requirements
export const LINEAR_SCORES: ScoreOption[] = [
  { label: 'Strongly Supports', value: 5, color: 'text-green-800 bg-green-100 dark:text-green-100 dark:bg-green-800', description: 'Evidence strongly confirms hypothesis' },
  { label: 'Moderately Supports', value: 4, color: 'text-green-700 bg-green-50 dark:text-green-200 dark:bg-green-700', description: 'Evidence moderately confirms hypothesis' },
  { label: 'Slightly Supports', value: 3, color: 'text-green-600 bg-green-50 dark:text-green-200 dark:bg-green-600', description: 'Evidence slightly confirms hypothesis' },
  { label: 'Weakly Supports', value: 2, color: 'text-green-500 bg-green-50 dark:text-green-200 dark:bg-green-500', description: 'Evidence weakly confirms hypothesis' },
  { label: 'Very Weakly Supports', value: 1, color: 'text-green-400 bg-green-50 dark:text-green-200 dark:bg-green-400', description: 'Evidence very weakly confirms hypothesis' },
  { label: 'Neutral', value: 0, color: 'text-gray-600 bg-gray-100 dark:text-gray-200 dark:bg-gray-600', description: 'Evidence neither supports nor contradicts' },
  { label: 'Very Weakly Contradicts', value: -1, color: 'text-red-400 bg-red-50 dark:text-red-200 dark:bg-red-400', description: 'Evidence very weakly contradicts hypothesis' },
  { label: 'Weakly Contradicts', value: -2, color: 'text-red-500 bg-red-50 dark:text-red-200 dark:bg-red-500', description: 'Evidence weakly contradicts hypothesis' },
  { label: 'Slightly Contradicts', value: -3, color: 'text-red-600 bg-red-50 dark:text-red-200 dark:bg-red-600', description: 'Evidence slightly contradicts hypothesis' },
  { label: 'Moderately Contradicts', value: -4, color: 'text-red-700 bg-red-50 dark:text-red-200 dark:bg-red-700', description: 'Evidence moderately contradicts hypothesis' },
  { label: 'Strongly Contradicts', value: -5, color: 'text-red-800 bg-red-100 dark:text-red-100 dark:bg-red-800', description: 'Evidence strongly contradicts hypothesis' },
]
